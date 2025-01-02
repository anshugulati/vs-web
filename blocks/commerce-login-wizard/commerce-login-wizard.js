import { getConfigValue } from '../../scripts/configs.js';
import { isLoggedInUser, fetchPlaceholdersForLocale, showToastNotification } from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';
import {
  showPageSuccessMessage,
  showPageErrorMessage,
  setErrorMessageForField,
  validateForm,
  validateInput,
  EMAIL_PATTERN,
  addRecaptchaScript,
  validateReCaptchaV3,
  getErrorfields,
} from '../../scripts/forms.js';
import { datalayerLogin } from '../../scripts/analytics/google-data-layer.js';

const FORGOT_PASSWORD_SOURCE = 'forgotPassword';
const NEW_PASSWORD_SOURCE = 'newPassword';
const CHANGE_PASSWORD_SOURCE = 'changePassword';
const LOGOUT_SOURCE = 'logout';
const VERIFY_EMAIL_SUCCESS_SOURCE = 'verifyEmailSuccess';
const VERIFY_EMAIL_ERROR_SOURCE = 'verifyEmailError';

const placeholders = await fetchPlaceholdersForLocale();
const showPageApiResponseDisabled = await getConfigValue('disable-api-message-section');

async function displayMessageBasedOnSource() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (params.has('source')) {
    const source = params.get('source');
    params.delete('source');
    let message;
    let errorMessage;
    if (source === FORGOT_PASSWORD_SOURCE) {
      message = `${placeholders.loginMessageForgotPassword || 'If your account is valid, an email will be sent with instructions to reset your password.'}`;
    } else if (source === NEW_PASSWORD_SOURCE) {
      message = `${placeholders.loginMessageNewPassword || 'Your password has been changed.'}`;
    } else if (source === LOGOUT_SOURCE) {
      message = `${placeholders.loginMessageLogout || 'You have been logged out.'}`;
    } else if (source === CHANGE_PASSWORD_SOURCE) {
      message = `${placeholders.loginMessageChangePassword || 'Your password has been changed.'}`;
    } else if (source === VERIFY_EMAIL_SUCCESS_SOURCE) {
      message = `${placeholders.loginMessageVerifyEmailSuccess || 'You have just used your one-time login link. Your account is now active and you are authenticated. Please login to continue.'}`;
    } else if (source === VERIFY_EMAIL_ERROR_SOURCE) {
      errorMessage = `${placeholders.loginMessageVerifyEmailError || 'The mail is already activate or expired/invalid.'}`;
    }
    if (message) {
      if (showPageApiResponseDisabled === 'true') {
        showToastNotification(message);
      } else {
        showPageSuccessMessage(message);
      }
    } else if (errorMessage) {
      showPageErrorMessage(errorMessage);
    }
    window.history.replaceState({}, '', url);
  }
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('guestCheckout') !== 'true' && window.location.href.indexOf('/cart') === -1) {
  document.querySelector('main').classList.add('header-flow');
} else {
  document.querySelector('main').classList?.remove('header-flow');
}

function toggleVisibilityToWelcomeBackScreen() {
  document.querySelector('main').classList.add('welcome-flow');
}

async function login(form) {
  const email = form.querySelector('#login-username').value;
  const commerceEndPoint = await getConfigValue('commerce-base-endpoint');
  const emailVerificationEndPoint = await getConfigValue('appbuilder-email-verification-endpoint');
  const storeViewCode = await getConfigValue('commerce-store-view-code');

  try {
    const response = await fetch(`${commerceEndPoint}/${emailVerificationEndPoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeViewCode, email }),
    });

    const data = await response.json();
    if (response.ok) {
      if (!data.customerExists) {
        let path = `/${document.documentElement.lang || 'en'}/`;
        if (document.referer) {
          const refererUrl = new URL(document.referrer);
          path = refererUrl.pathname + refererUrl.search + refererUrl.hash;
        }
        sessionStorage.setItem('previousUrl', path);
        window.location.href = `/${document.documentElement.lang || 'en'}/user/register?email=${email}`;
      } else {
        sessionStorage.setItem('loginEmail', email);
        try {
          const key = 'keyToSetEmail';
          const event = new CustomEvent('USER_LOGGEDIN', { detail: { key, email } });
          window.dispatchEvent(event);
        } catch (error) {
          showPageErrorMessage(placeholders.genericErrorMessage || 'An error occurred while logging in. Please try again.');
        }
        toggleVisibilityToWelcomeBackScreen();
      }
    }
  } catch (error) {
    showPageErrorMessage(placeholders.genericErrorMessage || 'An error occurred while logging in. Please try again.');
    document.querySelector('.login-continue').classList.remove('loader');
  }
}

export default async function decorate(block) {
  if (isLoggedInUser()) return;

  block.querySelectorAll('ul').forEach((ul) => {
    const liElements = ul.querySelectorAll('li');
    const liArray = Array.from(liElements);
    const liLimit = liArray?.slice(0, 3);
    ul.innerHTML = '';
    liLimit.forEach((li) => {
      ul.appendChild(li);
    });
  });

  const form = document.createElement('form');
  form.setAttribute('class', 'login-form');
  form.innerHTML = `
    <div class="exist-signin">
      <div class="input-field-wrapper">
        <div class="input-wrapper">
        <input type="email" id="login-username" name="login-username" aria-label="${placeholders.email || 'Email'}" placeholder=" " pattern="${EMAIL_PATTERN}" required autocomplete="email" >
          <label for="login-username">${placeholders.emailAddress || 'Email address'}</label>
        </div>
      </div>
      <button type="submit"><span>${placeholders.continue || 'CONTINUE'}</span></button>
    </div>
  `;

  const siteKey = await getConfigValue('recaptchaV3-sitekey');
  addRecaptchaScript(siteKey);
  form.setAttribute('novalidate', '');

  form.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
  });

  const userEmail = new URLSearchParams(window.location.search).get('email');
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.delete('email');
  const emailInp = form.querySelector('#login-username');
  emailInp.value = userEmail;

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      if (!validateInput(input)) {
        form.querySelector('button').disabled = true;
      } else {
        form.querySelector('button').disabled = false;
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = document.querySelector('.login-container button');
    if (!validateForm(form)) {
      const errorFieldsList = await getErrorfields(form);
      datalayerLogin('Login Attempt', `Email : invalid - ${errorFieldsList}`);
      return;
    }
    // TODO: REMOVE THIS CONDITIONAL WHEN RECAPTCHA IS ENABLED for PR domains & Multi-market set up
    const bypassRecaptcha = await getConfigValue('recaptcha-bypass');
    if (bypassRecaptcha === 'true') {
      submitButton?.classList.add('loader');
      await login(form);
      submitButton?.classList.remove('loader');
      return;
    }
    // eslint-disable-next-line no-undef
    grecaptcha.ready(async () => {
      // eslint-disable-next-line no-undef
      const token = await grecaptcha.execute(siteKey, { action: 'submit' });
      if (!token) {
        showPageErrorMessage(placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.');
        return;
      }
      const captchaValidated = await validateReCaptchaV3(token, submitButton);
      if (captchaValidated) {
        submitButton?.classList.add('loader');
        await login(form);
        submitButton?.classList.remove('loader');
      } else {
        submitButton?.classList.remove('loader');
        showPageErrorMessage(placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.');
      }
    });
  });

  const loginContainer = document.createElement('div');
  const orLabel = document.createElement('div');
  orLabel.setAttribute('class', 'or-label');
  orLabel.innerHTML = `<p>${placeholders.orLabel || 'OR'}</p>`;
  loginContainer.classList.add('login-container');
  await displayMessageBasedOnSource();
  loginContainer.appendChild(form);
  decorateIcons(loginContainer);
  block.appendChild(loginContainer);
  block.appendChild(orLabel);
}
