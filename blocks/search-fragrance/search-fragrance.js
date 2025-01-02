import { fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
import { getConfigValue } from '../../scripts/configs.js';
import { performAlgoliaMeshQuery } from '../../scripts/commerce.js';

const lang = document.documentElement.lang || 'en';
const placeholders = await fetchPlaceholdersForLocale();
let fragranceData = [];

const FILTERED_FRAGRANCE_QUERY = `query($indexName: String!, $params: String!) { 
getProductSearch(input: { 
  requests: [ { indexName: $indexName, params: $params } ] 
  }) 
  { 
    results { 
      facets 
    } 
  } 
}`;
function formatFragranceURL(fragranceUrlConfig, subArray) {
  let formattedURL = '';
  const filteredValue = fragranceUrlConfig.filter((el) => el.facet === subArray);
  if (filteredValue.length > 0) {
    formattedURL = filteredValue[0]?.url ? filteredValue[0]?.url : '';
  }
  return formattedURL;
}

export async function getFilteredFragrances() {
  const requests = [{
    params: 'attributesToRetrieve=[\n  "attr_fragrance_name",\n]&responseFields=[\n  "userData",\n  "facets",\n  "renderingContent",\n  "hits",\n  "nbHits",\n  "page",\n  "hitsPerPage",\n  "params"\n]&clickAnalytics=true&facets=["attr_fragrance_name"]&hitsPerPage=0&page=0',
  }];
  const defaultIndexName = await getConfigValue('algolia-search-index');
  const responses = await Promise.all(requests.map(async (request) => {
    const indexName = request.indexName || defaultIndexName;
    const variables = {
      indexName,
      params: request.params,
    };
    const queryResponse = await performAlgoliaMeshQuery(FILTERED_FRAGRANCE_QUERY, variables);
    return queryResponse?.data?.getProductSearch || {};
  }));
  const results = responses.filter((response) => response).map((response) => response.results[0]);
  return { results };
}

function noFragranceFound() {
  const searchDescription = document.querySelector('.fragrance-search-field p');
  const noResultsFound = document.querySelector('.no-fragrance-found .default-content-wrapper');
  const noResultsHTML = noResultsFound.querySelector('h4').innerHTML;
  const searchKeyword = document.querySelector('.fragrance-search-field input').value;
  noResultsFound.querySelector('h4').innerHTML = searchKeyword.length > 0 ? `${noResultsHTML.split('"')[0]} "${searchKeyword}"` : placeholders.dropdownNoResultsFound || 'No Results Found';
  noResultsFound.classList.remove('hidden');
  searchDescription.classList.add('hidden');
}

function filterFragranceData(fragranceUrlConfig, listingWrapper, searchQuery = '') {
  if (Object.keys(fragranceData).length > 0) {
    const sortByLetters = {};
    Object.keys(fragranceData).forEach((property) => {
      const char = property.charAt(0);
      if ((!sortByLetters[char] && searchQuery === '') || (!sortByLetters[char] && searchQuery !== '' && property.toLowerCase().includes(searchQuery.toLowerCase()))) {
        sortByLetters[char] = [];
        sortByLetters[char].push(property);
      } else if (searchQuery === '' || (searchQuery !== '' && property.toLowerCase().includes(searchQuery.toLowerCase()))) {
        sortByLetters[char].push(property);
      }
    });
    listingWrapper.innerHTML = '';
    Object.keys(sortByLetters).sort().forEach((property) => {
      const newList = document.createElement('li');
      newList.classList.add('search-card');
      const listHeader = document.createElement('h5');
      listHeader.innerHTML = property;
      newList.append(listHeader);
      const subListing = document.createElement('ul');
      subListing.classList.add('search-card-child');
      sortByLetters[property]?.forEach((subArray) => {
        const subListingChild = document.createElement('li');
        subListingChild.classList.add('search-card-child-items');
        const actionItem = document.createElement('a');
        const getActionURL = formatFragranceURL(fragranceUrlConfig, subArray?.replace(' ', '_').toLowerCase());
        actionItem.href = getActionURL || `/${lang}/search?q=${subArray}`;
        actionItem.innerHTML = subArray;
        subListingChild.append(actionItem);
        subListing.append(subListingChild);
      });
      newList.append(subListing);
      listingWrapper.append(newList);
    });
    if (Object.keys(sortByLetters).length === 0) {
      noFragranceFound();
    }
  }
}

/**
 * Builds all fragrance name list from the APi value.
 * @param {attr_fragrance_name} fetch-value
 * @param {facets=[*]&query=} optional
 */
async function listAllFragrance(listingWrapper, fragranceUrlConfig) {
  const searchDescription = document.querySelector('.fragrance-search-field p');
  const noResultsFound = document.querySelector('.no-fragrance-found .default-content-wrapper');
  const noResultsHTML = noResultsFound.querySelector('h4').innerHTML;
  try {
    const apiResults = await getFilteredFragrances();
    const searchData = apiResults?.results[0].facets.attr_fragrance_name;
    if (searchData) {
      searchDescription.classList.remove('hidden');
      noResultsFound.classList.add('hidden');
      noResultsFound.querySelector('h4').innerHTML = `${noResultsHTML}`;
      fragranceData = searchData;
      filterFragranceData(fragranceUrlConfig, listingWrapper);
    } else {
      noFragranceFound();
    }
    document.querySelector('.fragrance-search-field input')?.addEventListener('keyup', () => {
      const searchValue = document.querySelector('.fragrance-search-field input').value;
      const resetIcon = document.querySelector('.fragrance-search-field .icon-reset');
      if (searchValue.length > 0) {
        resetIcon.classList.remove('icon-hidden');
      } else {
        resetIcon.classList.add('icon-hidden');
      }
      filterFragranceData(fragranceUrlConfig, listingWrapper, searchValue);
    });
    document.querySelector('.fragrance-search-field .icon-reset')?.addEventListener('click', () => {
      const searchValue = document.querySelector('.fragrance-search-field input');
      const resetIcon = document.querySelector('.fragrance-search-field .icon-reset');
      searchValue.value = '';
      resetIcon.classList.add('icon-hidden');
      filterFragranceData(fragranceUrlConfig, listingWrapper);
    });
  } catch (error) {
    console.log('Error occurred in API', error);
  }
}

export default async function decorate(block) {
  const isFragranceFinder = document.querySelector('.fragrance-search-field');
  if (isFragranceFinder) {
    const searchListingDOM = document.createElement('div');
    const listingWrapper = document.createElement('ul');
    const fragranceSearchInput = document.querySelector('.fragrance-search-field');
    const fieldIcon = fragranceSearchInput?.querySelector('.icon');
    const clearIcon = document.createElement('span');
    const fieldPlaceholder = fragranceSearchInput.querySelector('h3')?.innerText || placeholders.searchPlaceholder;
    const searchFieldWrapper = document.createElement('div');
    const searchField = document.createElement('input');
    clearIcon.classList.add('icon', 'icon-reset', 'icon-hidden');
    searchField.classList.add('search-input');
    searchField.setAttribute('placeholder', fieldPlaceholder);
    searchFieldWrapper.classList.add('search-field-wrapper');
    searchFieldWrapper.append(fieldIcon);
    searchFieldWrapper.append(searchField);
    searchFieldWrapper.append(clearIcon);

    fragranceSearchInput.prepend(searchFieldWrapper);
    const fragranceJSON = block.querySelector("a[href$='.json']");
    fetch(fragranceJSON, {
      method: 'GET',
    }).then((response) => response.json()).then((urlJson) => {
      const fragranceUrlConfig = urlJson?.data;
      listingWrapper.classList.add('search-list-items');
      listAllFragrance(listingWrapper, fragranceUrlConfig);
      searchListingDOM.append(listingWrapper);
      block.append(searchListingDOM);
    });
  }
}
