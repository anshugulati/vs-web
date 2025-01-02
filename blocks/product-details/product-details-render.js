/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */
// Dropin Tools
import { initializers } from '@dropins/tools/initializer.js';
// Dropin APIs
import * as pdpApi from '@dropins/storefront-pdp/api.js';

// Dropin Providers
import { render as productRenderer } from '@dropins/storefront-pdp/render.js';

// Dropin Containers
import ProductDetails from '@dropins/storefront-pdp/containers/ProductDetails.js';

// Dropin Slots
import infoContentSlot from './slots/info-content.js';
import actionsSlot, { selectSeasonCode } from './slots/actions.js';
import optionsSlot, { decorateMemberPrice } from './slots/options.js';
import productStatusSlot from './slots/product-status.js';
import descriptionSlot from './slots/description.js';
import { getConfigValue } from '../../scripts/configs.js';
import { createCarousel } from '../carousel/carousel.js';
import { setJsonLd, getProductStockStatus } from '../../scripts/commerce.js';
import {
  loadFragment,
  fetchPlaceholdersForLocale,
  setMetaAttribute,
  fireTargetCall,
  getLanguageAttr,
  showCommerceErrorPage,
  getVisitorEligibility,
  getRedirectUrl,
  formatPDPUrlAttributes,
  isDynamicPage,
  getProductAssetsData,
  isLoggedInUser,
  hasValue,
} from '../../scripts/scripts.js';
import {
  datalayerViewItemEvent,
  sendCategoriesToDataLayer,
} from '../../scripts/analytics/google-data-layer.js';
import { pdpLoadData } from '../../scripts/target/target-events.js';
import renderAddToBagDialog from '../added-to-bag/added-to-bag.js';
import { decorateBnpl } from './slots/bnpl.js';

const isAuraEnabled = await getConfigValue('aura-price-enabled');
const hideSeasonCodeOption = await getConfigValue('hide-season-code-option');

const imgUrlMap = {};
const lang = getLanguageAttr();
export async function isVatIncludedDisplayed() {
  return getConfigValue('commerce-show-vat-included').then((value) => value?.toLocaleLowerCase() === 'true');
}

async function getCountryCode() {
  return getConfigValue('country-code').then((value) => value || 'AE');
}

export async function getLocale() {
  const countryCode = await getCountryCode();
  return `${(document.documentElement.lang || 'en').toLowerCase()}_${countryCode.toUpperCase()}`;
}

async function getAttributesToShow() {
  const displayAttributes = await getConfigValue('pdp-display-attributes');
  const attributesToShow = displayAttributes ? displayAttributes.split(',') : [];
  return attributesToShow;
}

async function isRatingEnabled() {
  const bvRatingEnabled = await getConfigValue('pdp-rating-enabled');
  return bvRatingEnabled === 'true';
}

async function setJsonLdProduct(data) {
  const {
    inStock, name, description, sku, images, prices: { final },
  } = data;

  if (!isDynamicPage()) {
    const ldJson = document.head.querySelector('script[type="application/ld+json"]');
    if (ldJson) {
      try {
        const jsonData = JSON.parse(ldJson.innerHTML);
        if (jsonData && jsonData['@type'] === 'Product' && jsonData.offers?.length > 0) {
          jsonData.offers[0].price = final.amount;
          jsonData.offers[0].availability = inStock ? 'InStock' : 'OutOfStock';
          ldJson.innerHTML = JSON.stringify(jsonData);
        }
      } catch (e) {
        console.error('Error parsing ld+json', e);
      }
    }
    return;
  }

  const brand = await getConfigValue('ga-graph-org-name');

  const jsonLd = {
    '@context': 'http://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: {
      '@type': 'Brand',
      name: brand,
    },
    sku,
    image: images?.map((img) => img.url),
    offers: {
      '@type': 'http://schema.org/Offer',
      price: final.amount,
      priceCurrency: final.currency,
      availability: inStock ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock',
    },
  };
  setJsonLd(jsonLd, 'product');
}

function decorateMetadata(product, placeholders) {
  if (!isDynamicPage()) {
    return;
  }

  const titleSuffix = placeholders.pageTitleSuffix || '';
  // set meta
  const pageTitle = product.name.toLowerCase().split(' ')
    .map((s) => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
  const description = product.metaDescription || new DOMParser().parseFromString(product.shortDescription, 'text/html').documentElement.innerText;
  const metaTitle = document.querySelector('title');
  if (lang === 'ar') {
    metaTitle.innerText = titleSuffix ? `${titleSuffix} | ${pageTitle}` : pageTitle;
  } else {
    metaTitle.innerText = titleSuffix ? `${pageTitle} | ${titleSuffix}` : pageTitle;
  }
  const metaOgTitle = setMetaAttribute('og:title', product.metaTitle || pageTitle, metaTitle, true);
  const metaOgDescription = setMetaAttribute('og:description', description, metaOgTitle, true);
  const metaTwitterTitle = setMetaAttribute('twitter:title', product.metaTitle || pageTitle, metaOgDescription);
  const metaDescription = setMetaAttribute('description', description, metaTitle);
  if (product.metaKeywords) {
    setMetaAttribute('keywords', product.metaKeywords, metaDescription);
  }
  setMetaAttribute('twitter:description', description, metaTwitterTitle);
}

/**
 * Fetches Personalization & Recommendations content from target
 */
async function addTargetContent(product) {
  const [targetPayload, dynamicContentFragment] = await Promise.all([
    pdpLoadData(product),
    loadFragment(
      `/${lang}/fragments/pdp/personalization-and-recommendations`,
    ),
  ]);
  const additionalDecisionScope = [];
  const dropinsContainer = document.querySelector('.section.product-details-container');
  if (dropinsContainer?.dataset.sectionStatus !== 'loaded') {
    dynamicContentFragment.classList.add('hidden');
    const observer = new MutationObserver((mutationList) => {
      mutationList.forEach((mutation) => {
        if (mutation.type === 'attributes'
          && mutation.attributeName === 'data-section-status'
          && dropinsContainer.attributes.getNamedItem('data-section-status').value === 'loaded') {
          dynamicContentFragment.classList.remove('hidden');
          observer.disconnect();
        }
      });
    });
    observer.observe(dropinsContainer, { attributes: true });
  }
  document.querySelector('main').append(dynamicContentFragment);
  await fireTargetCall(targetPayload, additionalDecisionScope.filter((el) => el));
  window.dispatchEvent(new CustomEvent('target-response'));
}

export async function toggleProductQuantityDisplay() {
  const showQuantitySelector = await getConfigValue('pdp-show-quantity-selector');
  const isProductQuantityEnabled = showQuantitySelector === 'true';
  const quantityElement = document.querySelector('.pdp-product__quantity');
  const optionsElement = document.querySelector('.pdp-product__options');
  const actionsElement = document.querySelector('.pdp-product__buttons');
  const swatchElement = document.querySelector('.pdp-swatches');
  quantityElement?.classList.toggle('pdp-product__quantity--hidden', !isProductQuantityEnabled);
  optionsElement?.classList.toggle('modified-flex', !isProductQuantityEnabled);
  actionsElement?.classList.toggle('modified-flex', !isProductQuantityEnabled);
  swatchElement?.classList.toggle('modified-flex', !isProductQuantityEnabled);
}

function pdpAssetsToImages(product, fetchDirectAttributes = false) {
  let pdpAssetsAttr;
  if (fetchDirectAttributes) {
    pdpAssetsAttr = getProductAssetsData('assets_pdp', product);
  } else {
    pdpAssetsAttr = product.attributes.find((a) => a.name === 'assets_pdp');
  }
  if (pdpAssetsAttr) {
    const pdpAssetsJson = JSON.parse(pdpAssetsAttr.value);
    const result = pdpAssetsJson.map((img, i) => {
      const imagesData = {
        url: formatPDPUrlAttributes(img.url),
        zoomUrl: formatPDPUrlAttributes(img.url, 'zoom'),
        label: `Product image ${i + 1} of ${pdpAssetsJson?.length ?? 0} for product "${product.name}"`,
        width: 500,
        height: 500,
      };
      imgUrlMap[imagesData.url] = imagesData.zoomUrl;
      return imagesData;
    });
    return result;
  }
  return [];
}

export function selectDefaultSeasonCode(product) {
  // transform product to correct format
  const productWithTransformedOptions = {
    ...product,
    options: product?.options?.map((o) => ({
      ...o,
      items: o.values.map((v) => ({ ...v, label: v.title })),
    })),
  };

  const seasonCodeOption = [productWithTransformedOptions?.options?.find((o) => o.id === 'season_code')?.items?.[0]?.id];
  selectSeasonCode(productWithTransformedOptions, seasonCodeOption);

  return seasonCodeOption;
}

export function selectDefaultOptions(product) {
  // transform product to correct format
  const productWithTransformedOptions = {
    ...product,
    options: product?.options?.map((o) => ({
      ...o,
      items: o.values.map((v) => ({ ...v, label: v.title })),
    })),
  };

  // select default options except season code
  const options = productWithTransformedOptions.options?.filter((item) => item.id !== 'season_code').map((option) => {
    const selectedOptionItemId = option.items?.find((item) => item.selected)?.id;
    const instockOptionItemId = option.items?.find((item) => item.inStock === true)?.id;
    return selectedOptionItemId || instockOptionItemId || option.items?.[0]?.id;
  }).filter((x) => !!x) ?? [];

  // select season code : Commented so we dont send season code as default option
  // const seasonCodeOption = [productWithTransformedOptions.options
  // .find((o) => o.id === 'season_code')?.items?.[0]?.id];
  // selectSeasonCode(productWithTransformedOptions, seasonCodeOption);
  // options.push(...seasonCodeOption);
  // select season code
  if (hasValue(hideSeasonCodeOption) && hideSeasonCodeOption === 'false') {
    const seasonCodeOption = [productWithTransformedOptions.options?.find((o) => o.id === 'season_code')?.items?.[0]?.id];
    selectSeasonCode(productWithTransformedOptions, seasonCodeOption);

    options.push(...seasonCodeOption);
  }
  return options;
}

export async function initializeProduct(product, locale, productDataLoadedCallback, options) {
  // Set Fetch Endpoint (Service)
  pdpApi.setEndpoint(await getConfigValue('commerce-saas-endpoint'));
  const fetchDirectAttributes = await getConfigValue('product-fetch-direct-attributes');

  // Set Fetch Headers (Service)
  pdpApi.setFetchGraphQlHeaders({
    'Content-Type': 'application/json',
    'Magento-Environment-Id': await getConfigValue('commerce-environment-id'),
    'Magento-Website-Code': await getConfigValue('commerce-website-code'),
    'Magento-Store-View-Code': await getConfigValue('commerce-store-view-code'),
    'Magento-Store-Code': await getConfigValue('commerce-store-code'),
    'Magento-Customer-Group': await getConfigValue('commerce-customer-group'),
    'x-api-key': await getConfigValue('commerce-x-api-key'),
  });

  const optionUIDs = selectDefaultOptions(product);
  // Initialize Dropins
  const productDataLoadedPromise = new Promise((res) => {
    initializers.register(pdpApi.initialize, {
      defaultLocale: locale,
      models: {
        ProductDetails: {
          initialData: optionUIDs[0] === undefined ? { ...product }
            : { ...product, optionsUIDs: options?.optionUIDs || optionUIDs },
          transform: (data) => {
            // TODO: the if condition needs to be reconfirmed and cleaned up
            if (optionUIDs?.length < 1 || data.optionUIDs?.includes(optionUIDs?.[0])) {
              res();
            } else {
              res();
            }

            data.images = pdpAssetsToImages(product, fetchDirectAttributes);

            const swatchImage = product?.attributes?.find((attr) => attr.name === 'swatch_image_url');
            data.attributes.push(swatchImage);

            const promotions = product.attributes.find((a) => a.name === 'promotions');
            if (promotions) {
              data.promotions = JSON.parse(promotions.value);
            }

            const freeGiftPromotions = product.attributes.find((a) => a.name === 'free_gift_promotion');
            if (freeGiftPromotions) {
              data.freeGiftPromotions = JSON.parse(freeGiftPromotions.value);
            }

            const memberPrice = product.attributes.find((a) => a.name === 'member_price');
            if (memberPrice) {
              data.attributes.push(memberPrice);
            }
            setJsonLdProduct(data);
            const gtm = product?.attributes?.find((el) => el.name === 'gtm_attributes')?.value;
            data.gtmAttributes = gtm ? JSON.parse(gtm) : null;
            if (product.variants?.variants) {
              data.variants = product.variants.variants;
            }
            return data;
          },
          fallbackData: (parentProduct, refinedData) => ({
            ...refinedData,
            description: parentProduct.description,
            urlKey: parentProduct.urlKey,
          }),
        },
      },
    });
  });

  initializers.mount();

  // pass promise without forcing caller to await it
  productDataLoadedCallback?.(productDataLoadedPromise);
}

function getCurrencyFormatter(currencyCode, countryCode, decimalDigits) {
  const currency = currencyCode || '';

  return new Intl.NumberFormat(`${document.documentElement.lang || 'en'}-${countryCode}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: parseInt(decimalDigits, 10) || 2,
    maximumFractionDigits: parseInt(decimalDigits, 10) || 2,
    numberingSystem: 'latn',
  });
}

function formatPrice(currency, price, countryCode, decimalDigits) {
  const currentFormatter = getCurrencyFormatter(currency, countryCode, decimalDigits);

  const newPrice = parseFloat(price);

  return currentFormatter.format(newPrice);
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

export function renderSpecialPrice(
  ctx,
  placeholders,
  decimalDigits,
  countryCode,
  options = null,
  isVatIncluded = true,
) {
  const special = ctx.data.prices.special || ctx.data.prices.final;

  const { maximumAmount, minimumAmount, amount } = special;
  let maxPrice;
  let minPrice;
  let price;

  const minimumFractionDigits = (decimalDigits);
  const maximumFractionDigits = (decimalDigits);

  if (maximumAmount && minimumAmount) {
    maxPrice = formatPrice(special.currency, maximumAmount, countryCode, maximumFractionDigits);
    minPrice = formatPrice(special.currency, minimumAmount, countryCode, minimumFractionDigits);
  } else {
    price = formatPrice(special.currency, amount, countryCode, decimalDigits);
  }
  const specialPriceHtml = document.createElement('div');
  specialPriceHtml.classList.add('pdp-price-range');

  const specialPriceMin = document.createElement('span');
  specialPriceMin.classList.add('dropin-price', 'dropin-price--default', 'dropin-price--small', 'dropin-price--bold');
  specialPriceMin.textContent = minPrice;

  const specialPriceHyphen = document.createElement('span');
  specialPriceHyphen.classList.add('pdp-price-range__label');
  specialPriceHyphen.textContent = '-';

  const specialPriceMax = document.createElement('span');
  specialPriceMax.classList.add('dropin-price', 'dropin-price--default', 'dropin-price--small', 'dropin-price--bold');
  specialPriceMax.textContent = maxPrice;

  const specialPriceSpan = document.createElement('span');
  specialPriceSpan.classList.add('dropin-price', 'dropin-price--default', 'dropin-price--small', 'dropin-price--bold');
  specialPriceSpan.textContent = price;

  if (maximumAmount && minimumAmount) {
    specialPriceHtml.appendChild(specialPriceMin);
    specialPriceHtml.appendChild(specialPriceHyphen);
    specialPriceHtml.appendChild(specialPriceMax);
    if (options?.hideSpecialPrice) {
      [specialPriceMin, specialPriceHyphen, specialPriceMax].forEach((priceEl) => priceEl.classList.add('hidden'));
    }
  } else {
    specialPriceHtml.appendChild(specialPriceSpan);
  }

  ctx.replaceWith(specialPriceHtml);

  const includingVat = document.createElement('div');
  if (isVatIncluded) {
    includingVat.classList.add('pdp-product__price--including-vat');
    includingVat.textContent = placeholders.priceIncludingVat || 'Inc. VAT';
    ctx.appendChild(includingVat);

    if (ctx.data.prices.regular && ctx.data.prices.regular.variant === 'strikethrough') {
      includingVat?.parentElement?.classList.add('hide');
    }
    // KW has no VAT
  }

  if (isAuraEnabled && isAuraEnabled === 'true' && auraCustomerData?.apc_link !== 2 && auraCustomerData?.apc_link !== 3) {
    const timer = setTimeout(async () => {
      const openAuraModal = isAuraEnabled === 'true'
        ? await import('../../scripts/aura/common.js')
        : {};
      const auraoffer = document.querySelector('.aura-price');

      if (auraoffer) {
        const joinAuraBannerContainer = document.createElement('div');
        joinAuraBannerContainer.className = 'get-aura-offer-container';

        const paragraph = document.createElement('p');

        auraoffer.append(joinAuraBannerContainer);
        joinAuraBannerContainer.appendChild(paragraph);

        let joinAuraLabel;
        let auraLoginButtonLabel;
        let linkAuraLabel;
        const getAuraOfferText = placeholders.getAuraOffer || 'Get this Aura Offer';

        if (isLoggedInUser() && auraCustomerData?.apc_link === 1) {
          linkAuraLabel = placeholders.linkYourAura || 'Link your Aura';
          auraLoginButtonLabel = ''; // No login link for this case
          const contentHtmlg = `
        <div class="get-aura-offer-links">
              <p>${getAuraOfferText}
              <span class="aura-underline-text">
                ${auraLoginButtonLabel ? '' : `<a href="#join" class="linking-link">${linkAuraLabel}</a>`}
              </span>
              </p>
            </div>
        `;
          joinAuraBannerContainer.innerHTML = contentHtmlg;
        } else {
          // User type #1: Ecom guest and Aura guest
          joinAuraLabel = placeholders.join || 'Join';
          auraLoginButtonLabel = placeholders.auraLoginButton || 'Login';
          const contentHtmlg = `
     <div class="get-aura-offer-links">
           <p>${getAuraOfferText}
           <span class="aura-underline-text join-link">
             <a href="#login">${auraLoginButtonLabel}</a>
             ${auraLoginButtonLabel ? `<span>${placeholders.or || 'or'}</span> <a href="#join">${joinAuraLabel}</a>` : ''}
           </span>
           </p>
         </div>
     `;
          joinAuraBannerContainer.innerHTML = contentHtmlg;
        }

        const footerLinks = [
          { selector: '.join-link', action: 'join' },
          { selector: '.login-link', action: 'login' },
          { selector: '.linking-link', action: 'link' },
        ];
        footerLinks.forEach(({ selector, action }) => {
          const link = joinAuraBannerContainer.querySelector(`.get-aura-offer-container ${selector}`);
          if (link) {
            link.addEventListener('click', () => openAuraModal.default(action));
          }
        });
      }
      clearTimeout(timer);
    }, 100);
  }

  ctx.onChange((next) => {
    const newSpecial = next.data.prices.special || next.data.prices.final;
    const {
      maximumAmount: newMaximumAmount, minimumAmount: newMinimumAmount, amount: newAmount,
    } = newSpecial;

    if (newSpecial) {
      price = formatPrice(
        newSpecial.currency,
        newAmount,
        countryCode,
        decimalDigits,
      );
      minPrice = formatPrice(
        newSpecial.currency,
        newMinimumAmount,
        countryCode,
        minimumFractionDigits,
      );
      maxPrice = formatPrice(
        newSpecial.currency,
        newMaximumAmount,
        countryCode,
        maximumFractionDigits,
      );

      if (newMaximumAmount && newMinimumAmount) {
        specialPriceMin.textContent = minPrice;
        specialPriceMax.textContent = maxPrice;
        specialPriceHtml.innerHTML = '';
        specialPriceHtml.appendChild(specialPriceMin);
        specialPriceHtml.appendChild(specialPriceHyphen);
        specialPriceHtml.appendChild(specialPriceMax);
      } else {
        specialPriceSpan.textContent = price;
        specialPriceHtml.innerHTML = specialPriceSpan.outerHTML;
      }

      if (isVatIncluded) {
        if (next.data.prices.regular && next.data.prices.regular.variant === 'strikethrough') {
          includingVat?.parentElement?.classList.add('hide');
        } else if (!next.data.prices.regular || next.data.prices.regular.variant === 'default') {
          includingVat?.parentElement?.classList.remove('hide');
        }
      }
    }
  });
}

export function renderRegularPrice(
  ctx,
  placeholders,
  decimalDigits,
  countryCode,
  isVatIncluded = true,
) {
  const { regular } = ctx.data.prices;
  const formattedPrice = formatPrice(regular.currency, regular.amount, countryCode, decimalDigits);

  const regularPrice = document.createElement('div');
  regularPrice.classList.add('pdp-price-range');

  const regularPriceSpan = document.createElement('span');
  regularPriceSpan.classList.add('dropin-price', 'dropin-price--small', 'dropin-price--bold');
  regularPriceSpan.textContent = `${formattedPrice}`;

  regularPrice.appendChild(regularPriceSpan);

  if (regular.variant) {
    regularPriceSpan.classList.add(`dropin-price--${regular.variant}`);
  }

  ctx.replaceWith(regularPrice);

  if (isVatIncluded && ctx.data.prices.regular) {
    const { priceIncludingVat } = placeholders;
    const includingVat = document.createElement('div');
    includingVat.classList.add('pdp-product__price--including-vat');
    includingVat.textContent = priceIncludingVat || 'Inc. VAT';
    ctx.appendChild(includingVat);
    // KW has no VAT
  }
  ctx.onChange((next) => {
    const { regular: newRegular } = next.data.prices;
    const newFormattedPrice = formatPrice(
      newRegular.currency,
      newRegular.amount,
      countryCode,
      decimalDigits,
    );

    regularPriceSpan.textContent = `${newFormattedPrice}`;
  });
}

export function renderPromotions(ctx, placeholders) {
  ctx.replaceWith(document.createElement('div'));

  const productPromotions = ctx.data.promotions || [];

  const { final, regular } = ctx.data.prices;
  if (final?.amount < regular?.amount) {
    const discount = Math.floor(((regular.amount - final.amount) / regular.amount) * 100);
    productPromotions.unshift({
      label: placeholders.plpSave !== '0' ? `(${placeholders.plpSave} ${discount}%)` : `-${discount}%`,
      type: 'discount',
    });
  } else {
    productPromotions.unshift({
      label: '',
      type: 'discount',
      hide: true,
    });
  }
  const labelsContainer = document.createElement('div');
  const linksContainer = document.createElement('div');
  if (productPromotions.length) {
    const promoWithoutLinks = productPromotions.filter((promotion) => !promotion.url);
    const promoWithLinks = productPromotions.filter((promotion) => !!promotion.url);

    labelsContainer.classList.add('pdp-product__promotion-labels-container');
    promoWithoutLinks.forEach((promotion) => {
      const promotionLabel = document.createElement('div');
      promotionLabel.classList.add('promo-label', promotion?.type === 'discount' ? 'discount-label' : '');
      if (promotion.hide) {
        promotionLabel.classList.add('hide');
      }
      promotionLabel.textContent = promotion.label;
      labelsContainer.appendChild(promotionLabel);
    });

    if (promoWithLinks.length) {
      linksContainer.classList.add('pdp-product__promotion-links-container');
      promoWithLinks.forEach((promotion) => {
        const promotionLabel = document.createElement('div');
        promotionLabel.classList.add('promo-label');
        promotionLabel.innerHTML = `<a href="/${lang}/${promotion.url}" alt="${promotion.description}">${promotion.label}</a>`;
        promotionLabel.addEventListener('click', (event) => {
          event.preventDefault();
          localStorage.setItem('categoryListName', `pdp-pl-${promotion.label}`); // Set the pdp promo in local storage
          window.location.href = `/${lang}/${promotion.url}`;
        });
        linksContainer.appendChild(promotionLabel);
      });
    }
  }
  ctx.prependSibling(labelsContainer);
  ctx.prependSibling(linksContainer);

  const discountPromotion = labelsContainer.querySelector('.discount-label');

  ctx.onChange(async (next) => {
    const { final: finalChanged, regular: regularChanged } = next.data.prices;
    if (finalChanged?.amount < regularChanged?.amount) {
      const discountChanged = Math.floor(
        ((regularChanged.amount - finalChanged.amount) / regularChanged.amount) * 100,
      );
      discountPromotion.textContent = placeholders.plpSave !== '0' ? `(${placeholders.plpSave} ${discountChanged}%)` : `-${discountChanged}%`;
      discountPromotion.classList.remove('hide');
    } else {
      discountPromotion.textContent = '';
      discountPromotion.classList.add('hide');
    }
  });
}

// creating carousel
function addCarousel(imageGalleyCarousel, visibleImages) {
  const commonStyleConfig = {
    navButtons: true,
    isRTL: document.documentElement.dir === 'rtl',
    defaultStyling: true,
    fullPageScroll: !(window.innerWidth < 768),
    visibleItems: [
      {
        items: Number(visibleImages),
      },
    ],
  };
  const sliderElements = imageGalleyCarousel.querySelectorAll('.pdp-gallery-carousel');
  Array.from(sliderElements)
    ?.slice(0, 20)
    .forEach((element) => {
      if (element.querySelector('img')) {
        createCarousel(element, null, { ...commonStyleConfig }, 'vertical');
      }
    });
}

export default async function decorate($block) {
  const [sku, product, productDL] = await window.product;
  // productDL is used to obtain product values in English for DL for non-English websites
  if (!product) {
    showCommerceErrorPage();
    return Promise.resolve();
  }

  const amastyLabel = product.attributes?.find((el) => el.name === 'product_labels')?.value;
  const amastyData = amastyLabel && JSON.parse(amastyLabel);

  const decimalDigits = await getConfigValue('cart-price-decimals') || 2;
  const countryCode = await getCountryCode();
  let isVisitorEligible = true;
  const previewPreaccessAttr = product.attributes
    ?.find((el) => el.name === 'preview_preaccess_data')
    ?.value;
  const previewPreaccessData = previewPreaccessAttr ? JSON.parse(previewPreaccessAttr) : null;
  if (previewPreaccessData) {
    const visitorEligibleData = await getVisitorEligibility(
      previewPreaccessData,
      document.documentElement.lang,
    );
    isVisitorEligible = visitorEligibleData.isVisitorEligible;
    if (visitorEligibleData?.type && visitorEligibleData.type === 'preview') {
      if (!visitorEligibleData.isVisitorEligible) {
        const redirectUrl = await getRedirectUrl(
          visitorEligibleData.isVisitorEligible,
          visitorEligibleData.visitorTier,
          document.documentElement.lang,
        );
        window.location.href = redirectUrl;
        return Promise.resolve();
      }
    }
  }

  const locale = await getLocale();
  const placeholders = await fetchPlaceholdersForLocale();

  decorateMetadata(product, placeholders);

  let refinementQueryLoadedPromise;
  if (await getConfigValue('pdp-no-refinement')) {
    await initializeProduct(product, locale);
  } else {
    await initializeProduct(product, locale, (p) => {
      refinementQueryLoadedPromise = p;
    });
  }

  const attributesToShow = await getAttributesToShow();
  const brandLabelExclude = await getConfigValue('pdp-exclude-label');
  const visibleImages = await getConfigValue('image-gallery-visible-count');
  const productStock = await getProductStockStatus(sku);
  const pdpCarouselEnabled = await getConfigValue('pdp-gallery-carousel-enable');
  const productQuantity = productStock?.items[0]?.stock_data?.qty;
  const sizeVolumeDisplay = await getConfigValue('pdp-size-display') === 'true';
  const isVatIncluded = await isVatIncludedDisplayed();

  const slots = {
    Options: (ctx) => optionsSlot(ctx, $block, placeholders),
    Actions: (ctx) => actionsSlot(ctx, $block, placeholders, isVisitorEligible, productQuantity),
    Title: (ctx) => {
      const schema = document.createElement('div');
      const excludeBrands = brandLabelExclude?.split(',').map((b) => b.trim().toLowerCase());

      const brand = ctx.data.attributes.find(
        (el) => el.id === 'brand_full_name' || el.id === 'brand',
      )?.value;
      if (brand && !excludeBrands?.includes(brand.toLowerCase())) {
        const subtitle = document.createElement('p');
        subtitle.classList.add('pdp-product__subtitle');
        subtitle.textContent = brand;
        schema.appendChild(subtitle);
      }

      const title = document.createElement('h6');
      title.classList.add('pdp-product__title');
      title.textContent = ctx.data.name;

      schema.appendChild(title);
      const productTypeTitleText = ctx.data.attributes?.find((el) => el.id === 'collection_1')?.value || '';
      if (productTypeTitleText !== '') {
        const productTypeTitle = document.createElement('p');
        productTypeTitle.classList.add('pdp-product__type');
        productTypeTitle.textContent = productTypeTitleText;
        schema.appendChild(productTypeTitle);
      }
      ctx.replaceWith(schema);

      let memberPrice;
      const memberPriceValue = ctx.data?.attributes.find((attr) => attr.name === 'member_price')?.value;
      if (memberPriceValue) {
        memberPrice = memberPriceValue;
      }
      decorateMemberPrice(ctx, memberPrice, placeholders, auraCustomerData);
    },
    RegularPrice: (ctx) => {
      renderRegularPrice(ctx, placeholders, decimalDigits, countryCode, isVatIncluded);
    },
    SpecialPrice: (ctx) => {
      renderSpecialPrice(ctx, placeholders, decimalDigits, countryCode, null, isVatIncluded);
    },
    ShortDescription: (ctx) => productStatusSlot(ctx, $block, placeholders),
    Description: (ctx) => descriptionSlot(ctx, $block, placeholders, attributesToShow),
    InfoContent: (ctx) => infoContentSlot(ctx, placeholders),
    Attributes: (ctx) => {
      renderPromotions(ctx, placeholders);

      const bnplContainer = document.createElement('div');
      bnplContainer.classList.add('pdp-product__bnpl', 'loading', 'pdp-collapsible-container');
      ctx.prependSibling(bnplContainer);
      decorateBnpl(ctx, bnplContainer, placeholders);

      const ratingsContainer = document.createElement('div');
      ratingsContainer.classList.add('pdp-product__ratings', 'loading');
      ctx.prependSibling(ratingsContainer);

      // size volume display
      if (sizeVolumeDisplay) {
        const sizeVolume = document.createElement('div');
        sizeVolume.classList.add('product-volume');
        const sizeText = document.createElement('span');
        sizeText.innerText = placeholders.sizevolume;
        const productSize = ctx.data.attributes.find((el) => el.id === 'size')?.value;
        const sizeValue = document.createElement('span');
        sizeValue.innerText = productSize;
        sizeVolume.appendChild(sizeText);
        sizeVolume.appendChild(sizeValue);
        ctx.prependSibling(sizeVolume);
      }

      // amasty labels
      const isMobileView = window.matchMedia('(max-width: 1024px)').matches;
      if (amastyLabel?.length > 0 && amastyData.length > 0) {
        const pdpImageBlock = isMobileView ? document.querySelector('.pdp-carousel.pdp-product__images') : document.querySelector('.pdp-gallery-grid.pdp-product__images');
        const amastyBlock = document.createElement('div');
        amastyBlock.classList.add('amastyLabel');
        const amastyImage = document.createElement('img');
        amastyImage.setAttribute('src', amastyData[0]?.image);
        amastyImage.setAttribute('alt', amastyData[0]?.name);
        amastyBlock.appendChild(amastyImage);
        pdpImageBlock.appendChild(amastyBlock);
      }

      window.addEventListener('delayed-loaded', async () => {
        const ratingEnabled = await isRatingEnabled();
        if (ratingEnabled) {
          import('./slots/ratings.js').then(({ decorateRatings }) => {
            decorateRatings(ctx, ratingsContainer, placeholders, locale);
          });
        }

        /**
         * Event listener for PDP image hover
         */
        document.querySelectorAll('.pdp-gallery-grid__item').forEach((item) => {
          item.addEventListener('mousemove', (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            e.target.style.transformOrigin = `${x}% ${y}%`;
          });

          // hiding the chat for PDP image viewer overlay
          item.addEventListener('click', () => {
            if (document.querySelector('.pdp-overlay__content')) {
              document.querySelector('.spr-lc-light').style.display = 'none';
            }
            document.querySelector('.pdp-overlay__close-button').addEventListener('click', () => {
              document.querySelector('.spr-lc-light').style.display = 'block';
            });
            document.querySelectorAll('.pdp-overlay__content img').forEach((img) => {
              img.src = imgUrlMap[img.src];
            });
          });
        });

        // Observer for pdp action buttons position change in mobile view
        const observer = new IntersectionObserver((entries) => {
          if (isMobileView) {
            const intersecting = entries[0].isIntersecting;
            if (intersecting) {
              document.querySelector('.pdp-product__actions').classList.add('fixed');
            } else {
              // document.querySelector('.pdp-product__actions').classList.remove('fixed');
            }
          }
        }, { thresold: 0.1 });
        const box = document.querySelector('.pdp-carousel');
        observer.observe(box);
      });
    },
  };

  if (pdpCarouselEnabled === 'true') {
    slots.GalleryContent = (ctx) => {
      const { images } = ctx.data;
      let carouselHTML = `</span>
      <div class="pdp-gallery-carousel">`;
      images.forEach((image) => {
        const thumbnailUrl = image.url;
        // Append each image to the carousel HTML
        carouselHTML += `<div class="carousel-item">
          <a href="#"><img src="${thumbnailUrl}" alt="Image"></a>
        </div>`;
      });

      carouselHTML += '</div></span>';
      const imageGalleyCarousel = document.createElement('div');
      imageGalleyCarousel.classList.add('pdp-carousel-container');
      imageGalleyCarousel.innerHTML = carouselHTML;
      if (images.length > visibleImages) {
        addCarousel(imageGalleyCarousel, visibleImages);
      } else {
        imageGalleyCarousel.querySelector('.pdp-gallery-carousel')?.classList.add('disabled-carousel');
      }
      ctx.appendChild(imageGalleyCarousel);
    };
  }
  // For cases when user manually opens PDP URL, there would not be any prior list available
  if (document.referrer === '') {
    localStorage.removeItem('categoryListName');
    localStorage.removeItem('categoryListId');
  }
  window.addEventListener('lazy-loaded', async () => {
    sendCategoriesToDataLayer(productDL?.gtm?.category?.split('/'));
    datalayerViewItemEvent(productDL);
  }, { once: true });

  if (await getConfigValue('pdp-no-refinement')) {
    addTargetContent(productDL);
  } else {
    try {
      refinementQueryLoadedPromise.then(() => {
        addTargetContent(productDL);
      });
    } catch (e) {
      console.error(e);
    }
  }

  window.addEventListener('delayed-loaded', () => {
    window.dispatchEvent(new CustomEvent('target-response'));
  });

  /**
   Event listener for add to bad cart update
   */
  document.querySelector('main').addEventListener('addtobag-updated', async (event) => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    await renderAddToBagDialog(event);
  });

  await productRenderer.render(ProductDetails, {
    sku,
    slots,
    carousel: {
      imageParams: {
        width: null,
      },
    },
    hideURLParams: true,
    hideSku: true,
  })($block);

  await toggleProductQuantityDisplay();

  const mobileBreadcrumb = await getConfigValue('pdp-display-breadcrumb-mobile');
  if (mobileBreadcrumb === 'true') {
    document.querySelector('.breadcrumb-wrapper').classList.add('mobile-visible');
  }

  return refinementQueryLoadedPromise;
}
