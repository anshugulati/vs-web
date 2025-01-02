import { fetchPlaceholdersForLocale, isLoggedInUser } from '../../scripts/scripts.js';
import { NEW_PASSWORD_SOURCE } from '../commerce-login/commerce-login.js';
import {
  setErrorMessageForField, validateInput, validateInputSame, togglePasswordVisibility,
  validateForm, showPageErrorMessage, PASSWORD_PATTERN,
} from '../../scripts/forms.js';
import { decorateIcons } from '../../scripts/aem.js';
import { resetPassword } from '../../scripts/customer/api.js';
import { getConfigValue } from '../../scripts/configs.js';

const commerceNewPasswordWizard = await getConfigValue('commerce-new-password-wizard');
const commerceNewPasswordFallback = await getConfigValue('commerce-new-password-fallback');

function extractAndDeleteParamsFromURL(paramsToExtract) {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const extractedParams = {};

  paramsToExtract.forEach((param) => {
    extractedParams[param] = params.get(param);
    params.delete(param);
  });

  window.history.replaceState({}, '', url);
  return extractedParams;
}

export default async function decorate(block) {
  const lang = document.documentElement.lang || 'en';
  const placeholders = await fetchPlaceholdersForLocale();
  if (isLoggedInUser()) {
    window.location.href = `/${lang}/user/account`;
    return;
  }

  const validationRulesContent = block.querySelector('ul');
  const validationRuleParagraph = block.querySelector('p:first-of-type'); // BBW-specific

  // Function to toggle visibility of validation rules
  function toggleValidationRules(shouldShow) {
    const validationContainer = document.querySelector('.validation-container');
    if (shouldShow) {
      validationContainer.classList.remove('hide');
    } else {
      validationContainer.classList.add('hide');
    }
  }
  // Password Policy Function
  function validatePasswordPolicy(password, confirmPassword) {
    const validationRules = [
      {
        text: placeholders.lengthPassword || 'Should be 8 characters.',
        id: 'length-check',
        valid: password.length >= 8,
      },
      {
        text: placeholders.specialPassword || 'Must contain at least 1 special character.',
        id: 'special-check',
        valid: /[!@#$%^&*(),.?:{}|<>]/.test(password),
      },
      {
        text: placeholders.numPassword || 'Must contain at least 1 numeric character.',
        id: 'numeric-check',
        valid: /\d/.test(password),
      },
      {
        text: placeholders.spacePassword || 'Spaces are not allowed in your password.',
        id: 'space-check',
        valid: !/\s/.test(password),
      },
      {
        text: placeholders.passwordMatch || 'Passwords should match.',
        id: 'password-match-check',
        valid: password === confirmPassword,
      },
      {
        text: placeholders.previousPassword || 'Previous four passwords are not allowed.',
        id: 'previous-password-check',
      },
    ];

    const validationContainer = document.querySelector('.validation-container');
    validationContainer.innerHTML = '';

    validationRules.forEach((rule) => {
      if (rule.valid !== undefined) {
        const li = document.createElement('li');
        li.classList.add(rule.id);
        li.id = rule.id;
        li.textContent = rule.text;
        li.classList.toggle('valid', rule.valid);
        li.classList.toggle('invalid', !rule.valid);
        validationContainer.appendChild(li);
      } else {
        const p = document.createElement('p');
        p.classList.add(rule.id);
        p.id = rule.id;
        p.textContent = rule.text;
        validationContainer.appendChild(p);
      }
    });

    const allValid = validationRules
      .filter((rule) => rule.valid !== undefined)
      .every((rule) => rule.valid);

    toggleValidationRules(!allValid);
  }

  const { token, email } = extractAndDeleteParamsFromURL(['token', 'email']);
  const sourcePage = NEW_PASSWORD_SOURCE;
  const form = document.createElement('form');

  let validationContainerHTML = '';
  if (commerceNewPasswordFallback === 'true') {
    validationContainerHTML = '<ul class="validation-container"></ul>';
  }
  form.innerHTML = `
    <div class="input-field-wrapper">
      <div class="input-wrapper input-field">
        <input type="password" id="newPassword" name="newPassword" placeholder=" " aria-label="${placeholders.newPassword || 'New Password'}" required autocomplete="new-password">
        <label for="newPassword">${placeholders.newPassword || 'Enter New Password'}</label>
        <span class="unmask-password" aria-controls="newPassword"></span>
      </div>
    </div>
    <div class="input-field-wrapper">
      <div class="input-wrapper input-field">
        <input type="password" id="retypePassword" name="retypePassword" placeholder=" " aria-label="${placeholders.retypePassword || 'Retype Password'}" required autocomplete="new-password">
        <label for="retypePassword">${placeholders.retypePassword || 'Retype new Password'}</label>
        <span class="unmask-password" aria-controls="retypePassword"></span>
      </div>
    </div>
     ${validationContainerHTML} 
  `;

  if (commerceNewPasswordWizard === 'true') {
    form.innerHTML = `
      <div class="input-field-wrapper">
        <div class="input-wrapper input-field">
          <input type="password" id="newPassword" name="newPassword" placeholder=" " aria-label="${placeholders.newPassword || 'Enter New Password'}" required autocomplete="new-password">
          <label for="newPassword">${placeholders.newpassword1 || 'Enter new password'}</label>
          <span class="unmask-password" aria-controls="newPassword"></span>
        </div>
      </div>
      <div class="input-field-wrapper">
        <div class="input-wrapper input-field">
          <input type="password" id="retypePassword" name="retypePassword" placeholder=" " aria-label="${placeholders.retypePassword || 'Retype new Password'}" required autocomplete="new-password">
          <label for="retypePassword">${placeholders.retypenewpassword1 || 'Retype new password'}</label>
          <span class="unmask-password" aria-controls="retypePassword"></span>
        </div>
      </div>
    `;

    // Add validation rules and the paragraph for BBW
    if (validationRulesContent) {
      validationRulesContent.classList.add('validation-container', 'hide');
      form.appendChild(validationRulesContent);
      form.appendChild(validationRuleParagraph);
    }

    const button = document.createElement('button');
    button.type = 'submit';
    button.innerHTML = `<span>${placeholders.submit1 || 'RESET PASSWORD'}</span>`;
    form.appendChild(button);

    form.noValidate = true;

    form.querySelectorAll('input').forEach((input) => {
      input.setAttribute('pattern', PASSWORD_PATTERN);
      setErrorMessageForField(input, placeholders);
    });

    const unmaskPasswordEls = form.querySelectorAll('.unmask-password');
    unmaskPasswordEls.forEach((el) => {
      el.addEventListener('click', togglePasswordVisibility);
    });

    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        const newPassword = form.querySelector('#newPassword').value;
        const retypePassword = form.querySelector('#retypePassword').value;

        validateInput(input);

        const isValidLength = newPassword.length >= 8;
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
        const hasNumber = /\d/.test(newPassword);
        const hasSpaces = /\s/.test(newPassword);
        const passwordsMatch = newPassword === retypePassword;

        const validationItems = validationRulesContent.querySelectorAll('li');

        function updateValidationState(item, isValid) {
          if (isValid) {
            item.classList.add('valid');
            item.classList.remove('invalid');
          } else {
            item.classList.add('invalid');
            item.classList.remove('valid');
          }
        }

        validationItems.forEach((item) => {
          if (item.textContent.includes('8 characters')) {
            updateValidationState(item, isValidLength);
          } else if (item.textContent.includes('special character')) {
            updateValidationState(item, hasSpecialChar);
          } else if (item.textContent.includes('numeric character')) {
            updateValidationState(item, hasNumber);
          } else if (item.textContent.includes('Spaces are not allowed')) {
            updateValidationState(item, !hasSpaces);
          } else if (item.textContent.includes('Passwords should match')) {
            updateValidationState(item, passwordsMatch);
          }
        });

        if (newPassword !== '' || retypePassword !== '') {
          validationRulesContent.classList.remove('hide');
        } else {
          validationRulesContent.classList.add('hide');
        }

        if (input.id === 'retypePassword') {
          validateInputSame(input, form.querySelector('#newPassword'), `${placeholders.passwordsDoNotMatch || 'Passwords do not match'}`);
        }
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateForm(form) || !validateInputSame(form.querySelector('#retypePassword'), form.querySelector('#newPassword'), `${placeholders.passwordsDoNotMatch || 'Passwords do not match'}`)) {
        return;
      }
      form.querySelector('button').classList.add('loader');
      const newPassword = form.querySelector('#newPassword').value;

      if (email && token && newPassword) {
        const responseData = await resetPassword(email, token, newPassword);
        if (responseData?.data?.resetPassword) {
          const url = new URL(`/${lang}/user/login`, window.location.origin);
          url.searchParams.append('source', `${sourcePage}`);
          window.location.href = url.toString();
          return;
        }
        if (responseData.errors) {
          const errorMessage = placeholders.newPasswordError || 'Cannot set new password for the customer';
          showPageErrorMessage(errorMessage);
        }

        form.querySelector('button').classList.remove('loader');
      } else {
        showPageErrorMessage(placeholders.newPasswordSessionExpired || 'Session expired, generate new link');
      }
    });

    block.innerHTML = '';

    const newPasswordContainer = document.createElement('div');
    newPasswordContainer.classList.add('new-password-container');
    newPasswordContainer.appendChild(form);
    decorateIcons(newPasswordContainer);
    block.appendChild(newPasswordContainer);

    const togglePasswordContainers = () => {
      const resetPasswordContainer = document.querySelector('.commerce-new-password-container');
      const forgotPasswordContainer = document.querySelector('.commerce-forgot-password-container');
      if (resetPasswordContainer) {
        if (resetPasswordContainer.classList.contains('visible')) {
          resetPasswordContainer.classList.remove('visible');
          resetPasswordContainer.classList.add('hidden');
        }
      }
      if (forgotPasswordContainer) {
        if (forgotPasswordContainer.classList.contains('hidden')) {
          forgotPasswordContainer.classList.remove('hidden');
          forgotPasswordContainer.classList.add('visible');
        }
      }
    };
    document.querySelector('.commerce-new-password-container #reset-password-2').addEventListener('click', togglePasswordContainers);
  } else {
    if (validationRulesContent) {
      validationRulesContent.classList.add('validation-container', 'hide');
      form.appendChild(validationRulesContent);
    }
    const button = document.createElement('button');
    button.type = 'submit';
    button.innerHTML = `
      <span>${placeholders.submit || 'Submit'}</span>`;
    form.appendChild(button);
    form.noValidate = true;
    form.querySelectorAll('input').forEach((input) => {
      input.setAttribute('pattern', PASSWORD_PATTERN);
      setErrorMessageForField(input, placeholders);
    });
    const unmaskPasswordEls = form.querySelectorAll('.unmask-password');
    unmaskPasswordEls.forEach((el) => {
      el.addEventListener('click', togglePasswordVisibility);
    });
    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        validateInput(input);

        if (input.id === 'retypePassword') {
          const newPassword = form.querySelector('#newPassword');
          validateInputSame(input, newPassword, `${placeholders.passwordsDoNotMatch || 'Passwords do not match'}`);
        }
        const newPassword = form.querySelector('#newPassword').value;
        const retypePassword = form.querySelector('#retypePassword').value;
        const validationContainer = form.querySelector('.validation-container');
        if (commerceNewPasswordFallback === 'true') {
          validatePasswordPolicy(newPassword, retypePassword);
        }
        if (newPassword !== '' || retypePassword !== '') {
          validationContainer.classList.remove('hide');
        } else {
          validationContainer.classList.add('hide');
        }
      });
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateForm(form) || !validateInputSame(form.querySelector('#retypePassword'), form.querySelector('#newPassword'), `${placeholders.passwordsDoNotMatch || 'Passwords do not match'}`)) {
        return;
      }
      form.querySelector('button').classList.add('loader');
      const newPassword = form.querySelector('#newPassword').value;
      if (email && token && newPassword) {
        const responseData = await resetPassword(email, token, newPassword);
        if (responseData?.data?.resetPassword || responseData?.data?.commerce_resetPassword) {
          const url = new URL(`/${lang}/user/login`, window.location.origin);
          url.searchParams.append('source', `${sourcePage}`);
          window.location.href = url.toString();
          return;
        }
        if (responseData?.errors) {
          const errorMessage = responseData?.errors[0].message
          || placeholders.newPasswordError
          || 'Cannot set new password for the customer';
          showPageErrorMessage(errorMessage);
        }
        form.querySelector('button').classList.remove('loader');
      } else {
        showPageErrorMessage(placeholders.newPasswordSessionExpired || 'Session expired, generate new link');
      }
    });
    block.innerHTML = '';
    const newPasswordContainer = document.createElement('div');
    newPasswordContainer.classList.add('new-password-container');
    newPasswordContainer.appendChild(form);
    decorateIcons(newPasswordContainer);
    block.appendChild(newPasswordContainer);
  }
}
