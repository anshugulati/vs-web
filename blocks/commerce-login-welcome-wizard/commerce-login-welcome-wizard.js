import { getConfigValue } from '../../scripts/configs.js';
import { isLoggedInUser, fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';
import { mergeWishlist } from '../../scripts/wishlist/api.js';
import { mergeCart } from '../../scripts/minicart/cart.js';
import { setCookie } from '../../scripts/commerce.js';
import {
  showPageSuccessMessage,
  showPageErrorMessage,
  togglePasswordVisibility,
  setErrorMessageForField,
  validateForm,
  validateInput,
  addRecaptchaScript,
  validateReCaptchaV3,
  getErrorfields,
  showErrorMessage,
  resetMessage,
} from '../../scripts/forms.js';
import { datalayerLogin, getLoggedInUserAttributes, getPageName } from '../../scripts/analytics/google-data-layer.js';
import { CARTID_STORE } from '../../scripts/minicart/api.js';

const FORGOT_PASSWORD_SOURCE = 'forgotPassword';
const NEW_PASSWORD_SOURCE = 'newPassword';
const CHANGE_PASSWORD_SOURCE = 'changePassword';
const LOGOUT_SOURCE = 'logout';
const VERIFY_EMAIL_SUCCESS_SOURCE = 'verifyEmailSuccess';
const VERIFY_EMAIL_ERROR_SOURCE = 'verifyEmailError';

async function displayMessageBasedOnSource() {
  const placeholders = await fetchPlaceholdersForLocale();
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

function getRedirectUrl() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (params.has('redirect')) {
    const redirect = params.get('redirect');
    const action = params.get('action');
    params.delete('redirect');
    params.delete('action');
    window.history.replaceState({}, '', url);
    if (action) {
      return `${redirect}?action=${action}`;
    }
    return redirect;
  }
  if (window.location.href.indexOf('/cart') !== -1) {
    return `/${document.documentElement.lang || 'en'}/checkout`;
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

async function login(form, redirectUrl) {
  const username = sessionStorage.getItem('loginEmail') || '';
  const password = form.querySelector('#password').value;
  const passwordField = form.querySelector('#password');
  const commerceRestEndpoint = await getConfigValue('commerce-rest-endpoint');
  const storeCode = await getConfigValue('commerce-store-view-code');
  const placeholders = await fetchPlaceholdersForLocale();
  const cookieExpiryDays = await getConfigValue('commerce-login-cookie-expiry-days') || 100;
  try {
    const response = await fetch(`${commerceRestEndpoint}/${storeCode}/V1/integration/customer/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      const loginPasswordIncorrect = placeholders.loginPasswordIncorrect || `${data.message}`;
      showErrorMessage(passwordField, loginPasswordIncorrect);
      document.querySelector('.login-continue').classList.remove('loader');
      document.querySelector('.login-continue').setAttribute('disabled', 'true');
      datalayerLogin('Login Attempt', 'Email : invalid - password');
      return;
    }
    setCookie('auth_user_token', data, cookieExpiryDays);
    const userDetails = await getLoggedInUserAttributes(false);
    const dlPayload = {
      aep_page_name: getPageName(window.pageType),
      ...userDetails,
    };
    datalayerLogin('Login Success', 'Email', dlPayload);

    if (window.location.href.indexOf('/cart') !== -1) {
      const cartDetails = localStorage.getItem(CARTID_STORE);
      const cartId = JSON.parse(cartDetails).value;
      // Dispatch event to associate cart with user
      window.dispatchEvent(new CustomEvent('react:associateCart', { detail: { cartId: JSON.parse(cartId), redirectUrl } }));
    } else {
      // Handle cart and wishlist merge
      const mergeWishlistPromise = mergeWishlist();
      const mergeCartPromise = mergeCart();
      await Promise.all([mergeWishlistPromise, mergeCartPromise]);
      window.location.href = redirectUrl;
    }

    const loginWelcomeWizardToastMessage = placeholders.signedInSucessfully || 'Signed in successfully!';
    // TODO : Later change session storage to simple query params
    sessionStorage.setItem('loginWelcomeWizardToastMessage', loginWelcomeWizardToastMessage);
  } catch (error) {
    const genericErrorMessage = placeholders.genericErrorMessage || 'An error occurred while logging in. Please try again.';
    showErrorMessage(passwordField, genericErrorMessage);
    document.querySelector('.login-continue').classList.remove('loader');
    document.querySelector('.login-continue').setAttribute('disabled', 'true');
  }
}

export default async function decorate(block) {
  const placeholders = await fetchPlaceholdersForLocale();

  function changeEmailID(newEmail) {
    block.querySelector('.email-info-container p').textContent = newEmail;
  }

  const form = document.createElement('form');
  form.setAttribute('id', 'welcome');
  const lang = document.documentElement.lang || 'en';
  const redirectUrl = getRedirectUrl();
  document.querySelector('.commerce-login-welcome-wizard p:nth-child(2)')?.classList.add('sign-in-text');
  if (isLoggedInUser()) {
    window.location.href = redirectUrl;
    return;
  }

  form.innerHTML = `
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="password" id="password" name="password" aria-label="${placeholders.password || 'Password'}" placeholder=" " required autocomplete="password">
        <label for="password">${placeholders.enterPassword || 'Enter Password'}</label>
        <span class="unmask-password" aria-controls="password"></span>
      </div>
    </div>
    <button class="login-continue" type="submit"><span>${placeholders.signinContinue || 'Continue'}</span></button>
    <a href="/${lang}/user/password" class="forgot-password">${placeholders.forgotPassword}</a>
  `;

  const siteKey = await getConfigValue('recaptchaV3-sitekey');
  addRecaptchaScript(siteKey);
  form.setAttribute('novalidate', '');

  form.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
  });

  form.querySelector('.forgot-password').addEventListener('click', () => {
    datalayerLogin('Forget Password - Click', 'Email');
  });

  form.querySelector('.unmask-password')?.addEventListener('click', togglePasswordVisibility);

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
    const submitButton = document.querySelector('.login-continue');
    if (!validateForm(form)) {
      const errorFieldsList = await getErrorfields(form);
      datalayerLogin('Login Attempt', `Email : invalid - ${errorFieldsList}`);
      return;
    }
    // TODO: REMOVE THIS CONDITIONAL WHEN RECAPTCHA IS ENABLED for PR domains & Multi-market set up
    const bypassRecaptcha = await getConfigValue('recaptcha-bypass');
    if (bypassRecaptcha === 'true') {
      submitButton?.classList.add('loader');
      await login(form, redirectUrl);
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
        await login(form, redirectUrl);
        submitButton?.classList.remove('loader');
      } else {
        submitButton?.classList.remove('loader');
        const recaptchaErrorMessage = placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.';
        showPageErrorMessage(recaptchaErrorMessage);
      }
    });
  });

  block.querySelector('img').addEventListener('click', () => {
    const passwordElement = block.querySelector('#password');
    if (passwordElement) {
      passwordElement.value = '';
    }
    resetMessage(passwordElement);
    document.querySelector('main').classList.remove('welcome-flow');
  });

  let emailIdSession = sessionStorage.getItem('loginEmail') || '';
  window.addEventListener('USER_LOGGEDIN', () => {
    emailIdSession = sessionStorage.getItem('loginEmail');
    changeEmailID(emailIdSession);
  });

  let emailInfoContainer = block.querySelector('.email-info-container');
  if (!emailInfoContainer) {
    emailInfoContainer = document.createElement('div');
    emailInfoContainer.classList.add('email-info-container');
    emailInfoContainer.innerHTML = `<p>${emailIdSession}</p>`;
    const changeSpan = emailInfoContainer.querySelector('.change-link') || document.createElement('span');
    changeSpan.classList.add('change-link');

    if (!changeSpan.querySelector('a')) {
      const changeLink = document.createElement('a');
      changeLink.textContent = `${placeholders.change || 'Change'}`;
      changeLink.addEventListener('click', () => {
        document.querySelector('main').classList.remove('welcome-flow');
      });
      changeSpan.appendChild(changeLink);
    }

    if (!emailInfoContainer.contains(changeSpan)) {
      emailInfoContainer.appendChild(changeSpan);
    }

    block.appendChild(emailInfoContainer);
  }

  const loginContainer = document.createElement('div');
  loginContainer.classList.add('login-welcome-container');
  loginContainer.appendChild(form);
  await displayMessageBasedOnSource();
  decorateIcons(loginContainer);
  block.appendChild(loginContainer);
}
