import { getCustomer, updateCustomer } from '../../scripts/customer/api.js';
import {
  FULLNAME_PATTERN,
  DATE_PATTERN,
  showPageSuccessMessage,
  showPageErrorMessage,
  setErrorMessageForField,
  validateForm,
  validateInput,
  dateValidation,
  validatePhone,
  sendOtp,
  showErrorMessage,
  customSelectbox,
  resetMessage,
} from '../../scripts/forms.js';
import { fetchPlaceholdersForLocale, showToastNotification } from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import {
  getMaxLengthByCountryCode,
  getCountryIso,
} from '../../scripts/helpers/country-list.js';
import { getAPCSearchData } from '../../scripts/customer/register-api.js';

function toggleAccordionItem(e) {
  const item = e.currentTarget;
  item.closest('.accordion').classList.toggle('open');
}

export default async function decorate(block) {
  const placeholders = await fetchPlaceholdersForLocale();
  const customer = await getCustomer();
  const market = await getConfigValue('country-code');
  const countryCode = await getConfigValue('country-code');
  const countryIso = await getCountryIso(market);
  const customerDetailsAddMoreDisabled = await getConfigValue('customer-details-addmore-disabled');
  const customerDetailsPhoneWithoutOTPEnable = await getConfigValue('customer-details-phone-without-otp-enable');
  const showPageApiResponseDisabled = await getConfigValue('disable-api-message-section');
  const isHelloMemberDisabled = await getConfigValue('hello-member-disabled');

  const form = document.createElement('form');
  const pattern = '[0-9]*';
  form.innerHTML = `
  <div class="input-field-wrapper details-name-wrapper">
      <div class="input-wrapper input-field">
        <input type="text" id="fullName" name="fullName" pattern="${FULLNAME_PATTERN}" aria-label="${placeholders.fullName || 'Full Name'}" required autocomplete="name">
        <label for="fullName">${placeholders.fullName || 'Full Name'}</label>
      </div>
    </div>
    <div class="input-field-wrapper details-email-wrapper">
      <div class="input-wrapper input-field">
        <input type="email" id="email" name="email" placeholder=" " aria-label="${placeholders.email || 'Email'}" required autocomplete="email" disabled>
        <label for="email">${placeholders.emailaddress || 'Email'}</label>
      </div>
    </div> 
  ${customerDetailsPhoneWithoutOTPEnable === 'true'
    ? (`<div class="input-field-wrapper details-phone-wrapper">
      <div class="input-wrapper phone-country-field input-field">             
              <label for="countrycode" class="countrycode">+${countryIso}</label>
              <input type="tel" id="phone" name="phone" pattern="${pattern}" placeholder=" " aria-label="${placeholders.mobileNumberInputText || 'Mobile Number'}" autocomplete="tel" maxlength="9">
              <label class="label-mobile" for="phone">${placeholders.mobileNumberInputText || 'Mobile Number'}</label>
              </div>
            </div> `) : ''}
  ${!customerDetailsAddMoreDisabled === 'true'
    ? (`<div class="add-more-section accordion plus">
      <div class="accordion-item-label">
        <h3>${placeholders.addmoreTitle} <span>(${placeholders.optional || 'optional'})</span></h3>
        <span class="accordion-subhead">${placeholders.addmoreSubtitle}</span>
      </div>
      <div class="add-more-fields accordion-item-body">
        <span class="add-more-field">${placeholders.addmoreDescription}</span>
        <div class="input-field-wrapper dateOfBirth">
          <div class="input-wrapper input-field">
            <input type="date" id="dob" name="dob" placeholder=" " aria-label="${placeholders.dob || 'Date of Birth'}" autocomplete="bday" pattern=${DATE_PATTERN} max="9999-12-31">
            <label for="dob">${placeholders.dob || 'Date of Birth'}</label>
          </div>
          <p class="dobtext">${placeholders.dobhelptext}</p>
        </div>
        <div class="input-field-wrapper dropdown notransistion gender">
          <div class="input-wrapper input-field">
            <label for="gender">${placeholders.gender || 'Gender'} </label>
              <div class="custom-select">
                <div class="select-selected">Select Gender</div>
                <div class="select-items select-hide">
                  <div data-value="" disabled>${placeholders.selectGender || 'Select Gender'}</div>
                  <div data-value="m">${placeholders.genderMale || 'Male'} </div>
                  <div data-value="f">${placeholders.genderFemale || 'Female'}</div>
                  <div data-value="ns">${placeholders.genderOthers || 'Prefer not to say'}</div>
                </div>
              </div>
          </div>
        </div>
        <div class="input-field-wrapper phonevalidation notransistion">
          <label for="phone">${placeholders.phone || 'Mobile Number'}</label>
          <div>
            <div class="input-wrapper input-field">             
              <label for="countrycode" class="countrycode">+${countryIso}</label>
              <input type="tel" id="phone" name="phone" placeholder=" " aria-label="${placeholders.mobileNumber || 'Mobile Number'}" autocomplete="tel" maxlength="9">
            </div>
            <button type="button" class="otp-button" id="otp-button" disabled><span>${placeholders.sendotp || 'SEND OTP'}</span></button>
          </div>
        </div>
        <p class="otp-helptext">${placeholders.otpHelptext}</p>
      </div>
    </div>`) : ''}
    <button type="submit" class="saveButton"><span>${placeholders.save || 'Save'}</span></button>`;
  form.setAttribute('novalidate', '');
  const getMoreContainer = form.querySelector('.add-more-section.accordion.plus');

  if (isHelloMemberDisabled) {
    getMoreContainer?.classList.add('disabled');
  }

  // displaying the field values post updation of user details
  form.querySelector('#fullName').value = `${customer.firstname} ${customer.lastname}`;
  form.querySelector('#email').value = customer.email;

  if (form.querySelector('#dob')) {
    if (customer?.dob) {
      form.querySelector('#dob').disabled = true;
    } else {
      form.querySelector('#dob').value = customer.dob;
    }
  }

  const genderList = form.querySelectorAll('.select-items div');
  const selectedGender = Object.values(genderList)
    .filter((item) => item.dataset.value === customer.extension_attributes.customer_gender);
  if (form.querySelector('.gender')) {
    form.querySelector('.gender .select-selected').textContent = selectedGender[0]?.innerHTML;
    form.querySelector('.gender .select-selected').dataset.value = customer.extension_attributes.customer_gender;
  }
  const phonenumberdata = customer.custom_attributes.find((attr) => attr.attribute_code === 'phone_number');
  if (form.querySelector('#phone')) {
    form.querySelector('#phone').value = phonenumberdata === undefined ? '' : phonenumberdata?.value.split(countryIso)[1];
  }
  const sendOtpButton = form.querySelector('.otp-button');
  const dateInput = form.querySelector('#dob');

  const phoneInput = form.querySelector('#phone');
  const maxPhoneNumberInputLength = await getMaxLengthByCountryCode(market);
  if (phoneInput) {
    phoneInput.maxLength = maxPhoneNumberInputLength;
    phoneInput.minLength = maxPhoneNumberInputLength;
  }

  customSelectbox(form);

  form.querySelectorAll('input').forEach((input) => {
    setErrorMessageForField(input, placeholders);
  });
  if (customerDetailsAddMoreDisabled === 'true') {
    const telphoneInput = form.querySelector('#phone');
    const fullName = form.querySelector('#fullName');
    /* Phone number validation with country code */
    const telephoneValidate = async () => {
      let phoneErrorMessage = placeholders.invalidMobileNumber || `The number provided ${telphoneInput.value} is not a valid mobile number.`;
      if (telphoneInput.value.length >= telphoneInput.maxLength) {
        telphoneInput.value = telphoneInput.value.replace(/[^0-9]/g, '');
        const isValidPhoneNumber = await validatePhone(
          telphoneInput.value,
          countryCode,
        );
        phoneErrorMessage = phoneErrorMessage.replace('{{}}', telphoneInput.value);
        if (!isValidPhoneNumber) {
          showErrorMessage(telphoneInput, phoneErrorMessage);
          return false;
        }
        resetMessage(telphoneInput);
        return true;
      }
      if (telphoneInput.value.length === 0) {
        resetMessage(telphoneInput);
        return true;
      }
      phoneErrorMessage = phoneErrorMessage.replace('{{}}', telphoneInput.value);
      showErrorMessage(telphoneInput, phoneErrorMessage);
      return false;
    };
    const fullNameValidate = () => {
      if (!validateInput(fullName)) {
        return false;
      }
      return true;
    };
    /* onBlur-First time and the input Event for mobile field and FullName field */
    form.querySelectorAll('input').forEach((input) => {
      // Track if blur has already been triggered
      let hasBlurred = false;
      const validatingForm = async () => {
        const telephoneValidateGet = await telephoneValidate();
        if (fullNameValidate() && telephoneValidateGet) {
          form.querySelector('button').disabled = false;
        } else {
          form.querySelector('button').disabled = true;
        }
      };
      // Run validation on blur only once
      input.addEventListener('blur', async () => {
        if (!hasBlurred) {
          hasBlurred = true;
          await validatingForm();
        }
      });
      // Run validation on input after blur has been triggered
      input.addEventListener('input', async (event) => {
        if (hasBlurred) {
          if (input.id === 'phone') {
            event.target.value = event.target.value.replace(/[^0-9]/g, '');
          }
          await validatingForm();
        }
      });
    });
  }

  if (dateInput) {
    dateInput.addEventListener('blur', async (event) => {
      event.preventDefault();
      const inputValue = dateInput.value;
      if (inputValue === '') {
        if (!dateInput.checkValidity()) {
          showErrorMessage(dateInput, placeholders.invalidDate);
        } else {
          resetMessage(dateInput);
        }
      }
    });

    dateInput.addEventListener('input', async (event) => {
      event.preventDefault();
      const inputValue = dateInput.value;
      if (inputValue === '') {
        showErrorMessage(dateInput, placeholders.invalidDate);
        return;
      }
      dateValidation(dateInput, placeholders);
    });
  }
  if (phoneInput && sendOtpButton) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/\D/g, '');
      phoneInput.closest('.input-field-wrapper').classList.remove('success');
      if (sendOtpButton) {
        sendOtpButton.disabled = phoneInput.value.length < maxPhoneNumberInputLength;
        form.querySelector('.saveButton').disabled = phoneInput.value.length === maxPhoneNumberInputLength;
      }
    });
  }
  let resendCounter = 0;
  if (sendOtpButton) {
    sendOtpButton.addEventListener('click', async (event) => {
      event.preventDefault();
      const button = event.target.closest('button');
      button.classList.add('loader');
      const isValidPhoneNumber = await validatePhone(phoneInput.value, market);
      if (isValidPhoneNumber) {
        const searchPhoneNumber = await getAPCSearchData(phoneInput, countryIso);
        if (searchPhoneNumber.apc_identifier_number) {
          button.classList.remove('loader');
          showErrorMessage(phoneInput, placeholders.phoneNumberLinked);
          return;
        }
        const result = await sendOtp(phoneInput, countryIso, resendCounter, placeholders);
        resendCounter = result.updatedResendCounter;
      } else {
        showErrorMessage(phoneInput, placeholders.invalidPhonenumberError);
      }
      button.classList.remove('loader');
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(form)) {
      return;
    }

    if (form.querySelector('#phone') && form.querySelector('#phone')?.value.length > 0 && form.querySelector('#phone')?.value.length !== maxPhoneNumberInputLength) {
      const phoneerror = placeholders.invalidPhonenumberLength;
      showErrorMessage(phoneInput, phoneerror?.replace('{{phone}}', form.querySelector('#phone').value));
      return;
    }
    const phoneInputCheck = form.querySelector('.phonevalidation input');
    if (phoneInputCheck && phoneInputCheck.hasAttribute('required') && phoneInputCheck.value.length !== maxPhoneNumberInputLength) {
      const phoneerror = placeholders.invalidPhonenumberLeng || 'The number provided is not valid number';
      showErrorMessage(phoneInput, phoneerror.replace('{{phone}}', form.querySelector('#phone').value));
      return;
    }

    form.querySelector('button.saveButton').classList.add('loader');
    const fullName = form.querySelector('#fullName')?.value;
    const dob = form.querySelector('#dob')?.value;
    const genderSelect = form.querySelector('.gender .select-selected')?.dataset?.value;
    const tel = form.querySelector('#phone')?.value ? `+${countryIso}${form.querySelector('#phone')?.value}` : '';
    const data = {
      name: fullName,
      email: customer.email,
      dateofBirth: dob,
      gender: genderSelect,
    };

    let phoneVerification = false;
    if (form.querySelector('.phonevalidation')?.classList?.contains('success')
    || document.querySelector('.phonevalidation input')?.value !== '') {
      phoneVerification = true;
    }

    const responseData = await updateCustomer(data, tel, phoneVerification);
    form.querySelector('button.saveButton').classList.remove('loader');
    if (responseData.success) {
      if (form.querySelector('#dob')) {
        form.querySelector('#dob').disabled = true;
      }
      const phoneNumber = responseData.data.custom_attributes.find((attr) => attr.attribute_code === 'phone_number')?.value;
      if (showPageApiResponseDisabled === 'true') {
        showToastNotification(placeholders.mydetailsSave || 'Your details have been saved.');
      } else {
        showPageSuccessMessage(placeholders.mydetailsSave, 'prependMainWrapper');
      }
      if (customerDetailsAddMoreDisabled === 'true') {
        if (!tel) {
          document.getElementById('communication-phone').setAttribute('disabled', 'true');
          document.getElementById('communication-phone').checked = false;

          document.getElementById('communication-whatsapp')?.setAttribute('disabled', 'true');
          document.getElementById('communication-whatsapp').checked = false;
        }
        if (tel) {
          document.getElementById('communication-whatsapp').removeAttribute('disabled');
          document.getElementById('communication-phone').removeAttribute('disabled');
        }
        if (document.getElementById('communication-phone-value')) {
          document.getElementById('communication-phone-value').innerText = phoneNumber || '';
        }
        if (document.getElementById('communication-whatsapp-value')) {
          document.getElementById('communication-whatsapp-value').innerText = phoneNumber || '';
        }
      }
      return;
    }
    if (showPageApiResponseDisabled === 'true') {
      showToastNotification(responseData.message || 'Something went wrong, Please try again', false, true);
    } else {
      showPageErrorMessage(responseData.message, 'prependMainWrapper');
    }
  });

  const accordionitem = form.querySelector('.accordion-item-label');
  if (accordionitem) {
    accordionitem.addEventListener('click', toggleAccordionItem);
  }

  const myDetailsContainer = document.createElement('div');
  myDetailsContainer.classList.add('my-details-container');
  myDetailsContainer.appendChild(form);
  decorateIcons(myDetailsContainer);
  block.appendChild(myDetailsContainer);
}
