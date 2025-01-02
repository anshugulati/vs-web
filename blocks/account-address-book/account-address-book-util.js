import {
  createAddress, updateAddress, makePrimaryAddress, deleteAddress,
  getDeliveryMatrixAddressStructure,
  getAddressCitySegments,
  getAddressAreas,
  getAddressRegionSegments,
} from '../../scripts/address/api.js';
import { decorateIcons } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getCustomer } from '../../scripts/customer/api.js';
import {
  setErrorMessageForField,
  validateForm,
  validateInput,
  validatePhone,
  showErrorMessage,
  customSelectbox,
  validateCustomerEmail,
  resetMessage,
} from '../../scripts/forms.js';
import {
  fetchPlaceholdersForLocale,
  createModalFromContent,
  openModal,
  closeModal,
  showToastNotification,
  sanitizeDOMSync,
  getBrandCode,
} from '../../scripts/scripts.js';
import {
  getMaxLengthByCountryCode,
  getCountryIso,
} from '../../scripts/helpers/country-list.js';
import { dataLayerCustomerExistCheckoutErrors } from '../../scripts/analytics/google-data-layer.js';
import '../../scripts/third-party/dompurify.js';

const countryRules = {
  QA: {
    required: ['street', 'area', 'address_building_segment'],
    notRequired: ['address'],
  },
  AE: {
    required: ['address_building_segment', 'address_city_segment', 'area', 'street'],
    notRequired: ['address_apartment_segment'],
  },
  KW: {
    required: ['address_building_segment', 'address_block_segment', 'area', 'street', 'governate'],
    notRequired: ['address_apartment_segment'],
  },
  SA: {
    required: ['address_building_segment', 'area', 'street', 'address_city_segment'],
    notRequired: ['address_apartment_segment', 'address_block_segment'],
  },
  EG: {
    required: ['address_building_segment', 'address_region_segment', 'street', 'address_city_segment'],
    notRequired: ['address_landmark_segment', 'postcode', 'address_floor_segment'],
  },
  JO: {
    required: ['address_district_segment', 'address_city_segment', 'address_building_segment', 'street', 'address_landmark_segment'],
    notRequired: ['address_apartment_segment'],
  },
  BH: {
    required: ['address_road_segment', 'address_building_segment', 'address_block_segment'],
    notRequired: ['address_apartment_segment'],
  },
};

// adding toast notification
export function addStatusMessage(message) {
  showToastNotification(message);
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

export const accountNoAddress = await getConfigValue('account-no-adddress-enabled');
export const isAddAddressModalEnabled = await getConfigValue('add-address-modal-enabled');
const dropdownLabelEnabled = await getConfigValue('dropdown-label-enabled');
function selectItemsTriggerModal(formElement) {
  formElement.querySelectorAll('.select-items div').forEach((optionitem) => {
    optionitem.addEventListener('click', function () {
      const currentDropdown = this.closest('.custom-select');
      const selected = currentDropdown.querySelector('.select-selected');
      selected.textContent = this.textContent;
      selected.dataset.value = this.dataset.value;
      this.parentNode.classList.add('select-hide');
      const parentInput = this.closest('div.input-field-wrapper.dropdown');
      parentInput.querySelector('.error-message-container')?.classList.add('hide');
      currentDropdown.querySelector('.select-search')?.classList.toggle('hide');
    });
  });
}

async function showDropdownModal(modalType, placeholders, formElement, formDropdown) {
  const modalId = `select-${modalType}-modal`;
  let modalTitle;
  let elementId;
  let values;
  const countryCode = await getConfigValue('country-code');
  if (modalType === 'city') {
    modalTitle = placeholders.selectCity || 'Select City';
    elementId = '#address_city_segment .select-selected';
    values = await getAddressCitySegments(countryCode);
  } else if (modalType === 'area') {
    modalTitle = placeholders.selectArea || 'Select Area';
    elementId = '#area .select-selected';
    const cityValue = formElement.querySelector('.address_city_segment .select-selected')?.getAttribute('data-value');
    values = await getAddressAreas(countryCode, cityValue);
  }
  const modalContent = document.createElement('div');
  modalContent.classList.add(`select-${modalType}-content`);
  const itemList = document.createElement('ul');
  itemList.innerHTML = `<li class="no-results hide">${placeholders.dropdownNoResultsFound || 'No Results Found'}</li>`;
  values?.items.forEach((val) => {
    const listItem = document.createElement('li');
    listItem.id = val.location_id;
    listItem.textContent = val.label;
    itemList.appendChild(listItem);
  });

  /* searchbox created */
  const searchContainerDiv = document.createElement('div');
  const searchBarDiv = document.createElement('div');
  searchBarDiv.setAttribute('data-filter-attr-name', 'searchBox');
  searchBarDiv.setAttribute('data-filter-attr-value', 'searchBox');
  searchBarDiv.classList.add('search-field');
  const searchIcon = document.createElement('span');
  searchIcon.classList.add('icon', 'search-icon');
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.classList.add('searchBox', 'search-input');
  searchInput.placeholder = 'Search';
  searchBarDiv.appendChild(searchIcon);
  searchBarDiv.appendChild(searchInput);
  searchContainerDiv.appendChild(searchBarDiv);
  searchContainerDiv.appendChild(itemList);

  modalContent.innerHTML = searchContainerDiv.innerHTML;

  const removeDropdownErrors = () => {
    const inputWrapper = formDropdown?.parentElement?.parentElement;
    inputWrapper?.classList?.remove('invalid');
    inputWrapper?.querySelector('.error-message-container')?.classList.add('hide');
  };

  const toggleAreaField = () => {
    const getCityElement = formElement.querySelector('#address_city_segment .select-selected');
    const getAreaElement = formElement.querySelector('#area .select-selected');
    if (getCityElement) {
      getAreaElement.setAttribute('aria-disabled', 'false');
    } else {
      getAreaElement.setAttribute('aria-disabled', 'true');
    }
  };

  modalContent.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
      const getElem = formElement.querySelector(elementId);
      getElem.setAttribute('data-value', `${e.target.id}`);
      if (dropdownLabelEnabled && getElem.querySelector('span')) {
        getElem.querySelector('span').innerHTML = e.target.textContent;
      } else {
        getElem.innerHTML = e.target.textContent;
      }
      closeModal(modalId);
      removeDropdownErrors();
      if (modalType === 'city') {
        toggleAreaField();
      }
    }
  });
  const listItems = modalContent.querySelectorAll('li');
  const searchInputElem = modalContent.querySelector('.searchBox');
  const noResultsOption = modalContent?.querySelector('.no-results');
  searchInputElem.addEventListener('keyup', (e) => {
    const filterText = e.target.value.toLowerCase(); // Get input and convert to lowercase
    let anyVisible = false;
    const filteredItems = Array.from(listItems)?.filter((item) => !item.classList.contains('no-results'));
    filteredItems.forEach((item) => {
      const itemText = item.textContent.toLowerCase(); // Convert list item text to lowercase
      if (itemText.includes(filterText)) {
        item.style.display = ''; // Show matching item
        anyVisible = true;
      } else {
        item.style.display = 'none'; // Hide non-matching item
      }
    });

    if (!anyVisible) {
      noResultsOption.classList.remove('hide');
    } else {
      noResultsOption.classList.add('hide');
    }
  });

  await createModalFromContent(
    modalId,
    modalTitle,
    modalContent,
    [`${modalId}`],
    'arrow-left-blue',
    true,
    'icon-close-blue',
  );
  openModal(modalId);
  const backButton = document.querySelector(`dialog.${modalId} .modal-header span`);
  backButton.addEventListener('click', () => {
    closeModal(modalId);
  });
}

export async function wrapTwoDivsinWrapper(firstDiv, secondDiv, className) {
  const WrapperDiv = document.createElement('div');
  WrapperDiv.className = className; // Add a class to the wrapper div if needed

  // Insert the wrapper div before the first div
  firstDiv.parentNode.insertBefore(WrapperDiv, firstDiv);
  // Move the two divs into the wrapper div
  WrapperDiv.appendChild(firstDiv);
  WrapperDiv.appendChild(secondDiv);
}

function customSelectboxModal(placeholders, formElement) {
  const searchInput = formElement.querySelector('.select-search');
  const options = formElement?.querySelectorAll('.select-items div:not([disabled])');
  const noResultsOption = formElement?.querySelector('.no-results');
  searchInput?.addEventListener('keyup', function () {
    const filter = this.value.toLowerCase();
    let anyVisible = false;

    options.forEach((option) => {
      const text = option.textContent.toLowerCase();
      if (text.includes(filter)) {
        noResultsOption.classList.add('hide');
        option.classList.remove('hide');
        anyVisible = true;
      } else {
        option.classList.add('hide');
      }
    });

    if (!anyVisible) {
      noResultsOption.classList.remove('hide');
    } else {
      noResultsOption.classList.add('hide');
    }
  });

  if (!formElement) return;
  formElement.querySelectorAll('.custom-select').forEach((item) => {
    item.addEventListener('click', function () {
      if (item.getAttribute('name') === 'address_city_segment') {
        showDropdownModal('city', placeholders, formElement, item);
      } else if (item.getAttribute('name') === 'area') {
        item.querySelector('.select-items').innerHTML = '';
        showDropdownModal('area', placeholders, formElement, item);
      }
      formElement.querySelector('.select-search').classList.remove('hide');
      // closeModal(addAddressModalId);
      const currentItems = this.parentNode.querySelector('.select-items');
      // Hide all other dropdowns
      document.querySelectorAll('.select-items').forEach((selectItem) => {
        if (selectItem !== currentItems) {
          selectItem.classList.add('select-hide');
        }
        selectItem.addEventListener('click', () => {
          formElement.querySelector('.select-search').classList.add('hide');
        });
      });
      // Toggle the clicked dropdown
      currentItems.classList.remove('select-hide');
      currentItems.parentNode.querySelector('.select-search')?.classList.toggle('hide');
    });
  });

  selectItemsTriggerModal(formElement);

  document.addEventListener('click', (e) => {
    if (!e.target.matches('.custom-select, .custom-select *')) {
      formElement.querySelectorAll('.select-items').forEach((item) => {
        item.classList.add('select-hide');
      });
      formElement.querySelector('.select-search').classList.add('hide');
    }
  });
}

// handleNoAddress
export function handleNoAddress() {
  const noAddress = document.querySelector('.account-no-address');
  noAddress?.classList.add('hide');
}

// Handling address hovering effect
export function handleAddressHover(addressWrapper) {
  const cta = addressWrapper.querySelector('.make-primary-cta');
  cta?.addEventListener('mouseover', () => {
    const addressFirstRow = cta.closest('.address').querySelector('.address-data');
    addressFirstRow?.classList.add('primary-address-data');
  });
  cta?.addEventListener('mouseout', () => {
    const addressFirstRow = cta.closest('.address').querySelector('.address-data');
    addressFirstRow?.classList.remove('primary-address-data');
  });

  const data = addressWrapper.querySelector('.address-data');
  data?.addEventListener('mouseover', () => {
    data.closest('.address').querySelector('.make-primary-cta')?.classList.add('hovered');
  });
  data?.addEventListener('mouseout', () => {
    data.closest('.address').querySelector('.make-primary-cta')?.classList.remove('hovered');
  });
}

// live search feature to a custom dropdown menu. As the user types in searchInput,
// the function filters the dropdown options, displaying only those that match the search term
// and showing a "No results" message if no matches are found
function enableDropdownSearch(dropdown) {
  if (!dropdown) return;
  const searchInput = dropdown?.querySelector('.select-search');
  const options = Array.from(dropdown?.querySelectorAll('.select-items div:not([disabled])'));
  const noResultsOption = dropdown?.querySelector('.no-results');
  const selectItemsContainer = dropdown.querySelector('.select-items');

  options.sort((a, b) => a.textContent.localeCompare(b.textContent));
  selectItemsContainer.innerHTML = '';
  options.forEach((option) => selectItemsContainer.appendChild(option));

  searchInput.addEventListener('keyup', function () {
    const filter = this.value.toLowerCase();
    let anyVisible = false;

    options.forEach((option) => {
      const text = option.textContent.toLowerCase();
      if (text.includes(filter)) {
        option.classList.remove('hide');
        anyVisible = true;
      } else {
        option.classList.add('hide');
      }
    });

    if (!anyVisible) {
      noResultsOption.classList.remove('hide');
    } else {
      noResultsOption.classList.add('hide');
    }
  });
}

async function updateArea(countryCode, cityValue, form, placeholders) {
  const areas = await getAddressAreas(countryCode, cityValue);
  const areaField = form.querySelector('#area');
  const areaSelect = areaField.querySelector('.select-selected');
  const areaItems = areaField.querySelector('.select-items');
  const initialAreaValue = areaSelect?.getAttribute('data-initial-value');
  areaItems.innerHTML = `<div data-value="" class="no-results hide">${placeholders.dropdownNoResultsFound || 'No Results Found'}</div>`;
  let selectedAreaLabel;

  areas.items?.forEach((area) => {
    if (area.location_id === Number(initialAreaValue)) {
      selectedAreaLabel = area.label;
    }
    const option = document.createElement('div');
    option.setAttribute('data-value', area.location_id);
    option.textContent = area.label;
    areaItems.appendChild(option);
  });
  areaField.querySelector('.select-items > div[disabled]')?.remove();
  enableDropdownSearch(areaField);
  // Reset the dropdown state
  if (dropdownLabelEnabled && areaSelect.querySelector('span')) {
    areaSelect.querySelector('span').textContent = selectedAreaLabel || placeholders.selectArea || 'Select Area';
  } else {
    areaSelect.innerHTML = selectedAreaLabel || placeholders.selectArea || 'Select Area';
  }
  areaSelect.dataset.value = initialAreaValue;

  if (!selectedAreaLabel) {
    areaSelect.setAttribute('data-initial-value', '');
    areaSelect.dataset.value = '';
  }

  // Clean up any existing event listeners
  const clonedAreaSelect = areaSelect.cloneNode(true);
  areaField.replaceChild(clonedAreaSelect, areaSelect);

  // Reinitialize the custom select box
  customSelectbox(form.querySelector('.input-field-wrapper.dropdown.area'));
}

function updateCity(regionValue, form, placeholders, cities, resetDefaultValue) {
  const cityField = form.querySelector('#address_city_segment');
  const citySelect = cityField.querySelector('.select-selected');
  if (resetDefaultValue) citySelect.setAttribute('data-initial-value', '');
  const cityItems = cityField.querySelector('.select-items');
  const initialCityValue = citySelect?.getAttribute('data-initial-value');
  cityItems.innerHTML = '';
  let selectedCityLabel;

  const regionSpecificCities = cities?.items?.filter((city) => city.parent_id === +regionValue);
  if (regionSpecificCities?.length) {
    regionSpecificCities.forEach((city) => {
      if (city.location_id === Number(initialCityValue)) {
        selectedCityLabel = city.label;
      }
      const option = document.createElement('div');
      option.setAttribute('data-value', city.location_id);
      option.textContent = city.label;
      cityItems.appendChild(option);
    });
  } else {
    cityItems.innerHTML = `<div data-value="" class="no-results">${placeholders.dropdownNoResultsFound || 'No Results Found'}</div>`;
  }

  cityField.querySelector('.select-items > div[disabled]')?.remove();
  enableDropdownSearch(cityField);

  // Reset the dropdown state
  citySelect.textContent = selectedCityLabel || placeholders.selectCity || 'Select City';
  citySelect.dataset.value = initialCityValue;

  // Clean up any existing event listeners
  const clonedCitySelect = citySelect.cloneNode(true);
  cityField.replaceChild(clonedCitySelect, citySelect);

  // Reinitialize the custom select box
  customSelectbox(form.querySelector('.input-field-wrapper.dropdown.address_city_segment'));
}

// Hide the 'new-address-container' element by adding the 'hide' class
export function hideNewAddressCta() {
  const newAddressContainer = document.querySelector('.new-address-container');
  newAddressContainer?.classList.add('hide');
}

// populating city in address form
async function populateCity(form, citySegments, countryCode, placeholders) {
  const cityField = form.querySelector('#address_city_segment');
  const initialCityValue = cityField?.querySelector('.select-selected')?.getAttribute('data-initial-value');
  let selectedCityLabel;
  if (cityField && citySegments) {
    citySegments.items?.forEach((segment) => {
      if (segment.location_id === Number(initialCityValue)) {
        selectedCityLabel = segment.label;
      }
    });
    cityField.querySelector('.select-items > div[disabled]')?.remove();
  }
  if (selectedCityLabel) {
    const getElem = cityField.querySelector('.select-selected');
    if (dropdownLabelEnabled && getElem.querySelector('span')) {
      getElem.querySelector('span').textContent = selectedCityLabel;
    } else {
      getElem.innerHTML = selectedCityLabel;
    }
  }

  if (cityField) {
    enableDropdownSearch(cityField);
    cityField.value = initialCityValue;
    cityField.querySelectorAll('.select-items div').forEach((item) => {
      item.addEventListener('click', async (event) => {
        await updateArea(countryCode, event.target.getAttribute('data-value'), form, placeholders);
      });
    });
  }
  if (initialCityValue) {
    await updateArea(countryCode, cityField.value, form, placeholders);
  } else {
    customSelectbox(form.querySelector('.input-field-wrapper.dropdown.area'));
  }
}

// populating city in address form
async function populateRegions(form, regionSegments, countryCode, placeholders) {
  const cities = await getAddressCitySegments(countryCode);
  const regionField = form.querySelector('#address_region_segment');
  const initialRegionValue = regionField?.querySelector('.select-selected')?.getAttribute('data-initial-value');

  const regionItems = regionField.querySelector('.select-items');
  regionItems.innerHTML = `<div data-value="" class="no-results hide">${placeholders.dropdownNoResultsFound || 'No Results Found'}</div>`;

  let selectedCityLabel;
  if (regionField && regionSegments) {
    regionSegments.items?.forEach((segment) => {
      if (segment.location_id === Number(initialRegionValue)) {
        selectedCityLabel = segment.label;
      }

      const option = document.createElement('div');
      option.setAttribute('data-value', segment.location_id);
      option.textContent = segment.label;
      regionItems.appendChild(option);
    });
    regionField.querySelector('.select-items > div[disabled]')?.remove();
  }
  if (selectedCityLabel) {
    regionField.querySelector('.select-selected').textContent = selectedCityLabel;
  }
  if (regionField) {
    enableDropdownSearch(regionField);
    regionField.value = initialRegionValue;
    regionField.querySelectorAll('.select-items div').forEach((item) => {
      item.addEventListener('click', async (event) => {
        await updateCity(event.target.getAttribute('data-value'), form, placeholders, cities, true);
      });
    });
  }
  setTimeout(() => {
    updateCity(regionField.value, form, placeholders, cities, false);
  });
  customSelectbox(form.querySelector('.input-field-wrapper.dropdown.address_region_segment'));
}

// to set country code
function setCountryCode(form, countryCode) {
  const countryId = form.querySelector('#country_id');
  if (countryId) {
    countryId.value = countryCode;
    countryId.disabled = true;
  }
}

// to set telephone input
function createTelephoneInput(
  countryCode,
  maxLength,
  countryPrefix,
  fieldDiv,
  name,
  label,
  isRequired,
  value,
  isCheckoutPage,
  updateOnlyTelephone,
  infoMessage,
) {
  const pattern = '[0-9]*';
  fieldDiv.classList.add('phonevalidation');
  fieldDiv.innerHTML = `
  <div class="input-wrapper input-field input-phone-prefix">
    <label for="countrycode" class="countrycode hidden">${countryPrefix}</label>
    <input type="tel" id="${name}" name="${name}" data-phone-prefix="${countryPrefix}" aria-label="${label}" placeholder=" " value="${value}" ${isRequired ? 'required' : ''} pattern='${pattern}' maxlength='${maxLength}'>
    ${isCheckoutPage && updateOnlyTelephone ? `<span class='spc-type-tel__message'>${infoMessage}</span>` : ''}
     <label for="${name}" class="input-label">${label}</label>
    </div>`;

  // Function to handle country code visibility based on phone number input
  function updateCountryCodeVisibility(inputElement) {
    const addressModalClosest = inputElement?.closest('.add-address-modal, .edit-address-modal, .checkout-form');
    const countryCodeLabel = addressModalClosest?.querySelector('.countrycode');
    if (countryCodeLabel) {
      const isNumeric = /^\d*$/.test(inputElement.value.trim()) && inputElement.value.trim();
      countryCodeLabel.classList.toggle('hidden', !isNumeric);
    }
  }

  // Event listener to handle input events and focus events dynamically
  document.addEventListener('input', (event) => {
    if (event.target && event.target.id === 'telephone') {
      updateCountryCodeVisibility(event.target);
    }
  });

  // Handle initial visibility on focus (when editing existing numbers)
  document.addEventListener('focus', (event) => {
    if (event.target && event.target.id === 'telephone') {
      updateCountryCodeVisibility(event.target);
    }
  }, true);

  // Handle initial visibility when the modal or form is opened
  function handleInitialCheck() {
    const telephone = document.querySelector('#telephone');
    if (telephone) {
      updateCountryCodeVisibility(telephone);
    }
  }

  handleInitialCheck();
}

function getSelectedLabel(countryCode, field) {
  return field.attribute.options?.find(
    (option) => option.value === countryCode,
  )?.label || countryCode;
}

function getSelectedValue(countryCode, field) {
  return field.attribute.options?.find(
    (option) => option.value === countryCode,
  )?.value || countryCode;
}

function handleCheckoutFormStructure(formStructure, isLoggedIn, countryCode, placeholders) {
  // Helper function to add a field after a specific attribute code
  const addFieldAfterAttributeCode = (attributeCode, newField, offset) => {
    const fieldIndex = formStructure.findIndex(
      (field) => field.attribute.attribute_code === attributeCode,
    );
    if (fieldIndex !== -1) {
      formStructure.splice(fieldIndex + offset, 0, newField);
    }
  };

  // Find the telephone field and add the email field after it
  const telephoneFieldIndex = formStructure.findIndex((field) => field.attribute.attribute_code === 'telephone');
  if (telephoneFieldIndex !== -1 && !isLoggedIn) {
    const emailField = JSON.parse(JSON.stringify(formStructure[telephoneFieldIndex]));
    emailField.attribute.attribute_code = 'email';
    emailField.attribute.store_label = placeholders.email || 'Email';
    emailField.attribute.frontend_input = 'text';
    emailField.attribute.required = true;

    addFieldAfterAttributeCode('telephone', emailField, countryCode === 'KW' ? -1 : 1);
  }
}

function restructureForm(form) {
  const brand = getBrandCode();
  if (brand === 'bat') {
    form.querySelector('.input-field-wrapper label[for="email"]').closest('.input-field-wrapper').classList.add('emailValidation');
    const phoneDiv = form.querySelector('.input-field-wrapper.phonevalidation');
    const emailDiv = form.querySelector('.input-field-wrapper.emailValidation');
    const city = form.querySelector('.input-field-wrapper.dropdown.address_city_segment');
    const area = form.querySelector('.input-field-wrapper.dropdown.area');
    wrapTwoDivsinWrapper(phoneDiv, emailDiv, 'form__phone-email-wrapper');
    wrapTwoDivsinWrapper(city, area, 'form__city-area-wrapper');
  }
}

// to show address form
export async function showAddressForm(
  $parent,
  placeholders,
  addressObj,
  newCustomer = false,
  isCheckoutPage = false,
  isLoggedIn = false,
  config = {},
  updateOnlyTelephone = false,
  infoMessage = '',
  isTopup = false,
) {
  if (isCheckoutPage) {
    window.dispatchEvent(new CustomEvent('react:addressFormLoading'));
  }
  const countryCode = await getConfigValue('country-code');
  const addressesContainer = document.querySelector('.addresses-container');

  /*
  Filtering landmark and address_apartment_segment for EG for now from UI.
  Once it's handled on backend, this code needs to be removed.
  OLD CODE : const formStructure = await getDeliveryMatrixAddressStructure(countryCode);
  */
  const formStructureAll = await getDeliveryMatrixAddressStructure(countryCode);
  const excludedAttributes = ['landmark', 'address_apartment_segment'];
  const filteredFormStructure = formStructureAll.filter(
    (item) => !(item?.country_id === 'EG' && excludedAttributes.includes(item?.attribute?.attribute_code)),
  );
  const formStructure = [...filteredFormStructure];

  const isUpdate = Object.keys(addressObj).length > 0;
  const block = $parent.closest('.account-address-book');
  const maxLength = await getMaxLengthByCountryCode(countryCode);
  const countryPrefix = `+${await getCountryIso(countryCode)}`;
  const showArea = countryCode === 'KW';

  const form = document.createElement('form');
  let cityDefaultLabel = placeholders.selectCity || 'Select City';
  let areaDefaultLabel = placeholders.selectArea || 'Select Area';

  const firstnameField = formStructure?.find((d) => d?.attribute?.attribute_code === 'firstname');
  if (firstnameField) {
    firstnameField.sort_order = '0';
  }
  formStructure.sort((a, b) => {
    if (Number(a.sort_order) < Number(b.sort_order)) return -1;
    if (Number(a.sort_order) > Number(b.sort_order)) return 1;
    return 0;
  });

  if (isCheckoutPage) {
    handleCheckoutFormStructure(formStructure, isLoggedIn, countryCode, placeholders);
  }

  const checkoutRequiredFields = ['address_building_segment', 'address_block_segment'];

  formStructure
    .filter((field) => field.visible === '1' && field.attribute.attribute_code !== 'lastname')
    .forEach(async (field) => {
      if (['firstname', 'lastname', 'telephone'].includes(field.attribute.attribute_code)) {
        field.attribute.required = true;
      }
      const rules = countryRules[field.country_id];
      if (rules) {
        if (rules.required.includes(field.attribute.attribute_code)) {
          field.attribute.required = true;
        } else if (rules.notRequired.includes(field.attribute.attribute_code)) {
          field.attribute.required = false;
        }
      }
      const fieldDiv = document.createElement('div');
      fieldDiv.classList.add('input-field-wrapper');
      let isDisabled = false;
      if (isCheckoutPage && updateOnlyTelephone && field.attribute.attribute_code !== 'telephone') {
        fieldDiv.classList.add('address-form-field-disabled');
        isDisabled = true;
      }
      const validations = [];

      const isRequiedInCheckout = isCheckoutPage
        ? checkoutRequiredFields.includes(field.attribute.attribute_code) : false;
      if (field.attribute.required || isRequiedInCheckout) {
        validations.push('required');
      }

      field.attribute.validation_rules?.forEach((rule) => {
        if (rule.name === 'min_text_length') {
          validations.push(`minlength="${rule.value}"`);
        } else if (rule.name === 'max_text_length') {
          validations.push(`maxlength="${rule.value}"`);
        }
      });

      if (field.attribute.attribute_code === 'telephone') {
        createTelephoneInput(countryCode, maxLength, countryPrefix, fieldDiv, field.attribute.attribute_code, field.attribute.store_label, field.attribute.required, addressObj?.[field.attribute.attribute_code] ? addressObj[field.attribute.attribute_code].replace(countryPrefix, '') : '', isCheckoutPage, updateOnlyTelephone, infoMessage);
      } else if (field.attribute.frontend_input === 'text') {
        let textInputValue = addressObj?.[field.attribute.attribute_code];
        let label = field.attribute.store_label;
        let attributeCode = field.attribute.attribute_code;
        if (field.attribute.attribute_code === 'firstname') {
          textInputValue = textInputValue ? `${textInputValue} ${addressObj?.lastname ?? ''}` : '';
          label = placeholders.fullname || 'Full Name';
          attributeCode = 'fullName';
        }
        fieldDiv.innerHTML = `
          <div class="input-wrapper input-field">
            <input type="text" id="${attributeCode}" name="${attributeCode}" aria-label="${label}" 
            placeholder=" " 
            ${isDisabled ? 'disabled' : ''}
            value="${sanitizeDOMSync(textInputValue || '')}" 
            ${field.attribute.attribute_code === 'firstname' ? 'pattern="^\\p{L}+(?:\\s\\p{L}+)+\\s?$"' : ''}
            ${field.attribute.attribute_code === 'email' ? 'pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"' : ''}
            ${validations.join(' ')}>
            <label for="${attributeCode}">${label}</label>
          </div>
      `;
      } else if (field.attribute.frontend_input === 'select') {
        const defaultLabelContent = field.attribute?.attribute_code === 'country_id'
          ? getSelectedLabel(countryCode, field)
          : `${field.attribute.store_label}`;
        const defaultLabelContentValue = field.attribute?.attribute_code === 'country_id'
          ? getSelectedValue(countryCode, field)
          : `${field.attribute.store_label}`;
        if (field.attribute?.attribute_code === 'city') {
          cityDefaultLabel = defaultLabelContent;
        } else if (field.attribute?.attribute_code === 'area') {
          areaDefaultLabel = defaultLabelContent;
        }
        const classesToAdd = ['dropdown', 'notransistion', field.attribute.attribute_code];

        if (isCheckoutPage && field.attribute.attribute_code === 'country_id') {
          classesToAdd.push('hidden');
        }
        fieldDiv.classList.add(...classesToAdd);
        fieldDiv.innerHTML = `
        <div class="input-wrapper input-field">
          <div class="custom-select" id="${field.attribute.attribute_code}" name="${field.attribute.attribute_code}" aria-label="${field.attribute.store_label}" ${validations.join(' ')}>
            <div class="select-selected${field.attribute.attribute_code === 'country_id' || isDisabled ? ' disabled' : ''}" data-value="${field.attribute.attribute_code === 'country_id' ? defaultLabelContentValue : ''}">${defaultLabelContent}</div>
            <input type="text" class="select-search hide ${isCheckoutPage && 'hideSearch'}" placeholder="${isCheckoutPage && field.attribute.attribute_code !== 'country_id' ? defaultLabelContent : ''}">
            <div class="select-items select-hide">
              <div data-value="" class="no-results ${field.attribute.attribute_code === 'area' && !showArea ? '' : 'hide'}">${placeholders.dropdownNoResultsFound || 'No Results Found'}</div>
              ${field.attribute.attribute_code === 'area' && !showArea ? '' : field.attribute.options?.filter((option) => option.label !== 'Select an option')
    .map((option) => `<div data-value="${option.value}" ${addressObj?.[field.attribute.attribute_code] === option.value ? 'selected' : ''}>${option.label}</div>`)
    .join('')}
            </div>
          </div>
        </div>
      `;

        field.attribute.options?.map((option) => `<div data-value="${option.value}">${option.label}</div>`);
      } else if (field.attribute.frontend_input === 'multiline') {
        const rows = field.attribute.multiline_count ? `rows="${field.attribute.multiline_count}"` : '';
        fieldDiv.innerHTML = `
          <div class="input-field-wrapper">
            <div class="input-wrapper input-field">
              <textarea id="${field.attribute.attribute_code}" name="${field.attribute.attribute_code}" aria-label="${field.attribute.store_label}" placeholder=" " ${validations.join(' ')} ${rows}  ${isDisabled ? 'disabled' : ''}>${sanitizeDOMSync(addressObj?.[field.attribute.attribute_code] || '')}</textarea>
              <label for="${field.attribute.attribute_code}">${field.attribute.store_label}</label>
            </div>
          </div>
        `;
      }

      const customAttributeFields = ['area', 'address_region_segment', 'address_building_segment',
        'address_apartment_segment', 'address_city_segment', 'address_block_segment',
        'address', 'address_floor_segment', 'address_landmark_segment',
      ];
      if (customAttributeFields.indexOf(field.attribute.attribute_code) !== -1) {
        let value = addressObj.custom_attributes?.find((attr) => attr.attribute_code === field.attribute.attribute_code)?.value || '';
        if (field?.attribute?.required === true && field?.attribute?.frontend_input === 'select') {
          value = (field?.attribute?.options.some((option) => String(option.value) === value) === true) ? value : '';
        }

        const inputField = fieldDiv.querySelector('input, .select-selected, textarea');
        inputField.value = value;
        inputField.setAttribute('data-initial-value', value);
      }
      form.appendChild(fieldDiv);
    });
  let submitButtonLabel = placeholders.addAddress || 'Add Address';
  if (isUpdate || isCheckoutPage) {
    submitButtonLabel = placeholders.save || 'Save';
  }

  const addressFormButtons = isCheckoutPage
    ? `<div class="address-form-button-wrapper">
        <button type="submit" class="address-submit-button address-form-button" aria-label="${submitButtonLabel}"><span>${submitButtonLabel}</span></button>
      </div>`
    : `<div class="address-form-button-wrapper">
        <button type="submit" class="address-submit-button address-form-button" aria-label="${submitButtonLabel}"><span>${submitButtonLabel}</span></button>
        <button type="button" class="address-cancel-button secondary address-form-button" aria-label="${placeholders.cancel || 'Cancel'}">${placeholders.cancel || 'Cancel'}</button>
      </div>`;

  form.insertAdjacentHTML('beforeend', addressFormButtons);

  if (isCheckoutPage) {
    restructureForm(form);
  }

  form.noValidate = true;
  setCountryCode(form, countryCode);

  if (countryCode === 'EG') {
    const regionSegments = await getAddressRegionSegments(countryCode);
    await populateRegions(form, regionSegments, countryCode, placeholders);
  } else {
    const citySegments = await getAddressCitySegments(countryCode);
    await populateCity(form, citySegments, countryCode, placeholders);
  }

  if (showArea) {
    updateArea(countryCode, '', form, placeholders);
  }

  form.querySelectorAll('input, .custom-select, textarea').forEach((input) => {
    setErrorMessageForField(input, placeholders);
    input.addEventListener('input', () => {
      validateInput(input);
    });
  });

  form.querySelectorAll('.custom-select').forEach((dropdown) => {
    setErrorMessageForField(dropdown, placeholders);
    dropdown.addEventListener('click', (event) => {
      event.stopPropagation();
      const mainBox = event.target.closest('.custom-select');
      const selectionBox = mainBox.querySelector('.select-selected');
      if (!selectionBox.getAttribute('data-value')) {
        let errorMessage = placeholders.addAddressSelectError || `Please select ${dropdown.getAttribute('aria-label')}`;
        errorMessage = errorMessage.replace('{{label}}', dropdown.getAttribute('aria-label'));
        showErrorMessage(mainBox, errorMessage);
      } else {
        resetMessage(mainBox);
      }
    });
  });

  const phoneInput = form.querySelector('#telephone');
  phoneInput.addEventListener('input', async (event) => {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
    if (event.target.value.length >= phoneInput.maxLength) {
      const isValidPhoneNumber = await validatePhone(
        phoneInput.value,
        countryCode,
      );
      let phoneErrorMessage = placeholders.invalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneErrorMessage = phoneErrorMessage.replace('{{mobile}}', phoneInput.value);

      if (!isValidPhoneNumber) {
        showErrorMessage(phoneInput, phoneErrorMessage);
      }
    }
  });

  const addressCancelButton = form.querySelector('.address-cancel-button');
  addressCancelButton?.addEventListener('click', () => {
    if (newCustomer) {
      $parent?.firstChild?.querySelectorAll('input, textarea').forEach((input) => {
        input.value = '';
      });
      document.querySelector('.dropdown.address_city_segment .select-selected').textContent = cityDefaultLabel;
      document.querySelector('.dropdown.area .select-selected').textContent = areaDefaultLabel;
    } else {
      $parent?.classList.add('hide');
    }
    window.scrollTo(0, 0);
  });

  const addressSubmitButton = form.querySelector('.address-submit-button');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const phoneValue = phoneInput.value;
    let isValidPhoneNumber = false;
    let phoneNumLengthError = false;
    const phoneValidationPromise = validatePhone(phoneValue, countryCode)
      .then((result) => {
        isValidPhoneNumber = result;
      })
      .catch(() => {
        phoneNumLengthError = true;
      });

    const isFormValid = validateForm(form, placeholders, isCheckoutPage);
    await phoneValidationPromise;
    if (!isValidPhoneNumber || phoneNumLengthError) {
      let phoneNumberErrorMessage = placeholders.invalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneNumberErrorMessage = phoneNumberErrorMessage.replace('{{mobile}}', phoneInput.value);
      showErrorMessage(phoneInput, phoneNumberErrorMessage);
    }
    if (!isValidPhoneNumber || phoneNumLengthError || !isFormValid) {
      return;
    }

    addressSubmitButton.classList.add('loader');

    if (isCheckoutPage && !isLoggedIn) {
      const emailInput = form.querySelector('#email');
      const responseData = await validateCustomerEmail(emailInput.value);
      if (responseData?.customerExists) {
        const emailErrorMessage = placeholders.emailExist || 'You already have an account. Please log in.';
        showErrorMessage(emailInput, emailErrorMessage, true);
        dataLayerCustomerExistCheckoutErrors();
        addressSubmitButton.classList.remove('loader');
        return;
      }
      emailInput.classList.remove('error');
    }

    const address = {};
    const baseCustomAttributeNames = [
      'address_city_segment',
      ...(countryCode === 'EG' ? ['address_region_segment'] : ['area']),
      'address_building_segment',
      'address_apartment_segment',
      ...(countryCode === 'EG' ? ['address_floor_segment'] : []),
      ...(countryCode === 'EG' ? ['address_landmark_segment'] : []),
      'address',
    ];

    if (showArea) {
      baseCustomAttributeNames.push('address_block_segment');
    }

    const customAttributeNames = new Set(baseCustomAttributeNames);
    const inputs = form.querySelectorAll('input, .custom-select, textarea');

    inputs.forEach((input) => {
      const name = input?.getAttribute('name');
      if (!name) return;

      let key = name;
      let value = sanitizeDOMSync(input.value?.trim() || '');

      switch (name) {
        case 'country_id':
          key = 'country_code';
          break;

        case 'address_city_segment':
        case 'address_region_segment':
        case 'area': {
          const selected = input.querySelector('.select-selected');
          const dataValue = selected?.getAttribute('data-value') || '';
          const dataInitialValue = selected?.getAttribute('data-initial-value') || '';
          value = input.classList.contains('custom-select')
            ? dataValue || dataInitialValue
            : value;

          if (name === 'address_city_segment') {
            address.city = isCheckoutPage ? (dataValue || dataInitialValue || '-') : (dataValue || '-');
          } else if (name === 'address_region_segment') {
            address.region = isCheckoutPage ? (dataValue || dataInitialValue || '-') : (dataValue || '-');
          }
          break;
        }

        case 'fullName': {
          const [firstName = '', ...rest] = value.split(/\s+/);
          address.firstname = firstName;
          address.lastname = rest.join(' ');
          return;
        }

        case 'telephone':
          address.telephone = `${countryPrefix}${value}`;
          return;

        default:
          break;
      }

      if (customAttributeNames.has(name)) {
        address.custom_attributes = address.custom_attributes || [];
        address.custom_attributes.push({
          attribute_code: key,
          value,
        });
      } else {
        address[key] = value;
      }
    });

    // Due to out of the box validations for commerce we have to
    // send City attribute explicitly, It is not required at alshaya
    if (countryCode === 'KW') address.city = 'city';

    // Sending null at region due to magento mapping
    if (countryCode === 'EG') address.region = null;

    let res = null;
    let message;
    if (isUpdate && !isCheckoutPage) {
      res = await updateAddress(addressObj.id, address);
      if (res?.success) {
        message = placeholders.addressUpdated || 'Address is updated successfully.';
      }
    } else if (isCheckoutPage) {
      if (isLoggedIn && !isTopup) {
        delete address.address;
        if (isUpdate) {
          const response = await updateAddress(addressObj.id, address, config);
          address.id = response?.data?.commerce_updateCustomerAddress?.id;
          address.street = response?.data?.commerce_updateCustomerAddress?.street;
        } else {
          const response = await createAddress(address, config);
          address.id = response?.data?.commerce_createCustomerAddress?.id;
          address.street = response?.data?.commerce_createCustomerAddress?.street;
        }
      }
      window.dispatchEvent(new CustomEvent('react:addressFormSubmitted', { detail: { address, isUpdate } }));
    } else {
      res = await createAddress(address);
      if (res?.success) {
        message = placeholders.addressAdded || 'Address is added successfully.';
      }
    }
    if (res?.success) {
      block.dispatchEvent(new CustomEvent('address-updated'));
      addressesContainer.classList.remove('hide');
      $parent.classList.add('hide');
      document.querySelector('.new-address-container').classList.remove('hide');
      addStatusMessage(message);
    }
  });

  decorateIcons(form);
  if (!isCheckoutPage) {
    customSelectbox(form.querySelector('.input-field-wrapper.dropdown.country_id'));
  }
  if (countryCode !== 'EG') customSelectbox(form.querySelector('.input-field-wrapper.dropdown.address_city_segment'));
  $parent.innerHTML = '';
  if (isCheckoutPage && getBrandCode() === 'bat') {
    const formDiv = document.createElement('div');
    formDiv.append(form);
    formDiv.classList.add('address-form', 'checkout-form');
    $parent.appendChild(formDiv);
  } else {
    $parent.appendChild(form);
  }
  if (isCheckoutPage) {
    window.dispatchEvent(new CustomEvent('react:addressFormLoaded'));
    if (isUpdate) validateForm(form, placeholders, isCheckoutPage);
  }
  $parent.classList.remove('hide');
}

// to shoe address form for new customer
function handleNewCustomer(placeholders, addressesContainer) {
  const addressForm = document.querySelector('.address-form');
  showAddressForm(addressForm, placeholders, {}, true);
  addressesContainer.classList.add('hide');
  hideNewAddressCta();
}

async function showDeleteAddressModal(addressId, placeholders, addressesContainer) {
  const deleteTitle = placeholders.deleteAddressModalTitle || 'Delete Address';
  const deleteContent = document.createElement('div');
  deleteContent.classList.add('delete-content');

  deleteContent.innerHTML = `<span class="delete-title">${placeholders.deleteAddressModalTitle || 'Delete Address'}</span>
    <span class="delete-message">${placeholders.deleteAddressModalMessage || 'You have selected to delete this address, are you sure?'}</span>
    <div class="delete-buttons">
      <button class="delete-cancel secondary" aria-label="${placeholders.deleteAddressCancel || 'No'}">${placeholders.deleteAddressCancel || 'No'}</button>
      <button class="delete-confirm" aria-label="${placeholders.deleteAddressConfirm || 'Yes'}">${placeholders.deleteAddressConfirm || 'Yes'}</button>
    </div>`;
  await createModalFromContent('delete-address-modal', deleteTitle, deleteContent.outerHTML, ['delete-address-modal'], 'trash', false, 'icon-close-black');

  document.querySelector('.delete-address-modal .delete-cancel').addEventListener('click', () => {
    closeModal('delete-address-modal');
  });

  document.querySelector('.delete-address-modal .delete-confirm').addEventListener('click', async () => {
    closeModal('delete-address-modal');
    const res = await deleteAddress(addressId);
    if (res?.success) {
      const message = placeholders.addressDeleted || 'Address is deleted successfully.';
      addStatusMessage(message);
      const block = addressesContainer.closest('.account-address-book');
      block?.dispatchEvent(new CustomEvent('address-updated'));
    }
  });
  openModal('delete-address-modal');
}

const displayAddressList = async function (addressForm, addressesContainer, placeholders) {
  addressesContainer.innerHTML = '';
  const countryCode = await getConfigValue('country-code');
  const customerPromise = getCustomer(false);
  const citySegmentsPromise = getAddressCitySegments(countryCode);
  const regionSegmentsPromise = getAddressRegionSegments(countryCode);
  const areasPromise = getAddressAreas(countryCode);
  const formStructurePromise = getDeliveryMatrixAddressStructure(countryCode);

  const [customer, citySegments, regionSegments, areas,
    formStructure] = await Promise.all([customerPromise,
    citySegmentsPromise,
    regionSegmentsPromise,
    areasPromise,
    formStructurePromise,
  ]);

  const country = formStructure
    .find((field) => field.visible === '1' && field?.attribute?.attribute_code === 'country_id')
    ?.attribute?.options?.find((option) => option.value === countryCode)?.label;
  if (customer?.addresses?.length < 1) {
    handleNewCustomer(placeholders, addressesContainer);
    return;
  }
  customer?.addresses.sort((a, b) => (b.default_billing === true) - (a.default_billing === true));
  customer?.addresses?.forEach((address) => {
    const addressWrapper = document.createElement('div');
    addressWrapper.classList.add('address-wrapper');

    const addressDiv = document.createElement('div');
    addressDiv.classList.add('address');

    const editAddressHtml = `<div class="edit-address-cta-wrapper">
     <a href="#" class="edit-address-cta" aria-label="${placeholders.edit || 'Edit'}"><span>${placeholders.edit || 'Edit'}</span></a>
    </div>`;

    const city = citySegments.items
      ?.find((item) => item.location_id === Number(address.custom_attributes?.find((attr) => attr.attribute_code === 'address_city_segment')?.value))?.label;

    const area = areas.items
      ?.find((item) => item.location_id === Number(address.custom_attributes?.find((attr) => attr.attribute_code === 'area')?.value))?.label;

    const region = regionSegments.items
      ?.find((item) => item.location_id === Number(address.custom_attributes?.find((attr) => attr.attribute_code === 'address_region_segment')?.value))?.label;

    const buildingName = sanitizeDOMSync(address.custom_attributes?.find((attr) => attr.attribute_code === 'address_building_segment')?.value);
    const apartment = sanitizeDOMSync(address.custom_attributes?.find((attr) => attr.attribute_code === 'address_apartment_segment')?.value);

    const countrySpan = country ? `<span>${country}</span>` : '';
    const citySpan = city ? `<span>${city}</span>` : '';
    const areaSpan = area ? `<span>${area}</span>` : '';
    const regionSpan = region ? `<span>${region}</span>` : '';
    const buildingSpan = buildingName ? `<span>${buildingName}</span>` : '';
    const apartmentSpan = apartment ? `<span>${apartment}</span>` : '';

    const addressContent = `
      <div class="address-data ${address.default_billing || customer.addresses.length === 1 ? 'primary-address-data' : ''}">
        <div class="address-userinfo">
          <div class="address-section col-1 deliveryTo">
            <p class="label"><span>${placeholders.deliveryTo || 'Delivery To'}</span></p>
            <p class="address-value"><span>${address.firstname} ${address.lastname}</span></p>
          </div>
          <div class="address-section col-1 contact-number">
            <p class="label"><span>${placeholders.contactNumber || 'Contact Number'}</span></p>
            <p class="address-value"><span>${address.telephone}</span></p>
          </div>
        </div>
        <div class="address-section address-line">
          <p class="label"><span>${placeholders.deliveryAddress || 'Delivery Address'}</span></p>
          <p class="address-value">
          ${countrySpan}
          ${citySpan}${areaSpan}${regionSpan}
          <span>${sanitizeDOMSync(address.street)}</span>${buildingSpan}${apartmentSpan}
          </p>
        </div>
      </div>
      ${address.default_billing ? `
        <div class="address-section cta-container primary-address-cta-container">
          <div class="primary-address-cta-wrapper">
          <span class="icon icon-radio-active"></span>
          <span>${placeholders.primaryAddress || 'Primary Address'}</span>
          </div>
          ${editAddressHtml}
        </div>` : `
        <div class="address-section cta-container address-cta-container">
          <div class="make-primary-cta-wrapper">
          <span class="icon icon-radio-active hovericon"></span>
          <span class="icon icon-radio-icon"></span>
          <a class="make-primary-cta" aria-label="${placeholders.makePrimary || 'Make Primary'}"><span>${placeholders.makePrimary || 'Make Primary'}</span></a>
          </div>
          ${editAddressHtml}
        <div class="delete-address-cta-wrapper">
          <a href="#" class="delete-address-cta" aria-label="${placeholders.delete || 'Delete'}"><span>${placeholders.delete || 'Delete'}</span></a>
        </div>`
}`;

    addressDiv.innerHTML = addressContent;
    addressWrapper.appendChild(addressDiv);
    decorateIcons(addressWrapper);

    const editButton = addressWrapper.querySelector('.edit-address-cta');
    if (editButton) {
      editButton.addEventListener('click', async () => {
        editButton.classList.add('loader');
        await showAddressForm(addressForm, placeholders, address);
        editButton.classList.remove('loader');
      });
    }

    const deleteButton = addressWrapper.querySelector('.delete-address-cta');
    deleteButton?.addEventListener('click', async () => {
      await showDeleteAddressModal(address.id, placeholders, addressesContainer);
    });

    const makePrimaryButton = addressWrapper.querySelector('.make-primary-cta-wrapper');
    makePrimaryButton?.addEventListener('click', async () => {
      const res = await makePrimaryAddress(address.id);
      if (res?.success) {
        const message = placeholders.primaryAddressUpdated || 'Primary address is updated successfully.';
        addStatusMessage(message, placeholders);
        const block = addressWrapper.closest('.account-address-book');
        block?.dispatchEvent(new CustomEvent('address-updated'));
      }
    });
    handleAddressHover(addressWrapper);
    addressesContainer.appendChild(addressWrapper);
    const addressSubmitButton = document.querySelector('.address-submit-button');
    addressSubmitButton?.classList.remove('hide');
  });
};

export default async function decorate(block) {
  const placeholders = await fetchPlaceholdersForLocale();

  // Clear the initial HTML
  block.innerHTML = '';

  const newAddressContainer = document.createElement('div');
  newAddressContainer.classList.add('new-address-container');
  const newAddressWrapper = document.createElement('div');
  newAddressWrapper.classList.add('new-address-wrapper');
  newAddressContainer.appendChild(newAddressWrapper);
  const plusButton = '<span class="icon icon-plus-big"></span>';
  newAddressWrapper.insertAdjacentHTML('afterbegin', plusButton);
  decorateIcons(newAddressWrapper);

  const newAddressLinkHtml = `<a class="new-address" aria-label="${placeholders.addNewAddress || 'Add New Address'}" href="#">${placeholders.addNewAddress || 'Add New Address'}</a>`;
  newAddressWrapper.insertAdjacentHTML('beforeend', newAddressLinkHtml);

  block.parentElement.previousSibling.firstChild.insertAdjacentElement('afterend', newAddressContainer);
  let newAddressLink = document.querySelector('.new-address');
  if (window.innerWidth < 768) {
    newAddressLink = document.querySelector('.new-address-wrapper');
  }
  const addressForm = document.createElement('div');
  addressForm.classList.add('address-form');
  block.appendChild(addressForm);
  newAddressLink.addEventListener('click', async (event) => {
    event.preventDefault();
    showAddressForm(addressForm, placeholders, {});
  });
  // Create addresses container
  const addressesContainer = document.createElement('div');
  addressesContainer.classList.add('addresses-container');
  await displayAddressList(addressForm, addressesContainer, placeholders);
  block.appendChild(addressesContainer);
  block.addEventListener('address-updated', async () => {
    await displayAddressList(addressForm, addressesContainer, placeholders);
  });
}

// to show address form
export async function showAddressFormModal(
  $parent,
  placeholders,
  addressObj,
  newCustomer = false,
  isCheckoutPage = false,
  isLoggedIn = false,
  config = {},
  updateOnlyTelephone = false,
  infoMessage = '',
  isTopup = false,
) {
  if (isCheckoutPage) {
    window.dispatchEvent(new CustomEvent('react:addressFormLoading'));
  }
  const countryCode = await getConfigValue('country-code');
  const addressesContainer = document.querySelector('.addresses-container');
  const formStructure = await getDeliveryMatrixAddressStructure(countryCode);
  const citySegments = await getAddressCitySegments(countryCode);
  const isUpdate = Object.keys(addressObj).length > 0;
  const block = $parent.closest('.account-address-book');
  const maxLength = await getMaxLengthByCountryCode(countryCode);
  const countryPrefix = `+${await getCountryIso(countryCode)}`;
  const showArea = countryCode === 'KW';
  const form = document.createElement('form');
  let cityDefaultLabel = placeholders.selectCity || 'Select City';
  let areaDefaultLabel = placeholders.selectArea || 'Select Area';
  // Retrieve the email from session storage
  const email = sessionStorage.getItem('loginEmail') || '';
  // Variable to track if the email field has been added
  let emailFieldAdded = false;

  if (isCheckoutPage) {
    handleCheckoutFormStructure(formStructure, isLoggedIn, countryCode);
  }

  const checkoutRequiredFields = ['address', 'address_building_segment'];

  formStructure
    .filter((field) => field.visible === '1' && field.attribute.attribute_code !== 'lastname')
    .forEach(async (field) => {
      if (['firstname', 'lastname', 'telephone'].includes(field.attribute.attribute_code)) {
        field.attribute.required = true;
      }
      const rules = countryRules[field.country_id];
      if (rules) {
        if (rules.required.includes(field.attribute.attribute_code)) {
          field.attribute.required = true;
        } else if (rules.notRequired.includes(field.attribute.attribute_code)) {
          field.attribute.required = false;
        }
      }
      const fieldDiv = document.createElement('div');
      fieldDiv.classList.add('input-field-wrapper');
      let isDisabled = false;
      if (isCheckoutPage && updateOnlyTelephone && field.attribute.attribute_code !== 'telephone') {
        fieldDiv.classList.add('address-form-field-disabled');
        isDisabled = true;
      }
      const validations = [];

      const isRequiedInCheckout = isCheckoutPage
        ? checkoutRequiredFields.includes(field.attribute.attribute_code) : false;
      if (field.attribute.required || isRequiedInCheckout) {
        validations.push('required');
      }

      field.attribute.validation_rules?.forEach((rule) => {
        if (rule.name === 'min_text_length') {
          validations.push(`minlength="${rule.value}"`);
        } else if (rule.name === 'max_text_length') {
          validations.push(`maxlength="${rule.value}"`);
        }
      });

      if (field.attribute.attribute_code === 'telephone') {
        createTelephoneInput(countryCode, maxLength, countryPrefix, fieldDiv, field.attribute.attribute_code, field.attribute.store_label, field.attribute.required, addressObj?.[field.attribute.attribute_code] ? addressObj[field.attribute.attribute_code].replace(countryPrefix, '') : '', isCheckoutPage, updateOnlyTelephone, infoMessage);
      } else if (field.attribute.frontend_input === 'text') {
        let textInputValue = addressObj?.[field.attribute.attribute_code];
        let label = field.attribute.store_label;
        let attributeCode = field.attribute.attribute_code;
        if (field.attribute.attribute_code === 'firstname') {
          textInputValue = textInputValue ? `${textInputValue} ${addressObj?.lastname ?? ''}` : '';
          label = placeholders.fullname || 'Full Name';
          attributeCode = 'fullName';
        }
        fieldDiv.innerHTML = `
          <div class="input-field-wrapper">
            <div class="input-wrapper input-field">
              <input type="text" id="${attributeCode}" name="${attributeCode}" aria-label="${label}" 
              placeholder=" " 
              ${isDisabled ? 'disabled' : ''}
              value="${textInputValue || ''}" 
              ${field.attribute.attribute_code === 'firstname' ? 'pattern="^\\p{L}+(?:\\s\\p{L}+)+\\s?$"' : ''}
              ${field.attribute.attribute_code === 'email' ? 'pattern="^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"' : ''}
              ${validations.join(' ')}>
              <label for="${attributeCode}">${label}</label>
            </div>
          </div>
        `;
      } else if (field.attribute.frontend_input === 'select') {
        const defaultLabelContent = field.attribute?.attribute_code === 'country_id'
          ? getSelectedLabel(countryCode, field)
          : `${field.attribute.store_label}`;
        const defaultLabelContentValue = field.attribute?.attribute_code === 'country_id'
          ? getSelectedValue(countryCode, field)
          : `${field.attribute.store_label}`;

        if (field.attribute?.attribute_code === 'city') {
          cityDefaultLabel = defaultLabelContent;
        } else if (field.attribute?.attribute_code === 'area') {
          areaDefaultLabel = defaultLabelContent;
        }
        const classesToAdd = ['dropdown', 'notransistion', field.attribute.attribute_code];

        if (isCheckoutPage && field.attribute.attribute_code === 'country_id') {
          classesToAdd.push('hidden');
        }
        fieldDiv.classList.add(...classesToAdd);
        fieldDiv.innerHTML = `
          <div class="input-wrapper input-field">
            <div class="custom-select" id="${field.attribute.attribute_code}" name="${field.attribute.attribute_code}" aria-label="${field.attribute.store_label}" ${validations.join(' ')} required>
              <div class="select-selected${field.attribute.attribute_code === 'country_id' || isDisabled ? ' disabled' : ''}" data-value="${field.attribute.attribute_code === 'country_id' ? defaultLabelContentValue : ''}">
              <label for="${field.attribute.store_label}">${field.attribute.store_label}</label>
              <span for="${field.attribute.store_label}">${placeholders.select || 'Select'} ${field.attribute.store_label}</span>
              </div>
              <input type="text" class="select-search hide" placeholder="${isCheckoutPage && field.attribute.attribute_code !== 'country_id' ? defaultLabelContent : ''}">
              <div class="select-items select-hide">
                <div data-value="" class="no-results ${field.attribute.attribute_code === 'area' && showArea ? '' : 'hide'}">${placeholders.dropdownNoResultsFound || 'No Results Found'}</div>
                ${field.attribute.attribute_code === 'area' && showArea ? '' : field.attribute.options?.filter((option) => option.label !== 'Select an option')
    .map((option) => `<div data-value="${option.value}" ${addressObj?.[field.attribute.attribute_code] === option.value ? 'selected' : ''}>${option.label}</div>`)
    .join('')}
              </div>
            </div>
          </div>
        `;

        field.attribute.options?.map((option) => `<div data-value="${option.value}">${option.label}</div>`);
      } else if (field.attribute.frontend_input === 'multiline') {
        const rows = field.attribute.multiline_count ? `rows="${field.attribute.multiline_count}"` : '';
        fieldDiv.innerHTML = `
            <div class="input-field-wrapper">
              <div class="input-wrapper input-field">
                <textarea id="${field.attribute.attribute_code}" name="${field.attribute.attribute_code}" aria-label="${field.attribute.store_label}" placeholder=" " ${validations.join(' ')} ${rows}  ${isDisabled ? 'disabled' : ''}>${addressObj?.[field.attribute.attribute_code] || ''}</textarea>
                <label for="${field.attribute.attribute_code}">${field.attribute.store_label}</label>
              </div>
            </div>
          `;
      }

      // Check if the current field is the telephone field
      if (field.attribute.attribute_code === 'country_id' && !emailFieldAdded) {
        // Create email field to add after the telephone field
        const emailFieldDiv = document.createElement('div');
        emailFieldDiv.classList.add('input-field-wrapper', 'emailValidation', 'notransistion');
        emailFieldDiv.innerHTML = `
              <div class="input-wrapper input-field email-field">
                <label for="email" class="input-label">${placeholders.emailAddressLabel || 'Email Address'}</label>
                <input type="email" class="email" id="email" name="email" aria-label="${placeholders.emailAddressLabel || 'Email Address'}"
                  placeholder=" "
                  value="${email}" disabled>
              </div>
            `;

        // Append the email field right after the telephone field
        form.appendChild(emailFieldDiv);

        // Set the flag to true so the email field is only added once
        emailFieldAdded = true;
      }

      if (field.attribute.attribute_code === 'area' || field.attribute.attribute_code === 'address_building_segment' || field.attribute.attribute_code === 'address_apartment_segment' || field.attribute.attribute_code === 'address_city_segment' || field.attribute.attribute_code === 'address') {
        const value = addressObj.custom_attributes?.find((attr) => attr.attribute_code === field.attribute.attribute_code)?.value || '';
        const inputField = fieldDiv.querySelector('input, .select-selected, textarea');
        inputField.setAttribute('value', value);
        inputField.setAttribute('data-initial-value', value);
        inputField.setAttribute('data-value', value);
      }
      form.appendChild(fieldDiv);
    });

  const addressFormButtons = `<div class="address-form-button-wrapper">
          <button type="submit" class="address-submit-button address-form-button" aria-label="${placeholders.save || 'Save'}"><span>${placeholders.save || 'Save'}</span></button>
       </div>`;

  form.insertAdjacentHTML('beforeend', addressFormButtons);

  form.noValidate = true;
  setCountryCode(form, countryCode);
  await populateCity(form, citySegments, countryCode, placeholders);

  form.querySelectorAll('input, .custom-select, textarea').forEach((input) => {
    setErrorMessageForField(input, placeholders);
    input.addEventListener('input', () => {
      validateInput(input);
    });
  });

  const phoneInput = form.querySelector('#telephone');
  phoneInput.addEventListener('input', async (event) => {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
    if (event.target.value.length >= phoneInput.maxLength) {
      const isValidPhoneNumber = await validatePhone(
        phoneInput.value,
        countryCode,
      );
      let phoneErrorMessage = placeholders.invalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneErrorMessage = phoneErrorMessage.replace('{{mobile}}', phoneInput.value);

      if (!isValidPhoneNumber) {
        showErrorMessage(phoneInput, phoneErrorMessage);
      }
    }
  });

  const addressCancelButton = form.querySelector('.address-cancel-button');
  addressCancelButton?.addEventListener('click', () => {
    if (newCustomer) {
      $parent?.firstChild?.querySelectorAll('input, textarea').forEach((input) => {
        input.value = '';
      });
      document.querySelector('.dropdown.address_city_segment .select-selected').textContent = cityDefaultLabel;
      document.querySelector('.dropdown.area .select-selected').textContent = areaDefaultLabel;
    } else {
      $parent?.classList.add('hide');
    }
    window.scrollTo(0, 0);
  });

  const addressSubmitButton = form.querySelector('.address-submit-button');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateForm(form, placeholders, isCheckoutPage)) {
      return;
    }
    const phoneValue = phoneInput.value;
    const isValidPhoneNumber = await validatePhone(phoneValue, countryCode);
    if (!isValidPhoneNumber) {
      let phoneNumberErrorMessage = placeholders.invalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneNumberErrorMessage = phoneNumberErrorMessage.replace('{{mobile}}', phoneInput.value);
      showErrorMessage(phoneInput, phoneNumberErrorMessage);
      return;
    }

    addressSubmitButton.classList.add('loader');

    if (isCheckoutPage && !isLoggedIn) {
      const emailInput = form.querySelector('#email');
      const responseData = await validateCustomerEmail(emailInput.value);
      if (responseData?.customerExists) {
        const emailErrorMessage = placeholders.emailExist || 'You already have an account. Please log in.';
        showErrorMessage(emailInput, emailErrorMessage, true);
        dataLayerCustomerExistCheckoutErrors();
        addressSubmitButton.classList.remove('loader');
        return;
      }
      emailInput.classList.remove('error');
    }

    const address = {};
    const customAttributeNames = new Set([
      'address_city_segment',
      'area',
      'address_building_segment',
      'address_apartment_segment',
      'address',
    ]);
    const inputs = form.querySelectorAll('input, .custom-select, textarea');

    inputs.forEach((input) => {
      const name = input?.getAttribute('name');
      if (!name) return;

      let key = name;
      let value = input.value?.trim() || '';

      switch (name) {
        case 'country_id':
          key = 'country_code';
          break;

        case 'address_city_segment':
        case 'area': {
          const selected = input.querySelector('.select-selected');
          const dataValue = selected?.getAttribute('data-value') || '';
          const dataInitialValue = selected?.getAttribute('data-initial-value') || '';
          value = input.classList.contains('custom-select')
            ? dataValue || dataInitialValue
            : value;

          if (name === 'address_city_segment') {
            address.city = isCheckoutPage ? (dataValue || dataInitialValue || '-') : (dataValue || '-');
          }
          break;
        }

        case 'fullName': {
          const [firstName = '', ...rest] = value.split(/\s+/);
          address.firstname = firstName;
          address.lastname = rest.join(' ');
          return;
        }

        case 'telephone':
          address.telephone = `${countryPrefix}${value}`;
          return;

        default:
          break;
      }

      if (customAttributeNames.has(name)) {
        address.custom_attributes = address.custom_attributes || [];
        address.custom_attributes.push({
          attribute_code: key,
          value,
        });
      } else {
        address[key] = value;
      }
    });

    let res = null;
    let message;
    if (isUpdate && !isCheckoutPage) {
      res = await updateAddress(addressObj.id, address);
      if (res?.success) {
        message = placeholders.addressUpdated || 'Address is updated successfully.';
      }
    } else if (isCheckoutPage) {
      if (isLoggedIn && !isTopup) {
        delete address.address;
        if (isUpdate) {
          const response = await updateAddress(addressObj.id, address, config);
          address.id = response?.data?.commerce_updateCustomerAddress?.id;
          address.street = response?.data?.commerce_updateCustomerAddress?.street;
        } else {
          const response = await createAddress(address, config);
          address.id = response?.data?.commerce_createCustomerAddress?.id;
          address.street = response?.data?.commerce_createCustomerAddress?.street;
        }
      }
      window.dispatchEvent(new CustomEvent('react:addressFormSubmitted', { detail: { address, isUpdate } }));
    } else {
      res = await createAddress(address);
      if (res?.success) {
        message = placeholders.addressAdded || 'Address is added successfully.';
      }
    }
    if (res?.success) {
      block.dispatchEvent(new CustomEvent('address-updated'));
      addressesContainer.classList.remove('hide');
      $parent.classList.add('hide');
      document.querySelector('.new-address-container').classList.remove('hide');
      addStatusMessage(message);
    }
  });

  decorateIcons(form);
  if (!isCheckoutPage) {
    customSelectbox(form.querySelector('.input-field-wrapper.dropdown.country_id'));
  }
  customSelectbox(form.querySelector('.input-field-wrapper.dropdown.address_city_segment'));
  $parent.innerHTML = '';
  $parent.appendChild(form);
  if (isCheckoutPage) {
    window.dispatchEvent(new CustomEvent('react:addressFormLoaded'));
  }
  // $parent.classList.remove('hide');
  return $parent;
}

// EDIT ADDRESS form in modal
export async function showEditAddressModal(
  addressForm,
  placeholders,
  addressObj,
  citySegments,
  isCheckoutPage = false,
  isLoggedIn = false,
  config = {},
  isTopup = false,
  // newCustomer = false,
  // updateOnlyTelephone = false,
  // infoMessage = ''
) {
  const editAddressModalId = 'edit-address-modal';
  const editAddressTitle = placeholders.editAddressModalTitle || 'Edit Address';
  const editAddressContent = document.createElement('div');
  editAddressContent.classList.add('edit-address-content');
  try {
    const formContent = await showAddressFormModal(addressForm, placeholders, addressObj);
    editAddressContent.appendChild(formContent);
  } catch (error) {
    console.error('Error rendering address form:', error);
  }
  await createModalFromContent(
    editAddressModalId,
    editAddressTitle,
    editAddressContent.outerHTML,
    ['edit-address-modal'],
    null,
    false,
    'icon-close-blue',
  );
  openModal(editAddressModalId);
  // Attach the submit event listener after modal is open and content is loaded

  const formElement = document.querySelector('.edit-address-content .address-form form');
  const phoneInput = formElement.querySelector('#telephone');
  const countryCode = await getConfigValue('country-code');
  const countryPrefix = `+${await getCountryIso(countryCode)}`;
  let isUpdate = '';
  if (addressObj) {
    isUpdate = Object.keys(addressObj)?.length > 0;
  }

  const addressSubmitButton = formElement.querySelector('.address-submit-button');
  const addressesContainer = document.querySelector('.addresses-container');
  const updateSubmitButtonState = () => {
    const isFormValid = formElement.checkValidity(); // Check overall form validity
    const isPhoneValid = phoneInput.value.length >= phoneInput.minLength
      && phoneInput.value.length <= phoneInput.maxLength;
      // Check if City and Area dropdowns have valid selections
    const cityDropdown = formElement.querySelector('#address_city_segment .select-selected');
    const isCityValid = cityDropdown && cityDropdown.getAttribute('data-value') !== '';
    const areaDropdown = formElement.querySelector('.area .select-selected');
    const isAreaValid = areaDropdown && areaDropdown.getAttribute('data-value') !== '';
    // Disable submit button if form is invalid or if city/area are not selected
    addressSubmitButton.disabled = !(isFormValid && isPhoneValid && isCityValid && isAreaValid);
  };
  phoneInput.addEventListener('input', async (event) => {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
    if (event.target.value.length >= phoneInput.maxLength) {
      const isValidPhoneNumber = await validatePhone(
        phoneInput.value,
        countryCode,
      );
      let phoneErrorMessage = `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneErrorMessage = phoneErrorMessage.replace('{{mobile}}', phoneInput.value);
      if (!isValidPhoneNumber) {
        showErrorMessage(phoneInput, phoneErrorMessage);
      }
    }
    updateSubmitButtonState();
  });

  if (formElement) {
    // samriddhi submit
    formElement.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!validateForm(formElement, placeholders, isCheckoutPage)) {
        return;
      }
      const phoneValue = phoneInput.value;
      const isValidPhoneNumber = await validatePhone(phoneValue, countryCode);
      if (!isValidPhoneNumber) {
        let phoneNumberErrorMessage = placeholders.invalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
        phoneNumberErrorMessage = phoneNumberErrorMessage.replace('{{mobile}}', phoneInput.value);
        showErrorMessage(phoneInput, phoneNumberErrorMessage);
        return;
      }

      addressSubmitButton.classList.add('loader');

      if (isCheckoutPage && !isLoggedIn) {
        const emailInput = formElement.querySelector('#email');
        const responseData = await validateCustomerEmail(emailInput.value);
        if (responseData?.customerExists) {
          const emailErrorMessage = placeholders.emailExist || 'You already have an account. Please log in.';
          showErrorMessage(emailInput, emailErrorMessage, true);
          dataLayerCustomerExistCheckoutErrors();
          addressSubmitButton.classList.remove('loader');
          return;
        }
        emailInput.classList.remove('error');
      }

      const address = {};
      const customAttributeNames = new Set([
        'address_city_segment',
        'area',
        'address_building_segment',
        'address_apartment_segment',
        'address',
      ]);
      const inputs = formElement.querySelectorAll('input, .custom-select, textarea');

      inputs.forEach((input) => {
        const name = input?.getAttribute('name');
        if (!name) return;

        let key = name;
        let value = input.value?.trim() || '';
        switch (name) {
          case 'country_id': {
            key = 'country_code';
            break;
          }

          case 'address_city_segment':
          case 'area': {
            const selected = input.querySelector('.select-selected');
            const dataValue = selected?.getAttribute('data-value') || '';
            const dataInitialValue = selected?.getAttribute('data-initial-value') || '';
            value = input.classList.contains('custom-select')
              ? dataValue || dataInitialValue
              : value;

            if (name === 'address_city_segment') {
              address.city = isCheckoutPage ? (dataValue || dataInitialValue || '-') : (dataValue || '-');
            }
            break;
          }

          case 'fullName': {
            const [firstName = '', ...rest] = value.split(/\s+/);
            address.firstname = firstName;
            address.lastname = rest.join(' ');
            return;
          }

          case 'telephone':
            address.telephone = `${countryPrefix}${value}`;
            return;

          default:
            break;
        }

        if (customAttributeNames.has(name)) {
          address.custom_attributes = address.custom_attributes || [];
          address.custom_attributes.push({
            attribute_code: key,
            value,
          });
        } else if (key !== 'email') {
          address[key] = value;
        }
      });

      let res = null;
      let message;
      if (isUpdate && !isCheckoutPage) {
        res = await updateAddress(addressObj.id, address);
        if (res?.success) {
          message = placeholders.addressUpdated || 'Address is updated successfully.';
          closeModal('edit-address-modal');
        }
      } else if (isCheckoutPage) {
        if (isLoggedIn && !isTopup) {
          delete address.address;
          if (isUpdate) {
            const response = await updateAddress(addressObj.id, address, config);
            address.id = response?.data?.commerce_updateCustomerAddress?.id;
            address.street = response?.data?.commerce_updateCustomerAddress?.street;
          } else {
            const response = await createAddress(address, config);
            address.id = response?.data?.commerce_createCustomerAddress?.id;
            address.street = response?.data?.commerce_createCustomerAddress?.street;
          }
        }
        window.dispatchEvent(new CustomEvent('react:addressFormSubmitted', { detail: { address, isUpdate } }));
      } else {
        res = await createAddress(address);
        if (res?.success) {
          message = placeholders.addressAdded || 'Address is added successfully.';
          closeModal('edit-address-modal');
        }
      }
      if (res?.success) {
        window.dispatchEvent(new CustomEvent('address-updated'));
        closeModal('edit-address-modal');
        addressesContainer.classList.remove('hide');
        // $parent.classList.add('hide');
        document.querySelector('.new-address-container').classList.remove('hide');
        addStatusMessage(message);
      }
    });
  }

  formElement.querySelectorAll('input, .custom-select, textarea').forEach((input) => {
    input.addEventListener('input', () => {
      validateInput(input);
      updateSubmitButtonState();
    });
    input.addEventListener('blur', () => {
      updateSubmitButtonState();
    });
  });
  // Enable/disable Area field based on City selection
  const cityDropdown = formElement.querySelector('#address_city_segment .select-selected');
  const areaDropdown = formElement.querySelector('#area .select-selected');
  const inputFieldWrapper = formElement.querySelector('.input-field-wrapper.dropdown');
  const areaValid = () => {
    const areaOptionsContainer = formElement.querySelector('#area .select-items');
    areaOptionsContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      areaDropdown.textContent = e.target.textContent;
      areaDropdown.setAttribute('data-value', e.target.getAttribute('data-value'));
      if (areaDropdown.getAttribute('data-value') !== '') {
        const inputFieldWrapperArea = formElement.querySelector('.input-field-wrapper.area');
        inputFieldWrapperArea.classList.remove('invalid');
        areaOptionsContainer.classList.add('select-hide');
      }
    });
  };

  const toggleAreaField = () => {
    const isCitySelected = cityDropdown.getAttribute('data-value') !== '';
    if (isCitySelected) {
      areaDropdown.setAttribute('aria-disabled', 'false');
    } else {
      areaDropdown.setAttribute('aria-disabled', 'true');
    }
  };

  // Function to update city selection and toggle Area field state
  formElement.querySelectorAll('#address_city_segment .select-items div').forEach((cityOption) => {
    cityOption.addEventListener('click', () => {
      // Update city selection text and data-value
      cityDropdown.textContent = cityOption.textContent;
      cityDropdown.setAttribute('data-value', cityOption.getAttribute('data-value'));
      // Check if both city and area have values to remove the invalid class
      if (cityDropdown.getAttribute('data-value') !== '') {
        inputFieldWrapper.classList.remove('invalid');
      }
      toggleAreaField();
    });
  });

  // Trigger function on city selection
  // cityDropdown.addEventListener('click', toggleAreaField);
  areaDropdown.addEventListener('click', areaValid);
  toggleAreaField();
  areaValid();
  formElement.noValidate = true;
  setCountryCode(formElement, countryCode);
  await populateCity(formElement, citySegments, countryCode, placeholders);
  customSelectboxModal(placeholders, formElement);
  const phoneDiv = document.querySelector('.edit-address-content .address-form form .input-field-wrapper.phonevalidation');
  const emailDiv = document.querySelector('.edit-address-content .address-form form .input-field-wrapper.emailValidation');
  const city = document.querySelector('.edit-address-content .address-form form .input-field-wrapper.dropdown.address_city_segment');
  const area = document.querySelector('.edit-address-content .address-form form .input-field-wrapper.dropdown.area');
  wrapTwoDivsinWrapper(phoneDiv, emailDiv, 'form__phone-email-wrapper');
  wrapTwoDivsinWrapper(city, area, 'form__city-area-wrapper');
}

// ADD ADDRESS form in modal
export async function showAddAddressModal(
  placeholders,
  citySegments,
  addressObj = {},
  config = {},
  isCheckoutPage = false,
  isLoggedIn = false,
  isTopup = false,
  // newCustomer = false,
  // updateOnlyTelephone = false,
  // infoMessage = ''
) {
  const addAddressModalId = 'add-address-modal';
  const addAddressTitle = placeholders.addAddress || 'Add Address';
  const addAddressContent = document.createElement('div');
  addAddressContent.classList.add('add-address-content');
  const addressForm = document.createElement('div');
  addressForm.classList.add('address-form');
  try {
    const formContent = await showAddressFormModal(addressForm, placeholders, {});
    addAddressContent.innerHTML = formContent;
  } catch (error) {
    console.error('Error rendering address form:', error);
  }
  await createModalFromContent(
    addAddressModalId,
    addAddressTitle,
    addressForm.outerHTML,
    ['add-address-modal'],
    null,
    false,
    'icon-close-blue',
  );
  openModal(addAddressModalId);
  // Attach the submit event listener after modal is open and content is loaded
  const formElement = document.querySelector(`#${addAddressModalId} .address-form form`);
  const phoneInput = formElement.querySelector('#telephone');
  const countryCode = await getConfigValue('country-code');
  const countryPrefix = `+${await getCountryIso(countryCode)}`;
  const isUpdate = Object.keys(addressObj).length > 0;

  const addressSubmitButton = formElement.querySelector('.address-submit-button');
  const addressesContainer = document.querySelector('.addresses-container');
  const updateSubmitButtonState = () => {
    const isFormValid = formElement.checkValidity(); // Check overall form validity
    const isPhoneValid = phoneInput.value.length >= phoneInput.minLength
      && phoneInput.value.length <= phoneInput.maxLength;
      // Check if City and Area dropdowns have valid selections
    const cityDropdown = formElement.querySelector('#address_city_segment .select-selected');
    const isCityValid = cityDropdown && cityDropdown.getAttribute('data-value') !== '';
    const areaDropdown = formElement.querySelector('.area .select-selected');
    const isAreaValid = areaDropdown && areaDropdown.getAttribute('data-value') !== '';
    // Disable submit button if form is invalid or if city/area are not selected
    addressSubmitButton.disabled = !(isFormValid && isPhoneValid && isCityValid && isAreaValid);
  };
  phoneInput.addEventListener('input', async (event) => {
    event.target.value = event.target.value.replace(/[^0-9]/g, '');
    if (event.target.value.length >= phoneInput.maxLength) {
      const isValidPhoneNumber = await validatePhone(
        phoneInput.value,
        countryCode,
      );
      let phoneErrorMessage = `The number provided ${phoneInput.value} is not a valid mobile number.`;
      phoneErrorMessage = phoneErrorMessage.replace('{{mobile}}', phoneInput.value);
      if (!isValidPhoneNumber) {
        showErrorMessage(phoneInput, phoneErrorMessage);
      }
    }
    updateSubmitButtonState();
  });

  if (formElement) {
    // samriddhi submit
    formElement.addEventListener('submit', async (event) => {
      event.preventDefault();
      updateSubmitButtonState();
      if (!validateForm(formElement, placeholders, isCheckoutPage)) {
        return;
      }
      const phoneValue = phoneInput.value;
      const isValidPhoneNumber = await validatePhone(phoneValue, countryCode);
      if (!isValidPhoneNumber) {
        let phoneNumberErrorMessage = placeholders.invalidMobileNumber || `The number provided ${phoneInput.value} is not a valid mobile number.`;
        phoneNumberErrorMessage = phoneNumberErrorMessage.replace('{{mobile}}', phoneInput.value);
        showErrorMessage(phoneInput, phoneNumberErrorMessage);
        return;
      }

      addressSubmitButton.classList.add('loader');

      if (isCheckoutPage && !isLoggedIn) {
        const emailInput = formElement.querySelector('#email');
        const responseData = await validateCustomerEmail(emailInput.value);
        if (responseData?.customerExists) {
          const emailErrorMessage = placeholders.emailExist || 'You already have an account. Please log in.';
          showErrorMessage(emailInput, emailErrorMessage, true);
          dataLayerCustomerExistCheckoutErrors();
          addressSubmitButton.classList.remove('loader');
          return;
        }
        emailInput.classList.remove('error');
      }

      const address = {};
      const customAttributeNames = new Set([
        'address_city_segment',
        'area',
        'address_building_segment',
        'address_apartment_segment',
        'address',
      ]);
      const inputs = formElement.querySelectorAll('input, .custom-select, textarea');

      inputs.forEach((input) => {
        const name = input?.getAttribute('name');
        if (!name) return;

        let key = name;
        let value = input.value?.trim() || '';
        switch (name) {
          case 'country_id': {
            key = 'country_code';
            break;
          }

          case 'address_city_segment':
          case 'area': {
            const selected = input.querySelector('.select-selected');
            const dataValue = selected?.getAttribute('data-value') || '';
            const dataInitialValue = selected?.getAttribute('data-initial-value') || '';
            value = input.classList.contains('custom-select')
              ? dataValue || dataInitialValue
              : value;

            if (name === 'address_city_segment') {
              address.city = isCheckoutPage ? (dataValue || dataInitialValue || '-') : (dataValue || '-');
            }
            break;
          }

          case 'fullName': {
            const [firstName = '', ...rest] = value.split(/\s+/);
            address.firstname = firstName;
            address.lastname = rest.join(' ');
            return;
          }

          case 'telephone':
            address.telephone = `${countryPrefix}${value}`;
            return;

          default:
            break;
        }

        if (customAttributeNames.has(name)) {
          address.custom_attributes = address.custom_attributes || [];
          address.custom_attributes.push({
            attribute_code: key,
            value,
          });
        } else if (key !== 'email') {
          address[key] = value;
        }
      });

      let res = null;
      let message;
      if (isUpdate && !isCheckoutPage) {
        res = await updateAddress(addressObj.id, address);
        if (res?.success) {
          message = placeholders.addressUpdated || 'Address is updated successfully.';
          closeModal('add-address-modal');
        }
      } else if (isCheckoutPage) {
        if (isLoggedIn && !isTopup) {
          delete address.address;
          if (isUpdate) {
            const response = await updateAddress(addressObj.id, address, config);
            address.id = response?.data?.commerce_updateCustomerAddress?.id;
            address.street = response?.data?.commerce_updateCustomerAddress?.street;
          } else {
            const response = await createAddress(address, config);
            address.id = response?.data?.commerce_createCustomerAddress?.id;
            address.street = response?.data?.commerce_createCustomerAddress?.street;
          }
        }
        window.dispatchEvent(new CustomEvent('react:addressFormSubmitted', { detail: { address, isUpdate } }));
      } else {
        res = await createAddress(address);
        if (res?.success) {
          message = placeholders.addressAdded || 'Address is added successfully.';
          closeModal('add-address-modal');
        }
      }
      if (res?.success) {
        window.dispatchEvent(new CustomEvent('address-updated'));
        closeModal('add-address-modal');
        addressesContainer.classList.remove('hide');
        // $parent.classList.add('hide');
        document.querySelector('.new-address-container').classList.remove('hide');
        addStatusMessage(message);
      }
    });
  }

  formElement.querySelectorAll('input, .custom-select, textarea').forEach((input) => {
    input.addEventListener('input', () => {
      validateInput(input);
      updateSubmitButtonState();
    });
    input.addEventListener('blur', () => {
      updateSubmitButtonState();
    });
  });
  // Enable/disable Area field based on City selection
  const cityDropdown = formElement.querySelector('#address_city_segment .select-selected');
  const areaDropdown = formElement.querySelector('#area .select-selected');
  const inputFieldWrapper = formElement.querySelector('.input-field-wrapper.dropdown');
  const areaValid = () => {
    const areaOptionsContainer = formElement.querySelector('#area .select-items');
    areaOptionsContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      areaDropdown.textContent = e.target.textContent;
      areaDropdown.setAttribute('data-value', e.target.getAttribute('data-value'));
      if (areaDropdown.getAttribute('data-value') !== '') {
        const inputFieldWrapperArea = formElement.querySelector('.input-field-wrapper.area');
        inputFieldWrapperArea.classList.remove('invalid');
      }
    });
  };

  const toggleAreaField = () => {
    const isCitySelected = cityDropdown.getAttribute('data-value') !== '';
    if (isCitySelected) {
      areaDropdown.setAttribute('aria-disabled', 'false');
    } else {
      areaDropdown.setAttribute('aria-disabled', 'true');
    }
  };

  // Function to update city selection and toggle Area field state
  formElement.querySelectorAll('#address_city_segment .select-items div').forEach((cityOption) => {
    cityOption.addEventListener('click', () => {
      // Update city selection text and data-value
      cityDropdown.textContent = cityOption.textContent;
      cityDropdown.setAttribute('data-value', cityOption.getAttribute('data-value'));
      // Check if both city and area have values to remove the invalid class
      if (cityDropdown.getAttribute('data-value') !== '') {
        inputFieldWrapper.classList.remove('invalid');
      }
      toggleAreaField();
    });
  });

  // Trigger function on city selection
  // cityDropdown.addEventListener('click', toggleAreaField);
  areaDropdown.addEventListener('click', areaValid);
  toggleAreaField();
  areaValid();
  formElement.noValidate = true;
  setCountryCode(formElement, countryCode);
  await populateCity(formElement, citySegments, countryCode, placeholders);
  customSelectboxModal(placeholders, formElement);
  const phoneDiv = document.querySelector('.add-address-modal .address-form form .input-field-wrapper.phonevalidation');
  const emailDiv = document.querySelector('.add-address-modal .address-form form .input-field-wrapper.emailValidation');
  const city = document.querySelector('.add-address-modal .address-form form .input-field-wrapper.dropdown.address_city_segment');
  const area = document.querySelector('.add-address-modal .address-form form .input-field-wrapper.dropdown.area');
  wrapTwoDivsinWrapper(phoneDiv, emailDiv, 'form__phone-email-wrapper');
  wrapTwoDivsinWrapper(city, area, 'form__city-area-wrapper');

  const addAddressModal = document.querySelector('.add-address-modal');
  if (addAddressModal) {
    const countryCodeLabel = addAddressModal.querySelector('.countrycode');
    if (countryCodeLabel) {
      countryCodeLabel.classList.add('hidden');
    }
  }
}
