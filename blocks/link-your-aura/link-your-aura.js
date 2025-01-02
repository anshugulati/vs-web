import {
  loadFragment, createModalFromContent, openModal, fetchPlaceholdersForLocale,
  closeModal,
} from '../../scripts/scripts.js';
import {
  EMAIL_PATTERN,
  showErrorMessage,
  resetMessage,
} from '../../scripts/forms.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getCountryIso, getMaxLengthByCountryCode } from '../../scripts/helpers/country-list.js';
import { decorateIcons } from '../../scripts/aem.js';
import {
  getAuraCustomerData,
  loginAuraAcc, loginEmail, loginMobileLinkAura, sendOtpApiCall,
  verifyOtpLinkAura, getAuraGuestInfo,
} from '../../scripts/aura/api.js';
import { getCustomer } from '../../scripts/customer/api.js';
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
const countryCode = await getConfigValue('country-code');
const countryPrefix = `${await getCountryIso(countryCode)}`;

export default async function decorate(block) {
  const maxLength = await getMaxLengthByCountryCode(countryCode);
  const divClasses = ['aura-title', 'aura-mobile-number', 'aura-otp'];
  Array.from(block.children).forEach((child, index) => {
    child.classList.add(divClasses[index]);
  });

  const otpLength = 6;

  const auraForm = document.createElement('div');
  auraForm.innerHTML = `
  <form class="aura-contact-form" novalidate="">
    <div class="radio-button-container">
      <div class="radio-wrapper">
       <input type="radio" id="mobile-radio" name="contact-method" checked value="mobile"/>
       <label for="mobile-radio" class="custom-radio">${placeholders.mobileLabel || 'Mobile'}</label>
      </div>

      <div class="radio-wrapper">
       <input type="radio" id="email-radio" name="contact-method" value="email"/>
       <label for="email-radio" class="custom-radio">${placeholders.emailLabel || 'Email'}</label>
      </div>

      <div class="radio-wrapper">
       <input type="radio" id="auraAccount-radio" name="contact-method" value="auraAccount"/>
       <label for="auraAccount-radio" class="custom-radio">${placeholders.auraAccountLabel || 'Aura Account'}</label>
      </div>
    </div>

    <div class="contact-method">

      <div class="input-field-wrapper">
        <div class="input-wrapper mobile-field">
          <label for=""login-mobile">+${countryPrefix}</label>
          <input type="tel" id="login-mobile" name="mobile-number" aria-label="mobile-number" placeholder="${placeholders.mobileNumberInputText || 'Mobile Number'}" pattern="[0-9]*" required autocomplete="tel" maxlength="${maxLength}" minlength="${maxLength}">
        </div>
      </div>

      <div class="input-field-wrapper">
        <div class="input-wrapper email-field">
          <input type="email" id="email-address" name="email-address" aria-label="${placeholders.email || 'Email'}" placeholder="${placeholders.emailAddress || 'Email Address'}" pattern="${EMAIL_PATTERN}" required autocomplete="email" value='test@gmail.com'>
        </div>
      </div>

      <div class="input-field-wrapper">
        <div class="input-wrapper auraAccount-field">
          <input type="number" id="aura-card-number" name="aura-card-number" aria-label="${placeholders.auraAccount || 'Aura Account'}" placeholder="${placeholders.auraAccount || 'Aura Account'}" pattern="/^[0-9]{16}$/" required autocomplete="tel" >
        </div>
      </div>

      <div class="aura-buttons">
        <button class="secondary-btn" type="submit"><span>${placeholders.sentOtp || 'Send OTP'}</span></button>
      </div>

    </div> 
  </form>`;

  auraForm.classList.add('aura-contact-container');
  block.querySelector('.aura-mobile-number').append(auraForm);

  const otpForm = document.createElement('div');
  otpForm.innerHTML = `<form class="aura-otp-form">
        <div class="input-field-wrapper">
          <div class="input-wrapper">
             <input type="number" id="otp-input" name="otp-input" 
             placeholder="${placeholders.otpPlaceholder || 'One time pin'}" required maxlength="${placeholders.otpLength || otpLength} || 6" oninput="this.value = this.value.slice(0, ${placeholders.otpLength || otpLength});" onkeydown="return event.key !== 'e' && event.key !== 'E';" autocomplete="one-time-code">
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

  const congratulationsFragment = await loadFragment(
    `/${document.documentElement.lang}/fragments/aura/congratulations-aura`,
  );
  block.children[block.children.length - 1].replaceWith(
    congratulationsFragment.querySelector('.block'),
  );
}

async function sendOtp(method, inputValue) {
  const loginFunctions = {
    mobile: loginMobileLinkAura,
    email: loginEmail,
    auraAccount: loginAuraAcc,
  };
  const loginFunction = loginFunctions[method];
  if (loginFunction) {
    return loginFunction(inputValue);
  }
  throw new Error('Invalid method');
}

async function toggleInputVisibility(selectedMethod) {
  const customer = await getCustomer();
  const linkYourAura = document.querySelector('.link-your-aura');
  const auraForm = linkYourAura.querySelector('.aura-contact-form .contact-method');
  ['mobile', 'email', 'auraAccount'].forEach((method) => {
    const input = auraForm.querySelector(`.${method}-field`);
    const inputElement = auraForm.querySelector(`.${method}-field input`);
    // Clear the input value when switching methods
    if (method !== selectedMethod) {
      inputElement.value = method === 'email' && customer?.email ? customer.email : '';
    }
    resetMessage(inputElement);
    input.classList.toggle('input-show', method === selectedMethod);
  });
}

export async function createLinkAura(reDecorate, notyou) {
  loadFragment(
    `/${document.documentElement.lang}/fragments/aura/link-your-aura`,
  ).then(async (fragment) => {
    const titleDiv = fragment.querySelector('.aura-title');
    const modalContent = fragment.querySelector('.link-your-aura');
    modalContent.firstElementChild.remove();
    await closeModal('link-your-aura-dialog');
    if (!document.getElementById('link-your-aura-dialog')) {
      await createModalFromContent(
        'link-your-aura-dialog',
        titleDiv.textContent,
        modalContent.outerHTML,
        ['aura-modal', 'aura'],
        'arrow-left-black',
        false,
        'icon-aura-close',
      );
      let userDetails = null;
      const auraCustomerData = await getAuraCustomerData();
      const linkYourAura = document.querySelector('#link-your-aura-dialog');
      const arrowIcon = linkYourAura.querySelector('.icon-title-left');
      arrowIcon.classList.add('icon-hide');
      const auraOptionForm = linkYourAura.querySelector('.aura-mobile-number');
      const auraForm = linkYourAura.querySelector('.aura-contact-form');
      const otpForm = linkYourAura.querySelector('.aura-otp-form');
      const congratsForm = linkYourAura.querySelector(
        '.aura-congratulations .aura-buttons',
      );

      const otpContainer = linkYourAura.querySelector('.aura-otp');
      const defaultOtpInfoText = otpContainer.querySelector('div').textContent;
      const defaultOtpResendText = linkYourAura.querySelector(
        '.aura-otp .otp-info-text p',
      ).innerHTML;

      const successMessageDiv = otpContainer.querySelector('.otp-success-message');
      successMessageDiv.textContent = `${placeholders.otpSuccessMessage}` || 'OTP sent successfully';
      successMessageDiv.classList.add('hide-message');

      if (auraCustomerData?.apc_link === 1 && !notyou) {
        auraOptionForm.classList.add('hide');
        otpContainer.querySelector('.aura-otp > div').innerHTML = `${defaultOtpInfoText} <span class="mob-number">${auraCustomerData.apc_phone_number}</span>`;
        otpContainer.classList.add('show');
      } else {
        auraOptionForm.classList.add('show');
      }

      const auraForms = auraForm.querySelectorAll('.input-field-wrapper');

      const forms = [otpForm, ...auraForms];

      forms.forEach((element) => {
        addFormValidation(element);
        decorateIcons(element);
      });

      phonenumberValidation(auraForm);

      auraForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = auraForm.querySelector('.aura-buttons button');
        submitButton.disabled = true;
        const selectedMethod = auraForm.querySelector("input[name='contact-method']:checked");

        if (selectedMethod) {
          const selectedValue = selectedMethod.value;

          const methodSelectors = {
            mobile: '#login-mobile',
            email: '#email-address',
            auraAccount: '#aura-card-number',
          };

          const methodLabels = {
            mobile: 'mobile number',
            email: 'email address',
            auraAccount: 'Aura card number',
          };

          const errorMessages = {
            mobile: placeholders.incorrectMobileErrorMessage || 'This mobile number isn’t registered. Please enter the same number used during sign-up.',
            email: placeholders.incorrectEmailErrorMessage || 'This email ID isn’t registered. Please enter the same email ID used during sign-up.',
            auraAccount: placeholders.incorrectAuraErrorMessage || 'Please re-enter a valid Aura card number.',
          };

          try {
            const inputElement = auraForm.querySelector(methodSelectors[selectedValue]);
            const inputValue = inputElement?.value.trim();

            if (inputValue) {
              const data = await sendOtp(selectedValue, inputValue);
              userDetails = data;
              const identifierNumber = userDetails?.apc_identifier_number;
              if (data) {
                if (data?.apc_identifier_number === null) {
                  const inputFieldWrapper = inputElement.closest('.input-field-wrapper');
                  const errorMessage = errorMessages[selectedValue];
                  showErrorMessage(inputFieldWrapper, errorMessage);
                } else {
                  sendOtpApiCall(identifierNumber);
                  resetOtp(otpContainer, defaultOtpResendText, auraForm);
                  const mobile = auraForm.querySelector('#login-mobile').value;
                  otpContainer.querySelector('.aura-otp > div').innerHTML = `${defaultOtpInfoText} <span class="mob-number">+${countryPrefix}${mobile}</span>`;
                  nextStage(linkYourAura);
                  arrowIcon.classList.remove('icon-hide');
                  linkYourAura.querySelector('.otp-info-text .disabled')?.classList.remove('disabled');
                }
              }
            } else {
              const inputFieldWrapper = inputElement.closest('.input-field-wrapper');
              const errorMessage = selectedValue === 'mobile'
                ? `${placeholders.errorText} +${countryPrefix} ${methodLabels[selectedValue]} `
                : `${placeholders.errorText} ${methodLabels[selectedValue]}`;
              showErrorMessage(inputFieldWrapper, errorMessage);
              submitButton.disabled = true;
            }
          } catch (error) {
            console.error(error);
          }
        } else {
          console.error('No method selected');
        }
      });

      ['mobile', 'email', 'auraAccount'].forEach((method) => {
        auraForm
          .querySelector(`#${method}-radio`)
          .addEventListener('change', () => {
            toggleInputVisibility(method);
          });
      });

      toggleInputVisibility('mobile');

      otpForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const inputElement = otpForm.querySelector('#otp-input');
        const inputValue = inputElement?.value.trim();
        const apcIdentifierId = userDetails ? userDetails.apc_identifier_number : JSON.parse(localStorage.getItem('aura_common_data') || '{}')?.aura_membership;
        try {
          if (inputValue) {
            const status = await verifyOtpLinkAura(inputValue, apcIdentifierId);
            if (status) {
              const custApcLink = await getAuraGuestInfo(apcIdentifierId);
              const congratulationsTitle = document.querySelector(
                '.congratulations-title',
              );
              linkYourAura.querySelector('.modal-header > h4').textContent = congratulationsTitle.querySelector('*').textContent;
              linkYourAura.querySelector('.congratulations-title').remove();
              nextStage(linkYourAura);
              if (custApcLink?.apc_link === '2' || custApcLink?.apc_link === 2) {
                linkYourAura.querySelector('.aura-quick-enrolled').remove();
                linkYourAura.querySelector('.aura-social').remove();
              }
              arrowIcon.classList.add('icon-hide');
            } else {
              const inputFieldWrapper = otpForm.querySelector('.input-field-wrapper');
              const errorMessage = placeholders.incorrectOtpErrorMessage || 'Incorrect OTP';
              showErrorMessage(inputFieldWrapper, errorMessage);
            }
          } else {
            const inputFieldWrapper = inputElement.querySelector('.input-field-wrapper');
            const errorMessage = 'Please enter OTP';
            showErrorMessage(inputFieldWrapper, errorMessage);
          }
        } catch (error) {
          console.error(error);
        }
      });

      auraModalRedirection(congratsForm, 'link-your-aura-dialog', 'link-your-aura-redirect', reDecorate);
      congratsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        closeModal('link-your-aura-dialog');
        window.dispatchEvent(new CustomEvent('linkAuraSuccess'));
        if (reDecorate) {
          reDecorate();
        }
      });

      arrowIcon.addEventListener('click', async (event) => {
        event.preventDefault();
        prevStage(linkYourAura);
        arrowIcon.classList.add('.icon-hide');
      });

      submitOnEnter(forms);
    }
    openModal('link-your-aura-dialog');
  });
}
