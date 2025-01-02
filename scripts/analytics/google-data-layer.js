import { getConfigValue, calcEnvironment } from '../configs.js';
import { getCookie, fetchCommerceCategories } from '../commerce.js';
// eslint-disable-next-line import/no-cycle
import { store } from '../minicart/api.js';
import { loadScript } from '../aem.js';

/**
 * Get the event data from event queue based on the provided key
 * @param {*} selectedKey
 * @returns
 */
export async function getRecommendationsTargetData(selectedKey = null) {
  // eslint-disable-next-line import/no-cycle
  const { EVENT_QUEUE } = await import('../target/target-events.js');
  const targetActivityData = {
    activity_name: null,
    decision_scope: null,
    experience_id: null,
  };
  if (selectedKey) {
    const { meta } = EVENT_QUEUE?.find((el) => el.key === selectedKey)?.data[0] || null;
    if (meta) {
      return {
        activity_name: `${meta?.['activity.name']} | ${meta?.['activity.id']}`,
        decision_scope: selectedKey,
        experience_id: `${meta?.['experience.name']} | ${meta?.['experience.id']}`,
      };
    }
  }
  return targetActivityData;
}

// Get Aura Detail
const isAuraActive = await getConfigValue('aura-price-enabled') === 'true';

/**
 * Loads Google Tag Manager container by ID.
 */
export async function loadGTMContainer(containerId) {
  window.dataLayer ||= [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  return loadScript(`https://www.googletagmanager.com/gtm.js?id=${containerId}`, { async: true });
}

/**
 * Listens for changes in the Adobe dataLayer and pushes the changes to the Google dataLayer.
 */
export function connectWithAcdl() {
  window.dataLayer = window.dataLayer || [];
  const googleDataLayer = window.dataLayer;
  window.adobeDataLayer.push((dl) => {
    dl.addEventListener('adobeDataLayer:change', (payload) => {
      googleDataLayer.push(payload);
    });
  });
}

/**
 * Loads Google Tag Manager container by the ID
 * retrieved from configs.xlsx, per current environment.
 */
export async function loadGTM(isMobileApp) {
  if (calcEnvironment() !== 'prod' || isMobileApp || document.visibilityState !== 'visible') {
    return;
  }
  const containerId = await getConfigValue('gtm-container-id');
  await loadGTMContainer(containerId);
}

/**
 * Generic method to send attributes to data layer
 */
export function sendAttributesToDataLayer(attributes) {
  window.dataLayer?.push(attributes);
}

/* Common Page Level DL Events */

export async function getPageAttributes() {
  const platformType = window.matchMedia('(min-width: 768px)').matches ? 'desktop' : 'mobile';
  const language = document.documentElement.lang || 'en';
  const [country = null, currency = null, brand = null, countryCode = null] = await Promise.all([
    getConfigValue('country'),
    getConfigValue('currency'),
    getConfigValue('brand'),
    getConfigValue('country-code'),
  ]);
  return {
    language,
    country,
    currency,
    platformType,
    brand,
    countryCode,
  };
}

export function datalayerSendAuraDetails(data) {
  const dlObject = {
    ...data,
  };

  sendAttributesToDataLayer(dlObject);
}

export async function sendPageAttributes() {
  const {
    language,
    country,
    currency,
    platformType,
  } = await getPageAttributes();

  sendAttributesToDataLayer({
    pageType: window.location.href.indexOf('wishlist') !== -1 ? 'Wishlist Page' : window.pageType,
    language,
    country,
    currency,
    platformType,
  });
}

export function sendCartId() {
  const cartId = store.getCartId();
  if (cartId) {
    sendAttributesToDataLayer({ cartId, timestamp: Date.now() });
  }
}

let hasCustomerOrderExisting = null;
export async function getLoggedInUserAttributes(
  additionalCustomerDetailsRequired = true,
) {
  // eslint-disable-next-line  max-len
  const [{
    getCustomer,
    hasCustomerOrder,
  }, {
    getAPCTierProgressData,
  }] = await Promise.all([
    import('../customer/api.js'),
    import('../hellomember/api.js'),
  ]);

  // make calls parallelly
  const promises = [
    getCustomer(true),
    additionalCustomerDetailsRequired
      ? hasCustomerOrder()
      : Promise.resolve(null),
    additionalCustomerDetailsRequired
      ? getAPCTierProgressData(true)
      : Promise.resolve(null),
  ];
  const [customerData, customerHasOrders, apcTierProgress] = await Promise.all(promises);
  const {
    email,
    id,
    firstname,
    lastname,
    custom_attributes: customAttribs,
  } = customerData ?? {};

  hasCustomerOrderExisting = customerHasOrders;

  const { extension_attributes: extensionAttribs } = apcTierProgress ?? {};
  const telephone = customAttribs?.find(({ attribute_code: attribCode }) => attribCode
   === 'phone_number')?.value;

  const userDetails = {
    userID: id?.toString(),
    userEmailID: email,
    userPhone: telephone || null,
    userName: `${firstname} ${lastname}` || null,
    userType: 'Logged in User',
  };
  if (additionalCustomerDetailsRequired) {
    return {
      ...userDetails,
      customerType: hasCustomerOrderExisting ? 'Repeat Customer' : 'New Customer',
      privilegeCustomer: 'Regular Customer', // Hardcoded as per requirement
      hello_member_tier: extensionAttribs?.current_tier_en || 'guest',
    };
  }
  return userDetails;
}

export function getGuestUserAttributes() {
  return {
    userID: null,
    userEmailID: '',
    userPhone: '',
    customerType: 'New Customer',
    userName: '',
    userType: 'Guest User',
    privilegeCustomer: 'Regular Customer',
    hello_member_tier: 'guest',
  };
}

export async function sendUserAttributes() {
  const isAuthenticated = !!getCookie('auth_user_token');
  const userAttribs = isAuthenticated
    ? await getLoggedInUserAttributes()
    : getGuestUserAttributes();
  if (userAttribs) {
    sendAttributesToDataLayer(userAttribs);
  }
}

export function datalayerLogout(logoutState, additionalPayload = {}) {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'User Login & Register',
    eventAction: `Logout ${logoutState}`,
    ...additionalPayload,
  };
  sendAttributesToDataLayer(dlObject);
}

export async function datalayerViewBannerEvent(
  ctaList,
  targetId,
  bannerId,
  campaignName,
) {
  const ctaPositionsList = Object.keys(ctaList)?.map((index) => parseInt(index, 10) + 1);
  const targetEventData = await getRecommendationsTargetData(targetId);
  const dlObject = {
    event: 'view_promotion',
    ecommerce: {
      creative_name: ctaList?.join('|'),
      creative_slot: ctaPositionsList?.join('|'),
      promotion_id: bannerId ?? null, // Unique banner ID
      promotion_name: campaignName, // this represents name of the campaign
      ...targetEventData,
    },
  };
  sendAttributesToDataLayer(dlObject);
}
/* To save product data from local storage in current user journey */
export function addSelectedProductToLocal(productId, data = {}) {
  const selectedProduct = JSON.parse(localStorage.getItem('selectedProductLocal')) || {};
  selectedProduct[productId] = data;
  localStorage.setItem('selectedProductLocal', JSON.stringify(selectedProduct));
}
/* to get product data from local storage in current user journey */
export function getSelectedProductFromLocal(productId) {
  const selectedProduct = JSON.parse(localStorage.getItem('selectedProductLocal') || null);
  return selectedProduct?.[productId];
}

/* To save product data from session storage in current user journey */
export function addSelectedProductToSession(productId, data = {}) {
  const selectedProduct = JSON.parse(sessionStorage.getItem('selectedProduct')) || {};
  selectedProduct[productId] = data;
  sessionStorage.setItem('selectedProduct', JSON.stringify(selectedProduct));
}

/* to get product data from session storage in current user journey */
export function getSelectedProductFromSession(productId) {
  const selectedProduct = JSON.parse(sessionStorage.getItem('selectedProduct') || null);
  return selectedProduct?.[productId];
}

// extracting data from query params and add to session storage
export function extractQueryParamsToSession(productId) {
  const urlParams = new URLSearchParams(window.location.search);
  const decodedString = atob(urlParams.get('dlObject') || '');
  const dlObject = JSON.parse(decodedString || null);
  if (!(productId && dlObject)) return;
  urlParams.delete('dlObject');
  let newUrl = window.location.pathname;
  if (urlParams.toString()) {
    newUrl += `?${urlParams.toString()}`;
  }
  // Replacing the URL in the address bar without reloading the page
  window.history.replaceState({}, '', newUrl);
  addSelectedProductToSession(productId, dlObject);
}

export function buildCategoryList(categoryData) {
  const categoryListName = [];
  if (categoryData?.total_count) {
    Object.entries(
      categoryData?.[0]?.breadcrumbs || [],
    ).forEach(([, cat]) => {
      categoryListName.push(cat?.category_gtm_name);
    });
    categoryListName.push(categoryData?.items[0]?.gtm_name);
  }
  return categoryListName;
}

/**
* Auxillary function to create listed category object from category list
* @param {*} categoryList Array of All the current and parent categories
* @param {*} entity Entity
* @returns listed category object
*/
export function createCategories(categoryList, majorCategoryId, subCategoryId, isSearch) {
  return {
    product_view_type: isSearch ? 'SLP' : 'PLP',
    departmentId: majorCategoryId || subCategoryId,
    listingId: subCategoryId,
    list: `${categoryList?.[0] ?? ''} ${categoryList?.[1] ? `|${categoryList[1]}` : ''}${categoryList?.[2] ? `|${categoryList[2]}` : ''}`,
    majorCategory: categoryList?.[0] || null,
    minorCategory: categoryList?.[1] || null,
    subCategory: categoryList?.[2] || null,
    listingName: categoryList?.[categoryList.length - 1] || null,
  };
}

/**
* Function to send category object to DL
* @param {*} categories categories object
*/
export function sendCategoriesToDataLayer(
  categories,
  majorCategoryId = null,
  subCategoryId = null,
  isSearch = false,
  isDeptPage = false,
) {
  const categoriesObj = createCategories(categories, majorCategoryId, subCategoryId, isSearch);
  if (isDeptPage) {
    categoriesObj.departmentName = categoriesObj?.list;
  }
  sendAttributesToDataLayer(categoriesObj);
}

export async function datalayerSelectBannerEvent(
  ctaName,
  targetId,
  ctaPosition,
  bannerId,
  campaignName,
) {
  const targetEventData = await getRecommendationsTargetData(targetId);
  const dlObject = {
    event: 'select_promotion',
    ecommerce: {
      creative_name: ctaName || null,
      creative_slot: ctaPosition,
      promotion_id: bannerId ?? null, // Unique banner ID
      promotion_name: campaignName, // this represents name of the campaign
      ...targetEventData,
    },
  };
  sendAttributesToDataLayer(dlObject);
  localStorage.setItem('bannerData', JSON.stringify(dlObject.ecommerce));
}

/**
 * Utility to create page name based on page type and predefined logic for DL, target and AEP
 * @param {string} pageType static page type
 * @param {string} pageNameParam page name or pdp product name
 * @param {string[]} categoryList category list
 * @returns string pagename
 */
export function setPageName(pageType, pageNameParam = '', categoryList = []) {
  const pageNameMap = {
    'product listing page': `${pageType}|${categoryList.join('|')}`,
    'product detail page': `${pageType}|${pageNameParam}`,
    'department page': `${pageType}|${window.location.pathname?.split('shop-')?.[1]?.split('/')[0]}`,
  };
  window.pageName = pageNameMap[pageType] || pageType;
}

export function getPageName(pageType = window.pageType) {
  if (!window.pageName) setPageName(pageType);
  return window.pageName;
}

/**
 * Method to send attributes to data layer on page load
 */
export async function sendPageLoadAttributes() {
  await Promise.all([sendPageAttributes(), sendUserAttributes()]);
  sendCartId();
}

/* PLP Events */
function transformBannerData() {
  const categoryListName = localStorage.getItem('categoryListName');
  const bannerData = JSON.parse(localStorage.getItem('bannerData'));
  if (!categoryListName?.startsWith('bn_promo_') || !bannerData) {
    return {};
  }
  const {
    creative_name: creativeName = null,
    creative_slot: creativeSlot = null,
    promotion_id: promotionId = null,
    promotion_name: promotionName = null,
  } = bannerData;
  return {
    creative_name: creativeName,
    creative_slot: creativeSlot,
    promotion_id: promotionId,
    promotion_name: promotionName,
    activity_name: bannerData.activity_name || null,
    decision_scope: bannerData.decision_scope || null,
    experience_id: bannerData.experienceID || null,
  };
}

function findObjectWithTarget(obj, target) {
  let foundObject = null; // Variable to store the found object

  Object.keys(obj).forEach((key) => {
    if (foundObject) return; // Stop further searching if object is already found

    if (obj[key] === target) {
      foundObject = obj; // Found target, set foundObject to current object
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      const result = findObjectWithTarget(obj[key], target);
      if (result) {
        foundObject = result; // Propagate the found object up the recursive calls
      }
    }
  });

  return foundObject; // Return the object containing the target, or null if not found
}

// to get type of current page
function getPageTypeAcronym() {
  const { pageType } = window;
  const pageTypeMap = {
    'product detail page': 'pdp',
    'product listing page': 'plp',
    'search page': 'slp',
  };
  return pageTypeMap[pageType] || pageType;
}

/**
 * Transform PLP item data
 * @param {*} productData products data array
 * @param {*} quantity quantity
 * @returns trasnformed data for datalayer
 */

let productPosition = 0;
async function transformProductItemData(
  productData,
  quantity,
  withoutBannerData = false,
  viewItemList = true,
  selectedIndexVal = 0,
  eventType = '',
  dataInsightsId = null,
  productViewType = null,
) {
  const { items } = await fetchCommerceCategories();
  const lang = document.documentElement.lang || 'en';
  return productData?.map(({ gtm, ...product }) => {
    const productAttrs = product?.attributes || null;
    const gtmAttributes = productAttrs
      ? JSON.parse(productAttrs?.find((el) => el.name === 'gtm_attributes').value) || null
      : null;
    const itemCategories = gtmAttributes?.category.split('/') || (gtm?.gtm_category || '').split('/') || [];
    const altBrand = typeof product.attr_product_brand === 'object'
      ? product.attr_product_brand?.en
      : product.attr_product_brand;
    productPosition += 1;
    const itemBrand = productAttrs?.find((el) => el.name === 'product_brand')?.value || gtm?.gtm_brand || altBrand || null;

    let selectsku = null;
    if (window.location.href.indexOf('wishlist') !== -1) {
      const variantSize = product?.options?.[0]?.values.find((item) => item.inStock === true)?.id;
      selectsku = product?.variants?.variants
        .filter((variant) => variant.selections.some((option) => option === variantSize));
    }

    let itemVariant;
    if (viewItemList && window.location.href.indexOf('wishlist') === -1) {
      itemVariant = gtm?.gtm_variant
        || (product?.swatches?.[lang] || product?.swatches)
          ?.find((item) => item.child_sku_code)
          ?.child_sku_code;
    } else {
      itemVariant = selectsku?.[0]?.product?.sku || product?.swatches?.[0]?.child_sku_code;
    }

    // assign product color
    let gtmItemColor = null;

    if (Array.isArray(product?.attr_color)) {
      gtmItemColor = product?.attr_color[0];
    } else if (Array.isArray(product?.attr_color?.en)) {
      gtmItemColor = product?.attr_color.en[0];
    } else if (gtm?.gtm_item_color) {
      gtmItemColor = gtm?.gtm_item_color;
    } else if (window.location.href.indexOf('wishlist') !== -1) {
      gtmItemColor = selectsku?.[0]?.product?.attributes?.find((el) => el.name === 'color')?.value || null;
    }

    const itemPriceTypeValue = (typeof product?.member_price?.en === 'number' && product.member_price.en) || (typeof selectsku?.[0]?.product?.attributes?.find((el) => el.name === 'member_price')?.value === 'number' && selectsku?.[0]?.product?.attributes?.find((el) => el.name === 'member_price')?.value) || (typeof product?.member_price === 'number' && product?.member_price) || null;
    const categoryData = findObjectWithTarget(items, itemCategories[0]);
    const itemSize = gtm?.gtm_item_size || selectsku?.[0]?.product?.attributes?.find((el) => el.name === 'size')?.value || productData.size
                    || product.attributes?.find((attr) => attr.name === 'size')?.value || null;
    // returnEligibility
    let isReturableValue = null;
    if (eventType !== 'view_item_list' && eventType !== 'select_item' && eventType !== 'add_to_wishlist' && eventType !== 'remove_from_wishlist') {
      isReturableValue = productAttrs?.is_returnable === '1' ? 'yes' : 'no';
    }

    const {
      listName,
    } = getSelectedProductFromLocal(gtm?.id) || {};

    let itemListName;
    if (window.location.href.indexOf('wishlist') !== -1) {
      itemListName = 'Wishlist';
    } else if (listName) {
      itemListName = listName;
    } else {
      itemListName = localStorage.getItem('categoryListName');
    }

    const itemData = {
      item_id: product?.sku || gtm?.gtm_main_sku || gtm?.gtm_magento_product_id || null,
      item_name: gtm?.gtm_name || product?.name || null,
      affiliation: 'Online Store', // Static value
      coupon: null,
      discount: Number(product?.discount?.en || product?.discount) || null,
      item_brand: itemBrand,
      item_category: gtm?.gtm_category || gtmAttributes?.category || null,
      item_category2: itemCategories[0] || null,
      item_category3: itemCategories[1] || null,
      item_category4: itemCategories[2] || null,
      item_category5: itemCategories[3] || null,
      item_list_id: window.location.href.indexOf('wishlist') !== -1 ? categoryData?.id : localStorage.getItem('categoryListId') || null,
      item_list_name: itemListName,
      item_variant: itemVariant || null,
      in_stock: gtm?.gtm_stock === 'in stock' || product?.inStock,
      price: Number(gtm?.gtm_price)
        || Number(gtmAttributes?.price)
        || null,
      quantity: Number(quantity || product?.quantity),
      index: Number(selectedIndexVal) || productPosition,
      returnEligibility: isReturableValue,
      item_color: gtmItemColor,
      item_size: itemSize,
      product_view_type: productViewType,
      price_type: `${isAuraActive ? 'aura ' : ''}member price ${itemPriceTypeValue ? 'yes' : 'no'}`,
      item_fragrance_name: product?.attr_fragrance_name.en,
      item_fragrance_category: product?.attr_fragrance_category.en,
    };

    itemData['data-insights-query-id'] = dataInsightsId;

    if ((eventType === 'select_item' || eventType === 'view_item_list') && !withoutBannerData) {
      return { ...itemData, ...transformBannerData() };
    }
    return {
      ...itemData,
      ...{ product_view_type: productViewType },
    };
  });
}

const brandName = await getConfigValue('brand');

// checking if targetEventData has values
// if available then parse and assign values
// else assign default values
function parseTargetData(targetEventData) {
  const data = targetEventData
    ? JSON.parse(targetEventData)
    : {
      activity_name: null,
      decision_scope: null,
      experience_id: null,
    };

  return data;
}

// checking if bannerData has values
// if available then assign values
// else assign default values
function getBannerData(bannerData) {
  const data = bannerData && Object.keys(bannerData).length !== 0
    ? bannerData
    : {
      creative_name: null,
      creative_slot: null,
      promotion_id: null,
      promotion_name: null,
    };

  return data;
}

async function transformCartProductItemData(
  productData,
  quantity,
  viewItemList = true,
) {
  const { items } = await fetchCommerceCategories();
  return productData?.map(({ item }, itemIndex) => {
    const gtm = item?.product?.gtm_attributes || null;
    // category
    const itemCategories = gtm?.category?.split('/') || [];
    // brand
    const dynamicAttribute = item?.configured_variant?.dynamicAttributes || null;
    const itemBrand = JSON.parse(dynamicAttribute)?.product_brand_gtm
      || gtm?.brand || item?.product?.brand_full_name || brandName || null;
    // variant
    let itemVariant;
    if (viewItemList) {
      itemVariant = item?.extensionAttributes?.sku || null;
    }
    // discount
    const itemDiscount = item?.configured_variant?.price_range?.discount?.percent_off || null;
    // size
    const itemSize = JSON.parse(dynamicAttribute)?.size_gtm
      || item?.extensionAttributes?.extension_attributes?.size
      || item?.configurable_options?.find((el) => el.option_label === 'Size')?.value_label || null;
    // assign product color
    const gtmItemColor = JSON.parse(dynamicAttribute)?.color_gtm
      || item?.extensionAttributes?.extension_attributes?.color
      || item?.configured_variant?.color_label || null;
    // In stock
    const itemInStock = item?.configured_variant?.stock_status || null;
    const {
      insightsQueryId,
      gtmProductList = null,
      targetEventData = null,
      bannerData = null,
    } = getSelectedProductFromLocal(gtm?.id) || {};
    const targetActivityData = parseTargetData(targetEventData);
    const updatedBannerData = getBannerData(bannerData);
    const categoryData = findObjectWithTarget(items, itemCategories[0]);
    const itemPriceTypeValue = item?.configured_variant?.member_price
    || item?.extensionAttributes?.extension_attributes?.member_price || null;
    const itemReturnable = item?.configured_variant?.is_returnable === '1' ? 'yes' : 'no';
    const itemPrice = item?.configured_variant?.price
    || item?.configured_variant?.price_range?.maximum_price?.final_price?.value || null;
    const itemData = {
      item_id: gtm?.id || null,
      item_name: gtm?.name || null,
      affiliation: 'Online Store', // Static value
      coupon: null,
      discount: Number(itemDiscount) || null,
      item_brand: itemBrand,
      item_category: gtm?.category || null,
      item_category2: itemCategories[0] || null,
      item_category3: itemCategories[1] || null,
      item_category4: itemCategories[2] || null,
      item_category5: itemCategories[3] || null,
      item_list_id: categoryData?.id || null,
      item_list_name: gtmProductList || null,
      item_variant: itemVariant,
      in_stock: itemInStock === 'IN_STOCK',
      price: Number(itemPrice) || Number(gtm?.price) || null,
      quantity: Number(item?.quantity || quantity),
      index: Number(itemIndex + 1),
      returnEligibility: itemReturnable,
      item_color: gtmItemColor,
      item_size: itemSize,
      'data-insights-query-id': insightsQueryId,
      price_type: `${isAuraActive ? 'aura ' : ''}member price ${itemPriceTypeValue ? 'yes' : 'no'}`,
      item_fragrance_name: item?.product?.fragrance_name,
      item_fragrance_category: item?.product?.fragrance_category,
      ...updatedBannerData,
      ...targetActivityData,
    };
    return itemData;
  });
}

export async function datalayerViewItemListEvent(
  productData,
  insightsQueryId = null,
  totalProductsListCount = null,
) {
  const dlObject = {
    event: 'view_item_list',
    eventLabel: totalProductsListCount ? `${totalProductsListCount || 0} items` : `${productData?.length || 0} items`,
    ecommerce: {
      item_list_id: localStorage.getItem('categoryListId') || null,
      item_list_name: window.location.href.indexOf('wishlist') !== -1 ? 'Wishlist' : localStorage.getItem('categoryListName') || null,
      ...transformBannerData(),
      items: await transformProductItemData(productData, 1, false, true, 0, 'view_item_list'),
      'data-insights-query-id': insightsQueryId,
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export const dataLayerCustomerExistCheckoutErrors = async () => {
  const dlObject = {
    event: 'Customer exist warning on Checkout page',
    eventCategory: 'Customer exist warning on Checkout page',
  };
  sendAttributesToDataLayer(dlObject);
};
export const dataLayerCheckoutErrors = async ({ action, label }) => {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'checkout errors', // or 'Login Success' //depending on user action
    eventAction: action,
    eventLabel: label, // provide more details about the error, so business can identify the issue
  };
  sendAttributesToDataLayer(dlObject);
};
export const datalayerAddShippingInfo = async ({
  productData, value, currency, coupon, shippingTier, discount,
}) => {
  const isAuthenticated = !!getCookie('auth_user_token');
  const dlObject = {
    event: 'add_shipping_info',
    ecommerce: {
      value,
      currency,
      coupon,
      discount,
      login_method: isAuthenticated ? 'Logged In' : 'Guest Login',
      shipping_tier: shippingTier,
      items: await transformCartProductItemData(productData, 1),
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
};

export const dataLayerDeliveryOption = async ({ deliverySelected }) => {
  const dlObject = {
    event: 'deliveryOption',
    eventLabel: deliverySelected,
  };
  sendAttributesToDataLayer(dlObject);
};
export const dataLayerPlaceOrderButtonClick = async () => {
  const dlObject = {
    event: 'placeOrderButtonClick',
    eventCategory: 'Payment Page',
    eventAction: 'Button Click',
    eventLabel: 'Place Order',
  };
  sendAttributesToDataLayer(dlObject);
};

export const dataLayerSaveAddressEvent = async ({ isValid, category, addressType }) => {
  const dlObject = {
    event: 'saveAddressOnCheckoutPage',
    eventCategory: category === 'update' ? 'Save Address on Checkout page' : 'Click on Add Address on Checkout page',
    eventAction: addressType,
    eventLabel: isValid === 1 ? 'valid' : 'invalid',
  };
  sendAttributesToDataLayer(dlObject);
};

export const datalayerBeginCheckoutEvent = async ({
  productData, value, currency, coupon, memberOfferType,
}) => {
  const dlObject = {
    event: 'begin_checkout',
    ecommerce: {
      value,
      currency,
      coupon,
      member_offerType: memberOfferType,
      items: await transformCartProductItemData(productData, 1),
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
};

export async function datalayerViewCartEvent({
  productData, value, currency, coupon,
}) {
  const dlObject = {
    event: 'view_cart',
    ecommerce: {
      value,
      currency,
      coupon,
      items: await transformCartProductItemData(productData, 1),
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export async function datalayerSelectItemListEvent(
  productData,
  totalItems,
  selectedIndexVal,
  insightsQueryId = null,
) {
  const dlObject = {
    event: 'select_item',
    eventLabel: `${totalItems} items`, // total number of items displayed on the listing page
    ecommerce: {
      item_list_id: localStorage.getItem('categoryListId') || null,
      item_list_name: window.location.href.indexOf('wishlist') !== -1 ? 'Wishlist' : localStorage.getItem('categoryListName') || null,
      items: await transformProductItemData(
        [productData],
        1,
        false,
        true,
        selectedIndexVal,
        'select_item',
      ),
      'data-insights-query-id': insightsQueryId,
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerFilterEvent(
  filterType,
  filterValue,
  currentCategory,
  isActive,
  facetFiltersDatalayer,
) {
  const dlObject = {
    event: 'filter',
    siteSection: currentCategory,
    filterType,
    filterValue,
    filterAction: isActive ? 'add filter' : 'remove filter',
    facetFilters: facetFiltersDatalayer,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerColorSwatchEvent(datalayerPageType, colorName = null) {
  const dlObject = {
    event: 'ecommerce',
    eventCategory: 'color click',
    eventAction: `${datalayerPageType} color click`,
    eventLabel: colorName,
    product_view_type: `${datalayerPageType}`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerImageSwipeEvent(direction, datalayerPageType) {
  const dlObject = {
    event: `${datalayerPageType}_imageswipe`,
    eventLabel: `${direction}_swipe`, // or 'right_swipe'
  };
  sendAttributesToDataLayer(dlObject);
}

export function dataLayerGridSelectionEvent(isSmallGridSelected, datalayerPageType) {
  const dlObject = {
    event: 'ecommerce',
    eventCategory: 'ecommerce',
    eventAction: `${datalayerPageType} clicks`,
    eventLabel: `${datalayerPageType} layout - ${isSmallGridSelected ? 'small' : 'large'} grid`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function dataLayerLoadMoreSelectionEvent(currentProductCount, totalProductCount, pageType) {
  const dlObject = {
    event: 'ecommerce',
    eventCategory: 'ecommerce',
    eventAction: `${pageType} clicks`,
    eventLabel: 'load more products',
    eventLabel2: `showing ${currentProductCount} of ${totalProductCount} items`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function dataLayerInternalSearchSuccessEvent(currentProductCount, searchedTerm) {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'Internal Site Search',
    eventAction: 'Successful Search',
    eventLabel: `${searchedTerm}`,
    eventValue: `${currentProductCount}`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function dataLayerInternalSearchEmptyEvent(searchedTerm) {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'Internal Site Search',
    eventAction: '404 Results',
    eventLabel: `${searchedTerm}`,
    eventValue: 0,
    nonInteraction: 0,
  };
  sendAttributesToDataLayer(dlObject);
}

export function dataLayerCartErrorsEvent({
  eventLabel, eventAction, eventPlace, couponCode,
}) {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'cart errors',
    eventLabel: eventLabel || '',
    eventAction: eventAction || '',
    eventPlace: eventPlace || '',
    couponCode: couponCode || '',
    'gtm.uniqueEventId': 512,
  };
  sendAttributesToDataLayer(dlObject);
}

export function dataLayerPromoCodeEvent({
  couponCode, couponStatus,
}) {
  const dlObject = {
    event: 'promoCode',
    couponCode: couponCode || '',
    couponStatus: couponStatus || '',
    'gtm.uniqueEventId': 446,
  };
  sendAttributesToDataLayer(dlObject);
}

export function dataLayerTrendingSearchEvent(inputSearchTerm, inputSearchTermIndex) {
  const dlObject = {
    event: 'Trending Search',
    eventCategory: 'Trending Search',
    eventAction: 'Trending Search Click',
    eventLabel: `${inputSearchTerm}`,
    eventValue: `${inputSearchTermIndex}`,
    nonInteraction: 0,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerColorSwatchChevron(chevronClick, title, itemID) {
  const dlObject = {
    event: 'swatches',
    eventCategory: 'swatches_interaction',
    eventAction: 'swatches_colorChevronClick',
    eventLabel: `${chevronClick}_${title}_${itemID}`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerSizeGuide() {
  const dlObject = {
    event: 'sizeguide',
    eventCategory: 'sizeGuide',
    eventAction: 'open',
    eventLabel: 'pdp',
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerSearchStore(storeName) {
  const dlObject = {
    event: 'ecommerce',
    eventCategory: 'ecommerce',
    eventAction: 'pdp search stores',
    eventLabel: `${storeName}`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerSearchStoreFinder(searchedTerm) {
  const dlObject = {
    event: 'findStore',
    siteSection: 'store-finder',
    fsKeyword: `${searchedTerm}`,
    fsNoOfResult: 0,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerBNPLPDP(viewtype, paymentOptions) {
  const dlObject = {
    event: 'bnpl_option',
    eventCategory: 'bnpl_option',
    eventAction: `${viewtype}`,
    eventLabel: paymentOptions.join(' | '),
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerCartError(errorMessage, cartId = null) {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'cart error',
    eventAction: `${errorMessage}`,
    eventLabel: `${errorMessage}`,
    cart_id: `${cartId}`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerLogin(eventAction, loginType, additionalPayload = {}) {
  const loginTypeMap = {
    google: 'Google',
    facebook: 'Facebook',
  };

  const eventLabel = loginTypeMap[loginType] || loginType;
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'User Login & Register',
    eventAction: `${eventAction}`,
    eventLabel: `${eventLabel}`,
    ...additionalPayload,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerSortingEvent(sortingOption, siteSection = null) {
  const dlObject = {
    event: 'sort',
    siteSection,
    filterType: 'Sort By',
    filterValue: sortingOption,
  };
  sendAttributesToDataLayer(dlObject);
}

function findLanguage(language) {
  const languageMap = {
    en: 'English',
    ar: 'Arabic',
  };

  return languageMap[language] || language;
}

export function datalayerLanguageSwitchEvent(position, language) {
  const dlObject = {
    event: 'Language Switch',
    eventCategory: 'Language Switch',
    eventAction: `${position} : Language Switch Click`,
    eventLabel: findLanguage(language) || null,
  };
  sendAttributesToDataLayer(dlObject);
}

// to clear DL cache from localstorage
export function clearCategoryListCache() {
  localStorage.removeItem('categoryListName');
  localStorage.removeItem('targetEventData');
  localStorage.removeItem('categoryListId');
  localStorage.removeItem('bannerData');
}

export function datalayerHeaderNavigationEvent(
  level,
  ...navigationItems
) {
  const eventLabelItems = navigationItems?.join(' > ');
  const dlObject = {
    event: `${level} Navigation`,
    eventLabel: `Header : ${eventLabelItems}`,
  };
  sendAttributesToDataLayer(dlObject);
  clearCategoryListCache();
}

export function datalayerFooterNavigationEvent(navItem, navHeading, linkName) {
  sendAttributesToDataLayer({
    event: `L${navItem.getAttribute('level') || '2'} Navigation`,
    eventLabel: `Footer: ${navHeading} > ${linkName}`,
  });
  clearCategoryListCache();
}

export function datalayerMobileHamburgerEvent(state) {
  const dlObject = {
    event: 'Mobile Hamburger',
    eventCategory: 'Mobile Hamburger',
    eventAction: 'Hamburger Menu Click',
    eventLabel: `${state}`,
  };
  sendAttributesToDataLayer(dlObject);
}

/* PDP */
/**
 * Transform Commerce PDP item data
 * @param {*} productData product data
 * @param {*} bannerData banner related data if applicable
 * @returns trasnformed data for datalayer
 */
async function transformPdpProductData(
  productData,
  quantity,
  selectedSize,
  withoutBannerData,
  selectedIndex,
  insightsQueryId = null,
) {
  const { items } = await fetchCommerceCategories();
  const { gtm, ...product } = productData;
  const lang = document.documentElement.lang || 'en';
  const itemCategories = gtm?.category?.split('/') || gtm?.gtm_category?.split('/') || [];
  const itemBrand = product?.attributes?.find((el) => el.name === 'product_brand')?.value;
  const colorLabel = product?.variants?.variants?.[0]?.product?.attributes?.find((attr) => attr.name === 'color')?.value || product?.variants?.variants?.[0]?.product?.attributes?.find((attr) => attr.name === 'color_label')?.value || product?.attr_color?.[0] || null;
  const selectedSizeTitle = product?.variants?.variants?.[0]?.product?.attributes?.find((el) => el.name === 'size')?.value || document.querySelector('.pdp-swatches__field__label--selection')?.textContent;
  let variantSize;
  if (selectedSize) {
    variantSize = selectedSize;
  } else {
    variantSize = product?.options?.[0]?.values.find((item) => item.inStock === true)?.id;
  }
  const selectsku = product?.variants?.variants
    .filter((variant) => variant.selections.some((option) => option === variantSize));
  const itemVariant = selectsku?.[0]?.product?.sku || product?.swatches?.[lang] || product?.swatches
    ?.find((item) => item.child_sku_code)?.child_sku_code;

  const itemPriceTypeObj = selectsku?.[0]?.product?.attributes?.find((el) => el.name === 'member_price') || null;
  const itemPriceType = Number(itemPriceTypeObj?.value) || itemPriceTypeObj?.value?.toLowerCase() === 'yes';
  const itemPriceTypeValue = (typeof product?.member_price?.en === 'number' && product.member_price.en) || (typeof product?.memberPrice === 'number' && product.memberPrice) || (typeof product?.member_price === 'number' && product.member_price) || (product?.attributes?.find((attr) => attr.name === 'member_price')?.value) || null;

  let itemReturnableValue = null;
  if (window.location.href.indexOf('wishlist') === -1) {
    if (product?.variants?.variants?.[0]?.product?.attributes?.find((el) => el.name === 'is_returnable')?.value === '1') {
      itemReturnableValue = 'yes';
    } else if (product?.isReturnable === '1') {
      itemReturnableValue = 'yes';
    } else {
      itemReturnableValue = 'no';
    }
  }

  const categoryData = findObjectWithTarget(items, itemCategories[0]);
  const targetEventData = localStorage.getItem('targetEventData')
    ? JSON.parse(localStorage.getItem('targetEventData'))
    : await getRecommendationsTargetData();
  const dynamicAttribute = product?.dynamicAttributes || null;
  const selectedSkuPrice = selectsku?.[0]?.product?.price?.final?.amount?.value || null;
  const selectedSkuSize = selectsku?.[0]?.product?.attributes?.find((el) => el.name === 'size')?.value || null;

  const itemData = {
    item_id: gtm?.id || gtm?.gtm_main_sku || product?.sku || null,
    item_name: gtm?.name || gtm?.gtm_name || product?.name || null,
    affiliation: 'Online Store', // Static value
    coupon: null,
    discount: Number(product?.discount?.en || product?.discount) || null,
    item_brand: JSON.parse(dynamicAttribute)?.product_brand_gtm
      || gtm?.brand || gtm?.gtm_brand || product?.attr_product_brand || itemBrand,
    item_category: gtm?.category || gtm?.gtm_category || null,
    item_category2: itemCategories[0] || null,
    item_category3: itemCategories[1] || null,
    item_category4: itemCategories[2] || null,
    item_category5: itemCategories[3] || null,
    item_list_id: categoryData?.id || null,
    item_list_name: window.location.href.indexOf('wishlist') !== -1
      ? 'Wishlist'
      : localStorage.getItem('categoryListName') || gtm?.category || gtm?.gtm_category || null,
    item_variant: gtm?.sku || itemVariant || gtm?.variant || null,
    in_stock: product.inStock || gtm?.gtm_stock === 'in stock' || null,
    price: Number(selectedSkuPrice) || Number(gtm?.price) || Number(gtm?.gtm_price) || null,
    quantity: Number(quantity),
    index: Number(selectedIndex) || 1,
    returnEligibility: itemReturnableValue,
    item_color: gtm?.color || colorLabel || null,
    item_size: selectedSkuSize || gtm?.size || selectedSizeTitle
      || product.options?.[0]?.values?.find((value) => value.inStock === true)?.value
      || null,
    price_type: `${isAuraActive ? 'aura ' : ''}${itemPriceType || itemPriceTypeValue ? 'member price yes' : 'member price no'}`,
    'data-insights-query-id': insightsQueryId,
    item_fragrance_name: product?.attributes?.find((el) => el.name === 'fragrance_name')?.value,
    item_fragrance_category: product?.attributes?.find((el) => el.name === 'fragrance_category')?.value,
    ...targetEventData,
  };
  if (withoutBannerData) {
    return itemData;
  }
  return { ...itemData, ...transformBannerData() };
}

async function createPlpBaseObject(
  eventName,
  productData,
  quantity,
  selectedIndex,
  dataInsightsId,
  productViewType = null,
) {
  const currency = await getConfigValue('currency');
  const dlObject = {
    event: `${eventName}`,
    ecommerce: {
      currency,
      value: parseFloat(productData.gtm?.gtm_price, 10) * quantity || null,
      items: [await transformProductItemData(
        [productData],
        quantity,
        false,
        false,
        selectedIndex,
        '',
        dataInsightsId,
        productViewType,
      )],
    },
  };
  dlObject.ecommerce = { ...dlObject.ecommerce, ...transformBannerData() };
  return dlObject;
}

// eslint-disable-next-line  max-len
async function createPdpBaseObject(
  eventName,
  productData,
  quantity,
  selectedSize,
  withoutBannerData,
  selectedIndex,
) {
  const currency = await getConfigValue('currency');
  const {
    index: savedIndex,
    insightsQueryId = null,
  } = getSelectedProductFromSession(productData?.gtm?.id) || {};
  const dlObject = {
    event: `${eventName}`,
    ecommerce: {
      currency,
      value: parseFloat(productData.gtm?.price, 10) * quantity || null,
      items: [await transformPdpProductData(
        productData,
        quantity,
        selectedSize,
        withoutBannerData,
        selectedIndex || savedIndex || 1,
        insightsQueryId,
      )],
    },
  };
  dlObject.ecommerce = { ...dlObject.ecommerce };
  return dlObject;
}

export async function datalayerViewItemEvent(
  productData,
  indexVal = null,
  dataInsightsId = null,
  isQuickView = false,
) {
  let dlObject;
  if (isQuickView) {
    const pagePrefix = window.location.href.indexOf('wishlist') !== -1 ? 'wishlist' : getPageTypeAcronym();
    dlObject = await createPlpBaseObject(
      'view_item',
      productData,
      1,
      indexVal,
      dataInsightsId,
      `${pagePrefix}_quickview`,
    );
  } else {
    dlObject = await createPdpBaseObject('view_item', productData, 1, null, null, indexVal);
  }
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export async function datalayerAddToCartEvent(
  addProduct,
  productData,
  quantity,
  selectedSize,
  index,
  dataInsightsId,
  recommendationName,
  isQuickView = false,
  fromListing = false,
) {
  const eventName = addProduct ? 'add_to_cart' : 'remove_from_cart';
  const gtmProductList = localStorage.getItem('categoryListName') || null;
  const targetEventData = localStorage.getItem('targetEventData') || null;
  const selectedProduct = JSON.parse(sessionStorage.getItem('selectedProduct')) || {};
  const requiredBannerData = transformBannerData();
  const bannerData = {
    creative_name: requiredBannerData.creative_name,
    creative_slot: requiredBannerData.creative_slot,
    promotion_id: requiredBannerData.promotion_id,
    promotion_name: requiredBannerData.promotion_name,
  };

  // Call addSelectedProductToSession to update localStorage
  if (addProduct && gtmProductList) {
    addSelectedProductToLocal(productData?.gtm?.id, {
      ...selectedProduct[productData?.gtm?.id],
      gtmProductList, // Add categoryListName
      targetEventData, // Add targetEventData
      bannerData, // Add bannerData
    });
  }
  let dlObject;

  if (fromListing) {
    if (recommendationName) {
      const listName = `pr-${getPageTypeAcronym()}-${recommendationName.toLowerCase()}`;
      const selectedProductLocal = JSON.parse(localStorage.getItem('selectedProductLocal')) || {};
      const data = selectedProductLocal[productData?.gtm?.id];
      addSelectedProductToLocal(productData?.gtm?.id, {
        ...data,
        listName,
      });
    }
    let productViewType = null;
    if (isQuickView) {
      productViewType = window.location.href.indexOf('wishlist') !== -1 ? 'wishlist_quickview' : `${getPageTypeAcronym()}_quickview`;
    }
    dlObject = await createPlpBaseObject(
      eventName,
      productData,
      quantity,
      index,
      dataInsightsId,
      productViewType,
    );
  } else {
    dlObject = await createPdpBaseObject(
      eventName,
      productData,
      quantity,
      selectedSize,
      false,
      null,
    );
  }
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export async function datalayerRemoveFromCartEvent({ productData, quantity }) {
  const eventName = 'remove_from_cart';
  const dlObject = await createPdpBaseObject(eventName, productData, quantity, '', true, null);
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerSizeSelectorEvent(size) {
  const dlObject = {
    event: 'ecommerce',
    eventCategory: 'ecommerce',
    eventAction: 'pdp size click',
    eventLabel: `size: ${size}`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerSocialShareEvent(stateOrPlatform) {
  const dlObject = {
    event: 'ecommerce',
    eventCategory: 'ecommerce',
    eventAction: 'share this page',
    eventLabel: `${stateOrPlatform}`,
  };
  sendAttributesToDataLayer(dlObject);
}

export function datalayerPdpAccordionToggleEvent(title, state) {
  let eventLabel = `${title?.toLowerCase()}`;
  if (state) {
    eventLabel += ` - ${state?.toLowerCase()}`;
  }
  const dlObject = {
    event: 'ecommerce',
    eventCategory: 'ecommerce',
    eventAction: 'pdp clicks',
    eventLabel,
  };
  sendAttributesToDataLayer(dlObject);
}

/* PLP & PDP & Wishlist */

/**
 * Method to send datalayer event on adding or removing product from wishlist
 * @param {*} isAdded true if product is added to wishlist, false if removed
 * @param {*} productData Products data array for PLP or product data object for PDP
 * @param {*} pageType plp or pdp or wishlist
 * @param {*} index index value of the product selected
 */
export async function datalayerAddToWishlistEvent(
  isAdded,
  productData,
  pageType,
  index,
  insightsQueryId,
) {
  const currency = await getConfigValue('currency');
  const dlObject = {
    event: isAdded ? 'add_to_wishlist' : 'remove_from_wishlist',
  };
  if (pageType === 'plp') {
    dlObject.ecommerce = {
      currency,
      value: productData.gtm['gtm-price'],
      items: await transformProductItemData([productData], 1, false, true, index, dlObject.event),
      'data-insights-query-id': insightsQueryId,
    };
  } else {
    dlObject.ecommerce = (
      await createPdpBaseObject('', productData, 1, null, null, index)
    ).ecommerce;
  }
  dlObject.ecommerce = { ...dlObject.ecommerce };
  sendAttributesToDataLayer({ ecommerce: null });
  sendAttributesToDataLayer(dlObject);
}

/* DL events for Product Recommendations */

/**
 * Transform Algolia Product Recommendations item data
 * @param {*} productData products data array
 * @param {*} listname listname
 * @param {*} quantity quantity
 * @param {*} selectedIndex index value of product selected
 */
async function transformRecommendedProductItemData(
  productData,
  listName,
  quantity,
  selectedIndex = 0,
  targetData = null,
  eventName = '',
) {
  const targetEventData = targetData || await getRecommendationsTargetData();
  return productData?.map(({ sku, productData: product }, index) => {
    const newIndex = eventName === 'select_item' ? selectedIndex : selectedIndex + (index + 1);
    const categories = product?.category?.en;
    const itemCategories = categories?.split('|');
    const itemData = {
      item_id: sku.split('_ae')[0] || null,
      item_name: product.name?.en || null,
      affiliation: 'Online Store',
      coupon: null,
      discount: Number(product.discount) || null,
      item_brand: product.brand || null,
      item_category: categories || null,
      item_category2: itemCategories?.[0] || null,
      item_category3: itemCategories?.[1] || null,
      item_category4: itemCategories?.[2] || null,
      item_category5: itemCategories?.[3] || null,
      item_list_id: null,
      item_list_name: listName || null,
      item_variant: null,
      in_stock: Boolean(product.in_stock) || null,
      price: Number(product.price) || null,
      quantity: Number(quantity),
      index: Number(newIndex),
      returnEligibility: null,
      item_color: product?.color?.en || null,
      item_size: null,
      item_fragrance_name: product?.fragrance_name.en,
      item_fragrance_category: product?.fragrance_category.en,
      ...targetEventData,
    };
    return { ...itemData, ...transformBannerData() };
  });
}

export async function recommendationsViewItemList(
  totalProductCount,
  productData,
  title,
  index,
  key,
) {
  const listName = `pr-${getPageTypeAcronym()}-${title?.toLowerCase()}`;
  const targetData = await getRecommendationsTargetData(key);
  const dlObject = {
    event: 'view_item_list',
    eventLabel: `${totalProductCount || 0} items`,
    ecommerce: {
      item_list_id: null,
      item_list_name: listName,
      items: await transformRecommendedProductItemData(productData, listName, 1, index, targetData),
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export async function datalayerSelectRecommendedItemListEvent(
  productData,
  targetId,
  totalItems,
  title,
  indexVal,
) {
  const listName = `pr-${getPageTypeAcronym()}-${title?.toLowerCase()}`;
  localStorage.setItem('categoryListName', listName);
  const targetData = await getRecommendationsTargetData(targetId);
  localStorage.setItem('targetEventData', JSON.stringify(targetData));
  const dlObject = {
    event: 'select_item',
    eventLabel: `${totalItems} items`, // total number of items displayed on the listing page
    ecommerce: {
      item_list_id: null,
      item_list_name: listName || null,
      items: await transformRecommendedProductItemData(
        [productData],
        listName,
        1,
        indexVal,
        targetData,
        'select_item',
      ),
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export const datalayerConfirmationPageViewEvent = (
  data,
) => {
  const { items } = data;
  const updatedItems = [];

  items?.forEach((prod) => {
    const {
      targetEventData = null,
      bannerData = null,
    } = getSelectedProductFromLocal(prod?.item_id) || {};

    const targetActivityData = parseTargetData(targetEventData);
    const updatedBannerData = getBannerData(bannerData);
    const item = {
      ...prod,
      ...updatedBannerData,
      ...targetActivityData,
    };

    updatedItems.push(item);
  });

  const dlObject = {
    event: 'purchase',
    ecommerce: {
      ...data,
      items: updatedItems,
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
};

export const datalayerGenericDLPurchaseSpecific = (
  data,
) => {
  const dlObject = {
    ...data,
    cartId: store.getCartId(),
    firstTimeTransaction: hasCustomerOrderExisting ? 'False' : 'True',
  };

  sendAttributesToDataLayer(dlObject);
};

export async function datalayerAddPaymentInfo({
  value,
  currency,
  coupon,
  shippingTier,
  discount,
  productData,
  deliveryOption,
  paymentType,
  storeLocation,
}) {
  const isAuthenticated = !!getCookie('auth_user_token');
  const dlObject = {
    event: 'add_payment_info',
    ecommerce: {
      value,
      currency,
      coupon,
      login_method: isAuthenticated ? 'Logged In' : 'Guest Login',
      shipping_tier: shippingTier,
      discount,
      delivery_option: deliveryOption,
      payment_type: paymentType,
      storeLocation,
      items: await transformCartProductItemData(productData, 1),
    },
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerCodOtpVerification({ eventCategory, eventAction, eventLabel }) {
  const dlObject = {
    event: 'cod_otp_verification',
    eventCategory,
    eventAction,
    eventLabel,
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerPaymentErrors({ eventAction, eventLabel }) {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'payment errors',
    eventAction,
    eventLabel,
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerLoyaltySwitchEvent({ eventLabel }) {
  const dlObject = {
    event: 'loyalty switch',
    eventCategory: 'loyalty switch',
    eventAction: 'loyalty switch',
    eventLabel,
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerEgiftCard({ eventLabel, eventAction }) {
  const dlObject = {
    event: 'egift_card',
    eventCategory: 'egift_card',
    eventAction,
    eventLabel,
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

// DL for reviews/ratings events on PDP (Bazaar Voice)
// DL for reviews/ratings events on PDP (Bazaar Voice)
const bvDataLayerObject = (
  event,
  type,
  productId,
  brand,
  bvProduct,
  details = {},
) => ({
  event,
  details: {
    type,
    bvProduct,
    productId,
    brand,
    ...details,
  },
});

/**
 * on PDP page load
 * @param {*} reviewData productId
 * @param {*} ctx categoryName, productTotalRatings, percentageRating
 */

export const dataLayerBVTrackPageView = (reviewData, ctx) => {
  const productId = reviewData?.Results?.[0]?.ProductId || null;
  const categoryName = ctx?.data?.gtmAttributes?.category || null;
  const productIncludesData = reviewData?.Includes?.Products?.[productId] || {};
  const productTotalRatings = productIncludesData?.ReviewStatistics?.TotalReviewCount || null;
  const productRecommendedCount = productIncludesData?.ReviewStatistics?.RecommendedCount || null;
  const percentageRating = productTotalRatings
    ? Math.round((productRecommendedCount * 100) / productTotalRatings)
    : null;

  const dlObject = bvDataLayerObject(
    'BV_trackPageView',
    'Product',
    productId,
    productIncludesData?.BrandExternalId,
    'RatingsAndReviews',
    {
      categoryId: productIncludesData?.CategoryId,
      categoryName,
      numReviews: productTotalRatings,
      avgRating: productIncludesData?.ReviewStatistics?.AverageOverallRating,
      percentRecommended: percentageRating,
    },
  );

  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
};

/**
 * event occurs on PDP  page - on ratings click, loadmore, review form
 * @param {*} eventName eventName
 * @param {*} reviewData productId
 * @param {*} gtmAttributes productId
 * @param {*} linkType linkType
 * @param {*} detail1 detail1
 * @param {*} detail2 detail2
 */
export const dataLayerBVFeatureLinkClick = (
  eventName,
  reviewData,
  gtmAttributes,
  linkType,
  detail1,
  detail2,
) => {
  const productId = reviewData?.Results?.[0]?.ProductId || gtmAttributes?.id;
  const productIncludesData = reviewData?.Includes?.Products?.[productId] || {};
  const categoryName = gtmAttributes?.category || null;

  const dlObject = bvDataLayerObject(
    eventName,
    'Used',
    productId,
    productIncludesData?.BrandExternalId,
    'RatingsAndReviews',
    {
      categoryId:
        productIncludesData?.CategoryId
        || localStorage.getItem('categoryListId'),
      categoryName,
      name: linkType,
      detail1,
      detail2,
    },
  );

  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
};

/**
 * event on pdp review modal BV review helpfull yes, no, reported
 * @param {*} eventName eventName
 * @param {*} sku productID
 * @param {*} linkType linkType
 * @param {*} detail1 detail1
 * @param {*} detail2 detail2
 */
export const dataLayerBVFeatureSortClick = async (
  eventName,
  sku,
  linkType,
  detail1,
  detail2,
) => {
  const getBrand = await getPageAttributes();
  const productId = sku || null;
  const categoryId = localStorage.getItem('categoryListId') || null;
  const categoryName = localStorage.getItem('categoryListName') || null;

  const dlObject = bvDataLayerObject(
    eventName,
    'Used',
    productId,
    getBrand?.brand,
    'RatingsAndReviews',
    {
      categoryId,
      categoryName,
      name: linkType,
      detail1,
      detail2,
    },
  );

  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
};

/**
 *
 * @param {*} eventName event name
 * @param {*} itemId productID
 */
export const dataLayerBVTrackInView = async (eventName, itemId) => {
  const getBrand = await getPageAttributes();
  const productId = itemId || null;

  const dlObject = {
    event: eventName,
    details: {
      productId,
      bvProduct: 'RatingsAndReviews',
      brand: getBrand?.brand,
    },
  };

  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
};
export function datalayerHelloMemberPromoSection({ eventActionLabel }) {
  const dlObject = {
    event: 'hellomember',
    eventCategory: 'hello-member-promo-section',
    eventAction: eventActionLabel,
  };

  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerHelloMembersOffersSelection({ eventAction, eventLabelData }) {
  const dlObject = {
    event: 'hellomember',
    eventCategory: 'memberOffer',
    eventAction: `selected - ${eventAction}`,
    eventLabel: eventLabelData,
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerHelloMembersOffersApply({ eventAction, eventLabelData }) {
  const dlObject = {
    event: 'hellomember',
    eventCategory: 'memberOffer',
    eventAction: `applied - ${eventAction}`,
    eventLabel: eventLabelData,
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}

export function datalayerPromoSelectorEvent({ eventAction, eventLabelData }) {
  const dlObject = {
    event: 'eventTracker',
    eventCategory: 'promo selector',
    eventAction,
    eventLabel: eventLabelData,
  };
  sendAttributesToDataLayer({ ecommerce: null }); // Clear the previous ecommerce object.
  sendAttributesToDataLayer(dlObject);
}
