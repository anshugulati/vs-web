import { getConfigValue } from '../../scripts/configs.js';
import { isLoggedInUser, fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
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

const getMainElement = () => {
  if (window.location.href.indexOf('/cart') !== -1) {
    return document.querySelector('.cart__login-container');
  }
  return document.querySelector('main');
};
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
      showPageSuccessMessage(message);
    } else if (errorMessage) {
      showPageErrorMessage(errorMessage);
    }
    window.history.replaceState({}, '', url);
  }
}

const mainElement = getMainElement();
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('guestCheckout') === 'true' || window.location.href.indexOf('/cart') !== -1) {
  mainElement?.classList.add('checkout-flow');
  mainElement?.classList.add('toggle-button');
} else {
  mainElement?.classList?.remove('checkout-flow');
  mainElement?.classList?.remove('toggle-button');
}

function getRedirectUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (params.has('redirect')) {
    const redirect = params.get('redirect');
    const action = params.get('action');
    if (action !== 'writeReview') {
      params.delete('redirect');
      params.delete('action');
      window.history.replaceState({}, '', url);
    }
    if (action) {
      return `${redirect}?action=${action}`;
    }
    return redirect;
  }
  if (document.referrer) {
    const refererUrl = new URL(document.referrer);
    const path = refererUrl.pathname + refererUrl.search + refererUrl.hash;
    if (refererUrl.pathname.includes('login')) {
      return `/${document.documentElement.lang || 'en'}/user/account`;
    }
    return `${path}`;
  }
  return `/${document.documentElement.lang || 'en'}/user/account`;
}

function toggleVisibilityToWelcomeBackScreen() {
  getMainElement()?.classList.add('welcome-flow');
}

async function loginUser(form) {
  const email = form.querySelector('#exist-username').value;
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

async function loginGuest(form) {
  const email = form.querySelector('#guest-username').value;
  const commerceEndPoint = await getConfigValue('commerce-base-endpoint');
  const emailVerificationEndPoint = await getConfigValue('appbuilder-email-verification-endpoint');
  const storeViewCode = await getConfigValue('commerce-store-view-code');
  let redirectUrl = '';
  try {
    const response = await fetch(`${commerceEndPoint}/${emailVerificationEndPoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeViewCode, email }),
    });

    const data = await response.json();
    if (response.ok && data.customerExists) {
      sessionStorage.setItem('loginEmail', email);
      try {
        const key = 'keyToSetEmail';
        const event = new CustomEvent('USER_LOGGEDIN', { detail: { key, email } });
        window.dispatchEvent(event);
      } catch (error) {
        showPageErrorMessage(placeholders.genericErrorMessage || 'An error occurred while logging in. Please try again.');
      }
      toggleVisibilityToWelcomeBackScreen();
    } else {
      redirectUrl = `/${document.documentElement.lang || 'en'}/checkout`;
      window.location.href = redirectUrl;
    }
  } catch (error) {
    document.querySelector('.commerce-guest-checkout-wizard .login-container button').classList.remove('loader');
  }
}

export default async function decorate(block) {
  const redirectUrl = getRedirectUrl();

  if (isLoggedInUser()) {
    window.location.href = redirectUrl;
    return;
  }

  block.querySelectorAll('ul').forEach((ul) => {
    const liElements = ul.querySelectorAll('li');
    const liArray = Array.from(liElements);
    const liLimit = liArray?.slice(0, 3);
    ul.innerHTML = '';
    liLimit.forEach((li) => {
      ul.appendChild(li);
    });
  });

  const initButtonExist = document.createElement('div');
  initButtonExist.innerHTML = `
    <div class="input-field-wrapper continue-signin">
      <button id="continue-signin" class="secondary"><span>${placeholders.signInRegister || 'Sign in or Register to Continue'}</span></button>
    </div>
  `;

  const initButtonContinue = document.createElement('div');
  initButtonContinue.innerHTML = `
  <div class="input-field-wrapper init-guest">
      <button id="guest-trigger" class="secondary"><span>${placeholders.continueAsAGuest || 'continue as a guest'}</span></button>
  </div>`;

  initButtonExist.querySelector('button').addEventListener('click', () => {
    getMainElement()?.classList.add('toggle-button');
  });

  initButtonContinue.querySelector('button').addEventListener('click', () => {
    getMainElement()?.classList?.remove('toggle-button');
  });

  const formExist = document.createElement('form');
  const formContinue = document.createElement('form');

  formExist.innerHTML = `<div class="exist-signin">
      <div class="input-field-wrapper">
        <div class="input-wrapper">
        <input type="email" id="exist-username" name="exist-username" aria-label="${placeholders.email || 'Email'}" placeholder=" " pattern="${EMAIL_PATTERN}" required autocomplete="email" >
          <label for="exist-username">${placeholders.emailaddress || 'Email address'}</label>
        </div>
      </div>
      <button type="submit"><span>${placeholders.continue || 'CONTINUE'}</span></button>
    </div>`;

  formContinue.innerHTML = `<div class="guest-checkout">
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="email" id="guest-username" name="guest-username" aria-label="${placeholders.email || 'Email'}" placeholder=" " pattern="${EMAIL_PATTERN}" required autocomplete="email" >
        <label for="guest-username">${placeholders.emailaddress || 'Email address'}</label>
      </div>
    </div>
    <button type="submit"><span>${placeholders.continue || 'CONTINUE'}</span></button>
    </div>
  `;

  const siteKey = await getConfigValue('recaptchaV3-sitekey');
  addRecaptchaScript(siteKey);
  formContinue.setAttribute('novalidate', '');
  formExist.setAttribute('novalidate', '');

  formExist.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
  });

  formContinue.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
  });

  formExist.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      if (!validateInput(input)) {
        formExist.querySelector('button').disabled = true;
      } else {
        formExist.querySelector('button').disabled = false;
      }
    });
  });

  formContinue.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      if (!validateInput(input)) {
        formContinue.querySelector('button').disabled = true;
      } else {
        formContinue.querySelector('button').disabled = false;
      }
    });
  });

  function createSubmitHandler(form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submitButton = form.querySelector('button');

      if (!validateForm(form)) {
        const errorFieldsList = await getErrorfields(form);
        datalayerLogin('Login Attempt', `Email : invalid - ${errorFieldsList}`);
        return;
      }

      // TODO: REMOVE THIS CONDITIONAL WHEN RECAPTCHA IS ENABLED for PR domains & Multi-market setup
      const bypassRecaptcha = await getConfigValue('recaptcha-bypass');
      if (bypassRecaptcha === 'true') {
        submitButton?.classList.add('loader');
        if (form.querySelector('div').classList.contains('exist-signin')) {
          await loginUser(form);
        } else {
          await loginGuest(form);
        }
        submitButton?.classList.remove('loader');
        return;
      }

      // eslint-disable-next-line no-undef
      grecaptcha.ready(async () => {
        try {
          // eslint-disable-next-line no-undef
          const token = await grecaptcha.execute(siteKey, { action: 'submit' });

          if (!token) {
            showPageErrorMessage(placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.');
            return;
          }

          const captchaValidated = await validateReCaptchaV3(token, submitButton);
          if (captchaValidated) {
            submitButton?.classList.add('loader');
            if (form.querySelector('div').classList.contains('exist-signin')) {
              await loginUser(form);
            } else {
              await loginGuest(form);
            }
            submitButton?.classList.remove('loader');
          } else {
            submitButton?.classList.remove('loader');
            const recaptchaErrorMessage = placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.';
            showPageErrorMessage(recaptchaErrorMessage);
          }
        } catch (error) {
          submitButton?.classList.remove('loader');
          showPageErrorMessage(placeholders.genericErrorMessage || 'An error occurred while logging in. Please try again.');
        }
      });
    });
  }

  createSubmitHandler(formExist);
  createSubmitHandler(formContinue);

  const divNames = ['title', 'sub-text', 'commerce-guest-checkout-wizard-partition'];
  Array.from(block.children).forEach((child, index) => {
    child.classList.add(divNames[index]);
  });

  const pNames = ['sign-in-text', 'offers-title'];
  const pTags = block.querySelectorAll('.sub-text div p');
  Array.from(pTags).forEach((tag, index) => {
    tag.classList.add(pNames[index]);
  });

  const checkOutPNames = ['checkout-title', 'checkout-desc'];
  const checkoutPTags = block.querySelectorAll('.commerce-guest-checkout-wizard-partition p');
  Array.from(checkoutPTags).forEach((tag, index) => {
    tag.classList.add(checkOutPNames[index]);
  });

  const loginContainerContinue = document.createElement('div');
  loginContainerContinue.classList.add('login-container');
  const guestOut = block.querySelector('.commerce-guest-checkout-wizard-partition');
  loginContainerContinue.append(initButtonContinue);
  loginContainerContinue.append(formContinue);
  decorateIcons(loginContainerContinue);
  guestOut.append(loginContainerContinue);
  const lastSection = getMainElement()?.querySelector('.section:last-child');
  lastSection?.parentNode.insertBefore(guestOut, lastSection);
  const orLabel = document.createElement('div');
  orLabel.setAttribute('class', 'or-label');
  orLabel.innerHTML = `<p>${placeholders.orLabel || 'OR'}</p>`;
  const loginContainerExist = document.createElement('div');
  loginContainerExist.classList.add('login-container');
  await displayMessageBasedOnSource();
  loginContainerExist.appendChild(initButtonExist);
  loginContainerExist.appendChild(formExist);
  decorateIcons(loginContainerExist);
  block.appendChild(loginContainerExist);
  block.appendChild(orLabel);

  window.addEventListener('react:loginFragmentLoaded', () => {
    const lastSectionElem = getMainElement()?.querySelector('.section:last-child');
    lastSectionElem?.parentNode.insertBefore(guestOut, lastSectionElem);
  });
}
