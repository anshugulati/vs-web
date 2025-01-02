/* eslint-disable no-useless-escape */
import { getConfigValue } from '../../scripts/configs.js';
import {
  isLoggedInUser,
  fetchPlaceholdersForLocale, showToastNotification,
} from '../../scripts/scripts.js';
import { fetchStoreViews } from '../../scripts/customer/register-api.js';
import {
  togglePasswordVisibility,
  setErrorMessageForField,
  validateForm,
  validateInput,
  EMAIL_PATTERN,
  PASSWORD_PATTERN,
  FULLNAME_PATTERN,
  showErrorMessage,
  customSelectbox,
  showPageErrorMessage,
  addRecaptchaScript,
  validateReCaptchaV3,
  getErrorfields,
} from '../../scripts/forms.js';
import { datalayerLogin, getLoggedInUserAttributes, getPageName } from '../../scripts/analytics/google-data-layer.js';

import { decorateIcons } from '../../scripts/aem.js';

// handles sign up
async function signup(form, placeholders, lang) {
  const commerceRestEndpoint = await getConfigValue('commerce-rest-endpoint');
  const storeCode = await getConfigValue('commerce-store-view-code');
  const storeViews = await fetchStoreViews();
  const storeView = storeViews.find((view) => view.code === storeCode);
  const websiteId = storeView?.website_id || 1;
  const storeId = storeView?.id || 1;
  const fullname = form.querySelector('#fullname').value;
  const [firstname, lastname] = fullname.split(' ');
  const email = form.querySelector('#username').value;
  const password = form.querySelector('#password').value;

  const response = await fetch(`${commerceRestEndpoint}/${storeCode}/V1/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: {
        email,
        firstname,
        lastname,
        websiteId,
        storeId,
      },
      password,
    }),
  });

  const data = await response.json();
  const errorContainer = form.querySelector('.error-container');
  if (response.ok && data?.email === email) {
    const userDetails = await getLoggedInUserAttributes(false);
    const dlPayload = {
      aep_page_name: getPageName(window.pageType),
      ...userDetails,
    };
    datalayerLogin('Registration Success', 'Email', dlPayload);
    errorContainer.innerHTML = '';
    sessionStorage.setItem('userId', `${data.id}`);
    showToastNotification(placeholders.signupSuccess || 'Account created successfully!');
    const redirectUrl = sessionStorage.getItem('previousUrl') || `/${lang}/checkout`;
    window.location.href = redirectUrl;
  } else {
    document.querySelector('.submit-container button.createNewAccountButton')?.classList.remove('loader');
    const errorMessage = `${data.message}`;
    datalayerLogin('Registration Attempt', 'Email : valid');
    if (errorMessage.includes('same email address')) {
      datalayerLogin('Registration Attempt', 'Email : invalid - email');
      showErrorMessage(form.querySelector('#username'), placeholders.alreadyTakenMail || 'The email address is already taken');
    }
  }
}

export default async function decorate(block) {
  const lang = document.documentElement.lang || 'en';
  if (isLoggedInUser()) {
    window.location.href = `/${lang}/user/account`;
    return;
  }
  document.querySelector('main').classList.add('signup-wizard');
  const placeholders = await fetchPlaceholdersForLocale();

  const validationRulesContent = block.querySelector('ul') || document.createElement('ul');
  if (validationRulesContent) {
    validationRulesContent.classList.add('validation-container', 'hide');
  }
  const validationRules = [
    { text: placeholders.lengthPassword || 'Should be 8 characters.', id: 'length-check' },
    { text: placeholders.specialPassword || 'Must contain at least 1 special character.', id: 'special-check' },
    { text: placeholders.numPassword || 'Must contain at least 1 numeric character.', id: 'numeric-check' },
    { text: placeholders.spacePassword || 'Spaces are not allowed in your password.', id: 'space-check' },
  ];
  const validationContainer = document.querySelector('.validation-container');
  validationContainer.innerHTML = '';
  validationRules.forEach((rule) => {
    const li = document.createElement('li');
    li.classList.add(rule.id);
    li.id = rule.id;
    li.textContent = rule.text;
    validationContainer.appendChild(li);
  });
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="input-field-wrapper">
      <div class="email-wrapper">
        <div>${placeholders.registerWith || 'Registering with'} </div>
        <span class="email-add"></span>
        <span class="change-email">${placeholders.change || 'Change'} </span>
      </div>
      <div class="input-wrapper" style="display: none;">
        <input type="email" id="username" name="username" pattern="${EMAIL_PATTERN}" aria-label="${placeholders.email || 'Email'}" placeholder=" " required autocomplete="email" />
        <label for="username">${placeholders.email || 'Email'}</label>
      </div>
    </div>
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="text" id="fullname" class="fullname" name="fullname" pattern="${FULLNAME_PATTERN}" placeholder="" aria-label="${placeholders.fullName || 'Full Name'}" required autocomplete="fullname" />
        <label for="fullname">${placeholders.fullName || 'Full Name *'}</label>
      </div>
    </div>
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="password" id="password" class="password" name="password" pattern="${PASSWORD_PATTERN}" placeholder="" aria-label="${placeholders.password || 'Password'}" required autocomplete="new-password"/>
        <label for="password">${placeholders.setPassword || 'Set Password *'} </label>
        <span class="unmask-password" aria-controls="password"></span>
      </div>
    </div>
    ${validationRulesContent ? validationRulesContent.outerHTML : ''}
   <div class="input-field-wrapper deals-check">
      <div class="input-wrapper">
        <input type="checkbox" id="newsletter" class="newsletter" name="newsletter" checked/>
        <label for="newsletter">${placeholders.registerEmailOffers || 'I would like to receive exclusive deals and offers'}</label>
      </div>
    </div>
    <div class="submit-container">
      <button type="submit" class="createNewAccountButton"><span>${placeholders.continue || 'Create a new account'}</span></button>
    </div>
    <div class="error-container"></div>
    <div class="success-container"></div>
  `;
  customSelectbox(form);
  const siteKey = await getConfigValue('recaptchaV3-sitekey');
  addRecaptchaScript(siteKey);
  form.setAttribute('novalidate', '');
  form.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
  });
  const fullNameVal = form.querySelector('#fullname');
  const passwordVal = form.querySelector('#password');
  const checkValidation = () => {
    if (fullNameVal.value.length > 0 && passwordVal.value.length > 0
      && validateInput(passwordVal) && validateInput(fullNameVal)) {
      form.querySelector('button').disabled = false;
    } else {
      form.querySelector('button').disabled = true;
    }
  };
  form.querySelector('button').disabled = true;

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.id !== 'newsletter') {
        validateInput(input);
        if (input.id === 'password') {
          if (validationContainer) {
            validationContainer.classList.toggle('hide', input.value === '');
          }
        }
        checkValidation();
      }
    });
  });
  block.innerHTML = '';
  const commerceSignupContainer = document.createElement('div');
  commerceSignupContainer.classList.add('commerce-signup-container');
  commerceSignupContainer.appendChild(form);
  decorateIcons(commerceSignupContainer);
  block.appendChild(commerceSignupContainer);
  document.querySelector('.unmask-password').addEventListener('click', togglePasswordVisibility);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = document.querySelector('.submit-container button.createNewAccountButton');
    submitButton?.classList.add('loader');
    if (!validateForm(form)) {
      const errorFieldsList = await getErrorfields(form);
      datalayerLogin('Registration Attempt', `Email : invalid - ${errorFieldsList}`);
      return;
    }
    const bypassRecaptcha = await getConfigValue('recaptcha-bypass');
    if (bypassRecaptcha === 'true') {
      signup(form, placeholders, lang);
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
        signup(form, placeholders, lang);
      } else {
        submitButton?.classList.remove('loader');
        showPageErrorMessage(placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.');
      }
    });
  });
  const userEmail = new URLSearchParams(window.location.search).get('email');
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.delete('email');
  const changeEmailElement = document.querySelector('.change-email');
  const emailInput = document.getElementById('username');
  const emailAddSpan = document.querySelector('.email-add');
  emailAddSpan.textContent = userEmail;
  emailInput.value = userEmail;
  changeEmailElement.innerHTML = '';
  const changeLink = document.createElement('a');
  changeLink.href = `/${lang}/user/login?email=${userEmail}`;
  changeLink.textContent = placeholders.change || 'Change';
  changeLink.classList.add('change-link');
  changeEmailElement.appendChild(changeLink);
  changeLink.addEventListener('click', (event) => {
    event.preventDefault();
    window.location.href = changeLink.href;
  });
  const termsAndConditionLink = document.querySelector('.terms-condition');
  if (termsAndConditionLink) {
    const aLink = termsAndConditionLink.querySelector('a');
    aLink?.setAttribute('target', '_blank');
  }
  /* Backbutton handling */
  const headerElement = document.querySelector('main .section:first-child .default-content-wrapper');
  const title = document.querySelector('main div.section:first-child h2, main div.section:first-child h3, main div.section:first-child h4, main div.section:first-child h5');
  if (title) {
    const titleClone = title.cloneNode(true);
    const titleLink = document.createElement('a');
    titleLink.href = `/${lang}/user/login?email=${userEmail}`;
    titleLink.appendChild(titleClone);
    titleLink.classList.add('section-title');
    headerElement.innerHTML = '';
    headerElement.prepend(titleLink);
  }
  const validationRulesText = document.querySelector('.validation-container');
  const passwordInput = document.querySelector('#password');
  function toggleValidationRules(show) {
    if (validationRulesText) {
      validationRulesText.classList.toggle('hide', !show); // Simplified
      validationRulesText.classList.remove('hide'); // Ensure the rules are always visible
    }
  }
  function validatePassword(password) {
    const lengthValid = password.length >= 8;
    const specialValid = /[!@#$%^&*\(\),.?:\{\}\|<>]/.test(password);
    const numericValid = /\d/.test(password);
    const spaceValid = !/\s/.test(password);
    // Update the UI based on validation
    document.querySelector('.length-check').classList.toggle('valid', lengthValid);
    document.querySelector('.length-check').classList.toggle('invalid', !lengthValid);
    document.querySelector('.special-check').classList.toggle('valid', specialValid);
    document.querySelector('.special-check').classList.toggle('invalid', !specialValid);
    document.querySelector('.numeric-check').classList.toggle('valid', numericValid);
    document.querySelector('.numeric-check').classList.toggle('invalid', !numericValid);
    document.querySelector('.space-check').classList.toggle('valid', spaceValid);
    document.querySelector('.space-check').classList.toggle('invalid', !spaceValid);
    const allValid = lengthValid && specialValid && numericValid && spaceValid;
    if (password.length === 0) {
      document.querySelector('.space-check').classList.add('invalid');
      document.querySelector('.space-check').classList.remove('valid');
    }
    // eslint-disable-next-line no-use-before-define
    toggleValidationRules(!allValid);
    toggleValidationRules(true);
  }
  // Show/hide validation rules based on input
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    // Validate the password and update the UI
    validatePassword(password);
  });
  const signupContainer = document.createElement('div');
  signupContainer.classList.add('signup-container');
  signupContainer.appendChild(form);
  block.appendChild(signupContainer);
}
