import { fetchPlaceholdersForLocale, isLoggedInUser } from '../../scripts/scripts.js';
import { FORGOT_PASSWORD_SOURCE } from '../commerce-login/commerce-login.js';
import {
  setErrorMessageForField, validateForm, validateInput, showPageErrorMessage,
} from '../../scripts/forms.js';
import { forgotPassword } from '../../scripts/customer/api.js';
import { decorateIcons } from '../../scripts/aem.js';
import { datalayerLogin } from '../../scripts/analytics/google-data-layer.js';
import { getConfigValue } from '../../scripts/configs.js';

const commerceForgotPasswordWizard = await getConfigValue('commerce-forgot-password-wizard');

export default async function decorate(block) {
  if (commerceForgotPasswordWizard === 'true') {
    const toggleVisibility = () => {
      const forgotPasswordContainer = document.querySelector('.commerce-forgot-password-container');
      const otpWizardContainer = document.querySelector('.commerce-otp-password-wizard-container');
      if (forgotPasswordContainer && otpWizardContainer) {
        forgotPasswordContainer.classList.add('hidden');
        forgotPasswordContainer.classList.remove('visible');
        otpWizardContainer.classList.add('visible');
        otpWizardContainer.classList.remove('hidden');
      }
    };
    const updateOtpContainerWithEmail = () => {
      const emailInput = document.querySelector('.commerce-forgot-password .input-wrapper input[type="email"]');
      const emailValue = emailInput?.value || '';
      const otpWizardContainer = document.querySelector('.commerce-otp-password-wizard-container .default-content-wrapper');
      if (!otpWizardContainer) return;
      let emailInfoContainer = otpWizardContainer.querySelector('.email-info-container');
      if (!emailInfoContainer) {
        emailInfoContainer = document.createElement('div');
        emailInfoContainer.classList.add('email-info-container');
        otpWizardContainer.appendChild(emailInfoContainer);
      }
      const emailSpan = emailInfoContainer.querySelector('.entered-email-address') || document.createElement('span');
      emailSpan.classList.add('entered-email-address', 'semibold');
      emailSpan.textContent = emailValue;
      if (!emailInfoContainer.contains(emailSpan)) {
        emailInfoContainer.appendChild(emailSpan);
      }
      const changeSpan = emailInfoContainer.querySelector('.change-link') || document.createElement('span');
      changeSpan.classList.add('change-link');
      if (!changeSpan.querySelector('a')) {
        const changeLink = document.createElement('a');
        changeLink.textContent = 'Change';
        changeLink.addEventListener('click', () => {
          const forgotPasswordContainer = document.querySelector('.commerce-forgot-password-container');
          const otpWizardContainer2 = document.querySelector('.commerce-otp-password-wizard-container');
          if (forgotPasswordContainer && otpWizardContainer2) {
            forgotPasswordContainer.classList.remove('hidden');
            forgotPasswordContainer.classList.add('visible');
            otpWizardContainer2.classList.remove('visible');
            otpWizardContainer2.classList.add('hidden');
          }
        });

        changeSpan.appendChild(changeLink);
      }
      if (!emailInfoContainer.contains(changeSpan)) {
        emailInfoContainer.appendChild(changeSpan);
      }
    };
    const resetOtpFields = () => {
      const otpInputs = document.querySelectorAll('.otp-input-field-wrapper .otp-input');
      otpInputs.forEach((input) => {
        input.value = ''; // Clear the input field value
      });
    };

    const lang = document.documentElement.lang || 'en';
    if (isLoggedInUser()) {
      window.location.href = `/${lang}/user/account`;
      return;
    }
    const placeholders = await fetchPlaceholdersForLocale();
    // const sourcePage = FORGOT_PASSWORD_SOURCE;
    const form = document.createElement('form');
    form.innerHTML = `
    <div class="input-field-wrapper">
      <div class="input-wrapper input-field">
      <input type="email" id="email" name="email" placeholder="" aria-label="${placeholders.email || 'Email'}" required autocomplete="email">
        <label for="email">${placeholders.emailaddress1 || 'Email address'}</label>
      </div>
    </div>
   <button type="submit"><span>${placeholders.continue || 'Continue'}</span></button>
  `;

    form.noValidate = true;

    form.querySelectorAll('input').forEach((input) => {
      setErrorMessageForField(input, placeholders);
      input.addEventListener('input', () => {
        validateInput(input);
        // Disable the submit button if the email is invalid
        const submitButton = form.querySelector('button');
        if (input.id === 'email') {
          if (!input.validity.valid) {
            submitButton.setAttribute('disabled', 'true');
          } else {
            submitButton.removeAttribute('disabled');
          }
        }
      });
    });

    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        validateInput(input);
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateForm(form)) {
        return;
      }
      form.querySelector('button').classList.add('loader');
      const responseData = {
        success: true, // Simulated success
        errors: [], // No errors
      };
      if (responseData?.success) {
        toggleVisibility();
        updateOtpContainerWithEmail();
        resetOtpFields();
      }
      form.querySelector('button').classList.remove('loader');
    });
    const forgotPasswordContainer = document.createElement('div');
    forgotPasswordContainer.classList.add('password-container');
    forgotPasswordContainer.appendChild(form);
    decorateIcons(forgotPasswordContainer);
    block.appendChild(forgotPasswordContainer);
  } else {
    const lang = document.documentElement.lang || 'en';
    if (isLoggedInUser()) {
      window.location.href = `/${lang}/user/account`;
      return;
    }
    const placeholders = await fetchPlaceholdersForLocale();
    const sourcePage = FORGOT_PASSWORD_SOURCE;
    const form = document.createElement('form');
    form.innerHTML = `
      <div class="input-field-wrapper">
        <div class="input-wrapper input-field">
        <input type="email" id="email" name="email" placeholder="" aria-label="${placeholders.email || 'Email'}" required autocomplete="email" value="${sessionStorage.getItem('loginEmail') || ''}" >
          <label for="email">${placeholders.email || 'Email'}</label>
        </div>
      </div>
     <button type="submit"><span>${placeholders.submit || 'Submit'}</span></button>
    `;
    form.noValidate = true;
    form.querySelectorAll('input').forEach((input) => {
      setErrorMessageForField(input, placeholders);
    });

    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        validateInput(input);
      });
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateForm(form)) {
        return;
      }
      form.querySelector('button').classList.add('loader');
      const email = form.querySelector('#email').value;

      const responseData = await forgotPassword(email);

      if (responseData?.success) {
        const url = new URL(`/${lang}/user/login`, window.location.origin);
        url.searchParams.append('source', `${sourcePage}`);
        datalayerLogin('Forget Password - Submit', 'Email');
        window.location.href = url.toString();
        return;
      }
      if (responseData.errors) {
        const errorList = [];
        responseData.errors.forEach((error) => {
          errorList.push(error.message);
        });
        showPageErrorMessage(errorList[0]);
      }
      form.querySelector('button').classList.remove('loader');
    });
    const forgotPasswordContainer = document.createElement('div');
    forgotPasswordContainer.classList.add('password-container');
    forgotPasswordContainer.appendChild(form);
    decorateIcons(forgotPasswordContainer);
    block.appendChild(forgotPasswordContainer);
  }
  const toggleVisibilityToWelcomeBackScreen = () => {
    document.querySelector('.commerce-login-wizard-container').classList.add('hidden');
    document.querySelector('.or-label').classList.add('hidden');
    document.querySelector('.social-login-container').classList.add('hidden');
    document.querySelector('.terms-condition').classList.add('hidden');
    const guestLoginContainer = document.querySelector('.commerce-guest-checkout-wizard-container');
    if (guestLoginContainer) {
      guestLoginContainer.classList.add('hidden');
    }
    document.querySelector('.commerce-login-welcome-wizard-container').classList.remove('hidden');
    document.querySelector('.commerce-login-welcome-wizard .input-wrapper').classList.remove('hidden');
  };
  document.querySelector('.commerce-forgot-password-container #reset-password')?.addEventListener('click', () => {
    window.location.href = '/en/user/login';
    toggleVisibilityToWelcomeBackScreen();
  });
}
