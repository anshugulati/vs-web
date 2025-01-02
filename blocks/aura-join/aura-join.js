import {
  loadFragment, createModalFromContent, openModal, fetchPlaceholdersForLocale,
  closeModal,
  isLoggedInUser,
} from '../../scripts/scripts.js';
import {
  PHONE_PATTERN,
  FULLNAME_PATTERN,
  EMAIL_PATTERN,
  showErrorMessage,
  validateForm,
} from '../../scripts/forms.js';
import { decorateIcons } from '../../scripts/aem.js';
import {
  loginMobile, searchEmail, searchPhone, userRegister, verifyOtpApiCall, getAuraCustomerData,
} from '../../scripts/aura/api.js';
import { getConfigValue } from '../../scripts/configs.js';
import { createLinkAura } from '../link-your-aura/link-your-aura.js';
import {
  getMaxLengthByCountryCode,
  getCountryIso,
} from '../../scripts/helpers/country-list.js';
import {
  addFormValidation,
  nextStage,
  prevStage,
  resetOtp,
  phonenumberValidation,
  submitOnEnter,
  auraModalRedirection,
} from '../../scripts/aura-utils/aura-utils.js';

const placeholders = await fetchPlaceholdersForLocale();
let isSubmitting = false;

export default async function decorate(block) {
  const containerClasses = ['aura-title', 'aura-mobile-number', 'aura-otp', 'aura-user-details'];

  Array.from(block.children).forEach((child, index) => {
    child.classList.add(containerClasses[index]);
  });

  let loginFlowText = placeholders.auraLoginButton || 'Login';

  const countrycode = await getConfigValue('country-code');
  const countryPrefix = `+${await getCountryIso(countrycode)}`;
  const maxLength = await getMaxLengthByCountryCode(countrycode);

  if (isLoggedInUser()) {
    loginFlowText = placeholders.linkYourAura || 'Link your Aura';
  }

  const otpLength = 6;

  const mobileForm = document.createElement('div');
  mobileForm.innerHTML = ` <form class="aura-contact-form" novalidate="">
      <div>
      <div class="input-field-wrapper">
          <div class="input-wrapper">
          <label for="login-mobile">${countryPrefix}</label>
          <input type="tel" id="login-mobile" name="login-mobile" aria-label="mobile number" placeholder="${placeholders.mobileNumberInputText || 'Mobile Number'}" required pattern="[0-9]*" maxlength="${maxLength}" minlength="${maxLength}" >
          </div>
        </div>
        <div class="aura-buttons">
        <button class="secondary-btn" type="submit" data-dismiss="modal"><span>${placeholders.sendOtp || 'Send OTP'}</span></button>
        <p>${placeholders.alreadyHaveAccount || 'Already have account?'} <a>${loginFlowText}</a></p>
        </div>
      </div>
      </form>`;

  mobileForm.classList.add('aura-contact-container');
  block.querySelector('.aura-mobile-number').append(mobileForm);

  const otpForm = document.createElement('div');
  otpForm.innerHTML = `<form class="aura-otp-form">
        <div class="input-field-wrapper">
          <div class="input-wrapper">
             <input type="number" id="otp-input" name="otp-input" 
             placeholder="${placeholders.otpPlaceholder || 'One time pin'}" required maxlength="${placeholders.otpLength || otpLength}" oninput="this.value = this.value.slice(0, ${placeholders.otpLength || otpLength});" onkeydown="return event.key !== 'e' && event.key !== 'E';" autocomplete="one-time-code">
          </div>
        </div>
        <div class="otp-success-message">
        </div>
        <div class="aura-buttons">
        <button class="secondary-btn" type="submit"><span>${placeholders.verifyOtp || 'Verify'}</span></button>
        </div>
        </form>`;

  const auraOtpContainer = block.querySelector('.aura-otp');
  otpForm.classList.add('aura-otp-container');
  auraOtpContainer.append(otpForm);

  const otpInfoDiv = document.createElement('div');
  otpInfoDiv.classList.add('otp-info-text');
  otpInfoDiv.innerHTML = `<div>
                  <p>${placeholders.otpInfoText || "Didn't receive your one time pin?"} <a>${placeholders.resendOtp || 'Resend'}</a></p>
                  </div>`;

  auraOtpContainer.appendChild(otpInfoDiv);

  const termsAndConditionText = block.querySelector('.aura-user-details > div');
  const userDetailsForm = document.createElement('div');
  userDetailsForm.innerHTML = `<form class="user-details-form" novalidate="">
      <div>
          <div class="input-field-wrapper">
              <div class="input-wrapper mobile-disabled">
                  <label for="mobile-number">${countryPrefix}</label>
                  <input type="number" id="mobile-number" name="mobile-number" aria-label="${placeholders.mobileNumberInputText || 'Mobile Number'}" placeholder="" pattern="${PHONE_PATTERN}" required autocomplete="tel" disabled>
              </div>
          </div>
          <div class="input-field-wrapper">
              <div class="input-wrapper">
                  <input type="text" id="fullname" class="fullname" name="fullname" pattern="${FULLNAME_PATTERN}" placeholder="${placeholders.fullName || 'Full Name'}" aria-label="${placeholders.fullName || 'Full Name'}" required autocomplete="fullname" />
              </div>
          </div>
          <div class="input-field-wrapper">
              <div class="input-wrapper">
                  <input type="email" id="email-address" name="email-address" aria-label="${placeholders.email || 'Email'}" placeholder="${placeholders.emailAddress || 'Email Address'}" pattern="${EMAIL_PATTERN}" required autocomplete="email" >
              </div>
          </div>
      </div>
      <div class="aura-buttons">
      <div class="aura-terms-condition">
      </div>
        <button class="secondary-btn" type="submit"><span>${placeholders.auraCompleteRegistration || 'Complete Registration'}</span></button>
      </div>
      </form>`;

  if (termsAndConditionText) {
    userDetailsForm.querySelector('.aura-terms-condition')?.append(termsAndConditionText);
  }

  const congratulationsFragment = await loadFragment(`/${document.documentElement.lang}/fragments/aura/congratulations-aura`);
  block.children[block.children.length - 1].replaceWith(congratulationsFragment.querySelector('.block'));
  block.querySelector('.aura-user-details')?.append(userDetailsForm);

  block.querySelector('.aura-mobile-number').classList.add('show');
}

export async function createJoinAura(reDecorate) {
  loadFragment(`/${document.documentElement.lang}/fragments/aura/join-aura`).then(async (fragment) => {
    const titleDiv = fragment.querySelector('.aura-title');
    const modalContent = fragment.querySelector('.aura-join');
    modalContent.firstElementChild.remove();
    await closeModal('join-aura-dialog');
    if (!document.getElementById('join-aura-dialog')) {
      await createModalFromContent('join-aura-dialog', titleDiv.textContent, modalContent.outerHTML, ['aura-modal', 'join-aura', 'aura'], 'arrow-left-black', false, 'icon-aura-close');

      const joinAura = document.querySelector('#join-aura-dialog');

      const arrowIcon = joinAura.querySelector('.join-aura .icon-title-left');
      arrowIcon.classList.add('icon-hide');

      const mobileForm = joinAura.querySelector('.aura-contact-form');
      const otpForm = joinAura.querySelector('.aura-otp-form');
      const userDetailsForm = joinAura.querySelector('.user-details-form');
      const congratsStage = joinAura.querySelector('.aura-congratulations');
      const congratsForm = congratsStage.querySelector('.aura-congratulations .aura-buttons');
      const linkAura = mobileForm.querySelector('a');

      const otpContainer = joinAura.querySelector('.aura-otp');
      const defaultOtpInfoText = otpContainer.querySelector('div').textContent;
      const defaultOtpResendText = otpContainer.querySelector('.aura-otp .otp-info-text p').innerHTML;

      const successMessageDiv = otpContainer.querySelector('.otp-success-message');
      successMessageDiv.innerHTML = `<p>${placeholders.resendOtpSendSuccessfully || 'Resend OTP Send Successfully'}</p>`;
      successMessageDiv.classList.add('hide-message');

      const countrycode = await getConfigValue('country-code');
      const countryPrefix = `${await getCountryIso(countrycode)}`;

      const forms = [userDetailsForm, otpForm, mobileForm];
      forms.forEach((element) => {
        addFormValidation(element);
        decorateIcons(element);
      });

      phonenumberValidation(mobileForm);

      mobileForm.addEventListener('submit', async (event) => {
        event.stopPropagation();
        event.preventDefault();

        if (isSubmitting) {
          return;
        }

        isSubmitting = true;

        try {
          const mobile = mobileForm.querySelector('#login-mobile').value;
          if (mobile === '') {
            isSubmitting = false;
            const inputFieldWrapper = mobileForm.querySelector('.input-field-wrapper');
            const errorMessage = placeholders.noMobileMessage || `Please enter +${countryPrefix} Mobile Number`;
            showErrorMessage(inputFieldWrapper, errorMessage);
            return;
          }

          const apcIdentifierNumber = await searchPhone(mobile, countryPrefix);

          if (apcIdentifierNumber == null) {
            const status = await loginMobile(mobile, countryPrefix);

            if (status === true) {
              userDetailsForm.querySelector('#mobile-number').value = mobile;
              resetOtp(otpContainer, defaultOtpResendText, mobileForm);
              otpContainer.querySelector('.aura-otp > div').innerHTML = `${defaultOtpInfoText} <span class="mob-number">+${countryPrefix}${mobile}</span>`;
              nextStage(joinAura);
              arrowIcon.classList.remove('icon-hide');
              joinAura.querySelector('.otp-info-text .disabled')?.classList.remove('disabled');
              otpContainer.querySelector('.error-message-container').classList.add('hide');
              otpContainer.querySelector('.error-message-container .error-message').textContent = '';
            } else {
              const inputFieldWrapper = mobileForm.querySelector('.input-field-wrapper');
              const errorMessage = status.parameters.length > 0 ? status?.parameters[0] : 'Maximum number of attempts reached. Please try after sometime.';
              showErrorMessage(inputFieldWrapper, errorMessage);
            }
          } else {
            const inputFieldWrapper = mobileForm.querySelector('.input-field-wrapper');
            const errorMessage = placeholders.mobileRegisteredErrorMessage || 'This phone number is already registered. Please sign-in or use a different phone number';
            showErrorMessage(inputFieldWrapper, errorMessage);
          }
        } catch (error) {
          console.error(error);
        } finally {
          isSubmitting = false;
        }
      });

      otpForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (isSubmitting) {
          return;
        }

        isSubmitting = true;

        try {
          const mobile = mobileForm.querySelector('#login-mobile').value;
          const otp = otpForm.querySelector('#otp-input').value;

          if (otp === '') {
            isSubmitting = false;
            const inputFieldWrapper = otpForm.querySelector('.input-field-wrapper');
            const errorMessage = placeholders.noOtpMessage || 'Please enter One time pin';
            showErrorMessage(inputFieldWrapper, errorMessage);
            return;
          }

          const status = await verifyOtpApiCall(mobile, countryPrefix, otp);

          if (status === true) {
            nextStage(joinAura);
            arrowIcon.classList.add('icon-hide');
          } else {
            const inputFieldWrapper = otpForm.querySelector('.input-field-wrapper');
            const errorMessage = placeholders.incorrectOtpErrorMessage || 'Incorrect OTP';
            showErrorMessage(inputFieldWrapper, errorMessage);
          }
        } catch (error) {
          console.error(error);
        } finally {
          isSubmitting = false;
        }
      });

      userDetailsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateForm(userDetailsForm) && isSubmitting) {
          return;
        }
        isSubmitting = true;

        try {
          const email = userDetailsForm.querySelector('#email-address').value;
          const mobileNumber = mobileForm.querySelector('#login-mobile').value;
          const apcIdentifierNumberMobile = await searchPhone(mobileNumber, countryPrefix);
          const apcIdentifierNumberEmail = await searchEmail(email);
          const mobile = `+${countryPrefix}${mobileNumber}`;
          const fullname = userDetailsForm.querySelector('#fullname').value;

          const nameParts = fullname.trim().split(' ');
          const firstname = nameParts.slice(0, -1).join(' ');
          const lastname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
          const isVerified = 'Y';

          if (apcIdentifierNumberMobile == null && apcIdentifierNumberEmail == null) {
            const status = await userRegister(firstname, lastname, email, mobile, isVerified);
            const response = await getAuraCustomerData();
            const apcLink = response?.apc_link;

            if (apcLink === '2' || apcLink === 2) {
              congratsStage.querySelector('.aura-quick-enrolled').remove();
              congratsStage.querySelector('.aura-social').remove();
            } else {
              congratsStage.querySelector('.aura-full-enrolled')?.remove();
            }

            if (status === true) {
              const congratulationsTitle = joinAura.querySelector('.congratulations-title');
              joinAura.querySelector('.modal-header > h4').textContent = congratulationsTitle.querySelector('*').textContent;
              joinAura.querySelector('.congratulations-title').remove();
              nextStage(joinAura);
            } else {
              const inputFieldWrapper = userDetailsForm.querySelector('.input-field-wrapper:last-child');
              const errorMessage = status || 'Something went wrong. Try again';
              showErrorMessage(inputFieldWrapper, errorMessage);
            }
          } else {
            const inputFieldWrapper = userDetailsForm.querySelector('.input-field-wrapper:last-child');
            const errorMessage = placeholders.emailRegisteredErrorMessage || 'This email is already registered. Please sign-in or use a different email';
            showErrorMessage(inputFieldWrapper, errorMessage);
          }
        } catch (error) {
          console.error(error);
        } finally {
          isSubmitting = false;
        }
      });

      auraModalRedirection(congratsForm, 'join-aura-dialog', 'join-aura-redirect', reDecorate);

      arrowIcon.addEventListener('click', async (event) => {
        event.preventDefault();
        prevStage(joinAura);
        arrowIcon.classList.add('icon-hide');
      });

      linkAura.addEventListener('click', async (event) => {
        event.preventDefault();
        closeModal('join-aura-dialog');
        createLinkAura(reDecorate);
      });

      submitOnEnter(forms);
    }

    openModal('join-aura-dialog');
  });
}
