import React, {
  useContext, useEffect, useRef, useState,
} from 'react';
import './collection-store.css';
import Icon from '../../../../library/icon/icon';
import { getConfigValue } from '../../../../../scripts/configs';
import getCollectionStoresGraphQl from '../../../../api/getCollectionStores';
import CollectionDetails from './collection-details';
import StoreDetails from './components/store-details';
import CartContext from '../../../../context/cart-context';
import { findValueFromAddress, getUserLocation } from './map-utils';
import Loader from '../../../../shared/loader/loader';
import updateCart from '../../../../api/updateCart';
import getSubCartGraphql from '../../../../api/getSubCartGraphql';
import ApiConstants from '../../../../api/api.constants';
import removeRedemption from '../../../../api/removeRedemption';
import FullScreenSVG from './components/full-screen';
import LocateSvg from './components/locate';
import validateCustomerEmail from '../../../../api/validateCustomer';
import { getCurrencyFormatter } from '../../../../utils/base-utils';

export const generateStoreHours = (storeHours) => {
  let time;
  let days = [];
  const resArr = [];
  storeHours.forEach((hours, index) => {
    if (!days.length) {
      days.push(hours.label);
      time = hours.value;
    }
    if (time === hours.value) {
      days.splice(1, 1, hours.label);
    } else {
      resArr.push({ label: days.join(' - '), value: time });
      days = [];
      days.push(hours.label);
      time = hours.value;
    }
    if (index === storeHours.length - 1) {
      resArr.push({ label: days.join(' - '), value: time });
    }
  });
  return resArr;
};

function CollectionStore({ onClose }) {
  const deskMap = useRef();
  const mobileMap = useRef();
  const autocompleteService = useRef();
  const {
    cart, setCart, cartId, isLoggedIn, selectedCollectionStore, setSelectedCollectionStore, setSelectedCollectionStoreForCheckout, setCAndCInfo, cAndCInfo, placeholders, isMapDetailsView, cncCollectionPointsEnabled, priceDecimals, configs,
    setIsMapDetailsView
  } = useContext(CartContext);
  const [activeView, setActiveView] = useState('list_view');
  const [detailsView, setDetailsView] = useState(false);
  const [openedAdd, setOpenedAdd] = useState(null);
  const [selectedAdd, setSelectedAdd] = useState(selectedCollectionStore?.id || null);
  const [respSelectedAdd, setRespSelectedAdd] = useState(null);
  const [isResponsive, setIsResponsive] = useState(null);
  const [currentLocation, setCurrentLocation] = useState();
  const [storesAPIData, setStoresAPIData] = useState();
  const [allStoreHours, setAllStoreHours] = useState();
  const [allMarkers, setAllMarkers] = useState();
  const [showOutsideCountryError, setShowOutsideCountryError] = useState('unset');
  const [showLocationAccessDenied, setShowLocationAccessDenied] = useState(false);
  const [dismissWarning, setDismissWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOverylay, setIsLoadingOverlay] = useState(false);
  const [locateMeClicked, setLocateMeClicked] = useState(false);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const mapRefMobile = useRef(null);
  const mapRefDesktop = useRef(null);
  const infoWindowRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isContactInfo, setIsContactInfo] = useState(false);
  const [contactInfoRef, setContactInfoRef] = useState();
  const [contactInfoErrors, setContactInfoErrors] = useState({ fullname: false, mobile: false, email: false });
  const [isContinueDirty, setIsContinueDirty] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isUpdatingStore, setIsUpdatingStore] = useState(false);
  const [emailExist, setEmailExist] = useState(false);
  const [country, setCountry] = useState();
  const [cncStoreSearchPlaceholder, setCncStoreSearchPlaceholder] = useState();
  const [storeInData, setStoreInData] = useState(false);
  const markerLibrary = useRef(null);
  const activeMarker = useRef(null);
  const priceFormatter = useRef(null);
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

  const currencyFormatter = (price) => {
    let formattedValue = priceFormatter.current?.format(price);
    if (price < 0 && document.documentElement.lang !== 'ar') {
      const currencySymbol = priceFormatter.current?.formatToParts(price).find(part => part.type === 'currency').value;
      formattedValue = formattedValue.replace(`-${currencySymbol} `, `${currencySymbol} -`);
    }
    return formattedValue;
  }

  const renderCollectionPointAddress = (store) => {
    const addressFloorSegment = findValueFromAddress(store.address, 'address_floor_segment');
    const addressBuildingSegment = findValueFromAddress(store.address, 'address_building_segment');
    const street = findValueFromAddress(store.address, 'street');

    return `<div class='collection-point-address'>
      ${addressFloorSegment && '<span class="col-section-card-streetname">' + addressFloorSegment + '</span>'}
      ${addressBuildingSegment && '<span class="col-section-card-streetname">' + addressBuildingSegment + '</span>'}
      ${street && '<span class="col-section-card-streetname">' + street + '</span>'}
    </div>`
  }

  const renderCollectionStoreAddress = (store) => {
    return `<div>${findValueFromAddress(store.address, 'street')}</div>`
  }

  const storeInfoRenderer = (item, isMarkerClick = false) => {
    let t = '';
    const itemHours = isMarkerClick ? generateStoreHours(item.store_hours) : allStoreHours[item.id];
    itemHours?.forEach((hours) => {
      t += `<div><span>${hours.label}</span><span> (${hours.value})</span></div>`;
    });
    const formattedPrice = !isNaN(Number(item.price_amount)) ? currencyFormatter(item.price_amount) : item.price_amount;
    const collectionPointTitle = `<div class="collection-map-infowindow-name">${item.collection_point}</div>`;

    return `<div class="collection-map-infowindow">
            <div class="collection-map-infowindow-title"><div>${cncCollectionPointsEnabled ? collectionPointTitle : ''}<span ${cncCollectionPointsEnabled ? "" : "class=collection-map-infowindow-name"}>${item.store_name}</span></div><span> ${item.distance?.toFixed(2)} ${placeholders.mapMiles}</span></div>
            ${cncCollectionPointsEnabled ? renderCollectionPointAddress(item) : renderCollectionStoreAddress(item)}
            <div class="collection-map-infowindow-time"><span>${cncCollectionPointsEnabled ? placeholders.mapCollectFromPoint : placeholders.mapCollectFromStore}</span><span> ${item.sts_delivery_time_label}</span><span>${cncCollectionPointsEnabled && item.pudo_service === 1 ? ` ${placeholders.mapCollectionFor} ` + formattedPrice : ''}</span></div>
            <div>${t}</div>
        </div>`;
  };

  const viewClickHandler = (view) => {
    setActiveView(view);
  };

  const addDropdownClick = (add) => {
    if (add === openedAdd) {
      setOpenedAdd(null);
    } else {
      setOpenedAdd(add);
    }
  };

  const itemLocation= storesAPIData?.items;
  useEffect(() => {
    
    if (shouldEnableDeliveryAndBillingAddressV2 && storesAPIData?.items?.length > 0 ) {
      setSelectedAdd(storesAPIData?.items[0].id); 
      selectAddClick(itemLocation);
    }
  }, [storesAPIData, itemLocation, shouldEnableDeliveryAndBillingAddressV2]);

  const cncMapBackground= shouldEnableDeliveryAndBillingAddressV2? '#005699': '#cd2026';
  const logoIconCnc= shouldEnableDeliveryAndBillingAddressV2 ? '/icons/logo-cnc-map.svg' : '/icons/logo.svg';

  const selectAddClick = async (item, isMarkerClick = false, isMarker = false) => {
    const apiData = storesAPIData;
    const isStoreInData = apiData?.items?.find((apiItem) => {
      return apiItem.id === item.id;
    });
    if (!isStoreInData) {
      setStoreInData(false);
      return;
    }
    if (!storeInData) {
      setStoreInData(true);
    }
    if (isResponsive && activeView === 'map_view') {
      setRespSelectedAdd(item.id);
      if (!isFullScreen) {
        setIsFullScreen(true);
      }
    } else {
      setSelectedAdd(item.id);
      setSelectedCollectionStore(item);
    }
    if (deskMap.current) {
      deskMap.current.setCenter({ lat: parseFloat(item.latitude), lng: parseFloat(item.longitude) });
    }
    if (mobileMap.current) {
      mobileMap.current.setCenter({ lat: parseFloat(item.latitude), lng: parseFloat(item.longitude) });
    }
    if (deskMap.current) {
      deskMap.current.setZoom(12);
    }
    if (mobileMap.current) {
      mobileMap.current.setZoom(12);
    }

    infoWindowRef?.current?.setContent?.(storeInfoRenderer(item, isMarkerClick));

    if (activeMarker.current) {
      if (!cncCollectionPointsEnabled) {
        const pinEle = activeMarker.current.pinElement;
        pinEle.background = '#ffffff';
        pinEle.glyphColor = '#ffffff';

        const imgEle = activeMarker.current.imageElement;
        imgEle.src = logoIconCnc;
        imgEle.classList.remove('selected')
      }
    }

    const marker = isMarker ? isMarker.marker : allMarkers[item.id]?.marker;
    if (deskMap.current && !isResponsive) {
      infoWindowRef.current.open(deskMap.current, marker);
    }
    const pinEle = isMarker ? isMarker.pinElement : allMarkers[item.id]?.pinElement;
   
    if (!cncCollectionPointsEnabled) {
      pinEle.background = cncMapBackground;
      pinEle.glyphColor = cncMapBackground;
    }

    const imgEle = isMarker ? isMarker.imageElement : allMarkers[item.id]?.imageElement;
    if (!cncCollectionPointsEnabled) {
      imgEle.src = '/icons/logo-white.svg';
    }
    imgEle?.classList.add('selected')
    activeMarker.current = { marker, pinElement: pinEle, imageElement: imgEle };
  };

  const highlightMarker = async (item, isMarker, highlight) => {
    const imgEle = isMarker ? isMarker.imageElement : allMarkers[item.id].imageElement;
    if (!imgEle.classList.contains('selected')) {
      const pinEle = isMarker ? isMarker.pinElement : allMarkers[item.id].pinElement;
     
        pinEle.background = highlight ? cncMapBackground : '#ffffff';
      pinEle.glyphColor = highlight ? cncMapBackground : '#ffffff';
     
    

      imgEle.src = highlight ? '/icons/logo-white.svg' : logoIconCnc;
      if (highlight) {
        imgEle.classList.add('highlighted')
      } else {
        imgEle.classList.remove('highlighted')
      }
    }
  };

  const loadMapScript = async () => {
    const googleMapKey = '' || await getConfigValue('sf-google-maps-key');
    const scripts = [`https://maps.googleapis.com/maps/api/js?key=${googleMapKey}&async=true&libraries=places&language=${document.documentElement.lang}`];
    // add script dependencies to the page and wait for them to load
    await Promise.all(scripts.map((script) => new Promise((resolve) => {
      const scriptElement = document.createElement('script');
      scriptElement.id = 'checkout-google-map';
      scriptElement.src = script;
      scriptElement.async = true;
      scriptElement.defer = true;
      scriptElement.onload = () => {
        setIsGoogleLoaded(true);
        resolve();
      };
      scriptElement.type = 'module';
      document.head.appendChild(scriptElement);
    })));
  };

  async function initiateGoogleMap() {
    if (!isLoading) {
      setIsLoading(true);
    }
    const google = await window.google;
    markerLibrary.current = await google.maps.importLibrary('marker');

    if (!google) {
      return;
    }
    let defaultCenterLat = '' || await getConfigValue('sf-maps-center-lat');
    let defaultCenterLng = '' || await getConfigValue('sf-maps-center-lng');
    const defaultZoom = '' || await getConfigValue('sf-maps-default-zoom-preference');
    if (mapCenter) {
      defaultCenterLat = mapCenter.lat;
      defaultCenterLng = mapCenter.lng;
    }
    const mapOptions = {
      zoom: Number(defaultZoom),
      center: new google.maps.LatLng(Number(defaultCenterLat), Number(defaultCenterLng)),
      mapId: 'ALSHAYA_MAP_ID',
      disableDefaultUI: true,
      zoomControl: true,
    };

    if (mapRefMobile?.current) {
      mobileMap.current = new google.maps.Map(mapRefMobile.current, mapOptions);
    }

    if (mapRefDesktop?.current) {
      deskMap.current = new google.maps.Map(mapRefDesktop.current, mapOptions);
    }

    const markers = {};
    const storeHours = {};
    const apiData = storesAPIData;
    if (!apiData?.items || !apiData.items.length) {
      deskMap.current.setZoom(7);
    }
    apiData?.items?.forEach((item, i) => {
      storeHours[item.id] = generateStoreHours(item?.store_hours);
      const pinElement = new markerLibrary.current.PinElement(
        {
          borderColor: shouldEnableDeliveryAndBillingAddressV2 ? '#005699' : '#FF0000',
          glyph: i.toString(),
          scale: 1.3,
          ...(cncCollectionPointsEnabled && item.pudo_service === 0
            ? {
              background: cncMapBackground,
              glyphColor: cncMapBackground,
            }
            : {
              background: '#FFFFFF',
              glyphColor: '#FFFFFF',
            })
        }
      );
      const marker = new markerLibrary.current.AdvancedMarkerElement({
        position: { lat: parseFloat(item.latitude), lng: parseFloat(item.longitude) },
        content: pinElement.element,
        title: item.store_name,
      });
      const imageUrl = cncCollectionPointsEnabled && item.pudo_service === 0 ? '/icons/logo-white.svg' : logoIconCnc;
      const imageElement = document.createElement('img');
      imageElement.classList.add('store-marker-img');
      imageElement.src = imageUrl;
      marker.content.appendChild(imageElement);
      marker.addListener('click', () => {
        selectAddClick(item, true, { marker, pinElement, imageElement });
      });
      if (!cncCollectionPointsEnabled) {
        marker.content.addEventListener('mouseover', () => {
          highlightMarker(item, { marker, pinElement, imageElement }, true);
        });
        marker.content.addEventListener('mouseout', () => {
          highlightMarker(item, { marker, pinElement, imageElement }, false);
        });
      }
      markers[item.id] = { marker, imageElement, pinElement };
    });

    setAllStoreHours(storeHours);
    setAllMarkers(markers);
    Object.values(markers).forEach((marker) => marker.marker.setMap(deskMap.current));
    if (mobileMap.current) {
      Object.values(markers).forEach((marker) => marker.marker.setMap(mobileMap.current));
    }
    // Object.values(allMarkers).forEach((marker) => marker.setMap(map));
    infoWindowRef.current = await new google.maps.InfoWindow();
    setIsLoading(false);
  }

  const checkUserCountry = async (loc = currentLocation) => {
    const userCoords = {
      lat: loc.currentLat,
      lng: loc.currentLng,
    };
    const [userCountrySame] = await getUserLocation(userCoords);
    if (!userCountrySame) {
      setShowOutsideCountryError('true');
    } else {
      setShowOutsideCountryError('false');
    }
  };

  const getCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      setCurrentLocation({
        currentLat: latitude,
        currentLng: longitude,
      });
      checkUserCountry({
        currentLat: latitude,
        currentLng: longitude,
      });
    }, (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        setShowLocationAccessDenied(true);
      }
    });
  };

  useEffect(() => {
    if (activeView === 'map_view') {
      initiateGoogleMap();
    }
  }, [activeView]);

  const checkMatchMedia = (threshold) => {
    if (window.matchMedia(`(max-width: ${threshold})`).matches) {
      return true;
    }
    return false;
  };


  useEffect(() => {
    if (!storesAPIData) {
      return;
    }
    initiateGoogleMap();
  }, [storesAPIData]);

  useEffect(() => {
    if (!storesAPIData || !selectedCollectionStore) {
      return;
    }
    const selectedStore = storesAPIData?.items?.find(item => item.store_code === selectedCollectionStore.store_code);
    if (selectedStore) {
      setSelectedCollectionStore(prev => ({
        ...prev,
        distance: selectedStore.distance
      }));
    }
  }, [storesAPIData, selectedCollectionStore, setSelectedCollectionStore]);

  const getCollectionsStores = async (cords = null, loadFullScreen = false) => {
    let lat;
    let lng;
    if (showLocationAccessDenied || showOutsideCountryError === 'true') {
      lat = '' || await getConfigValue('sf-maps-center-lat');
      lng = '' || await getConfigValue('sf-maps-center-lng');
    } else if (currentLocation) {
      lat = currentLocation.currentLat;
      lng = currentLocation.currentLng;
    }
    if (cords) {
      lat = cords.lat;
      lng = cords.lng;
    }

    if (loadFullScreen) setIsLoadingOverlay(true);

    getCollectionStoresGraphQl(cartId, +lat, +lng, isLoggedIn).then((data) => {
      setStoresAPIData(data);
      const shippingAssign = cart.data.extension_attributes.cart.extension_attributes.shipping_assignments.find((assign) => assign.shipping.method === 'click_and_collect_click_and_collect');
      if (shippingAssign) {
        const storeCode = shippingAssign.shipping.extension_attributes.store_code;
        if (storeCode) {
          const dataAddress = shippingAssign.shipping.address;
          const contactInfo = { fullname: `${dataAddress.firstname} ${dataAddress.lastname}`, mobile: dataAddress.telephone, email: dataAddress?.email };
          setCAndCInfo(contactInfo);
        }
      }
    }).finally(() => {
      if (loadFullScreen) setIsLoadingOverlay(false);
    });
  };

  useEffect(() => {
    if (showLocationAccessDenied) {
      getCollectionsStores();
    } else if (showOutsideCountryError !== 'unset') {
      getCollectionsStores();
    }
  }, [showOutsideCountryError, showLocationAccessDenied]);

  useEffect(() => {
    if (!document.getElementById('checkout-google-map')) {
      loadMapScript();
    } else {
      setIsGoogleLoaded(true);
    }
    // getCurrentLocation();
    setIsResponsive(checkMatchMedia('767.5px'));

    window.addEventListener('resize', () => {
      setIsResponsive(checkMatchMedia('767.5px'));
    });

    window.addEventListener('react:validateMobileNumberResult', async (event) => {
      setContactInfoErrors({ ...contactInfoErrors, mobile: event.detail.mobile });
      if (!event.detail.mobile) {
        setIsContinueDirty(true);
      }
    });

    (async () => {
      const countryName = await getConfigValue('country');
      const cncStoreSearchPlaceholderArea = await getConfigValue('cnc-store-search-placeholder-area');
      setCountry(countryName);
      setCncStoreSearchPlaceholder(cncStoreSearchPlaceholderArea);
      const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
      priceFormatter.current = await getCurrencyFormatter(grandTotalCurrency, priceDecimals);
    })()
  }, []);

  useEffect(() => {
    if (!isGoogleLoaded) {
      return;
    }
    getCurrentLocation();
  }, [isGoogleLoaded]);

  const selectStoreClick = () => {
    if (!selectedAdd) {
      return;
    }
    infoWindowRef.current.close();
    setDetailsView(true);
  };

  const selectStoreClickHandle = async () => {
    if (!selectedAdd) {
      return;
    }
    infoWindowRef.current.close();
    const countryCode = await getConfigValue('country-code');
    const addressBodyclick = createAddressBody({
      shipping_carrier_code: 'click_and_collect',
      shipping_method_code: 'click_and_collect',
      extension_attributes: {
        click_and_collect_type: 'ship_to_store',
        store_code: selectedCollectionStore?.store_code,
      },
      shipping_address: {
        city: findValueFromAddress(selectedCollectionStore?.address, 'address_city_segment'),
        country_id: countryCode,
        custom_attributes: [
          {
            attribute_code: 'area',
            value: findValueFromAddress(selectedCollectionStore?.address, 'area'),
          },
          {
            attribute_code: 'address_city_segment',
            value: findValueFromAddress(selectedCollectionStore?.address, 'address_city_segment'),
          },
        ],
      },
    });
    onClose();
    const response = await updateCart(addressBodyclick, cartId, isLoggedIn);
    if (response?.response_message?.[1] === 'success') {
      setSelectedCollectionStoreForCheckout(selectedCollectionStore);
      const availablePaymentMethods = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PAYMENTS_METHODS]);
      if (availablePaymentMethods) {
        setCart(prev => ({
          ...prev,
          data: {
            ...prev?.data,
            ...availablePaymentMethods,
            extension_attributes: {
              ...prev.data.extension_attributes,
              cart: {
                ...prev.data.extension_attributes.cart,
                extension_attributes: {
                  ...prev.data.extension_attributes.cart.extension_attributes,
                  shipping_assignments: response?.cart?.extension_attributes?.shipping_assignments,
                },
              },
            },

          },
        }));
      }
    };
  }



  const backClickHandler = async () => {
    if (isResponsive) {
      initiateGoogleMap();
    }
    infoWindowRef.current.open(deskMap.current, allMarkers[selectedAdd]?.marker);
    setDetailsView(false);
    setIsMapDetailsView(false);
  };

  const dismissWarningHandler = () => {
    setDismissWarning(true);
    // setLocateMeClicked(false);
  };

  const renderWarningMsgs = () => {
    let title = null;
    if (showLocationAccessDenied) {
      title = placeholders.mapLocationAccessDenied;
    } else if (showOutsideCountryError === 'true') {
      title = placeholders.mapOutsideCountryErrorTitle?.replaceAll('{{COUNTRY}}', country);
    }

    const subText = showOutsideCountryError === 'true' ? placeholders.mapOutsideCountryErrorSubtext?.replaceAll('{{COUNTRY}}', country) : null;

    return (
      <>
        <div className="collection-store-warning-title">
          {title}
        </div>
        {subText && (
          <div className="collection-store-warning-desc">
            {subText}
          </div>
        )}
        <button onClick={dismissWarningHandler} className="collection-store-warning-action" type="button">{placeholders.mapDismissBtn}</button>
      </>
    );
  };

  const placesAutocompleteHandler = async () => {
    const place = autocompleteService.current.getPlace();
    if (typeof place !== 'undefined' && typeof place.geometry !== 'undefined') {
      const lat = place.geometry.location.lat(); // 25.0640226
      const lng = place.geometry.location.lng(); // 50.82429419999999
      setMapCenter({ lat, lng });
      await getCollectionsStores({ lat, lng }, true);
    }
  };

  const searchInputHandler = async (eve) => {
    const searchInput = eve.target.value;
    if (searchInput.length > 1) {
      const countryCode = await getConfigValue('country-code');

      if (!autocompleteService.current) {
        const curAutocomplete = new window.google.maps.places.Autocomplete(
          searchInputRef.current,
          {
            types: ['geocode'],
            fields: ['address_components', 'geometry', 'icon', 'name'],
            componentRestrictions: { country: countryCode?.toLowerCase() },
          },
        );

        curAutocomplete.setFields(['place_id', 'geometry', 'name']);

        curAutocomplete.addListener('place_changed', placesAutocompleteHandler);

        autocompleteService.current = curAutocomplete;
      }
    } else if (autocompleteService.current && searchInput.length < 3) {
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer) {
        pacContainer.remove();
      }
      window.google.maps.event.clearInstanceListeners(autocompleteService.current);
      autocompleteService.current = null;
    }
  };

  const locateMeClickHandler = () => {
    if (!locateMeClicked) {
      setLocateMeClicked(true);
    }
    if ((showLocationAccessDenied || showOutsideCountryError === 'true') && dismissWarning) {
      setDismissWarning(false);
    }
  };

  useEffect(() => {
    if (!isLoading && selectedCollectionStore) {
      selectAddClick(selectedCollectionStore);
    }
  }, [isLoading, selectedCollectionStore]);

  const contactInfoUpdated = (flag, formData) => {
    if (isContinueDirty) {
      setIsContinueDirty(false);
    }
    setIsContactInfo(flag);
    setContactInfoRef(formData);
    setCAndCInfo({ fullname: formData.fullname, mobile: formData.mobile, email: formData.email });
  };

  function validateEmail(email) {
    if (!email) {
      return false;
    }
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    return regex.test(email);
  }

  const continueClickHandler = async () => {
    const { fullname, email } = contactInfoRef;
    let isValidFullName = false;
    if (fullname && fullname.split(' ').length > 1) {
      isValidFullName = true;
    }
    let isValidEmail = true;
    if (!isLoggedIn) {
      isValidEmail = validateEmail(email);
      const emailInput = document.querySelector('#collectedby-info-email-input');
      const responseData = await validateCustomerEmail(emailInput.value);
      if (responseData?.customerExists) {
        setEmailExist(true);
        return;
      }
      else {
        setEmailExist(false);
      }
    }
    if (isValidFullName && isValidEmail && !emailExist) {
      setContactInfoErrors({ ...contactInfoErrors, fullname: false, email: false });
      window.dispatchEvent(new CustomEvent('react:validateMobileNumber', { detail: { ...contactInfoRef } }));
    } else {
      setContactInfoErrors({ ...contactInfoErrors, fullname: !isValidFullName, email: !isValidEmail });
    }
  };

  const createAddressBody = (additionalFields = {}) => ({
    shipping: {
      ...additionalFields,
    },
    extension: {
      action: 'update shipping',
    },
  });

  const continueAndUpdateCart = async () => {
    setIsUpdatingStore(true);
    const countryCode = await getConfigValue('country-code');
    let availableCustomAttributes = await getConfigValue('cart-address-custom-attributes');
    availableCustomAttributes = availableCustomAttributes ? availableCustomAttributes.split(',').map(d => d?.trim()) : [];

    const { fullname, mobile, email } = contactInfoRef;
    const addressBody = createAddressBody({
      shipping_carrier_code: 'click_and_collect',
      shipping_method_code: 'click_and_collect',
      extension_attributes: {
        click_and_collect_type: 'ship_to_store',
        store_code: selectedCollectionStore?.store_code,
      },
      shipping_address: {
        city: countryCode === 'KW' ? 'city' : findValueFromAddress(selectedCollectionStore.address, 'address_city_segment'),
        country_id: countryCode,
        custom_attributes: selectedCollectionStore?.address ? selectedCollectionStore.address.filter(d => {
          return availableCustomAttributes.includes(d.code)
        })?.map(d => {
          return {
            attribute_code: d.code,
            value: d.value
          }
        }) : [],
        firstname: fullname.split(' ')[0],
        lastname: fullname.split(' ').slice(1, fullname.length - 1).join(' '),
        street: [findValueFromAddress(selectedCollectionStore.address, 'street')],
        telephone: mobile,
        email: email
      },
    });
    const response = await updateCart(addressBody, cartId, isLoggedIn);
    if (response?.response_message?.[1] === 'success') {
      setSelectedCollectionStoreForCheckout(selectedCollectionStore);
      const availablePaymentMethods = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PAYMENTS_METHODS]);
      if (availablePaymentMethods) {
        setCart({
          ...cart,
          data: {
            ...cart?.data,
            ...availablePaymentMethods,
            extension_attributes: {
              ...cart.data.extension_attributes,
              cart: {
                ...cart.data.extension_attributes.cart,
                extension_attributes: {
                  ...cart.data.extension_attributes.cart.extension_attributes,
                  shipping_assignments: response?.cart?.extension_attributes?.shipping_assignments,
                },
              },
            },

          },
        });
      }
      if (isLoggedIn) {
        removeRedemption({
          redemptionRequest: {
            quote_id: cart?.data?.extension_attributes?.cart.id,
          },
        }, true);

        if (removeData) {
          const cartData = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__TOTALS]);
          if (cartData?.extension_attributes?.totals) {
            setCart((prevCart) => ({
              ...prevCart,
              data: {
                ...prevCart.data,
                extension_attributes: {
                  ...prevCart.data.extension_attributes,
                  totals: cartData.extension_attributes.totals
                }
              }
            }));
          }
        }
      }

      // update payment method
      const shippingMethodType = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type
      const updatedShippingMethodType = response?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type
      if (shippingMethodType !== updatedShippingMethodType && cart.data?.selected_payment_method?.code) {
        window.dispatchEvent(new CustomEvent('react:updatePaymentMethod'));
      }

      onClose();
    } else if (response?.response_message?.[1] === 'error') {
      const errorMessage = response?.response_message?.[0];
      if (errorMessage) {
        window.dispatchEvent(
          new CustomEvent('react:showPageErrorMessage', {
            detail: { message: errorMessage },
          }),
        );
      }
    }
    setIsUpdatingStore(false);
  };

  useEffect(() => {
    if (!isContinueDirty) {
      return;
    }
    continueAndUpdateCart();
  }, [isContinueDirty]);

  useEffect(() => {
    if (storesAPIData && allStoreHours && isMapDetailsView) {
      setDetailsView(true);
    }
  }, [storesAPIData, allStoreHours]);

  const fullScreenClickHandler = async () => {
    if (isFullScreen) {
      const defaultZoom = '' || await getConfigValue('sf-maps-default-zoom-preference');
      setRespSelectedAdd(null);
      let lat;
      let lng;
      if (showLocationAccessDenied || showOutsideCountryError === 'true') {
        lat = '' || await getConfigValue('sf-maps-center-lat');
        lng = '' || await getConfigValue('sf-maps-center-lng');
      } else if (currentLocation) {
        lat = currentLocation.currentLat;
        lng = currentLocation.currentLng;
      }
      if (mapCenter) {
        lat = mapCenter.lat;
        lng = mapCenter.lng;
      }
      mobileMap.current.setCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
      mobileMap.current.setZoom(Number(defaultZoom));
      if (activeMarker.current) {
        const pinEle = activeMarker.current.pinElement;
        pinEle.background = '#ffffff';
        pinEle.glyphColor = '#ffffff';

        const imgEle = activeMarker.current.imageElement;
        imgEle.src = logoIconCnc;
      }
    }
    setIsFullScreen(!isFullScreen);
  };

  const confirmStoreSelect = async () => {
    const item = storesAPIData.items?.find((i) => i.id === respSelectedAdd);
    setSelectedAdd(respSelectedAdd);
    setSelectedCollectionStore(item);
    infoWindowRef.current.close();
    setDetailsView(true);
  };

  const renderFullscreenDetails = () => {
    if (!respSelectedAdd) {
      return null;
    }
    const item = storesAPIData.items?.find((i) => i.id === respSelectedAdd);
    if (!item) {
      return null;
    }
    
    const storeHours = generateStoreHours(item.store_hours);
    return (
      <div className="map-fullscreen-details">
        <div className="collection-details-details">
          <Icon className="collection-details-close" name="close" onIconClick={fullScreenClickHandler} />
          <div className="collection-details-name-line">
            <span className="collection-details-store-name">{item.store_name}</span>
            <span>
              {item.distance?.toFixed(2)}
              {' '}
              {placeholders.mapMiles}
            </span>
          </div>
          <StoreDetails item={item} hours={storeHours} />
          <button type="button" onClick={confirmStoreSelect}>{cncCollectionPointsEnabled ? placeholders.mapSelectBtn : placeholders.mapSelectStoreBtn}</button>
        </div>
      </div>
    );
  };

  const checkBtnDisabled = () => {
    if (detailsView) {
      return !isContactInfo;
    }
    if (isResponsive && activeView === 'map_view') {
      return !respSelectedAdd;
    }
    return !selectedAdd;
  };

  const cStoreWrapperRef = useRef(null);
  const cStoreTitleRef = useRef(null);
  const cStoreContentRef = useRef(null);
  const cStoreSubmitRef = useRef(null);
  const cStoreAddRef = useRef(null);

  useEffect(() => {
    const fullHeight = cStoreWrapperRef.current?.offsetHeight || 0;
    const contentHeight = cStoreContentRef.current?.offsetHeight || 0;
    const addConHeight = cStoreAddRef.current?.offsetHeight || 0;
    const storeTitleHeight = cStoreTitleRef.current?.offsetHeight || 0;
    const storeSubmitHeight = cStoreSubmitRef.current?.offsetHeight || 0;
    const heightToDeduct = contentHeight + storeTitleHeight + storeSubmitHeight - addConHeight;
    const finalHeight = fullHeight - heightToDeduct;

    if (cStoreAddRef.current) {
      cStoreAddRef.current.style.height = `${finalHeight}px`;
    }
  });

  const renderTitle = () => {
    let title = '';
    if (detailsView) title = placeholders.mapCollectionDetails;
    else {
      title = cncCollectionPointsEnabled
  ? (shouldEnableDeliveryAndBillingAddressV2 ? placeholders.collectionPointTitleV2 : placeholders.mapCollectionPoint)
  : placeholders.mapCollectionStore;
    }

    return <div ref={cStoreTitleRef} className="collection-store-title">{title}</div>
  }

  const renderFindLabel = () => {
    return (
      <div className="collection-store-find-label">
        {cncCollectionPointsEnabled ? placeholders.mapFindNearestPoint : placeholders.mapFindNearestStore}
      </div>
    );
  }

  const renderCollectionStoreInfo = (store) => {
    return (
      <div className='pudo-collection-list'>
        {cncCollectionPointsEnabled && <Icon name={store.pudo_service === 1 ? 'brand-collection-icon' : 'brand-store-icon'} />}
        <div className='collection-label-wrapper'>
          {cncCollectionPointsEnabled && <span className="collection-point-title">{store.collection_point}</span>}
          <span className="collection-store-name collection-store-name-ellipsis">{store.store_name}</span>
        </div>
      </div>
    );
  }

  const convertMilesToKm = (miles) => (miles * 1.60934).toFixed(2);

  return (
    <div className={`collection-store-main${detailsView ? ' collection-store-details-view' : ''} ${shouldEnableDeliveryAndBillingAddressV2 ? ' collection-modal-bbw' : ''}`}>
      {isLoading && (
        <div className="collection-store-loader">
          <Loader />
        </div>
      )}
      {isLoadingOverylay && (
        <div className="loader_overlay">
          <Loader />
        </div>
      )}
      <div ref={mapRefDesktop} className="collection-store-map-wrapper" />
      <div ref={cStoreWrapperRef} className="collection-store-wrapper">
        {detailsView && (
          <div className="collection-store-back">
            <Icon onIconClick={backClickHandler} name="chevron-left" />
          </div>
        )}
        {renderTitle()}
        {detailsView
          ? (
            <div ref={cStoreContentRef} className="collection-store-content">
              <CollectionDetails item={storesAPIData.items?.find((i) => i.id === selectedAdd)} hours={allStoreHours[selectedAdd]} contactInfoUpdated={contactInfoUpdated}contactInfoErrors={contactInfoErrors} emailExist={emailExist} cAndCInfo={cAndCInfo} />
            </div>
          )
          : (
            <div ref={cStoreContentRef} className="collection-store-content">
              {(showOutsideCountryError === 'true' || showLocationAccessDenied) && !dismissWarning && (
                <div className="collection-store-warning">
                  <div className="collection-store-warning-icon">
                    <Icon name="error-message-black" />
                  </div>
                  <div className="collection-store-warning-content">{renderWarningMsgs()}</div>
                </div>
              )}
              {renderFindLabel()}
              <div className="collection-store-input-container">
                <div className="collection-store-input-div">
                  <div className="collection-store-input-wrapper">
                    <div className="collection-store-input-icon"><Icon name={`${shouldEnableDeliveryAndBillingAddressV2? 'search-black' : 'search-blue'}`} /></div>
                    <input onChange={searchInputHandler} ref={searchInputRef} className="collection-store-input" type="text" placeholder={cncStoreSearchPlaceholder} />
                  </div>
                </div>
                <button disabled={!dismissWarning && locateMeClicked} onClick={locateMeClickHandler} className={`collection-store-location-icon${locateMeClicked ? ' clicked' : ''}`} type="button" aria-label="Locate">
                  <LocateSvg hover={locateMeClicked} />
                </button>
              </div>
              <div className="collection-store-btn-container">
                <div className="collection-store-btn-wrapper">
                  <button type="button" className={activeView === 'list_view' ? `${shouldEnableDeliveryAndBillingAddressV2? 'active-btn': ''}` : 'secondary'} onClick={() => viewClickHandler('list_view')}>{placeholders.mapListView}</button>
                  <button type="button" className={activeView === 'map_view' ? ` ${shouldEnableDeliveryAndBillingAddressV2? 'active-btn': ''}` : 'secondary'} onClick={() => viewClickHandler('map_view')}>{placeholders.mapMapView}</button>
                </div>
              </div>
              
              {activeView === 'list_view' && storesAPIData && (
                <div ref={cStoreAddRef} className="collection-store-add-container">
                  {(!storesAPIData?.items || !storesAPIData.items.length) && <div className="collection-store-no-location">{placeholders.mapNoLocation}</div>}
                  <ul>
                    {storesAPIData.items?.map((item) => (
                      <li key={item?.id}>
                        <button type="button" onClick={() => selectAddClick(item)} className={!cncCollectionPointsEnabled ? "collection-store-add-line" : "collection-point-add-line"}>
                          <div className="collection-list-btn-wrapper">
                            <div className="collection-store-name-holder">
                              <div className="collection-store-name-radio">
                              <input 
                              type="radio" 
                              onClick={() => {
                                if (shouldEnableDeliveryAndBillingAddressV2) {
                                  addDropdownClick(item.id);
                                }
                              }} 
                              readOnly 
                              checked={selectedAdd === item.id} 
                            />

                              </div>
                              {renderCollectionStoreInfo(item)}
                            </div>
                            <div className="collection-store-distance">
                              <div>
                              {shouldEnableDeliveryAndBillingAddressV2 ? <span>
                            {item?.distance && `${convertMilesToKm(item.distance)}`}
                                {' '}
                                {placeholders.cncMapKms}
                              </span> :  <span>
                                {item.distance?.toFixed(2)}
                                {' '}
                                {placeholders.MapMiles}
                              </span>}
                              </div>
                              {isResponsive && !shouldEnableDeliveryAndBillingAddressV2 &&(
                                <button type="button" aria-label="Information" onClick={() => addDropdownClick(item.id)}>
                                  <Icon className={item.id === openedAdd ? 'caret-icon-div show' : 'caret-icon-div'} name="caret-up-fill" />
                                  <Icon className={item.id !== openedAdd ? 'caret-icon-div show' : 'caret-icon-div'} name="caret-down-fill" />
                                </button>
                              )}
                            </div>
                            
                          </div>
                        </button>
                        {shouldEnableDeliveryAndBillingAddressV2 && <div className='collection-store-info'><span className={`${item.store_name ? 'store' : 'pickup-point'}`}>
                    {item.store_name ? 'Store' : 'Pickup Point'}
                          </span> <span className='collection-store-span'><span className='collection-store-info-text'> {placeholders.collectionWithinTxt} {item.sts_delivery_time_label}</span><span className={`collection-store-info-charge ${item.price_amount > 0 ? 'price': 'free'}`}>{item.price_amount > 0 ? item.price_amount : 'FREE'}
                      </span></span></div> }
                        {!shouldEnableDeliveryAndBillingAddressV2 && isResponsive && item?.id === openedAdd &&
                          (<StoreDetails item={item} hours={allStoreHours?.[item?.id]} />
                        )}
                        {shouldEnableDeliveryAndBillingAddressV2 && item?.id === openedAdd &&
                          (<StoreDetails item={item} hours={allStoreHours?.[item?.id]} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {activeView === 'map_view' && (
                <div className={`collection-store-mobile-map-wrapper${isFullScreen ? ' fullscreen' : ''}`}>
                  <div ref={mapRefMobile} className="collection-store-mobile-map" />
                  <button onClick={fullScreenClickHandler} type="button" aria-label="Map Fullscreen" className="collection-store-fullscreen-btn"><FullScreenSVG mapFullScreen /></button>
                  {isFullScreen && renderFullscreenDetails()}
                </div>
              )}
            </div>
          )}
       {!shouldEnableDeliveryAndBillingAddressV2 && <div ref={cStoreSubmitRef} className="collection-store-submit">
          {cncCollectionPointsEnabled && detailsView ? <span className='cnc-valid-govt-id-text'>{placeholders.collectionPointValidGovtIdText}</span> : null}
          <button disabled={checkBtnDisabled()} type="button" className={isUpdatingStore ? 'loader' : ''} onClick={detailsView ? continueClickHandler : selectStoreClick}>{isUpdatingStore ? '' : detailsView ? placeholders.mapContinueBtn : cncCollectionPointsEnabled ? placeholders.mapSelectBtn : placeholders.mapSelectStoreBtn}</button>
        </div>}
        { shouldEnableDeliveryAndBillingAddressV2 && <div ref={cStoreSubmitRef} className="collection-store-submit">
          {cncCollectionPointsEnabled && detailsView ? <span className='cnc-valid-govt-id-text'>{placeholders.collectionPointValidGovtIdText}</span> : null}
          <button disabled={checkBtnDisabled()} type="button" className={isUpdatingStore ? 'loader' : ''} onClick={selectStoreClickHandle}>{isUpdatingStore ? '' : detailsView ? placeholders.mapContinueBtn : cncCollectionPointsEnabled ? placeholders.mapSelectBtn : placeholders.mapSelectStoreBtn}</button>
        </div> }
      </div>
    </div>
  );
}

export default CollectionStore;