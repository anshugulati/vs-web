/* eslint-disable max-len */

import {
  fetchCategoriesByUrlKey, getPromotionByUrlKey,
  getProductData, getProductStockStatus, loadProduct,
} from '../../scripts/commerce.js';
import { getConfigValue } from '../../scripts/configs.js';
import {
  buildUrlKey,
  enableStickyElements,
  fetchPlaceholdersForLocale,
  fireTargetCall,
  formatPrice,
  loadFragment,
  setMetaAttribute,
  isSearchPage,
  isPromotionPage,
  showCommerceErrorPage,
  getRedirectUrl,
  getVisitorEligibility,
  getPreviewPreaccessType,
  createModalFromContent,
  openModal,
  hasValue,
  closeModal,
  isLoggedInUser,
  sanitizeDOM,
  getLanguageAttr,
} from '../../scripts/scripts.js';
import {
  datalayerViewItemListEvent,
  datalayerSelectItemListEvent,
  datalayerFilterEvent,
  datalayerSortingEvent,
  datalayerImageSwipeEvent,
  datalayerColorSwatchEvent,
  dataLayerGridSelectionEvent,
  datalayerAddToWishlistEvent,
  dataLayerLoadMoreSelectionEvent,
  datalayerColorSwatchChevron,
  dataLayerInternalSearchSuccessEvent,
  dataLayerInternalSearchEmptyEvent,
  sendCategoriesToDataLayer,
  datalayerAddToCartEvent,
  datalayerViewItemEvent,
} from '../../scripts/analytics/google-data-layer.js';
import { plpLoadData, pageLoadData } from '../../scripts/target/target-events.js';
import { cartApi, store } from '../../scripts/minicart/api.js';
import {
  getCategoryProducts,
  getFilteredProducts,
  getProductSuggestions,
  getFilterAliaseValues,
  getPromotionProducts,
} from '../../scripts/product-list/api.js';
import { removeItemFromCart, updateItemInCart } from '../../scripts/minicart/cart.js';
import {
  loadBannerFragments,
  getSizeGroup,
  manageGroupSizeFilterList,
  handleSizeToggle,
  createSizeToggle,
  createSizeGroupListItem,
  handleGroupSizeAccordion,
  updateProductPopup,
  renderProduct,
  updateGroupFilters,
} from '../../scripts/plp-utils/plp-utils.js';
import { recommendationCarousalVariation } from '../carousel/carousel.js';

// TODO exclude all EDS categories
const EXCLUDED_CATEGORIES = ['view-all'];

// constants
const COLOR_ATTRIBUTE = 'attr_color_family';
const RATING_ATTRIBUTE = 'attr_bv_rating';
const PRICE_ATTRIBUTE = 'final_price';
const SIZE_ATTRIBUTE = 'attr_size';
const SIZE_GROUPING = 'group_sizes';
const SWIPE_NEXT = 'swipenext';
const SWIPE_PREV = 'swipeprev';
const DEFAULT_LANGUAGE = 'en';
const MAX_FILTER_ITEMS = 5;
const CURRENT_CATEGORY = buildUrlKey().split('/')?.pop();
const SINGLE_QUANTITY = 1;
const CART_OPERATIONS = Object.freeze({
  ADD: 'add',
  REMOVE: 'remove',
});

// global states
const plpFilterVariation = await getConfigValue('plp-filter-variation');
const recommendCarouselVariation = await getConfigValue('recommendation-carousel-variation');
const isRTL = document.documentElement.dir === 'rtl';
const plpFilterChipsEnabled = await getConfigValue('filter-chips-enabled'); // get chips/filter enabled/disabled
const plpFilterChipsAttr = await getConfigValue('filter-chips-attribute'); // get chips/filter attribute
const plpLoadBanner = await getConfigValue('load-plp-banner');
const plpFilterPriceSliderStep = await getConfigValue('priceslider-step');
const plpBrandName = await getConfigValue('brand-name-on-plp-widget');
const plpPageTitleAboveSidebar = await getConfigValue('plp-page-title-above-sidebar');
const joinAuraBannerPosition = await getConfigValue('join-aura-banner-card-position-plp-slp');
const sizeGroupConfig = await getSizeGroup();
const displayMobileQuickviewModal = await getConfigValue('mobile-quickview-modal');
const isMobileChipStickyBehaviour = await getConfigValue('is-mobile-chips-sticky-behaviour');
const useCoreQuickview = await getConfigValue('use-core-quickview');
const productListingLanguage = document.documentElement.lang;
const defalutListingLanguage = 'en';
const categoryPath = [];
const urlFacets = [];
let urlPrice = '';
let searchTerm = '';
let placeholders;
let datalayerPageType = 'plp';
let listingType = '';
let facetFiltersDatalayer = '';
let offerListSku = '';
let promotionId = '';
let promotionTitle = '';
let insightsQueryId = '';

export const attributesToRetrieve = `[
  "url",
  "attr_fragrance_name",
  "attr_fragrance_category",
  "attr_product_collection",
  "attr_collection_1",
  "attr_preview_preaccess_data",
  "attr_bv_rating",
  "attr_bv_total_review_count",
  "attr_bv_average_overall_rating",
  "product_labels",
  "media",
  "media_pdp",
  "title",
  "article_swatches",
  "promotions",
  "product_labels",
  "discount",
  "original_price",
  "final_price",
  "gtm",
  "sku",
  "attr_color",
  "in_stock",
  "member_price",
  "swatches",
  "attr_product_brand"
]`;
const attributesToRetrieveWithLang = `[
  "url.${productListingLanguage}",
  "attr_fragrance_name",
  "attr_fragrance_category",
  "attr_product_collection.${productListingLanguage}",
  "attr_collection_1.${productListingLanguage}",
  "media",
  "media_pdp",
  "title.${productListingLanguage}",
  "article_swatches.${productListingLanguage}",
  "promotions.${productListingLanguage}",
  "product_labels.${productListingLanguage}",
  "discount.${productListingLanguage}",
  "original_price.${productListingLanguage}",
  "final_price.${productListingLanguage}",
  "attr_preview_preaccess_data.${productListingLanguage}",
  "attr_bv_rating.${productListingLanguage}",
  "attr_bv_total_review_count",
  "attr_bv_average_overall_rating.${productListingLanguage}",
  "product_labels.${productListingLanguage}",
  "swatches.${productListingLanguage}",
  "gtm",
  "sku",
  "attr_product_brand.${productListingLanguage}",
  "attr_color.${defalutListingLanguage}",
  "attr_brand_full_name.${productListingLanguage}",
  "member_price"
]`;
export const responseFields = `[
  "userData",
  "facets",
  "renderingContent",
  "hits",
  "nbHits",
  "page",
  "hitsPerPage",
  "params"
]`;
const facetsToRetrieve = '["*"]';
let productListingConfig;
let productListingPage = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let intervalId;
let lastSearchTerm = '';
let filterAliasValues;

const isAuraEnabled = await getConfigValue('aura-price-enabled');
const excludeAuraCardPages = ['wishlist'];
const openAuraModal = isAuraEnabled === 'true'
  ? await import('../../scripts/aura/common.js')
  : {};

// yield and start new macrotask to avoid blocking time (TBT)
async function performanceYield() {
  await new Promise((resolve) => { setTimeout(resolve, 0); });
}

const loggedCheck = isLoggedInUser();

async function fetchAuraData() {
  const { getAuraCustomerData } = isAuraEnabled
    ? await import('../../scripts/aura/api.js')
    : {};
  try {
    let auraCustomerData = {};
    if (loggedCheck) {
      // Use Promise.all to make calls in parallel
      const [customerData] = await Promise.all([
        getAuraCustomerData(),
      ]);
      auraCustomerData = customerData;
    }
    return { auraCustomerData };
  } catch (error) {
    console.error('Error fetching Aura data:', error);
    throw error;
  }
}

const { auraCustomerData } = await fetchAuraData();

const isAuraActive = isAuraEnabled && isAuraEnabled === 'true';
const isAuraDetailAvailable = auraCustomerData?.apc_link === 2;
const isAuraEnrolledDetailAvailable = auraCustomerData?.apc_link === 3;

const lang = getLanguageAttr();
/**
 * Get Algolia index name according to selected sorting
 *
 * @returns {string|string|Promise<string|undefined>}
 */
function getAlgoliaIndexName(config = productListingConfig) {
  if (document.querySelector('.filters-body-main-ul [data-attribute="sorting"] ul li.filter-radio-active') !== null) {
    return document.querySelector('.filters-body-main-ul [data-attribute="sorting"] ul li.filter-radio-active')
      .getAttribute('data-index');
  }
  return (searchTerm ? config['algolia-search-index'] : config['algolia-plp-index']);
}

function buildUrlWithFilters(filtersString) {
  return isSearchPage() ? `${window.location.origin}${window.location.pathname}/${filtersString}`
    : `${window.location.href.replace(/\/+$/, '')}/${filtersString}`;
}

/**
 * Get all config values for product listing
 */
export async function getProductListingConfig() {
  return {
    'plp-hits-per-page': '' || await getConfigValue('plp-hits-per-page'),
    'plp-show-discount-value': '' || await getConfigValue('plp-show-discount-value'),
    'plp-show-review-ratings': '' || await getConfigValue('plp-show-review-ratings'),
    'plp-max-carousel-images': '' || await getConfigValue('plp-max-carousel-images'),
    'plp-swatch-style': '' || await getConfigValue('plp-swatch-style'),
    'plp-max-swatch-count': '' || await getConfigValue('plp-max-swatch-count'),
    'plp-swatch-link-pdp': '' || await getConfigValue('plp-swatch-link-pdp'),
    'algolia-default-url': '' || await getConfigValue('algolia-default-url'),
    'algolia-plp-index': '' || await getConfigValue('algolia-plp-index'),
    'algolia-search-index': '' || await getConfigValue('algolia-search-index'),
    'algolia-filters-on-main-page': '' || await getConfigValue('algolia-filters-on-main-page'),
    'algolia-hidden-filters': '' || await getConfigValue('algolia-hidden-filters'),
    'x-algolia-agent': '' || await getConfigValue('x-algolia-agent'),
    'x-algolia-application-id': '' || await getConfigValue('x-algolia-application-id'),
    'x-algolia-api-key': '' || await getConfigValue('x-algolia-api-key'),
    'favourites-hits-per-page': '' || await getConfigValue('favourites-hits-per-page'),
    'plp-show-swatches': '' || await getConfigValue('plp-show-swatches'),
    'producttile-enable-addtocart': '' || await getConfigValue('producttile-enable-addtocart'),
    'producttile-enable-quantityselector': '' || await getConfigValue('producttile-enable-quantityselector'),
    'plp-product-info': '' || await getConfigValue('plp-product-info'),
    'producttile-enable-quickview': '' || await getConfigValue('producttile-enable-quickview'),
    'plp-card-link': '' || await getConfigValue('plp-card-link'),
    'enable-favourites-with-options': '' || await getConfigValue('enable-favourites-with-options'),
  };
}

/**
 * Search for value in the object
 *
 * @param value
 * @returns {*|null}
 */
function findValueInObject(value) {
  const entry = Object.entries(filterAliasValues.data).find(([, obj]) => Object.values(obj).includes(value));
  return entry ? entry[1] : null;
}

function safeEncodeURIComponent(str) {
  try {
    if (decodeURIComponent(str) === str) {
      return encodeURIComponent(str);
    }
    return str;
  } catch (e) {
    return encodeURIComponent(str);
  }
}

function getAttributeNameByPage(attributeName) {
  if (isSearchPage()) {
    return attributeName;
  }
  return `${attributeName}.${productListingLanguage}`;
}

function isOfferListing() {
  return listingType === 'offer-listing';
}

function buildFilterStrings(listingConfig = productListingConfig) {
  const facetFilters = [];
  const activeFacets = [];
  document.querySelectorAll('.filters-body-main-ul .filters-values-ul .active-checkbox')?.forEach((activeCheckbox) => {
    let facetName = activeCheckbox.getAttribute('data-filter-attr-name');
    const facetValue = activeCheckbox.getAttribute('data-filter-attr-value');
    if (facetName !== `${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`) {
      facetName = `${getAttributeNameByPage(facetName)}`;
    }

    if (facetFilters[facetName] === undefined) {
      facetFilters[facetName] = [facetValue];
    } else {
      facetFilters[facetName].push(facetValue);
    }
    activeFacets[facetName] = facetName;
  });

  while (urlFacets.length > 0) {
    const facet = urlFacets.pop().split('-');
    let facetName;
    if (!PRICE_ATTRIBUTE.includes(facet[0])) {
      facetName = `attr_${facet[0]}`;
    }

    const facetValue = `${decodeURIComponent(facet[1])}`;
    if (facetName === COLOR_ATTRIBUTE) {
      facetName = `${getAttributeNameByPage(facetName)}.value`;
    } else if (facetName !== PRICE_ATTRIBUTE) {
      facetName = `${getAttributeNameByPage(facetName)}`;
    }

    if (facetFilters[facetName] === undefined) {
      facetFilters[facetName] = [facetValue];
    } else {
      facetFilters[facetName].push(facetValue);
    }
    facetFilters[facetName] = [...new Set(facetFilters[facetName])];
    activeFacets[facetName] = facetName;
  }

  let numericFilters = '';
  // get active price range
  if (document.querySelector('.filters-body-main-ul .filters-values-ul .active-checkbox-price-range') !== null) {
    let priceFrom;
    let priceTo;
    if (plpFilterVariation && plpFilterVariation !== 'false') {
      /*  eslint-disable no-use-before-define */
      priceFrom = `${updatedMinPrice()}`;
      priceTo = `${updatedMaxPrice()}`;
    } else {
      priceFrom = document.querySelector('.filters-values-ul .active-checkbox-price-range').getAttribute('data-filter-attr-value').split('-')[0].trim();
      priceTo = document.querySelector('.filters-values-ul .active-checkbox-price-range').getAttribute('data-filter-attr-value').split('-')[1].trim();
    }
    // build price filter
    const priceField = searchTerm ? PRICE_ATTRIBUTE : `${getAttributeNameByPage(PRICE_ATTRIBUTE)}`;
    if (plpFilterVariation && plpFilterVariation !== 'false') {
      numericFilters += `&numericFilters=["${priceField}>=${priceFrom}",`;
    } else {
      numericFilters += `&numericFilters=["${priceField}>${priceFrom}",`;
    }
    numericFilters += `"${priceField}<=${priceTo}"]`;
    activeFacets.final_price = PRICE_ATTRIBUTE;
  } else if (urlPrice) {
    const urlPriceSplit = urlPrice.split(' - ');
    if (plpFilterVariation && plpFilterVariation !== 'false') {
      numericFilters += `&numericFilters=["${getAttributeNameByPage(PRICE_ATTRIBUTE)}>=${urlPriceSplit[0]}",`;
    } else {
      numericFilters += `&numericFilters=["${getAttributeNameByPage(PRICE_ATTRIBUTE)}>${urlPriceSplit[0]}",`;
    }
    numericFilters += `"${getAttributeNameByPage(PRICE_ATTRIBUTE)}<=${urlPriceSplit[1]}"]`;
    activeFacets.final_price = PRICE_ATTRIBUTE;
  }

  const filterCriteria = isOfferListing() ? ` AND (${offerListSku})` : '';
  let facetFiltersString = '';

  if (searchTerm) {
    facetFiltersString = `attributesToRetrieve=${attributesToRetrieve}&responseFields=${responseFields}&clickAnalytics=true&facets=${facetsToRetrieve}&filters=stock%20%3E%200&highlightPostTag=</ais-highlight-0000000000>&highlightPreTag=<ais-highlight-0000000000>&hitsPerPage=${listingConfig['plp-hits-per-page']}&analyticsTags=["web","customer"]&query=${safeEncodeURIComponent(searchTerm)}&page=${productListingPage}${numericFilters}`;
  } else if (promotionId) {
    facetFiltersString = `attributesToRetrieve=${attributesToRetrieve}&responseFields=${responseFields}&clickAnalytics=true&facets=${facetsToRetrieve}&filters=(stock > 0) AND (promotion_nid: ${promotionId})&hitsPerPage=${listingConfig['plp-hits-per-page']}&page=${productListingPage}${numericFilters}`;
  } else {
    facetFiltersString = `attributesToRetrieve=${attributesToRetrieveWithLang}&responseFields=${responseFields}&clickAnalytics=true&facets=${facetsToRetrieve}&filters=(stock > 0)${filterCriteria}&hitsPerPage=${listingConfig['plp-hits-per-page']}&optionalFilters=null&page=${productListingPage}${numericFilters}`;
  }

  if (document.querySelectorAll('.filters-body-main-ul .filters-values-ul .active-checkbox').length !== 0 || Object.keys(facetFilters).length !== 0) {
    facetFiltersString += '&facetFilters=[';
    Object.entries(facetFilters).forEach(([filterKey, filterValue]) => {
      facetFiltersString += '[';
      filterValue.forEach((value) => {
        facetFiltersString += `"${safeEncodeURIComponent(filterKey.replace('*', 'value'))}:${safeEncodeURIComponent(value)}",`;
      });
      facetFiltersString = facetFiltersString.slice(0, -1);
      facetFiltersString += '],';
    });
    facetFiltersString = facetFiltersString.slice(0, -1);
    facetFiltersString += ']';
  }
  return {
    facetFilters, activeFacets, numericFilters, facetFiltersString,
  };
}

/* returns true only if search term is new */
function isNewSearch() {
  return searchTerm && searchTerm !== lastSearchTerm;
}

/**
 * Send ViewItemList & Search events to dataLayer
 * @param {*} response Algolia response
 */
function dataLayerViewListEvents(response) {
  const totalItemsLength = response?.results?.[0]?.hits?.length;
  if (window.location.href.includes('/search?q=') && isNewSearch()) {
    if (totalItemsLength !== 0 && totalItemsLength > 0) {
      dataLayerInternalSearchSuccessEvent(totalItemsLength, searchTerm);
    } else {
      dataLayerInternalSearchEmptyEvent(searchTerm);
    }
    lastSearchTerm = searchTerm;
  }
}
/**
 * Build Algolia request
 *
 * @returns requests: [{indexName: (string|*), params: string}]
 */
export function buildAlgoliaRequest(listingConfig = productListingConfig, skipFilters = false) {
  const index = getAlgoliaIndexName(listingConfig);

  let {
    // eslint-disable-next-line prefer-const
    facetFilters, activeFacets, numericFilters, facetFiltersString,
  } = buildFilterStrings(listingConfig);

  const data = {
    requests: [
      {
        indexName: index,
        params: facetFiltersString,
      }],
  };

  if (skipFilters) {
    return data;
  }

  const buildFacetFiltersString = (facetFilterName) => {
    const filterCriteria = isOfferListing() ? ` AND (${offerListSku})` : '';
    if (searchTerm) {
      if (facetFilterName === PRICE_ATTRIBUTE) {
        numericFilters = '';
      }
      facetFiltersString = `clickAnalytics=true&facets=["*"]&filters=stock>0&highlightPostTag=</ais-highlight-0000000000>&highlightPreTag=<ais-highlight-0000000000>&hitsPerPage=${productListingConfig['plp-hits-per-page']}&query=${safeEncodeURIComponent(searchTerm)}&page=0&optionalFilters=null&facets=${facetFilterName}${numericFilters}`;
    } else if (promotionId) {
      facetFiltersString = `clickAnalytics=true&filters=(stock > 0) AND (promotion_nid: ${promotionId})&hitsPerPage=${productListingConfig['plp-hits-per-page']}&optionalFilters=null&page=0&facets=${facetFilterName}${facetFilterName === PRICE_ATTRIBUTE ? `.${productListingLanguage}` : numericFilters}`;
    } else {
      facetFiltersString = `clickAnalytics=true&filters=(stock > 0)${filterCriteria}&hitsPerPage=0&optionalFilters=null&page=0&facets=${facetFilterName}${facetFilterName === PRICE_ATTRIBUTE ? `.${productListingLanguage}` : numericFilters}`;
    }
    facetFiltersString += '&facetFilters=[';

    Object.entries(facetFilters).forEach(([filterKey, filterValue]) => {
      if (filterKey !== facetFilterName) {
        facetFiltersString += '[';
        filterValue.forEach((value) => {
          facetFiltersString += `"${safeEncodeURIComponent(filterKey)}:${safeEncodeURIComponent(value)}",`;
        });
        facetFiltersString = facetFiltersString.slice(0, -1);
        facetFiltersString += '],';
      }
    });
    facetFiltersString = facetFiltersString.slice(0, -1);
    facetFiltersString += ']';
    return facetFiltersString;
  };

  const dataRequests = Object.keys(activeFacets).map((facetKey) => {
    let facetFilterName = facetKey;
    if (facetKey === `${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`) {
      facetFilterName = `${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`;
    }
    facetFiltersString = buildFacetFiltersString(facetFilterName);
    return {
      indexName: index,
      params: facetFiltersString,
    };
  });

  data.requests.push(...dataRequests);

  return data;
}

/**
 * No products found when there is an error
 */
function noProductsFound() {
  const noProductTitle = isSearchPage() ? `${placeholders.noResultsFor || 'No results for'} "${searchTerm}"` : placeholders.plpNoProductsFound;
  document.querySelector('.section.plp-header').innerHTML = `<h2 class='plp-category-title no-products'>${noProductTitle}</h2>`;
}

/**
 * Hide filters on the main page
 */
function hideMainPageFilters() {
  document.querySelectorAll('.filters-body .page-filters').forEach((filterLi) => {
    filterLi.classList.remove('active-values');
  });
}

/**
 * Hide popup with filters
 */
function hideFilters() {
  const popupOverlay = document.querySelector('.filters-popup-overlay');
  popupOverlay.classList.remove('active');
  popupOverlay.classList.remove('overlay-open');
  document.body.classList.remove('no-scroll');
  document.querySelector('.filters-popup').classList.remove('active');
  if (plpFilterVariation && plpFilterVariation !== 'false') {
    document.querySelector('h2.plp-category-title').classList.remove('hidden');
  }
  // eslint-disable-next-line no-use-before-define
  hideFilterValues();
}

/**
 * Disable clear filters if no filter selected
 */
function disableClearfilters() {
  const clearFilter = document.querySelector('.button-clear-filter');
  if (document.querySelector('.main-page-filters-chosen-values').hasChildNodes()) {
    clearFilter.classList.remove('disable');
  } else {
    clearFilter.classList.add('disable');
  }
}

// close filter dropdowns when clicked outside
window.addEventListener('click', (event) => {
  const { target } = event;
  // Skip checks for group elements.
  if (target.classList.contains('skip-filter') || target.classList.contains('size-toggle')) {
    return;
  }

  if (!target.matches('.main-filter-title-span')) {
    hideMainPageFilters();
  }
});

/**
 * Show popup with filters
 */
function showFilters() {
  const popupOverlay = document.querySelector('.filters-popup-overlay');
  popupOverlay.style.top = 0;
  popupOverlay.style.height = '100%';
  document.body.classList.add('no-scroll');
  popupOverlay.addEventListener('click', hideFilters);
  document.querySelector('.filters-popup').classList.add('active');
  if (plpFilterVariation && plpFilterVariation !== 'false') {
    popupOverlay.classList.add('active');
    document.querySelector('h2.plp-category-title').classList.add('hidden');
  }
  document.querySelector('.filters-popup-overlay').classList.add('overlay-open');
  // if some filters is open on the main page hide them
  hideMainPageFilters();
}

/**
 * When click on specific filter show filter values
 *
 * @param element
 */
function showFilterValues(element) {
  if (!element.querySelector('.filters-values-ul').classList.contains('active-values')) {
    document.querySelector('#filters-popup-title').classList.add('hide');
    document.querySelector('#filters-values-popup-title').classList.remove('hide');
    element.querySelector('.filters-values-ul').classList.add('active-values');
  }
}

/**
 * Hide filter values
 */
function hideFilterValues() {
  document.querySelector('#filters-popup-title').classList.remove('hide');
  document.querySelector('#filters-values-popup-title').classList.add('hide');
  document.querySelectorAll('.filters-values-ul').forEach((filterValuesUl) => {
    filterValuesUl.classList.remove('active-values');
  });
}

/**
 * When open a filter hide all other filters popup
 *
 * @param element
 */
function toggleMainPageFilterValues(element) {
  document.querySelectorAll('.filters-body .page-filters').forEach((filterValuesLi) => {
    if (element === filterValuesLi) {
      filterValuesLi.classList.toggle('active-values');
    } else {
      filterValuesLi.classList.remove('active-values');
    }
  });
}

/**
 * Build loader for PLP
 */
function buildLoader() {
  const fullscreenLoader = document.createElement('div');
  fullscreenLoader.classList.add('fullscreen-loader');
  fullscreenLoader.setAttribute('id', 'fullscreen-loader');
  document.body.appendChild(fullscreenLoader);
}

/**
 * Show loader while fetching data
 */
function showLoader() {
  const loader = document.querySelector('.fullscreen-loader');
  loader.classList.add('active');
  hideMainPageFilters();
}

/**
 * Hide loader when data is fetched
 */
function hideLoader() {
  const loader = document.querySelector('.fullscreen-loader');
  loader.classList.remove('active');
}

function getProductPricesAndDiscount(product) {
  const { catalogData } = product;
  let originalPrice = product.original_price?.[productListingLanguage] ? product.original_price?.[productListingLanguage] : product.original_price;
  let finalPrice = product.final_price?.[productListingLanguage] ? product.final_price?.[productListingLanguage] : product.final_price;
  let memberPrice;
  if (product.aura_price) {
    memberPrice = product.aura_price?.[productListingLanguage] ? parseInt(product.aura_price[productListingLanguage], 10) : parseInt(product.aura_price, 10) || -1;
  } else {
    memberPrice = product.member_price?.[productListingLanguage] ? product.member_price[productListingLanguage] : product.member_price || -1;
  }
  if (catalogData && catalogData?.final_price && catalogData?.original_price) {
    finalPrice = (catalogData.final_price[productListingLanguage] != null) ? catalogData.final_price[productListingLanguage] : catalogData.final_price;
    originalPrice = (catalogData.original_price[productListingLanguage] != null) ? catalogData.original_price[productListingLanguage] : catalogData.original_price;
  }

  const discount = Math.floor(((originalPrice - finalPrice) / originalPrice) * 100);
  return {
    originalPrice, finalPrice, discount, memberPrice,
  };
}

/**
 * Build promotions for the product
 *
 * @param promotions
 * @returns {string}
 */
function buildPromotionsHTML(product, config) {
  let promotions = product.promotions?.[productListingLanguage] ? product.promotions[productListingLanguage] : product.promotions;
  const { catalogData } = product;
  if (catalogData) {
    const promotionsObj = catalogData.promotions?.[productListingLanguage] ? catalogData.promotions[productListingLanguage] : catalogData.promotions;
    promotions = JSON.parse(promotionsObj[0]?.value || promotionsObj.value || '[]');
  } else {
    return '<div class="promotions-container"></div>';
  }
  let promotionsHTML = '<div class="promotions-container">';
  const { discount } = getProductPricesAndDiscount(product);
  if (config && config['plp-show-discount-value'] === 'true'
    && discount > 0
    && placeholders.plpSave !== '0') {
    promotionsHTML += `<p class="item-price-discount-value">(${placeholders.plpSave} ${discount}%)</p>`;
  }
  promotions?.forEach((promo) => {
    if (isPromotionPage()) {
      promotionsHTML += `<p class="item-price-discount-value">${promo.text || promo.label}</p>`;
    } else {
      let promotionUrl = promo[`url_${productListingLanguage}`] || promo.url;
      if (promotionUrl && !promotionUrl.startsWith('/')) {
        promotionUrl = `/${lang}/${promotionUrl}`;
      }
      promotionsHTML += `<a class="item-price-discount-value promotion-link" href="${promotionUrl}">${promo.text || promo.label}</a>`;
    }
  });
  promotionsHTML += '</div>';
  return promotionsHTML;
}

async function addRemoveProductFromCart(product, quantity, operation, callback) {
  if (operation === CART_OPERATIONS.ADD) {
    const response = await cartApi.addToCart(product.sku, {}, quantity, 'product-landing');
    if (response?.success) {
      callback();
    }
  } else if (operation === CART_OPERATIONS.REMOVE) {
    const updatedQuantity = product.qty - quantity;
    let response;
    if (updatedQuantity === 0) {
      response = await removeItemFromCart(product.item_id);
    } else {
      response = await updateItemInCart(product.item_id, product.sku, updatedQuantity);
    }
    if (response?.success) {
      callback();
    }
  }
}

function buildAddToCartButton(product, cart) {
  const productInCart = cart?.cart?.items?.find((item) => item.sku === product.sku);
  const addToCartWrapper = document.createElement('div');
  addToCartWrapper.classList.add('cart-button-wrapper');

  if (!productInCart) {
    const addToCartButton = document.createElement('button');
    addToCartButton.classList.add('add-to-bag-button');
    addToCartButton.innerHTML = placeholders.addToCartLabel || 'Add to Cart';

    addToCartButton.addEventListener('click', async (event) => {
      event.target.classList.add('loading');
      const indexVal = event.target.closest('.product-item').getAttribute('data-index');
      await addRemoveProductFromCart(product, SINGLE_QUANTITY, CART_OPERATIONS.ADD, () => {
        event.target.classList.remove('loading');
        event.target.classList.add('disable-click');
        const updatedCart = store.getCart();
        event.target.innerHTML = `${placeholders.addedToBag || 'Added to Bag'} <span class="right-tick-icon" ></span>`;
        setTimeout(() => {
          event.target.parentElement.replaceWith(buildAddToCartButton(product, updatedCart));
          const recommendationName = product.gtm.gtm_listname;
          datalayerAddToCartEvent(true, product, 1, null, indexVal, insightsQueryId, recommendationName, false, true);
        }, 1000);
      });
    });
    addToCartWrapper.classList.add('filled');
    addToCartWrapper.append(addToCartButton);
  } else {
    //  decrease quantity button
    const decreaseQuantityButton = document.createElement('button');
    decreaseQuantityButton.classList.add('decrease-quantity-button', 'quantity-button');
    decreaseQuantityButton.addEventListener('click', async (event) => {
      event.target.parentElement.classList.add('loading');
      const indexVal = event.target.closest('.product-item').getAttribute('data-index');
      await addRemoveProductFromCart(productInCart, SINGLE_QUANTITY, CART_OPERATIONS.REMOVE, () => {
        event.target.parentElement.classList.remove('loading');
        const updatedCart = store.getCart();
        event.target.parentElement.replaceWith(buildAddToCartButton(product, updatedCart));
        const currentQuantity = updatedCart?.cart?.items?.find((item) => item.sku === product.sku)?.qty || 0;
        const recommendationName = product.gtm.gtm_listname;
        datalayerAddToCartEvent(false, product, currentQuantity, null, indexVal, insightsQueryId, recommendationName, false, true);
      });
    });

    //  increase quantity button
    const increaseQuantityButton = document.createElement('button');
    increaseQuantityButton.classList.add('increase-quantity-button', 'quantity-button');
    increaseQuantityButton.addEventListener('click', async (event) => {
      event.target.parentElement.classList.add('loading');
      const indexVal = event.target.closest('.product-item').getAttribute('data-index');
      await addRemoveProductFromCart(productInCart, SINGLE_QUANTITY, CART_OPERATIONS.ADD, () => {
        event.target.parentElement.classList.remove('loading');
        const updatedCart = store.getCart();
        event.target.parentElement.replaceWith(buildAddToCartButton(product, updatedCart));
        const currentQuantity = updatedCart?.cart?.items?.find((item) => item.sku === product.sku).qty;
        const recommendationName = product.gtm.gtm_listname;
        datalayerAddToCartEvent(true, product, currentQuantity, null, indexVal, insightsQueryId, recommendationName, false, true);
      });
    });

    //  Quantity text
    const quantitySpan = document.createElement('span');
    const quantityInCart = document.createTextNode(`${placeholders.qty || 'QTY'}: ${productInCart.qty}`);
    quantitySpan.append(quantityInCart);
    quantitySpan.classList.add('product-quantity-text');
    addToCartWrapper.classList.add('border');
    addToCartWrapper.append(decreaseQuantityButton, quantitySpan, increaseQuantityButton);
  }
  return addToCartWrapper;
}

// get currency code
let currencyCode;
async function initializeCurrencyCode() {
  currencyCode = await getConfigValue('currency');
}
initializeCurrencyCode();

async function buildPricingHTML(product, config = productListingConfig) {
  let pricingHTML = '';
  const {
    originalPrice, finalPrice, discount, memberPrice,
  } = getProductPricesAndDiscount(product);

  const formattedFinalPrice = await formatPrice(currencyCode, finalPrice);
  const formattedOriginalPrice = await formatPrice(currencyCode, originalPrice);
  const formattedMemberPrice = await formatPrice(currencyCode, memberPrice || 0);

  const isSpecialPriceLower = finalPrice < memberPrice;
  const showFormattedPriceWithDisc = memberPrice && memberPrice > 0 ? ((!(isAuraDetailAvailable || isAuraEnrolledDetailAvailable) && (!isSpecialPriceLower)) || isSpecialPriceLower) : true;

  if (discount <= 0) {
    pricingHTML = `<div class="product-item-price">
                      <p class="item-price">${formattedFinalPrice}</p>
                  </div>`;
  } else {
    if (showFormattedPriceWithDisc) {
      pricingHTML += `<p class="item-price-discounted">${formattedFinalPrice}</p>`;
    }
    pricingHTML += `<p class="item-price-original-slashed">${formattedOriginalPrice}</p>`;
    const pricingDiscountDiv = '<div class="product-item-discount-price">#pricing#</div>';
    pricingHTML = pricingDiscountDiv.replace('#pricing#', pricingHTML);
    if (config['plp-show-discount-value'] === 'true') {
      if (showFormattedPriceWithDisc) {
        pricingHTML += `<p class="item-price-discount-value">${(placeholders.plpSave && placeholders.plpSave !== '0') ? `(${placeholders.plpSave} ${discount}%)` : `-${discount}%`}</p>`;
      }
    }
  }

  if (typeof memberPrice === 'number' && memberPrice > 0) {
    if (isAuraActive) {
      if (!isSpecialPriceLower) {
        const auraPriceContainer = document.createElement('div');
        auraPriceContainer.classList.add('plp-aura-price');
        const auraPriceIcon = document.createElement('span');
        auraPriceIcon.classList.add('icon', 'icon-aura-logo');
        const auraPriceElement = document.createElement('div');
        auraPriceElement.classList.add('plp-aura-price-container');
        const auraPriceText = document.createElement('span');
        auraPriceText.classList.add('plp-aura-price--text');
        auraPriceText.textContent = formattedMemberPrice;
        const auraPriceLabel = document.createElement('span');
        auraPriceLabel.classList.add('plp-aura-price--label');
        auraPriceLabel.textContent = placeholders?.auraPriceLabel || 'Aura Price';
        auraPriceElement.appendChild(auraPriceIcon);
        auraPriceElement.appendChild(auraPriceText);
        auraPriceElement.appendChild(auraPriceLabel);
        auraPriceContainer.appendChild(auraPriceElement);
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = pricingHTML;
        if (isAuraDetailAvailable || isAuraEnrolledDetailAvailable) {
          tempContainer.firstChild.classList.add('strikethrough');
          tempContainer.insertBefore(auraPriceContainer, tempContainer.firstChild);
          auraPriceElement.classList.add('logged-in');
        } else {
          tempContainer.appendChild(auraPriceContainer);
        }
        pricingHTML = tempContainer.innerHTML;
      }
    } else {
      // Decorate member price
      const memberPriceContainer = document.createElement('div');
      memberPriceContainer.classList.add('plp-member-price');

      const memberPriceElement = document.createElement('div');
      memberPriceElement.classList.add('plp-member-price-container');

      const memberPriceText = document.createElement('span');
      memberPriceText.classList.add('plp-member-price--text');
      memberPriceText.textContent = formattedMemberPrice;

      const memberPriceLabel = document.createElement('span');
      memberPriceLabel.classList.add('plp-member-price--label');
      memberPriceLabel.textContent = placeholders.memberPriceLabel || 'Member Price';

      if (lang === 'ar') {
        memberPriceElement.appendChild(memberPriceLabel);
        memberPriceElement.appendChild(memberPriceText);
      } else {
        memberPriceElement.appendChild(memberPriceText);
        memberPriceElement.appendChild(memberPriceLabel);
      }

      memberPriceContainer.appendChild(memberPriceElement);

      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = pricingHTML;

      // Member price position is different for logged-in users and guests
      if (isLoggedInUser()) {
        tempContainer.firstChild.classList.add('strikethrough');
        memberPriceElement.classList.add('logged-in');
      }
      tempContainer.appendChild(memberPriceContainer);
      pricingHTML = tempContainer.innerHTML;
    }
  }
  return pricingHTML;
}

function buildProductImagesHTML(product, config = productListingConfig, isWishlist = false) {
  let imgs = '';
  let btns = '';
  const productTitle = product.title[productListingLanguage] ? product.title[productListingLanguage] : product.title;
  const productUrl = product.url[productListingLanguage] ? product.url[productListingLanguage] : product.url;
  const pdpProductUrl = `${productUrl}`.replace('.html', '') || '#';
  const maxImages = !isWishlist ? config['plp-max-carousel-images'] : 1;

  const media = product.media_pdp || product.media;

  media.forEach((img, index) => {
    if (index < maxImages) {
      imgs += `<img width="450" height="675" src="${img.url}" title="${productTitle}" alt="${productTitle}" />`;
      if (config) {
        btns += `<button aria-label="View image ${index + 1}" value="${index + 1}" class="product-image-btn${index === 0 ? ' selected' : ''}"></button>`;
      }
    }
  });
  return `
  <a data-link='pdp' href="${pdpProductUrl}">
    <div class="item-images" data-image-position="1">${imgs}</div>
  </a>
  ${media?.length > 1 ? `<div class="product-carousel-buttons">${btns}</div>` : ''}
`;
}

function buildOutOfStockHTML(product, isWishlist = false) {
  let outOfStockHTML = '';
  if (isWishlist && product.in_stock !== 1) {
    outOfStockHTML = `<div class="overlay-out-of-stock-container">
                        <div class="overlay-out-of-stock-background"></div>
                        <div class="overlay-out-of-stock-line"></div>
                        <div class="overlay-out-of-stock-text">${placeholders.outOfStockLabel}</div>
                      </div>`;
  }
  return outOfStockHTML;
}

function getDetailsByType(data, type) {
  const result = data.find((item) => item.type === type);
  return result ? { position: result.position, text: result.text } : null;
}

function buildProductLabelHTML(product) {
  const productLabels = product.product_labels?.[productListingLanguage] ? product.product_labels[productListingLanguage] : product.product_labels;
  let prevPreData = product.attr_preview_preaccess_data?.[productListingLanguage];

  if (prevPreData && Array.isArray(prevPreData) && prevPreData.length > 0) {
    [prevPreData] = prevPreData;
  }

  let prevPreInfo;
  if (!prevPreData) {
    prevPreInfo = getPreviewPreaccessType(product.attr_preview_preaccess_data, productListingLanguage);
  } else {
    prevPreInfo = getPreviewPreaccessType(prevPreData, productListingLanguage);
  }
  if (prevPreInfo?.type) {
    const pLabel = getDetailsByType(productLabels, prevPreInfo.type);
    if (pLabel) {
      return `<div class="product-label-wrapper">
        <div class="product-label label-preview ${pLabel.position} ${prevPreInfo.type}">
          ${pLabel.text}
        </div>
      </div>`;
    }
  } else if (productLabels && productLabels.length > 0) {
    const productLabel = productLabels[0];

    if (productLabel.image) {
      return `
        <div class="product-label-wrapper">
          <p class="product-label ${productLabel.position}">
            <img width="40" height="40" src="${productLabel.image}" alt="${productLabel.text}" loading="lazy" />
          </p>
        </div>`;
    }

    return `<div class="product-label-wrapper">
        <div class="product-label label-preview ${productLabel.position}">
          ${productLabel.text}
        </div>
      </div>`;
  }
  return '';
}

function buildSwatchHTML(product, config) {
  if (config['plp-show-swatches'] !== 'true') {
    return '';
  }

  const swatchesList = product.article_swatches[productListingLanguage] ? product.article_swatches[productListingLanguage] : product.article_swatches;
  const swatches = swatchesList?.filter((swatch) => swatch.rgb_color) || [];
  const style = config['plp-swatch-style'];
  const maxSwatchCount = parseInt(config['plp-max-swatch-count'], 10);
  let swatchHTML = '';
  let swatchDiv = '<div class="swatch-selection">#swatches#</div>';
  swatches.forEach((swatch, i) => {
    if (style === 'circle' && i === maxSwatchCount) {
      swatchHTML += `<div class="swatch" data-sku="${product.sku}">
                      <p class="swatch-overflow-count">+${swatches.length - maxSwatchCount}</p>
                    </div>`;
    } else if (i < maxSwatchCount) {
      // condition if the color starts with #f for white circles
      const hasGreyBorder = swatch.rgb_color.startsWith('#F');
      swatchHTML += `<div class="swatch${(hasGreyBorder ? ' border' : '')}${(i === 0) && (style === 'square') ? ' selected' : ''}" data-sku="${swatch.article_sku_code}">
                      <div style="background-color: ${swatch.rgb_color}"></div>
                    </div>`;
    }
  });
  if (swatches.length > 4 && style === 'square') {
    const dir = document.getElementsByTagName('html')[0].getAttribute('dir');
    swatchDiv = `<button data-icon-name="swatch-arrow-left" class="swatch-carousel-left carousel-nav-button ${dir === 'rtl' ? '' : 'hidden'}">
      <span class="icon icon-swatch-arrow-left"><img src="/icons/swatch-arrow-left.svg" alt="" loading="lazy"></span>
    </button> ${swatchDiv}`;
    swatchDiv += `<button data-icon-name="swatch-arrow-right" class="swatch-carousel-right carousel-nav-button ${dir === 'rtl' ? 'hidden' : ''}">
                    <span class="icon icon-swatch-arrow-right"><img src="/icons/swatch-arrow-right.svg" alt="" loading="lazy"></span>
                  </button>`;
  }
  swatchHTML = swatchDiv.replace('#swatches#', swatchHTML);
  return swatchHTML;
}

function buildRatingHTML(product, config) {
  if (config['plp-show-review-ratings'] !== 'true') {
    return '';
  }

  const productUrl = product.url[productListingLanguage] ? product.url[productListingLanguage] : product.url;
  const pdpProductUrl = `${productUrl}`.replace('.html', '');
  let numStars = 0;
  let productBvRating;
  if (product.attr_bv_average_overall_rating) {
    productBvRating = (product.attr_bv_average_overall_rating[productListingLanguage] != null) ? product.attr_bv_average_overall_rating[productListingLanguage] : product.attr_bv_average_overall_rating;
    numStars = Math.round(productBvRating);
  } else {
    return '';
  }
  const reviewCount = product.attr_bv_total_review_count || 0;
  let ratingDiv = '<div class="review-rating-stars">#stars#</div>';
  let starsHtml = '<div class="star-container">';
  const ratingTextDiv = `<div class="rating-text"><span>${productBvRating}</span></div>`;

  for (let i = 0; i < 5; i += 1) {
    starsHtml = `${starsHtml} <span class="star-${i < numStars ? 'filled' : 'empty'}"></span>`;
  }

  starsHtml = `${starsHtml}</div>`;
  starsHtml = `${ratingTextDiv}${starsHtml} <a href="${pdpProductUrl}"><span class="rating-value-rating_${numStars} rating-count">(${reviewCount})</span></a>`;
  ratingDiv = ratingDiv.replace('#stars#', starsHtml);
  return ratingDiv;
}

function handleSwatchCarousel(e, productTitle, sku) {
  let { target } = e;
  if (target.tagName !== 'BUTTON') {
    target = e.target.closest('button');
  }

  const swatchContainer = target.closest('.color-swatch-container').querySelector('.swatch-selection');
  const scrollDistance = swatchContainer.scrollWidth - swatchContainer.offsetWidth;
  const dir = document.getElementsByTagName('html')[0].getAttribute('dir');
  const dirMultiplier = document.getElementsByTagName('html')[0].getAttribute('dir') === 'rtl' ? -1 : 1;
  const swatchWidth = target.offsetWidth;
  let chevronClick = `${dir === 'rtl' ? 'left' : 'right'}`;
  if (target.dataset.iconName.includes('right')) {
    swatchContainer.scrollLeft += 2 * swatchWidth; // 2 * width of the swatch divs
  } else {
    swatchContainer.scrollLeft -= 2 * swatchWidth;
  }

  if ((swatchContainer.scrollLeft * dirMultiplier) > 0 && swatchContainer.parentNode.querySelector('button.hidden')) {
    swatchContainer.parentNode.querySelector('button.hidden').classList.remove('hidden');
  }
  if (swatchContainer.scrollLeft === 0 || swatchContainer.scrollLeft === -1) {
    swatchContainer.parentNode.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'right' : 'left'}`).classList.add('hidden');
    if (swatchContainer.parentNode.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'left' : 'right'}`).classList.contains('hidden')) {
      swatchContainer.parentNode.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'left' : 'right'}`).classList.remove('hidden');
    }
    chevronClick = `${dir === 'rtl' ? 'right' : 'left'}`;
  }
  if ((swatchContainer.scrollLeft * dirMultiplier) + 1 >= scrollDistance) {
    swatchContainer.parentNode.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'left' : 'right'}`).classList.add('hidden');
    if (swatchContainer.parentNode.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'right' : 'left'}`).classList.contains('hidden')) {
      swatchContainer.parentNode.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'right' : 'left'}`).classList.remove('hidden');
    }
    chevronClick = `${dir === 'rtl' ? 'left' : 'right'}`;
  }
  datalayerColorSwatchChevron(chevronClick, productTitle, sku);
}

// check if we still need swatch carousel after a resize
function checkSwatchCarouselButtons() {
  const allSwatchContainers = document.body.querySelectorAll('.color-swatch-container:has(.swatch)');
  const dir = document.getElementsByTagName('html')[0].getAttribute('dir');
  allSwatchContainers.forEach((div) => {
    const swatchSelection = div.querySelector('.swatch-selection');
    // scroll bar no longer exists, remove carousel buttons
    if (!(swatchSelection.scrollWidth > swatchSelection.clientWidth)) {
      div.querySelectorAll('button').forEach((btn) => {
        if (!btn.classList.contains('hidden')) {
          btn.classList.add('hidden');
        }
      });
    } else if (div.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'left' : 'right'}`)) {
      div.querySelector(`button.swatch-carousel-${dir === 'rtl' ? 'left' : 'right'}`).classList.remove('hidden');
    }
  });
}

/**
 * Adds cloned images to the front and back to help with infinite scroll
 * @param {HTMLElement} itemImages - The element containing the item images.
 */
function addImageClones(itemImages) {
  const allImages = itemImages.querySelectorAll('img');
  const firstImage = allImages[0].cloneNode(true);
  const lastImage = allImages[allImages.length - 1].cloneNode(true);

  firstImage.classList.add('clone');
  lastImage.classList.add('clone');
  itemImages.appendChild(firstImage);
  itemImages.prepend(lastImage);

  firstImage.addEventListener('load', () => {
    ((img) => {
      setTimeout(() => {
        const imageWidth = img.getBoundingClientRect().width;
        const wrapperWidth = img.closest('.product-item').getBoundingClientRect().width;
        const containerWidth = wrapperWidth || imageWidth;
        itemImages.style.transition = 'none';
        itemImages.style.transform = `translateX(${(document.dir === 'rtl' ? 1 : -1) * containerWidth}px)`;
        // eslint-disable-next-line
        itemImages.offsetHeight;
        itemImages.style.transition = '';
      }, 70);
    })(firstImage);
  }, { once: true });
}

function updateSelectedImageButton(allButtons, selectedButton) {
  allButtons.forEach((btn) => {
    btn.classList.remove('selected');
  });
  selectedButton.classList.add('selected');
}

function handleScrollOverflow(itemImages, imagePosition, maxPosition, direction, imageWidth) {
  let position = imagePosition;
  if (imagePosition > maxPosition) {
    position = 1;
  } else if (imagePosition < 1) {
    position = maxPosition;
  } else {
    return position;
  }

  const translationValue = direction * position * imageWidth;
  itemImages.addEventListener('transitionend', () => {
    itemImages.style.transition = 'none';
    itemImages.style.transform = `translateX(${translationValue}px)`;
    // eslint-disable-next-line
    itemImages.offsetHeight;
    itemImages.style.transition = '';
    itemImages.dataset.imagePosition = position;
  }, { once: true });
  return position;
}
function handleImageSwipe(e) {
  const imageCount = e.detail.target.querySelectorAll('.item-images img').length;
  if (imageCount <= 1) {
    return;
  }

  const itemImages = e.detail.target.querySelector('.item-images');
  const imageWidth = itemImages.querySelector('img').getBoundingClientRect().width;
  const direction = document.dir === 'rtl' ? 1 : -1;
  const maxPosition = parseInt(e.detail.target.querySelector('.product-image-btn:last-child').value, 10);
  let imagePosition = parseInt(itemImages.dataset.imagePosition, 10);
  if (e.type === SWIPE_PREV) {
    imagePosition -= 1;
  } else if (e.type === SWIPE_NEXT) {
    imagePosition += 1;
  }
  if (!e.detail.auto) {
    if (direction === 1) {
      datalayerImageSwipeEvent(e.type === SWIPE_NEXT ? 'right' : 'left', datalayerPageType);
    } else {
      datalayerImageSwipeEvent(e.type === SWIPE_NEXT ? 'left' : 'right', datalayerPageType);
    }
  }
  const translationValue = direction * imagePosition * imageWidth;
  itemImages.style.transform = `translateX(${translationValue}px)`;
  // eslint-disable-next-line
  imagePosition = handleScrollOverflow(itemImages, imagePosition, maxPosition, direction, imageWidth);

  const allButtons = e.detail.target.querySelectorAll('button');
  const selectedButton = e.detail.target.querySelector(`button[value="${imagePosition}"]`);
  updateSelectedImageButton(allButtons, selectedButton);
  itemImages.dataset.imagePosition = imagePosition;
}

function fragranceDescription(product) {
  const descriptionDiv = document.createElement('div');
  descriptionDiv.classList.add('description-container');
  const fragranceAttribute = product.attributes?.find((attr) => attr.name === 'fragrance_description');
  descriptionDiv.innerHTML = fragranceAttribute?.value;
  return descriptionDiv;
}

function buildSizeForProduct(product) {
  const sizeAttribute = product.attributes?.find((attr) => attr.name === 'size');
  const sizeDiv = document.createElement('div');
  sizeDiv.classList.add('size-container');

  sizeDiv.innerHTML = `<span>Size/Volume:</span> <span class="size-value">${sizeAttribute?.value}</span>`;
  return sizeDiv;
}

async function updateProductPopupEvent(productSku, placeHolders) {
  const container = document.querySelector('.quick-view-modal .modal-content');
  container.classList.add('quick-view-model-content');
  updateProductPopup(productSku, placeHolders, container, 'quick-view-model-content', 'quick-view');
}

function toggleQuickViewFooter() {
  const footer = document.querySelector('.quick-view-modal-content .footer-actions');
  footer.classList.toggle('active');
}

function buildFooterActionDiv(product, productItemDiv) {
  const footerActionDiv = document.createElement('div');
  footerActionDiv.classList.add('footer-actions');
  const addToBagButton = document.createElement('button');
  addToBagButton.classList.add('quick-view-add-to-bag');
  addToBagButton.innerHTML = placeholders.addToCartLabel || 'Add to Cart';
  addToBagButton.addEventListener('click', async (event) => {
    const quantitySelected = document.querySelector('.quick-view-modal-content .footer-actions .quantity-value').innerHTML;
    event.target.classList.add('loading');
    event.target.classList.add('in-wishlist');
    await addRemoveProductFromCart(product, Number(quantitySelected), CART_OPERATIONS.ADD, async () => {
      event.target.classList.remove('loading');
      event.target.classList.add('disable-click');
      const cart = store.getCart();
      productItemDiv.querySelector('.cart-button-wrapper').replaceWith(buildAddToCartButton(product, cart));
      datalayerAddToCartEvent(
        true,
        product,
        quantitySelected,
        null,
        productItemDiv.getAttribute('data-index'),
        productItemDiv.getAttribute('data-insights-query-id'),
        '',
        true,
        true,
      );
      await closeModal('quick-view-modal');
    });
  });

  const quantityButton = document.createElement('button');
  quantityButton.classList.add('secondary', 'quantity-button');
  const quantityButtonContent = document.createElement('span');
  quantityButtonContent.classList.add('button-content');
  const quantityButtonIcon = document.createElement('span');
  quantityButtonIcon.classList.add('select-icon', 'icon');

  const quantityText = `<span class="quantity-text">${placeholders.quantity || 'Quantity'}</span>`;
  const quantityValue = '<span class="quantity-value">1</span>';

  quantityButtonContent.innerHTML = `${quantityText}${quantityValue}`;

  const sizeOptions = document.createElement('ul');
  sizeOptions.classList.add('size-options');

  const stockQuantity = product.stock_data.qty;
  const quantity = Math.min(10, stockQuantity);

  for (let i = 1; i <= quantity; i += 1) {
    const option = document.createElement('li');
    option.innerHTML = i;
    option.addEventListener('click', () => {
      const value = i;
      quantityButton.querySelector('.quantity-value').innerHTML = value;
      toggleQuickViewFooter();
    });
    sizeOptions.append(option);
  }

  quantityButton.append(quantityButtonContent, quantityButtonIcon);

  quantityButton.addEventListener('click', () => {
    toggleQuickViewFooter();
  });

  footerActionDiv.append(quantityButton, addToBagButton, sizeOptions);

  return footerActionDiv;
}

export async function buildQuickViewModal(product, productItemDiv) {
  if (useCoreQuickview === 'true') {
    window.product = await loadProduct(product.sku);
    const [, productDetails] = await window.product;
    // Render product overview.
    const productOverviewElement = await renderProduct(placeholders, 'quick-view', productDetails.sku);
    // Create the modal with the rendered content.
    await createModalFromContent(
      'quick-view-modal',
      placeholders.quickViewOverlayHeader,
      productOverviewElement,
      ['quick-view-modal'],
      '',
      true,
    );
    return;
  }
  const quickViewDiv = document.createElement('div');
  quickViewDiv.classList.add('quick-view-modal-content', 'algolia-product-listing');
  const productTitle = product.title[productListingLanguage] ? product.title[productListingLanguage] : product.title;

  // images container
  const imagesDiv = document.createElement('div');
  imagesDiv.classList.add('images-container');

  if (product.media?.length > 1) {
    imagesDiv.classList.add('grid-container');
  }

  product.media?.forEach((image) => {
    const imageElement = `<img src="${image.url}" alt="${productTitle}" />`;
    imagesDiv.innerHTML += imageElement;
  });

  // content container
  const contentDiv = document.createElement('div');
  contentDiv.classList.add('content-container', 'product-item');

  // product-info
  const productInfoDiv = productItemDiv.querySelector('.product-item-info').cloneNode(true);
  contentDiv.append(productInfoDiv);

  // size
  productInfoDiv.append(buildSizeForProduct(product));

  // product-description
  contentDiv.append(fragranceDescription(product));

  // view-product-details button
  const viewDetailsButton = document.createElement('button');
  viewDetailsButton.classList.add('quick-view-button', 'secondary');
  viewDetailsButton.innerText = placeholders.viewProductDetails || 'VIEW PRODUCT DETAILS';
  const productUrl = product.url[productListingLanguage] ? product.url[productListingLanguage] : product.url;
  viewDetailsButton.addEventListener('click', () => {
    window.location.href = productUrl.replace('.html', '');
  });
  const actionDiv = document.createElement('div');
  actionDiv.classList.add('quick-view-actions');
  actionDiv.append(viewDetailsButton);
  contentDiv.append(actionDiv);

  // footer actions
  contentDiv.append(buildFooterActionDiv(product, productItemDiv));

  quickViewDiv.append(imagesDiv, contentDiv);

  await createModalFromContent('quick-view-modal', placeholders.quickViewOverlayHeader, quickViewDiv, ['quick-view-modal'], '', true);
}

function buildQuickViewButton(product, productItemDiv) {
  if (productListingConfig['producttile-enable-quickview'] !== 'true') {
    return [];
  }
  const isMobile = window.innerWidth < 768;
  let result;
  if (isMobile
    && hasValue(displayMobileQuickviewModal)
    && displayMobileQuickviewModal !== 'true') {
    result = [];
  } else {
    // quick-view-button
    const quickViewButton = document.createElement('button');
    quickViewButton.classList.add('quick-view-button', 'secondary');
    quickViewButton.innerText = placeholders.quickView || 'Quick View';

    quickViewButton.addEventListener('click', async (event) => {
      const productResult = await getProductData(product.sku);
      const { items: stockResponse } = await getProductStockStatus(product.sku);
      await buildQuickViewModal({ ...productResult, ...product, ...stockResponse[0] }, productItemDiv);
      await openModal('quick-view-modal');
      const indexVal = event.target.closest('.product-item').getAttribute('data-index');
      datalayerViewItemEvent({ ...product, attributes: productResult?.attributes }, indexVal, insightsQueryId, true);
    });

    if (product?.media?.length > 1) {
      // prev and next buttons
      const prevButton = document.createElement('button');
      prevButton.classList.add('quick-view-prev', 'secondary');
      const nextButton = document.createElement('button');
      nextButton.classList.add('quick-view-next', 'secondary');

      nextButton.addEventListener('click', (e) => {
        handleImageSwipe(new CustomEvent(SWIPE_NEXT, { detail: { target: e.target.parentElement } }));
      });
      prevButton.addEventListener('click', (e) => {
        handleImageSwipe(new CustomEvent(SWIPE_PREV, { detail: { target: e.target.parentElement } }));
      });
      productItemDiv.querySelector('.product-carousel-buttons')?.classList.add('hide');
      result = [prevButton, nextButton, quickViewButton];
    } else {
      result = [quickViewButton];
    }
  }
  return result;
}

function handleImageCarouselButton(e) {
  const itemImages = e.target.closest('.product-image-container').querySelector('.item-images');
  const imagePosition = parseInt(e.target.value, 10);
  const imageWidth = itemImages.querySelector('img').getBoundingClientRect().width;
  const direction = document.dir === 'rtl' ? 1 : -1;
  const allButtons = e.target.closest('.product-carousel-buttons').querySelectorAll('button');
  if (!e.detail.auto) {
    if (direction === 1) {
      datalayerImageSwipeEvent([...allButtons].findIndex((btn) => btn.classList.contains('selected')) + 1 > imagePosition ? 'left' : 'right', datalayerPageType);
    } else {
      datalayerImageSwipeEvent([...allButtons].findIndex((btn) => btn.classList.contains('selected')) + 1 > imagePosition ? 'right' : 'left', datalayerPageType);
    }
  }
  updateSelectedImageButton(allButtons, e.target);

  itemImages.style.transform = `translateX(${direction * imagePosition * imageWidth}px)`;
  itemImages.dataset.imagePosition = imagePosition;
}

/**
 * Handles the image hover event.
 * Hover animation behaves like a swipe so the same function is used.
 * @param {Event} e - The event object.
 */
function handleImageHover(e) {
  if (e.type === 'mouseout') {
    clearInterval(intervalId);
  } else {
    intervalId = setInterval(() => {
      handleImageSwipe(new CustomEvent(SWIPE_NEXT, { detail: { target: e.target.closest('.product-image-container'), auto: true } }));
    }, 2000);
  }
}

function imageTouchStart(e) {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
}

function imageTouchMove(e) {
  touchEndX = e.changedTouches[0].clientX;
  touchEndY = e.changedTouches[0].clientY;
  const diffX = touchEndX - touchStartX;
  if (Math.abs(diffX) > 10) {
    e.preventDefault();
  }
}

function imageTouchEnd() {
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  if (Math.abs(diffX) < Math.abs(diffY) || Math.abs(diffX) < 30) {
    return;
  }
  const direction = document.dir === 'rtl' ? 1 : -1;
  const swipe = diffX * direction > 0 ? SWIPE_NEXT : SWIPE_PREV;
  console.log(swipe);
  handleImageSwipe(new CustomEvent(swipe, { detail: { target: this } }));
}

function addImageListeners(imageContainer) {
  imageContainer.addEventListener('mouseover', handleImageHover);
  imageContainer.addEventListener('mouseout', handleImageHover);
  imageContainer.addEventListener('touchstart', imageTouchStart, false);
  imageContainer.addEventListener('touchmove', imageTouchMove, false);
  imageContainer.addEventListener('touchend', imageTouchEnd, false);
}

async function handleSwatchSelector(e, config, isWishlist) {
  const { target } = e;
  const swatchElement = target.closest('.swatch');
  const response = await getProductSuggestions(swatchElement.dataset.sku, config['plp-hits-per-page']);
  const product = response[0];
  const productUrl = product.url[productListingLanguage] ? product.url[productListingLanguage] : product.url;
  const pdpProductUrl = productUrl?.replace('.html', '');
  const redirectToPDP = config['plp-swatch-link-pdp'] === 'true';
  if (redirectToPDP) {
    window.location = pdpProductUrl;
  } else {
    const productItemDiv = e.target.closest('.product-item');
    const newProductData = product;
    datalayerColorSwatchEvent(datalayerPageType, newProductData.attr_color?.en?.[0]);
    // update image(s)
    const productImgs = productItemDiv.querySelector('div.product-image-container');
    productImgs.innerHTML = buildProductImagesHTML(product, config, isWishlist);

    // update product info
    const productInfo = productItemDiv.querySelector('div.product-item-info');
    const productTitle = newProductData.title[productListingLanguage] ? newProductData.title[productListingLanguage] : newProductData.title;
    productInfo.querySelector('.product-item-price').innerHTML = await buildPricingHTML(newProductData);
    productInfo.querySelector('.product-item-title').innerText = productTitle;
    productInfo.querySelector('.product-item-title')
      .closest('a').href = pdpProductUrl;

    // update promotions
    const productPromos = productItemDiv.querySelector('div.promotions-container');
    productPromos.innerHTML = buildPromotionsHTML(newProductData);

    productItemDiv.querySelectorAll('.product-carousel-buttons button').forEach((btn) => {
      btn.addEventListener('click', handleImageCarouselButton);
    });

    // add image clones for carousel
    const imageContainer = productItemDiv.querySelector('.product-image-container');
    if (imageContainer.querySelectorAll('.item-images img').length > 1) {
      addImageClones(imageContainer.querySelector('.item-images'));
    }

    // re-add listeners for image selection
    addImageListeners(productImgs);
  }

  const swatchSelection = e.target.closest('.swatch-selection')
    .querySelectorAll('div.swatch');
  swatchSelection.forEach((div) => {
    div.classList.remove('selected');
  });
  e.target.closest('.swatch')
    .classList
    .add('selected');
}

/**
 * During resize check images and apply the necessary transformations to maintain alignment.
 */
function checkImageCarousel() {
  const allImageContainers = document.body.querySelectorAll('.product-image-container .item-images');
  allImageContainers.forEach((container) => {
    const imageCount = container.querySelectorAll('img').length;
    if (imageCount > 1) {
      container.style.transition = 'none';
      const translationValue = container.dataset.imagePosition * container.offsetWidth * (document.dir === 'rtl' ? 1 : -1);
      container.style.transform = `translateX(${translationValue}px)`;
      // eslint-disable-next-line
      container.offsetHeight;
      container.style.transition = '';
    }
  });
}

function handleGridSelection(e) {
  const productsContainer = document.body.querySelector('div.products-container');
  productsContainer.classList.forEach((cls) => {
    if (cls.includes('columns-')) {
      productsContainer.classList.remove(cls);
    }
  });
  productsContainer.classList.add(e.target.dataset.iconName);

  const layoutSelected = document.body.querySelector('.grid-layout-selectors .selected:has(img)');
  layoutSelected.classList.remove('selected');
  layoutSelected.querySelector('img').src = layoutSelected.querySelector('img').src.replace('primary', 'secondary');
  e.target.src = e.target.src.replace('secondary', 'primary');
  e.target.closest('div').classList.add('selected');
  checkImageCarousel();
  dataLayerGridSelectionEvent(layoutSelected.classList.contains('four-column-grid'), datalayerPageType);
}

/**
 * Update the page loader progress bar
 *
 * @param response
 */
export function updatePageLoader(response, placeholdersList, eventload = '', replaceProducts = false) {
  const currentProductCount = (response.results[0].page + 1) * response.results[0].hitsPerPage;
  const totalProductCount = response.results[0].nbHits;
  const loadMoreContainer = document.querySelector('.products-pager-container');

  const percentViewed = (currentProductCount / totalProductCount) * 100;
  const progressCount = loadMoreContainer.querySelector('#progress-count');
  progressCount.innerText = `${placeholdersList.plpShowing} ${totalProductCount <= currentProductCount ? totalProductCount : currentProductCount} ${placeholdersList.plpOf} ${totalProductCount} ${placeholdersList.plpItems}`;
  const progressBar = loadMoreContainer.querySelector('.progress-bar');
  progressBar.style = `width: ${percentViewed}%;`;

  if (totalProductCount <= 0) {
    loadMoreContainer.classList.add('hidden');
  }
  if (totalProductCount <= currentProductCount) {
    loadMoreContainer.querySelector('.pager-button-container').classList.add('hidden');
  } else {
    loadMoreContainer.querySelector('.pager-button-container').classList.remove('hidden');
  }

  const countOfFoundItemsOnMain = document.querySelector('#count-of-found-items-on-main');
  const countOfFoundItemsContainer = document.querySelector('#count-of-found-items');
  if (countOfFoundItemsOnMain && countOfFoundItemsContainer) {
    countOfFoundItemsOnMain.innerHTML = `${response.results[0].nbHits} ${placeholdersList.plpItems}`;
    countOfFoundItemsContainer.innerHTML = `${response.results[0].nbHits} ${placeholdersList.plpItems}`;
  }

  if (eventload === 'loadMore' && !replaceProducts) {
    dataLayerLoadMoreSelectionEvent(currentProductCount, totalProductCount, datalayerPageType);
  }
}

/**
 * Add currency to price
 *
 * @param rangeValues
 * @returns {string}
 */
function buildPriceRangeValuesWithCurrency(rangeValues) {
  const priceValueFrom = parseFloat(rangeValues.split(' - ')[0]).toFixed(2);
  const priceValueTo = parseFloat(rangeValues.split(' - ')[1]).toFixed(2);
  if (!parseInt(priceValueFrom, 10)) {
    const underPlaceHolder = placeholders.plpUnder || 'Under';
    return `${underPlaceHolder} ${placeholders.plpDefaultCurrency} ${priceValueTo}`;
  }
  return `${placeholders.plpDefaultCurrency} ${priceValueFrom} - ${placeholders.plpDefaultCurrency} ${priceValueTo}`;
}

export function buildLoadMoreContainer(buttonText) {
  const loadMoreContainer = document.createElement('div');
  loadMoreContainer.classList.add('products-pager-container');
  loadMoreContainer.innerHTML = `
          <div class="pager-progress">
            <p id="progress-count"></p>
            <div class="progress-bar-container">
              <div class="progress-bar"></div>
            </div>
          </div>
          <div class="pager-button-container">
            <button type="button" class="pager-button" rel="next">${buttonText}</button>
          </div>
      `;
  return loadMoreContainer;
}

/**
 * Build rating values text
 *
 * @param ratingAttrValue
 * @returns {string}
 */
function buildRatingValues(ratingAttrValue) {
  const countOfStart = ratingAttrValue.split(' - ').map((part) => part.split('_')[1].trim());
  return countOfStart.map((count) => `${count} ${count === '1' ? placeholders.plpStar : placeholders.plpStars}`).join(', ');
}

function updatePrice(isMin) {
  const priceType = isMin ? 'min' : 'max';
  const priceInputElement = document.querySelector(`.filters-popup .${priceType}-pricelabel-container input`);
  const priceInputMainPageElement = document.querySelector(`.filters-body .${priceType}-pricelabel-container input`);
  const sliderElementPopup = document.querySelector(`.filters-popup .min-max-slider-container .slider-${priceType}`);
  const sliderElementMainPage = document.querySelector(`.filters-body .min-max-slider-container .slider-${priceType}`);
  const otherSliderElementPopup = document.querySelector(`.filters-popup .min-max-slider-container .slider-${isMin ? 'max' : 'min'}`);
  const progressBarPopup = document.querySelector('.filters-popup .range-progress');
  const progressBarMainPage = document.querySelector('.filters-body .range-progress');

  const initialValues = [
    parseFloat(priceInputElement?.value),
    parseFloat(priceInputMainPageElement?.value),
    parseFloat(sliderElementPopup?.value),
    parseFloat(sliderElementMainPage?.value),
  ];
  const initialValue = isMin ? Math.max(...initialValues) : Math.min(...initialValues);

  function syncElements(sourceValue, isPopup) {
    [priceInputElement, priceInputMainPageElement, sliderElementPopup, sliderElementMainPage].forEach((element) => {
      if (element) element.value = sourceValue;
    });

    const minPrice = parseFloat(sliderElementPopup?.value);
    const maxPrice = parseFloat(otherSliderElementPopup?.value);
    const minRange = parseFloat(sliderElementPopup?.min);
    const maxRange = parseFloat(sliderElementPopup?.max);

    const minPosition = (minPrice - minRange) / (maxRange - minRange);
    const maxPosition = (maxPrice - minRange) / (maxRange - minRange);

    const progressBar = isPopup ? progressBarPopup : progressBarMainPage;

    if (isRTL) {
      progressBar.style.transform = `translateX(${(1 - maxPosition) * 100}%) scaleX(${maxPosition - minPosition})`;
      progressBar.style.transformOrigin = 'left';
    } else {
      progressBar.style.transform = `translateX(${minPosition * 100}%) scaleX(${maxPosition - minPosition})`;
      progressBar.style.transformOrigin = 'left';
    }
  }

  syncElements(initialValue, true);
  syncElements(initialValue, false);

  [priceInputElement, priceInputMainPageElement, sliderElementPopup, sliderElementMainPage].forEach((element) => {
    if (element) {
      element.addEventListener('input', (event) => {
        const newValue = parseFloat(event.target.value);
        syncElements(newValue, event.target.closest('.filters-popup') !== null);
      });
    }
  });

  return initialValue;
}

function updatedMinPrice() {
  return updatePrice(true);
}

function updatedMaxPrice() {
  return updatePrice(false);
}

function updateProgressBar(
  progressBar,
  resetPrice,
  minPriceSlider,
  maxPriceSlider,
) {
  const minValue = Number(minPriceSlider.value);
  const maxValue = Number(maxPriceSlider.value);
  const min = Number(minPriceSlider.min);
  const max = Number(maxPriceSlider.max);
  const minPosition = (minValue - min) / (max - min);
  const maxPosition = (maxValue - min) / (max - min);
  if (isRTL) {
    progressBar.style.transform = `translateX(${(1 - maxPosition) * 100}%) scaleX(${maxPosition - minPosition})`;
    progressBar.style.transformOrigin = 'left';
  } else {
    progressBar.style.transform = `translateX(${minPosition * 100}%) scaleX(${maxPosition - minPosition})`;
    progressBar.style.transformOrigin = 'left';
  }

  resetPrice?.addEventListener('click', () => {
    resetPriceSlider();
  });
  if (!resetPrice?.classList.contains('hidden')) {
    progressBar?.classList.add('error-price-select');
  } else {
    progressBar?.classList.remove('error-price-select');
  }
}

function minRangeSlider(minPriceSlider, maxPriceSlider, minPriceInput, progressBar, resetPrice) {
  minPriceSlider.addEventListener('input', (event) => {
    let minValue = Number(event.target.value);
    const maxValue = Number(maxPriceSlider.value);
    const priceSliderStep = Number(plpFilterPriceSliderStep);

    if (isRTL) {
      if (minValue >= maxValue - priceSliderStep) {
        minValue = maxValue - priceSliderStep;
        minPriceSlider.value = minValue;
      }
    } else if (minValue >= maxValue - priceSliderStep) {
      minValue = maxValue - priceSliderStep;
      minPriceSlider.value = minValue;
    }

    minPriceInput.value = minValue;
    if (resetPrice?.classList.contains('hidden')) {
      resetPrice?.classList.remove('hidden');
    }
    updateProgressBar(
      progressBar,
      resetPrice,
      minPriceSlider,
      maxPriceSlider,
    );
  });

  minPriceSlider.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
  });

  return minPriceInput.value;
}

function maxRangeSlider(minPriceSlider, maxPriceSlider, maxPriceInput, progressBar, resetPrice) {
  maxPriceSlider.addEventListener('input', (event) => {
    let maxValue = Number(event.target.value);
    const minValue = Number(minPriceSlider.value);
    const priceSliderStep = Number(plpFilterPriceSliderStep);

    if (isRTL) {
      if (maxValue <= minValue + priceSliderStep) {
        maxValue = minValue + priceSliderStep;
        maxPriceSlider.value = maxValue;
      }
    } else if (maxValue <= minValue + priceSliderStep) {
      maxValue = minValue + priceSliderStep;
      maxPriceSlider.value = maxValue;
    }

    maxPriceInput.value = maxValue;
    if (resetPrice?.classList.contains('hidden')) {
      resetPrice?.classList.remove('hidden');
    }
    updateProgressBar(
      progressBar,
      resetPrice,
      minPriceSlider,
      maxPriceSlider,
    );
  });

  maxPriceSlider.addEventListener('click', (event) => {
    event.stopImmediatePropagation();
  });

  return maxPriceInput.value;
}

async function handlePopUpApplyButtonFilters(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  if (plpFilterVariation && plpFilterVariation !== 'false') {
    const plpMinPriceRange = document.querySelector('.filters-popup .price-label-container .min-price[data-filter-attr-name="final_price"]');
    const plpMaxPriceRange = document.querySelector('.filters-popup .price-label-container .max-price[data-filter-attr-name="final_price"]');
    const isPriceRangeActive = document.querySelectorAll('.filters-popup .filters-values-ul.active-values');

    isPriceRangeActive.forEach(async (item) => {
      if (item.closest('li')?.getAttribute('data-attribute') === 'final_price') {
        plpMinPriceRange?.classList.add('active-checkbox-price-range');
        plpMaxPriceRange?.classList.add('active-checkbox-price-range');
        document.querySelector('.filters-values-ul.active-values')
          .closest('li[data-attribute="final_price"]')
          .querySelector('.main-filter-chose-values').innerHTML = `${currencyCode} ${updatedMinPrice()} - ${currencyCode} ${updatedMaxPrice()}`;
        e.stopImmediatePropagation();
        /* eslint-disable no-use-before-define */
        const filterKey = `${updatedMinPrice()} - ${updatedMaxPrice()}`;
        const dlFilterKey = `${currencyCode} ${updatedMinPrice()} - ${currencyCode} ${updatedMaxPrice()}`;
        writeFilterToUrl(item?.closest('li')?.getAttribute('data-attribute'), filterKey);
        await makeRequestToAlgolia();
        datalayerFilterEvent('Price', dlFilterKey, CURRENT_CATEGORY, true, facetFiltersDatalayer);
        e.stopPropagation();
      } else {
        const filterKey = `${updatedMinPrice()} - ${updatedMaxPrice()}`;
        plpMinPriceRange?.classList.remove('active-checkbox-price-range');
        plpMaxPriceRange?.classList.remove('active-checkbox-price-range');
        removeFilterFromUrl(item?.closest('li')?.getAttribute('data-attribute'), filterKey);
      }
    });
  }
  hideFilters();
}

async function handleApplyFilters(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  if (plpFilterVariation && plpFilterVariation !== 'false') {
    const isPriceRangeActive = document.querySelectorAll('.filters-body .page-filters.active-price-slider');
    const plpMinPriceRange = document.querySelector('.filters-body .price-label-container .min-price[data-filter-attr-name="final_price"]');
    const plpMaxPriceRange = document.querySelector('.filters-body .price-label-container .max-price[data-filter-attr-name="final_price"]');
    const filterKey = `${updatedMinPrice()} - ${updatedMaxPrice()}`;
    const dlFilterKey = `${currencyCode} ${updatedMinPrice()} - ${currencyCode} ${updatedMaxPrice()}`;
    isPriceRangeActive.forEach(async (item) => {
      if (item?.getAttribute('data-attribute') === 'final_price') {
        plpMinPriceRange?.classList.add('active-checkbox-price-range');
        plpMaxPriceRange?.classList.add('active-checkbox-price-range');
        document.querySelector('.filters-body-main-ul li[data-attribute="final_price"] .main-filter-chose-values').innerHTML = `${currencyCode} ${updatedMinPrice()} - ${currencyCode} ${updatedMaxPrice()}`;
        /* eslint-disable no-use-before-define */
        writeFilterToUrl(item?.getAttribute('data-attribute'), filterKey);
        item.classList.remove('active-price-slider');
        e.stopImmediatePropagation();
        await makeRequestToAlgolia();
        datalayerFilterEvent('Price', dlFilterKey, CURRENT_CATEGORY, true, facetFiltersDatalayer);
        e.stopPropagation();
      } else {
        plpMinPriceRange?.classList.remove('active-checkbox-price-range');
        plpMaxPriceRange?.classList.remove('active-checkbox-price-range');
        removeFilterFromUrl(item?.getAttribute('data-attribute'), filterKey);
      }
    });
  }
}

function createPriceRangeSlider(ulDiv, values) {
  const priceValues = Object.keys(values).map(Number).sort((a, b) => a - b);
  const minPriceInputValue = priceValues[0];
  const maxPriceInputValue = priceValues[priceValues.length - 1];
  const sliderContainer = document.createElement('div');
  sliderContainer.classList.add('slider-container');
  const sliderContent = document.createElement('p');
  sliderContent.classList.add('slider-content');
  sliderContainer.appendChild(sliderContent);
  const labelContainer = document.createElement('div');
  labelContainer.classList.add('price-label-container');
  const minPriceLabelContainer = document.createElement('div');
  minPriceLabelContainer.classList.add('min-pricelabel-container');
  const minPriceLabel = document.createElement('span');
  minPriceLabel.textContent = placeholders.priceSliderLowestPrice || 'Lowest price';
  const minPriceContainer = document.createElement('div');
  minPriceContainer.classList.add('price-container');
  const minPDefaultCurrency = document.createElement('span');
  minPDefaultCurrency.textContent = `${currencyCode}`;
  const minPriceInput = document.createElement('input');
  minPriceInput.type = 'number';
  minPriceInput.className = 'min-price';
  minPriceInput.value = minPriceInputValue;
  minPriceInput.readOnly = true;
  minPriceLabelContainer.appendChild(minPriceLabel);
  minPriceContainer.appendChild(minPDefaultCurrency);
  minPriceContainer.appendChild(minPriceInput);
  minPriceLabelContainer.appendChild(minPriceContainer);
  labelContainer.appendChild(minPriceLabelContainer);
  const maxPriceLabelContainer = document.createElement('div');
  maxPriceLabelContainer.classList.add('max-pricelabel-container');
  const maxPriceLabel = document.createElement('span');
  maxPriceLabel.textContent = placeholders.priceSliderHighestPrice || 'Highest price';
  const maxPriceContainer = document.createElement('div');
  maxPriceContainer.classList.add('price-container');
  const maxPDefaultCurrency = document.createElement('span');
  maxPDefaultCurrency.textContent = `${currencyCode}`;
  const maxPriceInput = document.createElement('input');
  maxPriceInput.type = 'number';
  maxPriceInput.className = 'max-price';
  maxPriceInput.value = maxPriceInputValue;
  maxPriceInput.readOnly = true;
  maxPriceLabelContainer.appendChild(maxPriceLabel);
  maxPriceContainer.appendChild(maxPDefaultCurrency);
  maxPriceContainer.appendChild(maxPriceInput);
  maxPriceLabelContainer.appendChild(maxPriceContainer);
  labelContainer.appendChild(maxPriceLabelContainer);
  sliderContainer.appendChild(labelContainer);
  maxPriceInput.setAttribute('aria-label', `${minPriceInputValue} - ${maxPriceInputValue}`);
  maxPriceInput.setAttribute('data-filter-attr-name', 'final_price');
  maxPriceInput.setAttribute('data-filter-attr-value', `${minPriceInputValue} - ${maxPriceInputValue}`);
  minPriceInput.setAttribute('aria-label', `${minPriceInputValue} - ${maxPriceInputValue}`);
  minPriceInput.setAttribute('data-filter-attr-name', 'final_price');
  minPriceInput.setAttribute('data-filter-attr-value', `${minPriceInputValue} - ${maxPriceInputValue}`);
  const minMaxSlider = document.createElement('div');
  minMaxSlider.classList.add('min-max-slider-container');
  sliderContainer.appendChild(minMaxSlider);
  const progressBar = document.createElement('div');
  progressBar.classList.add('range-progress');
  sliderContainer.appendChild(progressBar);
  const minPriceSlider = document.createElement('input');
  minPriceSlider.type = 'range';
  minPriceSlider.className = 'slider-min';
  minPriceSlider.min = minPriceInputValue;
  minPriceSlider.max = maxPriceInputValue;
  minPriceSlider.value = minPriceInputValue;
  minPriceSlider.step = plpFilterPriceSliderStep || 5;
  minMaxSlider.appendChild(minPriceSlider);
  const maxPriceSlider = document.createElement('input');
  maxPriceSlider.type = 'range';
  maxPriceSlider.className = 'slider-max';
  maxPriceSlider.min = minPriceInputValue;
  maxPriceSlider.max = maxPriceInputValue;
  maxPriceSlider.value = maxPriceInputValue;
  maxPriceSlider.step = plpFilterPriceSliderStep || 5;
  minMaxSlider.appendChild(maxPriceSlider);
  sliderContent.innerHTML = placeholders.sliderHeading || `Price range should be between ${currencyCode} ${minPriceInput.value} to ${currencyCode} ${maxPriceInput.value}`;
  const resetPrice = document.createElement('p');
  resetPrice.textContent = placeholders.resetPrice || 'Reset Price Range';
  resetPrice.classList.add('reset-price', 'hidden');
  sliderContainer.appendChild(resetPrice);

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('price-buttons-container', 'hide-price-button');

  const buttonApllyAllFilters = document.createElement('button');
  buttonApllyAllFilters.classList.add('button-filters', 'button-apply-all-price-filter');
  buttonApllyAllFilters.textContent = placeholders.plpPriceFilterClearAll || 'Apply filters';
  buttonContainer.appendChild(buttonApllyAllFilters);

  sliderContainer.appendChild(buttonContainer);

  buttonApllyAllFilters.removeEventListener('click', handleApplyFilters);
  buttonApllyAllFilters.addEventListener('click', handleApplyFilters);

  minRangeSlider(minPriceSlider, maxPriceSlider, minPriceInput, progressBar, resetPrice);
  maxRangeSlider(minPriceSlider, maxPriceSlider, maxPriceInput, progressBar, resetPrice);
  updateProgressBar(
    progressBar,
    resetPrice,
    minPriceSlider,
    maxPriceSlider,
  );
  return ulDiv.append(sliderContainer);
}

function resetPriceSlider() {
  const priceInputValues = document
    .querySelector('.filters-popup .slider-container .min-pricelabel-container input')
    .getAttribute('aria-label');

  const minPriceInputValue = priceInputValues.split('-')[0].trim();
  const maxPriceInputValue = priceInputValues.split('-')[1].trim();
  const elements = document.querySelectorAll('.active-checkbox-price-range');
  elements.forEach((element) => {
    element.classList.remove('active-checkbox-price-range');
  });
  const minPriceInputs = document.querySelectorAll(
    '.slider-container .min-pricelabel-container input, .slider-container .min-max-slider-container .slider-min',
  );
  const maxPriceInputs = document.querySelectorAll(
    '.slider-container .max-pricelabel-container input, .slider-container .min-max-slider-container .slider-max',
  );

  minPriceInputs.forEach((input) => {
    input.value = minPriceInputValue;
  });
  maxPriceInputs.forEach((input) => {
    input.value = maxPriceInputValue;
  });

  const rangeProgressElements = document.querySelectorAll('.slider-container .range-progress');
  rangeProgressElements.forEach((progress) => {
    progress.style.transformOrigin = 'left';
    progress.style.transform = 'translateX(0%) scaleX(1)';
  });

  const activeValues = document.querySelector('.filters-popup ul.filters-values-ul.active-values');
  if (activeValues) {
    activeValues.classList.remove('active-values');
  }
}

/**
 * Get range values for filters
 *
 * @param priceRangeStep
 * @param values
 * @returns {{}}
 */
function getRangeValues(priceRangeStep, values = {}) {
  const ranges = {};
  const step = priceRangeStep || 10; // Use a new variable 'step' instead of reassigning 'priceRangeStep'
  Object.entries(values).forEach(([filterKey, filterValue]) => {
    const minusValue = filterKey % step || step;
    const fromRange = filterKey - minusValue;
    const toRange = fromRange + step;

    const rangeKey = `${fromRange} - ${toRange}`;
    ranges[rangeKey] = (ranges[rangeKey] ?? 0) + filterValue;
  });
  return ranges;
}

/**
 * Display chosen filter values on the main page
 */
function buildChosenFilterValuesOnMainPage() {
  const chosenValuesContainer = document.querySelector('#main-page-filters-chosen-values-container');
  const chosenValuesUl = document.querySelector('#main-page-filters-chosen-values');
  if (document.querySelectorAll('.filters-values-ul .filter-item.active-checkbox, .filters-values-ul .filter-item.active-checkbox-price-range, .price-label-container .active-checkbox-price-range.min-price[data-filter-attr-name="final_price"], .price-label-container .active-checkbox-price-range.max-price[data-filter-attr-name="final_price"]').length > 0) {
    chosenValuesContainer.classList.remove('hide');
    chosenValuesUl.innerHTML = '';
    document.querySelectorAll('.filters-values-ul .filter-item.active-checkbox, .filters-values-ul .filter-item.active-checkbox-price-range, .price-label-container .active-checkbox-price-range.min-price[data-filter-attr-name="final_price"], .price-label-container .active-checkbox-price-range.max-price[data-filter-attr-name="final_price"]').forEach((filterItem) => {
      const filterKey = filterItem.getAttribute('data-filter-attr-name');
      let filterValue;
      if (plpFilterVariation && plpFilterVariation !== 'false' && filterKey === PRICE_ATTRIBUTE) {
        filterValue = `${updatedMinPrice()} - ${updatedMaxPrice()}`;
      } else {
        filterValue = filterItem.getAttribute('data-filter-attr-value');
      }
      const filterText = filterItem.getAttribute('aria-label');

      if (document.querySelectorAll(`#main-page-filters-chosen-values [data-filter-attr-name="${filterKey}"][data-filter-attr-value="${filterValue}"]`).length === 0) {
        const chosenFilter = document.createElement('li');
        chosenFilter.classList.add('main-page-filters-chosen-value');
        chosenFilter.setAttribute('data-filter-attr-name', filterKey.toLowerCase());
        chosenFilter.setAttribute('data-filter-attr-value', filterValue.toLowerCase());
        if (filterKey === RATING_ATTRIBUTE) {
          chosenFilter.innerHTML = buildRatingValues(filterValue);
        } else if (filterKey === PRICE_ATTRIBUTE) {
          chosenFilter.innerHTML = buildPriceRangeValuesWithCurrency(filterValue);
        } else if (filterKey.includes(COLOR_ATTRIBUTE)) {
          [chosenFilter.innerHTML] = filterText.split(',');
        } else {
          chosenFilter.innerHTML = filterText;
        }
        chosenFilter.addEventListener('click', async (e) => {
          if (plpFilterVariation && plpFilterVariation !== 'false') {
            if (filterKey !== PRICE_ATTRIBUTE) {
              document.querySelector(`.filters-body-container .filters-values-ul [data-filter-attr-name="${filterKey}"][data-filter-attr-value="${filterValue.toLowerCase()}"]`).click();
              document.querySelector('.filters-popup ul.filters-values-ul.active-values')?.classList.remove('active-values');
            } else {
              if (document.querySelector('.filters-body-main-ul li[data-attribute="final_price"] .main-filter-chose-values').innerHTML !== '') {
                document.querySelector('.filters-body-main-ul li[data-attribute="final_price"] .main-filter-chose-values').innerHTML = '';
              }
              const keyValue = `${updatedMinPrice()} - ${updatedMaxPrice()}`;
              const dlFilterKey = `${currencyCode} ${updatedMinPrice()} - ${currencyCode} ${updatedMaxPrice()}`;
              resetPriceSlider();
              chosenFilter.remove();
              /* eslint-disable no-use-before-define */
              removeFilterFromUrl(filterKey, keyValue);
              e.stopImmediatePropagation();
              e.preventDefault();
              await makeRequestToAlgolia();
              datalayerFilterEvent('Price', dlFilterKey, CURRENT_CATEGORY, false, facetFiltersDatalayer);
              e.stopPropagation();
            }
          } else {
            document.querySelector(`.filters-body-container .filters-values-ul [data-filter-attr-name="${filterKey}"][data-filter-attr-value="${filterValue.toLowerCase()}"]`).click();
          }
        });
        chosenValuesUl.appendChild(chosenFilter);

        if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
          const allChosenFilters = chosenValuesUl.querySelectorAll('.main-page-filters-chosen-value');
          let hasMatchingKey = false;
          let hiddenItemsCount = 0;

          allChosenFilters.forEach((chosenFilterLi) => {
            const filterAttrKey = chosenFilterLi.getAttribute('data-filter-attr-name');

            if (filterAttrKey === (plpFilterChipsAttr && plpFilterChipsAttr.toLowerCase())) {
              hasMatchingKey = true;
              chosenFilterLi.classList.add('hide');
              // eslint-disable-next-line no-plusplus
              hiddenItemsCount++;
            } else {
              chosenFilterLi.classList.remove('hide');
            }
          });

          if (hiddenItemsCount === allChosenFilters.length) {
            chosenValuesContainer.classList.add('hide');
          } else if (hasMatchingKey && hiddenItemsCount < allChosenFilters.length) {
            chosenValuesContainer.classList.remove('hide');
          } else if (!hasMatchingKey) {
            chosenValuesContainer.classList.remove('hide');
          }
        }
      }
    });
  } else {
    chosenValuesContainer.classList.add('hide');
    chosenValuesUl.innerHTML = '';
  }
  disableClearfilters();
}

/**
 * Display chosen filter values on the main popup
 */
function editFilterValuesAtTheMainContainer() {
  const facetFiltersActive = {};
  const filterActiveCount = {};
  document.querySelectorAll('.filters-body-main-ul .filters-values-ul .filter-item.active-checkbox, .filters-values-ul .filter-item.active-checkbox-price-range').forEach((filterItem) => {
    let key = filterItem.getAttribute('data-filter-attr-name');
    if (key === `${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`) {
      key = COLOR_ATTRIBUTE;
    }
    const filterValue = filterItem.getAttribute('data-filter-attr-value');
    if (facetFiltersActive[key] === undefined) {
      facetFiltersActive[key] = [filterValue];
      filterActiveCount[key] = 1;
    } else if (facetFiltersActive[key].length < 2) {
      facetFiltersActive[key].push(filterValue);
      filterActiveCount[key] += 1;
    } else if (facetFiltersActive[key].length === 2) {
      filterActiveCount[key] += 1;
    }
  });
  document.querySelectorAll('.filters-body-main-ul .main-filter-chose-values').forEach((filterChosenText) => {
    const attributeName = filterChosenText.parentElement.getAttribute('data-attribute');
    if (facetFiltersActive[attributeName] !== undefined || attributeName === SIZE_GROUPING) {
      let addCount = '';
      if (filterActiveCount[attributeName] > 2) {
        addCount = plpFilterVariation && plpFilterVariation !== 'false'
          ? ` (+ ${filterActiveCount[attributeName] - 2})`
          : ` (+ ${filterActiveCount[attributeName] - 1})`;
      }
      if (attributeName === PRICE_ATTRIBUTE) {
        filterChosenText.innerHTML = buildPriceRangeValuesWithCurrency(facetFiltersActive[attributeName].join(' - ') + addCount);
      } else if (attributeName === RATING_ATTRIBUTE) {
        filterChosenText.innerHTML = buildRatingValues(facetFiltersActive[attributeName].join(' - ')) + addCount;
      } else if (sizeGroupConfig.displaySizeGrouping === 'true' && attributeName === SIZE_GROUPING) {
        // Handle size grouping.
        filterChosenText.innerHTML = '';
        if (hasValue(sizeGroupConfig.allSizeAttributes)) {
          const totalSizeCount = sizeGroupConfig.allSizeAttributes.reduce((count, attribute) => count + (filterActiveCount[attribute] || 0), 0);
          if (totalSizeCount > 0) {
            const adjustment = plpFilterVariation && plpFilterVariation !== 'false' ? 2 : 1;
            const groupAddCount = totalSizeCount > adjustment ? ` (+ ${totalSizeCount - adjustment})` : '';
            sizeGroupConfig.allSizeAttributes.forEach((attribute) => {
              if (facetFiltersActive[attribute]) {
                filterChosenText.innerHTML = facetFiltersActive[attribute].join(', ') + groupAddCount;
              }
            });
          }
        }
      } else {
        filterChosenText.innerHTML = facetFiltersActive[attributeName].join(', ') + addCount;
      }
    } else if (plpFilterVariation !== 'false' && (attributeName === 'sorting' || attributeName === PRICE_ATTRIBUTE)) {
      filterChosenText.innerHTML = filterChosenText.innerText;
    } else {
      filterChosenText.innerHTML = '';
    }
  });
}

/**
 * Add top space to the first item
 *
 * @param attrName
 */
function addTopSpaceToTheFirstItem(attrName) {
  let a = 0;
  document.querySelectorAll(`.filters-body-container .filters-body-main-ul [data-attribute="${attrName}"] ul li`).forEach((filterLi) => {
    if (!filterLi.classList.contains('hide') && a === 0) {
      filterLi.classList.add('top-space');
      a += 1;
    } else {
      filterLi.classList.remove('top-space');
    }
  });
}

function getResultsIndex(response, facetKey) {
  let idx = 0;
  let maxLen = 0;
  let curMax = 0;

  for (let i = 1; i < response.results.length; i += 1) {
    if (response.results[idx].facets[facetKey] && response.results[i].facets[facetKey]) {
      curMax = Math.max(
        Object.keys(response.results[idx].facets[facetKey]).length,
        Object.keys(response.results[i].facets[facetKey]).length,
      );
      idx = curMax === Object.keys(response.results[idx].facets[facetKey]).length ? i : 0;
    } else if (response.results[idx].facets[facetKey]) {
      curMax = Object.keys(response.results[idx].facets[facetKey]).length;
    } else if (response.results[i].facets[facetKey]) {
      curMax = Object.keys(response.results[i].facets[facetKey]).length;
      idx = i;
    }
    if (curMax >= maxLen) {
      maxLen = curMax;
    }
  }
  return idx;
}

/**
 * Build filters for products returned, if a filter has no associated products then it's hidden
 *
 * @param response
 */
function buildCheckedFilters(response) {
  if (response.results.length >= 1) {
    for (let i = 0; i < response.results.length; i += 1) {
      // eslint-disable-next-line no-loop-func
      Object.entries(response.results[i].facets).forEach(([filterKey, filterValue]) => {
        const keysToIgnore = [COLOR_ATTRIBUTE, PRICE_ATTRIBUTE, RATING_ATTRIBUTE];
        if (!keysToIgnore.some((ignore) => filterKey.includes(ignore))) {
          Object.keys(filterValue).forEach((key) => {
            // Check if a string is a number
            if (!/^\d+$/.test(key)) {
              const lowerCaseKey = key.toLowerCase();
              filterValue[lowerCaseKey] = { value: filterValue[key], label: key };
              if (key !== lowerCaseKey) {
                delete filterValue[key];
              }
            }
          });
        }

        let key = filterKey.replace(`.${productListingLanguage}`, '').toLowerCase();
        if (key === `${COLOR_ATTRIBUTE}.value`) {
          key = COLOR_ATTRIBUTE;
        }
        if (Object.keys(response.results[i].facets[filterKey]).length > 1) {
          document.querySelectorAll(`[data-attribute="${key}"]`).forEach((filterDiv) => {
            const mainFilters = document.querySelector('ul.filters-body');
            if (mainFilters.querySelectorAll('li.page-filters:not(.hide)').length < MAX_FILTER_ITEMS) {
              filterDiv.classList.remove('hide');
            }
            if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
              if (filterDiv.getAttribute('data-attribute').toLowerCase() === (plpFilterChipsAttr && plpFilterChipsAttr.toLowerCase())) {
                if (document.querySelector('ul.filter-chips:not(.hide)') < MAX_FILTER_ITEMS) {
                  filterDiv.classList.remove('hide');
                }
              }
            }
          });
        }

        document.querySelectorAll(`[data-attribute="${key}"] ul li`).forEach((filterLi) => {
          let filterAttr = filterLi.getAttribute('data-filter-attr-value');
          filterAttr = filterValue[filterAttr] ? filterAttr : filterAttr.charAt(0).toUpperCase() + filterAttr.slice(1);
          let value = filterValue[filterAttr];
          if (value && Object.keys(filterValue[filterAttr]).length > 1) {
            value = filterValue[filterAttr].value;
          }
          if (key === PRICE_ATTRIBUTE) {
            const idx = getResultsIndex(response, `${getAttributeNameByPage(key)}`);
            const priceRanges = getRangeValues(
              response.results[idx].userData[0].facets_config[key].widget?.config?.granularity,
              response.results[idx].facets[`${key}${searchTerm ? '' : `.${productListingLanguage}`}`],
            );
            if (priceRanges[filterAttr] !== undefined) {
              // rewrite the filter value with the new value for chosen filter
              filterLi.querySelector('.filter-count').innerHTML = `(${priceRanges[filterAttr]})`;
              filterLi.classList.remove('hide');
            } else {
              filterLi.classList.add('hide');
            }
          } else if (key === RATING_ATTRIBUTE) {
            if (filterValue[filterAttr] !== undefined) {
              filterLi.querySelector(`.rating-value-${filterAttr}`).innerHTML = `(${response.results[i].facets[`${getAttributeNameByPage(key)}`][filterAttr]})`;
              filterLi.classList.remove('hide');
            } else {
              filterLi.classList.add('hide');
            }
          } else if (filterValue[filterAttr] !== undefined) {
            // rewrite the filter value with the new value for chosen filter
            filterLi.querySelector('.filter-count').innerHTML = `(${value})`;
            filterLi.classList.remove('hide');
          } else {
            filterLi.classList.add('hide');
          }
        });

        addTopSpaceToTheFirstItem(key);
      });
    }
  }
  letterDivider();
}

function getProductCollectionName(product) {
  if (product.attr_product_collection) {
    return (Object.keys(product.attr_product_collection).includes(productListingLanguage)) ? product.attr_product_collection[productListingLanguage] : product.attr_product_collection;
  }
  if (product.attr_collection_1) {
    return (Object.keys(product.attr_collection_1).includes(productListingLanguage)) ? product.attr_collection_1[productListingLanguage] : product.attr_collection_1;
  }
  return null;
}

// fetch marketing slot information
async function fetchMarketingTiles() {
  let marketingTilesInfo = [];
  const categoryData = await getCategoryData();
  if (await getConfigValue('marketing-slot-enable') === 'true') {
    const marketingSlotLink = await getConfigValue('marketing-slot-endpoint');
    const commerceBaseEndpoint = await getConfigValue('commerce-base-endpoint');
    const API_URL = `${commerceBaseEndpoint}/${lang}/${marketingSlotLink}`;
    const marketingData = await fetch(API_URL);
    if (!marketingData.ok) {
      return [];
    }
    const dataJson = await marketingData.json();
    const filters = {};
    filters.urlPath = `${categoryData.commerce_categories.items[0].url_path}`;
    marketingTilesInfo = dataJson.data.filter((el) => el.categoryUrlKey === filters.urlPath);
    if (marketingTilesInfo.length > 0) {
      await Promise.all(
        marketingTilesInfo.map(async (tile) => {
          const fragment = await loadFragment(tile.bannerPath);
          tile.fragment = fragment;
        }),
      );
    }
  }
  return marketingTilesInfo;
}

export function buildJoinAuraBanner() {
  const bannerDiv = document.createElement('div');
  bannerDiv.classList.add('join-aura-banner', 'product-item');

  let joinText;
  let loginText;
  let toAuraText;
  if (isLoggedInUser() && auraCustomerData?.apc_link === 1) {
    // User type #3: Ecom signed-in, Aura guest, and Aura account matching with Ecom account is found
    joinText = placeholders.linkYourAura || 'Link your Aura';
    loginText = ''; // No login link for this case
    toAuraText = ''; // No "to Aura" text for linking
  } else if (isLoggedInUser() && (auraCustomerData?.apc_link === 0 || auraCustomerData?.apc_link === null)) {
    // User type #2: Ecom signed-in, Aura guest
    joinText = placeholders.join || 'Join';
    loginText = placeholders.auraLoginButton || 'Login';
    toAuraText = `<span>${placeholders.toAura || 'to Aura'}</span>`;
  } else {
    // User type #1: Ecom guest and Aura guest
    joinText = placeholders.join || 'Join';
    loginText = placeholders.auraLoginButton || 'Login';
    toAuraText = `<span>${placeholders.toAura || 'to Aura'}</span>`;
  }
  const contentHtml = `
    <div class="join-aura-banner-header">
      <h3>${placeholders.joinAuraLoyaltyApp || 'Join Aura, the rewarding loyalty app!'}</h3>
    </div>
    <div class="join-aura-banner-body">
      <p>${placeholders.withAuraEarnPoints || 'With Aura, earn points on every purchase & unlock exclusive offers, member prices & more'}</p>
    </div>
    <div class="join-aura-banner-footer">
      <p>
        <a href="#join" class="${loginText === '' ? 'aura-banr-linking-link' : 'aura-banr-join-link'}">${joinText}</a>
        ${loginText ? `<span>${placeholders.or || 'or'}</span> <a href="#login" class="aura-banr-login-link">${loginText}</a>` : ''}
        <span>${toAuraText}</span>
      </p>
    </div>
  `;
  bannerDiv.innerHTML = contentHtml;
  const footerLinks = [
    { selector: '.aura-banr-join-link', action: 'join' },
    { selector: '.aura-banr-login-link', action: 'link' },
    { selector: '.aura-banr-linking-link', action: 'link' },
  ];
  footerLinks.forEach(({ selector, action }) => {
    const link = bannerDiv.querySelector(`.join-aura-banner-footer ${selector}`);
    if (link) {
      link.addEventListener('click', () => openAuraModal.default(action));
    }
  });
  return bannerDiv;
}

/**
 * Build hits
 *
 * @param response
 * @param replace
 * @param isWishlist
 * @param config
 * @param placeholdersList
 */
let positionindex = 0;
let totalProductsListCount = 0;
export function buildHits(response, args) {
  const defaultConfig = {
    replace: true,
    isWishlist: false,
    config: productListingConfig,
    placeholdersList: {},
    blocktype: false,
  };
  const mergedConfig = { ...defaultConfig, ...args };
  const {
    replace, isWishlist, config, placeholdersList, blocktype,
  } = mergedConfig;
  // Only assign to productListingConfig if it's undefined.
  if (typeof productListingConfig === 'undefined') {
    productListingConfig = config;
  }

  const cart = store.getCart();
  let block = document.querySelector('.product-suggestions, .algolia-product-listing.block, .wishlist.block');
  const hideAuraCard = excludeAuraCardPages.includes(block?.getAttribute('data-block-name'));

  if (blocktype) {
    block = blocktype;
    const divContainer = document.createElement('div');
    divContainer.classList.add('products-container');
    block.appendChild(divContainer);
  }
  const productsContainer = block.querySelector('.products-container');
  const itemCountParagraph = !isWishlist ? block.querySelector('.result-count-mobile > p') : '';

  if (Object.keys(placeholdersList).length > 0) {
    placeholders = placeholdersList;
  }

  let currentProductIndex = 0;
  if (replace) {
    productListingPage = 0;
    productsContainer.innerHTML = '';
    if (!isWishlist) {
      if (itemCountParagraph) {
        itemCountParagraph.innerHTML = `${response.results[0].nbHits} ${placeholders.plpItems}`;
      }
    }
  } else {
    currentProductIndex = productsContainer.childNodes.length;
    const halfWidthTiles = document.querySelectorAll('.width-half')?.length;
    currentProductIndex += halfWidthTiles > 0 ? halfWidthTiles * 1 : 0;
    const fullWidthTiles = document.querySelectorAll('.width-full')?.length;
    currentProductIndex += fullWidthTiles > 0 ? fullWidthTiles * 3 : 0;
  }
  insightsQueryId = response.results[0]?.queryID;

  const hits = response?.results[0]?.hits || [];
  const nbHits = response?.results[0]?.nbHits || 0;
  const targetBannerPosition = Math.min(joinAuraBannerPosition, hits.length + 1);
  const processProducts = async (products, productsEn = null) => {
    const currentMarket = await getConfigValue('apimesh-market');
    const marketingTilesInfo = await fetchMarketingTiles();
    const isMobileView = window.matchMedia('(max-width: 767px)').matches;
    // TODO: Move await calls outside of the loop
    // eslint-disable-next-line no-restricted-syntax
    for (const [index, product] of products.entries()) {
      const productCollection = getProductCollectionName(product);
      const productBrand = product?.attr_product_brand && (Object.keys(product.attr_product_brand).includes(productListingLanguage))
        ? product.attr_product_brand[productListingLanguage]
        : product.attr_product_brand;
      const productTitle = product.title[productListingLanguage] ? product.title[productListingLanguage] : product.title;
      const productUrl = product.url[productListingLanguage] ? product.url[productListingLanguage] : product.url;
      const pdpProductUrl = `${productUrl}`.replace('.html', '') || '#';
      const swatchStyle = config['plp-swatch-style'];
      // Prepare the product data object with SKU and title for embedding in a data-product attribute.
      const escapedProductData = JSON.stringify({
        sku: product.sku,
        name: productTitle || '',
      })
        // Convert object to a JSON string and escape quotes for safe HTML embedding.
        .replace(/['"]/g, (match) => (match === '"' ? '&quot;' : '&apos;'));

      const htmlTemplate = `
        ${productListingConfig['plp-card-link'] && productListingConfig['plp-card-link'] === 'false' && !blocktype ? '' : `<a class="product-item-link" aria-label="${productTitle}" href="${pdpProductUrl}"></a>`}
          <div class="product-image-container">
            #productlabel#
            #images#
            #overlay#
            <span class="quick-view"></span>
          </div>
          <div class="wishlist-button-wrapper ${isWishlist ? 'in-wishlist' : ''}" data-product='${escapedProductData}'>
            ${(!isWishlist || productListingConfig['enable-favourites-with-options']) ? `<div class="wishlist-icon corner-align">${placeholders.plpAddToFavourite}</div>` : ''}
          </div>
          ${swatchStyle === 'square' ? `<div class="color-swatch-container ${swatchStyle}">#swatches#</div>` : ''}
          <div class="product-item-info">
            <div class="product-item-info-top">
              ${productCollection ? '<p class="product-item-collection">#collection#</p>' : ''}
              ${plpBrandName && plpBrandName === 'true' ? `${productBrand ? '<p class="product-item-brand">#brand#</p>' : ''}` : ''}
              <a class="product-item-title" data-link='pdp' title='${productTitle}' href="${pdpProductUrl}">
                <h6>#title#</h6>
              </a>
              #rating#
            </div>
              #pricing#
              #promotions#
          </div>
          <div class="cart-button-wrapper hidden">
          ${swatchStyle === 'circle' ? `<div class="color-swatch-container ${swatchStyle}">#swatches#</div>` : ''}
        `;
      let productItemHtml = htmlTemplate.replace('#images#', buildProductImagesHTML(product, config, isWishlist));
      productItemHtml = productItemHtml.replace('#overlay#', buildOutOfStockHTML(product, isWishlist));
      productItemHtml = productItemHtml.replace('#productlabel#', buildProductLabelHTML(product));
      productItemHtml = productItemHtml.replace('#swatches#', buildSwatchHTML(product, config));
      productItemHtml = productItemHtml.replace('#collection#', productCollection);
      if (plpBrandName) {
        productItemHtml = productItemHtml.replace('#brand#', productBrand);
      }
      productItemHtml = productItemHtml.replace('#title#', productTitle);
      productItemHtml = productItemHtml.replace('#rating#', buildRatingHTML(product, config));
      // eslint-disable-next-line no-await-in-loop
      productItemHtml = productItemHtml.replace('#pricing#', await buildPricingHTML(product, config));
      productItemHtml = productItemHtml.replace('#promotions#', buildPromotionsHTML(product, config));

      const productItemDiv = document.createElement('div');
      productItemDiv.classList.add('product-item');
      productItemDiv.dataset.insightsQueryId = response?.results?.[0]?.queryID;
      positionindex += 1;
      productItemDiv.setAttribute('data-index', positionindex);
      productItemDiv.setAttribute('data-id', product.sku);
      productItemDiv.innerHTML = productItemHtml;
      if (productListingConfig['plp-product-info'] === 'true') {
        const productInfoTop = productItemDiv.querySelector('.product-item-info-top');
        const titleDiv = productInfoTop.querySelector('.product-item-title');
        const collectionDiv = productInfoTop.querySelector('.product-item-collection');

        if (titleDiv && collectionDiv) {
          productInfoTop.insertBefore(titleDiv, collectionDiv);
        }
      }
      if (productListingConfig['producttile-enable-addtocart'] === 'true') {
        productItemDiv.querySelector('.cart-button-wrapper').replaceWith(buildAddToCartButton(product, cart));
      }
      productItemDiv.querySelector('.quick-view').replaceWith(...buildQuickViewButton(product, productItemDiv, cart));

      // add event listeners
      // eslint-disable-next-line no-loop-func
      productItemDiv.querySelector('.wishlist-button-wrapper').addEventListener('click', async (event) => {
        if (event.target.classList.contains('disabled')) {
          return;
        }
        event.target.classList.add('disabled');
        const { updateWishlist } = await import('../../scripts/wishlist/api.js');
        const { product: currentProduct } = (!isWishlist || productListingConfig['enable-favourites-with-options']) ? event.target.parentElement.dataset : event.target.dataset;
        const wishListIconState = event.target.classList.contains('in-wishlist');
        updateWishlist(JSON.parse(currentProduct), wishListIconState).then(({ status, message }) => {
          console.debug(message);
          if (status) {
            if (wishListIconState) {
              event.target.classList.remove('in-wishlist');
            } else {
              event.target.classList.add('in-wishlist');
            }
            const indexVal = event.target.closest('.product-item').getAttribute('data-index');
            let productDataFilterEn;
            if (!isWishlist) {
              productDataFilterEn = product;
            } else if (lang === 'en') {
              productDataFilterEn = product;
            } else {
              productDataFilterEn = productsEn.find((item) => item.sku === product.sku);
            }
            datalayerAddToWishlistEvent(!wishListIconState, productDataFilterEn, !isWishlist ? 'plp' : 'wishlist', indexVal, insightsQueryId);
          }
          event.target.classList.remove('disabled');
        });
      });
      productItemDiv.querySelectorAll('.swatch').forEach((color) => {
        color.addEventListener('click', (e) => handleSwatchSelector(e, config, isWishlist));
      });
      productItemDiv.querySelectorAll('.color-swatch-container button').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          handleSwatchCarousel(e, productTitle, product.sku);
        });
      });
      productItemDiv.querySelectorAll('.product-carousel-buttons button').forEach((btn) => {
        btn.addEventListener('click', handleImageCarouselButton);
      });
      const imageContainer = productItemDiv.querySelector('.product-image-container');
      if (imageContainer.querySelectorAll('.item-images img').length > 1) {
        addImageClones(imageContainer.querySelector('.item-images'));
      }
      addImageListeners(imageContainer);
      // eslint-disable-next-line no-loop-func
      productItemDiv.querySelectorAll('a.product-item-link, a[data-link="pdp"]').forEach((pdpLink) => {
        pdpLink?.addEventListener('click', async (event) => {
          event.preventDefault();
          const indexVal = pdpLink?.parentNode?.parentNode?.getAttribute('data-index');
          if (indexVal) {
            const currentUrl = new URL(pdpLink.href, window.location.origin); // Creating URL object
            try {
              const dlObject = {
                index: indexVal,
                insightsQueryId,
              };
              // Adding Base64 encoded dlObject to URL query params
              currentUrl.searchParams.append(
                'dlObject',
                btoa(JSON.stringify(dlObject)),
              );
              pdpLink.href = currentUrl.toString(); // Updating href with new URL
              const productDL = (productsEn?.length) ? productsEn.find((item) => item.sku === product.sku) : product; // find english product from array and assign to DL
              await datalayerSelectItemListEvent(
                productDL,
                totalProductsListCount,
                indexVal,
                insightsQueryId,
              );
            } catch (err) {
              console.error(err);
            } finally {
              // Check if the user pressed the Ctrl key (Windows/Linux) or Command key (macOS)
              const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey for macOS
              // Check if the user clicked the link
              const isClicked = event.type === 'click';
              if (isCtrlPressed && isClicked) {
                const a = document.createElement('a');
                a.target = '_blank';
                a.href = pdpLink.href;
                a.click();
              } else {
                window.location.href = pdpLink.href;
              }
            }
          }
        });
      });

      productsContainer.appendChild(productItemDiv);
      currentProductIndex += 1;

      /* Insert Join Aura banner */
      if (targetBannerPosition === (currentProductIndex + 1)) {
        const joinAuraBanner = document.querySelector('.join-aura-banner') || (isAuraActive && !(isAuraDetailAvailable || isAuraEnrolledDetailAvailable) && buildJoinAuraBanner());
        if (!blocktype && !hideAuraCard && joinAuraBanner) {
          productsContainer.appendChild(joinAuraBanner);
          currentProductIndex += 1;
        }
      }

      // insert marketing slot
      if (marketingTilesInfo && marketingTilesInfo.length > 0) {
        // eslint-disable-next-line no-loop-func
        marketingTilesInfo.forEach((tile) => {
          const slotPosition = tile.alignment || 'left';
          const row = parseInt(tile.rowNo, 10);
          const slotWidth = tile.width;

          const marketsToDisplay = Object.keys(tile)
            .filter((market) => market.startsWith('market_') && tile[market] === 'y');
          const marketToShow = marketsToDisplay.find((el) => el.split('_')[1] === currentMarket);
          // get the index value to insert the marketing slot
          let marketingIndex = isMobileView ? (row - 1) * 2 : (row - 1) * 4;
          if (slotPosition === 'right') {
            marketingIndex = isMobileView ? marketingIndex += 1 : marketingIndex += (slotWidth === 'half' ? 2 : 3);
          }

          let addMarketingTile = false;
          let addJoinAuraBanner = false;
          if (index === 0 && marketingIndex === 0 && marketToShow) {
            addMarketingTile = true;
          } else if (currentProductIndex === marketingIndex && marketToShow) {
            addMarketingTile = true;
          } else if (index + 1 === nbHits && index + 1 < marketingIndex && marketToShow) {
            // insert marketing slots if target position is greater than number of products listed
            addMarketingTile = true;
          }

          if (addMarketingTile) {
            let addedProductSpace = 0;
            if (slotWidth === 'full') {
              addedProductSpace = isMobileView ? 2 : 4;
            } else if (slotWidth === 'half') {
              addedProductSpace = isMobileView ? 1 : 2;
            } else if (slotWidth === 'quarter') {
              addedProductSpace = 1;
            }
            if ((currentProductIndex + addedProductSpace) >= targetBannerPosition && currentProductIndex < targetBannerPosition) {
              addJoinAuraBanner = true;
            }
            currentProductIndex += addedProductSpace;
            const marketingTile = document.createElement('div');
            marketingTile.classList.add('marketing-tile', `width-${slotWidth}`, `align-${slotPosition}`, `row-${row}`);
            marketingTile.innerHTML = tile.fragment.outerHTML;
            if (index === 0 && marketingIndex === 0) {
              productsContainer.prepend(marketingTile);
            } else {
              productsContainer.appendChild(marketingTile);
            }
          }

          // Insert the join-aura-banner if we reach the target position
          if (targetBannerPosition === (currentProductIndex + 1) || (targetBannerPosition >= nbHits && index + 1 === nbHits) || addJoinAuraBanner) {
            const joinAuraBanner = document.querySelector('.join-aura-banner') || (isAuraActive && !(isAuraDetailAvailable || isAuraEnrolledDetailAvailable) && buildJoinAuraBanner());
            if (!blocktype && !hideAuraCard && joinAuraBanner) {
              productsContainer.appendChild(joinAuraBanner);
              currentProductIndex += 1;
            }
          }
        });
      }
    }
    if ((recommendCarouselVariation && recommendCarouselVariation !== 'false') && blocktype) {
      block.innerHTML = '';
      recommendationCarousalVariation(block, productsContainer);
      const productContainerAdd = block.querySelectorAll('.carousel-item');
      productContainerAdd.forEach((carouselItems) => {
        carouselItems.classList.add('products-container');
      });
      const emptyProductContainer = document.querySelectorAll('.products-container.card');
      emptyProductContainer.forEach((emptyCarouselItems) => {
        if (emptyCarouselItems.childNodes.length === 0) {
          emptyCarouselItems.closest('.carousel-item').remove();
        }
      });
    }
  };

  const init = async () => {
    const products = response?.results[0]?.hits || [];
    const productsEn = lang !== 'en' ? response?.results?.[0]?.collectionHitsEn?.[0] || [] : null;
    await processProducts(products, productsEn);
    if (window.location.href.indexOf('wishlist') !== -1) datalayerViewItemListEvent(lang === 'en' ? response?.results?.[0]?.hits : response?.results?.[0]?.collectionHitsEn?.[0], insightsQueryId);
  };

  init();
  checkSwatchCarouselButtons();
}

/**
 * Updates wishlist icons based on the current wishlist by fetching the wishlist data and adjusting
 * the display of icons for each product.
 *
 */
export const updateWishlistIcons = () => {
  import('../../scripts/wishlist/api.js').then(({ getWishlist }) => {
    // Fetch wishlist
    getWishlist().then((wishlist) => {
      const wishlistSKUs = wishlist.items.map((item) => item.parent_sku);

      // Select all wishlist button wrappers
      const wishlistButtonWrappers = document.querySelectorAll('.wishlist-button-wrapper');

      wishlistButtonWrappers.forEach((wrapper) => {
        const productData = JSON.parse(wrapper.getAttribute('data-product'));
        const productSKU = productData.sku;
        const wishlistIcon = wrapper.querySelector('.wishlist-icon');
        // Add or remove the 'in-wishlist' class based on SKU presence in wishlist
        if (wishlistSKUs.includes(productSKU)) {
          wishlistIcon.classList.add('in-wishlist');
        } else {
          wishlistIcon.classList.remove('in-wishlist');
        }
      });
    });
  });
};

/**
 * Method to check if the filter has any active element
 */
function filterContainsActiveItem(filterAttribute) {
  let hasActiveCheckbox = false;
  const filter = document.querySelectorAll(`[data-attribute="${filterAttribute}"]`);
  for (let i = 0; i < filter.length; i += 1) {
    const filterLiElement = filter[i];
    const filterValueElement = filterLiElement.querySelectorAll('ul > li');
    for (let filterLiIndex = 0; filterLiIndex < filterValueElement.length; filterLiIndex += 1) {
      if (filterValueElement[filterLiIndex].classList.contains('active-checkbox')) {
        hasActiveCheckbox = true;
        break;
      }
    }

    if (hasActiveCheckbox) {
      break;
    }
  }
  return hasActiveCheckbox;
}

/**
 * Hide additional filters and the 'all filters' button
 */
function hideExtraFilters() {
  const mainFilter = document.querySelector('ul.filters-body');
  const filterElements = mainFilter.querySelectorAll('li.page-filters:not(.hide)');
  filterElements.forEach((li, index) => {
    if (index >= MAX_FILTER_ITEMS) {
      li.classList.add('hide');
    }
  });
  const allFilter = mainFilter.querySelector('li.filters-icon');
  const filterLi = document.querySelectorAll('.filters-body-main-ul > li:not(.hide)');
  if (filterLi.length <= MAX_FILTER_ITEMS) {
    allFilter.classList.add('hide');
  } else {
    allFilter.classList.remove('hide');
  }
}

/**
 * Check if filter value applicable to url
 *
 * @param filterAttr
 * @param filterKey
 * @returns {boolean}
 */
function isFilterNotApplicableToUrl(filterAttr, filterKey) {
  return (productListingLanguage !== DEFAULT_LANGUAGE) && !/^\d+$/.test(filterKey) && filterAttr !== PRICE_ATTRIBUTE;
}

function removeFilterFromUrl(filterAttr, filterKey) {
  const urlSplit = window.location.href.split('/--').slice(1);
  let key = filterKey;
  if (COLOR_ATTRIBUTE.includes(filterAttr.replace('attr_', ''))) {
    [key] = filterKey.split(',');
  }
  if (findValueInObject(key)) {
    const aliasValue = findValueInObject(key);
    key = aliasValue.alias;
  } else {
    if (isFilterNotApplicableToUrl(filterAttr, key)) {
      return;
    }
    key = key.toLowerCase().replace(/ /g, '__').replace(/\//g, '_').replace(/-/g, '_');
  }
  let resultUrl = window.location.href;
  let attr;

  if (filterAttr.includes('price')) {
    attr = 'price';
    [key] = filterKey.split(' - ');
  } else {
    attr = filterAttr.replace('attr_', '');
  }

  urlSplit.forEach((facet) => {
    if (facet.includes(attr) && facet.includes(key)) {
      const facetSplit = facet.split('-');
      // single filter for the selected attr
      if (facetSplit.length === 2) {
        resultUrl = resultUrl.replace(`/--${attr}-${key}`, '');
      } else {
        const facetRemoved = facetSplit.filter((item) => item !== key).join('-');
        resultUrl = resultUrl.replace(facet, facetRemoved);
      }
    }
  });
  window.history.replaceState(null, '', resultUrl);
}

function writeFilterToUrl(filterAttr, filterKey) {
  let attr;
  let key = filterKey;
  if (filterAttr !== PRICE_ATTRIBUTE) {
    attr = filterAttr.replace('attr_', '');
    if (filterAttr.includes(COLOR_ATTRIBUTE)) {
      [key] = filterKey.split(',');
    }
    if (findValueInObject(key)) {
      const aliasIndex = findValueInObject(key);
      key = aliasIndex.alias;
    } else {
      if (isFilterNotApplicableToUrl(filterAttr, filterKey)) {
        return;
      }
      key = key.toLowerCase().replace(/ /g, '__');
      key = key.toLowerCase().replace(/\//, '_');
      key = key.replace(/-/g, '_');
    }
  } else {
    attr = filterAttr.replace('final_', '');
    key = filterKey.split('-')[0].trim();
  }

  const combinedString = `--${attr}-${key}`;
  let resultUrl = '';
  if (!window.location.href.includes(`--${attr}-`)) {
    resultUrl = buildUrlWithFilters(combinedString);
  } else {
    let urlWithoutSearchParam = window.location.href;
    const queryIndex = window.location.href.indexOf('?');
    if (queryIndex !== -1) {
      urlWithoutSearchParam = window.location.href.slice(0, queryIndex);
    }
    const urlSplit = urlWithoutSearchParam.split('/');
    let updatedUrl = '';
    urlSplit.forEach((part) => {
      if (part.includes('--price-') && attr.includes('price')) {
        updatedUrl += `--price-${key}/`;
      } else if (part.includes(`--${attr}-`) && !part.includes(`-${key}`)) {
        updatedUrl += `${part}-${key}/`;
      } else {
        updatedUrl += `${part}/`;
      }
    });
    resultUrl = updatedUrl;
  }
  resultUrl = resultUrl.replace(/\/+$/, '');
  window.history.pushState({}, '', resultUrl + window.location.search);
}

// Function to filter the list based on search input
function filterList(ulDiv, searchInput) {
  const searchValue = searchInput.value.toLowerCase();
  const listItems = ulDiv.querySelectorAll('li');
  const letterDividers = ulDiv.querySelectorAll('div.letter-divider');

  listItems.forEach((item) => {
    if (sizeGroupConfig.displaySizeGrouping === 'true' && item.classList.contains('skip-filter')) {
      // Skip elements with the class .skip-filter.
      return;
    }
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(searchValue) ? '' : 'none';
  });

  if (sizeGroupConfig.displaySizeGrouping === 'true') {
    manageGroupSizeFilterList(ulDiv, listItems, placeholders);
  }

  letterDividers.forEach((letter) => {
    const letterChar = letter.textContent.trim().toLowerCase();
    let hasVisibleItems = false;

    let nextElement = letter.nextElementSibling;
    while (nextElement && nextElement.tagName !== 'DIV') {
      if (nextElement.style.display !== 'none' && nextElement.textContent.toLowerCase().startsWith(letterChar)) {
        hasVisibleItems = true;
        break;
      }
      nextElement = nextElement.nextElementSibling;
    }
    letter.style.display = hasVisibleItems ? '' : 'none';
  });
}

function letterDivider() {
  document.querySelectorAll('.letter-divider').forEach((div) => {
    let nextSibling = div.nextElementSibling;
    const liSiblings = [];
    while (nextSibling) {
      if (nextSibling.tagName === 'LI') {
        liSiblings.push(nextSibling);
      } else if (nextSibling.tagName === 'DIV') {
        break;
      }
      nextSibling = nextSibling.nextElementSibling;
    }
    const allAreHidden = liSiblings.every((li) => li.classList.contains('hide'));
    if (liSiblings.length > 0 && allAreHidden) {
      div.classList.add('hidden');
    } else {
      div.classList.remove('hidden');
    }
  });
}

// Function to create and append the search box
function createSearchBox(ulDiv) {
  const searchIcon = document.createElement('span');
  searchIcon.classList.add('icon', 'search-icon');
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.classList.add('searchBox', 'search-input');
  searchInput.placeholder = placeholders.searchPlaceholder || 'Search';
  searchInput.addEventListener('keyup', () => {
    filterList(ulDiv, searchInput);
  });
  searchInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  searchInput.addEventListener('focus', () => {
    searchInput.placeholder = '';
  });
  searchInput.addEventListener('blur', () => {
    searchInput.placeholder = placeholders.searchPlaceholder || 'Search';
  });

  const searchDiv = document.createElement('div');
  searchDiv.setAttribute('data-filter-attr-name', 'searchbox');
  searchDiv.setAttribute('data-filter-attr-value', 'searchbox');
  searchDiv.classList.add('search-field');
  searchDiv.appendChild(searchIcon);
  searchDiv.appendChild(searchInput);
  return ulDiv.insertBefore(searchDiv, ulDiv.firstChild);
}

// Function to create a filter li element
function createFilterLi(filterAttr, filterKey, filterValue) {
  const filterLi = document.createElement('li');
  filterLi.classList.add('filter-item');
  filterLi.setAttribute('aria-label', filterKey);
  filterLi.setAttribute('data-filter-attr-name', filterAttr.toLowerCase());
  filterLi.setAttribute('data-filter-attr-value', filterKey.toLowerCase());
  filterLi.innerHTML = filterKey;

  const countSpan = document.createElement('span');
  countSpan.classList.add('filter-count');
  countSpan.innerHTML = `(${filterValue})`;
  filterLi.append(countSpan);

  return filterLi;
}

// Function to handle clicks on filter items
async function handleFilterClick(e, gtmFilterTitle) {
  const target = e.target.closest('li');

  if (!target) return;

  const filterAttrName = target.getAttribute('data-filter-attr-name');
  const filterAttrValue = target.getAttribute('data-filter-attr-value');

  if (!filterAttrName || !filterAttrValue) return;

  let isActive = true;

  // Find and toggle 'active-checkbox' class on all matching items in both ulDiv and filter chips list
  document.querySelectorAll(`[data-filter-attr-name="${filterAttrName}"][data-filter-attr-value="${filterAttrValue}"]`)
    .forEach((filterItem) => {
      filterItem.classList.toggle('active-checkbox');
      if (!filterItem.classList.contains('active-checkbox')) {
        isActive = false;
      }
    });

  // Update the URL with the active filter or remove it
  if (isActive) {
    writeFilterToUrl(filterAttrName, filterAttrValue);
  } else {
    removeFilterFromUrl(filterAttrName, filterAttrValue);
  }

  // Make Algolia request and log the event
  // eslint-disable-next-line no-use-before-define
  await makeRequestToAlgolia();
  e.stopPropagation(); // Prevent further event propagation
  // build Algolia request with the selected filter
  datalayerFilterEvent(gtmFilterTitle, filterAttrValue, CURRENT_CATEGORY, isActive, facetFiltersDatalayer);
}

// Function to append a cloned li to the filter chips div
function appendToFilterChipsDiv(filterLi, filterKey, filterAttr) {
  let filterChipsDiv = document.querySelector('.filter-chips');
  if (!filterChipsDiv) {
    filterChipsDiv = document.createElement('div');
    filterChipsDiv.classList.add('filter-chips');
    filterChipsDiv.setAttribute('aria-label', filterKey);
    filterChipsDiv.setAttribute('data-attribute', filterAttr.toLowerCase());
    document.body.prepend(filterChipsDiv); // Or append to the desired parent element
  } else {
    filterChipsDiv.setAttribute('aria-label', filterKey);
    filterChipsDiv.setAttribute('data-attribute', filterAttr.toLowerCase());
  }

  let ulDivForfilterChips = filterChipsDiv.querySelector('ul.filters-values-ul');
  if (!ulDivForfilterChips) {
    ulDivForfilterChips = document.createElement('ul');
    ulDivForfilterChips.classList.add('filters-values-ul');
    filterChipsDiv.append(ulDivForfilterChips);
  }

  // Prevent duplication by checking if li already exists
  const existingLi = ulDivForfilterChips.querySelector(`[data-filter-attr-value="${filterLi.getAttribute('data-filter-attr-value')}"]`);
  if (!existingLi) {
    ulDivForfilterChips.append(filterLi); // Append only if not already present
  }
}

/**
 * Build the checkbox filter
 *
 * @param response
 * @param values
 * @param sortBy
 * @param filterAttr
 * @param ulDiv
 */
function buildCheckboxFilter(response, values, sortBy, filterAttr, ulDiv, gtmFilterTitle) {
  const idx = response.results.length > 1 ? response.results.length - 1 : 0;
  const sortOrderLeftValues = {};

  // Create the main filter items based on the custom sort order
  if (sortBy === 'custom') {
    Object.entries(response.results[idx].renderingContent.facetOrdering.values[`${getAttributeNameByPage(filterAttr)}`].order)
      .forEach(([, filterKey]) => {
        if (values[filterKey] !== undefined) {
          sortOrderLeftValues[filterKey] = values[filterKey];

          // Create and append the filter item
          const filterLi = createFilterLi(filterAttr, filterKey, values[filterKey]);
          ulDiv.append(filterLi);
        }
      });
  }

  // Create filter items for the values object
  Object.entries(values).forEach(([filterKey, filterValue]) => {
    if (sortOrderLeftValues[filterKey] !== undefined) return;

    let filterKeyLabel = filterKey;
    let filterKeyValue = filterValue;

    if (Object.keys(filterValue).length > 1) {
      filterKeyLabel = filterValue.label;
      filterKeyValue = filterValue.value;
    }

    const filterLi = createFilterLi(filterAttr, filterKeyLabel, filterKeyValue);
    ulDiv.append(filterLi);
    if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
      if (filterAttr === (plpFilterChipsAttr && plpFilterChipsAttr.toLowerCase())) {
        appendToFilterChipsDiv(filterLi.cloneNode(true), gtmFilterTitle, filterAttr); // Clone for filter chips div
      }
    }
  });

  // Attach event listener to both original and cloned lists
  ulDiv.addEventListener('click', (e) => handleFilterClick(e, gtmFilterTitle));
  if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false' && (filterAttr === plpFilterChipsAttr && plpFilterChipsAttr.toLowerCase())) {
    // Delegate event handling for the cloned filter chips div
    const filterChipsDiv = document.querySelector('.filter-chips ul');
    filterChipsDiv.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      handleFilterClick(e, gtmFilterTitle);
      e.stopPropagation();
    });
  }

  if (plpFilterVariation && plpFilterVariation !== 'false') {
    createSearchBox(ulDiv);
    if (filterAttr.toLocaleLowerCase() === 'attr_fragrance_name') {
      let currentLetter = '';

      const fragranceItems = Array.from(ulDiv.querySelectorAll('li[data-filter-attr-name="attr_fragrance_name"]'));

      if (fragranceItems.length > 0) {
        fragranceItems.forEach((item) => {
          const productName = item.getAttribute('data-filter-attr-value').trim();
          const firstLetter = productName.charAt(0).toLocaleUpperCase();

          if (firstLetter !== currentLetter) {
            currentLetter = firstLetter;

            const letterDiv = document.createElement('div');
            letterDiv.textContent = currentLetter;
            letterDiv.classList.add('letter-divider');

            ulDiv.appendChild(letterDiv);
          }

          ulDiv.appendChild(item);
        });
      }
    }
  }
}

/**
 * Resort filter values by count or alphabetically
 *
 * @param response
 * @param attrName
 * @param sortBy
 * @returns {{}|*}
 */
function resortFilterValues(response, attrName, sortBy, idx = 0) {
  let attributeName = getAttributeNameByPage(attrName);
  if (attrName === COLOR_ATTRIBUTE) {
    attributeName = `${getAttributeNameByPage(attrName)}.label`;
  }
  let values = response.results[idx].facets[attributeName];

  if (response.results.length > 1) {
    values = {};
    for (let i = 0; i < response.results.length; i += 1) {
      values = { ...values, ...response.results[i].facets[attributeName] };
    }
  }
  if (sortBy === 'count') {
    return Object.keys(values)
      .sort((a, b) => values[b] - values[a])
      .reduce((acc, key) => {
        acc[key] = values[key];
        return acc;
      }, {});
  } if (sortBy === 'alpha') {
    return Object.keys(values)
      .sort()
      .reduce((acc, key) => {
        acc[key] = values[key];
        return acc;
      }, {});
  } if (sortBy === 'alphadesc') {
    const keys = Object.keys(values);
    keys.sort((a, b) => b.localeCompare(a));
    const sortedObj = {};
    keys.forEach((key) => {
      sortedObj[key] = values[key];
    });
    return sortedObj;
  } if (sortBy === 'custom') {
    // TODO implement custom sorting
  }
  return values;
}

/**
 * Build the rating filter
 *
 * @param values
 * @param filterAttr
 * @param ulDiv
 */
function buildRatingFilters(values, filterAttr, ulDiv, gtmFilterTitle) {
  Object.entries(values).forEach(([filterKey, filterValue]) => {
    const filterLi = document.createElement('li');
    filterLi.classList.add('filter-item');
    filterLi.classList.add('filter-item-rating');
    filterLi.setAttribute('data-filter-attr-name', filterAttr);

    const countOfStart = filterKey.split('_')[1];

    const starsCount = document.createElement('span');
    starsCount.classList.add('filter-count-stars');
    starsCount.innerHTML = buildRatingValues(filterKey);

    filterLi.appendChild(starsCount);

    for (let i = 0; i < 5; i += 1) {
      const starSpan = document.createElement('span');
      starSpan.classList.add(`${i < countOfStart ? 'star-filled' : 'star-empty'}`);
      filterLi.appendChild(starSpan);
    }
    const ratingValueSpan = document.createElement('span');
    ratingValueSpan.innerHTML = ` (${filterValue})`;
    ratingValueSpan.classList.add(`rating-value-${filterKey}`);
    ratingValueSpan.classList.add('filter-count'
    + '');
    filterLi.appendChild(ratingValueSpan);
    filterLi.setAttribute('data-filter-attr-value', filterKey);

    filterLi.addEventListener('click', (e) => {
      let isActive = true;
      if (e.target.classList.contains('active-checkbox')) {
        isActive = false;
      }
      document.querySelectorAll(`[data-filter-attr-name="${filterAttr}"][data-filter-attr-value="${filterKey}"]`)
        .forEach((filterItem) => {
          filterItem.classList.toggle('active-checkbox');
        });

      if (isActive) {
        writeFilterToUrl(filterAttr, filterKey);
      } else {
        removeFilterFromUrl(filterAttr, filterKey);
      }
      // eslint-disable-next-line no-use-before-define
      makeRequestToAlgolia();
      e.stopPropagation(); // prevent parent li click event
      // build Algolia request with the selected filter
      datalayerFilterEvent(gtmFilterTitle, filterKey, CURRENT_CATEGORY, isActive, facetFiltersDatalayer);
    });

    ulDiv.appendChild(filterLi);
  });
}

/**
 * Build the checkbox price range filter
 *
 * @param values
 * @param granularity
 * @param filterAttr
 * @param ulDiv
 * @param gtmFilterTitle
 */
function buildCheckboxPriceRangeFilter(values, granularity, filterAttr, ulDiv, gtmFilterTitle) {
  const ranges = getRangeValues(granularity, values);

  Object.entries(ranges).forEach(([rangeKey, rangeValue]) => {
    const filterLi = document.createElement('li');
    filterLi.classList.add('filter-item');

    filterLi.setAttribute('aria-label', rangeKey);
    filterLi.setAttribute('data-filter-attr-name', filterAttr);
    filterLi.setAttribute('data-filter-attr-value', rangeKey);
    const rangeWithCurrency = buildPriceRangeValuesWithCurrency(rangeKey);
    filterLi.innerHTML = rangeWithCurrency;

    const countSpan = document.createElement('span');
    countSpan.classList.add('filter-count');
    countSpan.innerHTML = `(${rangeValue})`;
    filterLi.append(countSpan);

    filterLi.addEventListener('click', async (e) => {
      let isActive = true;
      document.querySelectorAll(`[data-filter-attr-name="${filterAttr}"][data-filter-attr-value="${rangeKey}"]`)
        .forEach((filterItem) => {
          filterItem.classList.toggle('active-checkbox-price-range');
          if (!filterItem.classList.contains('active-checkbox-price-range')) {
            isActive = false;
          }
        });
      if (isActive) {
        writeFilterToUrl(filterAttr, rangeKey);
      } else {
        removeFilterFromUrl(filterAttr, rangeKey);
      }
      document.querySelectorAll(`[data-filter-attr-name="${filterAttr}"]`)
        .forEach((filterItem) => {
          const attrName = filterItem.getAttribute('data-filter-attr-name');
          const attrValue = filterItem.getAttribute('data-filter-attr-value');
          if (attrName === filterAttr && attrValue !== rangeKey) {
            filterItem.classList.remove('active-checkbox-price-range');
          }
        });
      // build Algolia request with the selected filter
      // eslint-disable-next-line no-use-before-define
      await makeRequestToAlgolia();
      e.stopPropagation(); // prevent parent li click event
      datalayerFilterEvent(gtmFilterTitle, rangeWithCurrency, CURRENT_CATEGORY, isActive, facetFiltersDatalayer);
    });
    // append filter value li to filter values ul
    if (!plpFilterVariation && plpFilterVariation !== 'true') {
      ulDiv.append(filterLi);
    }
  });
  if (plpFilterVariation && plpFilterVariation !== 'false') {
    createPriceRangeSlider(ulDiv, values);
  }
}

/**
 * Build the swatcher filter
 *
 * @param values
 * @param filterAttr
 * @param ulDiv
 */
function buildSwatcherFilter(values, filterAttr, ulDiv, gtmFilterTitle) {
  const filterAttrEdited = `${getAttributeNameByPage(filterAttr)}.value`;
  Object.entries(values).forEach(([filterKey, filterValue]) => {
    const colorValues = filterKey.split(',');
    if (!colorValues[1]) {
      return;
    }
    const colorTitle = colorValues[0].trim().toLowerCase();
    const color = colorValues[1].replace('swatch_color:', '').trim();

    // create a li for each filter value
    const filterLi = document.createElement('li');
    filterLi.classList.add('filter-item');
    filterLi.classList.add('filter-item-color');

    const colorSpan = document.createElement('span');
    colorSpan.classList.add('color-span');
    colorSpan.style.backgroundColor = color;

    filterLi.setAttribute('aria-label', filterKey);
    filterLi.setAttribute('data-filter-attr-name', filterAttrEdited);
    filterLi.setAttribute('data-filter-attr-value', colorTitle);
    filterLi.appendChild(colorSpan);

    const colorSpanCount = document.createElement('span');
    colorSpanCount.setAttribute('id', `color-span-count-${colorTitle}`);
    colorSpanCount.innerHTML = `${colorTitle}`;
    filterLi.appendChild(colorSpanCount);

    const countSpan = document.createElement('span');
    countSpan.classList.add('filter-count');
    countSpan.innerHTML = `(${filterValue})`;
    filterLi.append(countSpan);

    filterLi.addEventListener('click', async (e) => {
      let isActive = true;
      document.querySelectorAll(`[data-filter-attr-name="${filterAttrEdited}"][data-filter-attr-value="${colorTitle.toLowerCase()}"]`)
        .forEach((filterItem) => {
          filterItem.classList.toggle('active-checkbox');
          if (!filterItem.classList.contains('active-checkbox')) {
            isActive = false;
          }
        });
      if (isActive) {
        writeFilterToUrl(filterAttr, filterKey);
      } else {
        removeFilterFromUrl(filterAttr, filterKey);
      }
      // build Algolia request with the selected filter
      // eslint-disable-next-line no-use-before-define
      await makeRequestToAlgolia();
      e.stopPropagation(); // prevent parent li click event
      datalayerFilterEvent(gtmFilterTitle, colorTitle, CURRENT_CATEGORY, isActive, facetFiltersDatalayer);
    });

    // append filter value li to filter values ul
    ulDiv.append(filterLi);
  });
}

function rebuildMissingFilters(response, facetFilters, attrDataName, value, ul) {
  const facetFiltersKey = attrDataName === COLOR_ATTRIBUTE ? `${getAttributeNameByPage(attrDataName)}.value` : attrDataName;
  // Proceed if the facetFilters is not empty.
  if (Object.keys(facetFilters).length > 0
    && ul.querySelectorAll('li').length < facetFilters[facetFiltersKey].length) {
    const activeSelections = Array.from(ul.querySelectorAll('.active-checkbox, .active-checkbox-price-range')).map((li) => ({
      attributeName: li.getAttribute('data-filter-attr-name'),
      attributeValue: li.getAttribute('data-filter-attr-value'),
    }));
    ul.innerHTML = '';
    const gtmFilterTitle = value.label?.en;
    let sortedValues = [];
    let sortBy = 'alpha';
    let idx;
    if (value.widget.type === 'checkbox') {
      const attrOrder = response.results[0].renderingContent.facetOrdering.values[attrDataName];
      if (attrOrder !== undefined) {
        if (attrOrder.order !== undefined) {
          sortBy = 'custom';
        } else {
          sortBy = attrOrder.sortRemainingBy;
        }
      }
      sortedValues = resortFilterValues(response, attrDataName, sortBy);
      buildCheckboxFilter(
        response,
        sortedValues,
        sortBy,
        attrDataName,
        ul,
        gtmFilterTitle,
      );
    } else if (value.widget.type === 'star_rating') {
      sortedValues = resortFilterValues(response, attrDataName, 'alphadesc');
      buildRatingFilters(
        sortedValues,
        attrDataName,
        ul,
        gtmFilterTitle,
      );
    } else if (value.widget.type === 'range_checkbox') {
      idx = getResultsIndex(response, `${getAttributeNameByPage(attrDataName)}`);
      buildCheckboxPriceRangeFilter(
        response.results[idx].facets[`${getAttributeNameByPage(attrDataName)}`],
        response.results[idx].userData[0].facets_config[attrDataName].widget?.config?.granularity,
        attrDataName,
        ul,
        gtmFilterTitle,
      );
    } else if (value.widget.type === 'swatch_list') {
      const colorLabel = facetFiltersKey.replace('.value', '.label');
      idx = getResultsIndex(response, colorLabel);
      sortedValues = resortFilterValues(response, COLOR_ATTRIBUTE, sortBy, idx);
      buildSwatcherFilter(
        sortedValues,
        attrDataName,
        ul,
        gtmFilterTitle,
      );
    }
    activeSelections.forEach((attr) => {
      ul.querySelector(`[data-filter-attr-name="${attr.attributeName}"][data-filter-attr-value="${attr.attributeValue}"]`).classList.add(`active-checkbox${attr.attributeName === PRICE_ATTRIBUTE ? '-price-range' : ''}`);
    });
  }
}

/**
 * Processes and creates filter values for group attribute.
 *
 * @param {Object} response - The API response containing filter data.
 * @param {string} attrNameNoLng - The attribute name without language suffix.
 * @param {Object} group - The group of filters (e.g., Shoes, Clothing).
 * @param {HTMLElement} mainFilterValuesUl - The container for main filter values.
 * @param {string} gtmFilterTitle - The title of the filter used for GTM tracking.
 * @param {HTMLElement} mainFilterValuesUlMainPage - The container for main filter.
 */
function processGroupAttributes(
  response,
  attrNameNoLng,
  group,
  mainFilterValuesUl,
  gtmFilterTitle,
  mainFilterValuesUlMainPage = null,
) {
  const attrName = `${attrNameNoLng}.${productListingLanguage}`;
  const attrOrder = response.results[0].renderingContent.facetOrdering.values[attrName];
  const sortBy = attrOrder?.order !== undefined ? 'custom' : attrOrder?.sortRemainingBy;
  const attributeName = getAttributeNameByPage(attrNameNoLng);
  if (!hasValue(response.results[0].facets[attributeName])) {
    return;
  }
  // Sort and process filter values.
  const sortedValues = resortFilterValues(response, attrNameNoLng, sortBy);

  if (sortedValues && typeof sortedValues === 'object') {
    Object.entries(sortedValues).forEach(([filterKey, filterValue]) => {
      const filterLabel = filterValue.label || filterKey;
      const filterValueActual = filterValue.value || filterValue;
      // Create list items for the filter values.
      const filterLi = createFilterLi(attrNameNoLng, filterLabel, filterValueActual);
      // Hide non-default size systems initially for groups with multiple attributes.
      if (Object.keys(group.attributes).length > 1 && group.defaultOpen !== attrNameNoLng) {
        filterLi.classList.add('grouphide');
      }
      filterLi.setAttribute('data-group', group.title);

      if (mainFilterValuesUlMainPage) {
        mainFilterValuesUlMainPage.append(filterLi);
        // Clone and append to mainFilterValuesUl
        mainFilterValuesUl.append(filterLi.cloneNode(true));
      } else {
        mainFilterValuesUl.append(filterLi);
      }
      // Add to filter chips if enabled.
      if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
        if (attrNameNoLng === plpFilterChipsAttr?.toLowerCase()) {
          appendToFilterChipsDiv(filterLi.cloneNode(true), gtmFilterTitle, attrNameNoLng);
        }
      }
    });
  }
}

/**
 * Setup filters for the main page.
 */
function setupMainPageFilters(response, mainPageFilters, filterValuesPopupTitle, filterTitle) {
  const { sizeGroups } = sizeGroupConfig;
  const gtmFilterTitle = filterTitle;

  // Create the main filter list item.
  const mainFiltersLi = document.createElement('li');
  mainFiltersLi.setAttribute('aria-label', filterTitle);
  mainFiltersLi.setAttribute('data-attribute', SIZE_GROUPING);

  // Add a title span for the main filter list.
  const mainLiTitleSpan = document.createElement('span');
  mainLiTitleSpan.classList.add('main-filter-title-span');
  mainLiTitleSpan.innerHTML = filterTitle;
  mainFiltersLi.append(mainLiTitleSpan);

  // Open the filter values popup on click.
  mainFiltersLi.addEventListener('click', () => {
    filterValuesPopupTitle.innerHTML = filterTitle;
    showFilterValues(mainFiltersLi); // show filter values popup
  });

  // Create another UL for the main page filters.
  const mainFilterValuesUl = document.createElement('ul');
  mainFilterValuesUl.classList.add('filters-values-ul');

  const mainFilterValuesUlMainPage = document.createElement('ul');
  mainFilterValuesUlMainPage.classList.add('filters-values-ul');

  sizeGroups.forEach((group) => {
    // Check if the group has valid attributes before processing.
    const hasValidAttributes = Object.entries(group.attributes).some(([, attrNameNoLng]) => {
      const attributeName = getAttributeNameByPage(attrNameNoLng);
      return hasValue(response.results[0].facets[attributeName]);
    });
    if (!hasValidAttributes) {
      return;
    }
    // Create the main group list item
    const groupLi = createSizeGroupListItem(group, mainFilterValuesUlMainPage, 'click');

    // Clone and append with accordion handling
    const clonedGroupLi = groupLi.cloneNode(true);
    clonedGroupLi.addEventListener('click', handleGroupSizeAccordion);
    mainFilterValuesUl.append(clonedGroupLi);

    // Check if the group has multiple attributes for subgroups
    if (Object.keys(group.attributes).length > 1) {
      // Dynamically handle subgroups
      const subGroupLi = createSizeToggle(group, mainFilterValuesUlMainPage, 'click');
      mainFilterValuesUlMainPage.append(subGroupLi);

      const clonedSubGroupLi = subGroupLi.cloneNode(true);
      clonedSubGroupLi
        .querySelectorAll('.group-filter-title-span')
        .forEach((span) => {
          span.addEventListener('click', handleSizeToggle);
        });
      mainFilterValuesUl.append(clonedSubGroupLi);
    }

    // Process all attributes in the group
    Object.entries(group.attributes).forEach(([, attrNameNoLng]) => {
      processGroupAttributes(
        response,
        attrNameNoLng,
        group,
        mainFilterValuesUl,
        gtmFilterTitle,
        mainFilterValuesUlMainPage,
      );

      // Handle filter chips dynamically if enabled
      if (
        plpFilterChipsEnabled
        && plpFilterChipsEnabled !== 'false'
        && attrNameNoLng === plpFilterChipsAttr
        && plpFilterChipsAttr.toLowerCase()
      ) {
        const filterChipsDiv = document.querySelector('.filter-chips ul');
        filterChipsDiv.addEventListener('click', (e) => {
          e.stopImmediatePropagation();
          handleFilterClick(e, gtmFilterTitle);
          e.stopPropagation();
        });
      }
    });
  });

  // Attach event listeners for filtering
  mainFilterValuesUlMainPage.addEventListener('click', (e) => handleFilterClick(e, gtmFilterTitle));
  mainFilterValuesUl.addEventListener('click', (e) => handleFilterClick(e, gtmFilterTitle));

  // Add search functionality to filter lists.
  createSearchBox(mainFilterValuesUlMainPage);
  createSearchBox(mainFilterValuesUl);

  // Clone and append the main filter for display on the main page.
  const mainFilterLiClone = mainFiltersLi.cloneNode(true);
  mainFilterLiClone.appendChild(mainFilterValuesUlMainPage);
  mainFilterLiClone.classList.add('page-filters');
  // Limit the number of visible filters and toggle display on click.
  if (mainPageFilters.querySelectorAll('li.page-filters').length > 4) {
    mainFilterLiClone.classList.add('hide');
  }
  mainFilterLiClone.addEventListener('click', (event) => {
    const { target } = event;
    if (target.classList.contains('size-toggle') || target.classList.contains('skip-filter')) {
      return;
    }
    toggleMainPageFilterValues(mainFilterLiClone);
  });
  mainPageFilters.append(mainFilterLiClone);
  // Create a span element to display selected filter values.
  const spanMainFilterChoseValues = document.createElement('span');
  spanMainFilterChoseValues.classList.add('main-filter-chose-values');

  return [mainFiltersLi, mainFilterValuesUl, spanMainFilterChoseValues];
}

/**
 * Setup filters for the popup.
 */
function setupPopupFilters(response, attributeName, filterTitle) {
  const { sizeGroups } = sizeGroupConfig;
  const attributeNameWithoutLanguage = attributeName
    .replace(`.${productListingLanguage}`, '')
    .trim();

  const sizesElement = document.querySelector(`.filters-body-main-ul [data-attribute="${SIZE_GROUPING}"]`);
  if (sizesElement) {
    const facetFilters = sizeGroups.reduce((acc, group) => {
      Object.entries(group.attributes).forEach(([, attrNameNoLng]) => {
        const filterValues = response.results[0].facets[`${attrNameNoLng}.${productListingLanguage}`];
        if (filterValues) {
          acc[attrNameNoLng] = acc[attrNameNoLng] || [];
          acc[attrNameNoLng].push(...Object.keys(filterValues));
        }
      });
      return acc;
    }, {});

    const shouldHideFilters = Object.keys(facetFilters).length < 1
    && !filterContainsActiveItem(attributeNameWithoutLanguage);
    document.querySelectorAll(`[data-attribute="${SIZE_GROUPING}"]`).forEach((filter) => {
      filter.classList.toggle('hide', shouldHideFilters);
    });
    if (!shouldHideFilters) {
      updateGroupFilters(response, sizeGroups, productListingLanguage, facetFilters, SIZE_GROUPING);
    }
    return;
  }

  const mainUL = document.querySelector('.filters-body-main-ul');
  const attrToAdd = document.createElement('li');
  const popupTitle = document.querySelector(
    '#filters-values-popup-title .filters-title',
  );
  attrToAdd.addEventListener('click', () => {
    popupTitle.innerHTML = filterTitle;
    showFilterValues(attrToAdd);
  });

  const mainLiSortSpan = document.createElement('span');
  mainLiSortSpan.classList.add('main-filter-title-span');
  mainLiSortSpan.innerHTML = filterTitle;

  const spanSortChoseValues = document.createElement('span');
  spanSortChoseValues.classList.add('main-filter-chose-values');

  const filterUl = document.createElement('ul');
  filterUl.classList.add('filters-values-ul');
  const attrDataName = attributeNameWithoutLanguage;
  attrToAdd.setAttribute('aria-label', filterTitle);
  attrToAdd.setAttribute('data-attribute', SIZE_GROUPING);
  attrToAdd.appendChild(mainLiSortSpan);
  attrToAdd.appendChild(spanSortChoseValues);
  attrToAdd.appendChild(filterUl);
  mainUL.appendChild(attrToAdd);

  const filterValues = response.results[0].facets[attributeName];
  // iterate all of the arrays within the response to merge the facets and its values
  response.results.forEach((result) => {
    const tempAttributeName = attributeName;
    const filterValuesFromResult = result.facets[tempAttributeName];
    if (filterValuesFromResult !== undefined) {
      Object.keys(filterValuesFromResult).forEach((filterVal) => {
        if (filterValues && filterValues[filterVal] === undefined) {
          filterValues[filterVal] = filterValuesFromResult[filterVal];
        }
      });
    }
  });

  const value = response.results[0].userData[0].facets_config[attributeNameWithoutLanguage];
  if (
    value !== undefined
    && filterValues !== undefined
  ) {
    document
      .querySelectorAll(`[data-attribute="${filterTitle}"]`)
      .forEach((filter) => {
        if (filter.parentElement.classList.contains('filters-body')) {
          if (
            Array.from(filter.parentElement.children).indexOf(filter)
            < MAX_FILTER_ITEMS
            || filter.parentElement.querySelectorAll('li.page-filters:not(.hide)').length < MAX_FILTER_ITEMS
          ) {
            filter.classList.remove('hide');
          }
        } else {
          filter.classList.remove('hide');
          if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
            if (
              filter.classList.contains('filter-chips.hide')
              && attributeNameWithoutLanguage
              === (plpFilterChipsAttr && plpFilterChipsAttr.toLowerCase())
            ) {
              filter.classList.remove('hide');
            }
          }
        }
      });
    const facetFilters = {};

    Object.entries(filterValues).forEach(([filterValue]) => {
      const filterValueLower = filterValue;
      if (facetFilters[attributeNameWithoutLanguage] === undefined) {
        facetFilters[attributeNameWithoutLanguage] = [filterValueLower];
      } else {
        facetFilters[attributeNameWithoutLanguage].push(filterValueLower);
      }
    });

    let allAttributeUls = document.querySelectorAll(
      `[data-attribute="${filterTitle}"] .filters-values-ul`,
    );
    if (!document.querySelector(`[data-attribute="${filterTitle}"]`)) {
      allAttributeUls = document.querySelectorAll(
        `[data-attribute="${filterTitle}"] .filters-values-ul`,
      );
    }

    allAttributeUls.forEach((ul) => {
      // Proceed if the facetFilters is not empty.
      if (
        Object.keys(facetFilters).length > 0
        && ul.querySelectorAll('li').length < facetFilters[attrDataName].length
      ) {
        const activeSelections = Array.from(
          ul.querySelectorAll('.active-checkbox, .active-checkbox-price-range'),
        ).map((li) => ({
          attributeName: li.getAttribute('data-filter-attr-name'),
          attributeValue: li.getAttribute('data-filter-attr-value'),
        }));
        ul.innerHTML = '';
        const gtmFilterTitle = value.label?.en;
        const mainFilterValuesUl = ul;

        // Process each size group.
        sizeGroups.forEach((group) => {
          const groupLi = createSizeGroupListItem(group, mainFilterValuesUl, 'click');
          mainFilterValuesUl.append(groupLi);

          // Dynamically create subgroups for groups with multiple attributes
          if (Object.keys(group.attributes).length > 1) {
            const subGroupLi = createSizeToggle(group, mainFilterValuesUl, 'click');
            mainFilterValuesUl.append(subGroupLi);
          }

          // Process and display sorted filter values for each attribute.
          Object.entries(group.attributes).forEach(([, attrNameNoLng]) => {
            // Skip hidden filters based on configuration.
            const idx = getResultsIndex(response, attributeName);
            const values = response.results[idx].facets[`${attrNameNoLng}.${productListingLanguage}`];
            if (hasValue(values)) {
              processGroupAttributes(
                response,
                attrNameNoLng,
                group,
                mainFilterValuesUl,
                gtmFilterTitle,
              );

              mainFilterValuesUl.addEventListener('click', (e) => handleFilterClick(e, gtmFilterTitle));
            } else {
              const filterLi = document.createElement('li');
              filterLi.classList.add('filter-item', 'no-records', 'hide');
              filterLi.setAttribute('data-group', group.title);
              filterLi.setAttribute('data-filter-attr-name', attrNameNoLng);
              const countSpan = document.createElement('span');
              countSpan.classList.add('filter-count');
              countSpan.innerHTML = placeholders.searchPlaceholder || 'No Results';
              filterLi.append(countSpan);
              if (Object.keys(group.attributes).length > 1 && group.defaultOpen !== attrNameNoLng) {
                filterLi.classList.add('grouphide');
              }
              mainFilterValuesUl.append(filterLi);
            }
          });
        });

        createSearchBox(mainFilterValuesUl);

        activeSelections.forEach((attr) => {
          ul.querySelector(
            `[data-filter-attr-name='${attr.attributeName}'][data-filter-attr-value='${attr.attributeValue}']`,
          ).classList.add('active-checkbox');
        });
      }
    });
  }
  editFilterValuesAtTheMainContainer();
  buildChosenFilterValuesOnMainPage();
}

/**
 * Filters and organizes size group filters for product listing pages.
 *
 * @param {Object} response - The API response containing filter data.
 * @param {string} attributeName - The attribute name for filters.
 * @param {HTMLElement} [mainPageFilters] - The container element for main page filters.
 * @param {HTMLElement} [filterValuesPopupTitle] - The element where filter title is displayed.
 */
function sizeGroupFilter(response, attributeName, mainPageFilters = '', filterValuesPopupTitle = '') {
  const filterTitle = placeholders.groupSizeFilterTitle || 'Sizes';
  if (mainPageFilters) {
    return setupMainPageFilters(response, mainPageFilters, filterValuesPopupTitle, filterTitle);
  }
  return setupPopupFilters(response, attributeName, filterTitle);
}

/**
 * Build all filters from the response, chosen filters will be rewritten with the new values
 *
 * @param response
 */
async function buildAllFilters(response) {
  let sizeGroupFilterCalled = false;
  const promises = Object.entries(response.results[0].renderingContent.facetOrdering.facets.order)
    .map(async ([, attributeName]) => {
      await performanceYield();
      const attributeNameWithoutLanguage = attributeName.replace(`.${productListingLanguage}`, '').trim();
      const value = response.results[0].userData[0].facets_config[attributeNameWithoutLanguage];

      let filterValues = response.results[0].facets[attributeName];

      if (sizeGroupConfig.displaySizeGrouping === 'true' && hasValue(filterValues)) {
        if (sizeGroupConfig.allSizeAttributes.includes(attributeNameWithoutLanguage)) {
          if (!sizeGroupFilterCalled) {
            sizeGroupFilterCalled = true;
            sizeGroupFilter(response, attributeName);
          }
          return;
        }
      }
      // iterate all of the arrays within the response to merge the facets and its values
      response.results.forEach((result) => {
        let tempAttributeName = attributeName;
        if (attributeNameWithoutLanguage === COLOR_ATTRIBUTE) {
          tempAttributeName = `${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`;
          filterValues = response.results[0].facets[tempAttributeName];
        }
        const filterValuesFromResult = result.facets[tempAttributeName];
        if (filterValuesFromResult !== undefined) {
          Object.keys(filterValuesFromResult).forEach((filterVal) => {
            if (filterValues && filterValues[filterVal] === undefined) {
              filterValues[filterVal] = filterValuesFromResult[filterVal];
            }
          });
        }
      });
      const hiddenFilterList = productListingConfig['algolia-hidden-filters']?.split(',');
      if (value !== undefined && filterValues !== undefined
    && (hiddenFilterList === undefined || !hiddenFilterList.includes(value.label[productListingLanguage]))) {
        if (Object.keys(filterValues).length <= 1
      && attributeNameWithoutLanguage !== PRICE_ATTRIBUTE
      && !filterContainsActiveItem(attributeNameWithoutLanguage)) {
          document.querySelectorAll(`[data-attribute="${attributeNameWithoutLanguage}"]`).forEach((filter) => {
            if (attributeNameWithoutLanguage !== PRICE_ATTRIBUTE) {
              filter.classList.add('hide');
              if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
                if (filter.classList.contains('filter-chips') && attributeNameWithoutLanguage === (plpFilterChipsAttr && plpFilterChipsAttr.toLowerCase())) {
                  filter.classList.add('hide');
                }
              }
            }
          });
        } else {
          document.querySelectorAll(`[data-attribute="${attributeNameWithoutLanguage}"]`).forEach((filter) => {
            if (filter.parentElement.classList.contains('filters-body')) {
              if (Array.from(filter.parentElement.children).indexOf(filter) < MAX_FILTER_ITEMS
            || filter.parentElement.querySelectorAll('li.page-filters:not(.hide)').length < MAX_FILTER_ITEMS) {
                filter.classList.remove('hide');
              }
            } else {
              filter.classList.remove('hide');
              if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
                if (filter.classList.contains('filter-chips.hide') && attributeNameWithoutLanguage === (plpFilterChipsAttr && plpFilterChipsAttr.toLowerCase())) {
                  filter.classList.remove('hide');
                }
              }
            }
          });
          const facetFilters = {};

          if (attributeNameWithoutLanguage === PRICE_ATTRIBUTE) {
            const pricefiltersPopup = document.querySelector('.filters-body .page-filters[data-attribute="final_price"]');
            if (plpFilterVariation && plpFilterVariation !== 'false') {
              pricefiltersPopup?.addEventListener('click', () => {
                pricefiltersPopup.classList.add('active-price-slider');
                document.querySelector('.filters-body .price-buttons-container').classList.remove('hide-price-button');
              });
            } else {
              const priceRanges = getRangeValues(
                response.results[0].userData[0].facets_config[attributeNameWithoutLanguage].widget?.config?.granularity,
                filterValues,
              );
              Object.entries(priceRanges).forEach(([filterValue]) => {
                if (facetFilters[attributeNameWithoutLanguage] === undefined) {
                  facetFilters[attributeNameWithoutLanguage] = [filterValue];
                } else {
                  facetFilters[attributeNameWithoutLanguage].push(filterValue);
                }
              });
            }
          } else if (attributeNameWithoutLanguage === COLOR_ATTRIBUTE) {
            const colorFilterattributeNameWithoutLanguage = `${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`;
            Object.entries(filterValues).forEach(([filterValue]) => {
              const filterValueLower = filterValue.toLowerCase();
              if (facetFilters[colorFilterattributeNameWithoutLanguage] === undefined) {
                facetFilters[colorFilterattributeNameWithoutLanguage] = [filterValueLower];
              } else {
                facetFilters[colorFilterattributeNameWithoutLanguage].push(filterValueLower);
              }
            });
          } else {
            Object.entries(filterValues).forEach(([filterValue]) => {
              const filterValueLower = filterValue;
              if (facetFilters[attributeNameWithoutLanguage] === undefined) {
                facetFilters[attributeNameWithoutLanguage] = [filterValueLower];
              } else {
                facetFilters[attributeNameWithoutLanguage].push(filterValueLower);
              }
            });
          }
          const attrDataName = attributeNameWithoutLanguage;
          let allAttributeUls = document.querySelectorAll(`[data-attribute="${attrDataName}"] .filters-values-ul`);
          if (!document.querySelector(`[data-attribute="${attrDataName}"]`)) {
          // doesnt exist, create new
            const mainUL = document.querySelector('.filters-body-main-ul');
            const filterTitle = value.label[productListingLanguage];
            const attrToAdd = document.createElement('li');
            const filterValuesPopupTitle = document.querySelector('#filters-values-popup-title .filters-title');
            attrToAdd.addEventListener('click', () => {
              filterValuesPopupTitle.innerHTML = value.label[productListingLanguage];
              showFilterValues(attrToAdd); // show filter values popup
            });

            const mainLiSortSpan = document.createElement('span');
            mainLiSortSpan.classList.add('main-filter-title-span');
            mainLiSortSpan.innerHTML = filterTitle;

            const spanSortChoseValues = document.createElement('span');
            spanSortChoseValues.classList.add('main-filter-chose-values');

            const filterUl = document.createElement('ul');
            filterUl.classList.add('filters-values-ul');

            attrToAdd.setAttribute('aria-label', filterTitle);
            attrToAdd.setAttribute('data-attribute', attrDataName);
            attrToAdd.appendChild(mainLiSortSpan);
            attrToAdd.appendChild(spanSortChoseValues);
            attrToAdd.appendChild(filterUl);
            mainUL.appendChild(attrToAdd);

            allAttributeUls = document.querySelectorAll(`[data-attribute="${attrDataName}"] .filters-values-ul`);
          }
          allAttributeUls.forEach((ul) => {
            rebuildMissingFilters(response, facetFilters, attrDataName, value, ul);
          });

          document.querySelectorAll(`[data-attribute="${attributeNameWithoutLanguage}"] ul > li`).forEach((filterLi) => {
            if (!filterLi.getAttribute('data-filter-attr-name')) {
              return;
            }
            const attrName = filterLi.getAttribute('data-filter-attr-name').toLowerCase();
            const attrValue = filterLi.getAttribute('data-filter-attr-value').toLowerCase();
            let idx;
            if (attributeName.includes(COLOR_ATTRIBUTE)) {
              idx = getResultsIndex(response, `${attributeName}.value`);
            } else {
              idx = getResultsIndex(response, attributeName);
            }

            if (
              facetFilters[attrName] === undefined
          || !facetFilters[attrName].map((item) => item.toLowerCase()).includes(attrValue)
            ) {
              if (document.querySelectorAll(`.filters-body-main-ul [data-attribute="${attributeNameWithoutLanguage}"] ul > li.active-checkbox`).length === 0) {
                if (attributeNameWithoutLanguage !== 'final_price') {
                  filterLi.classList.add('hide');
                }
              }
            } else if (attributeNameWithoutLanguage === PRICE_ATTRIBUTE) {
              const priceRanges = getRangeValues(
                response.results[idx].userData[0].facets_config[attributeNameWithoutLanguage].widget?.config?.granularity,
                response.results[idx].facets[`${getAttributeNameByPage(attributeNameWithoutLanguage)}`],
              );
              filterLi.querySelector('.filter-count').innerHTML = `(${priceRanges[attrValue]})`;
              filterLi.classList.remove('hide');
              const priceSplit = attrValue.split(' - ');
              if (urlPrice && priceSplit[0].replace(/ /g, '') === urlPrice.split(' - ')[0]) {
                filterLi.classList.add('active-checkbox-price-range');
              }
            } else if (attributeNameWithoutLanguage === RATING_ATTRIBUTE) {
              filterLi.querySelector(`.rating-value-${attrValue}`).innerHTML = `(${response.results[0].facets[`${getAttributeNameByPage(attributeNameWithoutLanguage)}`][attrValue]})`;
              filterLi.classList.remove('hide');
            } else if (attributeNameWithoutLanguage === COLOR_ATTRIBUTE) {
              const facets = response.results[idx].facets[`${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`];
              const filterColorCount = facets[attrValue] || facets[attrValue.charAt(0).toUpperCase() + attrValue.slice(1)] || facets[attrValue.toUpperCase()];
              filterLi.querySelector('.filter-count').innerHTML = `(${filterColorCount})`;
              filterLi.classList.remove('hide');
            } else {
              const lowercaseFacets = Object.fromEntries(
                Object.entries(response.results[idx].facets[attributeName])
                  .map(([key, val]) => [key.toLowerCase(), val]),
              );
              filterLi.querySelector('.filter-count').innerHTML = `(${Object.keys(lowercaseFacets[attrValue]).length >= 1 ? lowercaseFacets[attrValue].value : lowercaseFacets[attrValue]})`;
              filterLi.classList.remove('hide');
            }
          });
        }
      } else if (document.querySelector(`[data-attribute="${attributeNameWithoutLanguage}"]`) !== null) {
        document.querySelectorAll(`[data-attribute="${attributeNameWithoutLanguage}"]`)
          .forEach((filterLi) => {
            filterLi.classList.add('hide');
          });
      }
      if (response.results[0]) {
        const params = response.results[0].params.split('&');
        const facetsApplied = Object.fromEntries(params.map((item) => item.split('='))).facetFilters;
        if (facetsApplied) {
          JSON.parse(decodeURIComponent(facetsApplied)).forEach((subArr) => {
            subArr.forEach((facet) => {
              const facetSplit = facet.split(':');
              if (facetSplit[0].includes(COLOR_ATTRIBUTE)) {
                document.querySelectorAll(`[data-filter-attr-name="${facetSplit[0]}"][data-filter-attr-value="${facetSplit[1].toLowerCase()}"]`).forEach((li) => {
                  li.classList.add('active-checkbox');
                  if (li.parentElement.closest('li')) {
                    li.parentElement.closest('li').classList.remove('hide');
                  }
                });
              } else if (facetSplit[0] === PRICE_ATTRIBUTE) {
                document.querySelectorAll(`[data-filter-attr-name="${facetSplit[0]}"][data-filter-attr-value^="${facetSplit[1]}"]`).forEach((li) => {
                  li.classList.add('active-checkbox-price-range');
                  if (li.parentElement.closest('li')) {
                    li.parentElement.closest('li').classList.remove('hide');
                  }
                });
              } else {
                document.querySelectorAll(`[data-filter-attr-name="${facetSplit[0].replace(`.${productListingLanguage}`, '')}"][data-filter-attr-value="${decodeURIComponent(facetSplit[1].toLowerCase())}"]`).forEach((li) => {
                  li.classList.add('active-checkbox');
                  if (li.parentElement.closest('li')) {
                    li.parentElement.closest('li').classList.remove('hide');
                  }
                  if (document.querySelector(`div.filter-chips ul li[data-filter-attr-name="${plpFilterChipsAttr}"]`) && li.parentElement.closest('div').className === 'filter-chips') {
                    li.parentElement.closest('div').classList.remove('hide');
                  }
                });
              }
            });
          });
        }
      }
      if (sizeGroupConfig.displaySizeGrouping === 'true' && !sizeGroupFilterCalled) {
        sizeGroupFilterCalled = true;
        sizeGroupFilter(response, attributeName);
      }
      editFilterValuesAtTheMainContainer();
      buildChosenFilterValuesOnMainPage();
      if (plpFilterVariation && plpFilterVariation !== 'false') {
        letterDivider();
      }
    });

  await Promise.all(promises);
  await hideExtraFilters();
}

function checkUrlFacets() {
  const urlKey = buildUrlKey().replace(EXCLUDED_CATEGORIES.join(','), '').replace(/\/{1,2}$/, '');
  const [, facetsFound] = urlKey.split(/(\/--.+)/).filter(Boolean);
  const facetsFoundArray = facetsFound ? facetsFound.split('/--').filter(Boolean) : [];

  facetsFoundArray.forEach((facet) => {
    const [attrName, ...values] = facet.split(/-(?=.+)/);

    values.forEach((value) => {
      let filterValue = value;
      if (PRICE_ATTRIBUTE.includes(attrName)) {
        if (plpFilterVariation && plpFilterVariation !== 'false') {
          urlPrice = `${updatedMinPrice()} - ${updatedMaxPrice()}`;
        } else {
          urlPrice = `${value} - ${parseInt(filterValue, 10) + 5}`;
        }
      } else if (RATING_ATTRIBUTE.includes(attrName)) {
        const filterValueObject = findValueInObject(filterValue);
        if (filterValueObject) {
          filterValue = filterValueObject[productListingLanguage];
        }
        filterValue = filterValue.replace(/__/g, '%20');
        urlFacets.push(`${attrName}-${filterValue}`);
      } else {
        const filterValueObject = findValueInObject(filterValue);
        if (filterValueObject) {
          filterValue = filterValueObject[productListingLanguage];
        }
        if (!SIZE_ATTRIBUTE.includes(attrName)) {
          filterValue = filterValue.replace(/__/g, '%20');
        }
        const encodedValue = safeEncodeURIComponent(filterValue.replace(/_/g, '%2D'));
        urlFacets.push(`${attrName}-${encodedValue}`);
        urlFacets.push(`${attrName}-${safeEncodeURIComponent(filterValue.replace(/_/g, '%2F'))}`);
      }
    });
  });
}

function removeDuplicatesFromRequests(data) {
  const params = new URLSearchParams(data.requests[0].params);
  const facetFilters = params.get('facetFilters');
  let uniqueFacetFilters = [];
  if (facetFilters && facetFilters !== '[]') {
    const parsedFilters = JSON.parse(facetFilters);
    uniqueFacetFilters = parsedFilters.map((filters) => [...new Set(filters.map((str) => {
      const splitStr = decodeURIComponent(str.trim()).split(':');
      return `${splitStr[0]}:${splitStr[1].replace(/[_/]/g, '-')}`;
    }).filter((str) => !/[\u0600-\u06FF]/.test(str)))]);
  }
  return uniqueFacetFilters;
}

/**
 * Build on scroll datalayerViewItemListEvent from the response
 */
// Initialize a counter to keep track of revealed elements
const batchSize = window.innerWidth < 768 ? 2 : 4;

function handleViewListEventsDLTrigger(response) {
  const totalProducts = response?.results?.[0]?.hits || []; // Array of all products
  totalProductsListCount = response?.results?.[0]?.nbHits || null; // Total number of products
  let batchStartIndex = 0; // Start index for the current batch
  let loadingInProgress = false; // Prevent multiple simultaneous batch loads
  let observer;

  // Function to reveal a batch of items
  function revealBatch() {
    if (loadingInProgress) {
      return; // Prevent loading if already in progress
    }

    loadingInProgress = true; // Indicate that a batch is being loaded

    const batchEndIndex = batchStartIndex + batchSize;
    const batchElements = totalProducts.slice(batchStartIndex, batchEndIndex); // Get current batch

    if (batchElements.length === 0) {
      loadingInProgress = false;
      return; // No more items to load
    }

    // Trigger the data layer event for the current batch
    datalayerViewItemListEvent(batchElements, insightsQueryId, totalProductsListCount);

    // Update start index for the next batch
    batchStartIndex += batchSize;

    // Find the last product element in the current batch
    const lastProductElement = document.querySelector(`.product-item[data-id="${batchElements[batchElements.length - 1].sku}"]`);
    if (lastProductElement) {
      observer.observe(lastProductElement); // Observe the last product in the current batch
    }

    loadingInProgress = false; // Reset the loading flag once the batch is revealed
  }

  // Set up IntersectionObserver to trigger when the bottom of the last product of the batch reaches the bottom of the viewport
  // eslint-disable-next-line no-shadow
  observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      // Check if the bottom of the last product of the current batch crosses the bottom of the viewport
      if (entry.isIntersecting && !loadingInProgress) {
        revealBatch(); // Trigger loading the next batch
        observer.unobserve(entry.target); // Unobserve the current element to avoid multiple triggers
      }
    });
  }, {
    root: null, // Use the viewport as the root
    threshold: 0.9, // Trigger as soon as the element enters the viewport
    rootMargin: '0px 0px -100px 0px', // Trigger when the bottom of the last product is 10px from the bottom of the viewport
  });

  // Initial batch load when the page loads
  if (totalProducts.length > 0) {
    revealBatch(); // Load the first batch

    // Observe the last product of the first batch for the next trigger
    const firstBatchLastElement = document.querySelector(`.product-item[data-id="${totalProducts[batchSize - 1]?.sku}"]`);
    if (firstBatchLastElement) {
      observer.observe(firstBatchLastElement); // Observe the last product of the first batch
    }
  }
}

/**
 * Build checked filters from the response
 */
async function makeRequestToAlgolia(replaceProducts = true) {
  showLoader();
  if (replaceProducts) {
    productListingPage = 0;
  }
  checkUrlFacets();
  const data = await buildAlgoliaRequest();
  facetFiltersDatalayer = removeDuplicatesFromRequests(data);

  let response;
  if (searchTerm) {
    response = await getFilteredProducts(data.requests);
  } else if (promotionId) {
    response = await getPromotionProducts(data.requests);
  } else {
    response = await getCategoryProducts(data.requests);
  }
  if (
    response.results[0].facets === undefined
  || response.results[0].userData[0] === undefined
  ) {
    noProductsFound();
  }
  buildHits(response, { replace: replaceProducts });
  updateWishlistIcons();
  updatePageLoader(response, placeholders, 'loadMore', replaceProducts);
  buildAllFilters(response).then(() => {
    buildCheckedFilters(response);
    // trigger DL for more loaded products
    handleViewListEventsDLTrigger(response);
    dataLayerViewListEvents(response);
  });
  urlPrice = '';
  hideLoader();

  // postJSON(algoliaUrl, data)
  //   .then((response) => {
  //     if (
  //       response.results[0].facets === undefined
  //       || response.results[0].userData[0] === undefined
  //     ) {
  //       noProductsFound();
  //     }
  //     buildHits(response, replaceProducts);
  //     dataLayerViewListEvents(response);
  //     updateWishlistIcons();
  //     updatePageLoader(response, placeholders, 'loadMore', replaceProducts);
  //     buildAllFilters(response);
  //     buildCheckedFilters(response);
  //     urlPrice = '';
  //     disableClearfilters();
  //     hideLoader();
  //   });
}

/**
 * Build the sorting filter
 *
 * @param response
 * @param filterValuesPopupTitle
 * @param changePopupTitle
 * @returns {HTMLLIElement}
 */
function buildSortFilter(
  response,
  filterValuesPopupTitle,
  changePopupTitle = false,
) {
  // create a li for sorting since it's separate from the other filters
  const sortingLabel = response.results[0].userData[0].sorting_label[productListingLanguage];
  const sortingLabelLi = document.createElement('li');
  sortingLabelLi.addEventListener('click', () => {
    if (changePopupTitle) {
      filterValuesPopupTitle.innerHTML = sortingLabel;
      showFilterValues(sortingLabelLi); // show filter values popup
    }
    if (plpFilterVariation && plpFilterVariation !== 'false') {
      document.querySelector('.filters-body .main-filter-title-span-default').innerHTML = '';
      document.querySelector('.filters-body .main-filter-title-span-default').innerHTML = `: ${document.querySelector('.filters-body-main-ul .main-filter-chose-values').innerHTML}`;
    }
  });
  sortingLabelLi.setAttribute('aria-label', sortingLabel);
  sortingLabelLi.setAttribute('data-attribute', 'sorting');

  const mainLiSortSpan = document.createElement('span');
  mainLiSortSpan.classList.add('main-filter-title-span');
  mainLiSortSpan.innerHTML = sortingLabel;
  sortingLabelLi.append(mainLiSortSpan);

  const mainLiTitleSpanDefault = document.createElement('span');
  mainLiTitleSpanDefault.classList.add('main-filter-title-span-default');
  if (plpFilterVariation && plpFilterVariation !== 'false') {
    mainLiSortSpan.append(mainLiTitleSpanDefault);
  }

  const spanSortChoseValues = document.createElement('span');
  spanSortChoseValues.classList.add('main-filter-chose-values');
  sortingLabelLi.append(spanSortChoseValues);

  const sortingOptionsUl = document.createElement('ul');
  sortingOptionsUl.classList.add('filters-values-ul');
  response.results[0].userData[0].sorting_options.forEach((sortingOption) => {
    const sortingOptionLabel = response.results[0].userData[0].sorting_options_config[sortingOption]
      .label[productListingLanguage];
    const sortingOptionsLi = document.createElement('li');
    sortingOptionsLi.setAttribute('aria-label', sortingOptionLabel);
    sortingOptionsLi.setAttribute('data-sorting-option', sortingOption);
    sortingOptionsLi.setAttribute('data-index', response.results[0].userData[0].sorting_options_config[sortingOption].index[productListingLanguage]);
    if (sortingOption === 'default') {
      sortingOptionsLi.classList.add('filter-radio-active');
      if (plpFilterVariation && plpFilterVariation !== 'false') {
        spanSortChoseValues.innerHTML = sortingOptionsLi.getAttribute('aria-label');
        mainLiTitleSpanDefault.innerHTML = `: ${sortingOptionsLi.getAttribute('aria-label')}`;
      }
    }
    sortingOptionsLi.classList.add('filter-item');
    sortingOptionsLi.classList.add('filter-radio');
    sortingOptionsLi.innerHTML = sortingOptionLabel;

    sortingOptionsLi.addEventListener('click', async (e) => {
      const dataSortingOption = sortingOptionsLi.getAttribute('data-sorting-option');
      document.querySelectorAll('[data-attribute="sorting"] ul li')
        .forEach((sortingLi) => {
          if (sortingLi.getAttribute('data-sorting-option') === dataSortingOption) {
            sortingLi.classList.add('filter-radio-active');
            if (plpFilterVariation && plpFilterVariation !== 'false') {
              spanSortChoseValues.innerHTML = sortingLi.innerHTML;
              mainLiTitleSpanDefault.innerHTML = `: ${sortingLi.innerHTML}`;
            }
          } else {
            sortingLi.classList.remove('filter-radio-active');
          }
        });
      await makeRequestToAlgolia();
      e.stopPropagation(); // prevent parent li click event
      // build Algolia request with the selected filter
      datalayerSortingEvent(dataSortingOption, buildUrlKey().split('/')?.pop());
    });

    sortingOptionsUl.append(sortingOptionsLi);
  });
  sortingLabelLi.append(sortingOptionsUl);

  return sortingLabelLi;
}

/**
 * Clear all filters
 */
async function clearAllFilters() {
  document.querySelectorAll('.filters-values-ul .filter-item')
    .forEach((filterItem) => {
    // remove active class from all filters
      filterItem.classList.remove('active-checkbox');
      // remove price range filter active class
      filterItem.classList.remove('active-checkbox-price-range');
    });
  document.querySelectorAll('.main-filter-chose-values')
    .forEach((filterChosenText) => {
    // remove all filter values from the main container
      if (!filterChosenText.closest('li[data-attribute="sorting"]')) {
        filterChosenText.innerHTML = '';
      }
    });
  if (plpFilterVariation && plpFilterVariation !== 'false') {
    resetPriceSlider();
  }
  window.history.replaceState({}, '', `${window.location.href.split('/--')[0]}${window.location.search}`);
  await makeRequestToAlgolia();
}

/**
 * Create filters on the main category page
 *
 * @param response
 * @param type
 * @param attrName
 * @param attrNameNoLng
 * @param sortedValues
 * @param sortBy
 * @param mainPageFilters
 * @param mainFiltersLi
 */
function createFilterOnMainPage(
  response,
  type,
  attrName,
  attrNameNoLng,
  sortedValues,
  sortBy,
  mainPageFilters,
  mainFiltersLi,
  gtmFilterTitle,
) {
  const mainFilterValuesUlMainPage = document.createElement('ul');
  mainFilterValuesUlMainPage.classList.add('filters-values-ul');

  let idx;
  if (attrNameNoLng.includes(COLOR_ATTRIBUTE)) {
    idx = getResultsIndex(response, `${getAttributeNameByPage(attrNameNoLng)}.label`);
  } else {
    idx = getResultsIndex(response, `${getAttributeNameByPage(attrName)}`);
  }

  switch (type) {
    case 'checkbox':
      buildCheckboxFilter(
        response,
        sortedValues,
        sortBy,
        attrNameNoLng,
        mainFilterValuesUlMainPage,
        gtmFilterTitle,
      );
      break;
    case 'range_checkbox':
      buildCheckboxPriceRangeFilter(
        response.results[idx].facets[attrName],
        response.results[idx].userData[0].facets_config[attrNameNoLng].widget?.config?.granularity,
        attrNameNoLng,
        mainFilterValuesUlMainPage,
        gtmFilterTitle,
      );
      break;
    case 'swatch_list':
      buildSwatcherFilter(
        sortedValues,
        attrNameNoLng,
        mainFilterValuesUlMainPage,
        gtmFilterTitle,
      );
      break;
    case 'star_rating':
      buildRatingFilters(
        sortedValues,
        attrNameNoLng,
        mainFilterValuesUlMainPage,
        gtmFilterTitle,
      );
      break;
    default:
      buildCheckboxFilter(
        response,
        sortedValues,
        sortBy,
        attrNameNoLng,
        mainFilterValuesUlMainPage,
        gtmFilterTitle,
      );
  }
  const mainFilterLiClone = mainFiltersLi.cloneNode(true);
  mainFilterLiClone.appendChild(mainFilterValuesUlMainPage);
  mainFilterLiClone.classList.add('page-filters');
  if (mainPageFilters.querySelectorAll('li.page-filters').length > 4) {
    mainFilterLiClone.classList.add('hide');
  }
  mainFilterLiClone.addEventListener('click', () => {
    toggleMainPageFilterValues(mainFilterLiClone); // show filter values popup
  });
  mainPageFilters.append(mainFilterLiClone);
}

async function getCategoryData() {
  const urlKey = buildUrlKey().replace(EXCLUDED_CATEGORIES.join(','), '').replace(/\/{1,2}$/, '').split('/--')[0];
  const categoryData = await fetchCategoriesByUrlKey([urlKey]);
  return categoryData;
}

async function buildCategoryPath(categoryData) {
  if (categoryData.commerce_categories.total_count) {
    Object.entries(categoryData.commerce_categories.items[0].breadcrumbs || []).forEach(([, cat]) => {
      categoryPath.push(encodeURIComponent(cat.category_gtm_name));
    });
    categoryPath.push(encodeURIComponent(categoryData.commerce_categories.items[0].gtm_name));
  } else if (!isOfferListing()) {
    await showCommerceErrorPage();
  }
}

async function getPreviewPreaccessData(categoryData) {
  const fields = [
    'preview_sd',
    'preview_ed',
    'preview_category_text',
    'preview_pdp_text',
    'preview_tier_type',
    'preaccess_sd',
    'preaccess_ed',
    'preaccess_tier_type',
  ];
  if (categoryData.commerce_categories.total_count > 0) {
    const item = categoryData.commerce_categories.items[0];
    const result = fields.reduce((acc, field) => {
      acc[field] = item[field] || null;
      return acc;
    }, {});

    return result;
  }
  return Object.fromEntries(fields.map((field) => [field, null]));
}

/**
 * Method to get and store category list name with path
 * and category id to local storage for datalayer.
 * - For PLP pages, adds the category list information.
 * - For SLP, adds the search results string along with referrer information.
 * @param {*} categoryData category response data
 */
function storeCategoryListData(categoryData) {
  const categoryListName = ['PLP'];
  if (isSearchPage() && document.referrer) {
    const referrerPath = new URL(document.referrer).pathname.replace(
      `/${productListingLanguage}/`,
      '/',
    );
    const category = (localStorage.getItem('categoryListName') || '').replace(
      /^(PLP)\|/,
      '',
    )?.split('|')[0];
    let referrerPageType = `${referrerPath.split('/')[1] || ''}`;
    if (referrerPath === '/') {
      referrerPageType = 'home';
    } else if (referrerPath.startsWith('/shop-')) {
      referrerPageType = `${category} PLP`;
    } else if (referrerPath.startsWith('/buy-')) {
      referrerPageType = category && !category.startsWith('Search') ? `${category} PDP` : 'PDP';
    }

    localStorage.setItem(
      'categoryListName',
      `Search Results Page on ${referrerPageType}`,
    );
    localStorage.setItem('categoryListId', '');
  } else {
    if (categoryData?.commerce_categories?.total_count) {
      Object.entries(
        categoryData.commerce_categories.items[0].breadcrumbs || [],
      ).forEach(([, cat]) => {
        categoryListName.push(cat.category_gtm_name);
      });
      categoryListName.push(categoryData.commerce_categories.items[0].gtm_name);
      const listName = localStorage.getItem('categoryListName');
      if (listName?.startsWith('bn_promo_')) {
        localStorage.setItem('categoryListName', `${listName}_${categoryListName.join('|')}`);
      } else {
        localStorage.setItem('categoryListName', categoryListName.join('|'));
      }
      localStorage.setItem(
        'categoryListId',
        categoryData?.commerce_categories?.items?.[0]?.id,
      );
    }
    categoryListName.shift();
  }
  return categoryListName;
}

function buildSubcategories(categoryData, headerDiv) {
  const plpSubcategories = document.createElement('div');
  plpSubcategories.classList.add('plp-subcategories');
  categoryData.commerce_categories.items[0].children.forEach((subcategory) => {
    const subcategoryDiv = document.createElement('a');
    subcategoryDiv.setAttribute('href', `/${productListingLanguage}/${subcategory.url_path}`);
    subcategoryDiv.classList.add('plp-subcategory');
    subcategoryDiv.innerHTML = subcategory.name;
    plpSubcategories.appendChild(subcategoryDiv);
  });

  headerDiv.append(plpSubcategories);
}

function scrollToSelectedCategory() {
  const selectedCategory = document.querySelector('.category-item.selected');
  if (selectedCategory) {
    selectedCategory.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}

async function getProductCategoryData() {
  let urlKey = buildUrlKey();
  let productCategory = await fetchCategoriesByUrlKey([urlKey]);
  let productCategoryData = productCategory?.commerce_categories?.items[0];

  // When the l5 category is selected we don't get parent categories, so here we remove children
  if (!productCategoryData || productCategoryData?.children?.length === 0) {
    const url = new URL(window.location.href);
    urlKey = url.pathname.split('/').filter(Boolean).slice(1, -1).join('/');
    productCategory = await fetchCategoriesByUrlKey([urlKey]);
    productCategoryData = productCategory?.commerce_categories?.items[0];
  }

  return productCategoryData;
}

async function buildProductCategorySection(plpHeader, productCategoryData, filterIconMobile) {
  const productCategoryContainer = document.createElement('div');
  productCategoryContainer.classList.add('product-category-container');

  const productCategoryFilter = document.createElement('div');
  productCategoryFilter.classList.add('product-category-filter');

  productCategoryFilter.append(filterIconMobile);

  const categoryContainer = document.createElement('div');
  categoryContainer.classList.add('category-container');

  const url = new URL(window.location.href);
  const lastFragment = new URL(url).pathname.split('/').filter(Boolean).pop();

  const viewAllLink = document.createElement('a');
  viewAllLink.classList.add('category-item');
  viewAllLink.setAttribute('href', `/${lang}/${productCategoryData.url_path}`);
  viewAllLink.textContent = placeholders.viewAll || 'View All';
  const viewAllText = document.createElement('div');
  viewAllText.classList.add('category-item-text');
  viewAllText.textContent = placeholders.viewAll || 'View All';

  if (productCategoryData?.url_path?.includes(lastFragment)) {
    viewAllLink.classList.add('selected');
  }
  categoryContainer.appendChild(viewAllLink);

  productCategoryData?.children?.forEach((subCategory) => {
    const categoryItem = document.createElement('a');
    categoryItem.classList.add('category-item');
    if (subCategory?.url_path?.includes(lastFragment) && !productCategoryData?.url_path?.includes(lastFragment)) {
      categoryItem.classList.add('selected');
    }
    const categoryItemText = document.createElement('div');
    categoryItemText.classList.add('category-item-text');

    categoryItem.href = `/${lang}/${subCategory.url_path}`;
    categoryItemText.innerHTML = subCategory?.name;

    categoryItem.appendChild(categoryItemText);
    categoryContainer.appendChild(categoryItem);
  });

  productCategoryContainer.appendChild(productCategoryFilter);
  productCategoryContainer.appendChild(categoryContainer);
  plpHeader.appendChild(productCategoryContainer);
  scrollToSelectedCategory();
}

async function buildFilters(plpHeader) {
  const sideBarNav = document.getElementsByClassName('sidebar-plp');
  const mainPageFilters = document.createElement('ul');
  mainPageFilters.classList.add('filters-body');

  // filters icon
  const filterIcon = document.createElement('li');
  filterIcon.classList.add('filters-icon');

  const allFiltersText = document.createElement('span');
  allFiltersText.classList.add('all-filters-text');
  allFiltersText.innerHTML = placeholders.plpAllFilters;
  filterIcon.appendChild(allFiltersText);

  filterIcon.addEventListener('click', () => {
    showFilters();
  });

  const filtersPopup = document.createElement('div');
  filtersPopup.classList.add('filters-popup');

  const filtersPopupHeaderContainer = document.createElement('div');
  filtersPopupHeaderContainer.classList.add('filters-popup-title-container');

  const filtersPopupTitleContainer = document.createElement('div');
  filtersPopupTitleContainer.setAttribute('id', 'filters-popup-title');
  filtersPopupTitleContainer.classList.add('filters-popup-title');

  const filtersPopupTitle = document.createElement('div');
  filtersPopupTitle.classList.add('filters-title');
  filtersPopupTitle.classList.add('filter-title-main');
  filtersPopupTitle.innerHTML = placeholders.plpFiltersAndSort;
  filtersPopupTitleContainer.append(filtersPopupTitle);

  const filtersPopupTitleClose = document.createElement('div');
  filtersPopupTitleClose.classList.add('filters-popup-title-close');
  filtersPopupTitleContainer.append(filtersPopupTitleClose);

  filtersPopupTitleClose.addEventListener('click', () => {
    hideFilters(); // hide filters popup
  });
  // create a li for filter values title
  const filterValuesTitleContainer = document.createElement('div');
  filterValuesTitleContainer.setAttribute('id', 'filters-values-popup-title');
  filterValuesTitleContainer.classList.add('filters-popup-title');
  filterValuesTitleContainer.classList.add('filters-popup-title-values');
  filterValuesTitleContainer.classList.add('hide');

  const filterValuesPopupTitle = document.createElement('div');
  filterValuesPopupTitle.classList.add('filters-title');
  filterValuesTitleContainer.append(filterValuesPopupTitle);

  const filterValuesPopupTitleClose = document.createElement('div');
  filterValuesPopupTitleClose.classList.add('filters-popup-title-close');
  filterValuesPopupTitleClose.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFilters();
    hideFilterValues(); // hide filters popup
  });
  filterValuesTitleContainer.append(filterValuesPopupTitleClose);

  const filterValuesBackChevron = document.createElement('div');
  filterValuesBackChevron.classList.add('filters-values-back-chevron');
  filterValuesTitleContainer.prepend(filterValuesBackChevron);

  filterValuesBackChevron.addEventListener('click', () => {
    hideFilterValues(); // hide filter values popup
  });

  filtersPopupHeaderContainer.append(filtersPopupTitleContainer);
  filtersPopupHeaderContainer.append(filterValuesTitleContainer);

  filtersPopup.append(filtersPopupHeaderContainer);

  // create a div container for all filters
  const filtersBodyContainer = document.createElement('div');
  filtersBodyContainer.classList.add('filters-body-container');

  const filterIconMobile = document.createElement('div');
  filterIconMobile.classList.add('filters-icon-mobile');

  // Create and append the text content
  const filterContent = placeholders.plpFiltersAndSort || 'Filters & Sort';
  const filterContentText = document.createElement('div');
  filterContentText.classList.add('filters-icon-mobile-text');
  filterContentText.innerHTML = filterContent;
  filterIconMobile.appendChild(filterContentText);

  filterIconMobile.addEventListener('click', () => {
    showFilters();
  });

  plpHeader.append(filtersPopup);
  if (!isSearchPage()) {
    let urlKey = buildUrlKey();
    let productCategory = await fetchCategoriesByUrlKey([urlKey]);
    let productCategoryData = productCategory?.commerce_categories?.items[0];
    // When the l5 category is slected we don't get parent categories so here removing children
    // to get l4 data
    if (productCategoryData.children.length === 0) {
      const url = new URL(window.location.href);
      urlKey = url.pathname.split('/').filter(Boolean).slice(1, -1).join('/');
      productCategory = await fetchCategoriesByUrlKey([urlKey]);
      productCategoryData = productCategory?.commerce_categories?.items[0];
    }

    const productCategoryContainer = document.createElement('div');
    productCategoryContainer.classList.add('product-category-container');

    const productCategoryFilter = document.createElement('div');
    productCategoryFilter.classList.add('product-category-filter');

    productCategoryFilter.append(filterIconMobile);

    const categoryContainer = document.createElement('div');
    categoryContainer.classList.add('category-container');

    const url = new URL(window.location.href);
    const lastFragment = new URL(url).pathname.split('/').filter(Boolean).pop();

    const viewAllLink = document.createElement('a');
    viewAllLink.classList.add('category-item');
    viewAllLink.setAttribute('href', `/${lang}/${productCategoryData.url_path}`);
    viewAllLink.textContent = placeholders.viewAll || 'View All';
    const viewAllText = document.createElement('div');
    viewAllText.classList.add('category-item-text');
    viewAllText.textContent = placeholders.viewAll || 'View All';

    if (productCategoryData.url_path.includes(lastFragment)) {
      viewAllLink.classList.add('selected');
    }
    categoryContainer.appendChild(viewAllLink);

    productCategoryData?.children?.forEach((subCategory) => {
      if (!subCategory?.name) return;

      const categoryItem = document.createElement('a');
      categoryItem.classList.add('category-item');
      if (subCategory.url_path.includes(lastFragment) && !productCategoryData.url_path.includes(lastFragment)) {
        categoryItem.classList.add('selected');
      }
      const categoryItemText = document.createElement('div');
      categoryItemText.classList.add('category-item-text');

      categoryItem.href = `/${lang}/${subCategory.url_path}`;
      categoryItemText.innerHTML = subCategory?.name;

      categoryItem.appendChild(categoryItemText);
      categoryContainer.appendChild(categoryItem);
    });

    productCategoryContainer.appendChild(productCategoryFilter);
    productCategoryContainer.appendChild(categoryContainer);
    plpHeader.appendChild(productCategoryContainer);

    // Chips will be created only for level 5
    if (productCategoryData?.children[0]?.level === 5) {
      filterContentText.classList.add('no-category-chips');
      await buildProductCategorySection(plpHeader, productCategoryData, filterIconMobile);
    }
  } else {
    // eslint-disable-next-line no-lonely-if
    if (!document.querySelector('.filters-icon-mobile')) {
      plpHeader.append(filterIconMobile);
    }
    if (filterContentText.classList.contains('no-category-chips')) {
      filterContentText.classList.remove('no-category-chips');
    }
  }
  plpHeader.append(filtersBodyContainer);
  const filterChips = document.createElement('div');
  if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
    filterChips.classList.add('filter-chips');
  }
  return {
    mainPageFilters,
    filterIcon,
    ...(sideBarNav ? { filterIconMobile } : {}),
    filtersPopup,
    filterValuesPopupTitle,
    filtersBodyContainer,
    filterChips,
  };
}

function decorateMetadata(categoryData) {
  // Content for meta tags
  const titleSuffix = placeholders.pageTitleSuffix || '';
  const title = categoryData.meta_title;
  const description = categoryData.meta_description;
  const keywords = categoryData.meta_keyword;

  // Set meta tags
  const metaTitle = document.querySelector('title');
  if (lang === 'ar') {
    metaTitle.innerText = titleSuffix ? `${titleSuffix} | ${title}` : title;
  } else {
    metaTitle.innerText = titleSuffix ? `${title} | ${titleSuffix}` : title;
  }
  const metaDescription = setMetaAttribute('description', description, metaTitle);
  setMetaAttribute('keywords', keywords, metaDescription);

  const metaOgTitle = setMetaAttribute('og:title', title, metaTitle, true);
  const metaOgDescription = setMetaAttribute('og:description', description, metaOgTitle, true);
  const metaTwitterTitle = setMetaAttribute('twitter:title', title, metaOgDescription);
  setMetaAttribute('twitter:description', description, metaTwitterTitle);
}

async function hasFilterChips(plpHeader) {
  const {
    filterChips,
  } = await buildFilters(plpHeader);
  const mainFilter = plpHeader.querySelector('.sticky-filters-container');
  plpHeader.classList.add('filter-chips-head');
  mainFilter.prepend(filterChips);
  return mainFilter;
}

async function handleResponse(response, categoryData) {
  const plpHeader = document.createElement('div');
  document.querySelector('main').prepend(plpHeader);
  plpHeader.className = 'section plp-header';
  if (
    response.results[0]?.facets === undefined
  || response.results[0]?.userData[0] === undefined
  || response.results[0]?.hits[0] === undefined
  ) {
    noProductsFound();
  } else {
    const {
      mainPageFilters,
      filterIcon,
      filterIconMobile,
      filtersPopup,
      filterValuesPopupTitle,
      filtersBodyContainer,
    } = await buildFilters(plpHeader);

    const productCategoryData = await getProductCategoryData();

    if (productCategoryData?.children[0]?.level !== 5) {
      plpHeader.append(filterIconMobile);
    }
    const plpCategoryTitle = document.createElement('h2');
    plpCategoryTitle.classList.add('plp-category-title');
    if (isOfferListing()) {
      const offerListTitle = document.querySelector('.section.algolia-product-listing-container .default-content-wrapper p');
      if (offerListTitle) {
        plpCategoryTitle.innerHTML = offerListTitle.innerHTML;
        offerListTitle.innerHTML = '';
      }
    } else if (categoryData) {
      plpCategoryTitle.innerHTML = categoryData.commerce_categories.items[0].name;
      buildSubcategories(categoryData, plpHeader);
      decorateMetadata(categoryData.commerce_categories.items[0], placeholders);
    } else if (isPromotionPage()) {
      plpCategoryTitle.innerHTML = `${placeholders.promotionProducts || 'Promotion:'} "${promotionTitle}"`;
    } else if (searchTerm.trim() !== '') {
      plpCategoryTitle.innerHTML = `${placeholders.searchResultsFor || 'Search results for'} "${searchTerm}"`;
    }

    const isDesktopView = window.matchMedia('(min-width: 1024px)');

    if (hasValue(plpPageTitleAboveSidebar)
      && plpPageTitleAboveSidebar === 'true'
      && !isSearchPage()
      && isDesktopView.matches) {
      const mainWrapper = document.querySelector('.main-wrapper');
      mainWrapper.classList.add('full-width-title');
      mainWrapper.prepend(plpCategoryTitle);
    } else {
      plpHeader.parentElement.prepend(plpCategoryTitle);
    }

    // main ul for filters
    const mainFiltersUl = document.createElement('ul');
    mainFiltersUl.classList.add('filters-body-main-ul');

    const sortingLabelLi = buildSortFilter(response, filterValuesPopupTitle, true);
    mainFiltersUl.append(sortingLabelLi);

    const sortingLabelLiMainPage = buildSortFilter(response, filterValuesPopupTitle);
    sortingLabelLiMainPage.setAttribute('data-attribute', 'sorting');
    sortingLabelLiMainPage.addEventListener('click', () => {
      toggleMainPageFilterValues(sortingLabelLiMainPage); // show filter values popup
      if (plpFilterVariation && plpFilterVariation !== 'false') {
        document.querySelectorAll('.filters-body .filter-item.filter-radio').forEach((item) => {
          if (item.classList.contains('filter-radio-active')) {
            document.querySelector('.filters-body-main-ul .main-filter-chose-values').innerHTML = document.querySelector('.filters-body .filter-item.filter-radio.filter-radio-active')?.innerHTML;
            document.querySelector('.filters-body .main-filter-title-span-default').innerHTML = `: ${document.querySelector('.filters-body .filter-item.filter-radio.filter-radio-active')?.innerHTML}`;
          }
        });
      }
    });
    sortingLabelLiMainPage.classList.add('page-filters');
    mainPageFilters.prepend(sortingLabelLiMainPage);

    const popupUlMenu = document.createElement('div');
    popupUlMenu.classList.add('filters-popup-overlay');
    document.body.append(popupUlMenu);

    // the filter container that gets sticky on scroll
    const stickyFiltersContainer = document.createElement('div');
    stickyFiltersContainer.className = 'sticky-filters-container sticky-element sticky-desktop';

    // wrap sticky content
    const stickyFiltersWrapper = document.createElement('div');
    stickyFiltersWrapper.classList.add('sticky-filters-wrapper');

    const stickyLogoContainer = document.createElement('div');
    stickyLogoContainer.classList.add('sticky-logo-container');
    const stickyLogoLink = document.createElement('a');
    stickyLogoLink.setAttribute('href', `/${productListingLanguage || 'en'}`);
    const logoOnStickyFilters = document.createElement('span');
    logoOnStickyFilters.classList.add('logo-on-sticky-filters');
    stickyLogoLink.append(logoOnStickyFilters);
    stickyLogoContainer.append(stickyLogoLink);

    const stickyFiltersRightPart = document.createElement('div');
    stickyFiltersRightPart.classList.add('sticky-right-part');

    // Wishlist icon
    const wishlistEl = document.createElement('span');
    wishlistEl.setAttribute('aria-label', 'wishlist-wrapper');
    wishlistEl.innerHTML = '<a href="#" title="My Wishlist" aria-label="My Wishlist"><span class="icon wishlist-icon"/></a>';
    wishlistEl.classList.add('wishlist-wrapper');

    // Minicart icon
    const cartEl = document.createElement('span');
    cartEl.setAttribute('aria-label', 'minicart-wrapper');
    cartEl.innerHTML = '<a href="#" title="Cart" aria-label="Cart" class="minicart-wrapper"><span class="minicart-quantity"></span><span class="icon cart-icon"/></a>';
    cartEl.classList.add('minicart-wrapper');

    stickyFiltersRightPart.append(wishlistEl);
    stickyFiltersRightPart.append(cartEl);

    stickyFiltersContainer.append(stickyFiltersWrapper);
    stickyFiltersWrapper.append(stickyLogoContainer);
    stickyFiltersWrapper.append(mainPageFilters);
    stickyFiltersWrapper.append(stickyFiltersRightPart);
    plpHeader.appendChild(stickyFiltersContainer);
    if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false' && stickyFiltersContainer) {
      await hasFilterChips(plpHeader);
      plpHeader.insertBefore(filterIconMobile, stickyFiltersContainer);
    }

    const chosenFilterMainPageContainer = document.createElement('div');
    chosenFilterMainPageContainer.classList.add('main-page-filters-chosen-values-container');
    chosenFilterMainPageContainer.setAttribute('id', 'main-page-filters-chosen-values-container');
    chosenFilterMainPageContainer.classList.add('hide');

    const chosenFilterMainPageContainerUl = document.createElement('ul');
    chosenFilterMainPageContainerUl.classList.add('main-page-filters-chosen-values');
    chosenFilterMainPageContainerUl.setAttribute('id', 'main-page-filters-chosen-values');

    const clearFiltersButtonOnMainPage = document.createElement('div');
    clearFiltersButtonOnMainPage.innerHTML = placeholders.plpClearFilters;
    clearFiltersButtonOnMainPage.classList.add('clear-filters-button-on-main-page');
    clearFiltersButtonOnMainPage.addEventListener('click', () => {
      clearAllFilters(); // clear all filters
    });

    const shadowDiv = document.createElement('div');
    shadowDiv.classList.add('shadow-div');

    const selectedFiltersText = document.createElement('div');
    selectedFiltersText.innerHTML = placeholders.plpSelectedFilters;
    selectedFiltersText.classList.add('selected-filters-text');

    chosenFilterMainPageContainer.prepend(selectedFiltersText);
    chosenFilterMainPageContainer.append(chosenFilterMainPageContainerUl);
    chosenFilterMainPageContainer.append(shadowDiv);
    chosenFilterMainPageContainer.append(clearFiltersButtonOnMainPage);

    plpHeader.appendChild(chosenFilterMainPageContainer);

    let sizeGroupFilterCalled = false;

    const promises = Object.entries(response.results[0].renderingContent.facetOrdering.facets.order)
      .map(async ([, attrName]) => {
        await performanceYield();

        const attributeNameWithoutLanguage = attrName
          .replace(`.${productListingLanguage}`, '')
          .trim();
        if (sizeGroupConfig.displaySizeGrouping === 'true' && hasValue(response.results[0].facets[attrName])) {
          if (sizeGroupConfig.allSizeAttributes.includes(attributeNameWithoutLanguage)) {
            if (!sizeGroupFilterCalled) {
              sizeGroupFilterCalled = true;
              return sizeGroupFilter(response, attrName, mainPageFilters, filterValuesPopupTitle);
            }
            return null;
          }
        }

        let attrNameNoLng = attrName.replace(`.${productListingLanguage}`, '').trim();
        if (attrName === `${getAttributeNameByPage(COLOR_ATTRIBUTE)}.value`) {
          attrNameNoLng = COLOR_ATTRIBUTE;
        }
        const value = response.results[0].userData[0].facets_config[attrNameNoLng];
        let sortedValues = [];
        let sortBy = 'alpha';
        const hiddenFilterList = productListingConfig['algolia-hidden-filters']?.split(',');
        if (value !== undefined && response.results[0].facets[attrName] !== undefined
      && (hiddenFilterList === undefined || !hiddenFilterList.includes(value.label[productListingLanguage]))) {
        // create a li for each filter with a filter name
          const mainFiltersLi = document.createElement('li');

          const filterTitle = value.label[productListingLanguage];
          mainFiltersLi.addEventListener('click', () => {
            filterValuesPopupTitle.innerHTML = filterTitle;
            showFilterValues(mainFiltersLi); // show filter values popup
          });
          mainFiltersLi.setAttribute('aria-label', filterTitle);
          mainFiltersLi.setAttribute('data-attribute', attrNameNoLng);

          const mainLiTitleSpan = document.createElement('span');
          mainLiTitleSpan.classList.add('main-filter-title-span');

          const gtmFilterTitle = value.label?.en;
          mainLiTitleSpan.innerHTML = filterTitle;
          mainFiltersLi.append(mainLiTitleSpan);

          // create a ul for each filter values
          const mainFilterValuesUl = document.createElement('ul');
          mainFilterValuesUl.classList.add('filters-values-ul');

          if (value.widget.type === 'checkbox') {
            const attrOrder = response.results[0].renderingContent.facetOrdering.values[attrName];
            if (attrOrder !== undefined) {
              if (attrOrder.order !== undefined) {
                sortBy = 'custom';
              } else {
                sortBy = attrOrder.sortRemainingBy;
              }
            }
            sortedValues = resortFilterValues(response, attrNameNoLng, sortBy);
            buildCheckboxFilter(
              response,
              sortedValues,
              sortBy,
              attrNameNoLng,
              mainFilterValuesUl,
              gtmFilterTitle,
            );
          } else if (value.widget.type === 'star_rating') {
            sortedValues = resortFilterValues(response, attrNameNoLng, 'alphadesc');
            buildRatingFilters(
              sortedValues,
              attrNameNoLng,
              mainFilterValuesUl,
              gtmFilterTitle,
            );
          } else if (value.widget.type === 'range_checkbox') {
            const idx = getResultsIndex(response, `${attrName}`);
            buildCheckboxPriceRangeFilter(
              response.results[idx].facets[`${attrName}`],
              response.results[idx].userData[0].facets_config[attrNameNoLng].widget?.config?.granularity,
              attrNameNoLng,
              mainFilterValuesUl,
              gtmFilterTitle,
            );
          } else if (value.widget.type === 'swatch_list') {
            const idx = getResultsIndex(response, `${getAttributeNameByPage(attrNameNoLng)}.value`);
            sortedValues = resortFilterValues(response, COLOR_ATTRIBUTE, sortBy, idx);
            buildSwatcherFilter(
              sortedValues,
              attrNameNoLng,
              mainFilterValuesUl,
              gtmFilterTitle,
            );
          }

          createFilterOnMainPage(
            response,
            value.widget.type,
            attrName,
            attrNameNoLng,
            sortedValues,
            sortBy,
            mainPageFilters,
            mainFiltersLi,
            gtmFilterTitle,
          );
          const spanMainFilterChoseValues = document.createElement('span');
          spanMainFilterChoseValues.classList.add('main-filter-chose-values');

          return [mainFiltersLi, mainFilterValuesUl, spanMainFilterChoseValues];
        }
        return null;
      });

    (await Promise.allSettled(promises)).filter((x) => !!x.value).forEach((val) => {
      const [mainFiltersLi, mainFilterValuesUl, spanMainFilterChoseValues] = val.value;
      mainFiltersLi.append(spanMainFilterChoseValues);
      // append filter values ul to filter li
      mainFiltersLi.append(mainFilterValuesUl);
      // append filter li to main filters ul
      mainFiltersUl.append(mainFiltersLi);
    });

    filtersBodyContainer.append(mainFiltersUl);
    filtersPopup.append(filtersBodyContainer);

    const filtersPopupFooterContainer = document.createElement('div');
    filtersPopupFooterContainer.classList.add('filters-popup-footer-container');

    const countOfFoundItems = document.createElement('div');
    countOfFoundItems.classList.add('count-of-found-items');
    countOfFoundItems.setAttribute('id', 'count-of-found-items');
    countOfFoundItems.innerHTML = response.results[0].nbHits;

    filtersPopupFooterContainer.append(countOfFoundItems);

    const clearAllButton = document.createElement('div');
    clearAllButton.classList.add('button-filters');
    clearAllButton.classList.add('button-clear-filter');
    clearAllButton.addEventListener('click', () => {
      clearAllFilters();
    });
    clearAllButton.innerHTML = placeholders.plpClearAll;

    const applyFiltersButton = document.createElement('div');
    applyFiltersButton.classList.add('button-filters');
    applyFiltersButton.classList.add('button-apply-all');
    if (plpFilterVariation && plpFilterVariation !== 'false') {
      applyFiltersButton.removeEventListener('click', handlePopUpApplyButtonFilters);
      applyFiltersButton.addEventListener('click', handlePopUpApplyButtonFilters);
    } else {
      applyFiltersButton.addEventListener('click', () => {
        hideFilters();
        hideFilterValues();
      });
    }
    applyFiltersButton.innerHTML = placeholders.plpApplyFilters;

    mainPageFilters.appendChild(filterIcon);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('buttons-container');

    buttonsContainer.append(clearAllButton);
    buttonsContainer.append(applyFiltersButton);
    filtersPopupFooterContainer.append(buttonsContainer);
    filtersPopup.append(filtersPopupFooterContainer);

    await performanceYield();

    const loadMoreBlock = document.querySelector('.algolia-product-listing.block');
    const loadMoreContainer = buildLoadMoreContainer(placeholders.plpLoadMoreProducts);
    loadMoreContainer.querySelector('.pager-button').addEventListener('click', async () => {
      productListingPage += 1;
      await makeRequestToAlgolia(false);
    });

    // build total item count above product listing
    const itemDisplayTemplate = `
          <div class="result-count">
            <p id="count-of-found-items-on-main"></p>
          </div>
          <div class="grid-layout-selectors">
            <div class="three-column-grid">
              <span><img data-icon-name="columns-3" src="/icons/three-column-grid-secondary.svg" alt loading="lazy"></span>
            </div>
            <div class="four-column-grid selected">
              <span><img data-icon-name="columns-4" src="/icons/four-column-grid-primary.svg" alt loading="lazy"></span>
            </div>
          </div>
      `;
    const itemDisplayContainer = document.createElement('li');
    itemDisplayContainer.classList.add('item-count-container');
    itemDisplayContainer.innerHTML = itemDisplayTemplate;
    itemDisplayContainer.querySelector('.three-column-grid').addEventListener('click', handleGridSelection);
    itemDisplayContainer.querySelector('.four-column-grid').addEventListener('click', handleGridSelection);

    const itemCountMobile = document.createElement('div');
    itemCountMobile.classList.add('item-count-mobile');
    itemCountMobile.innerHTML = '<div class="result-count-mobile"><p></p></div>';

    const mainPageUl = document.querySelector('.filters-body');
    mainPageUl.appendChild(itemDisplayContainer);

    const productsContainer = document.createElement('div');
    productsContainer.classList.add('products-container');
    productsContainer.classList.add('columns-4');
    loadMoreBlock.appendChild(itemCountMobile);
    loadMoreBlock.appendChild(productsContainer);
    buildHits(response);
    window.addEventListener('lazy-loaded', async () => {
      handleViewListEventsDLTrigger(response, insightsQueryId);
      dataLayerViewListEvents(response);
    }, { once: true });
    updateWishlistIcons();
    loadMoreBlock.appendChild(loadMoreContainer);
    updatePageLoader(response, placeholders);
    window.addEventListener('resize', checkSwatchCarouselButtons);
    window.addEventListener('resize', checkImageCarousel);

    await buildAllFilters(response).then(() => {
      buildCheckedFilters(response);
    });

    enableStickyElements();
  }
  hideLoader();
}

/**
 * Checks if the page is a search page, then calls algolia API and target call
 * sequentially.
 * Otherwise if PLP, Calls algolia API and target call in parallel.
 * @param {*} algoliaUrl API Request URL
 * @param {*} data Payload
 * @param {*} categoryNameList Category Name List
 * @returns Algolia Response
 */
async function getListingApiResponse(requests, categoryNameList) {
  let meshResponse;
  let targetPayload;
  let plpBanner;
  if (isSearchPage()) {
    meshResponse = searchTerm ? await getFilteredProducts(requests) : await getCategoryProducts(requests);
    // Show recommendations if no products found on search
    if (meshResponse.results[0]?.hits?.length === 0) {
      const recommendationsBlock = await loadFragment(`/${document.documentElement.lang}/fragments/search/empty-results`);
      dataLayerInternalSearchEmptyEvent(searchTerm);
      document.querySelector('main').appendChild(recommendationsBlock);
      document.querySelector('.algolia-product-listing-container').classList.add('hidden');
    }
    targetPayload = await pageLoadData();
    await fireTargetCall(targetPayload);
  } else if (isPromotionPage()) {
    meshResponse = await getPromotionProducts(requests);
  } else {
    [meshResponse, targetPayload, plpBanner] = await Promise.all([
      getCategoryProducts(requests),
      plpLoadData(categoryNameList),
      loadFragment(`/${document.documentElement.lang}/fragments/plp/personalization`),
    ]);
    if (meshResponse.results?.[0]?.hits?.length > 1) {
      document.querySelector('main').prepend(plpBanner);
      await fireTargetCall(targetPayload);
    }
  }
  window.dispatchEvent(new CustomEvent('target-response'));
  if (!meshResponse?.results) {
    return Promise.reject(new Error('API failed'));
  }
  return meshResponse;
}

export default async function decorate(block) {
  placeholders = await fetchPlaceholdersForLocale();
  filterAliasValues = await getFilterAliaseValues();
  buildLoader();
  showLoader();
  if (block?.classList.contains('offer-listing')) {
    const listItems = block.querySelectorAll('div > div > ul > li');
    offerListSku = Array.from(listItems)
      .map((li) => `sku:${li.textContent.trim()}`)
      .join(' OR ');
    listingType = 'offer-listing';
    block.innerHTML = '';
  }
  productListingConfig = await getProductListingConfig();
  let categoryData;
  let categoryNameList;

  document.addEventListener('updateProductPopup', (event) => {
    updateProductPopupEvent(event.detail.sku, placeholders);
  });

  try {
    if (isSearchPage()) {
      datalayerPageType = 'slp';
      const urlParams = new URLSearchParams(window.location.search);
      searchTerm = await sanitizeDOM(urlParams.get('q') || ' ');
      storeCategoryListData(categoryData);
    } else if (isPromotionPage()) {
      datalayerPageType = 'promo';
      const urlPath = window.location.href;
      const promotion = await getPromotionByUrlKey(urlPath);
      promotionId = promotion.commerce_promotionUrlResolver.id;
      promotionTitle = promotion.commerce_promotionUrlResolver.title;
    } else {
      categoryData = await getCategoryData();
      const previewPreaccessData = await getPreviewPreaccessData(categoryData);
      const visitorEligibleData = await getVisitorEligibility(previewPreaccessData, productListingLanguage);
      if (visitorEligibleData?.type === 'preview' && !visitorEligibleData.isVisitorEligible) {
        const redirectUrl = await getRedirectUrl(visitorEligibleData.isVisitorEligible, visitorEligibleData.visitorTier, productListingLanguage);
        window.location.href = redirectUrl;
        return;
      }
      await buildCategoryPath(categoryData);
      categoryNameList = storeCategoryListData(categoryData);
      const majorCategoryId = categoryData?.commerce_categories?.items?.[0]?.breadcrumbs?.[0]?.category_id;
      const subCategoryId = categoryData?.commerce_categories?.items[0]?.id;
      const isSearch = isSearchPage();
      sendCategoriesToDataLayer(categoryNameList, majorCategoryId, subCategoryId, isSearch, true);
    }

    checkUrlFacets();
    const data = buildAlgoliaRequest(productListingConfig);
    const response = await getListingApiResponse(data.requests, categoryNameList);

    if (plpLoadBanner) {
      loadBannerFragments();
    }

    window.onpageshow = async (e) => {
      if (e.persisted) {
        clearInterval(intervalId);
        updateWishlistIcons();
      }
    };
    await handleResponse(response, categoryData);
  } catch (error) {
    console.error(`Error in ${window.pageType}`, error);
  }

  // commenting out since filter have been changed entirely for mobile
  // sticky filter on mobile
  if (isMobileChipStickyBehaviour && isMobileChipStickyBehaviour === 'true') {
    window.addEventListener('scroll', () => {
      if (window.matchMedia('(max-width: 1024px)') && document.querySelector('.plp-header .filters-icon-mobile')) {
        const categoryTitle = document.querySelector('.plp-category-title');
        const plpHeader = document.querySelector('.plp-header');
        const productContainer = document.querySelector('.algolia-product-listing-container.section');

        if (categoryTitle && plpHeader) {
          const style = window.getComputedStyle(categoryTitle);
          const marginTop = parseFloat(style.marginTop);
          const marginBottom = parseFloat(style.marginBottom);
          const height = categoryTitle.offsetHeight;
          const topValue = height + marginTop + marginBottom;
          if (plpFilterChipsEnabled && plpFilterChipsEnabled !== 'false') {
            const mainHeader = document.querySelector('header .header-middle-top');
            const mainHeaderHeight = mainHeader?.offsetHeight;
            const pdpHeaderTopStyle = window.getComputedStyle(plpHeader);
            const pdpHeaderMarginTop = parseFloat(pdpHeaderTopStyle.paddingTop);
            const totalValue = height + pdpHeaderMarginTop;
            let topHeightValue;
            if (height === 0) {
              topHeightValue = mainHeaderHeight;
            } else {
              topHeightValue = mainHeaderHeight - totalValue;
            }
            if (window.scrollY > topHeightValue) {
              plpHeader.style.top = `${topHeightValue}px`;
              plpHeader.classList.add('plp-sticky-mobile');
            } else {
              // Remove the class when scrolled back to the top
              plpHeader.classList.remove('plp-sticky-mobile');
              plpHeader.style.top = ''; // Reset the top position
            }
          } else {
            plpHeader.style.top = `-${topValue}px`;
          }
        }

        if (window.matchMedia('(max-width: 768px)').matches && productContainer && plpHeader) {
          const productContainerBottom = productContainer.getBoundingClientRect().bottom;
          const plpHeaderBottom = plpHeader.getBoundingClientRect().bottom;
          const plpHeaderHeight = plpHeader.getBoundingClientRect().height;
          if (productContainerBottom <= plpHeaderBottom) {
            plpHeader.classList.add('sticky-fixed');
            productContainer.style.paddingTop = `${plpHeaderHeight}px`;
          } else {
            plpHeader.classList.remove('sticky-fixed');
            productContainer.style.paddingTop = '0';
          }
        }
      }
    });
  }

  function updateMiniCart(minicartQuantity) {
    const minicartQuantityElement = document.querySelector('main .minicart-quantity');
    if (minicartQuantityElement) {
      minicartQuantityElement.textContent = minicartQuantity;
    }
  }

  cartApi.cartItemsQuantity.watch((quantity) => {
    const minicartQuantity = quantity > 0 ? quantity : '';

    updateMiniCart(minicartQuantity);
  });
}
