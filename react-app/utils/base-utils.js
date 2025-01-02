import { decorateIcons } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import AppConstants from './app.constants.js';

export const getCurrencyFormatter = async (currencyCode, priceDecimals) => {
  let currency = currencyCode || '';

  if (!currency) {
    currency = await getConfigValue('currency') || 'AED';
  }

  if (!priceDecimals && priceDecimals !== 0) {
    priceDecimals = await getConfigValue('cart-price-decimals') || 2;
  }

  const countryCode = await getConfigValue('country-code') || 'AE';

  return new Intl.NumberFormat(`${document.documentElement.lang || 'en'}-${countryCode}`, {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
    maximumFractionDigits: priceDecimals,
    minimumFractionDigits: priceDecimals,
  });
};

export const formatPrice = async (currency, price) => {
  const currentFormatter = await getCurrencyFormatter(currency);
  return currentFormatter.format(price);
};

export const getRandomNumber = () => Math.floor(Math.random() * 100);

export const hasValue = (value) => {
  if (typeof value === 'undefined') {
    return false;
  }

  if (value === null) {
    return false;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'length') && value.length === 0) {
    return false;
  }

  if (value.constructor === Object && Object.keys(value).length === 0) {
    return false;
  }

  return Boolean(value);
};

//Condition: Other than checkout page this Id shouldnt been called.
export const getTopupEgiftCardId = () => {
  if (window.location.pathname?.includes('/checkout')) {
    if (sessionStorage.getItem(AppConstants.LOCAL_STORAGE_KEY_DIGITAL_CART_ID)) {
      return sessionStorage.getItem(AppConstants.LOCAL_STORAGE_KEY_DIGITAL_CART_ID);
    }
  } else {
    sessionStorage.removeItem(AppConstants.LOCAL_STORAGE_KEY_DIGITAL_CART_ID)
  }
}

const isObject = (object) => {
  return object != null && typeof object === "object";
};

export const isDeepEqual = (object1, object2) => {

  // Check if both arguments are the same reference
  if (object1 === object2) {
    return true;
  }

  const objKeys1 = object1 ? Object.keys(object1) : [];
  const objKeys2 = object2 ? Object.keys(object2) : [];

  if (objKeys1.length !== objKeys2.length) return false;

  for (var key of objKeys1) {
    const value1 = object1[key];
    const value2 = object2[key];

    const isObjects = isObject(value1) && isObject(value2);

    if ((isObjects && !isDeepEqual(value1, value2)) ||
      (!isObjects && value1 !== value2)
    ) {
      return false;
    }
  }
  return true;
};

export const isSameAddress = (oldAddress, newAddress) => {
  if (!oldAddress?.address || !newAddress?.address) return false;

  for (let key of Object.keys(newAddress.address)) {
    if (key === 'custom_attributes') {
      const isSameCustomAttr = newAddress.address[key].every(item => {
        const oa = oldAddress.address[key].find(o => o.attribute_code === item.attribute_code);
        // need number and string comparison in few cases
        return oa?.value == item.value;
      })
      if (!isSameCustomAttr) {
        return false;
      }
    } else {
      if (!isDeepEqual(oldAddress.address[key], newAddress.address[key])) {
        return false;
      }
    }
  }
  return true;;
}
export const validateForMaxDecimalDigits = (value, allowedDecimal) => {
  const decimalDigits = value?.toString()?.split('.')[1];
  return decimalDigits?.length > allowedDecimal;
}


export const loadScriptHelper = async (src, attrs) => {
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`head > script[src="${src}"]`)) {
      const script = document.createElement('script');
      script.src = src;
      if (attrs) {
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const attr in attrs) {
          script.setAttribute(attr, attrs[attr]);
        }
      }
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    } else {
      resolve();
    }
  });
}
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