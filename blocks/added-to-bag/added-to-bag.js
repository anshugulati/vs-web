import { loadCSS } from '../../scripts/aem.js';
import {
  fetchPlaceholdersForLocale,
  createModalFromContent,
  openModal,
  getLanguageAttr,
  getCurrencyFormatter,
  loadFragment,
  fireTargetCall,
  getBrandPath,
  hasValue,
  isLoggedInUser,
} from '../../scripts/scripts.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getCachedProductData, getSignInToken } from '../../scripts/commerce.js';
import { pdpLoadData } from '../../scripts/target/target-events.js';

export async function isVatIncludedDisplayed() {
  return getConfigValue('commerce-show-vat-included').then((value) => value?.toLocaleLowerCase() === 'true');
}

/**
 * @param {Object} products The details of the products in the cart
 */
const getProductImage = (product) => {
  let assetsCart = product?.attributes?.find((attr) => attr.name === 'assets_cart')?.value;
  if (!hasValue(assetsCart) && hasValue(product?.variants?.variants)) {
    assetsCart = product?.variants?.variants[0]?.product?.attributes.find(
      (attr) => attr.name === 'assets_cart',
    )?.value;
  }
  let imageUrl = null;
  if (product.iseGift && product.eGiftImage) {
    imageUrl = product.eGiftImage;
  } else if (assetsCart && assetsCart !== '[]') {
    const assets = JSON.parse(assetsCart);
    if (assets.length > 0) {
      const { styles: { cart_thumbnail: cartThumbnail } } = assets[0];
      imageUrl = cartThumbnail;
    }
  } else if (!assetsCart || assetsCart === '[]') {
    assetsCart = product?.attributes?.find((attr) => attr.name === 'swatch_image_url' || attr.id === 'swatch_image')?.value;
    if (assetsCart) {
      imageUrl = assetsCart;
    }
  }
  if (imageUrl) {
    const productSwatchImg = document.createElement('div');
    productSwatchImg.classList.add('swatch-img');
    const img = document.createElement('img');
    img.setAttribute('src', imageUrl);
    productSwatchImg.appendChild(img);
    return productSwatchImg;
  }
  return document.createDocumentFragment();
};
/**
 * @param {Object} productOptions Contains the configurable options of cart item
 * @param {Object} product The details of the product in the cart
 * @returns the list of configurable attributes of the cart item, like size, color etc...
 */
const getProductConfigs = (updatedCart, product, placeholders) => {
  const { product_option: productOptions, qty } = updatedCart;

  const validOptions = [{
    label: `${placeholders.qty || 'Qty'}: `,
    value: qty,
  }];
  if (productOptions?.extension_attributes?.configurable_item_options?.length > 0) {
    const { extension_attributes: { configurable_item_options: options } } = productOptions;

    // Filter the valid configurable options of the cart items
    // excluding the season_code.
    options.forEach(({ option_id: optionId, option_value: optionValue }) => {
      if (product?.options?.length > 0) {
        const { options: configurableOptions } = product;

        configurableOptions.filter((option) => option.id !== 'season_code')
          .forEach((option) => {
            const baseEncodedOptionValue = btoa(`configurable/${optionId}/${optionValue}`);
            const configValueObj = option.values || option.items
              .find((value) => value.id === baseEncodedOptionValue);
            if (configValueObj) {
              if (option.id === 'size' && (configValueObj.title === 'NO SIZE' || configValueObj.title === 'NOSIZE ')) {
                return;
              }
              validOptions.push({
                label: option.title ? `${option.title}: ` : `${option.label}: `,
                value: configValueObj.title || configValueObj.label,
              });
            }
          });
      }
    });
  }

  // check for variants
  if (product?.variants?.variants?.length > 0) {
    const color = product?.variants?.variants[0].product?.attributes.find((attr) => attr.name === 'color_label');

    if (color) {
      validOptions.push({
        label: `${placeholders.productColor || 'Color:'} `,
        value: color.value,
      });
    }
  }

  // Creates and returns the HTML element for rendering.
  if (validOptions.length > 0) {
    const productConfigs = document.createElement('ul');
    productConfigs.classList.add('product-configs');
    validOptions.forEach((o) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.innerText = o.label;
      const value = document.createElement('span');
      value.innerText = o.value;
      li.appendChild(label);
      li.appendChild(value);
      productConfigs.appendChild(li);
    });

    return productConfigs;
  }

  return document.createDocumentFragment();
};

const getProductPrices = (product, variantSku) => {
  const productSku = getCachedProductData(variantSku);
  if (productSku?.prices) {
    const {
      final: finalPrice,
      regular: regularPrice,
    } = productSku.prices;

    return {
      finalPrice: { amount: { value: finalPrice.amount } },
      regularPrice: { amount: { value: regularPrice.amount } },
    };
  }

  if (product.priceRange) {
    const {
      maximum: {
        final: finalPrice,
        regular: regularPrice,
      },
    } = product.priceRange;

    return { finalPrice, regularPrice };
  }

  if (product.prices) {
    const { final: finalPrice, regular: regularPrice } = product.prices;
    return { finalPrice, regularPrice };
  }

  return { finalPrice: { amount: { value: 0 } }, regularPrice: { amount: { value: 0 } } };
};

/**
 * @param {Object} products The details of the products in the cart
 * @returns the list of configurable attributes of the cart item, like size, color etc...
 * @param {Object} cartData details of current cart item
 * @returns HTMLElement the HTML for the price block
 */
const getProductPrice = async (product, cartData, updatedCart, placeholders) => {
  const productItemID = updatedCart.item_id;
  const actualPrice = cartData?.totals?.items
    ?.find((currentItem) => currentItem.item_id === productItemID)?.price_incl_tax;
  const memberPriceValue = product?.variants?.variants[0]?.product?.attributes.find((attr) => attr.name === 'member_price')?.value;
  const isLoggedIn = isLoggedInUser();

  if (product?.priceRange?.maximum || product?.prices || product?.price) {
    const variantSku = updatedCart?.sku;
    const { finalPrice, regularPrice } = getProductPrices(product, variantSku);
    let discount = 0;
    const currencyFormat = await getCurrencyFormatter(cartData?.currency?.base_currency_code);

    const productPrice = document.createElement('div');
    productPrice.classList.add('product-price');
    const priceLabels = document.createElement('div');
    priceLabels.classList.add('price-labels');

    const productFinalPrice = document.createElement('h4');

    if (actualPrice > 0 && actualPrice !== finalPrice?.amount?.value) {
      productFinalPrice.innerText = currencyFormat.format(actualPrice);
      priceLabels.appendChild(productFinalPrice);
    } else {
      productFinalPrice.innerText = currencyFormat.format(finalPrice?.amount?.value);
      priceLabels.appendChild(productFinalPrice);
    }

    if (regularPrice?.amount?.value !== finalPrice?.amount?.value
      || regularPrice?.amount?.value !== actualPrice
      || regularPrice?.amount !== actualPrice) {
      // Regular price of the item
      const productRegularPrice = document.createElement(memberPriceValue && isLoggedIn ? 'h4' : 'h5');
      productRegularPrice.innerText = currencyFormat.format(regularPrice?.amount?.value
        || regularPrice?.amount);
      priceLabels.appendChild(productRegularPrice);
      productFinalPrice.classList.add('price-final');

      // Discount %
      if ((regularPrice?.amount?.value > 0 && finalPrice?.amount?.value > 0)
      || (regularPrice?.amount > 0 && finalPrice?.amount > 0)) {
        const regularPriceValue = regularPrice.amount.value || regularPrice.amount;
        const finalPriceValue = finalPrice.amount.value || finalPrice.amount;
        discount = regularPriceValue - finalPriceValue;
        discount /= regularPriceValue;
        discount *= 100;
      }
    }

    productPrice.appendChild(priceLabels);

    const promoContainer = document.createElement('div');
    promoContainer.classList.add('promotions');
    // handle display in case of member price
    if (memberPriceValue) {
      priceLabels.classList.add('member-price');
      const memberPrice = parseFloat(memberPriceValue);
      const memberPriceWrapper = document.createElement('div');
      memberPriceWrapper.classList.add('member-price-wrapper');
      const productMemberPrice = document.createElement('h4');
      productMemberPrice.classList.add('price-member');

      if (isLoggedIn) {
        priceLabels.classList.add('logged-in');
        productMemberPrice.innerText = `${currencyFormat.format(memberPrice)} ${placeholders.memberPriceLabel || 'Member Price'}`;
        productMemberPrice.classList.add('member-price');
        memberPriceWrapper.appendChild(productMemberPrice);
        productPrice.append(memberPriceWrapper);
      } else {
        productMemberPrice.innerText = `${currencyFormat.format(memberPrice)} ${placeholders.memberPriceLabel || 'Member Price'}`;
        productMemberPrice.classList.add('member-price');
        memberPriceWrapper.appendChild(productMemberPrice);
        productPrice.append(memberPriceWrapper);
      }
    }
    const isVatIncluded = await isVatIncludedDisplayed();
    const includingVat = document.createElement('div');
    if (isVatIncluded) {
      includingVat.classList.add('pdp-product__price--including-vat');
      includingVat.textContent = placeholders.priceIncludingVat || 'Inc. VAT';
      productPrice.appendChild(includingVat);
    }

    // Check promo config is enabled to display the promotions.
    if (await getConfigValue('promo') === 'true') {
      // Fetching all the available Promotions.
      const allPromos = product.promotions || [];

      allPromos.forEach((promo) => {
        const promoLabel = document.createElement('span');
        // Based on Promotion type adding the class to div element to provide specific styling.
        if (promo.type === 'discount') {
          promoLabel.classList.add('discount-label');
        } else if (promo.type === 'cart_rule') {
          promoLabel.classList.add('promo-label');
        }
        promoLabel.innerText = promo.label;
        promoContainer.appendChild(promoLabel);
      });
    } else if (discount > 0) {
      const productDiscountPrice = document.createElement('div');
      productDiscountPrice.classList.add('discount-price');
      productDiscountPrice.innerHTML = `<span>(${placeholders.plpSave} ${Math.floor(discount)}%)</span>`;
      productPrice.appendChild(productDiscountPrice);
    }

    if (promoContainer.children.length > 0) {
      productPrice.appendChild(promoContainer);
    }

    return productPrice;
  }
  return document.createDocumentFragment();
};
/**
 * @param {CustomEvent} event
 * The main rendering of the add to bag block
 */
export default async function renderAddToBagDialog(event) {
  const cartModalButtonsV2 = await getConfigValue('pdp-cart-modal-buttons') === 'true';
  const ADDED_TO_BAG_DIALOG_ID = 'added-to-bag-dialog';
  const placeholders = await fetchPlaceholdersForLocale();
  const lang = getLanguageAttr();
  const token = getSignInToken();
  const { detail: { product, cart, updatedCart } } = event;

  const addedToBagModalTitle = placeholders.addedToBag || 'Added to Bag';
  const addedToBagModalOverlay = document.createElement('div');

  const modalProducts = document.createElement('div');
  modalProducts.classList.add('modal-products');

  const modalProduct = document.createElement('div');
  modalProduct.classList.add('modal-product');
  const productSwatchImg = await getProductImage(product);

  const productContent = document.createElement('div');
  productContent.classList.add('product-content');
  const productTitle = document.createElement('h4');
  productTitle.classList.add('product-title');
  productTitle.innerText = updatedCart?.name || '';

  const productBrand = document.createElement('p');
  productBrand.classList.add('product-brand');
  productBrand.innerText = product.attributes.find(
    (el) => el.id === 'brand_full_name' || el.id === 'brand',
  )?.value || '';
  productContent.prepend(productBrand);

  const productCollectionname = document.createElement('p');
  productCollectionname.classList.add('product-collection-name');
  productCollectionname.innerText = product?.attributes.find((el) => el.id === 'collection_1' || el.name === 'collection_1')?.value;

  const productPrice = await getProductPrice(product, cart, updatedCart, placeholders);

  productContent.appendChild(productTitle);
  if (await getConfigValue('pdp-collection-enable') === 'true') {
    productContent.appendChild(productCollectionname);
  }
  productContent.appendChild(productPrice);
  const productConfigs = getProductConfigs(updatedCart, product, placeholders);
  productContent.appendChild(productConfigs);

  modalProduct.appendChild(productSwatchImg);
  modalProduct.appendChild(productContent);
  modalProducts.appendChild(modalProduct);

  /** Modal Buttons */
  const modalButtons = document.createElement('div');
  modalButtons.classList.add('modal-buttons');
  const buttonViewBag = document.createElement('a');
  // View bag button in the modal
  buttonViewBag.classList.add(...['button', 'secondary']);
  if (cartModalButtonsV2) {
    buttonViewBag.setAttribute('href', '#');
    buttonViewBag.innerText = placeholders.continueToShop || 'Continue to shop';
  } else {
    buttonViewBag.setAttribute('href', `/${lang}/cart`);
    buttonViewBag.innerText = placeholders.viewBag || 'View Bag';
  }

  /* Modal carousel */
  const modalCarousel = document.createElement('div');
  modalCarousel.classList.add('modal-carousel');

  // Checkout button in the modal
  const buttonCheckout = document.createElement('a');
  buttonCheckout.classList.add(...['button', 'primary']);
  let buttonCheckoutUrl;
  if (cartModalButtonsV2) {
    buttonCheckoutUrl = `/${lang}/cart`;
  } else {
    buttonCheckoutUrl = `/${lang}/cart/login?redirect=/${lang}/checkout`;
    if (token) {
      buttonCheckoutUrl = `/${lang}/checkout`;
    }
  }
  buttonCheckout.setAttribute('href', buttonCheckoutUrl);
  buttonCheckout.innerText = placeholders.checkout || 'Checkout';
  modalButtons.appendChild(buttonViewBag);
  modalButtons.appendChild(buttonCheckout);

  /** Modal footer */
  const modalFooter = document.createElement('div');
  modalFooter.classList.add('modal-footer');
  const itemsInBagText = document.createElement('h4');
  itemsInBagText.innerHTML = `${placeholders.itemsInYourBag || 'Items in your bag'}: <span class="boldtext">${cart?.totals?.items_qty || 0}</span>`;
  const subTotalText = document.createElement('h4');
  const subTotalValue = cart.totals?.subtotal_incl_tax || 0;
  const decimalDigits = await getConfigValue('cart-price-decimals') || 2;
  const subTotal = (Math.round(subTotalValue * 100) / 100).toFixed(decimalDigits);
  const currencyCode = await getConfigValue('pdp-currency-enable') ? await getConfigValue('currency') : '';
  subTotalText.innerHTML = `${placeholders.subTotal || 'Subtotal'}: <span class="boldtext">${currencyCode} ${subTotal}</span>`;
  modalFooter.appendChild(itemsInBagText);
  modalFooter.appendChild(subTotalText);

  addedToBagModalOverlay.appendChild(modalProducts);
  addedToBagModalOverlay.appendChild(modalButtons);
  addedToBagModalOverlay.appendChild(modalCarousel);
  addedToBagModalOverlay.appendChild(modalFooter);
  const [carouselBlockSection, fullProductData] = await Promise.all([
    loadFragment(`/${lang}/fragments/add-to-bag/recommendations`),
    window.product,
    createModalFromContent(
      ADDED_TO_BAG_DIALOG_ID,
      addedToBagModalTitle,
      addedToBagModalOverlay.outerHTML,
      [ADDED_TO_BAG_DIALOG_ID],
      'tick-verified',
    ),
    loadCSS(`/blocks/added-to-bag/${getBrandPath()}added-to-bag.css`),
  ]);
  const [targetPayload] = await Promise.all([
    pdpLoadData(fullProductData?.[2]),
    openModal(ADDED_TO_BAG_DIALOG_ID),
  ]);
  if (cartModalButtonsV2) {
    document.querySelector('.modal-buttons a.secondary').addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.added-to-bag-dialog').close();
    });
  }
  const addToBadTargetId = carouselBlockSection.querySelector('div[data-target-id]')?.dataset?.targetId;
  if (addToBadTargetId) {
    document.querySelector('.modal-carousel').appendChild(carouselBlockSection);
    fireTargetCall(targetPayload, [addToBadTargetId], false).then(() => {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('target-response'));
      }, 2000);
    });
  }
}
