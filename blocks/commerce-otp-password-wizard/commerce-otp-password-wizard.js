import { fetchPlaceholdersForLocale, isLoggedInUser } from '../../scripts/scripts.js';
import {
  setErrorMessageForField, validateForm, validateInput,
} from '../../scripts/forms.js';
import { decorateIcons } from '../../scripts/aem.js';

export default async function decorate(block) {
  const lang = document.documentElement.lang || 'en';
  if (isLoggedInUser()) {
    window.location.href = `/${lang}/user/account`;
    return;
  }

  const placeholders = await fetchPlaceholdersForLocale();
  // const sourcePage = FORGOT_PASSWORD_SOURCE;
  const form = document.createElement('form');
  form.innerHTML = `
  <div class="input-field-wrapper otp-input-field-wrapper">
    <div class="input-wrapper input-field otp-input-wrapper">
      <input type="text" class="otp-input" maxlength="1" placeholder="-" inputmode="numeric" autocomplete="one-time-code"/>
      <input type="text" class="otp-input" maxlength="1" placeholder="-" inputmode="numeric" autocomplete="one-time-code"/>
      <input type="text" class="otp-input" maxlength="1" placeholder="-" inputmode="numeric" autocomplete="one-time-code"/>
      <input type="text" class="otp-input" maxlength="1" placeholder="-" inputmode="numeric" autocomplete="one-time-code"/>
      <input type="text" class="otp-input" maxlength="1" placeholder="-" inputmode="numeric" autocomplete="one-time-code"/>
      <input type="text" class="otp-input" maxlength="1" placeholder="-" inputmode="numeric" autocomplete="one-time-code"/>
    </div>
  </div>
  <button type="submit"><span>${placeholders.verify || 'verify'}</span></button>

  <a class="resend-otp-timer" href="#" disabled>${placeholders.otptimer || 'Resend in 00:59s'}</a>`;

  const togglePasswordContainers = () => {
    const forgotPasswordContainer = document.querySelector('.commerce-forgot-password-container');
    const otpWizardContainer = document.querySelector('.commerce-otp-password-wizard-container');
    const newPasswordContainer = document.querySelector('.commerce-new-password-container');
    if (forgotPasswordContainer && otpWizardContainer && newPasswordContainer) {
      const isOtpVisible = otpWizardContainer.classList.contains('visible');
      otpWizardContainer.classList.toggle('visible', !isOtpVisible);
      otpWizardContainer.classList.toggle('hidden', isOtpVisible);
      newPasswordContainer.classList.toggle('visible', isOtpVisible);
      newPasswordContainer.classList.toggle('hidden', !isOtpVisible);
    }
  };

  let timerInterval; // Declare the timerInterval variable outside the function
  function startResendOtpTimer() {
    const timerElement = document.querySelector('.resend-otp-timer');
    let timeRemaining = 59; // Start at 59 seconds
    // Clear any existing interval to avoid multiple timers
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    timerInterval = setInterval(() => {
      if (timeRemaining > 0) {
        timeRemaining -= 1;
        const seconds = timeRemaining < 10 ? `0${timeRemaining}` : timeRemaining;
        timerElement.textContent = `Resend in 00:${seconds}s`;
      } else {
        clearInterval(timerInterval);
        timerElement.textContent = `${placeholders.resendotp || 'Resend OTP'}`;
        timerElement.removeAttribute('disabled');
        timerElement.classList.add('otpactiveline');
        timerElement.href = '#'; // Enable the link
      }
    }, 1000); // Update every 1 second
  }

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
      changeLink.textContent = `${placeholders.change || 'Change'}`;
      changeLink.addEventListener('click', () => {
        const forgotPasswordContainer2 = document.querySelector('.commerce-forgot-password-container');
        const otpWizardContainer2 = document.querySelector('.commerce-otp-password-wizard-container');
        if (forgotPasswordContainer2 && otpWizardContainer2) {
          forgotPasswordContainer2.classList.add('visible');
          forgotPasswordContainer2.classList.remove('hidden');
          otpWizardContainer2.classList.add('hidden');
          otpWizardContainer2.classList.remove('visible');
        }
      });
      changeSpan.appendChild(changeLink);
    }
    if (!emailInfoContainer.contains(changeSpan)) {
      emailInfoContainer.appendChild(changeSpan);
    }
  };
  const transferEmailInfo = () => {
    const emailInfoContainer = document.querySelector('.commerce-otp-password-wizard-container .email-info-container');
    const defaultContentWrapper = document.querySelector('.commerce-new-password-container .default-content-wrapper');
    if (emailInfoContainer && defaultContentWrapper) {
      const existingEmailInfo = defaultContentWrapper.querySelector('.email-info-container');
      if (!existingEmailInfo) {
        const clonedEmailInfo = emailInfoContainer.cloneNode(true);
        defaultContentWrapper.appendChild(clonedEmailInfo);
      }
    }
  };
  const observeOtpContainerVisibility = () => {
    const otpWizardContainer = document.querySelector('.commerce-otp-password-wizard-container');
    const observer = new MutationObserver(() => {
      if (otpWizardContainer.classList.contains('visible')) {
        startResendOtpTimer(); // Call the timer function when the OTP container becomes visible
      }
    });
    observer.observe(otpWizardContainer, { attributes: true, attributeFilter: ['class'] });
  };

  // Call this function to set up the observer
  observeOtpContainerVisibility();

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
    // Simulate success response
    const responseData = {
      success: true, // Simulated success
      errors: [], // No errors
    };

    if (responseData?.success) {
      togglePasswordContainers();
      updateOtpContainerWithEmail();
      transferEmailInfo();
    }
    if (responseData.errors) {
      /* will enable this block once we get API's
        const errorList = [];
        responseData.errors.forEach((error) => {
         errorList.push(error.message);
         });
        showPageErrorMessage(errorList[0]); */
    }
    form.querySelector('button').classList.remove('loader');
  });
  const forgotPasswordContainer = document.createElement('div');
  forgotPasswordContainer.classList.add('password-container');
  forgotPasswordContainer.appendChild(form);
  decorateIcons(forgotPasswordContainer);
  block.appendChild(forgotPasswordContainer);

  document.querySelectorAll('.otp-input').forEach((input) => {
    input.addEventListener('keypress', (e) => {
      if (e.key < '0' || e.key > '9') {
        e.preventDefault();
      }
    });
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/, '');
    });
  });

  const toggleVisibility = () => {
    const forgotPasswordContainer2 = document.querySelector('.commerce-forgot-password-container');
    const otpWizardContainer = document.querySelector('.commerce-otp-password-wizard-container');
    if (forgotPasswordContainer2 && otpWizardContainer) {
      const isForgotPasswordVisible = forgotPasswordContainer2.classList.contains('visible');
      forgotPasswordContainer2.classList.toggle('visible', !isForgotPasswordVisible);
      forgotPasswordContainer2.classList.toggle('hidden', isForgotPasswordVisible);
      otpWizardContainer.classList.toggle('visible', isForgotPasswordVisible);
      otpWizardContainer.classList.toggle('hidden', !isForgotPasswordVisible);
    }
  };
  // Add event listener to the h5 element
  const headerElement = document.querySelector('.commerce-otp-password-wizard-container .default-content-wrapper h5');
  if (headerElement) {
    headerElement.addEventListener('click', toggleVisibility);
  }

  // Move to the next input field if it exists
  const otpInputs = document.querySelectorAll('.commerce-otp-password-wizard-container .otp-input');
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (event) => {
      if (event.target.value.length === 1) {
        // Move to the next input field if it exists
        const nextInput = otpInputs[index + 1];
        if (nextInput) {
          nextInput.focus();
        }
      }
    });
  });
}
