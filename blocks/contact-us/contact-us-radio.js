import { fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
import {
  setErrorMessageForField, validateForm, validateInput, showPageErrorMessage,
  customSelectbox,
  selectItemsTrigger,
  addRecaptchaScript,
  validateReCaptchaV3,
  validatePhone,
  EMAIL_PATTERN,
  FNAME_PATTERN,
  LNAME_PATTERN,
  showErrorMessage,
  resetMessage,
  validateAddressDropdowns,
} from '../../scripts/forms.js';
import { decorateIcons } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import { performCommerceRestMutation } from '../../scripts/commerce.js';
import { getMaxLengthByCountryCode, getCountryIso } from '../../scripts/helpers/country-list.js';

async function createUrl(endpoint) {
  const [baseUrl, storeViewCode] = await Promise.all(
    [getConfigValue('commerce-rest-endpoint'),
      getConfigValue('commerce-store-view-code')],
  );
  const url = `${baseUrl}/${storeViewCode}/V1/${endpoint}`;
  return url;
}

async function submitContactForm(variables, redirectUrl, placeholders, form) {
  const url = await createUrl('send-email');
  const response = await performCommerceRestMutation(url, variables);
  if (response.success) {
    const redirectPath = new URL(redirectUrl);
    window.location.href = redirectPath.pathname;
  } else {
    showPageErrorMessage(placeholders.contactUsError || 'An error occurred. Please try again later.');
    form.querySelector('button').classList.remove('loader');
    return null;
  }
  return response;
}

export default async function decorateContactUSblock(block) {
  const lang = document.documentElement.lang || 'en';
  const placeholders = await fetchPlaceholdersForLocale();
  const form = document.createElement('form');
  const redirectUrl = block.querySelector(':scope > div:first-child a')?.href;
  const feedbackDropdown = {};
  block.querySelectorAll(':scope > div:not(:first-child)').forEach((item) => {
    const itemKey = item.querySelector('div:first-of-type').textContent.trim();
    const subItems = item.querySelectorAll('div:not(:first-of-type) li');
    if (subItems) {
      const values = Array.from(subItems).map((li) => li.textContent.trim());
      feedbackDropdown[itemKey] = values;
    }
  });

  block.innerHTML = '';

  const countryCode = await getConfigValue('country-code');
  const maxLength = await getMaxLengthByCountryCode(countryCode);
  const countryPrefix = `+${await getCountryIso(countryCode)}`;
  const contactEmails = await getConfigValue('contact-emails');
  const textareaMaxlength = lang === 'en' ? await getConfigValue('contact-en-textarea-length') : await getConfigValue('contact-ar-textarea-length');

  form.innerHTML = `
    <div class="input-field-wrapper no-transition communication-channel">
      <div class="input-wrapper input-field">
      <p class="section-subhead">${placeholders.contactUsCommunicationChannel || 'Select Your Prefered Communication Channel'} </p>
        <div class="radio-button-wrapper" role="group">
          <div class="radio-wrapper">
            <input type="radio" id="email" name="communication-channel" checked />
            <label for="email" class="radioele">${placeholders.contactUsChannelEmail || 'Email'}
            </label>
          </div>
          <div class="radio-wrapper">
            <input type="radio" id="mobile" name="communication-channel" />
            <label for="mobile" class="radioele">
              ${placeholders.contactUsChannelMobile || 'Mobile'}
            </label>
          </div>
        </div>
       </div>
    </div>
  <div class="contact-flex-items">
  <p class="section-subhead">${placeholders.contactUsDetails || 'Fill in your details*'} </p>
  <div>
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="text" id="firstname" class="firstname" name="firstname" placeholder=" " aria-label="${placeholders.contactUsFirstname || 'First Name'}" required pattern="${FNAME_PATTERN}" autocomplete="firstname" />
        <label for="firstname">${placeholders.contactUsFirstname || 'First Name'}</label>
      </div>
    </div>
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="text" id="lastname" class="lastname" name="lastname" placeholder=" " aria-label="${placeholders.contactUsLastname || 'Last Name'}" required pattern="${LNAME_PATTERN}" autocomplete="lastname" />
        <label for="lastname">${placeholders.contactUsLastname || 'Last Name'}</label>
      </div>
    </div>
    <div class="input-field-wrapper prefix-inputcode">
        <div class="input-wrapper input-field">             
          <input type="tel" id="phone" name="phone" placeholder=" " aria-label="${placeholders.contactUsMobileNumber || 'Mobile Number'}" maxlength='${maxLength}' minlength='${maxLength}' required>
          <label for="phone">${placeholders.contactUsChannelMobile || 'Mobile Number'}</label>
          <span class="input-coutrycode">${countryPrefix}</span>
        </div>
    </div>
    <div class="input-field-wrapper">
        <div class="input-wrapper input-field">
            <input type="email" id="email" name="email" placeholder="" aria-label="${placeholders.contactUsEmail || 'Email'}" required pattern="${EMAIL_PATTERN}" autocomplete="email">
            <label for="email">${placeholders.contactUsEmail || 'Email'}</label>
        </div>
    </div>
  </div>
  </div>
  <div class="contact-blocks">
  <div class="contact-flex-items radio">
    <div class="input-field-wrapper no-transition feedback">
      <div class="input-wrapper input-field">
        <p class='section-subhead'>${placeholders.contactUsFeedbackHeading || 'How can we help?*'} </p>
        <div class="radio-button-wrapper feedback-select" role="group" >
          <div class="radio-wrapper">
            <input type="radio" id="shopping" name="feedback-select" value="online-shopping" checked/>
            <label for="shopping" class="radioele">${placeholders.contactUsShopping || 'Online shopping'}
            </label>
          </div>
          <div class="radio-wrapper">
            <input type="radio" id="feedbackinquiry" name="feedback-select" value="feedback-inquiry" />
            <label for="feedbackinquiry" class="radioele">${placeholders.contactUsFeedbackinquiry || 'Feedback inquiry'}
            </label>
          </div>
        </div>
      </div>
    </div>
    <div class="input-field-wrapper no-transition feedback-type">
      <div class="input-wrapper input-field">
        <p class='section-subhead'>${placeholders.contactUsFeedbackType || 'Select a type*'}</p>
        <div class="radio-button-wrapper feedback-type-select" role="group">
          <div class="radio-wrapper">
            <input type="radio" id="inquiry" name="feedback-type-select" value="inquiry" checked/>
            <label for="inquiry" class="radioele">${placeholders.contactUsInquiry || 'Inquiry'}
            </label>
          </div>
          <div class="radio-wrapper">
            <input type="radio" id="complaint" name="feedback-type-select" value="complaint"/>
            <label for="complaint" class="radioele">${placeholders.contactUsComplaint || 'Complaint'}
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
    <div class="input-field-wrapper dropdown notransistion feedback-reason"> 
      <div class="input-wrapper input-field">
        <p class="section-subhead">${placeholders.contactUsFeedbackReason || 'Select Reason'}</p>
        <div class="custom-select feedback-reason-select" required aria-label="${placeholders.contactUsSelectFeedbackReasonAria || 'Reason'}">
          <div class="select-selected" data-value = "">${placeholders.contactUsSelectFeedbackReason || 'Select Reason'}</div>
            <div class="select-items select-hide"></div>     
        </div>
      </div>
    </div>
  </div>
  <div class="contact-blocks">
  <div class="contact-flex-items">
  <p class="section-subhead">${placeholders.contactUsDetails || 'Share some details'} </p>
  <div>
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="text" id="ordernumber" class="ordernumber" name="ordernumber" placeholder=" " aria-label="${placeholders.contactUsOrdernumber || 'Order Number (Optional)'}" maxlength="20"/>
        <label for="ordernumber">${placeholders.contactUsOrderNumber || 'Order Number (Optional)'}</label>
      </div>
    </div>
    <div class="input-field-wrapper">
      <div class="input-wrapper">
        <input type="text" id="missingitems" class="missingitems" name="missingitems" placeholder=" " aria-label="${placeholders.contactUsMissingitems || 'Missing Items (Optional)'}" maxlength="20"/>
        <label for="missingitems">${placeholders.contactUsMissingItems || 'Missing Items (Optional)'}</label>
      </div>
    </div>
  </div>
  </div>
  <div class="input-field-wrapper full-width notransistion">
    <div class="input-wrapper">
      <textarea id="message" class="message" name="message" placeholder="Enter a description..." aria-label="${placeholders.contactUsMessage || 'Message'}" required maxlength="${textareaMaxlength}"></textarea>
      <label for="message">${placeholders.contactUsMessage || 'Message'}</label>
      <span class="textarea-maxleng">${textareaMaxlength}</span>
    </div>
  </div>
  </div>
     <button type="submit" class="contact-submit"><span>${placeholders.contactUsSubmit || 'Submit'}</span></button>
  `;

  const siteKey = await getConfigValue('recaptchaV3-sitekey');
  addRecaptchaScript(siteKey);

  form.noValidate = true;

  form.querySelectorAll('input, textarea').forEach((input) => {
    setErrorMessageForField(input, placeholders);
    input.addEventListener('input', () => {
      validateInput(input);
    });
  });

  // feedback-reason dropdown values update based on selection
  function updateSelectDropdown(selectedResult) {
    form.querySelector('.select-items').innerHTML = '';
    feedbackDropdown[selectedResult].forEach((option) => {
      const selectOption = document.createElement('div');
      selectOption.innerText = option;
      selectOption.setAttribute('data-value', option);
      form.querySelector('.select-items').appendChild(selectOption);
    });

    selectItemsTrigger(form);
  }

  let selectedResult = 'online-shopping-inquiry';
  const handleRadioClick = (event) => {
    let selectedFeedback = 'online-shopping';
    let selectedFeedbackType = 'inquiry';
    const selectedOption = event.target;

    if (selectedOption.type === 'radio' && selectedOption.checked) {
      const { value } = selectedOption;
      if (selectedOption.closest('.feedback-select')) {
        selectedFeedback = value; // Online shopping or Feedback inquiry
      } else if (selectedOption.closest('.feedback-type-select')) {
        selectedFeedbackType = value; // Inquiry or Complaint
      }
    }

    selectedResult = `${selectedFeedback}-${selectedFeedbackType}`;
    updateSelectDropdown(selectedResult);
  };

  // radio button selection
  const radioElements = form.querySelectorAll('.contact-flex-items.radio input');
  radioElements.forEach((radio) => {
    radio.addEventListener('change', handleRadioClick);
  });

  updateSelectDropdown(selectedResult); // update dropdown
  customSelectbox(form);

  const phoneInput = form.querySelector('#phone');
  phoneInput.addEventListener('input', async () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '');
    form.querySelector('.prefix-inputcode').classList.add('show');
    if (phoneInput.value.length === phoneInput.maxLength) {
      const isValidPhoneNumber = await validatePhone(phoneInput.value, countryCode);
      let phoneErrorMessage = placeholders.contactUsInvalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneErrorMessage = phoneErrorMessage.replace('{{mobile}}', phoneInput.value);

      if (!isValidPhoneNumber) {
        showErrorMessage(phoneInput, phoneErrorMessage);
      }
    } else if (phoneInput.value === '') {
      form.querySelector('.prefix-inputcode').classList.remove('show');
    }
  });

  form.querySelectorAll('.custom-select').forEach((dropdown) => {
    setErrorMessageForField(dropdown, placeholders);
    dropdown.addEventListener('click', () => {
      if (form.querySelector('.select-selected').dataset.value !== '') {
        resetMessage(dropdown);
      }
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('.contact-submit');
    const validateDropdown = await validateAddressDropdowns(form, placeholders);
    if (!validateForm(form, placeholders) || !validateDropdown) {
      return;
    }

    if (phoneInput.value.length !== phoneInput.maxLength) {
      const phoneerror = placeholders.invalidMobileNumber;
      showErrorMessage(phoneInput, phoneerror.replace('{{}}', phoneInput.value));
      return;
    }

    submitButton.classList.add('loader');
    const data = new FormData(form);
    const variables = {
      email: contactEmails,
      content: {},
    };
    variables.content.name = `${data.get('firstname')} ${data.get('lastname')}`;
    variables.content.email = data.get('email');
    variables.content.phone_number = `${countryPrefix}${data.get('phone')}`;
    variables.content.specific_request = form.querySelector('.feedback-select input:checked').value;
    variables.content.request_type = form.querySelector('.feedback-type-select input:checked').value;
    variables.content.request_reason = form.querySelector('.feedback-reason-select .select-selected')?.innerHTML;
    variables.content.ordernumber = data.get('ordernumber');
    variables.content.missingitems = data.get('missingitems');
    variables.content.message = data.get('message');
    variables.content.communication_channel = form.querySelector('.communication-channel input:checked').value;
    variables.content.prefered_channel = 'web';
    variables.content.country = countryCode;
    variables.content.number_of_persons = '';
    variables.content.date = '';

    const bypassRecaptcha = await getConfigValue('recaptcha-bypass');
    if (bypassRecaptcha === 'true') {
      submitContactForm(variables, redirectUrl, placeholders, form);
      return;
    }
    // eslint-disable-next-line no-undef
    await grecaptcha.ready(async () => {
      // eslint-disable-next-line no-undef
      const token = await grecaptcha.execute(siteKey, { action: 'submit' });
      if (!token) {
        showPageErrorMessage(placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.');
        return;
      }
      const captchaValidated = await validateReCaptchaV3(token, submitButton);
      if (captchaValidated) {
        submitContactForm(variables, redirectUrl, placeholders, form);
      } else {
        submitButton?.classList.remove('loader');
        const recaptchaErrorMessage = placeholders.recaptchaErrorMessage || 'Verification failed. Please try again.';
        showPageErrorMessage(recaptchaErrorMessage);
      }
    });
  });
  const contactUsContainer = document.createElement('div');
  contactUsContainer.classList.add('contactus-container');
  contactUsContainer.appendChild(form);
  decorateIcons(contactUsContainer);

  block.appendChild(contactUsContainer);
}
