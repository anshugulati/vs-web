import {
  makePrimaryAddress, deleteAddress,
  getDeliveryMatrixAddressStructure,
  getAddressCitySegments,
  getAddressAreas,
} from '../../scripts/address/api.js';
import { decorateIcons } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getCustomer } from '../../scripts/customer/api.js';
import {
  fetchPlaceholdersForLocale,
  createModalFromContent,
  openModal,
  closeModal,
} from '../../scripts/scripts.js';
import {
  addStatusMessage, accountNoAddress, handleNoAddress, hideNewAddressCta,
  showAddressForm, handleAddressHover,
} from './account-address-book-util.js';

// to shoe address form for new customer
function handleNewCustomer(placeholders, addressesContainer) {
  const addressForm = document.querySelector('.address-form');
  showAddressForm(addressForm, placeholders, {}, true);
  addressesContainer.classList.add('hide');
  hideNewAddressCta();
}

// to show delete address modal
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

// to display addresses list
const displayAddressList = async function (addressForm, addressesContainer, placeholders) {
  addressesContainer.innerHTML = '';
  const countryCode = await getConfigValue('country-code');
  const customerPromise = getCustomer(false);
  const citySegmentsPromise = getAddressCitySegments(countryCode);
  const areasPromise = getAddressAreas(countryCode);
  const formStructurePromise = getDeliveryMatrixAddressStructure(countryCode);

  const [customer, citySegments, areas, formStructure] = await Promise.all([customerPromise,
    citySegmentsPromise,
    areasPromise,
    formStructurePromise,
  ]);

  const country = formStructure
    .find((field) => field.visible === '1' && field?.attribute?.attribute_code === 'country_id')
    ?.attribute?.options?.find((option) => option.value === countryCode)?.label;
  if (customer?.addresses?.length && accountNoAddress) {
    handleNoAddress();
  }
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
     <a href="#" class="edit-address-cta" aria-label="${placeholders.edit || 'Edit'}"><span class="icon icon-edit-in-box-black"></span></a>
    </div>`;

    const city = citySegments.items
      ?.find((item) => item.location_id === Number(address.custom_attributes?.find((attr) => attr.attribute_code === 'address_city_segment')?.value))?.label;

    const area = areas.items
      ?.find((item) => item.location_id === Number(address.custom_attributes?.find((attr) => attr.attribute_code === 'area')?.value))?.label;

    const buildingName = address.custom_attributes?.find((attr) => attr.attribute_code === 'address_building_segment')?.value;
    const apartment = address.custom_attributes?.find((attr) => attr.attribute_code === 'address_apartment_segment')?.value;

    const countrySpan = country ? `<span>${country}</span>` : '';
    const citySpan = city ? `<span>${city}</span>` : '';
    const areaSpan = area ? `<span>${area}</span>` : '';
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
            ${citySpan}${areaSpan}
            <span>${address.street}</span>${buildingSpan}${apartmentSpan}
            </p>
        </div>        
        ${address.default_billing ? `
            <div class="address-section cta-container primary-address-cta-container">
              <div class="primary-address-cta-wrapper">
              <span class="icon icon-tick-green-thin"></span>
              <span>${placeholders.primary || 'Primary'}</span>
              </div>
              ${editAddressHtml}
            </div>` : `
            <div class="address-section cta-container address-cta-container">
              <div class="make-primary-cta-wrapper">
              <a class="make-primary-cta" aria-label="${placeholders.makePrimary || 'Make Primary'}"><span>${placeholders.makePrimary || 'Make Primary'}</span></a>
              </div>
              ${editAddressHtml}
            <div class="delete-address-cta-wrapper">
              <a href="#" class="delete-address-cta" aria-label="${placeholders.delete || 'Delete'}"><span class="icon icon-trash-black"></span></a>
            </div></div>`}
      </div>`;
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
  const accountAddressBookGridView = await getConfigValue('account-address-book-grid-view');
  if (accountAddressBookGridView) {
    import('./account-address-book-grid-view.js').then((module) => {
      module.default(block);
    });
    return;
  }
  const placeholders = await fetchPlaceholdersForLocale();

  if (!accountNoAddress) {
    block.innerHTML = '';
  } else {
    const noAddressDiv = block.children[0];
    noAddressDiv?.classList.add('account-no-address');
  }

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
