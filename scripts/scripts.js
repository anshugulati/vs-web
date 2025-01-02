import {
  sampleRUM,
  createOptimizedPicture as libCreateOptimizedPicture,
  loadCSS,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  fetchPlaceholders, buildBlock,
  toClassName,
} from './aem.js';
import {
  isPDP,
  isPLP,
  loadProduct,
  setJsonLd,
  initProductViewHistory,
  getCookie,
  isOrderConfirmation,
  setCookie,
} from './commerce.js';
import { getConfigValue } from './configs.js';
import { clearOrderFlag, getCustomer } from './customer/api.js';
import { CARTID_STORE } from './minicart/api.js';

export const LOGOUT_SOURCE = 'logout';

const DISABLE_MARTECH = new URL(window.location).searchParams.has('no-martech');
window.DISABLE_MARTECH = DISABLE_MARTECH;

let STICKY_ELEMENTS;
let LAST_SCROLL_POSITION = 0;
let LAST_STACKED_HEIGHT = 0;
let DM_OPENAPI_HOSTNAME = null;
const mobileDevice = window.matchMedia('(max-width: 1024px)');
const isSidekickLibrary = document.body.classList.contains('sidekick-library');

const urlPrefix = '/';

const TEMPLATE_LIST = {
  user: 'user',
  account: 'account',
  'static-page': 'static-page',
  department: 'department',
  sustainability: 'sustainability',
  shopping: 'shopping',
  'tabbed-size-guide': 'tabbed-size-guide',
  'egift-card': 'egift-card',
};

const DYNAMIC_PLACEHOLDER_TEMPLATE_LIST = [
  'static-page',
  'department',
  'sustainability',
  'tabbed-size-guide',
  'egift-card',
  'generic-dynamic-keys-template'];

// List of pageTypes for pre-rendered pages
// Needs to be same as value for each page type set for data layer
const PRE_RENDERED_PAGES = [
  'product detail page',
  'product listing page',
];

const LCP_BLOCKS = [
  'algolia-product-listing',
  'product-list-page',
  'product-list-page-custom',
  'product-details',
  'commerce-cart',
  'commerce-checkout',
  'commerce-account',
  'commerce-login',
  'carousel',
]; // add your LCP blocks to the list

export const DOMPurifyConfig = { USE_PROFILES: { html: false } };

export function getBrandCode() {
  return getMetadata('brand') || 'bat';
}

export function getSuerCategoriesCode() {
  return getMetadata('super-category');
}

export function getBrandPath() {
  const brandCode = getMetadata('brand');
  return `${(brandCode !== '') ? `${brandCode}/` : ''}`;
}

/**
 * Loads JS and CSS for a block.
 * @param {Element} block The block element
 */
async function loadBlock(block) {
  const status = block.dataset.blockStatus;
  if (status !== 'loading' && status !== 'loaded') {
    block.dataset.blockStatus = 'loading';
    const { blockName } = block.dataset;
    try {
      const cssLoaded = loadCSS(`${window.hlx.codeBasePath}/blocks/${blockName}/${getBrandPath()}${blockName}.css`);

      const decorationComplete = new Promise((resolve) => {
        (async () => {
          try {
            const mod = await import(
              `${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.js`
            );
            if (mod.default) {
              await mod.default(block);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.log(`failed to load module for ${blockName}`, error);
          }
          resolve();
        })();
      });
      await Promise.all([cssLoaded, decorationComplete]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`failed to load block ${blockName}`, error);
    }
    block.dataset.blockStatus = 'loaded';
  }
  return block;
}

/**
 * Updates all section status in a container element.
 * @param {Element} main The container element
 */
function updateSectionsStatus(main) {
  const sections = [...main.querySelectorAll(':scope > div.section')];
  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const status = section.dataset.sectionStatus;
    if (status !== 'loaded') {
      const loadingBlock = section.querySelector(
        '.block[data-block-status="initialized"], .block[data-block-status="loading"]',
      );
      if (loadingBlock) {
        section.dataset.sectionStatus = 'loading';
        break;
      } else {
        section.dataset.sectionStatus = 'loaded';
        section.style.display = null;
      }
    }
  }
}
/**
 * Loads JS and CSS for all blocks in a container element.
 * @param {Element} main The container element
 */
async function loadBlocks(main) {
  updateSectionsStatus(main);
  const blocks = [...main.querySelectorAll('div.block')];
  for (let i = 0; i < blocks.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await loadBlock(blocks[i]);
    updateSectionsStatus(main);
  }
}

/**
 * Decorates a block.
 * @param {Element} block The block element
 */
function decorateBlock(block) {
  const shortBlockName = block.classList[0];
  if (shortBlockName) {
    block.classList.add('block');
    block.dataset.blockName = shortBlockName;
    block.dataset.blockStatus = 'initialized';
    const blockWrapper = block.parentElement;
    blockWrapper.classList.add(`${shortBlockName}-wrapper`);
    const section = block.closest('.section');
    if (section) section.classList.add(`${shortBlockName}-container`);
  }
}

/**
 * Loads a block named 'header' into header
 * @param {Element} header header element
 * @returns {Promise}
 */
async function loadHeader(header) {
  const headerBlock = buildBlock('header', '');
  header.append(headerBlock);
  decorateBlock(headerBlock);
  return loadBlock(headerBlock);
}

/**
 * Loads a block named 'footer' into footer
 * @param footer footer element
 * @returns {Promise}
 */
async function loadFooter(footer) {
  const footerBlock = buildBlock('footer', '');
  footer.append(footerBlock);
  decorateBlock(footerBlock);
  return loadBlock(footerBlock);
}

/**
 * Check if the current environment is a mobile app by checking the cookie existence
 * @returns {boolean} true if the current environment is a mobile app
 */
export function isMobileApp() {
  return document.cookie.includes('app-view=true');
}

/**
 * Fallback for browsers that do not support Custom Properties
 * @returns {size} in vh
 */
function updateVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', updateVh);
window.addEventListener('orientationchange', updateVh);
updateVh();

/**
 * Returns the true of the current page in the browser.mac
 * If the page is running in a iframe with srcdoc,
 * the ancestor origin + the path query param is returned.
 * @returns {String} The href of the current page or the href of the block running in the library
 */
export function getHref() {
  if (window.location.href !== 'about:srcdoc') return window.location.href;

  const { location: parentLocation } = window.parent;
  const urlParams = new URLSearchParams(parentLocation.search);
  return `${parentLocation.origin}${urlParams.get('path')}`;
}

/**
 * Returns the current timestamp used for scheduling content.
 */
export function getTimestamp() {
  if ((window.location.hostname === 'localhost' || window.location.hostname.endsWith('.hlx.page') || window.location.hostname.endsWith('.aem.page')) && window.sessionStorage.getItem('preview-date')) {
    return Date.parse(window.sessionStorage.getItem('preview-date'));
  }
  return Date.now();
}

export function buildUrlKey() {
  // fetch urlkey from url
  const path = window.location.pathname;

  let urlKeys = path.split('/');
  // check if the first part of the url is a language code
  if (urlKeys.length > 2 && urlKeys[1].match(/^[a-z]{2}$/)) {
    urlKeys = urlKeys.slice(2);
  } else {
    urlKeys = urlKeys.slice(1);
  }

  const urlKey = urlKeys.join('/');

  return urlKey;
}

/**
 * Returns the document language attribute value
 * @returns String language value
 */
export function getLanguageAttr() {
  return document.documentElement?.lang || 'en';
}

/**
 * Checks if the current page is a search page.
 * @returns {boolean} Returns true if the current page is a search page, otherwise returns false.
 */
export function isSearchPage() {
  return window.location.pathname.startsWith(`/${getLanguageAttr()}/search`);
}

export function isPromotionPage() {
  return window.location.pathname.startsWith(`/${getLanguageAttr()}/promotion/`);
}

function expireCartInLocalStorage() {
  const cartId = window.localStorage.getItem(CARTID_STORE);
  if (cartId) {
    const parsed = JSON.parse(cartId);
    parsed.expiryTime = Date.now() - 1;
    window.localStorage.setItem(CARTID_STORE, JSON.stringify(parsed));
  }
}

/**
 * Of the current web page's hostname, delete the cookie from top-most domain that is
 * not a "public suffix" as outlined in https://publicsuffix.org/. In other
 * words, this is top-most domain that is able to accept cookies.
 * @param {string} orgId Target organization ID
 */
export function deleteTopLevelAlloyCookies(orgId) {
  let topLevelCookieDomain = '';
  const baseCookieName = `kndctr_${orgId?.replace(/@/g, '_')}`;
  // If hostParts.length === 1, we may be on localhost.
  const hostParts = window.location.hostname.toLowerCase().split('.');
  let i = 1;
  while (i < hostParts.length && getCookie(`${baseCookieName}_identity`)) {
    i += 1;
    topLevelCookieDomain = hostParts?.slice(-i).join('.');
    setCookie(`${baseCookieName}_cluster`, '', -1, `.${topLevelCookieDomain}`, true);
    setCookie(`${baseCookieName}_identity`, '', -1, `.${topLevelCookieDomain}`, true);
  }
}

// Helper function to create an element with dynamic classes and attributes
export function createElement(tag, classes = [], attributes = {}, content = '') {
  const element = document.createElement(tag);
  // Add classes.
  element.classList.add(...classes);
  // Set attributes.
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  // Set inner content text or HTML.
  element.innerHTML = content;
  return element;
}

/**
 * Calls placeholders for a current document language
 * @returns placeholders for the language
 */
export async function fetchPlaceholdersForLocale() {
  const langCode = document.documentElement.lang;
  let placeholders = null;
  if (!langCode) {
    placeholders = await fetchPlaceholders();
  } else {
    placeholders = await fetchPlaceholders(`/${langCode.toLowerCase()}`);
  }

  return placeholders;
}

// eslint-disable-next-line max-len
export async function createModal(id, title, content, classList, titleIconClass, appendAsHTML = false, closeIcon = 'icon-close', callback = false) {
  const { close } = await fetchPlaceholdersForLocale();

  const dialog = document.createElement('dialog');
  if (classList) dialog.classList.add(...classList);
  const dialogTitle = document.createElement('div');
  dialogTitle.classList.add('modal-header');
  const titleIconClassValue = titleIconClass ? `icon icon-${titleIconClass} icon-title-left` : '';
  dialogTitle.innerHTML = `<span class="${titleIconClassValue}"></span><h4>${title}</h4`;
  const closeButton = document.createElement('button');
  closeButton.classList.add('modal-close');
  closeButton.setAttribute('aria-label', close);
  closeButton.type = 'button';
  closeButton.innerHTML = `<span class="icon ${closeIcon}"></span>`;
  closeButton.addEventListener('click', () => {
    if (dialog.classList.contains('close-transition')) {
      dialog.classList.add('closing');
      setTimeout(() => {
        dialog.close();
        dialog.classList.remove('closing');
      }, 500);
    } else {
      dialog.close();
    }
    if (callback) {
      callback();
    }
  });
  dialogTitle.append(closeButton);
  dialog.append(dialogTitle);

  const dialogContent = document.createElement('div');
  dialogContent.classList.add('modal-content');
  if (appendAsHTML) {
    dialogContent.append(content);
    dialog.append(dialogContent);
  } else {
    dialogContent.innerHTML = content;
    dialog.append(dialogContent);
  }

  // close dialog on clicks outside the dialog.
  dialog.addEventListener('click', (event) => {
    const stickyActionFooter = document.querySelector('.pdp-product__actions.button-bar-wishlist');
    const dialogDimensions = dialog.getBoundingClientRect();
    if (
      (event.clientX < dialogDimensions.left
      || event.clientX > dialogDimensions.right
      || event.clientY < dialogDimensions.top
      || event.clientY > dialogDimensions.bottom
      ) && !stickyActionFooter) {
      dialog.close();
    }
  });

  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));

  const modalBlock = document.createElement('div');
  modalBlock.id = id;
  modalBlock.classList.add('modal');
  if (document.querySelector(`#${id}`)) {
    document.querySelector(`#${id}`).remove();
  }
  document.querySelector('main').append(modalBlock);
  modalBlock.append(dialog);
  decorateIcons(dialogTitle);
}

export async function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.querySelector('dialog').showModal();
    setTimeout(() => {
      modal.querySelector('.modal-content').scrollTop = 0;
    }, 0);
    document.body.classList.add('modal-open');
  }
}

export async function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
    document.body.classList.remove('modal-open');
  }
}

export async function logout(redirectUrl, sendDlEvents = false) {
  if (sendDlEvents === true) {
    const {
      getLoggedInUserAttributes = () => {},
      datalayerLogout = () => {},
      getPageName = () => {},
    } = DISABLE_MARTECH ? {} : await import('./analytics/google-data-layer.js');
    const userDetails = await getLoggedInUserAttributes(false);
    const payload = {
      aep_page_name: getPageName(window.pageType),
      ...userDetails,
    };
    datalayerLogout('Attempt', payload);
    datalayerLogout('Success');
  }
  setCookie('auth_user_token', '', -1);
  setCookie('auth_firstname', '', -1);
  localStorage.removeItem('aura_common_data');
  clearOrderFlag();
  const url = new URL(redirectUrl, window.location.origin);

  // Commenting it for Now as per client directions. To be enabled later.
  // getConfigValue('target-org-id').then((orgId) => {
  //   deleteTopLevelAlloyCookies(orgId); //Clear alloy cookies related to the current org
  //   window.location.href = url.toString();
  // });
  // Introduced delay for GTM/AEP events events sync before logout
  setTimeout(() => {
    // Expire the cart in local storage
    expireCartInLocalStorage();
    window.location.href = url.toString();
  }, 500);
}

async function isAuthTokenValid(token) {
  try {
    const { jwtDecode } = await import('./third-party/jwt.js');
    const decodedToken = jwtDecode(token);

    if (!decodedToken) {
      throw new Error('Invalid token structure');
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp > currentTime) {
      return true;
    }
    logout(`/${getLanguageAttr()}/user/login`, window.location.href);
    return false;
  } catch (err) {
    console.error('Error occurred while decoding token:', err);
    return false;
  }
}

/**
 * Returns the log in status of the user
 * @returns {boolean} true if the user is logged in
 */
export function isLoggedInUser() {
  const authToken = getCookie('auth_user_token');
  return !!(authToken && isAuthTokenValid(authToken));
}

/**
 * Returns if the user is linked to the aura
 * @returns {boolean} true if the user is linked to aura
 */
export function isAruaLinked() {
  const auraCommonData = JSON.parse(localStorage.getItem('aura_common_data') || '{}');
  return auraCommonData.aura_enrollmentStatus !== null;
}

/**
 * Loads Scroll to Top into main
 * @param {Element} main The container element
 */
async function decorateScrollToTop(main) {
  // creating icon for scroll to top
  const spanIcon = document.createElement('span');
  spanIcon.classList.add('icon', 'icon-arrow-top');

  // creating button for scroll to top
  const button = document.createElement('button');
  button.classList.add('backtotop');
  const placeholders = await fetchPlaceholders(`${urlPrefix + document.documentElement.lang}`);
  const { backToTop } = placeholders;
  button.setAttribute('aria-label', backToTop);
  button.appendChild(spanIcon);

  // Adding 'Back to Top' text next to the icon
  const isBackToTop = await getConfigValue('is-back-to-top-text');
  if (isBackToTop && isBackToTop !== 'false') {
    const buttonText = document.createTextNode(backToTop);
    button.appendChild(buttonText);
  }

  // creating container for scroll to top
  const backToTopContainer = document.createElement('div');
  backToTopContainer.classList.add('scroll-to-top');
  if (window.scrollY < 100) {
    backToTopContainer.classList.add('hide');
  }
  backToTopContainer.appendChild(button);

  // dcorating icons & appending scroll to top button to main
  decorateIcons(backToTopContainer);
  main.appendChild(backToTopContainer);

  const overlayBackground = document.createElement('div');
  overlayBackground.classList.add('generic-overlay-background');
  main.appendChild(overlayBackground);

  // adding event listener to scroll to top button
  backToTopContainer.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // adding event listener to show/hide scroll to top button
  document.addEventListener('scroll', () => {
    if (window.scrollY < 100) {
      backToTopContainer.classList.add('hide');
    } else {
      backToTopContainer.classList.remove('hide');
    }
  }, { passive: true });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/${getBrandPath()}fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/*
  * Appends query params to a URL
  * @param {string} url The URL to append query params to
  * @param {object} params The query params to append
  * @returns {string} The URL with query params appended
  * @private
  * @example
  * appendQueryParams('https://example.com', { foo: 'bar' });
  * // returns 'https://example.com?foo=bar'
*/
function appendQueryParams(url, params) {
  const { searchParams } = url;
  params.forEach((value, key) => {
    searchParams.set(key, value);
  });
  url.search = searchParams.toString();
  return url.toString();
}

/**
 * to check if given src is a DM OpenAPI URL
 */
function isDMOpenAPIUrl(src) {
  return /^(https?:\/\/(.*)\/adobe\/assets\/urn:aaid:aem:(.*))/gm.test(src);
}

export function createOptimizedPicture(src, isDMOpenAPI = false, alt = '', eager = false, breakpoints = [{ media: '(min-width: 600px)', width: '2000' }, { width: '750' }]) {
  const isAbsoluteUrl = /^https?:\/\//i.test(src);

  // Fallback to createOptimizedPicture if src is not an absolute URL
  if (!isAbsoluteUrl) return libCreateOptimizedPicture('/icons/fallback.svg', alt, eager, breakpoints);

  const url = new URL(src);
  const picture = document.createElement('picture');
  const { pathname } = url;
  const ext = pathname.substring(pathname.lastIndexOf('.') + 1);

  // in case of webp format, we are defining a fallback jpg here if webp not supported by client
  // by default, first preference would be given to webp only via param preferwebp=true
  const renderformat = isDMOpenAPI ? 'jpg' : 'webply';

  // webp
  breakpoints.forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    const searchParams = new URLSearchParams({ width: br.width, format: renderformat });
    source.setAttribute('srcset', appendQueryParams(url, searchParams));
    picture.appendChild(source);
  });

  // fallback
  breakpoints.forEach((br, i) => {
    const searchParams = new URLSearchParams({ width: br.width, format: ext });

    if (i < breakpoints.length - 1) {
      const source = document.createElement('source');
      if (br.media) source.setAttribute('media', br.media);
      source.setAttribute('srcset', appendQueryParams(url, searchParams));
      picture.appendChild(source);
    } else {
      const img = document.createElement('img');
      img.setAttribute('alt', alt);
      img.onerror = function (event) {
        event.onerror = null;
        const originalUrl = appendQueryParams(url, searchParams);
        img.setAttribute('data-original-url', originalUrl);
        const elements = Array.from(event.target.parentNode.children);
        const fallbackSrc = '/icons/fallback.svg';
        elements.forEach((element) => {
          if (element.tagName.toLowerCase() === 'source') {
            element.srcset = fallbackSrc;
          } else if (element.tagName.toLowerCase() === 'img') {
            element.classList.add('fallback');
            element.src = fallbackSrc;
          }
        });
      };
      img.setAttribute('loading', eager ? 'eager' : 'lazy');
      picture.appendChild(img);
      img.setAttribute('src', appendQueryParams(url, searchParams));
    }
  });

  return picture;
}

/**
 * Gets the cleaned up URL removing barriers to get picture src.
 * @param {string} url The URL
 * @returns {string} The normalised url
 * @private
 * @example
 * get_url_extension('https://delivery-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/original/as/strawberry.jpg?preferwebp=true');
 * // returns 'https://delivery-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/as/strawberry.jpg?preferwebp=true'
 * get_url_extension('https://delivery-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/as/strawberry.jpg?accept-experimental=1&preferwebp=true');
 * // returns 'https://delivery-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/as/strawberry.jpg?preferwebp=true'
 * get_url_extension('https://delivery-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/as/strawberry.jpg?width=2048&height=2048&preferwebp=true');
 * // returns 'https://delivery-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/as/strawberry.jpg?preferwebp=true'
 * get_url_extension('https://author-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/as/strawberry.jpg?accept-experimental=1&width=2048&height=2048&preferwebp=true');
 * // returns 'https://author-p129624-e1269699.adobeaemcloud.com/adobe/assets/urn:aaid:aem:a...492d81/as/strawberry.jpg?accept-experimental=1&width=2048&height=2048&preferwebp=true'
 */
export function createOptimizedSrc(src, isDMOpenAPI = false) {
  const srcUrl = new URL(src);
  if (isDMOpenAPI) {
    srcUrl.searchParams.delete('accept-experimental');
    srcUrl.searchParams.delete('width');
    srcUrl.searchParams.delete('height');
    srcUrl.pathname = srcUrl.pathname.replace('/original/', '/');
  }
  return srcUrl.toString();
}

/**
 * Gets the extension of a URL.
 * @param {string} url The URL
 * @returns {string} The extension
 * @private
 * @example
 * get_url_extension('https://example.com/foo.jpg');
 * // returns 'jpg'
 * get_url_extension('https://example.com/foo.jpg?bar=baz');
 * // returns 'jpg'
 * get_url_extension('https://example.com/foo');
 * // returns ''
 * get_url_extension('https://example.com/foo.jpg#qux');
 * // returns 'jpg'
 */
function getUrlExtension(url) {
  return url.split(/[#?]/)[0].split('.').pop().trim();
}

function isExternalImage(element, externalImageMarker) {
  // if the element is not an anchor, it's not an external image
  if (element.tagName !== 'A') return false;

  // if the element is an anchor with the external image marker as text content,
  // it's an external image
  if (element.textContent.trim() === externalImageMarker) {
    return true;
  }

  // if the href has an image extension, it's an external image
  const ext = getUrlExtension(element.getAttribute('href'));
  return (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext.toLowerCase()));
}

async function decorateExternalImages(ele, deliveryMarker) {
  if (!DM_OPENAPI_HOSTNAME) {
    DM_OPENAPI_HOSTNAME = (await getConfigValue('dm-openapi-domain'))?.trim();
  }
  const extImages = ele.querySelectorAll('a');
  extImages.forEach((extImage) => {
    if (isExternalImage(extImage, deliveryMarker) && !extImage.classList.contains('hide')) {
      const isDMOpenAPI = isDMOpenAPIUrl(extImage.getAttribute('href'));
      const extImageSrc = createOptimizedSrc(extImage.getAttribute('href'), isDMOpenAPI);
      const extPicture = createOptimizedPicture(extImageSrc, isDMOpenAPI);

      /* copy query params from link to img */
      const extImageUrl = new URL(extImageSrc);
      const { searchParams } = extImageUrl;
      extPicture.querySelectorAll('source, img').forEach((child) => {
        if (child.tagName === 'SOURCE') {
          const srcset = child.getAttribute('srcset');
          if (srcset) {
            const queryParams = appendQueryParams(new URL(srcset, extImageSrc), searchParams);
            child.setAttribute('srcset', queryParams);
          }
        } else if (child.tagName === 'IMG') {
          const src = child.getAttribute('src');
          if (src) {
            const queryParams = appendQueryParams(new URL(src, extImageSrc), searchParams);
            child.setAttribute('src', queryParams);
          }
        }
      });

      if (isSidekickLibrary) {
        extImage.classList.add('hide');
        extImage.setAttribute('aria-hidden', true);
        extImage.closest('p')?.classList.remove('button-container');
        extImage.parentNode.appendChild(extPicture);
      } else {
        extImage.closest('p')?.classList.remove('button-container');
        extImage.parentNode.replaceChild(extPicture, extImage);
      }
    }
  });
}

/**
 * Sets external target and rel for links in a main element.
 * @param {Element} main The main element
 */
function updateExternalLinks(main) {
  const REFERERS = [
    window.location.origin,
  ];
  main.querySelectorAll('a[href]').forEach((a) => {
    try {
      const { origin, pathname, hash } = new URL(a.href, window.location.href);
      const targetHash = hash && hash.startsWith('#_');
      const isPDF = pathname.split('.').pop() === 'pdf';
      if ((origin && origin !== window.location.origin && !targetHash) || isPDF) {
        a.setAttribute('target', '_blank');
        if (!REFERERS.includes(origin)) a.setAttribute('rel', 'noopener');
      } else if (targetHash) {
        a.setAttribute('target', hash.replace('#', ''));
        a.href = a.href.replace(hash, '');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Invalid link in ${main}: ${a.href}`);
    }
  });
}

function linkPicture(picture) {
  const next = picture.parentNode.nextElementSibling;
  if (next) {
    const a = next.querySelector('a');
    if (a && a.textContent.startsWith('https://')) {
      a.innerHTML = '';
      a.className = '';
      a.appendChild(picture);
    }
  }
}

/**
 * Adds link to images
 * @param {Element} main The main element
 */
function decorateLinkedPictures(main) {
  main.querySelectorAll('picture').forEach((picture) => {
    if (!picture.closest('div.block')) {
      linkPicture(picture);
    }
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
async function buildAutoBlocks(main) {
  try {
    const templateMetadata = getMetadata('template');
    const templates = templateMetadata?.split(',').map((template) => toClassName(template.trim())) || [];
    const availableTemplates = Object.keys(TEMPLATE_LIST);
    templates.forEach(async (template) => {
      if (availableTemplates.includes(template)) {
        const templateName = TEMPLATE_LIST[template];
        const decorator = await Promise.all([
          import(`../templates/${templateName}/${templateName}.js`),
          loadCSS(`${window.hlx.codeBasePath}/templates/${templateName}/${getBrandPath()}${templateName}.css`),
        ]).then(([mod]) => mod.default);
        if (decorator) {
          await decorator(main);
        }
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates target specific blocks like recommendations and personalization.
 * Read the metadata required for target from the block and set them as data attributes.
 * @param {Element} main The main element
 */
function decorateTargetBlocks(main) {
  main.querySelectorAll(
    'div.section > div > div.recommendations, div.section > div > div.personalization',
  )?.forEach((block) => {
    block.querySelectorAll(':scope > div').forEach((row) => {
      const key = row.children[0]?.innerText;
      let value;
      if (block.classList.contains('tab')) {
        value = row.querySelector('a')?.getAttribute('href');
      } else {
        value = row.children[1]?.innerText;
      }
      block.dataset[key] = value || '';
      block.innerHTML = '';
    });
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // decorate external images with explicit external image marker
  decorateExternalImages(main, '//External Image//');

  // decorate external images with implicit external image marker
  decorateExternalImages(main);

  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateTargetBlocks(main);
  updateExternalLinks(main);
  decorateLinkedPictures(main);
}

const REGEX_PLACEHOLDER = /\{\{([A-Za-z\-0-9]+)\}\}/ig;
function findAllPlaceholders(str) {
  return [...str.matchAll(REGEX_PLACEHOLDER)];
}

function replacePlaceholdersInString(str, placeholders) {
  return str.replace(REGEX_PLACEHOLDER, (match, p1) => placeholders[p1] || match);
}

export function replacePlaceholders(element, placeholders) {
  // Create a DocumentFragment to minimize reflows
  const fragment = document.createDocumentFragment();

  // Clone the original element's content to avoid altering the live DOM immediately
  const clonedElement = element.cloneNode(true);

  // Append the cloned content to the DocumentFragment
  fragment.appendChild(clonedElement);

  // Cache the nodes in the cloned content
  const nodes = clonedElement.querySelectorAll('p, li, h2, h3, h4, h5, h6, div, td');

  let hasUpdates = false;
  nodes.forEach((node) => {
    const { innerHTML } = node;
    const placeholderKeys = findAllPlaceholders(innerHTML);
    if (!placeholderKeys.length) {
      return;
    }
    const newInnerHTML = replacePlaceholdersInString(innerHTML, placeholders);
    // Only update if there's an actual change
    if (newInnerHTML !== innerHTML) {
      node.innerHTML = newInnerHTML;
      hasUpdates = true;
    }
  });

  // Replace the original element's content with the new fragment only if there's a change
  if (hasUpdates) {
    element.innerHTML = clonedElement.innerHTML;
  }
}

export function isDynamicPage() {
  return document.querySelector('meta[name="dynamic-routing"][content="true"]');
}

function loadSideBar(main) {
  const aside = document.createElement('aside');
  aside.classList.add('sidebar-plp');
  const asideDiv = document.createElement('div');
  const mainWrapper = document.createElement('div');
  mainWrapper.classList.add('main-wrapper');
  main.parentNode.insertBefore(mainWrapper, main);
  mainWrapper.appendChild(aside);
  mainWrapper.appendChild(main);
  aside.appendChild(asideDiv);
  main.classList.add('sidebar-main');
  const sidebarBlock = buildBlock('sidebar', []);
  sidebarBlock.classList.add('dynamic', 'start-level-1');
  asideDiv.append(sidebarBlock);
  decorateMain(aside);
}
function buildCommerceBlocks(main) {
  // only support urls with /en and /ar
  if (!window.location.pathname.startsWith('/en/') && !window.location.pathname.startsWith('/ar/')) {
    // eslint-disable-next-line no-use-before-define
    showCommerceErrorPage();
    return;
  }
  const isPlp = window.location.pathname.split('/').at(2).startsWith('shop-');

  const isPdp = window.location.pathname.split('/')?.at(2)?.startsWith('buy-');
  let block;
  if (isPdp) {
    // published product can have h1 and description, need to clean it up
    main.querySelector('div').innerHTML = '';
    block = buildBlock('product-details', []);
  } else if (!isDynamicPage()) {
    const sidebarMeta = getMetadata('sidebar');
    if (isPlp && sidebarMeta === 'dynamic') {
      loadSideBar(main);
    }
    return;
  } else {
    block = buildBlock('algolia-product-listing', []);
    const hidePlpSidebar = getMetadata('hide-plp-sidebar');
    if (hidePlpSidebar !== 'true') {
      loadSideBar(main);
      main.querySelector('div').append(block);
    }
  }
  main.querySelector('div').append(block);
}

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
window.fragmentCacheForBanners = {}; // stores fragments for re-use in banner-utils.js
export async function loadFragment(path) {
  if (path && path.startsWith('/')) {
    const resp = await fetch(path, {
      headers: {
        'Cache-Control': 'max-age 60',
      },
    });
    if (resp.ok) {
      const mainDiv = document.createElement('div');
      const htmlString = await resp.text();
      window.fragmentCacheForBanners[path] = htmlString;
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');

      mainDiv.append(...doc.querySelector('main').children);

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        mainDiv.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(mainDiv);

      mainDiv.querySelector(':scope > div')?.setAttribute('data-path', path);
      const placeholders = await fetchPlaceholdersForLocale();
      replacePlaceholders(mainDiv, placeholders);

      await loadBlocks(mainDiv);

      return mainDiv;
    }
  }
  return null;
}

/**
 * Method to create and open modal when content needs to be fetched from fragment URL
 * @param {*} title Modal title
 * @param {*} fragmentUrl Modal Content fragment URL
 * @param {*} classList Optional. Custom class to add on modal
 */
export async function createModalFromFragment(id, title, fragmentUrl, classList) {
  const path = fragmentUrl.startsWith('http')
    ? new URL(fragmentUrl, window.location).pathname
    : fragmentUrl;

  const fragment = await loadFragment(path);
  await createModal(id, title, fragment.childNodes, classList);
}

/**
 * Method to create and open modal when content is passed as HTML or text directly
 * @param {*} title Modal title
 * @param {*} content Modal content HTML/text sring
 * @param {*} classList Optional. Custom class to add on modal
 */
// eslint-disable-next-line max-len
export async function createModalFromContent(id, title, content, classList, titleIconClass, appendAsHTML = false, closeIcon = 'icon-close', callback = false) {
  await createModal(
    id,
    title,
    content,
    classList,
    titleIconClass,
    appendAsHTML,
    closeIcon,
    callback,
  );
}

const renderGraphData = async () => {
  const gaOrgName = await getConfigValue('ga-graph-org-name');
  const gaOrglogo = await getConfigValue('ga-graph-org-logo');
  const gaOrgUrl = await getConfigValue('ga-graph-org-url');
  const gaOrgSameAs = await getConfigValue('ga-graph-org-same-as');
  const gaContactTelephone = await getConfigValue('ga-graph-contact-telephone');
  const gaContactType = await getConfigValue('ga-graph-contact-type');
  const gaContactArea = await getConfigValue('ga-graph-contact-area');
  const gaContactOption = await getConfigValue('ga-graph-contact-option');
  const gaContactLanguages = await getConfigValue('ga-graph-contact-language');

  const gaGraphData = {
    '@context': 'http://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: gaOrgName,
        logo: gaOrglogo,
        url: gaOrgUrl,
        sameAs: gaOrgSameAs,
        contactPoint: [
          {
            '@type': 'ContactPoint',
            telephone: gaContactTelephone,
            contactType: gaContactType,
            areaServed: gaContactArea,
            contactOption: gaContactOption,
            availableLanguage: [gaContactLanguages],
          },
        ],
      },
      {
        '@type': 'WebSite',
        url: gaOrgUrl,
        name: gaOrgName,
      },
    ],
  };

  setJsonLd(gaGraphData, 'ga-graph');
};

function initWebSDK(path, config) {
  // Preparing the alloy queue
  if (!window.alloy) {
    // eslint-disable-next-line no-underscore-dangle
    (window.__alloyNS ||= []).push('alloy');
    window.alloy = (...args) => new Promise((resolve, reject) => {
      window.setTimeout(() => {
        window.alloy.q.push([resolve, reject, args]);
      });
    });
    window.alloy.q = [];
  }
  // Loading and configuring the websdk
  return new Promise((resolve) => {
    import(path)
      .then(() => window.alloy('configure', config))
      .then(resolve);
  });
}

function onDecoratedElement(fn) {
  // Apply propositions to all already decorated blocks/sections
  if (document.querySelector('[data-block-status="loaded"],[data-section-status="loaded"]')) {
    fn();
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.target.tagName === 'BODY'
      || m.target.dataset.sectionStatus === 'loaded'
      || m.target.dataset.blockStatus === 'loaded')) {
      fn();
    }
    if (mutations.some((m) => (m.target.dataset.blockName === 'recommendations'
        || m.target.dataset.blockName === 'personalization')
      && m.target.dataset.blockStatus === 'loaded')) {
      window.dispatchEvent(new CustomEvent('target-response'));
    }
  });
  // Watch sections and blocks being decorated async
  observer.observe(document.querySelector('main'), {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-block-status', 'data-section-status'],
  });
  // Watch anything else added to the body
  observer.observe(document.querySelector('body'), { childList: true });
}

export async function getAndApplyRenderDecisions(
  payload,
  decisionScopes = ['__view__'],
  displayEvent = true,
  noDisplayScopes = [],
  xdmCustomPayload = {},
) {
  const {
    xdmPayload,
    EVENT_QUEUE,
    targetDisplayEvent,
  } = await import('./target/target-events.js');

  // Get the decisions, but don't render them automatically
  // so we can hook up into the AEM EDS page load sequence
  const xdm = await xdmPayload(xdmCustomPayload);
  const options = {
    type: 'decisioning.propositionFetch',
    renderDecisions: true,
    data: {
      __adobe: {
        target: payload,
      },
    },
    xdm: {
      ...xdm,
      ...xdmCustomPayload,
    },
    decisionScopes: [...decisionScopes, ...noDisplayScopes],
  };
  try {
    const { propositions } = await window.alloy('sendEvent', options);
    const customPropositions = propositions?.filter((p) => p.scope !== '__view__');
    customPropositions?.forEach(({ scope, items, ...rest }) => {
      const existingDataIndex = EVENT_QUEUE.findIndex((e) => e.key === scope);
      if (existingDataIndex > -1) {
        EVENT_QUEUE[existingDataIndex] = {
          key: scope,
          data: items || [],
          ...rest,
        };
        return;
      }
      EVENT_QUEUE.push({
        key: scope,
        data: items || [],
        ...rest,
      });
    });
    onDecoratedElement(async () => {
      await window.alloy('applyPropositions', { propositions });
    });

    if (!displayEvent) return;
    // Reporting is deferred to avoid long tasks
    window.setTimeout(() => {
      targetDisplayEvent(customPropositions, noDisplayScopes);
    });
  } catch (e) {
    console.error(e);
  }
}

export async function fetchData(url, opts) {
  const resp = await fetch(url, opts);
  return resp?.text();
}

export function isPrerendering() {
  return document.visibilityState !== 'visible';
}

function getLCPSection() {
  return document.querySelector('[data-lcp-section]') ?? document.querySelector('.section');
}

function getLCPRelevantSelection(selection) {
  const blocksToConsider = [];
  // find all sections until lcp section metadata, if exists
  let lcpSection = getLCPSection();
  do {
    blocksToConsider.push(...lcpSection.querySelectorAll(selection));
    lcpSection = lcpSection.previousElementSibling;
  } while (lcpSection);
  return blocksToConsider;
}

async function getTargetBlocksMetadata() {
  const scopes = ['__view__'];
  const tabScopes = [];
  const fetchPromises = [];
  const shouldFetchFragments = (window.tabUrlFragments?.length ?? 0) < 1;

  const personalizedBlocks = document.querySelectorAll('div.recommendations, div.personalization');

  personalizedBlocks?.forEach((el) => {
    if (el.dataset.tabUrl && shouldFetchFragments) {
      fetchPromises.push(fetchData(`${el.dataset.tabUrl}.plain.html`, {
        headers: {
          'Cache-Control': 'max-age 60',
        },
      }));
    } else if (!el.dataset.tabUrl) {
      scopes.push(el.dataset.targetId);
    }
  });

  try {
    const responses = window.tabUrlFragments?.length > 0
      ? window.tabUrlFragments : await Promise.all(fetchPromises);
    window.tabUrlFragments = responses;
    responses?.forEach((content) => {
      const fragment = document.createRange().createContextualFragment(content);
      fragment?.querySelectorAll('div.tabs > div')?.forEach((category) => {
        tabScopes.push(category.children[1]?.textContent.trim());
      });
    });
  } catch (error) {
    console.error('Error fetching tabbed recommendations metadata', error);
  }
  return { scopes, tabScopes };
}

const alloyLoadedPromise = (datastreamId, orgId) => initWebSDK('./alloy.js', {
  datastreamId,
  orgId,
  clickCollectionEnabled: false,
  idMigrationEnabled: false,
  thirdPartyCookiesEnabled: false,
});

/**
 * Enables target for pre-rendered pages bu default
 * Otherwise, checks if target is enabled in metadata from content
 * @returns {boolean} true if target is enabled
 */
function isTargetEnabled() {
  if (PRE_RENDERED_PAGES.includes(window.pageType)) {
    return true;
  }
  return getMetadata('target');
}

export async function fireTargetCall(
  payload,
  decisionScopes = [],
  fullPage = true,
  customXdmPayload = {},
  filterDefaultScope = false,
) {
  let scopes = [];
  let tabScopes = [];

  if (!isTargetEnabled() || !window.alloy || DISABLE_MARTECH) {
    return Promise.resolve();
  }

  if (filterDefaultScope) {
    ({ scopes, tabScopes } = await getTargetBlocksMetadata());
    scopes = scopes.filter((scope) => scope !== '__view__');
  } else if (fullPage) {
    ({ scopes, tabScopes } = await getTargetBlocksMetadata());
  }
  return getAndApplyRenderDecisions(
    payload,
    [...scopes, ...decisionScopes],
    true,
    tabScopes,
    customXdmPayload,
  );
}

/**
 * Method to load Alloy JS and fire target call on page load
 * for all pages except for PDP and PLP
 */
async function loadAlloy() {
  const [orgId, datastreamId] = await Promise.all([
    getConfigValue('target-org-id'),
    getConfigValue('aep-datastream-id'),
  ]);
  if (!(orgId && datastreamId)) return;
  if (document.visibilityState !== 'visible') {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && !window.alloy) {
        loadAlloy().then(() => window.dispatchEvent(new CustomEvent('target-response')));
      }
    }, { once: true });
    // Optional: Handle "pageshow" event to detect navigation from pre-rendered state
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && !window.alloy) {
        loadAlloy().then(() => window.dispatchEvent(new CustomEvent('target-response')));
      }
    }, { once: true });
    return;
  }
  const [{ pageLoadData }] = await Promise.all([
    import('./target/target-events.js'),
    !window.alloy ? alloyLoadedPromise(datastreamId, orgId) : Promise.resolve(),
  ]);

  if (!(isPDP() || isPLP() || isOrderConfirmation())) {
    const targetPayload = await pageLoadData();
    await fireTargetCall(targetPayload, [], true, {});
  }
}

export function formatPDPUrlAttributes(url, src = 'main') {
  const placeholders = fetchPlaceholdersForLocale();
  const heightDimension = (src === 'main') ? placeholders.productZoomMedium || 630 : placeholders.productZoomLarge || 800;
  let formatUrl = url.replace(/width=\d+&?/g, '').replace(/height=\d+&?/g, '').replace('/original/', '/');
  formatUrl = formatUrl.includes('?') ? `${formatUrl}&height=${heightDimension}` : `${formatUrl}?height=${heightDimension}`;
  return formatUrl;
}

export function getProductAssetsData(assetType, product) {
  let attributeValue = {};
  if (assetType === 'assets_pdp') {
    attributeValue.value = JSON.stringify(product?.images);
    if (product?.variants) {
      const galleryImages = product?.variants?.variants[0]?.product?.images;
      if (galleryImages) {
        attributeValue.value = JSON.stringify(galleryImages);
      }
    }
  } else if (assetType === 'assets_teaser') {
    const imageStyles = product?.attributes.find((attr) => attr.name === 'image_styles')?.value;
    if (imageStyles) {
      const imageStylesObject = JSON.parse(imageStyles);
      attributeValue = imageStylesObject.product_teaser;
    }
  }
  return attributeValue;
}

async function preloadImage(product) {
  // preload image
  let imagesJson;
  if (await getConfigValue('product-fetch-direct-attributes')) {
    imagesJson = getProductAssetsData('assets_pdp', product);
  } else {
    imagesJson = product.attributes.find((a) => a.name === 'assets_pdp');
  }
  if (imagesJson) {
    const firstImage = JSON.parse(imagesJson.value)?.[0];
    const img = new Image();
    img.src = formatPDPUrlAttributes(firstImage.url);
  }
}

async function handlePageType() {
  const { clearCategoryListCache = () => {}, sendPageLoadAttributes = () => {} } = DISABLE_MARTECH ? {} : await import('./analytics/google-data-layer.js');

  let pageType = getMetadata('page-type');
  if (isSearchPage()) {
    pageType = 'search page';
  } else if (isPDP()) {
    pageType = 'product detail page';
    window.product = (window.product || loadProduct()).then(([sku, p, pDL]) => {
      preloadImage(p);
      return [sku, p, pDL];
    });
  } else if (isPLP()) {
    pageType = 'product listing page';
  }
  if (pageType === 'home page') {
    clearCategoryListCache();
  }
  window.pageType = pageType || 'static page';
  await sendPageLoadAttributes();
}

async function decorateMetaTitle() {
  const metaTitle = document.querySelector('title');
  const metaTitleContent = metaTitle?.innerText;
  if (metaTitleContent && metaTitleContent.includes(' | ')) {
    return;
  }
  const pageTitle = document.title;
  fetchPlaceholdersForLocale().then((placeholders) => {
    const titleSuffix = placeholders.pageTitleSuffix || '';
    const lang = getLanguageAttr();
    if (lang === 'ar') {
      metaTitle.innerText = titleSuffix ? `${titleSuffix} | ${pageTitle}` : pageTitle;
    } else {
      metaTitle.innerText = titleSuffix ? `${pageTitle} | ${titleSuffix}` : pageTitle;
    }
  });
}

async function loadBreadcrumb(breadcrumbWrapper) {
  if (breadcrumbWrapper) {
    const decorator = await Promise.all([
      import(`${window.hlx.codeBasePath}/blocks/breadcrumb/breadcrumb.js`),
      loadCSS(`${window.hlx.codeBasePath}/blocks/breadcrumb/${getBrandPath()}breadcrumb.css`),
    ]).then(([mod]) => mod.default);
    if (decorator) {
      await decorator(breadcrumbWrapper);
    }
  }
}

window.preloadedFragments = {};
function optimizeFragmentLoading() {
  const blocksToConsiderOptimizing = getLCPRelevantSelection('.block');

  // find all fragments in first section
  const fragmentLCPBlockHint = [];
  const fragments = [];

  blocksToConsiderOptimizing.forEach((block) => {
    const { blockName } = block.dataset;
    if (blockName === 'fragment') {
      fragmentLCPBlockHint.push(...[...block.classList]
        .filter((c) => c.startsWith('lcp-hint-'))
        .map((c) => c.replace('lcp-hint-', '')));

      const link = block.querySelector('a');
      const path = link ? link.getAttribute('href') : block.textContent.trim();
      fragments.push(loadFragment(path)
        .then((fragment) => { window.preloadedFragments[path] = fragment; }));
    }
  });

  if (fragmentLCPBlockHint.length > 0) {
    const brandPath = getBrandPath();
    return Promise.all([
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js'),
      loadCSS(`/blocks/fragment/${brandPath}fragment.css`),
      ...fragmentLCPBlockHint.map((name) => loadCSS(`/blocks/${name}/${brandPath}${name}.css`)),
      ...fragmentLCPBlockHint.map((name) => import(`/blocks/${name}/${name}.js`)),
      ...fragments,
      // this will load more fragments that need to be eagerly loaded - call now
      getTargetBlocksMetadata(),
    ]);
  }
  return Promise.resolve();
}

async function loadBlocksSubselection(main, selection) {
  updateSectionsStatus(main);
  const blocks = [...selection];
  for (let i = 0; i < blocks.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await loadBlock(blocks[i]);
    updateSectionsStatus(main);
  }
}

/**
 * Load LCP block and/or wait for LCP in default content.
 * @param {Array} lcpBlocks Array of blocks
 */
async function waitForLCP(lcpBlocks) {
  const block = document.querySelector('.block');
  const hasLCPBlock = block && lcpBlocks.includes(block.dataset.blockName);
  if (hasLCPBlock) await loadBlock(block);

  document.body.style.display = null;
  const lcpCandidate = document.querySelector('main img');

  await new Promise((resolve) => {
    if (lcpCandidate && !lcpCandidate.complete) {
      lcpCandidate.setAttribute('loading', 'eager');
      lcpCandidate.addEventListener('load', resolve);
      lcpCandidate.addEventListener('error', resolve);
    } else {
      resolve();
    }
  });
}

async function decoratePlaceholders() {
  const dynamicKeys = getMetadata('dynamic-keys');
  const template = getMetadata('template');

  const templateList = template?.toLowerCase().split(',').map((t) => t.trim().replaceAll(/\s+/g, '-')) || [];

  const isSupportedTemplate = DYNAMIC_PLACEHOLDER_TEMPLATE_LIST
    .filter((value) => templateList.includes(value)).length > 0;

  if (dynamicKeys && dynamicKeys.toLowerCase() === 'true' && isSupportedTemplate) {
    const placeholders = await fetchPlaceholdersForLocale();
    replacePlaceholders(document.querySelector('main'), placeholders);
  }
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  // set language and direction
  document.documentElement.lang = 'en';

  const brandCode = getBrandCode();
  doc.querySelector('body').classList.add(brandCode);
  const superCategoryCode = getSuerCategoriesCode();
  if (superCategoryCode) {
    doc.querySelector('body').classList.add(superCategoryCode);
  }
  const path = getHref();
  // temporary fix for arabic
  if (path.includes('/ar/')) {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  }

  if (isMobileApp()) {
    document.querySelector('header').remove();
    document.querySelector('footer').remove();
  }

  const isDesktop = window.matchMedia('(min-width: 1025px)');
  // handle header height if breadcrumbs are enabled
  if (isDesktop && getMetadata('no-breadcrumb').toLowerCase() !== 'true') {
    const breadcrumb = document.createElement('div');
    breadcrumb.classList.add('breadcrumb-wrapper');
    document.querySelector('header')?.after(breadcrumb);
  }

  if (getMetadata('show-breadcrumb-mobile').toLowerCase() === 'true') {
    document.querySelector('body').classList.add('show-breadcrumb-mobile');
  }

  if (isDesktop && document.querySelector('.sidebar')) {
    document.querySelector('main').classList.add('sidebar-main');
  }

  decorateMetaTitle();

  decorateTemplateAndTheme();

  await decoratePlaceholders();

  window.adobeDataLayer = window.adobeDataLayer || [];
  window.dataLayer = window.dataLayer || [];

  const enableEagerMartech = async () => {
    if (DISABLE_MARTECH) return Promise.resolve();
    const alloyEnabled = await getConfigValue('alloy-enabled');
    if (alloyEnabled !== 'false') {
      return loadAlloy();
    }
    return Promise.resolve();
  };

  const main = doc.querySelector('main');
  if (main) {
    buildCommerceBlocks(main);
    buildAutoBlocks(main);
    decorateMain(main);
    await handlePageType();
    document.body.classList.add('appear');
    // in parallel, load fragments for any block that appears in a LCP section
    await Promise.all([
      enableEagerMartech(),
      optimizeFragmentLoading(),
      waitForLCP(LCP_BLOCKS),
    ]);
    // render all the blocks in a LCP section before loadLazy, to allow alloy call in lazy
    await loadBlocksSubselection(main, getLCPRelevantSelection('.block'));
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Add sticky elements to the constant
 */
function getStickyElements() {
  if (mobileDevice.matches) {
    STICKY_ELEMENTS = document.querySelectorAll('.sticky-element.sticky-mobile');
  } else {
    STICKY_ELEMENTS = document.querySelectorAll('.sticky-element.sticky-desktop');
  }
}

/**
 * Enable sticky components
 *
 */
export function enableStickyElements() {
  getStickyElements();
  mobileDevice.addEventListener('change', getStickyElements);

  const offsets = [];

  STICKY_ELEMENTS.forEach((element, index) => {
    offsets[index] = element.offsetTop;
  });

  window.addEventListener('scroll', () => {
    const currentScrollPosition = window.pageYOffset;
    let stackedHeight = 0;
    STICKY_ELEMENTS.forEach((element, index) => {
      if (currentScrollPosition > offsets[index] - stackedHeight) {
        element.classList.add('sticky');
        element.style.top = `${stackedHeight}px`;
        stackedHeight += element.offsetHeight;
      } else {
        element.classList.remove('sticky');
        element.style.top = '';
      }

      if (currentScrollPosition < LAST_SCROLL_POSITION && currentScrollPosition <= offsets[index]) {
        element.style.top = `${Math.max(offsets[index] - currentScrollPosition, stackedHeight - element.offsetHeight)}px`;
      } else {
        element.style.top = `${stackedHeight - element.offsetHeight}px`;
      }
    });

    LAST_SCROLL_POSITION = currentScrollPosition;
    if (stackedHeight !== LAST_STACKED_HEIGHT) {
      LAST_STACKED_HEIGHT = stackedHeight;
      document.querySelector(':root').style.setProperty('--stacked-height', `${stackedHeight}px`);
    }
  });
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');

  const enableGTM = async () => {
    try {
      const { loadGTM = () => {} } = DISABLE_MARTECH ? {} : await import('./analytics/google-data-layer.js');
      await loadGTM(isMobileApp());
    } catch (error) {
      console.error('An error occurred while loading GTM:', error);
    }
  };

  if (isPDP()) {
    await window.pdpLoadedPromise;
  }

  // mutation observer to load header after LCP section
  const observer = new MutationObserver((mutationsList) => {
    mutationsList.forEach((mutation) => {
      if (mutation.attributeName === 'data-section-status') {
        if (getLCPSection().getAttribute('data-section-status') === 'loaded') {
          observer.disconnect();
          if (!isMobileApp()) {
            loadHeader(doc.querySelector('header'));
          }
          if (sampleRUM.enhance) {
            sampleRUM.enhance();
          }
        }
      }
    });
  });

  if (getLCPSection().getAttribute('data-section-status') === 'loaded' && !isMobileApp()) {
    loadHeader(doc.querySelector('header'));
  } else {
    observer.observe(getLCPSection(), { attributes: true, attributeFilter: ['data-section-status'] });
  }

  await Promise.all([
    loadBlocks(main),
    enableGTM(),
  ]);

  window.dispatchEvent(new Event('lazy-loaded'));

  const aside = doc.querySelector('aside');
  if (aside) {
    await loadBlocks(aside);
  }

  loadBreadcrumb(doc.querySelector('.breadcrumb-wrapper'));

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  if (!isMobileApp()) {
    loadFooter(doc.querySelector('footer'));
  }

  renderGraphData();

  loadCSS(`${window.hlx.codeBasePath}/styles/${getBrandPath()}lazy-styles.css`);
  loadFonts();

  await initProductViewHistory();
  await import('./acdl/adobe-client-data-layer.min.js');
  if (sessionStorage.getItem('acdl:debug')) {
    import('./acdl/validate.js');
  }

  const backTopDisable = getMetadata('backtotop-disabled');
  if (backTopDisable !== 'true') {
    decorateScrollToTop(main);
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  if (DISABLE_MARTECH) {
    return;
  }

  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 6000);
  // load anything that can be postponed to the latest here
}

export async function fetchIndex(indexFile, lang = '', hasGlobal = false, pageSize = 500) {
  const handleIndex = async (offset) => {
    const resp = await fetch(`/${lang}${indexFile}.json?limit=${pageSize}&offset=${offset}`);
    const json = await resp.json();

    const newIndex = {
      complete: (json.limit + json.offset) === json.total,
      offset: json.offset + pageSize,
      promise: null,
      data: [...window.index[indexFile].data, ...json.data],
    };

    return newIndex;
  };

  const handleGlobalIndex = async (offset) => {
    const respGlobalPromise = fetch(`/${lang}global-${indexFile}.json?limit=${pageSize}&offset=${offset}`);
    const respPromise = fetch(`/${lang}${indexFile}.json?limit=${pageSize}&offset=${offset}`);

    const [respGlobal, resp] = await Promise.all([respGlobalPromise, respPromise]);

    let newIndex;
    let newIndexLocal;

    if (respGlobal.ok) {
      const jsonGlobal = await respGlobal?.json();
      newIndex = {
        complete: (jsonGlobal.limit + jsonGlobal.offset) === jsonGlobal.total,
        offset: jsonGlobal.offset + pageSize,
        promise: null,
        data: [...window.index[indexFile].data, ...jsonGlobal.data],
      };
    }

    if (resp.ok) {
      const json = await resp?.json();
      newIndexLocal = {
        complete: (json.limit + json.offset) === json.total,
        offset: json.offset + pageSize,
        promise: null,
        data: [...window.index[indexFile].data, ...json.data],
      };
    }

    if (!newIndex && !newIndexLocal) {
      return window.index[indexFile];
    }

    if (!newIndex) {
      return newIndexLocal;
    }

    if (!newIndexLocal) {
      return newIndex;
    }

    // Merge global and local index
    newIndex.data = [...newIndex.data, ...newIndexLocal.data];

    return newIndex;
  };

  window.index = window.index || {};
  window.index[indexFile] = window.index[indexFile] || {
    data: [],
    offset: 0,
    complete: false,
    promise: null,
  };

  // Return index if already loaded
  if (window.index[indexFile].complete) {
    return window.index[indexFile];
  }

  // Return promise if index is currently loading
  if (window.index[indexFile].promise) {
    return window.index[indexFile].promise;
  }

  if (hasGlobal) {
    window.index[indexFile].promise = handleGlobalIndex(window.index[indexFile].offset);
  } else {
    window.index[indexFile].promise = handleIndex(window.index[indexFile].offset);
  }
  const newIndex = await (window.index[indexFile].promise);
  window.index[indexFile] = newIndex;

  return newIndex;
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  if (!new URLSearchParams(window.location.search).get('skip-delayed')) {
    loadDelayed();
  }
}

export function showToastNotification(message, showTick = true, error = false) {
  const toastDiv = document.createElement('div');
  toastDiv.className = `toast-notification ${error ? 'error-toast' : ''}`;
  // Nav Height scrolled position check while create a toast.
  const mainHeader = document.querySelector('header');
  const mainHeaderHeight = mainHeader?.offsetHeight || 140;
  if (window.scrollY > mainHeaderHeight) {
    toastDiv.classList.add('scrolled-toast');
  }

  const isHeaderVisible = () => {
    const item = document.querySelector('header').getBoundingClientRect();
    return (
      item.top >= 0
      && item.left >= 0
      && item.bottom <= (
        window.innerHeight
        || document.documentElement.clientHeight)
      && item.right <= (
        window.innerWidth
        || document.documentElement.clientWidth)
    );
  };

  if (!isHeaderVisible()) {
    toastDiv.classList.add('toast-notification-top');
  }

  const tickDiv = document.createElement('div');
  tickDiv.className = 'toast-tick';

  const tickIcon = document.createElement('span');
  tickIcon.classList.add('icon', 'icon-tick');
  tickDiv.appendChild(tickIcon);

  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';

  const messageDiv = document.createElement('div');
  messageDiv.className = 'toast-message';
  messageDiv.textContent = message;

  if (showTick) {
    contentDiv.appendChild(tickDiv);
  }
  contentDiv.appendChild(messageDiv);

  const closeDiv = document.createElement('div');
  closeDiv.className = 'toast-close';

  const closeIcon = document.createElement('span');
  closeIcon.classList.add('icon', 'icon-close-small');
  closeDiv.appendChild(closeIcon);

  toastDiv.appendChild(contentDiv);
  toastDiv.appendChild(closeDiv);

  decorateIcons(toastDiv);

  closeDiv.addEventListener('click', (e) => {
    e.target.closest('.toast-notification').remove();
  });

  document.body.appendChild(toastDiv);

  setTimeout(() => {
    toastDiv.remove();
  }, 5000);
}

/**
 * Makes post request with JSON data
 *
 * @param url
 * @param data
 * @returns {Promise<{}|any>}
 */
export async function postJSON(url, data) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    // this function is temporary and will be replaced with API Mesh
  }
  return {};
}

/**
 * Adds/updates meta attribute in the head
 * @param {name} name of the meta tag
 * @param {content} content of the meta tag
 * @param {metaField} metaField to insert the meta tag after
 * @param {isProperty} isProperty true if the meta tag is a property
 * @returns meta tag
 */
export function setMetaAttribute(name, content, metaField, isProperty = false) {
  let meta = isProperty ? document.querySelector(`meta[property="${name}"]`) : document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(`${isProperty ? 'property' : 'name'}`, name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  } else {
    meta.setAttribute('content', content);
  }
  metaField.after(meta);
  return meta;
}

async function getCountryCode() {
  return getConfigValue('country-code').then((value) => value || 'AE');
}

export async function getLocale() {
  const countryCode = await getCountryCode();
  return `${(document.documentElement.lang || 'en').toLowerCase()}_${countryCode.toUpperCase()}`;
}

export async function getCurrencyFormatter(currencyCode) {
  let currency = currencyCode || '';
  const decimalDigits = await getConfigValue('cart-price-decimals');
  if (!currency) {
    currency = await getConfigValue('currency') || 'AED';
  }
  const countryCode = await getConfigValue('country-code') || 'AE';
  return new Intl.NumberFormat(`${document.documentElement.lang || 'en'}-${countryCode}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: parseInt(decimalDigits, 10) || 2,
    numberingSystem: 'latn',
  });
}

/**
 * Formats date string to locale date format
 * @param {dateString} dateString Date string to format
 * @param {*} locale Locale to format the date
 * @returns formatted date string
 */
export function formatDate(
  dateString,
  locale,
  options = {
    year: 'numeric', month: 'long', day: '2-digit', numberingSystem: 'latn',
  },
) {
  let newLocale = locale;
  if (locale?.includes('_')) {
    newLocale = locale.replaceAll('_', '-');
  }
  const date = new Date(dateString);
  return date.toLocaleDateString(newLocale, options);
}

export async function formatDateToCurrentLocale(date, options) {
  if (!date) {
    return '';
  }
  const countryCode = await getConfigValue('country-code') || 'AE';

  return formatDate(date, `${document.documentElement.lang || 'en'}-${countryCode}`, options);
}

/**
 * Formats price to locale currency format
 * @param {currency} currency Currency code
 * @param {price} price Price to format
 * @returns formatted price string
 */
export async function formatPrice(currency, price) {
  const currentFormatter = await getCurrencyFormatter(currency);

  const newPrice = parseFloat(price);

  return currentFormatter.format(newPrice);
}

export async function showCommerceErrorPage(code = 404) {
  const {
    pageLoadData = () => {},
  } = DISABLE_MARTECH ? {} : await import('./target/target-events.js');

  window.pageType = 'page-not-found';
  const [errorBlock, targetPayload] = await Promise.all([
    loadFragment(`/${document.documentElement.lang}/fragments/${code}`),
    pageLoadData(),
  ]);
  const errorBlockTitle = errorBlock?.querySelector('.default-content-wrapper');
  if (errorBlockTitle) {
    const h5Title = document.createElement('h5');
    h5Title.classList.add('default-content-wrapper');
    h5Title.innerHTML = errorBlockTitle.innerHTML;
    errorBlockTitle.parentNode.replaceChild(h5Title, errorBlockTitle);
  }

  // https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript
  // Point 2. prevent soft 404 errors
  if (code === 404) {
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex';
    document.head.appendChild(metaRobots);
  }

  document.querySelector('body').classList.add('error-page');
  document.querySelector('main').appendChild(errorBlock);
  document.querySelector('.fullscreen-loader')?.classList.remove('active');
  document.querySelector('.algolia-product-listing-container')?.classList.add('hidden');
  await fireTargetCall(targetPayload);
  window.dispatchEvent(new CustomEvent('target-response'));
}

export function getPreviewPreaccessType(previewPreaccessData, lang) {
  if (!previewPreaccessData || typeof previewPreaccessData !== 'object') {
    return { type: null, pdpText: null };
  }
  const currentDateUTC = new Date().toISOString();
  const extractPdpText = (pdpText) => (typeof pdpText === 'object' ? pdpText[lang] : pdpText || null);

  const toISODate = (dateStr) => (dateStr ? new Date(dateStr.replace(' ', 'T')).toISOString() : null);

  if (previewPreaccessData.preaccess_sd && previewPreaccessData.preaccess_ed
    && currentDateUTC >= toISODate(previewPreaccessData.preaccess_sd)
    && currentDateUTC <= toISODate(previewPreaccessData.preaccess_ed)) {
    return {
      type: 'pre-access',
      pdpText: extractPdpText(previewPreaccessData.preaccess_pdp_text),
    };
  }

  if (previewPreaccessData.preview_sd && previewPreaccessData.preview_ed
    && currentDateUTC >= toISODate(previewPreaccessData.preview_sd)
    && currentDateUTC <= toISODate(previewPreaccessData.preview_ed)) {
    return {
      type: 'preview',
      pdpText: extractPdpText(previewPreaccessData.preview_pdp_text),
    };
  }

  return { type: null, pdpText: null };
}

export async function getCustomerTier() {
  try {
    const custResponse = await getCustomer();

    if (custResponse?.custom_attributes) {
      const tierAttribute = custResponse.custom_attributes.find((attribute) => attribute.attribute_code === 'tier_name');
      if (tierAttribute?.value) {
        return tierAttribute.value;
      }
    }
    return 'all';
  } catch (error) {
    return 'all';
  }
}

export async function getVisitorEligibility(previewPreaccessData, lang) {
  try {
    if (!previewPreaccessData || typeof previewPreaccessData !== 'object') {
      throw new Error('Invalid or null previewPreaccessData object');
    }
    const typeInfo = getPreviewPreaccessType(previewPreaccessData, lang);

    if (!typeInfo.type) {
      return { type: null, isVisitorEligible: true, pdpText: null };
    }

    const visitorTier = await getCustomerTier();
    let isVisitorEligible = false;

    const tierType = typeInfo.type === 'pre-access'
      ? previewPreaccessData.preaccess_tier_type
      : previewPreaccessData.preview_tier_type;

    if (tierType) {
      if (tierType.includes('all')) {
        isVisitorEligible = true;
      } else if (tierType.includes('member')) {
        // Rule 2: If tierType includes "member", visitors with "member" or "plus" are eligible,
        // but not "all"
        isVisitorEligible = visitorTier === 'member' || visitorTier === 'plus';
      } else if (tierType.includes('plus')) {
        // Rule 3: If tierType includes "plus", only visitors with "plus" are eligible
        isVisitorEligible = visitorTier === 'plus';
      }
    }

    return {
      type: typeInfo.type,
      isVisitorEligible,
      pdpText: typeInfo.pdpText,
      visitorTier,
    };
  } catch (error) {
    return {
      type: null, isVisitorEligible: false, pdpText: null, visitorTier: null,
    };
  }
}

export async function getRedirectUrl(isVisitorEligible, visitorTier, language) {
  const userLoginUrl = '/user/login';
  const membershipUrl = '/membership-info';

  const localizedLoginUrl = `/${language}${userLoginUrl}`;
  const localizedMembershipUrl = `/${language}${membershipUrl}`;

  if (!isVisitorEligible) {
    if (visitorTier === 'all') {
      return localizedLoginUrl;
    } if (visitorTier === 'member') {
      return localizedMembershipUrl;
    }
  }

  return null;
}

export function redirectRegisterURL(block, selector) {
  if (isLoggedInUser()) {
    block.querySelectorAll(selector).forEach((aLink) => {
      if (aLink.href.endsWith('/user/register')) {
        aLink.href = aLink.href.replace('/user/register', '/user/account');
      }
    });
  }
}

// Utility to handle exceptions
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

// Utility function for managing local storage cache
export const cacheManager = {
  /**
   * Stores a value in localStorage with a time.
   * @param {string} key - The key under which the value is stored.
   * @param {*} value - The value to store.
   * @param {number} ttl - The time-to-live in milliseconds.
   */
  set(key, value, ttl) {
    const expiration = Date.now() + ttl;
    try {
      localStorage.setItem(key, JSON.stringify({ value, expiration }));
    } catch (e) {
      console.warn('Failed to set item in local storage:', e);
    }
  },

  /**
   * Retrieves a value from localStorage if it hasn't expired.
   * @param {string} key - The key of the stored item.
   * @returns {*} The stored value, or `null` if it doesn't exist or has expired.
   */
  get(key) {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const { value, expiration } = JSON.parse(item);
      if (Date.now() > expiration) {
        localStorage.removeItem(key);
        return null;
      }
      return value;
    } catch (e) {
      console.warn('Failed to retrieve item from local storage:', e);
      return null;
    }
  },

  /**
   * Removes an item from localStorage.
   * @param {string} key - The key of the item to remove.
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to remove item from local storage:', e);
    }
  },
};

export async function sanitizeDOM(element) {
  if (!window.DOMPurify) {
    await import('./third-party/dompurify.js');
  }
  return window.DOMPurify.sanitize(element, DOMPurifyConfig);
}

/*  Before usage, ensure DOMPurify is
    imported in the respective module and have it loaded
    in the window global object */
export function sanitizeDOMSync(element) {
  if (!window.DOMPurify) {
    console.error('DOMPurify is not loaded');
  }
  return window.DOMPurify.sanitize(element, DOMPurifyConfig);
}

// Function to convert decimals into fractions.
window.convertDecimalToFraction = function convertDecimalToFraction(size) {
  return size
    .replace('.0', '')
    .replace('.5', ' 1/2')
    .replace('.33', ' 1/3')
    .replace('.66', ' 2/3');
};

// Helper function for getting recommended shoe size from ShoeAI.
window.handleShoeSizeRecommendation = function handleShoeSizeRecommendation(recommendation) {
  const recommendedSize = recommendation?.size?.eu
  && window.convertDecimalToFraction(recommendation.size.eu);
  if (!recommendedSize) return;

  // Update shoe size on PDP.
  const sizes = document.querySelectorAll('.size_shoe_eu .dropin-text-swatch__label');
  for (let i = 0; i < sizes.length; i += 1) {
    const sizeElement = sizes[i];
    const size = window.convertDecimalToFraction(sizeElement.innerText);
    if (size === recommendedSize) {
      sizeElement.click();
      break;
    }
  }
};

// Helper function for adding the recommended shoe size to the cart.
window.handleAddToCart = function handleAddToCart(recommendation) {
  const recommendedSize = recommendation?.size?.eu
  && window.convertDecimalToFraction(recommendation.size.eu);
  if (!recommendedSize) return;
  // Selectors for click on add_to_cart button.
  const addToCartButton = document.querySelector('.pdp-product__buttons button');
  if (addToCartButton) {
    addToCartButton.click();
  }
};

// Function to hash an email address using SHA-256.
async function hashEmail(email) {
  const data = new TextEncoder().encode(email);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Dynamically loads the ShoeAI plugin script based on the environment
 * and injects the plugin loader script into the page's <body> element.
 */
export async function createShoeAi() {
  const bodyTag = document.body;
  if (!bodyTag) return;

  // Fetch environment, production and staging domains, customer details, and shop ID concurrently.
  const [domainProd, domainStage, customer, shopId, shoeAiMode] = await Promise.all([
    getConfigValue('domain_production'),
    getConfigValue('domain_staging'),
    getCustomer(true),
    getConfigValue('shop_id'),
    getConfigValue('shoe_ai_mode'),
  ]);

  // Determine the appropriate domain based on the environment, dev uses staging domain.
  const domain = shoeAiMode === 'prod' ? domainProd : domainStage;
  // Compute the hashed email if customer data is available.
  const zeroHash = hasValue(customer) ? await hashEmail(customer.email) : '';
  // Create a new script element for the footer.
  const footerScript = document.createElement('script');
  footerScript.src = `${domain}/assets/plugin/loader.js`;
  footerScript.type = 'text/javascript';
  footerScript.async = true;
  // Add the required configuration as a JSON string within the script tag.
  footerScript.text = `{shopID:"${shopId}", locale:"${document.documentElement.lang}", scale: "eu", kids: true, zeroHash:"${zeroHash}", newRecommendation:${window.handleShoeSizeRecommendation}, inCart:${window.handleAddToCart}}`;
  // Append the script element to the <body> tag.
  bodyTag.appendChild(footerScript);
}

// Check

(() => {
  if (!window.location.pathname?.includes('/checkout')) sessionStorage.removeItem('digital-cart-id');
})();

loadCSS(`${window.hlx.codeBasePath}/styles/${getBrandPath()}styles.css`);
loadPage();
