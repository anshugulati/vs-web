import {
  validateInput, setErrorMessageForField, showErrorMessage, validatePhone,
} from '../forms.js';
import { getConfigValue } from '../configs.js';
import { getCountryIso } from '../helpers/country-list.js';
import { fetchPlaceholdersForLocale, closeModal } from '../scripts.js';
import { loginMobile } from '../aura/api.js';

const placeholders = await fetchPlaceholdersForLocale();
let timerInterval;

export function addFormValidation(form) {
  form.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
    const button = form.querySelector('button') || form.closest('.contact-method').querySelector('button');
    input.addEventListener('input', () => {
      if (!validateInput(input)) {
        button.disabled = true;
      } else {
        button.disabled = false;
      }
    });
  });
}

export function nextStage(joinAura) {
  const curr = joinAura.querySelector('.show');
  curr.nextElementSibling.classList.add('show');
  curr.classList.remove('show');
}

export function prevStage(joinAura) {
  const curr = joinAura.querySelector('.show');
  curr.previousElementSibling.classList.add('show');
  curr.classList.remove('show');
}

export async function addResendListener(otpContainer, mobileForm) {
  const resendLinkEvent = otpContainer.querySelector('.otp-info-text a');
  const mobile = mobileForm.querySelector('#login-mobile').value;
  const countrycode = await getConfigValue('country-code');
  const countryPrefix = `${await getCountryIso(countrycode)}`;
  resendLinkEvent.addEventListener('click', async (event) => {
    event.preventDefault();
    const response = await loginMobile(mobile, countryPrefix);
    if (response === true) {
      // eslint-disable-next-line no-use-before-define
      startResendOtpTimer(otpContainer, mobileForm);
    } else {
      const inputFieldWrapper = otpContainer.querySelector('.input-field-wrapper');
      otpContainer.querySelector('.otp-info-text a').classList.add('inactive');
      const errorMessage = response.parameters.length > 0 ? response?.parameters[0] : 'Maximum number of attempts reached. Please try after sometime.';
      showErrorMessage(inputFieldWrapper, errorMessage);
    }
  });
}

function startResendOtpTimer(otpContainer, mobileForm) {
  const successMessageDiv = otpContainer.querySelector('.otp-success-message');
  const resendLink = otpContainer.querySelector('.otp-info-text p');
  const originalText = resendLink.innerHTML;
  let timeRemaining = 60;
  resendLink.textContent = `${placeholders.resending}` || 'Resending';
  successMessageDiv.classList.remove('hide-message');
  setTimeout(() => {
    successMessageDiv.classList.add('hide-message');
  }, 5000);
  timerInterval = setInterval(() => {
    resendLink.classList.add('disabled');
    if (timeRemaining > 0) {
      timeRemaining -= 1;
      const seconds = timeRemaining < 10 ? `0${timeRemaining}` : timeRemaining;
      resendLink.textContent = `${placeholders.resendIn || 'Resend In'} 00:${seconds}s`;
    } else {
      clearInterval(timerInterval);
      resendLink.classList.remove('disabled');
      resendLink.innerHTML = originalText;
      addResendListener(otpContainer, mobileForm);
    }
  }, 1000);
}

export function resetOtp(otpContainer, defaultOtpResendText, mobileForm) {
  const resendText = otpContainer.querySelector('.otp-info-text p');
  const otpInput = otpContainer.querySelector('.aura-otp-form input');
  resendText.innerHTML = defaultOtpResendText;
  if (otpInput) {
    otpInput.value = '';
  }
  clearInterval(timerInterval);
  addResendListener(otpContainer, mobileForm);
}

export function phonenumberValidation(mobileForm) {
  const phoneInput = mobileForm.querySelector('#login-mobile');
  phoneInput.addEventListener('input', async (event) => {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
    const countryName = await getConfigValue('country-code');
    const mobile = phoneInput.value;
    if (mobile === '') {
      const inputFieldWrapper = mobileForm.querySelector('.input-field-wrapper');
      const errorMessage = placeholders.noMobileMessage || 'Please enter Mobile Number';
      showErrorMessage(inputFieldWrapper, errorMessage);
      return;
    }
    if (event.target.value.length >= phoneInput.maxLength) {
      const isValidPhoneNumber = await validatePhone(
        phoneInput.value,
        countryName,
      );
      let phoneErrorMessage = placeholders.invalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneErrorMessage = phoneErrorMessage.replace('{{mobile}}', phoneInput.value);

      if (!isValidPhoneNumber) {
        showErrorMessage(phoneInput, phoneErrorMessage);
        mobileForm.querySelector('.aura-buttons button').disabled = true;
      } else {
        mobileForm.querySelector('.aura-buttons button').disabled = false;
      }
    }
  });
}

export function submitOnEnter(forms) {
  forms.forEach((form) => {
    form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
  });
}

export function auraModalRedirection(congratsForm, dialogName, redirectName, reDecorate) {
  congratsForm.addEventListener('click', async (event) => {
    event.preventDefault();
    const lang = document.documentElement.lang || 'en';
    const redirectLink = await getConfigValue(redirectName);
    closeModal(dialogName);
    if (dialogName === 'link-your-aura-dialog') {
      window.dispatchEvent(new CustomEvent('linkAuraSuccess'));
    }

    if (reDecorate) {
      reDecorate();
    }

    if (redirectLink && redirectLink !== '') {
      window.location.href = `/${lang}${redirectLink}`;
    }
  });
}
