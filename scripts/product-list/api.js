import { performAlgoliaMeshQuery } from '../commerce.js';
import { getConfigValue } from '../configs.js';
import { getCustomer } from '../customer/api.js';
import {
  buildUrlKey,
  getLanguageAttr,
  cacheManager,
  hasValue,
} from '../scripts.js';

const lang = getLanguageAttr();
const pendingRequests = {};

const isFragrance = await getConfigValue('fragrance-object');

const EXCLUDED_CATEGORIES = ['view-all'];

const CATEGORY_PRODUCTS_QUERY1 = `query (
    $indexName: String!, 
    $params: String!, 
    $urlKey: String,
    $lang: String
) {
  getProductListingWithCategory(
    input: { 
        requests: [{ 
            indexName: $indexName, 
            params: $params, 
            urlKey: $urlKey,
            lang: $lang
        }] 
    }
  ) {
    results { 
        hits {
            sku
            gtm {
              gtm_brand
              gtm_cart_value
              gtm_category
              gtm_department_id
              gtm_department_name
              gtm_magento_product_id
              gtm_main_sku
              gtm_name
              gtm_old_price
              gtm_price
              gtm_product_sku
              gtm_product_style_code
              gtm_stock
            }
            in_stock
            discount {
              ${lang}
            }
            final_price {
              ${lang}
            }
            original_price {
              ${lang}
            }
            promotions {
              ${lang}
            }
            media {
              url
              image_type
            }
            media_pdp {
              url
              image_type
            }
            attr_color {
              ar
              en
            }
            attr_bv_rating_distribution{
              __typename
            }
            attr_bv_total_review_count
            attr_bv_average_overall_rating {
              ${lang}
            }
            title {
              ${lang}
            }
            url {
              ${lang}
            }
            attr_bv_rating {
              ${lang}
            }
            attr_product_collection {
              ${lang}
            }
            attr_collection_1 {
              ${lang}
            }
            attr_product_brand {
              en
              ar
            }
            attr_preview_preaccess_data {
              ${lang}
            }
            article_swatches {
              ${lang} {
                    article_sku_code
                    rgb_color
                }
            }
            swatches {
              ${lang} {
                child_sku_code
                rgb_color
              }
            }
            attr_color {
              ${lang}
            }
            attr_bv_rating {
              ${lang}
            }
            product_labels {
              ${lang}
            }
            member_price {
              ar
              en
              }
            catalogData {
              sku
              price {
                ${lang}
              }
              original_price {
                ${lang}
              }
              final_price {
                ${lang}
              }
              member_price {
                ${lang} {
                  label
                  name
                  value
                  roles
                }
              }
              promotions {
                ${lang} {
                  label
                  name
                  value
                  roles
                }
              }
              free_gift_promotion {
                ${lang} {
                  label
                  name
                  value
                  roles
                }
              }
            }
            
        }
        page
        hitsPerPage
        nbHits
        userData
        facets
        queryID
        _automaticInsights
        renderingContent
        params
    }
}
}`;

const SEARCH_SUGGESTIONS_QUERY = `query($indexName: String!, $params: String!) {
  getSearchTerms(input: { requests: [
    {
      indexName: $indexName,
      params: $params
    }
  ]}) {
    results {
      hits
      nbHits
      page
      nbPages
      hitsPerPage
      exhaustiveNbHits
      exhaustiveTypo
      exhaustive
      query
      params
      index
      renderingContent
      processingTimeMS
      processingTimingsMS
      serverTimeMS
    } 
  }
}`;

const SEARCH_PRODUCTS_QUERY = `
query($indexName: String!, $params: String!) {
  getProductSearch(input: {
    requests: [
      {
        indexName: $indexName,
        params: $params
      }
    ]
  }) {
    results {
      hits {
        sku
        title
        url
        original_price
        attr_bv_total_review_count
        attr_bv_rating_distribution
        attr_bv_average_overall_rating
        attr_bv_rating
        attr_product_brand
        attr_article_swatches
        attr_collection_1
        media {
          url
        }
        catalogData {
          sku
          price
          final_price
          original_price
          member_price {
            name
            label
            value
            roles
          }
          promotions {
            name
            label
            value
            roles
          }
          free_gift_promotion {
            label
            name
            value
            roles
          }
        }
      }
    }
  }
}`;

async function getUserId() {
  const customer = await getCustomer();
  return customer?.id || null;
}

/**
 * Created function which genrates dynamic query for filtered products based
 * on request number
 * @param {*} requests
 * @returns dynamic query
 */
const createFilteredProductsQuery = (requests) => {
  const variables = [];
  const requestBodies = [];

  requests.forEach((_, index) => {
    const idx = index + 1;
    variables.push(`$indexName${idx}: String!`, `$params${idx}: String!`);
    requestBodies.push(`{
      indexName: $indexName${idx},
      params: $params${idx}
    }`);
  });

  return `
    query (${variables.join(', ')}) {
      getProductSearch(input: {
        requests: [${requestBodies.join(', ')}]
      }) {
        results {
          hits {
            sku
            gtm {
              gtm_brand
              gtm_cart_value
              gtm_category
              gtm_department_id
              gtm_department_name
              gtm_magento_product_id
              gtm_main_sku
              gtm_name
              gtm_old_price
              gtm_price
              gtm_product_sku
              gtm_product_style_code
              gtm_stock
            }
            discount
            final_price
            original_price
            in_stock
            promotions
            media {
              url
              image_type
            }
            attr_color
            attr_bv_rating
            attr_bv_rating_distribution
            attr_bv_total_review_count
            attr_bv_average_overall_rating
            title
            url
            attr_product_collection
            attr_preview_preaccess_data
            attr_collection_1
            article_swatches {
              article_sku_code
              rgb_color
              swatch_type
            }
            attr_product_brand
            swatches {
              child_sku_code
              rgb_color
            }
            product_labels {
              image
              position
              text
            }
            member_price
            catalogData {
              sku
              price
              final_price
              original_price
              member_price {
                name
                label
                value
                roles
              }
              promotions {
                name
                label
                value
                roles
              }
              free_gift_promotion {
                label
                name
                value
                roles
              }
            }
          }
          page
          hitsPerPage
          nbHits
          userData
          facets
          queryID
          _automaticInsights
          renderingContent
          params
        }
      }
    }
  `;
};

/**
 * Created function which genrates dynamic query for filtered products based & used for Arabic site
 * DL also
 * on request number
 * @param {*} requests
 * @returns dynamic query
 */
const createFilteredProductsQueryEn = (requests) => {
  const variables = [];
  const requestBodies = [];

  requests.forEach((_, index) => {
    const idx = index + 1;
    variables.push(`$indexName${idx}: String!`, `$params${idx}: String!`, `$indexNameEn${idx}: String!`);
    requestBodies.push(`{
      indexName: $indexName${idx},
      params: $params${idx}
    }{
      indexName: $indexNameEn${idx},
      params: $params${idx}
    }`);
  });

  return `
    query (${variables.join(', ')}) {
      getProductSearch(input: {
        requests: [${requestBodies.join(', ')}]
      }) {
        results {
          hits {
            sku
            gtm {
              gtm_brand
              gtm_cart_value
              gtm_category
              gtm_department_id
              gtm_department_name
              gtm_magento_product_id
              gtm_main_sku
              gtm_name
              gtm_old_price
              gtm_price
              gtm_product_sku
              gtm_product_style_code
              gtm_stock
            }
            discount
            final_price
            original_price
            in_stock
            promotions
            media {
              url
              image_type
            }
            attr_color
            attr_bv_rating
            attr_bv_rating_distribution
            attr_bv_total_review_count
            attr_bv_average_overall_rating
            title
            url
            attr_product_collection
            attr_collection_1
            attr_preview_preaccess_data
            article_swatches {
              article_sku_code
              rgb_color
              swatch_type
            }
            attr_product_brand
            swatches {
              child_sku_code
              rgb_color
            }
            product_labels {
              image
              position
              text
            }
            member_price
            catalogData {
              sku
              price
              final_price
              original_price
              member_price {
                name
                label
                value
                roles
              }
              promotions {
                name
                label
                value
                roles
              }
              free_gift_promotion {
                label
                name
                value
                roles
              }
            }
          }
          page
          hitsPerPage
          nbHits
          userData
          facets
          queryID
          _automaticInsights
          renderingContent
          params
        }
      }
      getProductSearch(input: {
        requests: [${requestBodies.join(', ')}]
      }) {
        results {
          hits {
            sku
            gtm {
              gtm_brand
              gtm_cart_value
              gtm_category
              gtm_department_id
              gtm_department_name
              gtm_magento_product_id
              gtm_main_sku
              gtm_name
              gtm_old_price
              gtm_price
              gtm_product_sku
              gtm_product_style_code
              gtm_stock
            }
            discount
            final_price
            in_stock
            attr_color
            title
            url
            attr_product_brand
            swatches {
              child_sku_code
              rgb_color
            }
            member_price
          }
          page
          hitsPerPage
          nbHits
          userData
          queryID
          _automaticInsights
          params
        }
      }
    }
  `;
};

/**
 * Created function which genrates dynamic query for filtered/promotion products based
 * on request number
 * @param {*} requests
 * @returns dynamic query
 */
const createProductQuery = (requests) => {
  const variables = [];
  const requestBodies = [];

  requests.forEach((_, index) => {
    const idx = index + 1;
    variables.push(
      `$indexName${idx}: String!`,
      `$params${idx}: String!`,
      `$urlKey${idx}: String`,
      `$lang${idx}: String`,
    );
    requestBodies.push(`{
      indexName: $indexName${idx},
      params: $params${idx},
      urlKey: $urlKey${idx},
      lang: $lang${idx}
    }`);
  });
  const fragranceQuery = isFragrance === 'true' ? `attr_fragrance_name {
      ar
      en
    }
    attr_fragrance_category {
      ar
      en
    }` : '';
  return `
    query (${variables.join(', ')}) {
      getProductListingWithCategory(
        input: { requests: [${requestBodies.join(', ')}] }
      ) {
        results {
          hits {
            sku
            ${fragranceQuery}
            gtm {
              gtm_brand
              gtm_cart_value
              gtm_category
              gtm_department_id
              gtm_department_name
              gtm_magento_product_id
              gtm_main_sku
              gtm_name
              gtm_old_price
              gtm_price
              gtm_product_sku
              gtm_product_style_code
              gtm_stock
            }
            in_stock
            discount {
              ${lang}
            }
            final_price {
              ${lang}
            }
            original_price {
              ${lang}
            }
            promotions {
              ${lang}
            }
            media {
              url
              image_type
            }
            media_pdp {
              url
              image_type
            }
            attr_color {
              ${lang}
            }
            attr_bv_rating_distribution {
              __typename
            }
            attr_bv_total_review_count
            attr_bv_average_overall_rating {
              ${lang}
            }
            title {
              ${lang}
            }
            url {
              ${lang}
            }
            attr_bv_rating {
              ${lang}
            }
            attr_product_collection {
              ${lang}
            }
            attr_product_brand {
              ${lang}
            }
            attr_collection_1 {
              ${lang}
            }
            attr_preview_preaccess_data {
              ${lang}
            }
            article_swatches {
              ${lang} {
                article_sku_code
                rgb_color
              }
            }
            swatches {
              ${lang} {
                child_sku_code
                rgb_color
              }
            }
            attr_color {
              ${lang}
            }
            attr_bv_rating {
              ${lang}
            }
            product_labels {
              ${lang}
            }
            member_price {
              ar
              en
            }
            catalogData {
              sku
              price {
                ${lang}
              }
              original_price {
                ${lang}
              }
              final_price {
                ${lang}
              }
              member_price {
                ${lang} {
                  label
                  name
                  value
                  roles
                }
              }
              promotions {
                ${lang} {
                  label
                  name
                  value
                  roles
                }
              }
              free_gift_promotion {
                ${lang} {
                  label
                  name
                  value
                  roles
                }
              }
            }
          }
          page
          hitsPerPage
          nbHits
          userData
          facets
          queryID
          _automaticInsights
          renderingContent
          params
        }
      }
    }
  `;
};

/**
 * used to get filtered data, here we have created dynamic query based on number of requests.
 * Also me made single request for multiple API calls.
 * @param {*} requests
 * @returns two object first one have filtered data second object contains clickanalytics data
 */
export async function getFilteredProducts(requests, isDL = false) {
  const defaultIndexName = await getConfigValue('algolia-search-index');
  const variables = {};
  requests.forEach((request, index) => {
    const idx = index + 1;
    const indexName = request.indexName || defaultIndexName;
    const indexNameEn = lang !== 'en'
      ? `${indexName.slice(0, -2)}en`
      : indexName;
    variables[`indexName${idx}`] = indexName;
    variables[`indexNameEn${idx}`] = indexNameEn;
    variables[`params${idx}`] = request.params;
  });
  const FILTERED_PRODUCTS_QUERY1 = isDL
    ? createFilteredProductsQueryEn(requests) : createFilteredProductsQuery(requests);
  const queryResponse = await performAlgoliaMeshQuery(
    FILTERED_PRODUCTS_QUERY1,
    variables,
  );
  const responses = queryResponse?.data?.getProductSearch || null;
  const results = responses?.results;
  return { results };
}

export async function getCategoryProducts(requests, categoryPath = '') {
  let urlKey = categoryPath;
  if (!urlKey) {
    urlKey = buildUrlKey();
  }
  [urlKey] = urlKey.replace(EXCLUDED_CATEGORIES.join(','), '').replace(/\/{1,2}$/, '').split('/--');
  const defaultIndexName = await getConfigValue('algolia-plp-index');
  const variables = {};
  requests.forEach((request, index) => {
    const idx = index + 1;
    variables[`indexName${idx}`] = request?.indexName || defaultIndexName;
    variables[`params${idx}`] = request?.params;
    variables[`urlKey${idx}`] = urlKey;
    variables[`lang${idx}`] = getLanguageAttr();
  });
  const CATEGORY_PRODUCTS_QUERY = createProductQuery(requests);
  const queryResponse = await performAlgoliaMeshQuery(
    CATEGORY_PRODUCTS_QUERY,
    variables,
  );
  const responses = queryResponse?.data?.getProductListingWithCategory || null;
  const results = responses?.results;
  return { results };
}

/**
 * It is used to get promotion products (B2G1),
 * Created dynamic query and made single api call consisting of multiple payload requests.
 * @param {*} requests
 * @returns
 */
export async function getPromotionProducts(requests) {
  const defaultIndexName = await getConfigValue('algolia-plp-index');
  const variables = {};
  requests.forEach((request, index) => {
    const idx = index + 1;
    variables[`indexName${idx}`] = request.indexName || defaultIndexName;
    variables[`params${idx}`] = request.params;
    variables[`lang${idx}`] = getLanguageAttr();
  });
  const CATEGORY_PRODUCTS_QUERY = createProductQuery(requests);
  const queryResponse = await performAlgoliaMeshQuery(
    CATEGORY_PRODUCTS_QUERY,
    variables,
  );
  const responses = queryResponse?.data?.getProductListingWithCategory || null;
  const results = responses?.results;
  return { results };
}

export async function getSearchSuggestions(searchTerm = '', maxResults = 4) {
  const indexName = await getConfigValue('algolia-search-query-index');
  const userId = await getUserId();
  const params = `facets=%5B%5D&highlightPostTag=%3C%2Fais-highlight-0000000000%3E&highlightPreTag=%3Cais-highlight-0000000000%3E&hitsPerPage=${maxResults}&query=${searchTerm}${userId ? `&userToken=${userId}&analyticsTags=%5B%22web%22%2C%22customer%22%5D` : '&analytics=false'}`;
  const variables = { indexName, params };
  const queryResponse = await performAlgoliaMeshQuery(SEARCH_SUGGESTIONS_QUERY, variables);
  return queryResponse?.data?.getSearchTerms?.results[0]?.hits || [];
}

export async function getProductSuggestions(searchTerm = '', maxResults = 4) {
  const indexName = await getConfigValue('algolia-search-index');
  const userId = await getUserId();
  const params = `facets=%5B%5D&highlightPostTag=%3C%2Fais-highlight-0000000000%3E&highlightPreTag=%3Cais-highlight-0000000000%3E&hitsPerPage=${maxResults}&query=${searchTerm}${userId ? `&userToken=${userId}&analyticsTags=%5B%22web%22%2C%22customer%22%5D` : '&analytics=false'}`;
  const variables = { indexName, params };
  const queryResponse = await performAlgoliaMeshQuery(SEARCH_PRODUCTS_QUERY, variables);
  return queryResponse?.data?.getProductSearch?.results[0]?.hits || [];
}

export const getFilterAliaseValues = async () => {
  const url = '/plp-filters-values.json';
  if (!url) {
    return null;
  }

  return fetch(url)
    .then((response) => response.json())
    .then((data) => data)
    .catch((error) => {
      console.error('Failed to fetch filters data', error.message);

      return null;
    });
};

/**
 * Fetches filter facets data for a specified category.
 * Utilizes caching and prevents duplicate requests for the same category.
 *
 * @param {string} urlKey - The URL key associated with the category path.
 * @returns {Promise<Object>} - An object containing the facets data.
 */
export async function fetchFilters(urlKey) {
  const cacheKey = `filters:${lang}/${urlKey}`;
  // Default to 15 minutes cache in localstorage.
  const localstorageMinutes = await getConfigValue('localstorage-cache-minutes');
  const cacheTTL = hasValue(localstorageMinutes) ? localstorageMinutes * 60 * 1000 : 15 * 60 * 1000;

  // Return cached data if available.
  const cachedData = cacheManager.get(cacheKey);
  if (cachedData) return cachedData;

  // Reuse existing pending request for the same URL key.
  if (pendingRequests[urlKey]) return pendingRequests[urlKey];

  // Create and store a new pending request.
  const fetchData = async () => {
    try {
      // Fetch configuration values.
      const [indexName, rawNavFilters] = await Promise.all([
        getConfigValue('algolia-plp-index'),
        getConfigValue('nav-attribute-filters'),
      ]);

      // Ensure `navAttributesFilters` is a valid array of attribute strings.
      const navAttributesFilters = (Array.isArray(rawNavFilters)
        ? rawNavFilters
        : rawNavFilters.split(',').map((attr) => attr.trim())
      ).map((attribute) => `"${attribute}.${lang}"`);

      // Build query parameters for Algolia.
      const params = `clickAnalytics=true&facets=[${navAttributesFilters.join(', ')}]&filters=(stock > 0)&hitsPerPage=0&page=0`;

      // Prepare query variables.
      const variables = {
        indexName,
        params,
        lang,
        urlKey,
      };

      // Execute the Algolia query.
      const { data } = await performAlgoliaMeshQuery(CATEGORY_PRODUCTS_QUERY1, variables);
      const facets = data?.getProductListingWithCategory?.results?.[0]?.facets ?? {};

      const response = { facets };

      // Cache the fetched response.
      cacheManager.set(cacheKey, response, cacheTTL);

      return response;
    } catch (error) {
      console.error('Error fetching filters:', error);
      return { facets: {} };
    } finally {
      delete pendingRequests[urlKey];
    }
  };

  pendingRequests[urlKey] = fetchData();
  return pendingRequests[urlKey];
}

/**
 * Fetches JSON data from the specified URL.
 *
 * @param {string} url - The URL to fetch JSON data from.
 * @returns {Promise<Object|null>} - Promise that resolves to the JSON data if successful, or null.
 */
export const getJsonValues = async (url) => {
  // Check if the URL is provided; if not, return null.
  if (!url) {
    return null;
  }

  // Fetch data from the provided URL
  return fetch(url)
    .then((response) => response.json()) // Parse the response as JSON
    .then((data) => data) // Return the parsed JSON data
    .catch((error) => {
      // Log an error message if the fetch fails
      console.error('Failed to fetch data from URL:', url, error.message);

      return null; // Return null if an error occurs
    });
};
