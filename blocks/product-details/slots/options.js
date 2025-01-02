import { decorateIcons, loadCSS } from '../../../scripts/aem.js';
import { datalayerSizeSelectorEvent, datalayerSizeGuide, datalayerColorSwatchEvent } from '../../../scripts/analytics/google-data-layer.js';
import {
  loadFragment, createModalFromContent, openModal,
  formatPrice,
  isLoggedInUser,
  hasValue,
  createElement,
  getBrandPath,
  getLanguageAttr,
  createShoeAi,
} from '../../../scripts/scripts.js';
import { performCatalogServiceQuery, cacheProductData, isPDP } from '../../../scripts/commerce.js';
import {
  initSizeGuideDefaults,
  setDefaultSizeGuideFilters,
} from '../../size-guide/size-guide-utility.js';
import { getConfigValue } from '../../../scripts/configs.js';

const SIZE_GUIDE_DIALOG_ID = 'size-guide-dialog';
const appendSwatchToHeader = await getConfigValue('append-swatch-to-header');
const groupConfig = await (async () => {
  const displaySizeGrouping = (await getConfigValue('size-groupping')) === 'true';
  if (!displaySizeGrouping) {
    return { displaySizeGrouping: false, sizeGroups: [], allSizeAttributes: [] };
  }
  const groupSizeConfig = await getConfigValue('group-size-config');
  const sizeGroups = JSON.parse(groupSizeConfig);
  // Extract all attributes into a flat array
  const allSizeAttributes = sizeGroups.flatMap((group) => Object.values(group.attributes));
  return { displaySizeGrouping, sizeGroups, allSizeAttributes };
})();

const enableShoeai = (await getConfigValue('enable_shoeai')) === 'true';
const lang = getLanguageAttr();

export async function decorateSizeGuide(sizeGuideBlock, ctx, placeholders) {
  const sizeGuideModal = await loadFragment(`/${document.documentElement.lang}/fragments/pdp/size-guide/sizes`);
  const sizeGuideTitle = placeholders.pdpSizeGuideLabel || 'Size Guide';
  await createModalFromContent(SIZE_GUIDE_DIALOG_ID, sizeGuideTitle, sizeGuideModal, ['size-guide-modal', 'pdp-modal'], null, true);
  await import('../../../templates/tabbed-size-guide/tabbed-size-guide.js');
  const categoryItems = ctx.data?.gtmAttributes?.category.split('/');
  const sizeGuideOptions = {
    primaryCategory: categoryItems[0]?.toLowerCase(),
    secondaryCategory: categoryItems[1]?.toLowerCase(),
  };

  // Set default size guide filters using the sizeGuideOptions object
  setDefaultSizeGuideFilters(sizeGuideOptions);

  sizeGuideBlock.onclick = () => {
    openModal(SIZE_GUIDE_DIALOG_ID);
  };
}

const variantsQuery = `
  query getProductSearchDetails(
    $filter: [SearchClauseInput!]
    $phrase: String!
    $sort: [ProductSearchSortInput!]
    $pageSize: Int!
  ) {
    productSearch(
      phrase: $phrase
      filter: $filter
      sort: $sort
      page_size: $pageSize
    ) {
      total_count
      page_info {
        current_page
        page_size
        total_pages
      }
      items {
        productView {
          sku
          id
          name
          description
          urlKey
          inStock
          metaTitle
          metaDescription
          metaKeyword
          attributes {
            name
            label
            roles
            value
          }
          ... on SimpleProductView {
            price {
              final {
                amount {
                  value
                  currency
                }
              }
              regular {
                amount {
                  value
                  currency
                }
              }
              roles
            }
          }
          ... on ComplexProductView {
            variants {
              variants {
                selections
                product {
                  id
                  name
                  sku
                  ... on SimpleProductView {
                    price {
                      final {
                        amount {
                          currency
                          value
                        }
                      }
                      regular {
                        amount {
                          currency
                          value
                        }
                      }
                    }
                  }
                  attributes {
                    name
                    label
                    roles
                    value
                  }
                }
              }
            }
            options {
              id
              title
              required
              multi
              values {
                id
                title
                ... on ProductViewOptionValueProduct {
                  title
                  quantity
                  isDefault
                }
                ... on ProductViewOptionValueSwatch {
                  id
                  title
                  type
                  value
                }
              }
            }
            priceRange {
              maximum {
                final {
                  amount {
                    value
                    currency
                  }
                }
                regular {
                  amount {
                    value
                    currency
                  }
                }
                roles
              }
              minimum {
                final {
                  amount {
                    value
                    currency
                  }
                }
                regular {
                  amount {
                    value
                    currency
                  }
                }
                roles
              }
            }
          }
        }
      }
    }
  }
`;

function formatSwatchUrl(url, placeholders) {
  const productSwatchThumbnail = placeholders.productSwatchThumbnail || 80;
  let outputUrl = url.replace(/width=\d+&?/g, '').replace(/height=\d+&?/g, '').replace('/original/', '/');
  outputUrl = outputUrl.includes('?') ? `${outputUrl}&` : `${outputUrl}?`;
  outputUrl = `${outputUrl}height=${productSwatchThumbnail}`;
  return outputUrl;
}

export async function decorateMemberPrice(ctx, memberPrice, placeholders, auraCustomerData = null) {
  if (memberPrice) {
    const isAuraEnabled = await getConfigValue('aura-price-enabled');
    if (isAuraEnabled && isAuraEnabled === 'true') {
      const priceDiv = document.querySelector('.pdp-product__prices');
      const auraPriceContainer = document.createElement('div');
      auraPriceContainer.classList.add('pdp-aura-price');
      priceDiv.classList.add('aura-price');

      const auraIcon = document.createElement('span');
      auraIcon.classList.add('icon', 'icon-aura-icon');

      const auraPriceElement = document.createElement('div');
      auraPriceElement.classList.add('pdp-aura-price-container');

      const auraPriceText = document.createElement('span');
      auraPriceText.classList.add('pdp-aura-price--text');
      const currency = ctx.data.prices?.final?.currency || 'AED';
      auraPriceText.textContent = await formatPrice(currency, memberPrice);

      const auraPriceLabel = document.createElement('span');
      auraPriceLabel.classList.add('pdp-aura-price--label');
      auraPriceLabel.textContent = placeholders.auraPrice || 'Aura Price';

      auraPriceContainer.appendChild(auraIcon);
      auraPriceElement.appendChild(auraPriceText);
      auraPriceContainer.appendChild(auraPriceElement);
      auraPriceElement.appendChild(auraPriceLabel);

      if (auraCustomerData?.apc_link === 2 || auraCustomerData?.apc_link === 3) {
        auraPriceContainer.classList.add('logged-in');
        priceDiv.classList.add('aura-price-logged-in');
      }
      decorateIcons(auraPriceContainer);
      priceDiv.appendChild(auraPriceContainer);
    } else {
      const priceDiv = document.querySelector('.pdp-product__prices');
      const memberPriceContainer = document.createElement('div');
      memberPriceContainer.classList.add('pdp-member-price');
      priceDiv.classList.add('member-price');

      if (isLoggedInUser()) {
        memberPriceContainer.classList.add('logged-in');
        priceDiv.classList.add('member-price-logged-in');
      }

      const memberPriceElement = document.createElement('div');
      memberPriceElement.classList.add('pdp-member-price-container');

      const memberPriceText = document.createElement('span');
      memberPriceText.classList.add('pdp-member-price--text');
      const currency = ctx.data.prices?.final?.currency || 'AED';
      memberPriceText.textContent = await formatPrice(currency, memberPrice);

      const memberPriceLabel = document.createElement('span');
      memberPriceLabel.classList.add('pdp-member-price--label');
      memberPriceLabel.textContent = placeholders.memberPriceLabel || 'Member Price';

      if (lang === 'ar') {
        memberPriceElement.appendChild(memberPriceLabel);
        memberPriceElement.appendChild(memberPriceText);
      } else {
        memberPriceElement.appendChild(memberPriceText);
        memberPriceElement.appendChild(memberPriceLabel);
      }

      memberPriceContainer.appendChild(memberPriceElement);
      priceDiv.insertAdjacentElement('afterend', memberPriceContainer);
    }
  }
}

function getSkuAndOptionId(productView) {
  const optionIds = new Set();

  // Extract IDs from options for size option
  productView.options.forEach((option) => {
    if (option.id === 'size') {
      option.values.forEach((value) => {
        optionIds.add(value.id);
      });
    }
  });

  const matchingSkus = {};

  // Iterate through variants and check if their selections match option IDs
  productView.variants.variants.forEach((variant) => {
    const matchedSelections = variant.selections.filter(
      (selection) => optionIds.has(selection),
    )?.[0];
    if (matchedSelections) {
      matchingSkus[variant.product.sku] = matchedSelections;
    }
  });

  return matchingSkus;
}

async function createPdpShoeAi(item, productSku) {
  if (productSku !== item.productView.sku) { return; }
  const allVariantsData = item?.productView?.variants?.variants;
  const pdpSwatchesOptionWrapper = document.querySelector('#swatch-item-size_shoe_eu .pdp-swatches__options');
  if (!allVariantsData || !pdpSwatchesOptionWrapper) return;
  // Extract size_shoe_eu values from attributes.
  const sizeEUArr = allVariantsData
    .map((product) => product?.product?.attributes?.find((attr) => attr.name === 'size_shoe_eu')?.value)
    .filter(hasValue);
  const shoeAiDiv = createElement('div', ['ShoeSizeMe', 'ssm_pdp'], { 'data-shoeid': item.productView.sku, 'data-availability': sizeEUArr, 'data-sizerun': sizeEUArr });
  pdpSwatchesOptionWrapper.prepend(shoeAiDiv);
  createShoeAi();
}

/**
 * Dynamically creates a size group UI for product variants.
 * @param {Object} item - The product data object containing variant info.
 * @param {Object} placeholders - Placeholder texts for labels.
 */
async function createSizeGroup(item, placeholders, productSku) {
  if (productSku !== item.productView.sku) { return; }
  const allVariantsData = item?.productView?.variants?.variants;
  const pdpSwatchesOptionWrapper = document.querySelector('#swatch-item-size_shoe_eu .pdp-swatches__options');
  if (!allVariantsData || !pdpSwatchesOptionWrapper) return;

  loadCSS(`/blocks/product-details/${getBrandPath()}size_grouping.css`);
  // Create a new wrapper element.
  const newDiv = createElement('div', ['size-eu', 'groupSize'], { style: 'display: none;' });
  while (pdpSwatchesOptionWrapper.firstChild) {
    newDiv.appendChild(pdpSwatchesOptionWrapper.firstChild);
  }
  pdpSwatchesOptionWrapper.appendChild(newDiv);

  // Create main size group wrapper and label.
  const sizeGroupMarkup = createElement('div', ['group-wrapper']);
  const sizeLabel = createElement('label', ['selected-label']);
  const filterTitle = placeholders.groupSizeFilterTitle || 'Sizes';
  sizeLabel.append(
    createElement('span', ['selected-title'], {}, filterTitle),
    createElement('span', ['selected-text']),
  );
  sizeGroupMarkup.append(sizeLabel);
  pdpSwatchesOptionWrapper.appendChild(sizeGroupMarkup);

  // Create filter toggles for size groups.
  const divContainer = createElement('div', ['group-anchor-wrapper']);
  groupConfig.sizeGroups.forEach(({ attributes, defaultOpen }) => {
    if (Object.keys(attributes).some((key) => ['EU', 'UK', 'US'].includes(key))) {
      Object.entries(attributes).forEach(([key, attributeName]) => {
        const attrNameNoLng = attributeName.replace(/^attr_/, '');
        const groupSpan = createElement(
          'span',
          ['group-filter-title-span', 'size-toggle'],
          { 'data-attribute': attrNameNoLng },
          key,
        );
        divContainer.append(groupSpan);
        // Mark the default open group as active.
        if (`${attributeName}` === defaultOpen) {
          groupSpan.classList.add('active');
        }

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
          document.querySelectorAll('div.sizes-list').forEach((ul) => {
            ul.classList.toggle('hide', !ul.classList.contains(selectedSize));
          });
        };
        groupSpan.addEventListener('click', handleGroupToggle);
      });
    }
  });
  pdpSwatchesOptionWrapper.append(divContainer);

  // Helper function to create a size wrapper and append size options.
  const createSizeWrapper = (sizeKey, classHide = '') => {
    // Create a wrapper for the size.
    const sizeWrapper = createElement('div', [`size-${sizeKey}`, `size_shoe_${sizeKey}`, 'sizes-list']);
    if (classHide) sizeWrapper.classList.add(classHide);

    allVariantsData.forEach((product) => {
      const attributes = product?.product?.attributes;
      const size = attributes.find((attr) => attr.name === `size_shoe_${sizeKey}`)?.value;
      const sizeEU = attributes.find((attr) => attr.name === 'size_shoe_eu')?.value;
      if (size) {
        const sizeElement = createElement('div', ['dropin-text-swatch__container']);
        const sizeTitle = createElement('label', ['dropin-text-swatch__label'], { value: sizeEU }, size);
        sizeElement.appendChild(sizeTitle);
        sizeWrapper.appendChild(sizeElement);
      }
    });
    return sizeWrapper;
  };

  const sizeOptions = ['eu', 'uk', 'us'];
  const wrapperClasses = ['', 'hide', 'hide'];
  pdpSwatchesOptionWrapper.append(
    ...sizeOptions.map((size, index) => createSizeWrapper(size, wrapperClasses[index])),
  );
  // Highlight the selected size and update the UI accordingly.
  const selectedRadio = document.querySelector('.dropin-text-swatch.dropin-text-swatch--selected');
  if (selectedRadio) {
    const selectedValue = selectedRadio.value;
    document.querySelectorAll(`label[value="${selectedValue}"]`).forEach((label) => label.classList.add('selected'));
    const selectedTextElement = document.querySelector('.selected-text');
    if (selectedTextElement) {
      selectedTextElement.textContent = selectedValue;
    }
  }
  // Add click event listener to handle size selection and UI updates.
  pdpSwatchesOptionWrapper.addEventListener('click', (event) => {
    if (event.target && event.target.matches('label.dropin-text-swatch__label')) {
      document.querySelectorAll('.dropin-text-swatch__label.selected').forEach((element) => {
        element.classList.remove('selected');
      });

      event.target.classList.add('selected');
      const valueField = event.target.getAttribute('value');
      const matchingLabels = document.querySelectorAll(`label[value="${valueField}"]`);
      // Add the selected class to the matching labels.
      matchingLabels.forEach((label) => {
        label.classList.add('selected');
      });

      const euSizeValue = event.target.getAttribute('value');
      const selectedTextElement = document.querySelector('.selected-text');
      if (selectedTextElement) {
        selectedTextElement.textContent = event.target.textContent;
      }
      const inputElement = pdpSwatchesOptionWrapper.querySelector(`input[value="${euSizeValue}"]`);
      if (inputElement) {
        inputElement.checked = true;
        const changeEvent = new Event('change', { bubbles: true });
        inputElement.dispatchEvent(changeEvent);
      }
    }
  });
}

let defaultSelectedValue = null; // the value of the default option
async function renderVariantSwatches(ctx, block, placeholders, isWishlist = false) {
  defaultSelectedValue = false;
  const swatchesList = document.createElement('div');
  swatchesList.classList.add('pdp-swatches-list-container');
  const swatchesContainer = document.createElement('div');
  swatchesContainer.classList.add('pdp-swatches-refs');
  const swatchesTitle = document.createElement('p');
  swatchesTitle.classList.add('pdp-swatches__title');

  const styleCode = ctx.data.attributes.find((attr) => attr.id === 'style_code')?.value;
  const productSku = ctx.data.sku;
  const variables = {
    phrase: '',
    filter: [
      { attribute: 'style_code', eq: styleCode },
    ],
    sort: [
      { attribute: 'price', direction: 'DESC' },
    ],
    pageSize: 100,
  };

  let memberPrice = null;
  let skuAndOptionId = {};
  await performCatalogServiceQuery(variantsQuery, variables).then((allVariants) => {
    allVariants?.productSearch?.items?.forEach((item) => {
      if (isWishlist) {
        skuAndOptionId = {
          ...skuAndOptionId,
          ...getSkuAndOptionId(item.productView),
        };
      }
      if (groupConfig.displaySizeGrouping === true) {
        createSizeGroup(item, placeholders, productSku);
      }
      if (enableShoeai) {
        createPdpShoeAi(item, productSku);
      }

      const itemSku = item.productView.sku;
      cacheProductData(item.productView);
      const colorLabel = item.productView.variants.variants[0]?.product?.attributes.find((attr) => attr.name === 'color_label')?.value;
      const swatchImageJSON = item?.productView?.variants?.variants[0]?.product?.attributes.find((attr) => attr.name === 'assets_swatch')?.value;
      const memberPriceValue = item?.productView?.variants?.variants[0]?.product?.attributes.find((attr) => attr.name === 'member_price')?.value;
      if (memberPriceValue && itemSku === productSku) {
        memberPrice = memberPriceValue;
      }

      let swatchImage = item?.productView?.variants?.variants[0]?.product?.attributes.find(
        (attr) => attr.name === 'swatch_image_url',
      )?.value;
      if (!hasValue(swatchImage) && hasValue(swatchImageJSON)) {
        try {
          const swatchImageArray = JSON.parse(swatchImageJSON.replaceAll('\\', ''));
          swatchImage = formatSwatchUrl(swatchImageArray[0].styles.product_listing, placeholders);
        } catch (e) {
          console.warn(`Swatch image not found for ${item.productView.name}`);
        }
      }
      const link = document.createElement('a');
      if (isWishlist) {
        link.addEventListener('click', (e) => {
          if (!e?.currentTarget?.classList?.contains('main-asset')) {
            const customEvent = new CustomEvent('updateProductPopup', {
              detail: {
                sku: itemSku,
              },
            });
            document.dispatchEvent(customEvent);
          }
          e.preventDefault();
          return false;
        });
      } else {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.replace(`/${document.documentElement.lang || 'en'}/${item.productView.urlKey}`);
        });
      }

      link.setAttribute('data-swatch-title', colorLabel);
      const outOfStockHTML = `<div class="overlay-out-of-stock-container">
      <div class="overlay-out-of-stock-background"></div>
    </div>`;
      link.innerHTML = `<img src="${swatchImage}" alt="${item.productView.name}" class="${!item.productView.inStock ? 'out-of-stock-swatch-image' : ''}" /> ${!item.productView.inStock ? outOfStockHTML : ''}`;
      link.querySelector('img').addEventListener('mouseover', (e) => {
        const title = e.target.parentElement.getAttribute('data-swatch-title');
        document.querySelector('.pdp-swatches__title').textContent = title;
      });
      link.querySelector('img').addEventListener('mouseout', () => {
        const title = document.querySelector('.pdp-swatches-refs .main-asset').getAttribute('data-swatch-title');
        document.querySelector('.pdp-swatches__title').textContent = title;
      });
      swatchesContainer.append(link);
      if (itemSku === productSku) {
        swatchesTitle.textContent = colorLabel;
        link.classList.add('main-asset');
      }
    });
  });

  decorateMemberPrice(ctx, memberPrice, placeholders);

  swatchesList.appendChild(swatchesTitle);
  swatchesList.appendChild(swatchesContainer);
  if (window.matchMedia('(min-width: 768px)').matches) {
    // append swatches to the block for desktop view
    block.querySelector('.pdp-swatches').prepend(swatchesList);
  } else {
    // appending swatches for mobile view
    const actionsElement = block.querySelector('.pdp-product__content-column');
    if (document.querySelector('#product-overview-popup') && actionsElement) {
      actionsElement.appendChild(swatchesList, actionsElement);
    } else if (appendSwatchToHeader === 'false') {
      const priceBlock = block.querySelector('.pdp-product__prices');
      priceBlock.parentNode.insertBefore(swatchesList, priceBlock);
    } else {
      block.querySelector('.pdp-product__content-column .pdp-product__header').prepend(swatchesList);
    }
  }

  const colourSwatches = block.querySelectorAll('.pdp-swatches-refs a');
  colourSwatches.forEach((colour) => {
    colour.addEventListener('click', () => {
      const colorName = colour.getAttribute('data-swatch-title');
      datalayerColorSwatchEvent('pdp', colorName);
    });
  });

  if (isWishlist) {
    const customEvent = new CustomEvent('renderVariantSwatchesFinished', {
      detail: { skuAndOptionId },
    });
    document.dispatchEvent(customEvent);
  }
}

export default function slot(
  ctx,
  $block,
  placeholders,
  isWishlist = false,
  variantSku = null,
  options = null,
) {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const sizeLabelText = placeholders.pdpSizeLabel || 'Size';
  const sizeGuideText = placeholders.pdpSizeGuideLabel || 'Size Guide';

  const size = ctx.getSlotElement('product-swatch--size');

  if (size) {
    // check if only NO SIZE option is available
    const noSizeOption = ctx.data.options.find((option) => option.id === 'size' && option.items.length === 1
      && (option.items[0].value === 'NO SIZE' || option.items[0].value === 'NOSIZE'));

    if (noSizeOption) {
      const emptySize = document.createElement('div');
      emptySize.classList.add('pdp-swatches__field--empty', 'pdp-swatches__field--disabled');
      size.prependChild(emptySize);
    }

    // add size label
    const sizeLabel = document.createElement('div');
    sizeLabel.classList.add('pdp-swatches__field__label');

    const sizeLabelSpan = document.createElement('span');
    sizeLabelSpan.classList.add('pdp-swatches__field__label--text');
    sizeLabelSpan.textContent = `${sizeLabelText}:`;

    const sizeLabelSelection = document.createElement('span');
    sizeLabelSelection.classList.add('pdp-swatches__field__label--selection');

    sizeLabel.appendChild(sizeLabelSpan);
    sizeLabel.appendChild(sizeLabelSelection);

    size.prependChild(sizeLabel);

    // Size selector datalayer event
    const sizeList = document
      .querySelector('.pdp-swatches__field#swatch-item-size')
      ?.querySelectorAll('.pdp-swatches__options .dropin-text-swatch__label:not([class$="out-of-stock"]');
    if (sizeList.length > 0) {
      const wishlistModal = document.querySelector('dialog.wishlist-product-overview');
      if (wishlistModal && wishlistModal.open) {
        const observer = new MutationObserver((mutationsList, obs) => {
          if (mutationsList[0]?.type === 'childList') {
            const eventListenerHandler = (event) => {
              const optionId = event.detail.skuAndOptionId[variantSku];
              const index = Array.from(sizeList)
                .findIndex((node) => node.htmlFor === optionId || node.htmlFor === options?.size);
              if (index !== -1) {
                sizeList?.[index]?.click();
              } else {
                sizeList?.[0]?.click();
              }
            };
            document.removeEventListener('renderVariantSwatchesFinished', eventListenerHandler);
            document.addEventListener('renderVariantSwatchesFinished', eventListenerHandler);
            obs.disconnect();
          }
        });
        const config = {
          childList: true,
          attributes: true,
          subtree: true,
        };
        observer.observe(wishlistModal, config);
      }
    }
    sizeList.forEach((sizeBox) => {
      sizeBox.addEventListener('click', () => {
        if (defaultSelectedValue) {
          defaultSelectedValue = false;
          datalayerSizeSelectorEvent(sizeBox.textContent);
        }
      });
    });

    ctx.onChange((next) => {
      const sizeOption = next.data.options.find((option) => option.id === 'size');
      const currentSelection = document.querySelector('.pdp-swatches__options .dropin-text-swatch__container input.dropin-text-swatch--selected')?.getAttribute('value');
      if (!currentSelection) {
        document.querySelector('.pdp-product__actions .pdp-product__buttons .dropin-button--primary')?.removeAttribute('disabled');
        return;
      }
      if (sizeOption) {
        const selectedSize = sizeOption.items.find((item) => item.selected);
        if (selectedSize && selectedSize.label === currentSelection) {
          defaultSelectedValue = true;
          document.querySelector('.pdp-product__actions .pdp-product__buttons .dropin-button--primary')?.removeAttribute('disabled');
        } else {
          document.querySelector('.pdp-product__actions .pdp-product__buttons .dropin-button--primary')?.setAttribute('disabled', '');
        }
      }
    });

    document.querySelectorAll('.pdp-swatches__options').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        // To make size unsticky on selecting & enabling scroll
        document.body.classList.remove('no-scroll');
        document.querySelector('.pdp-product__actions').classList.remove('sizeFixed');
        const sizeChangeEvent = new CustomEvent('WISHLIST_PRODUCT_SIZE_CHANGE', { detail: event.target.id, bubbles: true });
        event.target.dispatchEvent(sizeChangeEvent);
      });
    });

    // add error message
    const errorDiv = document.createElement('div');
    errorDiv.classList.add('error-message-container', 'pdp-product__options-size__error', 'hidden', 'error-pdp');

    const errorField = document.createElement('span');
    errorField.textContent = placeholders?.selectSize || 'Please select a size';
    errorField.className = 'error-message';

    const icon = document.createElement('span');
    icon.classList.add('icon', 'icon-info-small-error');
    errorDiv.appendChild(icon);
    errorDiv.appendChild(errorField);

    decorateIcons(errorDiv);

    const actionContainer = document.querySelector('.pdp-product__actions');
    actionContainer.prepend(errorDiv);

    const sizeLinkWrapper = document.createElement('div');
    sizeLinkWrapper.classList.add('pdp-swatches-size__link--wrapper');

    const sizeLink = document.createElement('div');
    sizeLink.classList.add('pdp-swatches-size__link--container');

    const sizeIcon = document.createElement('span');
    sizeIcon.classList.add('icon', 'icon-size');
    sizeLink.appendChild(sizeIcon);

    const sizeAnchor = document.createElement('a');
    sizeAnchor.href = '#';
    sizeAnchor.innerText = sizeGuideText;
    sizeAnchor.classList.add('pdp-swatches-size__link--anchor');
    sizeAnchor.onclick = (event) => { event.preventDefault(); };

    sizeLink.appendChild(sizeAnchor);
    window.addEventListener('delayed-loaded', async () => {
      // This is the code that will be auto apply filter based on target PDP
      sizeAnchor.addEventListener('click', () => {
        initSizeGuideDefaults();
        datalayerSizeGuide();
      });
      decorateSizeGuide(sizeLink, ctx, placeholders);
    });

    const sizeClose = document.createElement('div');
    sizeClose.classList.add('pdp-product__options-size__close');
    const sizeCloseIcon = document.createElement('span');
    sizeCloseIcon.classList.add('icon', 'icon-close');
    sizeClose.appendChild(sizeCloseIcon);

    sizeClose.addEventListener('click', (event) => {
      event.preventDefault();
      // To make size unsticky on close & enabling scroll
      document.body.classList.remove('no-scroll');
      document.querySelector('.pdp-product__actions').classList.remove('sizeFixed');
      $block.querySelector('.pdp-swatches__field#swatch-item-size').classList.remove('pdp-product__options-size--open');
      document.querySelector('.generic-overlay-background').classList.remove('show');
    });

    sizeLinkWrapper.appendChild(sizeLink);
    sizeLinkWrapper.appendChild(sizeClose);

    decorateIcons(sizeLinkWrapper);
    size.appendChild(sizeLinkWrapper);

    sizeLabel.addEventListener('click', (event) => {
      event.preventDefault();
      if (!isMobile) return;
      // to make size sticky at bottom & disable scroll
      document.body.classList.add('no-scroll');
      document.querySelector('.pdp-product__actions').classList.add('sizeFixed');
      $block.querySelector('.pdp-swatches__field#swatch-item-size').classList.add('pdp-product__options-size--open');
      document.querySelector('.generic-overlay-background').classList.add('show');
    });

    if (isMobile) {
      const carousel = $block.querySelector('.pdp-carousel');
      const pdpProductButtons = $block.querySelector('.pdp-product__buttons');
      const swatchItemSizeMobile = $block.querySelector('.pdp-swatches__field#swatch-item-size');

      const sizeSelectInMobile = (sizelabel) => {
        const overlayBg = document.querySelector('.generic-overlay-background');
        swatchItemSizeMobile.classList.remove('pdp-product__options-size--open');
        if (overlayBg && overlayBg.classList.contains('show')) {
          overlayBg.classList.remove('show');
        }
        sizeLabelSelection.textContent = sizelabel.textContent;
      };
      const actionsElement = document.querySelector('.pdp-product__actions');
      const observer = new MutationObserver((mutationsList) => {
        const buttonBar = document.querySelector('.dropin-button-bar');
        mutationsList.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('dropin-button-bar')) {
              if (isPDP()) {
                carousel.appendChild(node.parentElement);
              } else {
                actionsElement.appendChild(buttonBar);
                actionsElement.classList.add('button-bar-wishlist');
              }
            }
          });
        });
      });
      observer.observe(pdpProductButtons, { childList: true, subtree: true });

      const allSelectableSizes = document.querySelectorAll('label.dropin-text-swatch__label');
      allSelectableSizes.forEach((selectableSize) => {
        selectableSize.addEventListener('click', () => {
          sizeSelectInMobile(selectableSize);
        });
      });
    }

    ctx.onChange((next) => {
      let hasSize = false;
      next.data.options.forEach((option) => {
        if (option.id === 'size') {
          const sizeOption = option.items.find((item) => item.selected);
          if (sizeOption) {
            sizeLabelSelection.textContent = sizeOption.label;
            hasSize = true;
          }
        }
      });

      if (hasSize) {
        $block.querySelector('.error-message-container').classList.add('hidden');
      }
    });
  }

  renderVariantSwatches(ctx, $block, placeholders, isWishlist);
}
