// eslint-disable-next-line import/no-cycle
import { getMetadata } from './aem.js';
import { getConfigValue } from './configs.js';

/**
 * Check if the current environment is a mobile app by checking the cookie existence
 * @returns {boolean} true if the current environment is a mobile app
 */
function isMobileApp() {
  return document.cookie.includes('app-view=true');
}

// add more delayed functionality here

// Load Commerce events SDK and collector
const config = {
  environmentId: await getConfigValue('commerce-environment-id'),
  environment: await getConfigValue('commerce-environment'),
  storeUrl: await getConfigValue('commerce-store-url'),
  websiteId: await getConfigValue('commerce-website-id'),
  websiteCode: await getConfigValue('commerce-website-code'),
  storeId: await getConfigValue('commerce-store-id'),
  storeCode: await getConfigValue('commerce-store-code'),
  storeViewId: await getConfigValue('commerce-store-view-id'),
  storeViewCode: await getConfigValue('commerce-store-view-code'),
  websiteName: await getConfigValue('commerce-website-name'),
  storeName: await getConfigValue('commerce-store-name'),
  storeViewName: await getConfigValue('commerce-store-view-name'),
  baseCurrencyCode: await getConfigValue('commerce-base-currency-code'),
  storeViewCurrencyCode: await getConfigValue('commerce-base-currency-code'),
  storefrontTemplate: 'Franklin',
  enableGlobalLiveChat: await getConfigValue('enable-global-livechat'),
};

window.adobeDataLayer.push(
  { storefrontInstanceContext: config },
  { eventForwardingContext: { commerce: true, aep: false } },
);

// Load events SDK
import('./commerce-events-sdk.js');

window.dispatchEvent(new Event('delayed-loaded'));

if (!isMobileApp()) {
  // Load LiveChat

  const enableLiveChat = getMetadata('livechat') === 'true';
  const enableGlobalLiveChat = config.enableGlobalLiveChat === 'true';
  if (enableGlobalLiveChat && enableLiveChat) {
    window.setTimeout(() => import('./livechat.js'), 1000);
  }
}
