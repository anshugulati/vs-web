import { performRestMutation, performRestQuery } from '../commerce.js';
import { getConfigValue } from '../configs.js';
import { getCustomer } from '../customer/api.js';
import {
  getCountryIso,
} from '../helpers/country-list.js';

const commerceEndPoint = await getConfigValue('commerce-rest-endpoint');
const storeCode = await getConfigValue('commerce-store-view-code');
const market = await getConfigValue('country-code');
const countryIso = await getCountryIso(market);
const ACCRUAL_RATIO_KEY = 'ACCRUAL_RATIO';

function updateLocalStorage(key, newData) {
  let existingData = localStorage.getItem(key);
  existingData = existingData ? JSON.parse(existingData) : {};
  const updatedData = { ...existingData, ...newData };
  localStorage.setItem(key, JSON.stringify(updatedData));
  window.dispatchEvent(new CustomEvent('storage'));
}

function getAccrualRatioFromStorage() {
  const accrualRatio = sessionStorage.getItem(ACCRUAL_RATIO_KEY);

  if (accrualRatio) {
    const config = JSON.parse(accrualRatio);
    if (config) {
      return config.data;
    }
  }

  return null;
}

function setAccrualRatioInStorage(accrualRatio) {
  sessionStorage
    .setItem(ACCRUAL_RATIO_KEY, JSON.stringify(accrualRatio));
}

export default async function isAuraExistAccount() {
  const customer = await getCustomer();
  const endpoint = `${commerceEndPoint}/${storeCode}/V2/customers/apc-search/email/${customer?.email}`;
  const data = await performRestQuery(endpoint);
  if (data && customer) {
    updateLocalStorage('aura_common_data', { aura_membership: data?.apc_identifier_number, aura_enrollmentStatus: data.is_fully_enrolled ? 'fully enrolled' : null, aura_link: data.apc_link });
  }
}

function setLocalStorageAuraData(response) {
  updateLocalStorage('aura_common_data', { aura_membership: response?.apc_identifier_number, aura_link: response?.apc_link, aura_user_first_name: response.apc_first_name || response.first_name });
}

export async function getAuraCustomerData() {
  const customer = await getCustomer();
  const endpoint = `${commerceEndPoint}/${storeCode}/V1/customers/apcCustomerData/${customer?.id}`;
  const auraCustomerData = await performRestQuery(endpoint, true);
  if (auraCustomerData.data?.apc_identifier_number) {
    setLocalStorageAuraData(auraCustomerData?.data);
  }
  return auraCustomerData?.data;
}

export async function getAuraCustomerPoints() {
  const customer = await getCustomer();
  const endpoint = `${commerceEndPoint}/${storeCode}/V1/customers/apc-points-balance/${customer?.id}`;
  const auraCustomerPonts = await performRestQuery(endpoint, true);
  return auraCustomerPonts?.data;
}

export async function getAuraCustomerTiers() {
  const customer = await getCustomer();
  const endpoint = `${commerceEndPoint}/${storeCode}/V1/customers/apc-tiers/${customer?.id}`;
  const auraTierInfo = await performRestQuery(endpoint, true);
  if (auraTierInfo && customer) {
    updateLocalStorage('aura_common_data', { aura_Status: auraTierInfo?.data?.tier_code, aura_TierInfo: auraTierInfo?.data?.tier_info });
  }
  return auraTierInfo?.data;
}

export async function getCashbackAccrualRatio() {
  const accrualRatio = getAccrualRatioFromStorage();
  if (accrualRatio) {
    return accrualRatio;
  }
  const endpoint = `${commerceEndPoint}/${storeCode}/V1/customers/apcDicData/APC_CASHBACK_ACCRUAL_RATIO`;
  const { data: auraAccrualRatio } = await performRestQuery(endpoint, false);

  if (!auraAccrualRatio || !auraAccrualRatio.items.length) {
    return null;
  }
  setAccrualRatioInStorage(auraAccrualRatio);
  return auraAccrualRatio;
}

export async function getAuraTierProgressData() {
  const customer = await getCustomer();
  const endpoint = `${commerceEndPoint}/${storeCode}/V1/customers/apcTierProgressData/customerId/${customer?.id}`;
  const auraTierProgressData = await performRestQuery(endpoint, true);
  return auraTierProgressData?.data;
}

export async function getAuraGuestInfo(apcIdentifierId) {
  const auraGuestMemberNumber = apcIdentifierId || JSON.parse(localStorage.getItem('aura_common_data') || '{}')?.aura_membership;
  const endpoint = `${commerceEndPoint}/${storeCode}/V2/customers/apc-search/apcNumber/${auraGuestMemberNumber}`;
  const auraGuestInfo = await performRestQuery(endpoint, false);
  setLocalStorageAuraData(auraGuestInfo.data);

  // Only set enrollment status if fully enrolled
  if (auraGuestInfo?.data?.is_fully_enrolled) {
    updateLocalStorage('aura_common_data', {
      aura_Status: auraGuestInfo?.data?.tier_code,
      aura_enrollmentStatus: 'fully enrolled',
    });
  } else {
    // If not fully enrolled, just update the tier code
    updateLocalStorage('aura_common_data', {
      aura_Status: auraGuestInfo?.data?.tier_code,
      aura_enrollmentStatus: null,
    });
  }

  updateLocalStorage('aura_common_data', { aura_Status: auraGuestInfo?.data?.tier_code });
  return auraGuestInfo?.data;
}

export async function getAuraGuestPoints() {
  const auraGuestMemberNumber = JSON.parse(localStorage.getItem('aura_common_data') || '{}')?.aura_membership;
  const endpoint = `${commerceEndPoint}/${storeCode}/V1/guest/apc-points-balance/identifierNo/${auraGuestMemberNumber}`;
  const auraGuestPoints = await performRestQuery(endpoint, false);
  return auraGuestPoints?.data;
}

export async function searchPhone(mobile, countryCode) {
  try {
    const response = await fetch(`${commerceEndPoint}/${storeCode}/V2/customers/apc-search/phone/${countryCode}${mobile}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    const apcIdentifierNumber = data.apc_identifier_number;

    return apcIdentifierNumber;
  } catch (error) {
    return false;
  }
}

export async function searchEmail(email) {
  try {
    const response = await fetch(`${commerceEndPoint}/${storeCode}/V2/customers/apc-search/email/${email}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    setLocalStorageAuraData(data);
    const apcIdentifierNumber = data.apc_identifier_number;

    return apcIdentifierNumber;
  } catch (error) {
    return false;
  }
}

export async function loginMobile(mobile, countryCode) {
  try {
    const response = await fetch(`${commerceEndPoint}/${storeCode}/V1/sendotp/phonenumber/${countryCode}${mobile}/type/reg`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return false;
  }
}

export async function verifyOtpApiCall(mobile, countryCode, otp) {
  try {
    const response = await fetch(
      `${commerceEndPoint}/${storeCode}/V1/verifyotp/phonenumber/${countryCode}${mobile}/otp/${otp}/type/reg`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const data = await response.json();
    if (!response.ok && data.message) {
      return false;
    }

    return data;
  } catch (error) {
    return false;
  }
}

export async function userRegister(firstname, lastname, email, mobile, isVerified) {
  try {
    const response = await fetch(`${commerceEndPoint}/${storeCode}/V1/customers/quick-enrollment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer: {
          firstname, lastname, email, mobile, isVerified,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok && data.message) {
      return false;
    }

    const apcIdentifierNumber = data.apc_identifier_number;
    if (apcIdentifierNumber !== null) {
      updateLocalStorage('aura_common_data', { aura_membership: apcIdentifierNumber });
      return true;
    }
    return data.message;
  } catch (error) {
    return false;
  }
}

export async function loginMobileLinkAura(mobile) {
  const url = `${commerceEndPoint}/${storeCode}/V2/customers/apc-search/phone/${countryIso}${mobile}`;
  const response = await performRestQuery(url);
  return response?.data;
}

export async function loginEmail(emailId) {
  const url = `${commerceEndPoint}/${storeCode}/V2/customers/apc-search/email/${emailId}`;
  const response = await performRestQuery(url);
  updateLocalStorage('aura_common_data', { aura_membership: response.data.apc_identifier_number });
  return response?.data;
}

export async function loginAuraAcc(accNum) {
  const url = `${commerceEndPoint}/${storeCode}/V2/customers/apc-search/apcNumber/${accNum}`;
  const response = await performRestQuery(url);
  return response?.data;
}

export async function getCustomerData() {
  await Promise.all([
    getAuraGuestInfo(),
    getAuraCustomerData(),
    getAuraCustomerPoints(),
    getAuraCustomerTiers(),
  ]);
}

export async function sendOtpApiCall(identifierNumber) {
  const url = `${commerceEndPoint}/${storeCode}/V2/sendotp/identifierNo/${identifierNumber}/type/link`;
  const response = await performRestQuery(url, true);
  return response?.data;
}

export async function verifyOtpLinkAura(otpValue, apcIdentifierId) {
  const customer = await getCustomer();
  if (customer?.id) {
    const url = `${commerceEndPoint}/${storeCode}/V1/customers/apc-status-update`;
    const body = {
      statusUpdate: {
        apcIdentifierId,
        link: 'Y',
        autoLink: false,
        otp: otpValue,
        customerId: customer.id,
      },
    };
    const response = await performRestMutation(url, body, true);
    if (response?.data?.message) {
      console.error('Error:', response.data.message);
      return false;
    }
    getCustomerData();

    return response?.data;
  }
  const url = `${commerceEndPoint}/${storeCode}/V2/verifyotp/identifierNo/${apcIdentifierId}/otp/${otpValue}/type/link`;
  const response = await performRestQuery(url);
  if (response?.data?.message) {
    console.error('Error:', response.data.message);
    return false;
  }
  return response?.data;
}
