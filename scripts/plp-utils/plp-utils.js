import ProductDetails from '@dropins/storefront-pdp/containers/ProductDetails.js';
import { render as productRenderer } from '@dropins/storefront-pdp/render.js';
import { getConfigValue } from '../configs.js';
import { createElement, hasValue } from '../scripts.js';
import { loadProduct } from '../commerce.js';
import {
  getLocale,
  initializeProduct, renderPromotions, renderRegularPrice,
  renderSpecialPrice, toggleProductQuantityDisplay, selectDefaultSeasonCode,
  isVatIncludedDisplayed,
} from '../../blocks/product-details/product-details-render.js';
import actionsSlot, { createSocialShareButton } from '../../blocks/product-details/slots/actions.js';
import optionsSlot, { decorateSizeGuide } from '../../blocks/product-details/slots/options.js';

const selectedOptions = {};

export async function loadBannerFragments() {
  const bannerslist = document.querySelectorAll('.sidebar-main .fragment-container');
  const activeContainers = Array.from(bannerslist).filter((banner) => banner.querySelector('.block.active'));
  const mainWrapper = document.querySelector('.main-wrapper');
  if (activeContainers.length && mainWrapper) {
    activeContainers.forEach((banner) => {
      const bannerwrapper = document.createElement('div');
      bannerwrapper.classList.add('listing-banner-wrapper');
      bannerwrapper.appendChild(banner);
      mainWrapper.parentNode.insertBefore(bannerwrapper, mainWrapper);
    });
  }
}

// Utility function to handle size group logic.
export const getSizeGroup = async () => {
  const displaySizeGrouping = await getConfigValue('size-groupping');
  if (displaySizeGrouping !== 'true') {
    return { displaySizeGrouping: false, sizeGroups: [], allSizeAttributes: [] };
  }

  const groupSizeConfig = await getConfigValue('group-size-config');
  const sizeGroups = JSON.parse(groupSizeConfig);
  // Extract all attributes into a flat array
  const allSizeAttributes = sizeGroups.flatMap((group) => Object.values(group.attributes));
  return { displaySizeGrouping, sizeGroups, allSizeAttributes };
};

/**
 * Handles click on size list items.
 * @param {Event} event - The click event.
 */
const handleSizeSelection = (event) => {
  const selectedTextElement = document.querySelector('.selected-text');
  if (selectedTextElement) {
    selectedTextElement.textContent = event.target.textContent; // Update the selected size text
  }
};

/**
 * Generates the size grouping for a product.
 * @param {Object} product - The product details.
 * @returns {HTMLElement|null} - The constructed size grouping DOM element or null.
 */
export async function productDetailSizeGroupping(product, placeholders) {
  if (!hasValue(product.variants) && !hasValue(product.variants.variants)) return null;

  const groupConfig = await getSizeGroup();

  // Extract size attributes from variants.
  const sizeAttributesMap = product.variants.variants.reduce((
    sizeAttributes,
    { product: { attributes = [] } = {} },
  ) => {
    attributes.forEach(({ name, value }) => {
      const attrKey = `attr_${name}`;
      if (groupConfig.allSizeAttributes.includes(attrKey)) {
        sizeAttributes[name] = sizeAttributes[name] || new Set();
        sizeAttributes[name].add(value);
      }
    });
    return sizeAttributes;
  }, {});

  if (!hasValue(sizeAttributesMap)) return null;

  // Create main size group wrapper and label.
  const sizeGroupMarkup = createElement('div', ['group-wrapper']);
  const sizeLabel = createElement('label', []);
  const filterTitle = placeholders.groupSizeFilterTitle || 'Sizes';
  sizeLabel.append(
    createElement('span', [], {}, filterTitle),
    createElement('span', ['selected-text']),
  );
  sizeGroupMarkup.append(sizeLabel);

  // Create filter toggles for size groups
  const divContainer = createElement('div', ['group-anchor-wrapper']);
  groupConfig.sizeGroups.forEach(({ attributes, defaultOpen }) => {
    const hasValidAttributes = Object.values(attributes).some(
      (attrKey) => Object.keys(sizeAttributesMap).includes(attrKey.replace('attr_', '')),
    );
    if (hasValidAttributes) {
      Object.entries(attributes).forEach(([key, attrNameNoLng]) => {
        const groupSpan = createElement(
          'span',
          ['group-filter-title-span', 'size-toggle'],
          { 'data-attribute': attrNameNoLng },
          key,
        );

        const handleGroupToggle = (event) => {
          const toggle = event.target;
          const parentElement = toggle.closest('span');
          const selectedSize = toggle.getAttribute('data-attribute');

          // Update active state for toggles.
          parentElement.parentNode
            .querySelectorAll('.size-toggle.active')
            .forEach((activeToggle) => activeToggle.classList.remove('active'));
          toggle.classList.add('active');

          // Show the selected size list and hide others.
          document.querySelectorAll('ul.sizes-list').forEach((ul) => {
            ul.classList.toggle('hide', !ul.classList.contains(selectedSize));
          });
        };
        groupSpan.addEventListener('click', handleGroupToggle);
        divContainer.append(groupSpan);

        // Mark the default open group as active.
        if (`${attrNameNoLng}` === defaultOpen) {
          groupSpan.classList.add('active');
        }
      });
    }
  });
  sizeGroupMarkup.append(divContainer);

  // Create size lists for each attribute.
  Object.entries(sizeAttributesMap).forEach(([attributeName, attributeValues]) => {
    const attrClass = `attr_${attributeName}`;
    const isDefaultOpen = groupConfig.sizeGroups.some(
      (group) => group.defaultOpen === attrClass,
    );

    const ul = createElement('ul', [attrClass, 'sizes-list', isDefaultOpen ? '' : 'hide'].filter(Boolean));

    attributeValues.forEach((attributeValue) => {
      const li = createElement('li', ['size-li'], {}, attributeValue);
      li.addEventListener('click', handleSizeSelection);
      ul.append(li);
    });

    sizeGroupMarkup.append(ul);
  });

  return sizeGroupMarkup;
}

// Utility function to manage group size filter list.
export function manageGroupSizeFilterList(ulDiv, listItems, placeholders) {
  const groups = new Set();
  listItems.forEach((item) => {
    if (item.getAttribute('data-group') && !item.classList.contains('hide')) {
      groups.add(item.getAttribute('data-group'));
    }
  });
  groups.forEach((group) => {
    // Get all filter items for this group.
    const groupItems = ulDiv.querySelectorAll(`li.filter-item[data-group="${group}"]`);
    const entries = Object.entries(groupItems);
    let allHidden = true;
    let visibleCount = 0;
    entries.forEach(([, value]) => {
      if (
        !value.classList.contains('grouphide')
        && !value.classList.contains('skip-filter')
        && value.style.display !== 'none'
      ) {
        allHidden = false;
      }
      if (value.style.display !== 'none') {
        visibleCount += 1;
      }
    });
    if (visibleCount > 3) {
      allHidden = false;
    }

    // Select the group containers and group filter only once for efficiency
    const groupContainer = ulDiv.querySelectorAll(`li.filter-item[data-group="${group}"]`);
    const groupFilter = ulDiv.querySelector(`li.group-filter[group-filter="${group}"]`);
    const existingNoResult = ulDiv.querySelector(`li.filter-item[data-group="${group}"].no-results`);
    if (allHidden) {
      if (!existingNoResult) {
        if (groupContainer.length > 0) {
          const noResultElement = document.createElement('li');
          noResultElement.classList.add('filter-item', 'no-results', 'skip-filter');
          if (groupFilter && !groupFilter.classList.contains('active')) {
            noResultElement.classList.add('grouphide');
          }
          noResultElement.setAttribute('data-group', group);
          noResultElement.textContent = placeholders.groupFilterNoResult || 'No Results';
          const lastItem = groupContainer[groupContainer.length - 1];
          lastItem.parentNode.insertBefore(noResultElement, lastItem);
        }
      }
    } else if (existingNoResult) {
      existingNoResult.remove();
    }
  });
}

/**
 * Handles size toggling within a size group filter.
 *
 * @param {Event} event - The event triggered.
 */
export const handleSizeToggle = (event) => {
  const parentElement = event.target.closest('li');
  const selectedSize = event.target.getAttribute('data-attribute');

  const attributes = [];
  parentElement.querySelectorAll('.group-filter-title-span').forEach((span) => {
    span.classList.toggle('active', span.getAttribute('data-attribute') === selectedSize);
    attributes.push(span.getAttribute('data-attribute'));
  });

  const container = parentElement.closest('ul');
  container.querySelectorAll('[data-filter-attr-name]').forEach((element) => {
    const attrName = element.getAttribute('data-filter-attr-name');
    if (attributes.includes(attrName)) {
      element.classList.toggle('grouphide', attrName !== selectedSize);
    }
  });
};

/**
 * Handles accordion-style toggle for filter groups.
 *
 * @param {Event} event - The click event triggered on a group filter.
 */
export const handleGroupSizeAccordion = (event) => {
  const selectedGroup = event.target.getAttribute('group-filter');
  const parentElement = event.target.closest('ul');
  const isActive = event.target.classList.contains('active');
  if (isActive) {
    event.target.classList.remove('active');
  } else {
    event.target.classList.add('active');
    const element = document.querySelector(`li.no-results[data-group="${selectedGroup}"]`);
    if (element) {
      element.classList.remove('grouphide');
    }
  }

  let span = null;
  const elements = parentElement.querySelectorAll(`[data-group="${selectedGroup}"]`);
  elements.forEach((element) => {
    const siblingLis = Array.from(element.parentElement.children).filter(
      (sibling) => sibling.matches(`li.group-filter-labels[data-group="${selectedGroup}"]`),
    );
    if (hasValue(siblingLis)) {
      siblingLis.forEach((li) => {
        const activeSpan = li.querySelector('span.active');
        if (activeSpan) {
          span = activeSpan;
        }
      });
    }
    if (!hasValue(span)) {
      element.classList.toggle('grouphide', isActive);
    }
  });
  if (hasValue(span)) {
    const selectedSize = span.getAttribute('data-attribute');
    elements.forEach((element) => {
      if (isActive) {
        element.classList.add('grouphide');
      } else if (element.getAttribute('data-filter-attr-name') === selectedSize) {
        element.classList.remove('grouphide');
      } else if (element.classList.contains('group-filter-labels')) {
        element.classList.remove('grouphide');
      }
    });
  }
};

/**
 * Creates a list item for a size group filter in the filter menu.
 *
 * @param {Object} group - The group containing size attributes (e.g., Shoes, Clothing).
 * @param {HTMLElement} ul - The UL element to append the list item to.
 * @returns {HTMLElement} - The created list item element.
 */
export function createSizeGroupListItem(group, ul, event) {
  const groupLi = createElement(
    'li',
    ['filter-item', 'group-filter', 'skip-filter', 'active'],
    { 'group-filter': group.title },
    group.title,
  );

  groupLi.addEventListener(event, handleGroupSizeAccordion);
  ul.append(groupLi);
  return groupLi;
}

/**
 * Creates a size toggle within a size group.
 *
 * @param {Object} group - The group containing size attributes.
 * @param {HTMLElement} ul - The UL element to append the size toggle to.
 * @returns {HTMLElement} - The created list item element for the size toggle.
 */
export function createSizeToggle(group, ul, event) {
  const subGroupLi = createElement(
    'li',
    ['filter-item', 'group-filter-labels', 'skip-filter'],
    { 'data-attribute': 'Sizes', 'data-group': group.title },
    '',
  );

  Object.entries(group.attributes).forEach(([key, attrNameNoLng]) => {
    const groupSpan = createElement(
      'span',
      ['group-filter-title-span', 'size-toggle', ...(attrNameNoLng === group.defaultOpen ? ['active'] : [])],
      { 'data-attribute': attrNameNoLng },
      key,
    );

    groupSpan.addEventListener(event, handleSizeToggle);
    subGroupLi.append(groupSpan);
  });

  ul.append(subGroupLi);
  return subGroupLi;
}

export function updateGroupFilters(
  response,
  sizeGroups,
  productListingLanguage,
  facetFilters,
  SIZE_GROUPING,
) {
  const lowercaseFacets = {};
  sizeGroups.forEach((group) => {
    Object.entries(group.attributes).forEach(([, attrNameNoLng]) => {
      if (response.results[0].facets[`${attrNameNoLng}.${productListingLanguage}`]) {
        lowercaseFacets[attrNameNoLng] = Object.fromEntries(
          Object.entries(response.results[0].facets[`${attrNameNoLng}.${productListingLanguage}`])
            .map(([key, val]) => [key.toLowerCase(), val]),
        );
      }
    });
  });
  const selectedElements = document.querySelectorAll(`.filters-body-main-ul [data-attribute="${SIZE_GROUPING}"] ul > li.active-checkbox`);
  const selectedAttributes = [];
  selectedElements.forEach((element) => {
    selectedAttributes.push(element.getAttribute('data-group'));
  });
  document.querySelectorAll(`[data-attribute="${SIZE_GROUPING}"] ul > li`).forEach((filterLi) => {
    if (!filterLi.getAttribute('data-filter-attr-name')) {
      return;
    }
    const attrName = filterLi.getAttribute('data-filter-attr-name').toLowerCase();
    const attrValue = filterLi.getAttribute('data-filter-attr-value').toLowerCase();
    const dataGroup = filterLi.getAttribute('data-group');
    if (
      facetFilters[attrName] === undefined
      || !facetFilters[attrName].map((item) => item.toLowerCase()).includes(attrValue)
    ) {
      if (!selectedAttributes.includes(dataGroup)) {
        filterLi.classList.add('hide');
      }
    } else {
      filterLi.querySelector('.filter-count').innerHTML = `(${Object.keys(lowercaseFacets[attrName]).length >= 1 ? lowercaseFacets[attrName][attrValue] : lowercaseFacets[attrName][attrValue]})`;
      filterLi.classList.remove('hide');
    }
  });

  const listItems = document.querySelectorAll(`[data-attribute="${SIZE_GROUPING}"] ul > li`);
  const groups = new Set();
  listItems.forEach((item) => {
    if (item.getAttribute('data-group')) {
      groups.add(item.getAttribute('data-group'));
    }
  });
  groups.forEach((group) => {
    // Get all filter items for this group.
    const groupItems = Array.from(listItems).filter((item) => item.matches(`li.filter-item[data-group="${group}"]`));
    const entries = Object.entries(groupItems);
    let allHidden = true;
    const visibleCount = entries.reduce((count, [, value]) => {
      if (!value.classList.contains('hide')) {
        allHidden = false;
        return count + 1;
      }
      return count;
    }, 0);
    const elements = document.querySelectorAll(`[group-filter="${group}"]`);
    const groupFilterLabels = document.querySelectorAll(`li.group-filter-labels[data-group="${group}"]`);
    if (groupFilterLabels.length) {
      allHidden = visibleCount <= 2;
      groupFilterLabels.forEach((label) => label.classList.toggle('hide', allHidden));
    }
    if (elements.length) {
      elements.forEach((element) => element.classList.toggle('hide', allHidden));
    }
  });
}

/**
 * Generates HTML for a loading shimmer effect with specified width and height pairs.
 * @param {Array.<Array.<number>>} shimmerSizes
 * Array of [width (%), height (rem)] pairs, default [[100, 3], [100, 3]].
 */
export function generateLoadingShimmer(shimmerSizes = [[100, 3], [100, 3]]) {
  return shimmerSizes.map(([width, height]) => `<p class="loading-shimmer" style="--placeholder-width: ${width}%; --placeholder-height: ${height}rem"></p>`).join('');
}

export function preventProductZoom() {
  document.querySelectorAll('.pdp-product .pdp-product__images .pdp-gallery-grid__item').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.stopImmediatePropagation();
    }, { capture: true });
  });
}

function getProductSizeOption(sizeOptions) {
  return selectedOptions.size && sizeOptions.find((option) => option.id === selectedOptions.size)
    ? selectedOptions.size : sizeOptions?.[0].id;
}

function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

export function getProductOptions(product, seasonCodeOptions = []) {
  const productOptions = product?.options?.filter((item) => item.id !== 'season_code').map((item) => {
    if (item.id === 'size') {
      return getProductSizeOption(item.values);
    }
    return item.values?.[0].id;
  }).filter((x) => !!x && !seasonCodeOptions.includes(x)) || [];
  seasonCodeOptions.forEach((option) => {
    if (!productOptions.includes(option)) {
      productOptions.push(option);
    }
  });
  return productOptions;
}

export async function renderProduct(placeholders, model, variantSku = null) {
  const [sku, product] = window.product;
  const seasonCodeOption = selectDefaultSeasonCode(product);
  const optionsUIDs = getProductOptions(product, seasonCodeOption);
  const decimalDigits = await getConfigValue('cart-price-decimals') || 2;
  const countryCode = await getConfigValue('country-code') || 'AE';
  const productDiv = document.createElement('div');
  productDiv.setAttribute('id', 'product-overview-popup');
  const locale = await getLocale();
  await initializeProduct(product, locale, null, { optionsUIDs });
  const isVatIncluded = await isVatIncludedDisplayed();

  const slots = {
    Options: (ctx) => {
      optionsSlot(ctx, productDiv, placeholders, true, variantSku, { ...selectedOptions });
      decorateSizeGuide(productDiv.querySelector('.pdp-swatches-size__link--container'), ctx, placeholders);
    },
    Actions: (ctx) => {
      actionsSlot(ctx, productDiv, placeholders, true);
      const productHref = `${window.location.origin}/${document.documentElement.lang || 'en'}/${ctx.data.urlKey}`;
      const viewProductDetails = document.createElement('button');
      viewProductDetails.addEventListener('click', () => {
        window.open(productHref, '_self');
      });
      viewProductDetails.classList.add('secondary', 'view-product-details');
      if (model === 'wishlist') {
        viewProductDetails.textContent = placeholders.favouritesViewProductDetails;
      } else {
        viewProductDetails.textContent = placeholders.productDetailsButton || 'Product Details';
      }
      if (isMobile()) {
        productDiv.querySelector('.pdp-product__content-column').insertAdjacentElement('afterend', viewProductDetails);
      } else {
        productDiv.querySelector('.pdp-swatches').append(viewProductDetails);
      }
      createSocialShareButton(product, productHref);
      toggleProductQuantityDisplay();
    },
    Title: (ctx) => {
      const titleDiv = document.createElement('div');
      const brand = ctx.data.attributes?.find((el) => el.id === 'brand_full_name')?.value;
      if (brand) {
        const subtitle = document.createElement('p');
        subtitle.classList.add('pdp-product__subtitle');
        subtitle.textContent = brand;
        titleDiv.appendChild(subtitle);
      }
      const title = document.createElement('h6');
      title.classList.add('pdp-product__title');
      title.textContent = ctx.data.name;
      titleDiv.appendChild(title);
      ctx.replaceWith(titleDiv);
    },
    RegularPrice: (ctx) => {
      renderRegularPrice(ctx, placeholders, decimalDigits, countryCode, isVatIncluded);
    },
    SpecialPrice: (ctx) => {
      renderSpecialPrice(ctx, placeholders, decimalDigits, countryCode, {
        hideSpecialPrice: true,
      }, isVatIncluded);
    },
    ShortDescription: (ctx) => {
      const shortDescription = document.createElement('div');
      ctx.replaceWith(shortDescription);
    },
    Description: (ctx) => {
      const description = document.createElement('div');
      ctx.replaceWith(description);
    },
    Attributes: (ctx) => {
      renderPromotions(ctx, placeholders);
      productDiv.querySelector('.pdp-product__prices').insertAdjacentElement('afterend', productDiv.querySelector('.pdp-product__attributes'));
    },
  };

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
  })(productDiv);

  return productDiv;
}

export async function updateProductPopup(productSku, placeholders, container, modelClass, model) {
  /* Array of [width (%), height (rem)] pairs */
  const galleryShimmerSizes = [[100, 20]];
  const contentShimmerSizes = [[100, 3], [100, 3], [100, 1.5],
    [30, 8], [100, 2.5], [80, 5], [80, 5], [100, 5]];
  const shimmerElement = document.createElement('div');
  shimmerElement.classList.add('product-overview-shimmer');
  shimmerElement.innerHTML = `<div class="shimmer-container">
      <div class="shimmer-column">
        ${generateLoadingShimmer(galleryShimmerSizes)}
      </div>
      <div class="shimmer-column">
        ${generateLoadingShimmer(contentShimmerSizes)}
      </div>
  </div>`;

  window.product = await loadProduct(productSku);
  container.textContent = '';
  container.append(shimmerElement);

  const productOverviewElement = await renderProduct(placeholders, model);
  productOverviewElement.classList.add(`${model}-hidden`);
  container.appendChild(productOverviewElement);
  container.classList.remove(modelClass);

  shimmerElement.classList.add('hide-shimmer');

  function getTransitionEndEventName() {
    const el = document.createElement('div');
    const transitions = {
      transition: 'transitionend', // Standard
      WebkitTransition: 'webkitTransitionEnd', // Safari, older Chrome
      OTransition: 'oTransitionEnd', // Opera
      MozTransition: 'transitionend', // Older Firefox
    };
    const transition = Object.keys(transitions).find((t) => el.style[t] !== undefined);
    return transition ? transitions[transition] : null;
  }

  const transitionEndEvent = getTransitionEndEventName();

  if (transitionEndEvent) {
    shimmerElement.addEventListener(transitionEndEvent, () => {
      shimmerElement?.remove();
      productOverviewElement.classList.remove(`${model}-hidden`);
    });
  } else {
    shimmerElement?.remove();
    productOverviewElement.classList.remove(`${model}-hidden`);
  }

  preventProductZoom();
}
