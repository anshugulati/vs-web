/* eslint-disable import/no-cycle */
import { getConfigValue } from '../configs.js';
import { getCookie } from '../commerce.js';
import {
  getLoggedInUserAttributes,
  getPageAttributes,
  getPageName,
  setPageName,
} from '../analytics/google-data-layer.js';
import { store } from '../minicart/api.js';
import { getMetadata } from '../aem.js';

export const EVENT_QUEUE = [];

function getBrandPath() {
  const brandCode = getMetadata('brand');
  return `${(brandCode !== '') ? `${brandCode}/` : ''}`;
}
const brandEventsPromise = import(`./${getBrandPath()}target-events.js`).catch(() => Promise.resolve);

/**
 * Common XDM payload for all target calls
 * @returns XDM payload for authenticated users, empty object otherwise
 */
export async function xdmPayload() {
  const isAuthenticated = !!getCookie('auth_user_token');
  if (!isAuthenticated) return {};
  const [{ userID = null }, brand = null] = await Promise.all([
    getLoggedInUserAttributes(),
    getConfigValue('brand'),
  ]);
  const xdmObj = {
    identityMap: {
      customerSourceID: [
        {
          authenticatedState: 'authenticated',
          id: `${userID}-MAGENTO_${brand}`,
          primary: true,
        },
      ],
    },
  };
  return xdmObj;
}

/**
 * Common payload for all pages where target call is fired
 * @returns Promise of attributes object
 */
export async function pageLoadData() {
  const [
    { brand, countryCode, language },
    environment,
    { brandPageLoadData = () => {} },
  ] = await Promise.all([
    getPageAttributes(),
    getConfigValue('target-environment'),
    brandEventsPromise,
  ]);
  const brandPayload = brandPageLoadData();
  const market = countryCode?.toLowerCase();
  const productsInCart = store
    .getCart()
    ?.cart?.items?.map(
      ({ extension_attributes: attribs = {} }) => `${attribs.parent_product_sku}_${market}`,
    );
  const currentPath = window.location.pathname;
  const cartIds = (currentPath.includes('/cart') || currentPath.includes('/checkout'))
    ? productsInCart?.join(', ') || ''
    : undefined;
  const { pageType } = window;
  return {
    channel: 'web',
    brand,
    environment,
    market,
    language,
    pageName: getPageName(pageType), // The page/screen name on which the user is on
    pageType,
    excludedIds: productsInCart?.join(', ') || '', // List of product IDs that are already in the cart
    cartIds,
    ...brandPayload,
  };
}

/**
 * Send display event to Target on page load for reporting purpose
 * @param {*} payload Custom scoped Propositions displayed on the page
 */
export async function targetDisplayEvent(payload = [], noDisplayScopes = []) {
  const propositions = payload
    ?.filter(({ renderAttempted, scope, key }) => (
      renderAttempted === false && !noDisplayScopes.includes(scope || key)
    ))
    ?.map(({
      id = '',
      scope = '',
      key = '',
      scopeDetails = {},
    }) => ({
      id,
      scope: scope || key,
      scopeDetails,
    }));
  if (!window.alloy || propositions.length === 0) return;
  const [datasetId, pageAttributes] = await Promise.all([
    getConfigValue('target-display-dataset-id'),
    pageLoadData(),
  ]);
  delete pageAttributes.cartIds;
  try {
    window.alloy('sendEvent', {
      xdm: {
        eventType: 'decisioning.propositionDisplay',
        _experience: {
          decisioning: {
            propositions,
            propositionEventType: {
              display: 1,
            },
          },
        },
      },
      data: {
        __adobe: {
          target: pageAttributes,
        },
      },
      edgeConfigOverrides: {
        com_adobe_experience_platform: {
          datasets: {
            event: {
              datasetId,
            },
          },
        },
      },
    });
  } catch (e) {
    console.error(e);
  }
}

/**
 * Find and return the activity payload attributes from target response meta data
 * @param {*} targetId decision scope
 * @returns activity payload attributes
 */
function getActivityInfo(targetId) {
  const { meta } = EVENT_QUEUE?.find((el) => el.key === targetId)?.data?.[0] || {};
  return {
    activityId: meta?.['activity.id'],
    activityName: meta?.['activity.name'],
    experienceID: meta?.['experience.id'],
    experienceName: meta?.['experience.name'],
  };
}

/**
* Auxillary function to create listed category object from category list
* @param {*} categoryList Array of All the current and parent categories
* @param {*} entity Entity
* @returns listed category object
*/
export function createCategories(categoryList, key) {
  return {
    [`${key}majorCategory`]: categoryList?.[0],
    [`${key}minorCategory`]: categoryList?.[1],
    [`${key}subCategory`]: categoryList?.[2],
    [`${key}listingCategory`]: categoryList
      ?.[categoryList.length - 1],
  };
}
/**
 * Create payload for recommendations click event
 * @param {*} targetId recommendation target id / decision scope
 * @param {*} recommendationName recommendation name
 * @returns payload object
 */
async function getRecommendationsClickPayload(targetId, recommendationName) {
  if (!recommendationName) return Promise.resolve({});
  return {
    button: 'Recommendation Tile',
    recommendationName,
    ...getActivityInfo(targetId),
  };
}

/**
 * Create payload for personalized banner / popup cta click event
 * @param {*} targetId personalized block target id / decision scope
 * @param {*} personalizationCta cta clicked
 * @returns payload object
 */
async function getPersonalizationCtaPayload(targetId, personalizationCta) {
  if (!personalizationCta) return Promise.resolve({});
  return {
    button: personalizationCta,
    ...getActivityInfo(targetId),
  };
}

/**
 * Send display event to Target on CTA clicks for reporting purpose
 * @param {param.key} key clicked entity / decision scope
 * @param {param.recommendationName} recommendationName Optional.recommendation name
 * @param {param.personalizationCta} personalizationCta Optional.personalization CTA clicked
 */
export async function targetClickTrackingEvent({ key, recommendationName, personalizationCta }) {
  if (!window.alloy || !key) return;
  const [
    recommendationAttribs,
    personalizationAttribs,
    pageAttribs,
    datasetId,
  ] = await Promise.all([
    getRecommendationsClickPayload(key, recommendationName),
    getPersonalizationCtaPayload(key, personalizationCta),
    pageLoadData(),
    getConfigValue('target-display-dataset-id'),
  ]);
  delete pageAttribs.cartIds;
  const data = {
    __adobe: {
      target: {
        clicked: key,
        ...recommendationAttribs,
        ...personalizationAttribs,
        ...pageAttribs,
      },
    },
  };
  try {
    await window.alloy('sendEvent', {
      xdm: {
        eventType: 'decisioning.propositionDisplay',
        _experience: {
          decisioning: {
            propositions: [
              {
                scope: 'mboxClickTracking',
              },
            ],
            propositionEventType: {
              display: 1,
            },
          },
        },
      },
      renderDecisions: false,
      data,
      edgeConfigOverrides: {
        com_adobe_experience_platform: {
          datasets: {
            event: {
              datasetId,
            },
          },
        },
      },
    });
  } catch (e) {
    console.error(e);
  }
}

const MALE_LIST = ['men', 'male', 'boys'];
const FEMALE_LIST = ['women', 'female', 'girls'];

/**
 * Auxillary function to check gender of the product
 * based on pre-defined logic from category list
 * @param {*} categoryList Category list of currently viewed product
 * @returns gender - male, female or unisex
 */
function checkGender(categoryList) {
  const maleRegex = new RegExp(MALE_LIST.join('|'), 'i');
  const femaleRegex = new RegExp(FEMALE_LIST.join('|'), 'i');

  const hasMaleItem = categoryList.some((item) => maleRegex.test(item));
  const hasFemaleItem = categoryList.some((item) => femaleRegex.test(item));

  if (hasFemaleItem) {
    return 'Female';
  }
  if (hasMaleItem && !hasFemaleItem) {
    return 'Male';
  }
  return 'Unisex';
}

/**
 * Utility to find attribute is array of objects and return it's value
 * @param {*} arr Array of attributes object
 * @param {*} attribute Attribute name to find
 * @returns Attribute value if present else undefined
 */
function getValue(arr, attribute) {
  const value = arr?.find((el) => el.name === attribute)?.value || undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return value.join(', ');
  }
  return value;
}

/**
 * Method to create data object for PLP page
 * @param {*} categoryList Array of All the current and parent categories
 * @returns plp data object
 */
export async function plpLoadData(categoryList = []) {
  const categoryIdObj = {
    'user.categoryId': categoryList.join(':'),
    'entity.categoryId': categoryList.join(':'),
  };
  const categoryObj = createCategories(categoryList, 'entity.');
  setPageName(window.pageType, '', categoryList);
  const commonPageData = await pageLoadData();
  return { ...commonPageData, ...categoryIdObj, ...categoryObj };
}

/**
 * Method to create data object for PDP page
 * @param {gtm, attributes, options} product Product data from commerce
 * @returns pdp data object
 */
export async function pdpLoadData({
  gtm,
  attributes = [],
  options,
  sku,
  variants,
  priceRange,
}) {
  const { brandPdpLoadData = () => {} } = await brandEventsPromise;
  const brandPayload = brandPdpLoadData(attributes);
  const categoryList = gtm?.category?.split('/')?.filter((x) => x) || [];
  let defaultCategoryList;
  const plpCategoryList = localStorage.getItem('categoryListName');
  if (plpCategoryList?.startsWith('PLP')) {
    defaultCategoryList = plpCategoryList.split('|').slice(1) || [];
  }
  // Category id structure is created from product category list
  // or default category list through navigation (if coming from PLP) based on
  // predefined logic given by target team
  const categoryId = (defaultCategoryList || categoryList)
    ?.filter((item) => item)
    ?.reduce((acc, item) => {
      const prefix = acc.split(', ').pop();
      const newItem = prefix ? `${prefix}:${item}` : item;
      return acc === '' ? newItem : `${acc}, ${newItem}`;
    }, '') || undefined;

  const size = options
    ?.find((el) => el.id === 'size')
    ?.values?.filter((el) => el.inStock)
    ?.map((el) => el.value)
    ?.join(', ');
  setPageName(window.pageType, gtm?.name);

  const finalPrice = priceRange?.minimum?.final?.amout?.value;
  const regularPrice = priceRange?.minimum?.regular?.amout?.value;
  const isItemOnSale = Math.abs(finalPrice - regularPrice) > 0;

  const commonPageData = await pageLoadData();
  const dataObj = {
    'entity.id': `${sku}_${commonPageData.market}`, // This is mandatory field
    'entity.value': finalPrice?.toString(),
    'user.categoryId': categoryId,
    'entity.categoryId': categoryId,
    'entity.brand': commonPageData.brand,
    'entity.sub_brand': getValue(attributes, 'product_brand'),
    'entity.gender': checkGender(categoryList),
    'entity.market': commonPageData.market,
    'entity.color': getValue(variants?.variants?.[0].product?.attributes, 'color_label'),
    'entity.size': size || undefined,
    'entity.name': gtm?.name,
    'entity.context': getValue(attributes, 'context'),
    'entity.is_new': (getValue(attributes, 'is_new') === '1').toString(),
    'entity.collection_type': getValue(attributes, 'product_collection'),
    // As per client on_sale has to be calculated, instead of using is_sale from commerce
    'entity.on_sale': isItemOnSale?.toString(),
    'entity.concept': getValue(attributes, 'concept'),
    'entity.age_group': getValue(attributes, 'age_group'),
    'entity.color_family': getValue(attributes, 'color_family'),
    'entity.departmentId': categoryList.join(' | ') || undefined,
  };
  const categoryObj = createCategories(categoryList, 'entity.');
  return {
    ...commonPageData,
    ...dataObj,
    ...categoryObj,
    ...(brandPayload || {}),
  };
}

export async function targetOrderConfirmationLoadData({ purchaseId, totalPrice, products = [] }) {
  const commonPageData = await pageLoadData();
  const { market } = commonPageData;
  const productsList = products
    .map(({ sku, parent_item: parentItem }) => ({
      sku,
      parentSku: parentItem?.extension_attributes?.parent_product_sku,
    }))
    ?.filter(({ parentSku }) => Boolean(parentSku)) // Filter out items with null parent sku
    ?.filter(
      (item, index, self) => index === self.findIndex((t) => t.sku === item.sku),
    ) // Remove duplicates based on sku not parent sku
    ?.map(({ parentSku }) => `${parentSku}_${market}`); // Get the formatted parent sku
  const data = {
    ...commonPageData,
    'orderConfirmationMbox.order.purchaseID': purchaseId,
    'orderConfirmationMbox.order.priceTotal': totalPrice,
    'orderConfirmationMbox.order.purchases.value': 1, // Only this should be always 1
    'orderConfirmationMbox.productListItems': productsList,
  };
  const xdm = {
    commerce: {
      order: {
        purchaseID: purchaseId,
        priceTotal: totalPrice,
      },
      purchases: {
        value: 1, // Only this should be always 1
      },
    },
    productListItems: productsList.map((sku) => ({ SKU: sku })),
  };
  return {
    data,
    xdm,
  };
}
