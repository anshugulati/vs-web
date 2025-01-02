import { getTabbyAvailableProducts } from "../api/tabbyPaymentMethod";
import { getPayable } from "../app/checkout/components/payment-methods/utilities/utils";
import { hasValue } from "./base-utils";

let tabbyStatus = [];
export const loadTabbyCDN = async () => {
  const scripts = [];

  if (!document.getElementById('checkout-tabby-integration')) {
    scripts.push({ src: 'https://checkout.tabby.ai/integration.js', id: 'checkout-tabby-integration' });
  }
  if (!document.getElementById('checkout-tabby-promo')) {
    scripts.push({ src: 'https://checkout.tabby.ai/tabby-promo-al-shaya.js', id: 'checkout-tabby-promo' });
  }
  if (!document.getElementById('checkout-tabby-card')) {
    scripts.push({ src: 'https://checkout.tabby.ai/tabby-card.js', id: 'checkout-tabby-card' });
  }
  let isError = false;
  if (scripts.length) {
    // add script dependencies to the page and wait for them to load
    await Promise.all(scripts.map((script) => new Promise((resolve, reject) => {
      const scriptElement = document.createElement('script');
      scriptElement.id = script.id;
      scriptElement.src = script.src;
      scriptElement.async = true;
      scriptElement.defer = true;
      scriptElement.onload = () => {
        resolve();
      };
      scriptElement.onerror = () => {
        isError = true;
        reject();
      }
      scriptElement.type = 'text/javascript';
      document.head.appendChild(scriptElement);
    })));
  }
  return isError;
}

const TabbyUtils = {
  // Verify if the Tabby payment option is available for the current cart or
  // not. For this, we need call an MDC API to get the Tabby availability.
  // This function will return TRUE/FALSE based on the availability status.
  isAvailable: async (cart, setIsTabbyAvailable, isLoggedIn, loadCdn = false, setTabbyConfig = undefined, tabbyConfig = null) => {
    // Get the cart total to store the tabby status in Static Storage. If we
    // found an status for the cart total in Static storage, we will return from
    // there else we will make an API call to Magento to get the satus.
    const value = cart?.data?.extension_attributes?.totals?.base_grand_total;
    const { surcharge } = cart?.data?.extension_attributes?.cart?.extension_attributes;
    let total = value;
    if (hasValue(value) && hasValue(surcharge)) {
      if (surcharge.is_applied)
        total = value - surcharge.amount;
    }
    // Check if the tabbyStatus for current cart value exist in the Static
    // Storage and return.
    if (tabbyStatus && typeof tabbyStatus[total] !== 'undefined') {
      setIsTabbyAvailable(tabbyStatus[total]);
      loadCdn && await loadTabbyCDN();
      return;
    }

    // Get availability from MDC for the current cart.
    const response = await getTabbyAvailableProducts(cart.data.id, isLoggedIn);

    // Set the default Tabby availability status to false for cart value.
    tabbyStatus[total] = false;

    if(!tabbyConfig && response && setTabbyConfig) {
      setTabbyConfig({
        merchant_code: response.merchant_code,
        public_key: response.public_key,
      })
    }

    // If `is_available` is set to '1', it means tabby payment option is
    // available for the current cart value. It also means that current cart
    // value falls in Tabby threshold limit.
    // If the payment option available, update the tabbyStatus variable for the
    //  cart value.
    if (response?.available_products) {
      if (response.available_products.installment?.is_available === 1) {
        tabbyStatus[total] = true;
        loadCdn && await loadTabbyCDN();
      }
    }

    // Return the tabby status from the Static Storage for the cart value.
    setIsTabbyAvailable(tabbyStatus[total]);
  },
  initTabbyPromo: async (cart, tabbyConfig) => {
    let total = getPayable(cart);
    const currency = cart?.data?.prices?.grand_total?.currency ?? '';
    if(window.TabbyPromoAlShaya) {
      new TabbyPromoAlShaya({
        currency,
        price: total,
        infoAttrName: 'tabbyInfoAlshaya',
        publicKey: tabbyConfig?.public_key || '',
        merchant_code: tabbyConfig?.merchant_code || ''
      });
    }
  },
  refresh: async (cart, isLoggedIn, setIsTabbyAvailable, setTabbyConfig, tabbyConfig) => {
    await TabbyUtils.isAvailable(cart, setIsTabbyAvailable, isLoggedIn, true, setTabbyConfig, tabbyConfig);
    TabbyUtils.initTabbyPromo(cart, tabbyConfig);
  }
};

export default TabbyUtils;
