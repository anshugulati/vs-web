import { fetchPlaceholdersForLocale, showToastNotification } from '../../scripts/scripts.js';
import { getCustomer, updateCustomer2 } from '../../scripts/customer/api.js';
import { getConfigValue } from '../../scripts/configs.js';
import { showPageErrorMessage } from '../../scripts/forms.js';

export default async function decorate(block) {
  const customer = await getCustomer();
  if (!customer) {
    showPageErrorMessage('Failed to load customer details.');
    return;
  }
  const mobileSmsCommunicationPreferenceEnabled = await getConfigValue('mobilesms-communication-preference-enabled');
  const whatsappCommunicationPreferenceEnabled = await getConfigValue('whatsapp-communication-preference-enabled');
  const communicationPreferenceDefaultSelect = await getConfigValue('communication-preference-default-select');
  const communicationPreferenceSaveButtonDisabled = await getConfigValue('communication-preference-disable-save-button');
  const communicationPreferenceTwoLayerLabelEnabled = await getConfigValue('communication-preference-two-layer-label');
  const showPageApiResponseDisabled = await getConfigValue('disable-api-message-section');
  const commsPreferenceField = customer.custom_attributes.find((attr) => attr.attribute_code === 'communication_preference');
  const commsPreferenceValue = commsPreferenceField?.value;
  const commsPreference = commsPreferenceValue?.split(',') || [];
  const placeholders = await fetchPlaceholdersForLocale();
  const form = document.createElement('form');
  const emailFieldWrapper = document.createElement('div');
  const groupWrapper = document.createElement('div');
  const isTwoLayerEnabled = communicationPreferenceTwoLayerLabelEnabled === 'true';
  groupWrapper.setAttribute('class', 'group-wrapper');
  emailFieldWrapper.classList.add('input-field-wrapper', 'no-transition');
  emailFieldWrapper.innerHTML = `<div class="input-wrapper">
    <input type="checkbox" id="communication-email" name="communication-channel" aria-label="${placeholders.email || 'Email'}" ${commsPreference.includes('email') || communicationPreferenceDefaultSelect === 'email' ? 'checked' : ''} value="email"}>
    ${isTwoLayerEnabled ? `<label for="communication-email"><span class="label-wrapper"><span class="label-title">${placeholders.email || 'Email'}</span><span class= "label-value" id="communication-email-value">${customer.email}</span></span></label>`
    : `<label for="communication-email">${placeholders.email || 'Email'} (${customer.email})</label>`}
    </div>`;
  groupWrapper.appendChild(emailFieldWrapper);
  const mobileNumber = customer.custom_attributes.find((attr) => attr.attribute_code === 'phone_number')?.value;
  if ((mobileNumber && !mobileSmsCommunicationPreferenceEnabled) || mobileSmsCommunicationPreferenceEnabled === 'true') {
    const mobileFieldWrapper = document.createElement('div');
    mobileFieldWrapper.classList.add('input-field-wrapper', 'no-transition');
    mobileFieldWrapper.innerHTML = `
    <div class="input-wrapper">
    <input type="checkbox" id="communication-phone" name="communication-phone" aria-label="${placeholders.Phone || 'Phone'}" ${commsPreference.includes('phone') && mobileNumber ? 'checked' : ''} value="phone" ${!mobileNumber ? 'disabled' : ''}>
    ${isTwoLayerEnabled ? `<label for="communication-phone"><span class="label-wrapper"><span class="label-title">${placeholders.mobilesms || 'Mobile SMS'} </span><span class= "label-value" id="communication-phone-value"> ${!mobileNumber ? '' : mobileNumber}</span></span></label>`
    : `<label for="communication-phone">${placeholders.phone || 'Phone'} (${mobileNumber})</label>`}
    </div>`;
    groupWrapper.appendChild(mobileFieldWrapper);
  }
  if (whatsappCommunicationPreferenceEnabled === 'true') {
    const whatsappFieldWrapper = document.createElement('div');
    whatsappFieldWrapper.classList.add('input-field-wrapper', 'no-transition');
    whatsappFieldWrapper.innerHTML = `
    <div class="input-wrapper">
    <input type="checkbox" id="communication-whatsapp" name="communication-whatsapp" aria-label="${placeholders.whatsapp || 'WhatsApp'}" ${commsPreference.includes('whatsapp') && mobileNumber ? 'checked' : ''} value="whatsapp" ${!mobileNumber ? 'disabled' : ''}>
    ${isTwoLayerEnabled ? `<label for="communication-whatsapp"><span class="label-wrapper"><span class="label-title">${placeholders.whatsapp || 'WhatsApp'}</span><span class= "label-value" id="communication-whatsapp-value"> ${!mobileNumber ? '' : mobileNumber}</span></span></label>`
    : `<label for="communication-whatsapp">${placeholders.whatsapp || 'WhatsApp'} (${mobileNumber})</label>`}
    </div>`;
    groupWrapper.appendChild(whatsappFieldWrapper);
  }
  form.appendChild(groupWrapper);
  const saveButton = document.createElement('button');
  saveButton.name = 'save';
  saveButton.id = 'save';
  saveButton.textContent = placeholders.save || 'Save';
  saveButton.classList.add('communication-preference-save');
  form.appendChild(saveButton);
  const saveTrigger = (triggerData, action) => {
    triggerData.addEventListener(action, async (event) => {
      event.preventDefault();
      const emailCheckbox = document.getElementById('communication-email');
      const phoneCheckbox = document.getElementById('communication-phone');
      const emailChecked = emailCheckbox.checked;
      const phoneChecked = phoneCheckbox?.checked || false;
      const whatsappChecked = whatsappCommunicationPreferenceEnabled === 'true' ? document.getElementById('communication-whatsapp').checked : false;
      const checkedComms = [];
      if (emailChecked) {
        checkedComms.push('email');
      }
      if (phoneChecked) {
        checkedComms.push('phone');
      }
      if (whatsappChecked) {
        checkedComms.push('whatsapp');
      }
      const communicationPreference = checkedComms.join(',');
      if (commsPreferenceField) {
        commsPreferenceField.value = communicationPreference;
      } else {
        customer.custom_attributes.push({
          attribute_code: 'communication_preference',
          value: communicationPreference,
        });
      }
      const updateResult = await updateCustomer2(customer);
      if (updateResult.success) {
        showToastNotification(placeholders.communicationPreferencesSuccess || 'Your communication preferences have been saved.');
        return;
      }
      if (showPageApiResponseDisabled === 'true') {
        showToastNotification(updateResult.data?.message || placeholders.communicationPreferencesFailed || 'Failed to save communication preferences.', false, true);
      } else {
        showPageErrorMessage(updateResult.data?.message || placeholders.communicationPreferencesFailed || 'Failed to save communication preferences.');
      }
    });
  };
  if (communicationPreferenceSaveButtonDisabled === 'true') {
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => saveTrigger(checkbox, 'change'));
  } else {
    saveTrigger(saveButton, 'click');
  }
  const communicationContainer = document.createElement('div');
  communicationContainer.classList.add('communication-container');
  communicationContainer.appendChild(form);
  block.appendChild(communicationContainer);
}
