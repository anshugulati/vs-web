import {
  fetchPlaceholders,
  decorateIcons,
  loadCSS,
  getMetadata,
} from '../../scripts/aem.js';
import { createModalFromContent, getBrandPath, openModal } from '../../scripts/scripts.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getStores } from '../../scripts/stores/api.js';
import { datalayerSearchStoreFinder } from '../../scripts/analytics/google-data-layer.js';

let storeData = [];
const placeholders = await fetchPlaceholders(`/${document.documentElement.lang}`);
const locationMap = {};
let defaultZoom;
let defaultSelectionZoom;
let defaultCenterLat;
let defaultCenterLng;
let map;
let mapOptions;
const allMarkers = {};
let google;
let googleMapKey;
let googleMapRegional;
let AdvancedMarkerElement;
let PinElement;
let Autocomplete;
const storeInfo = 'store-info';
let currentStoreInfoWindow = null;
let storeInfoContent = null;
let infoWindow = null;
const storeInfoModalId = 'store-info';
let currentLat = null;
let currentLng = null;
let navigationInitialised = false;
let storeMobileTabView;
let nearbyStoresView;
let parentRootBlock;

function initLocationMap() {
  storeData.forEach((store) => {
    const {
      latitude, longitude, store_name: name, store_code: code,
    } = store;
    locationMap[code] = {
      lat: latitude,
      lng: longitude,
      name,
    };
  });
}

/**
 *
 * @param {string} type HTML element type
 * @param {string} classList list of classes to be added to the element
 * @param {HTMLElement} parent parent element to which the new element will be appended
 * @param {string} innerText text content of the new element
 * @returns {HTMLElement} the newly created element
 */
function createMarkupAndAppendToParent(type = 'div', classList = [], parent = null, innerText = '', dataValue = undefined) {
  const element = document.createElement(type);
  classList.forEach((className) => element.classList.add(className));
  element.innerText = innerText;
  if (dataValue) element.setAttribute('data-value', dataValue);
  if (parent !== null) parent.appendChild(element);
  return element;
}

async function calculateDistanceFromStore(store, startPosition = {}) {
  let randomStartPosition = false;
  let from = new google.maps.LatLng(storeData[0].latitude, storeData[0].longitude);

  // if startPosition is set then take that in account for distance calculation
  if (startPosition && startPosition.lat && startPosition.lng) {
    from = new google.maps.LatLng(startPosition.lat, startPosition.lng);
    randomStartPosition = true;
  } else if (currentLat && currentLng) {
    from = new google.maps.LatLng(currentLat, currentLng);
  } else {
    store.storeDistance = null;
    return null;
  }

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

    if (!resp.rows[0].elements[0].distance) {
      if (randomStartPosition) {
        store.searchDistance = null;
      } else {
        store.storeDistance = null;
      }
      return null;
    }
    const distanceMeters = resp.rows[0].elements[0].distance.value;
    const distanceKm = distanceMeters / 1000;
    try {
      if (randomStartPosition) {
        storeData.find((storeL) => storeL.store_code === store.code).searchDistance = distanceKm;
      } else {
        storeData.find((storeL) => storeL.store_code === store.code).storeDistance = distanceKm;
      }
    } catch {
      if (randomStartPosition) {
        store.searchDistance = distanceKm;
      } else {
        store.storeDistance = distanceKm;
      }
    }
    return distanceKm;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function getCompressedOperatingHours(hours) {
  let startDay = null;
  let endDay = null;
  let startHours = null;
  let storeOpening = '';
  hours.forEach((hour) => {
    if (startDay === null) {
      startDay = hour.querySelector('.operating-hours-label').innerText.trim();
      startHours = hour.querySelector('.operating-hours-value').innerText.trim();
    } else if (hour.querySelector('.operating-hours-value').innerText.trim() === startHours) {
      endDay = hour.querySelector('.operating-hours-label').innerText.trim();
    } else {
      if (!endDay) {
        storeOpening += `${startDay} (${startHours})<br>`;
      } else {
        storeOpening += `${startDay} - ${endDay} (${startHours})<br>`;
      }
      startDay = hour.querySelector('.operating-hours-label').innerText.trim();
      startHours = hour.querySelector('.operating-hours-value').innerText.trim();
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

  return storeOpening;
}

function updateNearbyStoreModal(key) {
  const getNearbyStore = parentRootBlock.querySelector(`.sf-store-block-item[data-item-val='${key}']`);
  if (getNearbyStore) {
    const nearByModal = document.querySelector(`#${storeInfoModalId}-nearby-dialog`);
    nearByModal.querySelector('.sf-store-nearby-name').innerText = getNearbyStore.querySelector('.sf-store-name')?.innerHTML;
    nearByModal.querySelector('.sf-store-nearby-distance').innerText = getNearbyStore.querySelector('.store-distance p')?.innerHTML;
    nearByModal.querySelector('.sf-store-nearby-store').innerText = getNearbyStore.querySelector('.sf-store-or-pudo')?.innerHTML;
    nearByModal.querySelector('.sf-store-nearby-collection').innerText = getNearbyStore.querySelector('.sf-store-delviery')?.innerHTML;
    nearByModal.querySelector('.sf-store-nearby-free').innerText = getNearbyStore.querySelector('.sf-store-free-or-paid')?.innerHTML;
    nearByModal.querySelector('.sf-store-nearby-address').innerHTML = getNearbyStore.querySelector('.sf-content-left-detail')?.innerHTML;
  }
}

function updateStoreInfoContent(ele) {
  if (!ele.querySelector(`.${storeInfo}-header`)) {
    createMarkupAndAppendToParent('div', [`${storeInfo}-header`], ele);
  }
  if (!ele.querySelector('.name')) {
    createMarkupAndAppendToParent('div', ['name'], ele.querySelector(`.${storeInfo}-header`), '{{storeName}}', '{{storeName}}');
  }
  if (!ele.querySelector('.distance')) {
    createMarkupAndAppendToParent('div', ['distance'], ele.querySelector(`.${storeInfo}-header`), '{{storeDistance}}', '{{storeDistance}}');
  }
  ele.querySelector('.name').innerText = ele.querySelector('.name').getAttribute('data-value')
    .replace('{{storeName}}', parentRootBlock.querySelector('.sf-content-left-detail .sd-name').innerText);
  ele.querySelector('.distance').innerText = ele.querySelector('.distance').getAttribute('data-value')
    .replace('{{storeDistance}}', parentRootBlock.querySelector('.sf-content-left-detail .sd-distance').innerText);
  ele.querySelector('.address').innerText = ele.querySelector('.address').getAttribute('data-value').replace('{{storeAddress}}', parentRootBlock.querySelector('.sf-content-left-detail .sd-address').innerText);
  ele.querySelector('.availability').innerText = ele.querySelector('.availability').getAttribute('data-value')
    .replace('{{storeAvailability}}', parentRootBlock.querySelector('.sf-content-left-detail .sd-delivery').innerText);
  ele.querySelector('.hours').innerHTML = getCompressedOperatingHours(parentRootBlock.querySelectorAll('.sf-content-left-detail .sd-hours .operating-hours'));
  ele.querySelector('.navigation').setAttribute('data-coordinates', `${parentRootBlock.querySelector('.sf-content-left-detail .sd-lat').innerText},${parentRootBlock.querySelector('.sf-content-left-detail .sd-lng').innerText}`);
}

function closeOverlayAndRevertMarker() {
  Object.values(allMarkers).forEach((m) => {
    m.element.classList.remove('active-marker');
  });
}

async function initGoogleMapsMarker() {
  const i = 1;
  Object.keys(locationMap).forEach((key) => {
    const { lat, lng, name } = locationMap[key];
    const marker = new AdvancedMarkerElement({
      position: { lat: parseFloat(lat), lng: parseFloat(lng) },
      content: new PinElement({
        background: '#FFFFFF',
        borderColor: storeMobileTabView === 'true' ? '#005699' : '#FF0000',
        glyph: i.toString(),
        glyphColor: 'white',
      }).element,
      title: name,
    });
    const imageUrl = storeMobileTabView === 'true' ? '/icons/store-map-logo.svg' : '/icons/logo.svg';
    const imageElement = document.createElement('img');
    imageElement.classList.add('store-marker-img');
    imageElement.src = imageUrl;
    marker.content.appendChild(imageElement);

    marker.addListener('click', () => {
      parentRootBlock.querySelector(`.sf-store-block[data-store-code='${key}']`).click();

      if (storeMobileTabView !== 'true' && nearbyStoresView !== 'true') {
        Object.values(allMarkers).forEach((m) => {
          // Reset image and remove active-marker class for other markers
          m.element.classList.remove('active-marker');
          const img = m.content.querySelector('img');
          img.src = '/icons/logo.svg'; // Set default image
        });
        marker.element.classList.add('active-marker');
        imageElement.src = '/icons/logo-white.svg'; // Set image for active marker

        Object.values(allMarkers).forEach((m) => {
          // Reset image and remove active-marker class for other markers
          m.element.classList.remove('active-marker');
          const img = m.content.querySelector('img');
          img.src = '/icons/logo.svg'; // Set default image
        });
        marker.element.classList.add('active-marker');
        imageElement.src = '/icons/logo-white.svg'; // Set image for active marker
      }

      // Close the currently open InfoWindow if it exists
      if (currentStoreInfoWindow) {
        currentStoreInfoWindow.close();
      }
      const isStoreDetailsActive = document
        .querySelector(`.sf-store-block-item[data-item-val='${key}']`)?.classList.contains('active');
      if (window.matchMedia('(max-width: 768px)').matches) {
        updateStoreInfoContent(document.querySelector('.store-info-modal .store-info'));
        const navigationBtn = document.querySelector('.store-info-modal .navigation');
        navigationBtn.setAttribute('data-coordinates', `${parentRootBlock.querySelector('.sf-content-left-detail .sd-lat').innerText},${parentRootBlock.querySelector('.sf-content-left-detail .sd-lng').innerText}`);
        if (storeMobileTabView !== 'true') {
          openModal(`${storeInfoModalId}-dialog`);
        }
        if (nearbyStoresView !== null && nearbyStoresView === 'true') {
          document
            .querySelector(`.sf-store-block-item[data-item-val='${key}']`)?.click();
          updateNearbyStoreModal(key);
          const modalTitle = document.querySelector('.store-info-nearby-modal .modal-header h4');
          modalTitle.innerHTML = placeholders.storeDetails;
          openModal(`${storeInfoModalId}-nearby-dialog`);
        }
      } else if (storeMobileTabView !== 'true') {
        updateStoreInfoContent(storeInfoContent);
        infoWindow = new google.maps.InfoWindow({
          content: storeInfoContent,
        });
        // Open the new InfoWindow and set it as the current one
        infoWindow.open(marker.map, marker);
        currentStoreInfoWindow = infoWindow;
        google.maps.event.addListener(infoWindow, 'domready', () => {
          const headerBtn = parentRootBlock.querySelector('.gm-ui-hover-effect').parentElement;
          headerBtn.querySelector('div').appendChild(parentRootBlock.querySelector('.store-info-header'));
          headerBtn.addEventListener('click', closeOverlayAndRevertMarker);
        });

        // Handle InfoWindow close event
        google.maps.event.addListener(infoWindow, 'closeclick', () => {
          // Add the active-marker class back and reset the image
          marker.element.classList.remove('active-marker');
          imageElement.src = '/icons/logo.svg'; // Reset image when InfoWindow closes
        });

        // Handle InfoWindow close event
        google.maps.event.addListener(infoWindow, 'closeclick', () => {
          // Add the active-marker class back and reset the image
          marker.element.classList.remove('active-marker');
          imageElement.src = '/icons/logo.svg'; // Reset image when InfoWindow closes
        });
      } else if (!isStoreDetailsActive) {
        document
          .querySelector(`.sf-store-block-item[data-item-val='${key}']`)?.click();
      }
    });

    marker.content.addEventListener('mouseover', (event) => {
      parentRootBlock.querySelectorAll('.GMAMP-maps-pin-view')?.forEach((markerEle) => {
        markerEle.classList.remove('active');
      });
      const currentTarget = event.target;
      currentTarget.closest('.GMAMP-maps-pin-view')?.classList.add('active');
    });

    marker.content.addEventListener('mouseout', () => {
      parentRootBlock.querySelectorAll('.GMAMP-maps-pin-view')?.forEach((markerEle) => {
        markerEle.classList.remove('active');
      });
    });
    allMarkers[key] = marker;
  });
}

async function initData() {
  await getStores()
    .then((data) => {
      // extract store data
      storeData = data.items;

      // initialise location map coordinates for each store
      initLocationMap();

      // create markers for each store
      initGoogleMapsMarker();
    });
}

function decorateSFTitle(block) {
  const title = createMarkupAndAppendToParent('div', ['sf-title'], block);
  const arrowDir = (document.querySelector('html').getAttribute('dir') === 'rtl') ? 'right' : 'left';
  const headBackNav = createMarkupAndAppendToParent('span', ['icon', `icon-arrow-${arrowDir}`, 'head-back-nav'], title);
  createMarkupAndAppendToParent('h5', ['sf-heading'], title, placeholders.sfTitle);
  decorateIcons(title);

  headBackNav.addEventListener('click', () => {
    map.setZoom(Number(defaultZoom));
    map.panTo({
      lat: Number(defaultCenterLat),
      lng: Number(defaultCenterLng),
    });
    if (allMarkers.search) allMarkers.search.setMap(null);
  });
}

function normaliseStoreDetail(store) {
  const storeItem = {};
  storeItem.name = store.store_name;
  storeItem.latitude = store.latitude;
  storeItem.longitude = store.longitude;
  storeItem.address = store.address.reduce((acc, { code, value }) => {
    acc[code] = value;
    return acc;
  }, {});
  storeItem.id = store.store_id;
  storeItem.code = store.store_code;
  storeItem.email = store.store_email;
  storeItem.phone = store.store_phone;
  storeItem.hours = store.store_hours.reduce((acc, { label, value }) => {
    acc[label] = value;
    return acc;
  }, {});
  storeItem.deliveryTimeLabel = store.sts_delivery_time_label;
  return storeItem;
}

function decorateDistanceFromStore(block, store) {
  const storeX = storeData.find((storeL) => storeL.store_code === store.code
  && storeL.pudo_service === 0 && storeL.status === 1);
  if (!storeX) {
    return;
  }
  if (!storeX.storeDistance && storeX.storeDistance !== 0) {
    calculateDistanceFromStore(store);
  }
  let displayDistance = storeX.storeDistance ? `${storeX.storeDistance.toFixed(1)} KM` : '';
  if (displayDistance === '' && storeX.storeDistance === 0) {
    displayDistance = '0.0 KM';
  }
  if (storeX.searchDistance !== 0 && parentRootBlock.querySelector('.sf-search-input')?.value) {
    displayDistance = storeX.searchDistance ? `${storeX.searchDistance.toFixed(1)} KM` : '';
  }
  const storeDistance = createMarkupAndAppendToParent(
    'div',
    ['store-distance'],
    null,
    displayDistance,
  );
  const iconDistance = createMarkupAndAppendToParent('span', [
    'icon',
    'icon-distance',
    'icon-expand',
  ]);
  if (storeMobileTabView === 'true') {
    const distanceSpan = createMarkupAndAppendToParent(
      'div',
      ['store-distance'],
      null,
    );
    createMarkupAndAppendToParent('p', [], distanceSpan, displayDistance);
    distanceSpan.appendChild(iconDistance);
    block.parentElement
      .querySelector('.sf-store-block-item-entry')
      ?.appendChild(distanceSpan);
  } else {
    block.appendChild(storeDistance);
    block.appendChild(iconDistance);
  }
}

function initStoreDetailData(store) {
  // add the store detail page
  map.panTo(allMarkers[store.code].position);
  parentRootBlock.querySelector('.sd-name').innerText = store.name;
  parentRootBlock.querySelector('.sd-address').innerText = store.address.street;
  parentRootBlock.querySelector('.sd-delivery').innerText = store.deliveryTimeLabel;
  parentRootBlock.querySelector('.sd-distance').innerText = store.storeDistance;
  parentRootBlock.querySelector('.sd-lng').innerText = store.longitude;
  parentRootBlock.querySelector('.sd-lat').innerText = store.latitude;
  if (storeMobileTabView === 'true') {
    parentRootBlock.querySelector('.sf-mobile-header-name').innerText = store.name;
    parentRootBlock.querySelector('.sf-content-mobile-body').innerText = store.address.street;
    parentRootBlock.querySelector('.sf-mobile-header-distance').innerText = store.storeDistance;
    const mobileGetDirection = parentRootBlock.querySelector('.sf-content-mobile-get-direction');
    mobileGetDirection.setAttribute('target', '_blank');
    mobileGetDirection.setAttribute('href', `https://www.google.com/maps/dir/Current+Location/${parentRootBlock.querySelector('.sf-content-left-detail .sd-lng').innerText.trim()},${parentRootBlock.querySelector('.sf-content-left-detail .sd-lat').innerText.trim()}`);
  }

  const phoneContact = parentRootBlock.querySelector('.sd-phone');
  phoneContact.innerHTML = '';
  store.phone.split('/').forEach((phone) => {
    createMarkupAndAppendToParent('span', ['contact'], phoneContact, phone);
  });
  const openingHours = parentRootBlock.querySelector('.sd-hours');
  openingHours.innerHTML = '';
  Object.keys(store.hours).map((key) => {
    const opsHours = createMarkupAndAppendToParent('div', ['operating-hours'], openingHours);
    createMarkupAndAppendToParent('span', ['operating-hours-label'], opsHours, key);
    createMarkupAndAppendToParent('span', ['operating-hours-value'], opsHours, store.hours[key]);
    return opsHours;
  });
  if (!navigationInitialised) {
    parentRootBlock.querySelector('.sd-navigation').addEventListener('click', () => {
      window.open(`https://www.google.com/maps/dir/Current+Location/${parentRootBlock.querySelector('.sf-content-left-detail .sd-lng').innerText.trim()},${parentRootBlock.querySelector('.sf-content-left-detail .sd-lat').innerText.trim()}`, '_blank');
    });
    navigationInitialised = true;
  }
}

async function decorateStoreItem(block, store) {
  if (store.pudo_service === 1 || (store.pudo_service === 0 && store.status === 0)) {
    return;
  }
  const storeX = normaliseStoreDetail(store);
  const storeBlock = createMarkupAndAppendToParent('div', ['sf-store-block'], block);
  storeBlock.setAttribute('data-store-code', storeX.code);
  const storeItem = createMarkupAndAppendToParent('div', ['sf-store-block-item'], storeBlock);
  const storeItemEntry = createMarkupAndAppendToParent('div', ['sf-store-block-item-entry'], storeItem);
  if (nearbyStoresView === 'true') {
    const storeItemDelivery = createMarkupAndAppendToParent('div', ['sf-store-block-delivery-details'], storeItem);
    createMarkupAndAppendToParent('span', ['sf-store-or-pudo'], storeItemDelivery, (store.sts_service === 1) ? placeholders.storeLabel : '');
    createMarkupAndAppendToParent('span', ['sf-store-delviery'], storeItemDelivery, (store.sts_delivery_time_label !== '') ? `${placeholders.storeCollection} ${store.sts_delivery_time_label}` : `${placeholders.storeCollection} ${placeholders.storeAvailability}`);
    createMarkupAndAppendToParent('span', ['sf-store-free-or-paid'], storeItemDelivery, (store.price_amount === '0.00') ? placeholders.storeFree : placeholders.storePaid);
  }
  const storeItemDist = createMarkupAndAppendToParent('div', ['sf-store-block-item-dist'], storeItem);
  if (storeMobileTabView === 'true') {
    createMarkupAndAppendToParent('div', ['sf-store-block-item-details', 'hidden'], storeItemDist);
  }
  createMarkupAndAppendToParent('a', ['sf-store-name'], storeItemEntry, storeX.name);
  createMarkupAndAppendToParent('div', ['sf-store-address'], storeItemEntry, storeX.address.street);
  createMarkupAndAppendToParent('div', ['sf-store-phone'], storeItemEntry, storeX.phone.replaceAll('/', ', ').trim());
  createMarkupAndAppendToParent('hr', [], storeBlock);
  // check distance between current location and store
  Promise.all([
    decorateDistanceFromStore(storeItemDist, storeX),
  ]).then(() => {
    // Code to execute after all function calls are completed
    // place a marker of only those listed on the list view if not already placed
    if (!allMarkers[storeX.code].metadata) {
      allMarkers[storeX.code].setMap(map);
      allMarkers[storeX.code].metadata = {
        marked: true,
      };
    }
  }).catch((error) => {
    console.error(error);
  });

  // add event listener to store block on click to show store detail
  storeBlock.addEventListener('click', (event) => {
    let ele = event.target;
    if (!ele.classList.contains('sf-store-block')) {
      ele = event.target.closest('.sf-store-block');
    }
    storeX.storeDistance = ele.querySelector('.store-distance').innerText;
    map.setZoom(Number(defaultSelectionZoom));
    initStoreDetailData(storeX);
    const title = parentRootBlock.querySelector('.sf-content-left-detail .sd-name').innerText;
    const targetMarker = Object.entries(allMarkers)
      .filter(([key]) => allMarkers[key].targetElement.title === title)
      .map(([key]) => allMarkers[key]);
    if (
      targetMarker
      && targetMarker.length > 0
      && storeMobileTabView !== 'true'
    ) {
      google.maps.event.trigger(targetMarker[0], 'click');
    }
  });
  if (storeMobileTabView === 'true') {
    storeItem.setAttribute('data-item-val', storeX.code);
    storeItem.addEventListener('click', (event) => {
      const ele = event.currentTarget;
      ele.classList.add('active');
      const getStoreId = ele.getAttribute('data-item-val');
      const expandIcon = ele.querySelector('.icon');
      const itemDetails = ele.querySelector('.sf-store-block-item-details');
      document
        .querySelectorAll('.sf-store-block-item')
        ?.forEach((storeElement) => {
          const currentStoreNo = storeElement.getAttribute('data-item-val');
          if (currentStoreNo !== getStoreId) {
            const detailsSection = storeElement.querySelector(
              '.sf-store-block-item-details',
            );
            const accordionIcon = storeElement.querySelector('.icon');
            detailsSection.classList.add('hidden');
            accordionIcon.classList.remove('icon-collapse');
            accordionIcon.classList.add('icon-expand');
          }
        });
      const cloneStoreDetails = parentRootBlock.querySelector('.sf-content-left-detail');
      // eslint-disable-next-line no-unused-expressions
      cloneStoreDetails !== null ? itemDetails.append(cloneStoreDetails) : '';
      if (expandIcon.classList.contains('icon-expand')) {
        expandIcon.classList.add('icon-collapse');
        expandIcon.classList.remove('icon-expand');
        itemDetails.classList.remove('hidden');
      } else {
        ele.classList.remove('active');
        itemDetails.classList.add('hidden');
        expandIcon.classList.remove('icon-collapse');
        expandIcon.classList.add('icon-expand');
      }
    });
  }
}

function decorateStoreList(block) {
  const storeList = createMarkupAndAppendToParent('div', [
    'sf-store-list-container',
  ]);
  if (
    storeMobileTabView === 'true'
    && parentRootBlock.querySelectorAll('.sf-content-left-detail').length > 0
    && window.matchMedia('(max-width: 768px)').matches
  ) {
    const mapTab = parentRootBlock.querySelector('.map-view');
    const listTab = parentRootBlock.querySelector('.list-view');
    listTab?.classList.remove('inactive');
    listTab?.classList.add('active');
    mapTab?.classList.add('inactive');
    mapTab?.classList.remove('active');
  }
  if (
    storeMobileTabView === 'true'
    && parentRootBlock.querySelectorAll('.sf-content-left-detail').length > 0
    && window.matchMedia('(max-width: 768px)').matches
  ) {
    parentRootBlock.querySelector('.sf-content .sf-store-list-container')?.remove();
    const getStoreContent = parentRootBlock.querySelector('.sf-content-left-detail');
    getStoreContent.before(storeList);
  } else {
    document
      .querySelector('.sf-content-left-list .sf-store-list-container')
      ?.remove();
    block.appendChild(storeList);
  }
  storeData.forEach((store) => {
    Promise.all([decorateStoreItem(storeList, store)])
      .then(() => {
        // Code to execute after all function calls are completed
      })
      .catch((error) => {
        console.error(error);
      });
  });
  return storeList;
}

function decorateSortedStoreList(sortBy = 'storeName') {
  if (sortBy === 'userDistance' && currentLat && currentLng) {
    storeData.sort((a, b) => {
      if (a.storeDistance === null) {
        return 1;
      }
      if (b.storeDistance === null) {
        return -1;
      }
      return a.storeDistance - b.storeDistance;
    });
  } else if (sortBy === 'searchDistance') {
    storeData.sort((a, b) => {
      if (a.searchDistance === null) {
        return 1;
      }
      if (b.searchDistance === null) {
        return -1;
      }
      return a.searchDistance - b.searchDistance;
    });
  } else {
    storeData.sort((a, b) => a.store_name.localeCompare(b.store_name));
  }
  if (storeMobileTabView === 'true') {
    // eslint-disable-next-line no-use-before-define
    decorateStoreDetail(parentRootBlock.querySelector('.sf-content'));
  }
  decorateStoreList(parentRootBlock.querySelector('.sf-content-left-list'));
}

function initSearchInput(inputBlock) {
  if (!storeData[0]) {
    return;
  }

  // Create a bounding box with sides ~10km away from the center point
  const center = { lat: storeData[0].latitude, lng: storeData[0].longitude };
  const defaultBounds = {
    north: parseFloat(center.lat) + 0.1,
    south: parseFloat(center.lat) - 0.1,
    east: parseFloat(center.lng) + 0.1,
    west: parseFloat(center.lng) - 0.1,
  };
  const countryRegional = googleMapRegional || placeholders.sfGoogleMapsRegional;
  const options = {
    bounds: defaultBounds,
    componentRestrictions: { country: countryRegional },
    fields: ['address_components', 'geometry', 'icon', 'name'],
    strictBounds: false,
  };
  const autocomplete = new Autocomplete(inputBlock, options);
  autocomplete.setFields(['place_id', 'geometry', 'name']);
  autocomplete.addListener('place_changed', async () => {
    parentRootBlock.querySelector('.store-info-header')?.parentElement?.parentElement?.querySelector('button[aria-label=Close]')?.click();
    const place = autocomplete.getPlace();
    if (!place.geometry) {
      return;
    }
    const { lat, lng } = place.geometry.location;
    const marker = new AdvancedMarkerElement({
      position: { lat: lat(), lng: lng() },
      title: place.name,
      content: new PinElement({
        background: '#FFFFFF',
        borderColor: storeMobileTabView === 'true' ? '#005699' : '#FF0000',
        glyphColor: 'white',
      }).element,
    });
    marker.setMap(null);
    const imageUrl = storeMobileTabView === 'true' ? '/icons/store-map-logo.svg' : '/icons/logo.svg';
    const imageElement = document.createElement('img');
    imageElement.classList.add('store-marker-img');
    imageElement.src = imageUrl;
    marker.content.appendChild(imageElement);
    allMarkers.search = marker;
    map.setZoom(Number(defaultSelectionZoom));
    map.panTo(marker.position);
    await Promise.all(
      storeData.map((store) => calculateDistanceFromStore(store, { lat: lat(), lng: lng() })),
    );
    decorateSortedStoreList('searchDistance');
    const searchedTerm = parentRootBlock.querySelector('.sf-search-input').value;
    datalayerSearchStoreFinder(searchedTerm);
  });
}

function decorateSearchInput(block) {
  const searchInputContainer = createMarkupAndAppendToParent('div', ['sf-search-input-container'], block);
  createMarkupAndAppendToParent('span', ['icon', 'search-icon'], searchInputContainer);
  const searchInput = createMarkupAndAppendToParent('input', ['sf-search-input'], searchInputContainer);
  if (storeMobileTabView === 'true') {
    searchInput.setAttribute('placeholder', placeholders.storeSearchPlaceholder);
  } else {
    searchInput.setAttribute('placeholder', placeholders.sfSearchPlaceholder);
  }
  initSearchInput(searchInput);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value === '') {
      allMarkers.search.setMap(null);
      map.setZoom(Number(defaultZoom));
      map.panTo({
        lat: Number(defaultCenterLat),
        lng: Number(defaultCenterLng),
      });
      decorateSortedStoreList('userDistance');
    }
  });
  return searchInputContainer;
}

function decorateByUserDistance() {
  const marker = new AdvancedMarkerElement({
    position: { lat: parseFloat(currentLat), lng: parseFloat(currentLng) },
  });
  map.panTo(marker.position);
  storeData.forEach((store) => { store.searchDistance = 0; });
  decorateSortedStoreList('userDistance');
}

function getCurrentLocation() {
  return new Promise((resolve) => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve({ latitude, longitude });
      },
      (error) => {
        console.warn('Geolocation error or permissions denied by end user:', error);
        resolve(null);
      },
    );
  });
}

function setLatAndLngValues(location) {
  const { latitude, longitude } = location;
  currentLat = latitude;
  currentLng = longitude;
}

async function decorateLocateMe(block) {
  const locateMeContainer = createMarkupAndAppendToParent('div', ['locate-me-container'], block);
  if (storeMobileTabView === 'true') {
    const getStoreContent = parentRootBlock.querySelector(
      '.sf-search-input-container',
    );
    getStoreContent.appendChild(locateMeContainer);
  } else {
    block.appendChild(locateMeContainer);
  }
  createMarkupAndAppendToParent('span', ['icon', 'sf-locate'], locateMeContainer);
  createMarkupAndAppendToParent('a', ['near-me'], locateMeContainer, placeholders.sfNearMe);

  // add event listener to locate me button on click
  locateMeContainer.addEventListener('click', () => {
    if (currentLat && currentLng) {
      decorateByUserDistance();
    } else {
      console.log('Geolocation is either not supported or blocked by this browser.');
      getCurrentLocation().then(async (location) => {
        if (location) {
          setLatAndLngValues(location);
          await Promise.all(
            storeData.map((store) => calculateDistanceFromStore(store, {})),
          );
          decorateByUserDistance();
        }
      });
    }
  });
  return locateMeContainer;
}

function decorateStoreContentNavigation(block) {
  const leftNav = createMarkupAndAppendToParent('div', ['sf-content-left-list'], block);
  decorateSearchInput(leftNav);
  decorateLocateMe(leftNav);
  // decorateStoreList(leftNav);
  decorateSortedStoreList('storeName');
}

function decorateStoreDetail(block) {
  const leftNav = createMarkupAndAppendToParent('div', ['sf-content-left-detail'], block);
  const backNavigation = createMarkupAndAppendToParent('span', ['icon', 'icon-arrow-left', 'details-back-nav'], leftNav);
  createMarkupAndAppendToParent('a', ['sf-back'], backNavigation, placeholders.sfBack);
  createMarkupAndAppendToParent('h5', ['sd-name'], leftNav);
  createMarkupAndAppendToParent('div', ['sd-address'], leftNav);
  createMarkupAndAppendToParent('div', ['sd-phone'], leftNav);
  createMarkupAndAppendToParent('div', ['sd-opening-hours'], leftNav, placeholders.sfOpeningHours);
  createMarkupAndAppendToParent('div', ['sd-hours'], leftNav);
  createMarkupAndAppendToParent('div', ['sd-delivery'], leftNav);
  createMarkupAndAppendToParent('div', ['sd-distance'], leftNav);
  createMarkupAndAppendToParent('div', ['sd-lng'], leftNav);
  createMarkupAndAppendToParent('div', ['sd-lat'], leftNav);

  const getDir = createMarkupAndAppendToParent('div', ['sd-navigation'], leftNav);
  createMarkupAndAppendToParent('a', ['sd-navigation-text'], getDir, placeholders.sfGetDirections);
  createMarkupAndAppendToParent('span', ['icon', 'icon-get-directions'], getDir);

  // add event listener to back navigation on click
  backNavigation.addEventListener('click', () => {
    map.setZoom(Number(defaultZoom));
    map.panTo({
      lat: Number(defaultCenterLat),
      lng: Number(defaultCenterLng),
    });
    if (allMarkers.search) allMarkers.search.setMap(null);
  });

  // decorate icons
  decorateIcons(leftNav);
}

async function initiateGoogleMap(block) {
  const mapBlock = document.createElement('div');
  mapBlock.classList.add('sf-content-map-view');
  block.appendChild(mapBlock);

  if (!google) {
    return;
  }

  // set the map default options
  mapOptions = {
    zoom: Number(defaultZoom),
    center: new google.maps.LatLng(Number(defaultCenterLat), Number(defaultCenterLng)),
    mapId: 'ALSHAYA_MAP_ID',
  };
  map = new google.maps.Map(mapBlock, mapOptions);
  // Skipped marking all stores, instead selectively mark from decorateStoreItem method
  // Object.values(allMarkers).forEach((marker) => marker.setMap(map));
}

function decorateStoreContentMaps(block) {
  const rightNav = createMarkupAndAppendToParent('div', ['sf-content-right'], block);
  const storeMobileDetails = createMarkupAndAppendToParent('div', [
    'sf-content-mobile-details',
  ]);
  const storeMobileHeader = createMarkupAndAppendToParent(
    'div',
    ['sf-content-mobile-header'],
    storeMobileDetails,
  );
  createMarkupAndAppendToParent(
    'h5',
    ['sf-mobile-header-name'],
    storeMobileHeader,
  );
  createMarkupAndAppendToParent(
    'span',
    ['sf-mobile-header-distance'],
    storeMobileHeader,
  );
  createMarkupAndAppendToParent(
    'div',
    ['sf-content-mobile-body'],
    storeMobileDetails,
  );
  const storeMobileFooter = createMarkupAndAppendToParent(
    'div',
    ['sf-content-mobile-footer'],
    storeMobileDetails,
  );
  createMarkupAndAppendToParent(
    'a',
    ['sd-navigation-text', 'sf-content-mobile-get-direction'],
    storeMobileFooter,
    placeholders.sfGetDirections,
  );
  initiateGoogleMap(createMarkupAndAppendToParent('div', ['sf-content-map-container'], rightNav));
  rightNav.appendChild(storeMobileDetails);
}

function decorateSFContent(block) {
  createMarkupAndAppendToParent('hr', [], block);
  const content = createMarkupAndAppendToParent('div', ['sf-content'], block);
  decorateStoreContentNavigation(content);
  decorateStoreDetail(content);
  decorateStoreContentMaps(content);
  return content;
}

function decorateStoreFinder(block) {
  decorateSFTitle(block);
  decorateSFContent(block);
}

async function loadConfigs() {
  defaultCenterLat = '' || await getConfigValue('sf-maps-center-lat');
  defaultCenterLng = '' || await getConfigValue('sf-maps-center-lng');
  defaultZoom = '' || await getConfigValue('sf-maps-default-zoom-preference');
  defaultSelectionZoom = '' || await getConfigValue('sf-maps-selection-zoom-preference');
  googleMapKey = '' || await getConfigValue('sf-google-maps-key');
  googleMapRegional = '' || await getConfigValue('sf-maps-regional-preference');
  googleMapRegional = '' || await getConfigValue('sf-maps-regional-preference');
  await import(`https://maps.googleapis.com/maps/api/js?key=${googleMapKey}&async=true`);
  google = await window.google;
  const markerLibrary = await google.maps.importLibrary('marker');
  AdvancedMarkerElement = markerLibrary.AdvancedMarkerElement;
  PinElement = markerLibrary.PinElement;
  const placesLibrary = await google.maps.importLibrary('places');
  Autocomplete = placesLibrary.Autocomplete;
  storeInfoContent = createMarkupAndAppendToParent('div', [storeInfo]);
  const collectPrompt = placeholders.sfCollectPrompt || 'Collect in store within';
  const storeInfoHeaderParent = createMarkupAndAppendToParent('div', ['store-info-header-parent'], storeInfoContent);
  const storeInfoHeader = createMarkupAndAppendToParent('div', ['store-info-header'], storeInfoHeaderParent);
  createMarkupAndAppendToParent('div', ['name'], storeInfoHeader, '{{storeName}}', '{{storeName}}');
  createMarkupAndAppendToParent('div', ['distance'], storeInfoHeader, '{{storeDistance}}', '{{storeDistance}}');
  createMarkupAndAppendToParent('div', ['address'], storeInfoContent, '{{storeAddress}}', '{{storeAddress}}');
  createMarkupAndAppendToParent('div', ['availability'], storeInfoContent, '{{storeAvailability}}', `${collectPrompt} {{storeAvailability}}`);
  createMarkupAndAppendToParent('div', ['hours'], storeInfoContent, '{{storeHours}}', '{{storeHours}}');
  const navigationDiv = createMarkupAndAppendToParent('div', ['navigation'], storeInfoContent, '', '{{storeNavigation}}');
  createMarkupAndAppendToParent('a', ['navigation-text'], navigationDiv, placeholders.sfGetDirections);
  createMarkupAndAppendToParent('span', ['icon', 'icon-get-directions'], navigationDiv);
  decorateIcons(navigationDiv);
  navigationDiv.addEventListener('click', () => {
    const coordinates = navigationDiv.getAttribute('data-coordinates').split(',');
    window.open(`https://www.google.com/maps/dir/Current+Location/${coordinates[0].trim()},${coordinates[1].trim()}`, '_blank');
  });
  await initData();
  await Promise.all(storeData.map(calculateDistanceFromStore));
  await createModalFromContent(`${storeInfoModalId}-dialog`, '', storeInfoContent.outerHTML, [`${storeInfo}-modal`]);
  const modalClose = document.querySelector(`.${storeInfo}-modal .modal-header > button`);
  document.querySelector(`.${storeInfo}-modal .store-info-header-parent`).appendChild(modalClose);
  document.querySelector('.store-info-modal .navigation').addEventListener('click', (e) => {
    const coordinates = e.target.closest('.navigation').getAttribute('data-coordinates').split(',');
    window.open(`https://www.google.com/maps/dir/Current+Location/${coordinates[0].trim()},${coordinates[1].trim()}`, '_blank');
  });
  if (nearbyStoresView === 'true') {
    /* Nearby store details - Modal */
    const nearbyStoreDetailsDom = createMarkupAndAppendToParent('div', ['store-nearby-info']);
    const nearByTitle = createMarkupAndAppendToParent('div', ['sf-store-nearby-title'], nearbyStoreDetailsDom);
    createMarkupAndAppendToParent('span', ['sf-store-nearby-name'], nearByTitle);
    createMarkupAndAppendToParent('span', ['sf-store-nearby-distance'], nearByTitle);
    const nearByDetails = createMarkupAndAppendToParent('div', ['sf-store-nearby-details'], nearbyStoreDetailsDom);
    createMarkupAndAppendToParent('span', ['sf-store-nearby-store'], nearByDetails);
    createMarkupAndAppendToParent('span', ['sf-store-nearby-collection'], nearByDetails);
    createMarkupAndAppendToParent('span', ['sf-store-nearby-free'], nearByDetails);
    const nearByAddress = createMarkupAndAppendToParent('div', ['sf-store-nearby-address'], nearbyStoreDetailsDom);
    createMarkupAndAppendToParent('span', ['sf-store-nearby-address'], nearByAddress);
    createMarkupAndAppendToParent('span', ['sf-store-nearby-opening'], nearByAddress);
    await createModalFromContent(`${storeInfoModalId}-nearby-dialog`, '', nearbyStoreDetailsDom.outerHTML, [`${storeInfo}-nearby-modal`]);
  }
}

function decorateBlockSkeleton(block) {
  decorateStoreFinder(block);
  const listContainer = block.querySelector('.sf-store-list-container');
  const mapContainer = block.querySelector('.sf-content-map-view');
  for (let i = 0; i < 10; i += 1) {
    const storeItem = createMarkupAndAppendToParent('div', ['sf-store-block', 'item-skeleton'], listContainer);
    createMarkupAndAppendToParent('div', ['sf-store-block-item'], storeItem);
    createMarkupAndAppendToParent('div', ['sf-store-block-item'], storeItem);
    createMarkupAndAppendToParent('hr', [], storeItem);
  }
  createMarkupAndAppendToParent('div', ['sf-store-map-item', 'map-skeleton'], mapContainer);
}

async function createStoreMobileTabView(block) {
  const notifyWrapper = createMarkupAndAppendToParent('div', [
    'store-location-perm-alert',
  ]);
  createMarkupAndAppendToParent(
    'span',
    ['store-alert-warning', 'icon', 'warning-icon'],
    notifyWrapper,
    '',
  );
  createMarkupAndAppendToParent(
    'span',
    ['store-alert-message'],
    notifyWrapper,
    placeholders.storeLocationWarning,
  );
  const dismissWarning = createMarkupAndAppendToParent(
    'span',
    ['store-alert-dismiss'],
    notifyWrapper,
    'Dismiss',
  );
  dismissWarning.addEventListener('click', () => {
    const notifyMessage = parentRootBlock.querySelector('.store-location-perm-alert');
    const searchContainer = parentRootBlock.querySelector('.sf-search-input-container');
    notifyMessage.style.display = 'none';
    searchContainer.classList.add('add-top-margin');
  });

  /* Create tabs for mobile */
  const tabBlock = document.createElement('div');
  tabBlock.classList.add('sf-tabs-wrapper');
  const tabList = [placeholders.storeListView, placeholders.storeMapView];

  tabList.forEach((element, ind) => {
    const tabChild = document.createElement('div');
    const tabAction = document.createElement('span');
    tabAction.classList.add(element?.replace(' ', '-').toLowerCase());
    if (ind === 0) {
      tabChild.setAttribute('class', 'active sf-mobile-tab-item list-view');
    } else {
      tabChild.setAttribute('class', 'inactive sf-mobile-tab-item map-view');
    }
    tabAction.innerHTML += element;
    tabChild.addEventListener('click', (event) => {
      const showMap = parentRootBlock.querySelector('.sf-content-map-view');
      const showList = parentRootBlock.querySelector('.sf-store-list-container');
      const ele = event.target?.parentElement;
      parentRootBlock.querySelectorAll('.sf-mobile-tab-item')?.forEach((tempEle) => {
        tempEle.classList.remove('active');
        tempEle.classList.add('inactive');
      });
      if (ele.classList.contains('sf-mobile-tab-item')) {
        ele.classList.add('active');
        ele.classList.remove('inactive');
      } else {
        event.target.classList?.add('active');
        event.target.classList?.remove('inactive');
      }
      const activeElements = parentRootBlock.querySelector('.sf-tabs-wrapper .active');
      const showStoreDetails = parentRootBlock.querySelector(
        '.sf-content-right .sf-content-mobile-details',
      );
      const showStoreName = parentRootBlock.querySelector(
        '.sf-content-right .sf-content-mobile-details .sf-mobile-header-name',
      );
      if (activeElements.querySelectorAll('.map-view')?.length > 0) {
        showMap.classList.toggle('show-map');
        showList.classList.toggle('hide-list');
        showStoreDetails.classList.add(showStoreName?.innerText.length > 0 && nearbyStoresView !== 'true' ? 'show-store-details' : 'hide-store-details');
      } else {
        showMap.classList.toggle('show-map');
        showList.classList.toggle('hide-list');
        showStoreDetails.classList.remove('show-store-details');
        showStoreDetails.classList.add('hide-store-details');
      }
    });
    tabChild.append(tabAction);
    tabBlock.appendChild(tabChild);
  });
  if (window.matchMedia('(max-width: 768px)').matches) {
    const getStoreContent = block.querySelector('.sf-content-left-detail');
    const getStoreList = block.querySelector('.sf-store-list-container');
    getStoreContent.before(tabBlock);
    getStoreContent.before(getStoreList);
    block.prepend(notifyWrapper);
  } else {
    const getLeftContent = parentRootBlock.querySelector('.sf-content-left-list');
    getLeftContent.prepend(notifyWrapper);
  }
  navigator.geolocation.getCurrentPosition(() => {
    const searchContainer = parentRootBlock.querySelector('.sf-search-input-container');
    const notifyMessage = parentRootBlock.querySelector('.store-location-perm-alert');
    notifyMessage.style.display = 'none';
    const locationIcon = parentRootBlock.querySelector('.sf-locate');
    locationIcon.classList.add('active');
    searchContainer.classList.add('add-top-margin');
  });
}

export async function fetchAndExtractMeta(url) {
  try {
    let doc = document;
    if (url && window.fragmentCacheForBanners[url]) {
      const parser = new DOMParser();
      doc = parser.parseFromString(window.fragmentCacheForBanners[url], 'text/html');
    } else if (url) {
      // Fetch the HTML document from the given URL
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'max-age 60',
        },
      });

      // Ensure the request was successful
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // Get the text content of the fetched HTML
      const htmlString = await response.text();

      // Parse the HTML content into a DOM object
      const parser = new DOMParser();
      doc = parser.parseFromString(htmlString, 'text/html');
    }
    // Extract the desired meta tags using querySelector or querySelectorAll
    const storeMobileTabViewMeta = doc.querySelector('meta[name="store-mobile-tab-view"]');
    const nearbyStoresViewMeta = doc.querySelector('meta[name="nearby-stores-view"]');

    // Extract the content attribute from each meta tag
    storeMobileTabView = storeMobileTabViewMeta ? storeMobileTabViewMeta.getAttribute('content') : null;
    nearbyStoresView = nearbyStoresViewMeta ? nearbyStoresViewMeta.getAttribute('content') : null;
  } catch (error) {
    console.error('Error fetching HTML:', error);
  }

  return null;
}

export default async function decorate(block) {
  const pathWrapper = block.parentElement.parentElement.parentElement.querySelector('.section[data-path]');
  let path = '';
  if (pathWrapper) {
    ({ path } = pathWrapper.dataset);
  }
  // get meta data from html document from the path
  if (path) {
    await fetchAndExtractMeta(path);
  } else {
    storeMobileTabView = getMetadata('store-mobile-tab-view') || null;
    nearbyStoresView = getMetadata('nearby-stores-view') || null;
  }

  parentRootBlock = block;
  if (storeMobileTabView === 'true') {
    block.parentElement.parentElement.classList.add('store-mobile-tab-view');
    await loadCSS(
      `/blocks/store-finder/${getBrandPath()}store-mobile-tab-view.css`,
    );
  }
  if (nearbyStoresView === 'true') {
    block.parentElement.parentElement.classList.add('nearby-stores-view');
    await loadCSS(
      `/blocks/store-finder/${getBrandPath()}nearby-stores-view.css`,
    );
  }
  block.parentElement.parentElement.classList.add('full-width');
  while (block.firstChild) block.removeChild(block.firstChild);
  decorateBlockSkeleton(block);
  getCurrentLocation().then((location) => {
    if (location) {
      setLatAndLngValues(location);
    } else {
      console.log('Location access not available or denied.');
    }
    navigator.geolocation?.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      currentLat = latitude;
      currentLng = longitude;
    });
    loadConfigs().then(() => {
      while (block.firstChild) block.removeChild(block.firstChild);
      decorateStoreFinder(block);
      decorateSortedStoreList('userDistance');
    }).then(() => {
      if (storeMobileTabView === 'true') {
        createStoreMobileTabView(block);
      }
    });
  });
}
