import { getConfigValue } from '../../../scripts/configs.js';
import {
  loadFragment, createModalFromContent, openModal, fetchPlaceholdersForLocale, hasValue,
} from '../../../scripts/scripts.js';
import { datalayerPdpAccordionToggleEvent, datalayerSearchStore, datalayerBNPLPDP } from '../../../scripts/analytics/google-data-layer.js';
import { getStores } from '../../../scripts/stores/api.js';
import { loadSocialShareModal } from '../../social-share/social-share.js';

let googleMapKey;
let googleMapRegional;
let google;
let originLat;
let orginLng;
let storeData = [];
let nearestStore = [];
let cncRadius = '';
const cncModalId = 'click-n-collect';
const isExpandable = await getConfigValue('pdp-clickandcollect-expandable');
const isMobile = window.innerWidth < 768;

let googleMapsLoaded = false;

export function toggleExpand(headingElement, content, options = null) {
  headingElement.classList.toggle('expand');
  const accordionFlag = headingElement.classList.contains('expand');
  if (accordionFlag) {
    content.style.maxHeight = 'unset';
  } else {
    content.style.maxHeight = null;
  }
  const accordionToggle = accordionFlag ? 'expand' : 'collapse';
  if (options) {
    datalayerBNPLPDP(`productdetailview_${accordionToggle}`, options);
  } else {
    datalayerPdpAccordionToggleEvent(headingElement.textContent, accordionToggle);
  }
}

function toggleCncOnLoad(block) {
  block.querySelectorAll('.columns > div').forEach((element) => {
    element.classList.remove('hide');
  });
  block.querySelector('.row-3 input').value = '';
  // disbaled search button parmanently as it should not be funcational
  block.querySelector('.row-3 button').classList.add('disabled');
  block.querySelector('.row-4').classList.add('hide');
  block.querySelector('.row-5').classList.add('hide');
  block.querySelector('.row-6').classList.add('hide');
  block.querySelector('.row-7').classList.add('hide');
  block.style.maxHeight = `${block.scrollHeight}px`;
}

function toggleCncOnSearch(block) {
  block.querySelectorAll('.columns > div').forEach((element) => {
    element.classList.remove('hide');
  });
  block.querySelector('.row-2').classList.add('hide');
  block.querySelector('.row-3').classList.add('hide');
  if (nearestStore.length !== 0) {
    block.querySelector('.row-7').classList.remove('hide');
  } else {
    block.querySelector('.row-7').classList.add('hide');
  }
  block.style.maxHeight = 'unset';
}

function decorateCncOnSearch(block) {
  block.querySelectorAll('.click-n-collect-content h3').forEach((ele) => {
    ele.setAttribute('data-text', ele.textContent);
  });
  block.querySelectorAll('.click-n-collect-content p').forEach((ele) => {
    ele.setAttribute('data-text', ele.textContent);
  });
  block.querySelectorAll('.click-n-collect-content .row-4 p').forEach((ele) => {
    ele.classList.add('hide');
  });
  block.querySelectorAll('.click-n-collect-content .row-6 p').forEach((ele) => {
    ele.setAttribute('data-text', ele.textContent);
    ele.classList.add('click-n-collect-dummy');
  });
}

function decorateCncOnload(block) {
  // decorating input field
  const input = document.createElement('input');
  input.setAttribute('type', 'text');
  input.setAttribute('id', 'click-n-collect-store');
  input.setAttribute('disabled', 'true');
  input.setAttribute('placeholder', block.querySelector('.click-n-collect-content .row-3 > div:nth-child(1)').textContent);
  input.classList.add('click-n-collect-input');
  block.querySelector('.click-n-collect-content .row-3 > div').replaceWith(input);

  // decorating Search button
  const button = document.createElement('button');
  button.textContent = block.querySelector('.click-n-collect-content .row-3 > div:nth-child(2)').textContent;
  button.classList.add('click-n-collect-button');
  block.querySelector('.click-n-collect-content .row-3 > div').replaceWith(button);
}

function registerEventsonCnc(block, storeFinderFlag) {
  // Event listeners
  block.querySelector('.click-n-collect-content .click-n-collect-button').addEventListener('click', () => {
    if (document.querySelector('.click-n-collect-content .row-3 input').value === '') {
      return;
    }
    setTimeout(() => {
      toggleCncOnSearch(document.querySelector('.click-n-collect-content'));
    }, 1000);
  });
  block.querySelector('.click-n-collect-content .row-3 input').addEventListener('keyup', (event) => {
    event.preventDefault();
  });
  block.querySelector('.click-n-collect-content .row-5 a').addEventListener('click', (event) => {
    event.preventDefault();
    toggleCncOnLoad(document.querySelector('.click-n-collect-content'));
  });
  block.querySelector('.click-n-collect-content .row-7 a').addEventListener('click', (event) => {
    event.preventDefault();
    if (storeFinderFlag === true) {
      document.querySelector('#click-n-collect-dialog')?.classList.toggle('hide-modal');
      document.querySelector('body').classList.add('modal-open');
    } else {
      openModal('click-n-collect-dialog');
    }
  });
}

function decorateClickAndCollect(block, storeFinderFlag) {
  block.firstElementChild.classList.add('click-n-collect-heading');
  block.lastElementChild.classList.add('click-n-collect-content');

  const columns = block.querySelectorAll('.click-n-collect-limited > div');
  columns.forEach((column, index) => {
    column.classList.add(`row-${index + 1}`);
  });

  block.querySelectorAll('.click-n-collect-full p').forEach((ele) => {
    ele.classList.add('hide');
  });

  block.querySelector('.row-1 > div').replaceWith(Object.assign(document.createElement('p'), { innerHTML: block.querySelector('.row-1 > div').innerHTML }));
  block.querySelector('.row-2 > div').replaceWith(Object.assign(document.createElement('p'), { innerHTML: block.querySelector('.row-2 > div').innerHTML }));
  block.querySelector('.row-5 > div').replaceWith(Object.assign(document.createElement('a'), { href: '#', innerHTML: block.querySelector('.row-5 > div').innerHTML }));
  block.querySelector('.row-7 > div').replaceWith(Object.assign(document.createElement('a'), { href: '#', innerHTML: block.querySelector('.row-7 > div').innerHTML }));

  decorateCncOnload(block);
  toggleCncOnLoad(block);
  decorateCncOnSearch(block);
  registerEventsonCnc(block, storeFinderFlag);
}

async function calculateDistanceFromStore(store) {
  const from = new google.maps.LatLng(originLat, orginLng);
  const to = new google.maps.LatLng(store.latitude, store.longitude);
  const service = new google.maps.DistanceMatrixService();
  try {
    const resp = await new Promise((resolve, reject) => {
      service.getDistanceMatrix({
        origins: [from],
        destinations: [to],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false,
      }, (response, status) => {
        if (status === 'OK') {
          resolve(response);
        } else {
          reject(new Error(`Distance matrix request failed with status: ${status}`));
        }
      });
    });

    const distanceMeters = resp.rows[0].elements[0].distance.value;
    const distanceKm = distanceMeters / 1000;
    if (distanceKm <= cncRadius) {
      store.distance = distanceKm;
      nearestStore.push(store);
    }
    return distanceKm;
  } catch (error) {
    console.debug(error);
    return null;
  }
}

function addCncLimited(store, index) {
  const storeItemWrapper = document.createElement('div');
  storeItemWrapper.classList.add('click-n-collect-store-item-wrapper');

  const storeItemCount = document.createElement('div');
  storeItemCount.classList.add('click-n-collect-store-item-count');
  const storeItemCountHeading = document.createElement('p');
  storeItemCountHeading.textContent = index + 1;
  storeItemCount.append(storeItemCountHeading);

  const storeItemDetails = document.createElement('div');
  storeItemDetails.classList.add('click-n-collect-store-item-details');

  const storeDetail = document.createElement('p');
  const storeName = store.store_name;
  const storeAddress = store.address.find((address) => address.code === 'street').value;
  storeDetail.innerHTML = `${storeName}<br>${storeAddress}`;
  const storeAvailability = document.createElement('p');
  storeAvailability.textContent = document.querySelector('.click-n-collect-content .click-n-collect-dummy:nth-child(2)').getAttribute('data-text').replace('{{storeAvailability}}', store.sts_delivery_time_label);

  storeItemDetails.append(storeDetail, storeAvailability);

  storeItemWrapper.append(storeItemCount, storeItemDetails);
  document.querySelector('.click-n-collect-content .row-6 div').append(storeItemWrapper);
}

async function addCncFull(store) {
  const placeholders = await fetchPlaceholdersForLocale();
  const block = document.querySelector('.click-n-collect-full div:nth-child(2) > div:nth-child(2)');

  const storeItemWrapper = document.createElement('div');
  storeItemWrapper.classList.add('click-n-collect-store-list-wrapper');

  const storeName = document.createElement('h3');
  storeName.textContent = store.store_name;

  const storeAddress = document.createElement('p');
  const storeAvailability = document.createElement('p');
  storeAvailability.textContent = document.querySelector('.click-n-collect-full div:nth-child(2) > div:nth-child(2) p:nth-child(2)').getAttribute('data-text').replace('{{storeAvailability}}', store.sts_delivery_time_label || placeholders.storeAvailability);

  let startDay = null;
  let endDay = null;
  let startHours = null;
  let storeOpening = '';
  store.store_hours.forEach((hour) => {
    if (startDay === null) {
      startDay = hour.label;
      startHours = hour.value;
    } else if (hour.value === startHours) {
      endDay = hour.label;
    } else {
      if (!endDay) {
        storeOpening += `${startDay} (${startHours})<br>`;
      } else {
        storeOpening += `${startDay} - ${endDay} (${startHours})<br>`;
      }
      startDay = hour.label;
      startHours = hour.value;
      endDay = null;
    }
  });
  if (startDay !== null) {
    if (endDay !== null) {
      storeOpening += `${startDay} - ${endDay} (${startHours})<br>`;
    } else {
      storeOpening += `${startDay} (${startHours})<br>`;
    }
  }

  const storeOpeningHours = document.createElement('p');
  storeOpeningHours.innerHTML = storeOpening;

  if (hasValue(isExpandable) && isExpandable === 'true') {
    const span = document.createElement('span');
    const paragraphSelector = store.price_amount !== undefined && store.price_amount === '0.00' ? 'p:nth-child(3)' : 'p:nth-child(4)';
    span.textContent = document.querySelector(`.click-n-collect-full div:nth-child(2) > div:nth-child(2) ${paragraphSelector}`).textContent || '';
    storeAvailability.append(span);
    const storeTag = document.createElement('span');
    storeTag.textContent = document.querySelector('.click-n-collect-full div:nth-child(2) > div:nth-child(2) p:nth-child(5)').textContent || '';
    storeName.innerHTML += `<span>${Math.round(store.distance)} km</span>`;
    const storePhone = document.createElement('p');
    storePhone.className = 'phone-no';
    storePhone.textContent = store.store_phone;
    storeAvailability.prepend(storeTag);
    const storeDetails = document.createElement('div');
    storeDetails.classList.add('click-n-collect-store-details');
    const apartmentSegment = store.address.find((addr) => addr.code === 'address_apartment_segment');
    const street = store.address.find((addr) => addr.code === 'street');
    storeAddress.textContent = `${apartmentSegment ? apartmentSegment.value : ''} ${street ? street.value : ''}`.trim();
    storeDetails.append(storeAddress, storePhone, storeOpeningHours);
    storeItemWrapper.append(storeName, storeAvailability, storeDetails);
    storeName.addEventListener('click', () => toggleExpand(storeName, storeDetails));
    document.querySelector('.click-n-collect-content .row-6 div').append(storeItemWrapper);
  } else {
    storeAddress.textContent = store.address.find((addr) => addr.code === 'street').value;
    storeItemWrapper.append(storeName, storeAddress, storeAvailability, storeOpeningHours);
    block.append(storeItemWrapper);
  }
}

function populateCncStoreOnSearch(storeFinderFlag) {
  const storeCount = nearestStore.length;
  const searchAddress = document.querySelector('.click-n-collect-content .row-3 input').value;
  datalayerSearchStore(searchAddress);

  const highlights = document.createElement('p');
  const high1 = document.querySelector('.click-n-collect-content .row-4 p:nth-child(1)').getAttribute('data-text').replace('{{storeCount}}', storeCount);
  const high2 = document.querySelector('.click-n-collect-content .row-4 p:nth-child(2)').getAttribute('data-text').replace('{{storeAddress}}', searchAddress);
  highlights.innerHTML = `${high1}<br>${high2}`;
  while (document.querySelectorAll('.click-n-collect-content .row-4 p').length > 2) {
    document.querySelector('.click-n-collect-content .row-4 p:last-child').remove();
  }
  document.querySelector('.click-n-collect-content .row-4 div').append(highlights);

  // clear and update the new highlights
  document.querySelectorAll('.click-n-collect-content .row-6 div div').forEach((ele) => ele.remove());
  const block = document.querySelector('.click-n-collect-full div:nth-child(2) > div:nth-child(1)');
  const firsth3 = block.querySelector('p:nth-child(1)').getAttribute('data-text');
  const secondh3 = block.querySelector('p:nth-child(2)').getAttribute('data-text').replace('{{storeCount}}', storeCount).replace('{{storeName}}', searchAddress);
  const thirdh3 = block.querySelector('p:nth-child(3)').getAttribute('data-text');

  if (!block.querySelector('p.store-summary')) {
    const p = document.createElement('p');
    p.classList.add('store-summary');
    block.insertBefore(p, block.children[3]);
  }
  const summary = block.querySelector('p.store-summary');
  summary.innerHTML = `${firsth3}<br>${secondh3}<br>${thirdh3}`;
  document.querySelectorAll('.click-n-collect-store-list-wrapper').forEach((ele) => ele.remove());
  nearestStore.forEach((store, index) => {
    if (index < 2) {
      if (hasValue(isExpandable) && isExpandable === 'true') {
        addCncFull(store);
      } else {
        addCncLimited(store, index);
      }
    }
    if (hasValue(isExpandable) && isExpandable === 'false') {
      addCncFull(store);
    }
  });
  // created custom event and dispatch on area selection
  const searchResultEvent = new CustomEvent('searchResultPopulated');
  document.querySelector('.click-n-collect-button').dispatchEvent(searchResultEvent);
  if (!storeFinderFlag) {
    document.querySelector('.click-n-collect-modal.pdp-modal .modal-content').innerHTML = document.querySelector('.click-n-collect-full div:nth-child(2)').outerHTML;
  }
}

async function getCncNearestStore(storeFinderFlag) {
  nearestStore = [];
  await Promise.all(storeData.map(calculateDistanceFromStore));
  // sorting the stores based on distance
  nearestStore.sort((store1, store2) => store1.distance - store2.distance);
  populateCncStoreOnSearch(storeFinderFlag);
}

async function loadGoogleMapsAPI() {
  if (!googleMapsLoaded) {
    await import(`https://maps.googleapis.com/maps/api/js?key=${googleMapKey}&async=true`);
    google = await window.google;
    await google.maps.importLibrary('places');
  }
  googleMapsLoaded = true;
}

async function initCncSearch(storeFinderFlag) {
  const options = {
    componentRestrictions: { country: googleMapRegional },
    fields: ['address_components', 'geometry', 'icon', 'name'],
    strictBounds: false,
  };
  const inputElement = document.querySelector('.row-3 input');
  let autocomplete = null;
  inputElement.addEventListener('input', async (event) => {
    await loadGoogleMapsAPI();
    const inputValue = event.target.value;
    if (inputValue.length < 3 && autocomplete) {
      google.maps.event.clearInstanceListeners(autocomplete);
      autocomplete = null;
      document.querySelectorAll('.pac-container').forEach((ele) => ele.remove());
    }
    if (inputValue.length >= 2 && !autocomplete) {
      autocomplete = new google.maps.places.Autocomplete(inputElement, options);
      autocomplete.setFields(['place_id', 'geometry', 'name']);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
          return;
        }

        const { lat, lng } = place.geometry.location;
        originLat = lat();
        orginLng = lng();
        getCncNearestStore(storeFinderFlag);
      });
    }
  });

  document.querySelector('.click-n-collect-button').addEventListener('searchResultPopulated', () => {
    toggleCncOnSearch(document.querySelector('.click-n-collect-content'));
  });
  document.querySelector('.click-n-collect-input').removeAttribute('disabled');
}

async function initCncData() {
  await getStores(true)
    .then((data) => {
      // extract store data
      storeData = data.items;
    });
}

async function loadCncConfigs() {
  googleMapKey = '' || await getConfigValue('sf-google-maps-key');
  googleMapRegional = '' || await getConfigValue('sf-maps-regional-preference');
  cncRadius = Number('' || await getConfigValue('sf-radius'));
  await initCncData();
}

function getModalTemplate(clickNCollectModal) {
  const cncHeadingNestedDiv = document.createElement('div');
  cncHeadingNestedDiv.appendChild(document.createElement('p'));
  const cncHeadingDiv = document.createElement('div');
  cncHeadingDiv.appendChild(cncHeadingNestedDiv);

  const cncFullDiv = document.createElement('div');
  cncFullDiv.classList.add('click-n-collect-full', 'columns');
  cncFullDiv.appendChild(cncHeadingDiv);
  cncFullDiv.querySelector('p').textContent = clickNCollectModal.firstElementChild.querySelector('h2')?.textContent;

  const divChildEle1 = document.createElement('div');
  const divChildEle2 = document.createElement('div');
  let i = 1;
  clickNCollectModal.querySelectorAll('p').forEach((ele) => {
    if (i <= 3) {
      divChildEle1.appendChild(ele);
    } else {
      divChildEle2.appendChild(ele);
    }
    i += 1;
  });
  const cncFullDetailsDiv = document.createElement('div');
  cncFullDetailsDiv.append(divChildEle1, divChildEle2);
  cncFullDiv.appendChild(cncFullDetailsDiv);

  const modalDiv = document.createElement('div');
  modalDiv.classList.add('columns-wrapper');
  modalDiv.appendChild(cncFullDiv);
  return modalDiv;
}

function createStoreFinderModal(placeholders, modalContent) {
  const sfModal = document.createElement('div');
  sfModal.setAttribute('id', 'click-n-collect-dialog');
  sfModal.classList.add('modal', 'click-n-collect-sf-map-modal', 'hide-modal');
  const sfModalDOM = `<div class="pdp-modal click-n-collect-modal">
    <div class="modal-header">
      <span></span>
      <h4>${placeholders.storeNearbyTitle}</h4>
      <button class="modal-close" type="button" aria-label="${placeholders.ariaLabelClose}">
        <span class="icon icon-close">
          <img alt="${placeholders.ariaLabelClose}">
        </span>
      </button>
    </div>
    <div class="modal-content"></div>
  </div>`;
  sfModal.innerHTML = sfModalDOM;
  sfModal.querySelector('.modal-content').appendChild(modalContent);
  const mainContentBlock = document.querySelector('main');
  mainContentBlock.appendChild(sfModal);
  const modalClose = document.querySelector('#click-n-collect-dialog button');
  modalClose?.addEventListener('click', () => {
    const storeMapModal = document.querySelector('#click-n-collect-dialog');
    const searchInput = document.querySelector('.sf-search-input');
    if (searchInput !== null) {
      searchInput.value = '';
    }
    document.querySelectorAll('.sf-store-list-container').forEach((storeItem) => {
      const sfDistance = storeItem.querySelector('.store-distance p');
      sfDistance.innerHTML = '';
    });
    storeMapModal.classList.toggle('hide-modal');
    document.querySelector('body').classList.remove('modal-open');
  });
  return true;
}

async function loadClickAndCollect(placeholders) {
  // load the fragment
  const container = document.createElement('div');
  container.classList.add('click-n-collect-container', 'pdp-collapsible-container');
  const clickNCollectMain = await loadFragment(`/${document.documentElement.lang}/fragments/pdp/click-and-collect`);
  const clickNCollectModal = await loadFragment(`/${document.documentElement.lang}/fragments/pdp/click-and-collect-popup`);

  const storeFinder = clickNCollectModal.querySelector('.store-finder-container');
  let storeFinderFlag = false;
  if (storeFinder !== null) {
    storeFinderFlag = createStoreFinderModal(placeholders, storeFinder);
  }

  clickNCollectMain.lastElementChild.appendChild(getModalTemplate(clickNCollectModal));

  decorateClickAndCollect(clickNCollectMain, storeFinderFlag);
  container.append(clickNCollectMain.firstElementChild, clickNCollectMain.lastElementChild);

  // append the fragment to container
  const element = document.querySelector('.pdp-product__info-content');
  element.appendChild(container);

  // add toggle action with heading
  const headingElement = document.querySelector('.click-n-collect-container h3');
  headingElement.addEventListener('click', () => toggleExpand(headingElement, document.querySelector('.click-n-collect-container > div:last-child')));

  // lazy load the cnc configs and re-decorate
  window.addEventListener('delayed-loaded', () => {
    loadCncConfigs().then(() => {
      initCncSearch(storeFinderFlag);
      if (!storeFinderFlag) {
        createModalFromContent(`${cncModalId}-dialog`, document.querySelector('.click-n-collect-full > div p').textContent, document.querySelector('.click-n-collect-full div:nth-child(2)').outerHTML, ['pdp-modal', 'click-n-collect-modal']);
      }
    });
  });
}

function updateDeliveryOptions(ctx, placeholders) {
  const deliveryIds = ['express_delivery', 'same_day_delivery', 'next_day_delivery'];
  const deliveryOptions = deliveryIds.map((id) => ({
    id,
    value: ctx.data.attributes.find((a) => a.id === id)?.value === 'yes',
  }));
  const deliveryNotAvailable = placeholders.pdpDeliveryNotAvailable || ' Not Available ';

  if (deliveryOptions.every((option) => !option.value)) {
    deliveryIds.forEach((id) => {
      const deliveryAttribute = Array.from(document.querySelectorAll('.delivery-options-container div'))
        .filter((div) => div.textContent.trim() === `${id}`);
      deliveryAttribute.forEach((attribute) => {
        if (attribute.parentElement) {
          attribute.parentElement.style.display = 'none';
        }
      });
    });
  } else {
    deliveryOptions.forEach((option) => {
      if (!option.value) {
        const deliveryAttribute = document.querySelectorAll('.delivery-options-container div');
        deliveryAttribute.forEach((attribute) => {
          if (attribute.textContent.trim() === option.id) {
            const h5 = attribute.parentElement.querySelector('h5');
            if (h5) {
              h5.textContent += ` ${deliveryNotAvailable}`;
            }
          }
        });
      }
    });
  }
}

function checkProductAttrValue(dataAttr, prop, value) {
  const attr = dataAttr.find((a) => a.id === prop);
  if (attr) {
    return attr.value === value;
  }
  return false;
}

async function loadShare() {
  const { socialShareOverlay } = await loadSocialShareModal();
  // append the fragment to container
  const container = document.querySelector(
    '.pdp-product__content-column .pdp-product__info-content',
  );
  container.after(socialShareOverlay);
}

export default async function infoContentSlot(ctx) {
  const container = document.createElement('div');
  const placeholders = await fetchPlaceholdersForLocale();
  container.classList.add('delivery-options-container', 'pdp-collapsible-container');

  const fragment = await loadFragment(`/${document.documentElement.lang}/fragments/pdp/delivery-options`);
  const deliveryOptions = fragment?.lastElementChild?.querySelector('.delivery-options');

  if (deliveryOptions) {
    container.append(fragment.firstElementChild, fragment.lastElementChild);
    const element = document.querySelector('.pdp-product__info-content');
    element.appendChild(container);
  }

  const headingElement = document.querySelector('.delivery-options-container h3');
  if (headingElement) {
    headingElement.addEventListener('click', () => toggleExpand(headingElement, document.querySelector('.delivery-options-container > div:last-child')));
    updateDeliveryOptions(ctx, placeholders);
  }

  // checking for render condition fo click and collect
  if ((await getConfigValue('click-and-collect-show')).toLowerCase() === 'true'
    && (checkProductAttrValue(ctx.data.attributes, 'ship_to_store', '1')
      || checkProductAttrValue(ctx.data.attributes, 'reserve_and_collect', '1'))) {
    loadClickAndCollect(placeholders);
  }
  // Loading the social-share icon's for desktop view only when we want icons to be showed default.
  const displaySocialShareIcons = await getConfigValue('display-social-share-icons');
  if (hasValue(displaySocialShareIcons) && displaySocialShareIcons === 'true' && !isMobile) {
    loadShare();
  }
}
