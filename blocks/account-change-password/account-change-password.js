import { decorateIcons } from '../../scripts/aem.js';
import { CHANGE_PASSWORD_SOURCE } from '../commerce-login/commerce-login.js';
import {
  showPageErrorMessage, showErrorMessage, togglePasswordVisibility, setErrorMessageForField,
  validateForm,
  validateInput,
  PASSWORD_PATTERN,
} from '../../scripts/forms.js';
import { fetchPlaceholdersForLocale, logout } from '../../scripts/scripts.js';
import { changePassword } from '../../scripts/customer/api.js';
import { getConfigValue } from '../../scripts/configs.js';

export default async function decorate(block) {
  const lang = document.documentElement.lang || 'en';
  const placeholders = await fetchPlaceholdersForLocale();
  const myaccountChangePassword = await getConfigValue('myaccount-change-password-wizard');
  const validationRulesContent = block.querySelector('ul');

  const form = document.createElement('form');
  form.innerHTML = `
  <div class="input-field-wrapper">
    <div class="input-wrapper input-field">
      <input type="password" id="current-password" name="current-password" placeholder=" " aria-label="${placeholders.currentPassword || 'Current password'}" required minlength="7" autocomplete="password">
      <label for="current-password">${placeholders.currentPassword || 'Current password'}</label>
      <span class="unmask-password" aria-controls="current-password"></span>
    </div>
  </div>
  <div class="input-field-wrapper">
    <div class="input-wrapper input-field">
      <input type="password" id="new-password" name="new-password" required minlength="7" pattern="${PASSWORD_PATTERN}" placeholder=" " aria-label="${placeholders.newPassword || 'New password'}" autocomplete="new-password">
      <label for="new-password">${placeholders.newPassword || 'New password'}</label>
      <span class="unmask-password" aria-controls="new-password"></span>
    </div>    
  </div>
  `;
  form.setAttribute('novalidate', '');

  if (validationRulesContent) {
    validationRulesContent.classList.add('validation-container', 'hide');
    form.appendChild(validationRulesContent);
  }

  const button = document.createElement('button');
  button.type = 'submit';
  button.innerHTML = `
    <span>${placeholders.changePasswordButton || 'Save'}</span>`;
  if (myaccountChangePassword) {
    button.classList.add('secondary');
  }
  form.appendChild(button);

  // Function to toggle visibility of validation rules
  function toggleValidationRules(shouldShow) {
    const validationContainer = document.querySelector('.validation-container');
    if (shouldShow) {
      validationContainer.classList.remove('hide');
    } else {
      validationContainer.classList.add('hide');
    }
  }

  // Function to validate password policy criteria
  function validatePasswordPolicy(password) {
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
        text: placeholders.previousPassword || 'Previous four passwords are not allowed.',
        id: 'previous-password-check',
      },
    ];

    const validationContainer = document.querySelector('.validation-container');
    validationContainer.innerHTML = '';

    validationRules.forEach((rule) => {
      // Check if the rule has a validation condition
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
    // Only check validity for rules that have validation logic
    const allValid = validationRules
      .filter((rule) => rule.valid !== undefined)
      .every((rule) => rule.valid);
    toggleValidationRules(!allValid);
  }

  form.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
  });

  const unmaskPasswordEls = form.querySelectorAll('.unmask-password');
  unmaskPasswordEls.forEach((el) => {
    el.addEventListener('click', togglePasswordVisibility);
  });

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      validateInput(input);

      if (input.id === 'new-password') {
        const validationContainer = form.querySelector('.validation-container');
        if (input.value !== '') {
          validationContainer.classList.remove('hide');
        } else {
          validationContainer.classList.add('hide');
        }
        if (myaccountChangePassword) {
          validatePasswordPolicy(input.value);
        }
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(form)) {
      return;
    }
    const eventButton = form.querySelector('button');
    if (eventButton.classList.contains('loader')) {
      return;
    }

    eventButton.classList.add('loader');
    const currentPassword = form.querySelector('#current-password');
    const newPassword = form.querySelector('#new-password');

    if (!validateForm(form)) {
      return;
    }

    changePassword(currentPassword.value, newPassword.value).then((responseData) => {
      eventButton.classList.remove('loader');

      // TODO: eval email against user email in storage
      if (responseData.data?.commerce_changeCustomerPassword?.email) {
        if (myaccountChangePassword) {
          const loginWelcomeWizardToastMessage = placeholders['login-message-change-password'] || 'Password Changed successfully!';
          sessionStorage.setItem('loginWelcomeWizardToastMessage', loginWelcomeWizardToastMessage);
        }
        const url = new URL(`/${lang}/user/login`, window.location.origin);
        logout(url, CHANGE_PASSWORD_SOURCE);
        return;
      }
      if (responseData.errors) {
        const errorList = [];
        responseData.errors.forEach((error) => {
          errorList.push(error.message);
        });
        showErrorMessage(newPassword, errorList[0]);
        form.reset();
        return;
      }
      showPageErrorMessage(placeholders.passwordChangeFailed || 'Password change failed.');
    });
  });
  const changePasswordContainer = document.createElement('div');
  changePasswordContainer.classList.add('change-password-container');
  changePasswordContainer.appendChild(form);
  decorateIcons(changePasswordContainer);
  block.appendChild(changePasswordContainer);
}
