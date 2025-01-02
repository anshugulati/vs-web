import { getMetadata, decorateIcons } from '../../scripts/aem.js';
import {
  loadFragment,
  fetchPlaceholdersForLocale,
  getCurrencyFormatter,
  isLoggedInUser,
  isSearchPage,
  formatPrice,
  logout,
  showToastNotification,
  hasValue,
  createModalFromContent,
  openModal,
  sanitizeDOM,
} from '../../scripts/scripts.js';
import {
  buildHits,
  getProductListingConfig,
} from '../algolia-product-listing/algolia-product-listing.js';
import {
  datalayerHeaderNavigationEvent,
  datalayerMobileHamburgerEvent,
  datalayerLanguageSwitchEvent,
  dataLayerTrendingSearchEvent,
} from '../../scripts/analytics/google-data-layer.js';
import { cartApi } from '../../scripts/minicart/api.js';
import { fetchCommerceCategories, getSignInToken } from '../../scripts/commerce.js';
import { getWelcomeMessage } from '../../templates/account/account.js';
import {
  getProductSuggestions,
  getSearchSuggestions,
  fetchFilters,
  getJsonValues,
} from '../../scripts/product-list/api.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getPromotionsData } from '../../scripts/promotions/api.js';
import { getCart } from '../../scripts/minicart/cart.js';
import { renderSideDrawer } from '../promo-bar/promo-bar.js';

const lang = document.documentElement.lang || 'en';
const onPlaceholderClick = await getConfigValue('onPlaceholderClick');
const mobileNavigationV2 = await getConfigValue('mobile-nav-expanded-version');
const headerWelcomeSessionEnabled = await getConfigValue('header-welcome-session-enabled');
const signinWidgetButton = await getConfigValue('sign-in-widget-button');
const screenBreakpoint = await getConfigValue('screen-breakpoint');
const enableSearchOverlay = (await getConfigValue('enable-search-overlay')) === 'true';
const enableShoeSizeNavigation = (await getConfigValue('enable-shoe-size-navigation')) === 'true';
const isPromotionBarEnabled = (await getConfigValue('is-promobar-enabled')) === 'true';
const mobileNavWithImage = await getConfigValue('mobile-nav-with-images');
const mobileNavigationlevel = (await getConfigValue('mobile-nav-level')) === 'true';
const desktopNavSubmenuColumnCount = await getConfigValue('desktop-nav-submenu-column-count');
const disableCategoryLink = await getConfigValue('disable-category-link');

const isL2NavIconEnabled = await getConfigValue('display-nav-icon-l2');
const isEnabledLeading = (await getConfigValue('is-enabled-leading')) === 'true';

// const auraConfigs = {};
const isAuraEnabled = await getConfigValue('is-aura-enabled');

async function headerFetchAuraData() {
  const auraGuestMemberNumber = JSON.parse(localStorage.getItem('aura_common_data') || '{}')?.aura_membership;

  const {
    getAuraCustomerData,
    getAuraCustomerPoints,
    getAuraCustomerTiers,
    getAuraGuestInfo,
    getAuraGuestPoints,
  } = isAuraEnabled
    ? await import('../../scripts/aura/api.js')
    : {};

  try {
    if (isLoggedInUser()) {
      return Promise.all([
        getAuraCustomerData?.() || Promise.resolve({}),
        getAuraCustomerPoints?.() || Promise.resolve({}),
        getAuraCustomerTiers?.() || Promise.resolve({}),
      ])
        .then(([customerData, customerPoints, customerTiersData]) => ({
          customerData,
          customerPoints,
          customerTiersData,
        }))
        .catch((error) => {
          console.error('Error fetching Aura data:', error);
          throw error;
        })
        .finally(() => {
          document.querySelector('.aura-banner-loader')?.classList.add('hide');
        });
    }

    if (auraGuestMemberNumber) {
      return Promise.all([
        getAuraGuestInfo?.() || Promise.resolve({}),
        getAuraGuestPoints?.() || Promise.resolve({}),
      ])
        .then(([guestData, guestPoints]) => {
          const customerData = {
            ...guestData,
            apc_first_name: guestData.first_name,
            apc_last_name: guestData.last_name,
          };

          return {
            customerData,
            customerPoints: guestPoints,
            customerTiersData: {}, // No tiers for guest users
          };
        })
        .catch((error) => {
          console.error('Error fetching Aura data for guest:', error);
          throw error;
        })
        .finally(() => {
          document.querySelector('.aura-banner-loader')?.classList.add('hide');
        });
    }
  } catch (error) {
    console.error('Error fetching Aura data:', error);
    throw error;
  }

  // Default return if no conditions match
  return Promise.resolve({});
}
function highlightSearchTerm(text, searchTerm) {
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<b>$1</b>');
}

// Determines if the device is considered mobile based on screen width.
const isMobileDevice = () => {
  // We can specify the screenBreakpoint in the config file.
  const breakPoint = Number(screenBreakpoint);
  return !Number.isNaN(breakPoint)
    ? window.innerWidth <= breakPoint
    : window.innerWidth <= 1024;
};

// TODO: Later Update session storage with query parameters
const toastMessage = sessionStorage.getItem('loginWelcomeWizardToastMessage');
if (toastMessage) {
  showToastNotification(toastMessage);
  sessionStorage.removeItem('loginWelcomeWizardToastMessage');
}

async function buildQuerySuggestions(searchTerm, placeholders = {}) {
  const querySuggestions = document.createElement('div');
  querySuggestions.classList.add('query-suggestions');
  const suggestions = await getSearchSuggestions(searchTerm);
  if (suggestions.length > 0) {
    if (!searchTerm) {
      const querySuggestionsTitle = document.createElement('h5');
      querySuggestionsTitle.textContent = placeholders.trendingSearches || 'Trending Searches';
      querySuggestions.append(querySuggestionsTitle);
    }

    if (searchTerm && enableSearchOverlay) {
      const querySuggestionsTitle = document.createElement('h5');
      querySuggestionsTitle.textContent = placeholders.suggestions || 'Suggestions';
      querySuggestions.append(querySuggestionsTitle);
    }
    const querySuggestionList = document.createElement('ul');
    suggestions.forEach((suggestion) => {
      const searchQuery = suggestion.query;
      const highlightedQuery = highlightSearchTerm(searchQuery, searchTerm);
      const li = document.createElement('li');
      li.innerHTML = `<a href="/${lang}/search?q=${searchQuery}">${highlightedQuery}</a>`;
      if (enableSearchOverlay && enableSearchOverlay !== 'false') {
        if (searchTerm === '') {
          li.classList.add('trending-searches');
          li.classList.remove('suggestions');
        } else {
          li.classList.remove('trending-searches');
          li.classList.add('suggestions');
        }
      }
      const searchIconSpan = document.createElement('span');
      searchIconSpan.innerHTML = '<span class="icon search-icon"></span>';
      if (isEnabledLeading) {
        searchIconSpan.innerHTML = '<span class="icon leading-icon"></span>';
      }
      li.append(searchIconSpan);
      querySuggestionList.append(li);
    });
    querySuggestions.append(querySuggestionList);
  } else if (enableSearchOverlay && enableSearchOverlay !== 'false') {
    const noResultsTitle = document.createElement('h5');
    noResultsTitle.classList.add('no-result-title');
    noResultsTitle.textContent = `${placeholders.noResultsTitle || 'No results found'}`;
    const noresultDescription1 = document.createElement('p');
    noresultDescription1.classList.add('no-result-desc');
    noresultDescription1.innerHTML = `${placeholders.noResultsDescLineOne} <b>"${searchTerm}"</b>`;
    const noresultDescription2 = document.createElement('p');
    noresultDescription2.classList.add('no-result-desc');
    noresultDescription2.textContent = `${placeholders.noResultsDescLineTwo}`;
    querySuggestions.append(noResultsTitle);
    querySuggestions.append(noresultDescription1);
    querySuggestions.append(noresultDescription2);
  }
  return querySuggestions;
}

async function buildProductSuggestionsForOverlay(
  searchTerm,
  searchSuggestionsContainer,
  placeholders,
) {
  const productSuggestions = document.createElement('div');
  searchSuggestionsContainer.append(productSuggestions);
  productSuggestions.classList.add('product-suggestions');

  const productContainer = document.createElement('div');
  productContainer.classList.add('products-container');

  const resultsHeader = document.createElement('div');
  resultsHeader.classList.add('results-header');
  const viewAllButton = document.createElement('button');
  viewAllButton.classList.add('view-all-button', 'secondary');
  viewAllButton.innerHTML = `${placeholders.viewAll || 'View All'}`;
  viewAllButton.addEventListener('click', () => {
    const header = document.querySelector('.header');
    const searchField = header.querySelector('.search-field.is-active input');
    const newSearchTerm = searchField.value.trim().toLowerCase();
    const searchUrl = new URL(`${origin}/${lang}/search`);
    searchUrl.searchParams.set('q', newSearchTerm);
    window.location.href = searchUrl;
  });

  const resultsHeading = document.createElement('h5');
  productSuggestions.append(resultsHeader, productContainer);

  let suggestions;

  if (!searchTerm) {
    suggestions = await getProductSuggestions(searchTerm);
    resultsHeading.innerHTML = placeholders.trendingProducts || 'Trending products';
  } else {
    suggestions = await getProductSuggestions(searchTerm);

    if (suggestions && suggestions.length > 0) {
      resultsHeading.innerHTML = `${placeholders.resultsFor || 'Results for'} "${searchTerm}"`;
    } else {
      resultsHeading.innerHTML = placeholders.trendingProducts || 'Trending products';
      suggestions = await getProductSuggestions('');
    }
  }

  resultsHeader.append(resultsHeading, viewAllButton);

  const response = {
    results: [
      {
        hits: suggestions,
      },
    ],
  };

  const config = await getProductListingConfig();

  buildHits(response, { config, placeholdersList: placeholders });
}

async function buildProductSuggestions(searchTerm, searchSuggestionsContainer, placeholders = {}) {
  if (enableSearchOverlay) {
    await buildProductSuggestionsForOverlay(searchTerm, searchSuggestionsContainer, placeholders);
    return;
  }

  const currency = await getConfigValue('currency');
  const productSuggestions = document.createElement('div');
  productSuggestions.classList.add('product-suggestions');
  if (!searchTerm) {
    searchSuggestionsContainer.append(productSuggestions);
    return;
  }
  const suggestions = await getProductSuggestions(searchTerm);
  const productSuggestionsTitle = document.createElement('h5');
  productSuggestions.append(productSuggestionsTitle);
  if (suggestions.length > 0) {
    productSuggestionsTitle.textContent = placeholders.topSuggestions || 'Top Suggestions';
    if (enableSearchOverlay && enableSearchOverlay !== 'false') {
      const viewAll = document.createElement('span');
      viewAll.classList.add('overlay-view-all');
    }
    const productSuggestionsList = document.createElement('ul');
    suggestions.forEach(async (suggestion) => {
      const {
        original_price: originalPrice, url, title, media, catalogData,
      } = suggestion;
      const productItem = document.createElement('li');
      const productUrl = url.replace('.html', '');
      const { final_price: finalPrice } = catalogData;
      const discount = Math.floor(((originalPrice - finalPrice) / originalPrice) * 100);
      const formattedOriginalPrice = await formatPrice(currency, originalPrice);
      const formattedFinalPrice = await formatPrice(currency, finalPrice);
      productItem.innerHTML = `
        <a href="${productUrl}">
          <div class="product-suggestion">
            <div class="product-suggestion-image">
              <img src="${media[0]?.url}" alt="${title}">
            </div>
            <div class="product-suggestion-details">
              <div class="product-suggestion-name">${title}</div>
              <div class="product-suggestion-price ${discount > 0 ? 'strikethrough' : ''}">
                ${formattedOriginalPrice}
              </div>
            </div>
          </div>
        </a>
      `;
      const suggestionDetails = productItem.querySelector('.product-suggestion-details');
      if (discount > 0) {
        const discountedPriceHTML = `${formattedFinalPrice} (${placeholders.plpSave || 'Save'} ${discount}%)`;
        suggestionDetails.innerHTML += `<div class="product-suggestion-discount">${discountedPriceHTML}</div>`;
      }
      const promotions = JSON.parse(catalogData.promotions?.value || '[]');
      promotions.forEach((promotion) => {
        if (promotion.context.includes('web')) {
          suggestionDetails.innerHTML += `<div class="product-suggestion-promotion">${promotion.label}</div>`;
        }
      });
      productSuggestionsList.append(productItem);
    });
    productSuggestions.append(productSuggestionsList);
  } else {
    productSuggestionsTitle.textContent = placeholders.noSuggestions || 'No suggestions found';
  }
  searchSuggestionsContainer.append(productSuggestions);
}

async function updateSearchSuggestions(searchInput, placeholders = {}) {
  const searchTerm = await sanitizeDOM(searchInput.value?.trim().toLowerCase() || '');
  if (enableSearchOverlay && searchTerm && searchTerm.length < 3) {
    return;
  }
  const searchContainer = searchInput.closest('.search-container');
  const searchSuggestionsContainer = document.createElement('div');
  searchSuggestionsContainer.classList.add('search-suggestions');
  const querySuggestions = await buildQuerySuggestions(searchTerm, placeholders);
  searchSuggestionsContainer.append(querySuggestions);
  searchContainer.querySelector('.search-suggestions').replaceWith(searchSuggestionsContainer);
  await buildProductSuggestions(searchTerm, searchSuggestionsContainer, placeholders);
}

// to hide close icon if search input is empty
function toggleCloseIcon(searchInput) {
  const closeIcon = searchInput.closest('.search-field').querySelector('.search-close-icon');
  if (searchInput.value?.trim() === '') {
    closeIcon.classList.add('hide');
  } else {
    closeIcon.classList.remove('hide');
  }
}

function closeSearch(target, searchInput, popupOverlay, searchTerm) {
  const searchContainer = target.closest('.search-container');
  searchInput.value = isSearchPage() ? searchTerm : '';
  searchContainer.querySelector('.search-field').classList.remove('is-active');
  searchContainer.querySelector('.search-overlay')?.classList.remove('active');
  searchContainer.querySelector('.search-suggestions').classList.add('hide');
  popupOverlay.classList.remove('active');
  document.body.classList.remove('search-active');
}

async function addEventToSearchInput(headerBlock, placeholders = {}) {
  const body = document.querySelector('body');
  const popupOverlay = document.querySelector('.menu-popup-overlay');
  const urlParams = new URLSearchParams(window.location.search);
  const searchTerm = await sanitizeDOM(urlParams.get('q') || '');

  headerBlock.querySelectorAll('.search-field input').forEach((searchInput) => {
    searchInput.addEventListener('keydown', async (e) => {
      const { key } = e;
      if (key === 'Enter') {
        const newSearchTerm = await sanitizeDOM(searchInput.value.trim().toLowerCase());
        if (newSearchTerm.length > 0) {
          const searchUrl = new URL(`${origin}/${lang}/search`);
          searchUrl.searchParams.set('q', newSearchTerm);
          window.location.href = searchUrl;
        }
      }
    });
    searchInput.addEventListener('input', async (e) => {
      const { target } = e;
      toggleCloseIcon(target);
      await updateSearchSuggestions(target, placeholders);
    });
    searchInput.addEventListener('focusin', (e) => {
      const { target } = e;
      updateSearchSuggestions(target, placeholders);
      toggleCloseIcon(target);
      const searchContainer = target.closest('.search-container');
      searchContainer.querySelector('.search-field').classList.add('is-active');
      searchContainer.querySelector('.search-overlay')?.classList.add('active');
      searchContainer.querySelector('.search-suggestions').classList.remove('hide');
      popupOverlay.classList.add('active');
      body.classList.add('search-active');
    });

    if (enableSearchOverlay) {
      const searchIcon = searchInput.closest('.search-field').querySelector('.search-icon');
      searchIcon?.addEventListener('click', (e) => {
        const { target } = e;
        closeSearch(target, searchInput, popupOverlay, searchTerm);
      });
    } else {
      searchInput.addEventListener('focusout', (e) => {
        const { target } = e;
        toggleCloseIcon(target);
        // delay to prioritize the click event
        setTimeout(() => {
          if (!searchInput.matches(':focus')) {
            // if on search page, reset the search input value to search query
            closeSearch(target, searchInput, popupOverlay, searchTerm);
          }
        }, 200);
        toggleCloseIcon(searchInput);
      });
    }

    const closeIcon = searchInput.closest('.search-field').querySelector('.search-close-icon');
    closeIcon?.addEventListener('click', () => {
      searchInput.value = '';
      toggleCloseIcon(searchInput);
      searchInput.focus();
    });
    if (isSearchPage()) {
      searchInput.value = searchTerm;
      if (isMobileDevice()) {
        const searchIcon = searchInput.closest('.search-field').querySelector('.search-icon');
        searchIcon?.addEventListener('click', () => {
          const thisBody = document.querySelector('body');
          if (!thisBody.classList.contains('search-active') || searchInput.value === '') {
            window.history.back();
          }
        });
      }
    }
  });

  headerBlock.querySelectorAll('.search-suggestions').forEach((searchSuggestion) => {
    searchSuggestion.addEventListener('click', (e) => {
      const { target } = e;
      const searchInput = target.closest('.search-container').querySelector('.search-field input');
      searchInput.focus();
    });
  });
}

async function createFavoriteAddedNotification(product) {
  const token = getSignInToken();

  // eslint-disable-next-line
  const { favouritesSigninText, favouritesSigninSubText1Signedin, favouritesSigninSubText1, favouritesSigninSubText2, signin, register } = await fetchPlaceholdersForLocale();
  // create a sigin widget and append it to the header
  let buttonInput;
  if (signinWidgetButton && signinWidgetButton !== 'false') {
    buttonInput = `<a href="/${lang}/user/login" class="sign-in-link button primary">${signin} / ${register}</a>`;
  } else {
    buttonInput = `<a href="/${lang}/user/register" class="sign-up-link button secondary">${register}
    </a><a href="/${lang}/user/login" class="sign-in-link button primary">${signin}</a>`;
  }

  const signInWidget = document.createElement('div');
  signInWidget.classList.add('sign-in-widget');

  signInWidget.innerHTML = `<div class="sign-in-widget">
    <div>
      <h6>${product.name}</h6>
      <p>${favouritesSigninSubText1Signedin}</p>
    </div>`;

  if (!token) {
    signInWidget.innerHTML = `<div class="sign-in-widget">
        <div>
          <h6>${product.name}</h6>
          <p>${favouritesSigninSubText1}</p>
        </div>
        <div>
          <h6>${favouritesSigninText}</h6>
          <p>${favouritesSigninSubText2}</p>
        </div>
        <div class="button-wrapper">
        ${buttonInput}
        </div>
      </div>`;
  }
  return signInWidget;
}

/**
 * Retuns whether to show a promotion category menu based on promo_id
 * @param {Object} promotions The promotions data
 * @param {String} promoId The promotion schedule ID
 * @returns Boolean
 */
const isShowMenuInNav = (promotions, promoId) => {
  if (!promotions?.total) {
    return false;
  }

  const activePromotions = promotions.data.filter((promotion) => promotion.status === '1' && promotion.channel_web === 'true');

  const menuPromotion = activePromotions.find((promotion) => promotion.schedule_id === promoId);

  if (!menuPromotion) {
    return false;
  }

  const { start_date: sDate, end_date: eDate } = menuPromotion;
  const dateNow = new Date().getTime();

  const startDate = new Date(sDate).getTime();
  const endDate = new Date(eDate).getTime();

  if (startDate <= dateNow && endDate >= dateNow) {
    return true;
  }

  return false;
};

/**
 * @param {HTMLElement} elem
 * @param {Boolean} state determines the visibility of the element
 * @param {String} className the name of the class to add to element
 */
const toggleClass = (elem, state, className = '') => {
  if (state) {
    elem.classList.add(className);
  } else {
    elem.classList.remove(className);
  }
};

/**
 * @param {Boolean} visible determines the visibility of the element
 */
const togglePoupOverlay = (visible) => {
  const overlay = document.getElementById('menu-popup-overlay');
  const mainMenuLinks = document.querySelectorAll('.xs-main-menu-link');
  let hasSubMenu = false;
  mainMenuLinks.forEach((menu) => {
    const subMenu = menu.querySelector('.submenu-ul');
    if (subMenu) {
      hasSubMenu = true;
    }
  });
  if (overlay) {
    toggleClass(overlay, visible && hasSubMenu, 'active');
  }
};

/**
 * @param {Boolean} visible determines the visibility of the element
 */
const toggleMainMenus = (visible) => {
  const mainMenuLinks = document.querySelectorAll('.xs-main-menu-link');
  mainMenuLinks.forEach((menu) => {
    toggleClass(menu, visible, 'active');
  });
};

/**
 * @param {Boolean} visible determines the visibility of the element
 */
const toggleSubMenus = (visible) => {
  const subMenus = document.querySelectorAll('.submenu-ul');
  subMenus.forEach((subMenu) => {
    toggleClass(subMenu, visible, 'active');
  });
};

/**
 * @param {Event} e Event
 * Main menu click handler
 */
const menuClickHandler = (e) => {
  if (isMobileDevice()) {
    e.preventDefault();

    const mainMenus = document.querySelectorAll('.xs-main-menu-link');
    const { menuId } = e.target.dataset;
    // Remove active state from all other main menus
    if (mainMenus?.length > 0) {
      mainMenus.forEach((mainM) => {
        mainM.classList.remove('active');
      });
    }

    // Hide all other inactive submenus first
    const allSubMenus = document.querySelectorAll('.submenu-ul');
    if (allSubMenus?.length > 0) {
      allSubMenus.forEach((subM) => {
        subM.classList.remove('active');
      });
    }
    // Make the current element to active state
    e.target.classList.add('active');

    // Make the subnav visible.
    const subMenu = document.getElementById(`submenu-ul-${menuId}`);
    if (subMenu) {
      subMenu.classList.add('active');
    } else {
      window.location.href = e.target.getAttribute('href');
    }
  }
};

/**
 * @param {Event} e
 * Main menu element hover state handler
 */
const menuHoverHandler = (e) => {
  if (!isMobileDevice()) {
    const mainMenus = document.querySelectorAll('.xs-main-menu-link');
    mainMenus.forEach((mainMenu) => {
      mainMenu.classList.remove('active');
    });
    e.target.classList.add('active');

    togglePoupOverlay(true);

    const { menuId } = e.target.dataset;
    if (menuId) {
      toggleSubMenus(false);

      const subMenu = document.getElementById(`submenu-ul-${menuId}`);
      if (subMenu && !subMenu.classList.contains('active')) {
        subMenu.classList.add('active');
      }
    } else {
      const allSubMenus = document.querySelectorAll('.submenu-ul');
      if (allSubMenus?.length > 0) {
        allSubMenus.forEach((subMenu) => {
          subMenu.classList.remove('active');
        });
      }
    }
  }
};

/**
 * @param {Event} e
 * Hamburger menu button click handler
 */
const hamburgerClickHandler = (e) => {
  const currentElem = e.target;
  const bodyElement = document.querySelector('body');
  const navWrapper = document.getElementById('nav-wrapper');
  const mainMenuWrapper = document.getElementById('xs-mainmenu-wrapper');
  const mainMenus = document.querySelectorAll('#xs-mainmenu-wrapper .xs-main-menu-link');
  const subMenus = document.querySelectorAll('#sub-menu-wrapper .submenu-ul');
  const subMenusLi = document.querySelectorAll('#sub-menu-wrapper .submenu-li');
  const headerElem = document.getElementsByTagName('header')[0];
  let state = '';
  const stickyButton = document.querySelector('.pdp-product__actions');
  if (navWrapper) {
    navWrapper.classList.remove('active-level');
  }
  // Checks if the menu is in opened state or not
  if (currentElem.classList.contains('open')) {
    bodyElement.classList.remove('no-scroll');
    currentElem.classList.toggle('open');
    headerElem.classList.remove('expanded');
    navWrapper.classList.remove('active');
    if (mobileNavWithImage) { headerElem.parentElement.classList.remove('no-scroll'); }
    [...mainMenus].forEach((menu) => {
      menu.classList.remove('active');
    });
    [...subMenus].forEach((subMenu) => {
      subMenu.classList.remove('active');
    });
    state = 'Close';
  } else {
    bodyElement.classList.add('no-scroll');
    currentElem.classList.toggle('open');
    headerElem.classList.add('expanded');
    if (mobileNavWithImage) { headerElem.parentElement.classList.add('no-scroll'); }
    if (mainMenuWrapper) {
      mainMenuWrapper.classList.remove('hidden');
    }
    subMenusLi.forEach((subMenu) => {
      subMenu.classList.remove('hidden');
    });
    navWrapper.classList.add('active');
    if (mobileNavigationV2 && mobileNavigationV2 !== 'false') {
      mainMenus[0].classList.remove('active');
      subMenus[0].classList.remove('active');
    } else {
      mainMenus[0].classList.add('active');
      subMenus[0].classList.add('active');
      state = 'Open';
    }
  }
  if (stickyButton) {
    stickyButton.style.display = currentElem.classList.contains('open') ? 'none' : 'flex';
  }

  const headerMiddle = document.querySelector('.header-middle');
  const navWrapperactive = document.querySelector('.nav-wrapper.active');
  if (headerMiddle && mobileNavWithImage && navWrapperactive) {
    navWrapper.style.paddingBottom = `${headerMiddle.offsetHeight + 40}px`;
  }

  if (mobileNavWithImage) {
    const subMenuWrapper = document.querySelector('.sub-menu-wrapper');
    subMenuWrapper.classList.add('active');
    subMenuWrapper?.children?.[0]?.classList?.add('active');
    document.querySelector('.xs-mainmenu-wrapper').remove();
  }

  datalayerMobileHamburgerEvent(state);
};

/**
 * @param {*} e Sub menu navigation click handler
 */
const subMenuClickHandler = (e) => {
  if (isMobileDevice()) {
    e.preventDefault();
    const parentLi = e.target.closest('li');
    const subMenu = parentLi.querySelector(':scope > ul');

    // Makes the sub menu visible

    if (mobileNavigationV2 && mobileNavigationV2 !== 'false') {
      const activeSubMenus = document.querySelectorAll('ul.submenu-ul.submenu-ul-3.active');
      activeSubMenus.forEach((menu) => {
        if (menu !== subMenu) {
          menu.classList.remove('active');
          menu.classList.add('hidden');
        }
      });
    }

    if (subMenu) {
      if (subMenu.classList.contains('active')) {
        subMenu.classList.remove('active');
        subMenu.classList.add('hidden');
      } else {
        subMenu.classList.remove('hidden');
        subMenu.classList.add('active');
        if (mobileNavWithImage && isMobileDevice() && (subMenu.classList.contains('submenu-ul-2') || subMenu.classList.contains('submenu-ul-3'))) {
          subMenu.closest('.nav-wrapper.active').classList.add('active-level');
        }
      }
    } else {
      window.location = e.target.href;
    }
  }
};

/**
 * @param {Event} e Back button for mobile menu sub navigation
 */
const headerBackClickHandler = (e) => {
  if (isMobileDevice()) {
    const parentUl = e.target.closest('ul');
    parentUl.classList.remove('active');
    if (e.target.closest('ul').classList.contains('submenu-ul-2')) {
      parentUl.closest('.nav-wrapper.active').classList.remove('active-level');
    }
  }
};

const menuWrapperMouseLeaveHandler = () => {
  if (isMobileDevice()) {
    return;
  }

  togglePoupOverlay(false);
  toggleMainMenus(false);
  toggleSubMenus(false);
};

/**
 * Register events for the header navigation
 * (includes both desktop and mobile events)
 */
const registerMenuEvents = () => {
  // Event listner for the main menu link click handler
  const mainMenus = document.querySelectorAll('.xs-main-menu-link');
  if (mainMenus?.length > 0) {
    mainMenus.forEach((menu) => {
      menu.addEventListener('click', menuClickHandler);
      menu.addEventListener('mouseover', menuHoverHandler);
    });
  }

  // Hamburger Button Event
  const hamburgerButton = document.getElementById('menu-hamburger-btn');
  if (hamburgerButton) {
    hamburgerButton.addEventListener('click', hamburgerClickHandler);
  }

  // Evnet listner for the submenu links click handler
  const subMenuLinks = document.querySelectorAll('.submenu-ul > li > a');
  if (subMenuLinks?.length > 0) {
    subMenuLinks.forEach((link) => {
      link.addEventListener('click', subMenuClickHandler);
    });
  }

  // Sub Menu navigation back button events
  document.querySelectorAll('#nav-wrapper .menu-header-back').forEach((button) => {
    button.addEventListener('click', headerBackClickHandler);
  });

  // Main menu wrapper out of focus state handler
  const menuWrapper = document.getElementById('nav-wrapper');
  if (menuWrapper) {
    menuWrapper.addEventListener('mouseleave', menuWrapperMouseLeaveHandler);
  }
};

/**
 * Creates a filter link and adds it to the submenu list item based on the filter type.
 * @param {Object} menu The main menu object containing the URL path.
 * @param {Object} subMenu The submenu object containing filter data.
 * @param {HTMLElement} li The list item (li) element to which the filter will be added.
 * @param {string} filterType The type of filter to add ('shoeSize' or 'brand').
 */
const addFilter = async (menu, subMenu, li, filterType) => {
  try {
    const config = {
      shoeSize: {
        facetsKey: `attr_size_shoe_eu.${lang}`,
        classList: 'shop-by-filter-attribute__list',
        condition: subMenu?.show_filters_shoe_size === 1,
        filterPath: '--size_shoe_eu-',
      },
      brand: {
        facetsKey: `attr_product_brand.${lang}`,
        classList: 'brands-filter-attribute__list',
        // TODO: update the if conditon after MDC change in flag for brand.
        condition: subMenu?.name === 'Brands',
        filterPath: '--product_brand-',
      },
    }[filterType];

    // Validate configuration and target category.
    if (!config?.condition
      || !subMenu?.target_category
      || Number.isNaN(subMenu.target_category)) {
      return null;
    }

    const { facets } = await fetchFilters(menu.url_path);
    const items = facets?.[config.facetsKey];
    if (!items || Object.keys(items).length === 0) {
      return null;
    }

    // Create the main filter list element.
    const filterUl = document.createElement('ul');
    filterUl.classList.add(config.classList);

    const level = (subMenu?.level ?? 0) + 1;
    const headerNav = filterType === 'brand' ? await getJsonValues('/brand-logo-nav.json') : null;

    // Create list elements for each item.
    Object.entries(items).forEach(([item]) => {
      const filterLi = document.createElement('li');
      filterLi.classList.add('submenu-li', `level-${level}-li`);

      const filterLink = document.createElement('a');
      filterLink.classList.add('submenu-link');
      filterLink.dataset.level = level;
      filterLink.id = `submenu-link-${subMenu?.id}-${item}`;

      // Filters like brands, shoe size: replace spaces & slashes with underscores.
      filterLink.href = `/${lang}/${menu.url_path}/${config.filterPath}${item.toLowerCase().replace(/ /g, '__').replace(/\//g, '_')}`;
      // Append brand image or text.
      if (filterType === 'brand' && headerNav) {
        const brandData = headerNav.data.find(
          (brand) => brand.brand.toLowerCase() === item.toLowerCase(),
        );
        if (hasValue(brandData) && hasValue(brandData.image)) {
          const brandImage = document.createElement('img');
          brandImage.src = brandData.image;
          brandImage.alt = brandData.brand;
          filterLink.appendChild(brandImage);
        } else {
          const filterText = document.createElement('span');
          filterText.textContent = item;
          filterLink.appendChild(filterText);
        }
      } else {
        const filterText = document.createElement('span');
        filterText.textContent = item;
        filterLink.appendChild(filterText);
      }

      filterLi.appendChild(filterLink);
      filterUl.appendChild(filterLi);
    });
    li.appendChild(filterUl);
  } catch (error) {
    console.error(`Error adding ${filterType} filter: `, error);
  }
  return null;
};

/**
 * @param {Object} menu The array of objects of category menus by level
 * @returns HTMLCollection of the dynamic sub menu navigation
 */
const buildDynamicSubMenus = (menu, placeholders, promotions, categoryEnrichment = null) => {
  const subMenuUl = document.createElement('ul');
  subMenuUl.classList.add('submenu-ul', `submenu-ul-${menu.level}`);
  subMenuUl.setAttribute('id', `submenu-ul-${menu.id}`);
  if (mobileNavigationV2 && mobileNavigationV2 !== 'false' && !mobileNavWithImage) {
    if (menu.level > 1) {
      const menuHeader = document.createElement('li');
      menuHeader.classList.add('submenu-header');
      const menuHeaderBack = document.createElement('button');
      menuHeaderBack.classList.add('menu-header-back');
      menuHeaderBack.setAttribute('data-level', menu.level);
      menuHeaderBack.setAttribute('data-parent-level', menu.level - 1);
      menuHeaderBack.setAttribute('data-menu-id', menu.id);
      const menuHeaderBackIcon = document.createElement('img');
      menuHeaderBackIcon.setAttribute('src', '/icons/chevron.svg');
      menuHeaderBack.appendChild(menuHeaderBackIcon);
      const menuHeaderTitle = document.createElement('h5');
      menuHeaderTitle.classList.add('menu-header-title');
      menuHeaderTitle.textContent = menu.name;

      menuHeader.appendChild(menuHeaderBack);
      menuHeader.appendChild(menuHeaderTitle);
      subMenuUl.appendChild(menuHeader);
      subMenuUl.setAttribute('data-gtm-name', menu.gtm_name);
    }
  } else {
    if (menu.level === 2) {
      subMenuUl.setAttribute('data-gtm-name', menu.gtm_name);
    }
    if ((mobileNavWithImage && menu.level === 2 && isMobileDevice()) || menu.level === 3) {
      const menuHeader = document.createElement('li');
      menuHeader.classList.add('submenu-header');
      const menuHeaderBack = document.createElement('button');
      menuHeaderBack.classList.add('menu-header-back');
      menuHeaderBack.setAttribute('data-level', menu.level);
      menuHeaderBack.setAttribute('data-parent-level', menu.level - 1);
      menuHeaderBack.setAttribute('data-menu-id', menu.id);
      const menuHeaderBackIcon = document.createElement('img');
      menuHeaderBackIcon.setAttribute('src', '/icons/arrow-left.svg');
      menuHeaderBack.appendChild(menuHeaderBackIcon);
      const menuHeaderTitle = document.createElement('h5');
      menuHeaderTitle.classList.add('menu-header-title');
      menuHeaderTitle.textContent = menu.name;

      menuHeader.appendChild(menuHeaderBack);
      menuHeader.appendChild(menuHeaderTitle);
      subMenuUl.appendChild(menuHeader);
    }
  }
  if (menu?.children?.length > 0) {
    const hasAllImages = menu.children.every((subMenu) => subMenu?.image);
    let { children } = menu;
    if (mobileNavWithImage && !isMobileDevice()) {
      const banners = menu?.banners?.split(',').map((path) => path.trim()) || [];
      const availableSlots = Math.max(desktopNavSubmenuColumnCount - banners.length, 0);
      children = menu.children
        .filter((subMenu) => subMenu?.include_in_menu === 1)
        .slice(0, availableSlots);
    }

    children.forEach((subMenu) => {
      if (subMenu?.include_in_menu === 1) {
        const promoId = subMenu?.promo_id;

        if (typeof promoId === 'string' && promoId !== '' && !isShowMenuInNav(promotions, promoId)) {
          return;
        }

        const li = document.createElement('li');
        li.classList.add('submenu-li');
        li.classList.add(`level-${subMenu?.level}-li`);
        li.setAttribute('data-gtm-name', subMenu?.gtm_name);
        const a = document.createElement('a');
        // TODO : Temporary fix for H&M, proper one to be identified
        // a.classList.add('submenu-link', 'parent-menu');
        a.classList.add('submenu-link');
        // Apply inline style for underline if `is_underlined` is 1.
        if (subMenu?.is_underlined === 1) {
          a.classList.add('underline');
        }
        // make links non clickable if override in sharepoint.
        const isNotClickable = categoryEnrichment?.some(
          (item) => item.path === subMenu.url_path && item.clickable === 'false',
        );
        a.setAttribute('href', `/${lang}/${subMenu.url_path}`);
        if (isNotClickable) {
          a.removeAttribute('href');
          a.classList.add('non-clickable');
        }

        a.setAttribute('data-level', subMenu?.level);
        a.setAttribute('id', `submenu-link-${subMenu?.id}`);

        let checkForLavelImages = false;
        if (mobileNavWithImage && isMobileDevice()) {
          checkForLavelImages = (subMenu?.level === 2) || (subMenu?.level >= 3 && hasAllImages);
        }

        // By default the icons will be added
        // icons won't be added only if isL2NavIconEnabled is configured and value is FALSE
        const addIcons = subMenu?.image && !(isL2NavIconEnabled === 'false')
        && (mobileNavWithImage ? checkForLavelImages : true);
        if (addIcons) {
          const icon = document.createElement('img');
          icon.classList.add('menu-icon');
          icon.setAttribute('src', subMenu?.image || '');
          a.append(icon);
        }

        const menuText = document.createElement('span');
        menuText.innerText = subMenu.name;
        a.append(menuText);

        if (subMenu?.level <= 3 && subMenu?.children?.length > 0) {
          a.setAttribute('data-menu-id', subMenu?.id);
          a.classList.add('parent-menu');
        }
        li.appendChild(a);
        if (!checkForLavelImages && isMobileDevice()) {
          li.classList.add('no-images'); // Use CSS to handle alignment
        }

        // TODO: update the if conditon after MDC change in flag for brand.
        if (enableShoeSizeNavigation
          && subMenu?.show_filters_shoe_size === 1
          && subMenu?.name === 'SHOP BY SHOE SIZE') {
          // Add shoe size filter only when enabled.
          addFilter(menu, subMenu, li, 'shoeSize');
        }
        // TODO: update the if conditon after MDC change in flag for brand.
        if (enableShoeSizeNavigation && subMenu?.name === 'Brands') {
          addFilter(menu, subMenu, li, 'brand');
        }

        if (subMenu?.children?.length > 0) {
          li.appendChild(buildDynamicSubMenus(
            subMenu,
            placeholders,
            promotions,
            categoryEnrichment,
          ));
        }

        subMenuUl.appendChild(li);
      }
    });
  }

  if (menu?.display_view_all === 1) {
    const li = document.createElement('li');
    li.classList.add('submenu-li', 'submenu-li-viewall');

    const a = document.createElement('a');
    a.classList.add('submenu-link', 'submenu-link-viewall', 'parent-menu');
    a.setAttribute('href', `/${lang}/${menu.url_path}/view-all`);

    const menuText = document.createElement('span');
    menuText.innerText = placeholders.viewAll || 'View All';
    a.append(menuText);

    li.appendChild(a);
    if (isMobileDevice() && subMenuUl.firstChild.classList.contains('submenu-header')) {
      subMenuUl.firstChild.insertAdjacentElement('afterend', li);
    } else {
      subMenuUl.prepend(li);
    }
  }

  if (menu?.banners) {
    menu.banners.split(',').forEach((path) => {
      const formattedPath = path.trim();
      const subMenuBannerLi = document.createElement('li');
      subMenuBannerLi.classList.add('submenu-banner-wrapper');

      loadFragment(formattedPath).then((fragment) => {
        if (fragment) {
          const cardBody = fragment.querySelector('.cards-card-body');
          if (cardBody) {
            const pTags = Array.from(cardBody.querySelectorAll('p'));
            pTags.reverse().forEach((pTag) => {
              cardBody.appendChild(pTag);
            });
          }
          subMenuBannerLi.appendChild(fragment);
          subMenuUl.appendChild(subMenuBannerLi);
        }
      }).catch((error) => {
        console.error('Error rendering fragment ', error);
      });
    });
  }

  return subMenuUl;
};

const membershipNumberFormat = (number) => {
  const formattedNumber = number?.replace(/(\d{4})(?=\d)/g, '$1 ')?.trim();
  return `${formattedNumber}`;
};

// Header Mobile Nav Aura widget block
async function auraNavMobileBlock(
  auraCustomerData,
  auraCustomerPoints,
  auraCustomerTiersData,
  auraConfigs,
) {
  const placeholders = await fetchPlaceholdersForLocale();
  const auraGuestMemberNumber = JSON.parse(localStorage.getItem('aura_common_data') || '{}')?.aura_membership;
  const auraMembershipNumber = auraCustomerData?.apc_identifier_number;
  const formattedMembership = auraMembershipNumber ? membershipNumberFormat(auraMembershipNumber) : '';

  // Create the main container
  const newElement = document.createElement('div');
  newElement.className = 'aura-nav';

  // Check for CLM downtime first
  if (auraConfigs.clmDowntime === 'true') {
    newElement.innerHTML = `
      <div class="aura-clm-downtime-banner">
        <span class="icon icon-aura-icon"></span>
        <p class="notification-text">
          ${placeholders.auraClmDowntimePopup || 'Aura is offline to refresh and enhance your experience and will be back soon. Please try again in some time.'}
        </p>
      </div>`;
  } else if (
    isLoggedInUser()
    && (auraCustomerData?.apc_link === 2 || auraCustomerData?.apc_link === 3)
  ) {
    let pointBalance = auraConfigs.currencyformat.format(
      ((parseInt(auraCustomerPoints?.apc_points, 10)) || 0) * auraConfigs.auraPointsConversion,
    );
    pointBalance = pointBalance.split('\u00A0').reverse().join(' ');
    newElement.innerHTML = `
      <div class="aura-nav-container">
        <div class="aura-nav-logo-container">
          <div class="logo-container">
            <span class="icon icon-aura-logo-color"></span>
            <span class="icon icon-aura-word-color"></span>
          </div>
        </div>
        <div class="aura-nav-content-container">
          <div class="aura-nav-desc">
            <div class="aura-nav-name">
              <p>${auraCustomerData?.apc_first_name} ${auraCustomerData?.apc_last_name}</p>
            </div>
            <div class="aura-nav-details">
              <div class="aura-nav-details-tier">
                <p class="my-tier">${placeholders.auraMytierTitle || 'My tier'}</p>
                <p class="my-tier-val">${auraCustomerTiersData.tier_info}</p>
              </div>
              <div class="aura-nav-details-points">
                <p class="my-points">${placeholders.auraPointsBalanceTitle || 'Points value '}</p>
                <p class="my-points-val">${pointBalance}</p>
              </div>
            </div>
          </div>
          <div class="aura-nav-link-wrapper">
            <div class="aura-nav-link-container-learn">
              <a href="/${lang}${auraConfigs.auraLearnmoreLink}">${placeholders.auraMobileNavLearnMore || 'Learn more'}</a>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (isLoggedInUser() && auraCustomerData?.apc_link === 1) {
    newElement.innerHTML = `
    <div class="aura-nav-container">
      <div class="aura-nav-logo-container">
        <div class="logo-container">
          <span class="icon icon-aura-logo-color"></span></a>
          <span class="icon icon-aura-word-color"></span></a>
        </div>
      </div>
      <div class="aura-nav-content-container">
        <div class="aura-nav-desc">
          <div class="aura-nav-accNum">
          <p>${placeholders.auraAccountNumberTxt || 'Aura account number'}</p>
          <span>${formattedMembership}</span>
          </div>
          <button class='aura-link secondary-btn'>
          ${placeholders.auraLinkText || 'Link your Aura'}
          </button>
          <div class='aura-footer-links'>
          <a href=/${lang}/user/account/aura>${placeholders.auraMobileNavLearnMore || 'Learn More'}</a>
          <div class="aura-nav-link-container-notyou">
            <a>${placeholders.notYouText || 'Not you?'}</a>
          </div>
        </div>
        </div>
      </div>
    </div>
  `;
  } else if (auraGuestMemberNumber) {
    const pointBalance = auraConfigs.currencyformat.format(
      ((parseInt(auraCustomerPoints?.apc_points, 10)) || 0) * auraConfigs.auraPointsConversion,
    );
    newElement.innerHTML = `
    <div class="aura-nav-container">
      <div class="aura-nav-logo-container">
        <div class="logo-container">
          <span class="icon icon-aura-logo-color"></span>
          <span class="icon icon-aura-word-color"></span>
        </div>
      </div>
      <div class="aura-nav-content-container">
        <div class="aura-nav-desc">
          <div class="aura-nav-name">
            <p>${auraCustomerData?.apc_first_name} ${auraCustomerData?.apc_last_name}</p>
          </div>
          <div class="aura-nav-details">
            <div class="aura-nav-details-tier">
              <p class="my-tier">${placeholders.auraMytierTitle || 'My tier'}</p>
              <p class="my-tier-val">${auraCustomerTiersData.tier_info || 'Aura Hello'}</p>
            </div>
            <div class="aura-nav-details-points">
              <p class="my-points">${placeholders.auraPointsBalanceTitle || 'Points value '}</p>
              <p class="my-points-val">${pointBalance}</p>
            </div>
          </div>
        </div>
        <div class="aura-nav-link-wrapper">
          <div class="aura-nav-link-container-learn">
            <a href="/${lang}${auraConfigs.auraLearnmoreLink}">${placeholders.auraMobileNavLearnMore || 'Learn more'}</a>
          </div>
           <div class="aura-nav-link-container-notyou">
              <a>
                  ${placeholders.notYouText || 'Not you'}
              </a>
            </div>
        </div>
      </div>
    </div>
  `;
  } else {
    newElement.innerHTML = `
      <div class="aura-nav-container">
        <div class="aura-nav-logo-container">
          <div class="logo-container">
            <span class="icon icon-aura-logo-color"></span>
            <span class="icon icon-aura-word-color"></span>
          </div>
        </div>
        <div class="aura-nav-content-container">
          <div class="aura-nav-desc">
            <p class="desc">${placeholders.auraMobileNavEarnSpend || 'Earn and spend points when you shop at your favourite brands and unlock exclusive benefits.'}</p>
            <p class="link">
              <a class="learnmore aura-nav-cta-link" href="/${lang}${auraConfigs.auraLearnmoreLink}">
                ${placeholders.auraMobileNavLearnMore || 'Learn more'}
              </a>
            </p>
          </div>
          <div class="aura-nav-link-container">
            <div class="aura-link-button-container">
              <button class="aura-link secondary-btn">
                ${placeholders.auraMobileNavJoinButton || 'Join Aura'}
              </button>
            </div>
            <div class="login-link-container">
              <p>${placeholders.auraMobileNavLinkAuraTitle || 'Already an Aura member?'}</p>
              <p class="login-link link">
                <a class="aura-link-not-now aura-nav-cta-link auto-text">
                ${isLoggedInUser() ? placeholders.auraLinkText || 'Link your aura' : placeholders.auraMobileNavLogin || 'Login'}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  decorateIcons(newElement);
  const navLinkContainer = newElement.querySelector('.aura-nav-link-container');
  if (navLinkContainer) {
    const joinAuraButton = newElement.querySelector('.aura-nav .aura-link.secondary-btn');
    if (joinAuraButton) {
      joinAuraButton.addEventListener('click', () => {
        import('../../scripts/aura/common.js').then((module) => module.default('join'));
      });
    }

    const loginButton = newElement.querySelector('.aura-link-not-now.aura-nav-cta-link.auto-text');
    if (loginButton) {
      loginButton.addEventListener('click', () => {
        import('../../scripts/aura/common.js').then((module) => module.default('link'));
      });
    }
  }

  // Add toggle functionality if .aura-nav-logo-container exists
  const logoContainer = newElement.querySelector('.aura-nav-logo-container');
  if (logoContainer) {
    logoContainer.addEventListener('click', () => {
      const contentContainer = newElement.querySelector('.aura-nav-content-container');
      contentContainer.classList.toggle('active');
      logoContainer.classList.toggle('open');
    });
  }
  const auraNotYou = newElement.querySelector('.aura-nav-link-container-notyou a');
  if (auraNotYou) {
    auraNotYou.addEventListener('click', () => {
      import('../../scripts/aura/common.js').then((module) => module.default('link'));
    });
  }

  return newElement;
}

/**
 * Execution start point for rendering the
 * main menu header navigation to be displayed in the header
 * @returns the main menu header navigation
 */
async function renderHeaderNavigation(auraConfigs) {
  const placeholders = await fetchPlaceholdersForLocale();
  const { items } = await fetchCommerceCategories();

  let categoryEnrichment;
  // Get the links overriden in sharepoint.
  if (hasValue(disableCategoryLink)) {
    try {
      const response = await fetch(new URL(disableCategoryLink, window.location.origin));
      const { data } = await response.json();
      categoryEnrichment = data || null;
    } catch (error) {
      console.error('Failed to fetch category enrichment data:', error);
    }
  }

  const promotions = await getPromotionsData();

  const headerMenuNavs = document.createElement('ul');
  if (items?.[0]?.children.length === 0) {
    return headerMenuNavs;
  }
  // the categories to be diplayed in the navigation
  const dynamicCategories = items?.[0]?.children;

  // The wrapper element to hold the entire navigation element
  const navigationWapper = document.createElement('div');
  navigationWapper.classList.add('nav-wrapper');
  navigationWapper.setAttribute('id', 'nav-wrapper');
  const mainMenuWrapper = document.createElement('div');
  mainMenuWrapper.classList.add('xs-mainmenu-wrapper');
  mainMenuWrapper.setAttribute('id', 'xs-mainmenu-wrapper');

  if (isMobileDevice()) {
    if (mobileNavigationV2 && mobileNavigationV2 !== 'false') {
      const mobileNavHeadingL1 = document.createElement('h5');
      mobileNavHeadingL1.classList.add('mobile-nav-heading-level1');
      mobileNavHeadingL1.setAttribute('id', 'mobile-nav-heading-level1');
      mainMenuWrapper.prepend(mobileNavHeadingL1);
      mobileNavHeadingL1.textContent = placeholders.mobileNavHeading || 'Shop';
    }
  }

  // Creating main menu navigation element
  const mainMenuUl = document.createElement('ul');
  mainMenuUl.classList.add('xs-main-menu-ul');
  mainMenuUl.setAttribute('id', 'xs-main-menu-ul');
  const subMenuWrapper = document.createElement('div');
  subMenuWrapper.classList.add('sub-menu-wrapper');
  subMenuWrapper.setAttribute('id', 'sub-menu-wrapper');
  if (isMobileDevice() && mobileNavWithImage) {
    const subMenus = buildDynamicSubMenus(
      {
        children: dynamicCategories,
        level: mobileNavigationlevel,
        id: mobileNavigationlevel,
      },
      placeholders,
      promotions,
      categoryEnrichment,
    );
    subMenuWrapper.appendChild(subMenus);
  }

  // Iterating over the menu object to create the sub navigation
  dynamicCategories.forEach((menu) => {
    if (menu?.include_in_menu === 1) {
      const promoId = menu?.promo_id;

      if (typeof promoId === 'string' && promoId !== '' && !isShowMenuInNav(promotions, promoId)) {
        return;
      }

      const li = document.createElement('li');
      li.classList.add('main-menu-li', `level-${menu?.level}-li`);
      li.setAttribute('id', `main-menu-li-${menu.id}`);
      li.setAttribute('data-menu-id', menu.id);
      li.setAttribute('data-gtm-name', menu.gtm_name);
      const a = document.createElement('a');
      a.classList.add('xs-main-menu-link');
      if (menu?.children?.length > 0) {
        a.setAttribute('data-menu-id', menu?.id);
        a.setAttribute('data-level', menu?.level);
        a.setAttribute('data-gtm-name', menu?.gtm_name);
      }
      if (mobileNavigationV2 && mobileNavigationV2 !== 'false' && isMobileDevice()) {
        if (menu?.image) {
          const icon = document.createElement('img');
          icon.classList.add('menu-icon');
          icon.setAttribute('src', menu?.image || '');
          a.append(icon);
        }
      }
      const pathName = `/${lang}/${menu.url_path}`;
      const mainMenuText = document.createElement('span');
      a.setAttribute('href', pathName);
      mainMenuText.innerText = menu.name;
      a.appendChild(mainMenuText);
      li.append(a);
      mainMenuUl.appendChild(li);

      if (menu?.children?.length > 0) {
        const subMenus = buildDynamicSubMenus(menu, placeholders, promotions, categoryEnrichment);
        subMenuWrapper.appendChild(subMenus);
      }
    }
  });

  // Appends the navigation elements to the main wrapper
  mainMenuWrapper.appendChild(mainMenuUl);
  navigationWapper.appendChild(mainMenuWrapper);
  navigationWapper.appendChild(subMenuWrapper);
  if (isMobileDevice() && isAuraEnabled) {
    headerFetchAuraData()
      .then(({ customerData, customerPoints, customerTiersData }) => {
        // Call auraNavMobileBlock with the fetched data
        auraNavMobileBlock(customerData, customerPoints, customerTiersData, auraConfigs)
          .then((navBlock) => {
            // Insert the navigation block once it's ready
            navigationWapper.insertAdjacentElement('beforeend', navBlock);
          })
          .catch((error) => {
            console.error('Error while generating navBlock:', error);
          });
      })
      .catch((error) => {
        console.error('Error fetching Aura data:', error);
      });
  }
  return navigationWapper;
}

function highlightSuperCategory(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (container) {
    const listItems = Array.from(container.querySelectorAll('li'));
    listItems.some((li) => {
      const anchor = li.querySelector('a');
      if (anchor && anchor.getAttribute('href') === window.location.pathname) {
        li.classList.add('active');
        return true;
      }
      return false;
    });
  }
}

function formatPointBalance(auraCustomerData, auraConfigs) {
  const pointBalance = auraConfigs.currencyformat.format(
    ((parseInt(auraCustomerData.customerData?.apc_points, 10)) || 0)
    * auraConfigs.auraPointsConversion,
  );
  return pointBalance.split('\u00A0').reverse().join(' ');
}

function createTitleDiv(auraLogoHTML) {
  const titleDiv = document.createElement('div');
  titleDiv.className = 'aura-nav-logo-container';
  titleDiv.innerHTML = auraLogoHTML;
  return titleDiv.innerHTML;
}

function createPointsAuraHTML(auraCustomerData, placeholders, pointBalance, language, auraConfigs) {
  return `
    <div class="aura-nav-container">
      <div class="aura-nav-content-container">
        <div class="aura-nav-desc">
          <div class="aura-nav-name">
            <p>${auraCustomerData?.customerData.apc_first_name} ${auraCustomerData?.customerData.apc_last_name}</p>
          </div>
          <div class="aura-nav-details">
            <div class="aura-nav-details-tier">
              <p class="my-tier">${placeholders.auraMytierTitle || 'My tier'}</p>
              <p class="my-tier-val">${auraCustomerData?.customerTiersData.tier_info || 'Aura Hello'}</p>
            </div>
            <div class="aura-nav-details-points">
              <p class="my-points">${placeholders.auraPointsBalanceTitle || 'Points value '}</p>
              <p class="my-points-val">${pointBalance}</p>
            </div>
          </div>
        </div>
        <div class="aura-nav-link-wrapper">
          <div class="aura-nav-link-container-learn">
            <a href="/${language}${auraConfigs.auraLearnmoreLink}">
              ${placeholders.auraMobileNavLearnmore || 'Learn more'}
            </a>
          </div>
          <div class="aura-nav-link-container-notyou">
            <a>
                ${placeholders.notYouText || 'Not you'}
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initializeAuraHtml(auraCustomerData, auraConfigs, placeholders, auraLogoHTML, language) {
  const pointBalance = formatPointBalance(auraCustomerData, auraConfigs);
  const title = createTitleDiv(auraLogoHTML);
  const newElementHTML = createPointsAuraHTML(
    auraCustomerData,
    placeholders,
    pointBalance,
    language,
    auraConfigs,
  );

  const auraButton = document.querySelector('.aura-points-item');
  createModalFromContent('aura-menu-dialog', title, newElementHTML, ['aura-user-details-popup'], 'no-icon', false, 'icon-aura-close').then(() => {
    const auraNotYouModal = document.querySelector('.aura-user-details-popup');
    if (auraNotYouModal) {
      const auraNotYouButton = auraNotYouModal.querySelector('.aura-nav-link-container-notyou a');
      if (auraNotYouButton) {
        auraNotYouButton.addEventListener('click', () => {
          import('../../scripts/aura/common.js').then((module) => module.default('link'));
        });
      }
    }
  });

  auraButton.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('aura-menu-dialog');
  });
}

async function decorateHeader(block, placeholders, favouritesWidgetTimeout, fragment, auraConfigs) {
  const headerMiddleBlock = document.createElement('div');
  headerMiddleBlock.classList.add('header-middle');
  const headerMiddleTop = document.createElement('div');
  headerMiddleTop.classList.add('header-middle-top');
  headerMiddleTop.setAttribute('id', 'header-middle-top');
  // decorate header DOM
  while (fragment.firstElementChild) {
    if (fragment.firstElementChild.classList.contains('inline-links')) {
      if (fragment.firstElementChild.nextElementSibling.classList.contains('inline-links-v2')) {
        const headerTopDiv = document.createElement('div');
        headerTopDiv.classList.add('header-top');
        headerTopDiv.appendChild(fragment.firstElementChild.nextElementSibling);
        headerTopDiv.prepend(fragment.firstElementChild);
        block.appendChild(headerTopDiv);
      } else {
        block.append(fragment.firstElementChild);
      }
    } else if (fragment.firstElementChild.classList.contains('promo-bar') && isPromotionBarEnabled) {
      // changes to appened promo bar
      const promoBarBlock = document.createElement('div');
      promoBarBlock.classList.add('header-promo-bar');
      promoBarBlock?.append(fragment.firstElementChild);
      block.append(promoBarBlock);

      setTimeout(() => {
        renderSideDrawer();
      });
    } else {
      if ((fragment.firstElementChild.classList.contains('promo-bar')) === true && !isPromotionBarEnabled) {
        const promobar = fragment.firstElementChild;
        promobar.classList.add('hide');
      }
      headerMiddleTop.append(fragment.firstElementChild);
    }
  }
  const auraGuestMemberNumber = JSON.parse(localStorage.getItem('aura_common_data') || '{}')?.aura_membership;

  const auraLogoHTML = `
    <div class="logo-container">
      <span class="icon icon-aura-logo-color"></span>
      <span class="icon icon-aura-word-color"></span>
    </div>
  `;

  if (isAuraEnabled && !auraGuestMemberNumber && !isLoggedInUser()) {
    const headerlinksV2 = document.querySelector('.header .inline-links-v2 ul');
    if (headerlinksV2) {
      const parentNodeV2 = headerlinksV2.parentElement;
      parentNodeV2.prepend(headerlinksV2);
      const auraLogoContainer = document.createElement('li');
      auraLogoContainer.classList.add('aura-nav-desktop-logo-container');
      auraLogoContainer.innerHTML = auraLogoHTML;
      headerlinksV2.prepend(auraLogoContainer);
      auraLogoContainer.addEventListener('click', () => {
        import('../../scripts/aura/common.js').then((module) => module.default('join'));
      });
      decorateIcons(auraLogoContainer);
    }
  }
  headerMiddleBlock.append(headerMiddleTop);
  const menuPopupOverlay = document.createElement('div');
  menuPopupOverlay.classList.add('menu-popup-overlay');
  menuPopupOverlay.setAttribute('id', 'menu-popup-overlay');
  headerMiddleBlock.append(menuPopupOverlay);
  block.append(headerMiddleBlock);

  if (isLoggedInUser()) {
    document.querySelectorAll('.inline-links li a').forEach((ele) => {
      if (ele?.href.endsWith('/user/login')) {
        ele.textContent = `${placeholders.signout}`;
        ele.setAttribute('href', `/${lang}/user/logout`);
        ele.setAttribute('title', `${placeholders.signout}`);
      }
      if (ele?.href.endsWith('/user/register')) {
        ele.parentNode.classList.add('hidden');
      }
    });

    document.querySelector('.header').classList.add('loggedin');
    const headerlinks = document.querySelector('.header .inline-links ul');
    const parentNode = headerlinks.parentElement;
    const welcomeMessage = await getWelcomeMessage(placeholders.welcometext, 'fullname');
    parentNode.insertBefore(welcomeMessage, headerlinks);

    const isChangePasswordVisible = block.querySelector('.inline-links')?.getAttribute('data-hide-change-password');
    if (isChangePasswordVisible === 'false') {
      const changePassword = document.createElement('li');
      const changePasswordlink = document.createElement('a');
      changePasswordlink.textContent = `${placeholders.changePassword || 'Change Password'}`;
      changePasswordlink.setAttribute('href', `/${lang}/user/account/change-password`);
      changePassword.append(changePasswordlink);
      headerlinks.prepend(changePassword);
    }

    const myAccount = document.createElement('li');
    myAccount.classList.add('header-my-account');
    const myAccountlink = document.createElement('a');
    const enableMyAccountLabel = await getConfigValue('enable-myaccount-label');
    if (enableMyAccountLabel === 'true') {
      myAccountlink.textContent = `${placeholders.myAccount || 'My Account'}`;
    } else {
      myAccountlink.classList.add('myaccount-wrapper');
      const profileIcon = document.createElement('span');
      profileIcon.classList.add('icon', 'profile-icon');
      myAccountlink.append(profileIcon);
    }
    myAccountlink.setAttribute('href', `/${lang}/user/account`);
    myAccount.append(myAccountlink);
    headerlinks.prepend(myAccount);
    const currentPath = window.location.pathname;
    const header = document.querySelector('.header');
    const logoutLink = header.querySelector(`li a[title="${placeholders.signout}"]`);
    if (logoutLink?.href.endsWith('/user/logout')) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logout(`${currentPath}`, true);
      });
    }

    if (headerWelcomeSessionEnabled === 'true') {
      let headerlinksV2 = document.querySelector('.header .inline-links-v2 ul');
      const parentNodeV2 = headerlinksV2.parentElement;
      parentNodeV2.insertBefore(welcomeMessage, headerlinksV2);
      headerlinksV2.prepend(myAccount);
      if (isAuraEnabled) {
        headerFetchAuraData()
          .then((auraCustomerData) => {
            // Check if apc_link is 2 or 3
            if (auraCustomerData?.customerData?.apc_link === 2
              || auraCustomerData?.customerData?.apc_link === 3) {
              // Create the <a> tag
              const auraPointsLink = document.createElement('a');
              auraPointsLink.classList.add('aura-points-link');
              auraPointsLink.href = new URL(`${origin}/${lang}${auraConfigs.auraLoginLink}`);
              auraPointsLink.textContent = `${auraCustomerData?.customerData.apc_points || 0} ${placeholders.auraPointValueLabel || 'Points'}`;
              // Wrap the <a> inside an <li>
              const auraLinkWrapper = document.createElement('li');
              const auraTireData = auraCustomerData?.customerTiersData?.tier_code;
              auraLinkWrapper.classList.add('aura-points-item', auraTireData);
              auraLinkWrapper.appendChild(auraPointsLink);
              // Prepend the new list item to headerlinksV2
              headerlinksV2 = document.querySelector('.header .inline-links-v2 ul');
              headerlinksV2.prepend(auraLinkWrapper);
              initializeAuraHtml(auraCustomerData, auraConfigs, placeholders, auraLogoHTML, lang);
            } else if (auraCustomerData?.customerData?.apc_link === 1) {
              const auraMembershipNumber = auraCustomerData?.customerData?.apc_identifier_number;
              const formattedMembership = auraMembershipNumber ? membershipNumberFormat(auraMembershipNumber) : '';
              parentNodeV2.prepend(headerlinksV2);
              parentNodeV2.prepend(headerlinksV2);
              const auraLogoContainer = document.createElement('li');
              auraLogoContainer.classList.add('aura-nav-desktop-logo-container');
              auraLogoContainer.innerHTML = `
              <div class="logo-container">
                  <span class="icon icon-aura-logo-color"></span></a>
                  <span class="icon icon-aura-word-color"></span></a>
                </div>
            `;
              parentNodeV2.insertBefore(welcomeMessage, headerlinksV2);
              headerlinksV2.prepend(auraLogoContainer);
              decorateIcons(auraLogoContainer);
              auraLogoContainer.addEventListener('click', () => {
                const titleDiv = document.createElement('div');
                titleDiv.className = 'aura-nav-logo-container';
                titleDiv.innerHTML = auraLogoHTML;
                const title = titleDiv.innerHTML;

                const newElement = document.createElement('div');
                newElement.className = 'aura-nav';
                newElement.innerHTML = `
                     <div class="aura-nav-container">
                    <div class="aura-nav-content-container">
                     <div class="aura-nav-desc">
                     <div class="aura-loyalty-text">
                     <span>${placeholders.auraLoyaltyAccount}<span>
                     </div>
                      <div class="aura-nav-accNum">
                        <p>${placeholders.auraAccountNumberText || 'Aura account numbgiter'}</p>
                        <span>${formattedMembership}</span>
                      </div>
                      <button class='aura-link secondary-btn'>
                      ${placeholders.auraLinkText || 'Link your Aura'}
                      </button>
                    <div class='aura-footer-links'>
                      <a href=/${lang}/user/account/aura>${placeholders.auraMobileNavLearnMore || 'Learn More'}</a>
                      <a class='aura-nav-link-container-notyou'>${placeholders.notYouText || 'Not you?'}</a>
                    </div>
                  </div>
               </div>
            </div>
           `;
                createModalFromContent(
                  'aura-menu-dialog',
                  title,
                  newElement.innerHTML,
                  ['aura-user-details-popup'],
                  'no-icon',
                  false,
                  'icon-aura-close',
                ).then(() => {
                  const modal = document.querySelector('.aura-user-details-popup');
                  if (modal) {
                    const button = modal.querySelector('.aura-link.secondary-btn');
                    if (button) {
                      button.addEventListener('click', () => {
                        import('../../scripts/aura/common.js').then((module) => module.default('link'));
                      });
                    }
                    const auraNotYouButton = modal.querySelector('.aura-nav-link-container-notyou');
                    if (auraNotYouButton) {
                      auraNotYouButton.addEventListener('click', () => {
                        import('../../scripts/aura/common.js').then((module) => module.default('join'));
                      });
                    }
                  }
                }).catch((error) => {
                  console.error('Error creating modal:', error);
                });
                auraLogoContainer.addEventListener('click', () => {
                  openModal('aura-menu-dialog');
                });
              });
            }
          })
          .catch((error) => {
            console.error('Error fetching aura data:', error);
          });
      }
      headerFetchAuraData()
        .then((auraCustomerData) => {
          const auraMembershipNumber = auraCustomerData?.customerData?.apc_identifier_number;
          if (!auraMembershipNumber) {
            parentNodeV2.prepend(headerlinksV2);
            parentNodeV2.prepend(headerlinksV2);
            const auraLogoContainer = document.createElement('li');
            auraLogoContainer.classList.add('aura-nav-desktop-logo-container');
            auraLogoContainer.innerHTML = `
              <div class="logo-container">
                  <span class="icon icon-aura-logo-color"></span></a>
                  <span class="icon icon-aura-word-color"></span></a>
                </div>
            `;
            parentNodeV2.insertBefore(welcomeMessage, headerlinksV2);
            headerlinksV2.prepend(auraLogoContainer);
            decorateIcons(auraLogoContainer);
            auraLogoContainer.addEventListener('click', () => {
              import('../../scripts/aura/common.js').then((module) => module.default('join'));
            });
          }
        });
      logoutLink?.parentElement?.remove();
    }
  } else if (auraGuestMemberNumber && isAuraEnabled) {
    headerFetchAuraData()
      .then((auraCustomerData) => {
        // Create the <a> tag
        const auraPointsLink = document.createElement('a');
        auraPointsLink.classList.add('aura-points-link');
        auraPointsLink.href = `${lang}${auraConfigs.auraLearnmoreLink}`;
        auraPointsLink.textContent = `${auraCustomerData?.customerData.apc_points || 0} ${placeholders.auraPointValueLabel || 'Points'}`;

        const auraLinkWrapper = document.createElement('li');
        const auraTireData = auraCustomerData?.customerData?.tier_code;
        auraLinkWrapper.classList.add('aura-points-item', auraTireData);
        auraLinkWrapper.appendChild(auraPointsLink);

        const headerlinksV2 = document.querySelector('.header .inline-links-v2 ul');
        headerlinksV2.prepend(auraLinkWrapper);

        // Initialize the Aura menu
        initializeAuraHtml(auraCustomerData, auraConfigs, placeholders, auraLogoHTML, lang);
      })
      .catch((error) => {
        console.error('Error fetching aura data:', error);
      });
  }

  function updateMiniCart(minicartQuantity) {
    const minicartQuantityElement = block.querySelector('.minicart-quantity');
    if (minicartQuantityElement) {
      minicartQuantityElement.textContent = minicartQuantity;
    }
  }

  // trigger refresh of cart data on updateMiniCart event
  window.addEventListener('updateMiniCart', () => {
    getCart(true);
  });

  // Search input placeholder
  const searchSection = headerMiddleBlock.querySelector('.section.search');
  const searchContainer = searchSection.firstElementChild;
  searchContainer.classList.add('search-container');
  const searchLabel = searchSection.textContent.trim();
  searchContainer.innerHTML = `
    <div class="search-field">
      <span class="icon search-icon"></span>
      <input type="text" class="search-input" aria-label="${searchLabel}" placeholder="${placeholders.searchHomePlaceholder}">
      <span class="icon search-close-icon ${isSearchPage() ? '' : 'hide'}"></span>
    </div>
    <div class="search-suggestions hide"></div>`;
  block.append(searchSection.cloneNode(true));
  if (onPlaceholderClick && onPlaceholderClick === 'true') {
    const searchInput = searchContainer.querySelector('.search-input');
    searchInput.addEventListener('focus', () => {
      searchInput.placeholder = '';
    });
    document.addEventListener('click', (event) => {
      if (!searchInput.contains(event.target)) {
        searchInput.placeholder = searchInput.value.trim() === ''
          ? placeholders.searchHomePlaceholder
          : placeholders.searchHomePlaceholder;
      }
    });
  }
  // Brand logo
  const brandLogoContainerOld = headerMiddleBlock.querySelector('.brand-logo p');
  const brandLogoContainer = document.createElement('h1');
  brandLogoContainer.append(...brandLogoContainerOld.children);
  brandLogoContainerOld.replaceWith(brandLogoContainer);
  const brandLogoLink = headerMiddleBlock.querySelector('.brand-logo a');
  brandLogoLink.classList.remove('button');
  brandLogoLink.setAttribute('title', brandLogoLink.textContent);

  // VS & AEO - Super Category
  const superCategory = getMetadata('super-category');
  if (superCategory) {
    highlightSuperCategory('.header-top .inline-links div:first-of-type');
  } else {
    brandLogoLink.innerHTML = '<span class="icon"/>';
  }

  // Search overlay
  if (enableSearchOverlay && enableSearchOverlay !== 'false') {
    const body = document.querySelector('body');
    const popupOverlay = document.querySelector('.menu-popup-overlay');
    searchContainer.innerHTML = `<div class="search-overlay">
    <div class="section brand-logo"></div>
    <div class="search-field">
        <span class="icon search-icon"></span>
        <input type="text" class="search-input" aria-label="${searchLabel}"
            placeholder="${placeholders.searchHomePlaceholder}">
        <span class="icon search-close-icon ${isSearchPage() ? '' : 'hide'}"></span>
    </div>
    <div class="search-suggestions hide"></div>
</div>`;
    searchContainer.querySelector('.brand-logo').append(brandLogoContainer.cloneNode(true));
    const overlayClose = document.createElement('span');
    overlayClose.classList.add('icon', 'overlay-close');
    overlayClose.innerHTML = placeholders.close || 'Close';
    searchContainer.querySelector('.brand-logo').append(overlayClose);
    // Add an event listener to handle the click event
    overlayClose.addEventListener('click', () => {
      // Run the specified code on click
      searchContainer.querySelector('.search-field').classList.remove('is-active');
      searchContainer.querySelector('.search-overlay')?.classList.remove('active');
      searchContainer.querySelector('.search-suggestions').classList.add('hide');
      popupOverlay.classList.remove('active');
      body.classList.remove('search-active');
    });
  }

  // Right links section
  const rightLinkSection = headerMiddleBlock.querySelector('.right-links');
  const rightLinks = ['search', 'profile', 'wishlist', 'cart'];

  // Add Search link
  const searchEl = document.createElement('li');
  searchEl.innerHTML = `<a href="#">${searchLabel}</a>`;
  rightLinkSection.querySelector('ul').prepend(searchEl);

  // Generating icons
  [...rightLinkSection.querySelector('ul').children].forEach((li, i) => {
    li.classList.add(`${rightLinks[i]}-wrapper`);
    const linkEl = li.firstElementChild;
    linkEl.setAttribute('aria-label', linkEl.textContent);
    linkEl.innerHTML = `<span class="icon ${rightLinks[i]}-icon"/>`;

    if (rightLinks[i] === 'cart') {
      const minicartAmount = document.createElement('span');
      minicartAmount.classList.add('minicart-amount');
      const minicartLink = document.createElement('a');
      minicartLink.classList.add('minicart-amount-link');
      const url = new URL(linkEl.href);
      minicartLink.href = url.pathname;
      minicartLink.title = linkEl.title || 'Cart';
      minicartLink.setAttribute('aria-label', linkEl.getAttribute('aria-label') || 'Cart');
      minicartLink.appendChild(minicartAmount);
      li.prepend(minicartLink);
      linkEl.classList.add('minicart-wrapper');
      linkEl.innerHTML = `<span class="minicart-quantity"></span>${linkEl.innerHTML}`;
    } else if (rightLinks[i] === 'search') {
      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('body').classList.add('search-active');
        document.querySelector('.header > .section.search.full-width .search-input').focus();
      });
    }
  });

  // Sticky cart and wishlist menu link set
  const headerWishlistLink = document.querySelector('.header-wrapper .wishlist-wrapper a');
  const headerCartLink = document.querySelector('.header-wrapper .cart-wrapper a');

  const stickyWishlist = document.querySelector('.sticky-filters-wrapper .wishlist-wrapper a');
  const stickyCart = document.querySelector('.sticky-filters-wrapper .minicart-wrapper a');

  // add attributes
  stickyWishlist?.setAttribute('href', `${headerWishlistLink.getAttribute('href')}`);
  stickyCart?.setAttribute('href', `${headerCartLink.getAttribute('href')}`);
  stickyWishlist?.setAttribute('title', `${headerWishlistLink.getAttribute('title')}`);
  stickyCart?.setAttribute('title', `${headerCartLink.getAttribute('title')}`);
  stickyWishlist?.setAttribute('aria-label', `${headerWishlistLink.getAttribute('aria-label')}`);
  stickyCart?.setAttribute('aria-label', `${headerCartLink.getAttribute('aria-label')}`);

  // Hamburger Menu
  const hamburgerMenu = document.createElement('li');
  hamburgerMenu.classList.add('menu-hamburger-wrapper');
  const hamburgerMenuButton = document.createElement('button');
  hamburgerMenuButton.classList.add('menu-hamburger-btn');
  hamburgerMenuButton.setAttribute('id', 'menu-hamburger-btn');
  hamburgerMenuButton.setAttribute('type', 'button');
  hamburgerMenuButton.setAttribute(
    'aria-label',
    placeholders.headerHamburgerLabel || 'Open navigation',
  );

  const hamburgerSpan = document.createElement('span');
  hamburgerSpan.classList.add('icon', 'icon-menu-open');
  hamburgerMenuButton.appendChild(hamburgerSpan);

  decorateIcons(hamburgerMenuButton);

  hamburgerMenu.append(hamburgerMenuButton);
  rightLinkSection.querySelector('ul').append(hamburgerMenu);

  const headerMenu = await renderHeaderNavigation(auraConfigs);

  // Header variation where the header row is split into two rows
  const enableHeaderRowSecond = await getConfigValue('enable-header-row-second');
  const isDesktopView = window.matchMedia('(min-width: 1024px)');
  const brandLogo = document.querySelector('.brand-logo');
  if (enableHeaderRowSecond === 'true' && isDesktopView.matches) {
    brandLogo.insertAdjacentElement('afterend', headerMenu);
  } else {
    headerMiddleBlock.appendChild(headerMenu);
  }

  // Fetches and renders the static navigation menus
  // Register the desktop and mobile events for the navigation menu
  registerMenuEvents();

  addEventToSearchInput(block, placeholders);

  cartApi.cartItemsQuantity.watch((quantity, amount, currency) => {
    const minicartQuantity = quantity > 0 ? quantity : '';
    const minicartAmount = amount > 0 ? amount : '';
    getCurrencyFormatter(currency).then((currencyFormat) => {
      document.querySelectorAll('.minicart-amount').forEach((el) => {
        el.textContent = `${minicartAmount ? currencyFormat.format(minicartAmount) : 0}`;
        if (!minicartAmount || minicartAmount === 0) {
          el.classList.add('hide');
        } else {
          el.classList.remove('hide');
        }
      });
    });

    updateMiniCart(minicartQuantity);
  });

  // wishlist icon state management and event listener for wishlist updates
  const wishlistIcon = block.querySelector('.icon.wishlist-icon');
  if (wishlistIcon) {
    // listen to favourites updated event and switch the icon
    document.querySelector('main').addEventListener('favourites-updated', async (event) => {
      if (event.detail?.showSignIn) {
        const signInWidget = await createFavoriteAddedNotification(event.detail?.product);
        wishlistIcon.closest('.wishlist-wrapper').append(signInWidget);
        const stickyHeaderDesktop = document.querySelector('.sticky-desktop');
        const signInWidgetClone = signInWidget.cloneNode(true);
        if (stickyHeaderDesktop) {
          const wishlistWrapper = stickyHeaderDesktop.querySelector('.sticky-right-part > span');
          wishlistWrapper.append(signInWidgetClone);
          if (!stickyHeaderDesktop.classList.contains('sticky')) {
            // scroll to the widget
            block.scrollIntoView({ behavior: 'smooth' });
          }
        }
        // Remove the widget after defined timeout duration
        setTimeout(() => {
          signInWidget.remove();
          signInWidgetClone.remove();
          window.dispatchEvent(new CustomEvent('favourites-widget-removed', { detail: true }));
        }, favouritesWidgetTimeout || 5000);
      }
    });
  }

  // Navigation level
  document.querySelectorAll('.nav-wrapper a')?.forEach((item) => {
    item?.addEventListener('click', (event) => {
      const targetHref = event.target.closest('a').href;
      const { pathname } = new URL(targetHref);
      const pageArray = pathname.split('/').filter(Boolean);
      if (pageArray.length > 1) {
        const selectedLanguage = pageArray[0];
        const finalPathArray = pageArray.slice(1);
        const navLabels = finalPathArray.map((nav, index) => {
          let navPath = '';
          if (pathname.endsWith('/')) {
            navPath = `/${selectedLanguage}/${finalPathArray.slice(0, index + 1).join('/')}${navPath ? '/' : ''}/`;
          } else if (!pathname.endsWith('/')) {
            navPath = `/${selectedLanguage}/${finalPathArray.slice(0, index + 1).join('/')}${navPath ? '/' : ''}`;
          }
          return document.querySelector(`a[href='${navPath}']`)?.closest('li')?.getAttribute('data-gtm-name') || '';
        });
        switch (navLabels.length) {
          case 1:
            datalayerHeaderNavigationEvent('Main', navLabels[0]);
            break;
          case 2:
            datalayerHeaderNavigationEvent('L2', navLabels[0], navLabels[1]);
            break;
          case 3:
            datalayerHeaderNavigationEvent('L3', navLabels[0], navLabels[1], navLabels[2]);
            break;
          default:
            break;
        }
      }
    });
  });
  document.querySelectorAll('.section.inline-links ul li a')?.forEach((link) => {
    const selectedLanguage = new URL(link?.href).pathname.split('/')[1];
    const linkUrl = new URL(link?.href || '');
    if (linkUrl.pathname === '/en/' || linkUrl.pathname === '/ar/') {
      if (selectedLanguage) {
        const url = new URL(window.location.href);
        url.pathname = url.pathname?.replace(/\/[^/]+/, `/${selectedLanguage}`);
        link.href = url.href;
      }
    }
    link?.addEventListener('click', (event) => {
      const regex = /^\/[a-zA-Z]{2}\/?$/;
      if (regex.test(event.target.pathname)) {
        datalayerLanguageSwitchEvent('Header', selectedLanguage);
      }
    });
  });
  document.addEventListener('click', (event) => {
    if (event.target?.closest('.query-suggestions') && event.target.nodeName === 'A') {
      const links = Array.from(event.target.closest('.query-suggestions').querySelectorAll('a'));
      const index = links.indexOf(event.target);
      dataLayerTrendingSearchEvent(event.target.innerText, index);
    }
  });
}

async function decorateCheckoutHeader(block, placeholders, favouritesWidgetTimeout, fragment) {
  const headerMiddleBlock = document.createElement('div');
  headerMiddleBlock.classList.add('header-middle');
  const headerMiddleTop = document.createElement('div');
  headerMiddleTop.classList.add('header-middle-top');
  headerMiddleTop.setAttribute('id', 'header-middle-top');
  // decorate header DOM
  while (fragment.firstElementChild) {
    headerMiddleTop.append(fragment.firstElementChild);
  }
  headerMiddleBlock.append(headerMiddleTop);
  block.append(headerMiddleBlock);

  // Brand logo
  const brandLogoContainerOld = headerMiddleBlock.querySelector('.brand-logo p');
  const brandLogoContainer = document.createElement('h1');
  brandLogoContainer.append(...brandLogoContainerOld.children);
  brandLogoContainerOld.replaceWith(brandLogoContainer);
  const brandLogoLink = headerMiddleBlock.querySelector('.brand-logo a');
  brandLogoLink.classList.remove('button');
  brandLogoLink.setAttribute('title', brandLogoLink.textContent);
  brandLogoLink.innerHTML = '<span class="icon"></span> <img class="brand-logo-image" src="/icons/logo.svg" alt="logo"/>';
}

async function loadAuraConfigs() {
  const auraConfigs = {};
  // aura links get from config
  auraConfigs.auraLearnmoreLink = await getConfigValue('aura-learnmore-link');
  auraConfigs.auraLoginLink = await getConfigValue('aura-join-link');

  // Fetch configuration and locale data required for Aura points
  const region = await getConfigValue('country-code') || 'AE';
  const currencies = await getConfigValue('currency') || 'AED';
  auraConfigs.currencyformat = await getCurrencyFormatter(currencies);

  auraConfigs.auraPointsConversion = await getConfigValue('aura-conversion-base-value') || await getConfigValue(`aura-conversion-base-value-${region}`);
  auraConfigs.clmDowntime = await getConfigValue('clm-downtime');
  return auraConfigs;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */

export default async function decorate(block) {
  const headerMeta = getMetadata('header');
  const headerCheckoutMeta = getMetadata('header-checkout');
  const placeholders = await fetchPlaceholdersForLocale();
  const favouritesWidgetTimeout = parseInt(await getConfigValue('plp-favorites-widget-timeout-in-seconds'), 10) * 1000;
  block.textContent = '';
  // load header fragment
  const headerPath = headerMeta || `/${lang}/header`;
  const fragment = await loadFragment(headerPath);
  // Toast message observer to handle the scrolls
  const toastObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        document.querySelector('.toast-notification')?.classList.remove('scrolled-toast');
      } else {
        document.querySelector('.toast-notification')?.classList.add('scrolled-toast');
      }
    });
  });
  toastObserver.observe(document.querySelector('header'));

  let auraConfigs = {};

  if (isAuraEnabled) {
    auraConfigs = await loadAuraConfigs();
  }

  if (headerCheckoutMeta === 'true') {
    block.classList.add('checkout-header');
    block.parentElement.classList.add('checkout-header-parent');
    await decorateCheckoutHeader(block, placeholders, favouritesWidgetTimeout, fragment);
  } else {
    await decorateHeader(block, placeholders, favouritesWidgetTimeout, fragment, auraConfigs);
  }

  if (isAuraEnabled) {
    // Aura-info localstorage value getting after modal closed - in Ecom guest
    block.auraInfoObserver?.disconnect();
    block.mutationObserver?.disconnect();
    // Observer to handle modal visibility changes
    const auraInfoObserver = new IntersectionObserver((entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting && target.classList.contains('aura-modal')) {
          decorate(block);
        }
      });
    });
    // Mutation observer to track modal addition/removal
    const mutationObserver = new MutationObserver((mutationsList) => {
      mutationsList.forEach(({ addedNodes, removedNodes }) => {
        addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList.contains('aura-modal')) {
            auraInfoObserver.observe(node);
          }
        });
        removedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.classList.contains('aura-modal')) {
            auraInfoObserver.unobserve(node);
          }
        });
      });
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    block.auraInfoObserver = auraInfoObserver;
    block.mutationObserver = mutationObserver;
  }
  // Handle bfcache scenarios in Safari and other browsers
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      document.body.classList.remove('search-active');
      // Get the full URL
      const url = new URL(window.location.href);
      // Extract the search parameters
      const searchParams = new URLSearchParams(url.search);
      // Get the value of the 'q' parameter
      const query = searchParams.get('q');

      [...document.querySelectorAll('.search-input')].forEach((sInput) => {
        if (!query) {
          sInput.value = '';
        } else {
          sInput.value = query;
        }
        sInput.blur();
      });
    }
  });
}
