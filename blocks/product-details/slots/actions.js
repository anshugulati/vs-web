import { decorateIcons } from '../../../scripts/aem.js';
import { isProductInWishlist } from '../../../scripts/wishlist/api.js';
import { openModal, getPreviewPreaccessType, hasValue } from '../../../scripts/scripts.js';
import {
  createShareIcon, loadSocialShareModal, createModal, SOCIAL_SHARE_DIALOG_ID,
} from '../../social-share/social-share.js';
import {
  datalayerAddToWishlistEvent,
  datalayerAddToCartEvent,
  datalayerSocialShareEvent,
  datalayerCartError,
  datalayerImageSwipeEvent,
} from '../../../scripts/analytics/google-data-layer.js';
import { store } from '../../../scripts/minicart/api.js';
import { targetClickTrackingEvent } from '../../../scripts/target/target-events.js';
import { cacheProductData } from '../../../scripts/commerce.js';
import { getConfigValue } from '../../../scripts/configs.js';

// Config to check weather custom Quantity block is enabled.
const enablePdpCustomQuantity = await getConfigValue('pdp-custom-quantity-enable');
const hideSeasonCodeOption = await getConfigValue('hide-season-code-option');
// Config to show social-share icons below the click and collect accordion.
const displaySocialShareIcons = await getConfigValue('display-social-share-icons');
const isMobile = window.innerWidth < 768;

function hasSizeOption(product) {
  return product.options
    ?.filter((option) => (option.id === 'size'))?.length > 0 ?? false;
}

function isSizeSelected(product, options) {
  return product.options
    ?.filter((option) => (option.id === 'size'))?.[0].items
    .filter((item) => item.selected
      || ((item.value === 'NO SIZE' || item.value === 'NOSIZE')
      && options?.includes(item.id)))?.length > 0 ?? false;
}

function sortSeasonCode(option1, option2) {
  const seasonCode1 = option1.label;
  const seasonCode2 = option2.label;
  const year1 = parseInt(seasonCode1.substring(0, 2), 10);
  const year2 = parseInt(seasonCode2.substring(0, 2), 10);

  const cycle1 = parseInt(seasonCode1.substring(2, 3), 10);
  const cycle2 = parseInt(seasonCode2.substring(2, 3), 10);

  if (year1 < year2) {
    return -1;
  }

  if (year1 > year2) {
    return 1;
  }

  if (cycle1 === cycle2 - 1 || (cycle1 === 9 && cycle2 === 0)) {
    return -1;
  }

  if (cycle1 === cycle2 + 1 || (cycle1 === 0 && cycle2 === 9)) {
    return 1;
  }
  return 0;
}

export function selectSeasonCode(product, options) {
  const seasonOptions = hideSeasonCodeOption === 'false' ? product?.options?.filter(
    (option) => option.id === 'season_code',
  )?.[0].items : [];
  if (!seasonOptions || seasonOptions.length === 1) {
    return;
  }

  // Select the season code based on earliest season code which is instock
  const inStockSeasonOptions = seasonOptions.filter((option) => option.inStock === true);
  const selectedSeasonCode = inStockSeasonOptions.sort(sortSeasonCode)[0];

  seasonOptions.forEach((option) => {
    option.selected = false;
  });

  if (selectedSeasonCode) {
    selectedSeasonCode.selected = true;
    const newOptions = [];

    let oldOption;

    options.forEach((optionId) => {
      const option = product.options?.find((o) => o.items?.find((i) => i.id === optionId));
      if (option) {
        oldOption = optionId;
      }
    });
    options.forEach((optionId) => {
      if (optionId !== oldOption) {
        newOptions.push(optionId);
      }
    });
    newOptions.push(selectedSeasonCode.id);

    options.splice(0, options.length, ...newOptions);
  }
}

async function handleAddToCart(e, data, block, placeholders) {
  let button = e.target;

  if (button.tagName !== 'BUTTON') {
    button = button.closest('button');
  }

  // Prevents multiple clicks
  if (button.classList.contains('loader')) {
    return;
  }

  // Extracts `selected` item `id`s for each option or
  // the first item's `id` if none are selected in that option
  const options = data.options?.map((option) => {
    const selectedOptionItemId = option.items?.find((item) => item.selected)?.id;
    return selectedOptionItemId || option.items?.[0]?.id;
  }).filter((x) => !!x) ?? [];

  selectSeasonCode(data, options);
  const errorContainer = block.querySelector('.error-message-container');
  if (hasSizeOption(data) && !isSizeSelected(data, options)) {
    errorContainer.classList.remove('hidden');
    const errorText = block.querySelector('.error-message-container .error-message').innerText;
    const cartId = store.getCartId();
    datalayerCartError(errorText, cartId);
  } else {
    errorContainer?.classList.add('hidden');
    button.classList.add('loader');
    if (await getConfigValue('pdp-no-refinement')) {
      cacheProductData(data, false);
    } else {
      cacheProductData(data, true);
    }
    const { cartApi } = await import('../../../scripts/minicart/api.js');
    let quantity;
    if (enablePdpCustomQuantity === 'true') {
      const quantityInput = block.querySelector('.quantity-stepper input');
      quantityInput.value = quantityInput.value === '' ? 1 : quantityInput.value;
      quantity = block.querySelector('.quantity-stepper input')?.value || 1;
    } else {
      quantity = block.querySelector('.dropin-incrementer__input')?.value ?? 1;
    }
    console.debug('Add to Cart', data.sku, options, quantity);
    const response = await cartApi.addToCart(data.sku, options, quantity);
    if (!response.success) {
      errorContainer?.classList.remove('hidden');
      block.querySelector('.error-message-container .error-message').innerText = response.message;
    } else {
      const [, , productDL] = await window.product;
      // productDL is used to obtain product values in English for DL for non-English websites
      await datalayerAddToCartEvent(true, productDL, quantity, options[0]);
      targetClickTrackingEvent({ key: 'addToCart' });
      if (await getConfigValue('pdp-addedtobag-enable')) {
        if (!button.querySelector('.icon-tick-white')) {
          button.querySelector('span').innerText = placeholders.addedToBag || 'Added to Bagg';
          const tickIcon = document.createElement('span');
          tickIcon.classList.add('icon', 'icon-tick-white');
          button.append(tickIcon);
          decorateIcons(button);
        }
      }
    }
    button.classList.remove('loader');
  }
}

async function renderAddToFavoriteButton(placeholders) {
  const addToFavoriteLabel = placeholders.addToFavouritesLabel || 'Add to Favourites';
  const addToFavoriteButton = document.createElement('button');
  addToFavoriteButton.setAttribute('aria-label', addToFavoriteLabel);
  addToFavoriteButton.innerHTML = `<span class="icon icon-wishlist-empty-pdp"></span><span class="icon icon-wishlist-filled-pdp"></span><span class="icon icon-wishlist-disabled"></span><span class="wishlist-label">${addToFavoriteLabel}</span>`;
  return addToFavoriteButton;
}

function updateFavoriteLabelStatus(addToFavoriteButton, placeholders, productData) {
  const addToFavouritesLabel = placeholders.addToFavouritesLabel || 'Add to Favourites';
  const addedToFavouritesLabel = placeholders.addedToFavouritesLabel || 'Added to Favourites';
  const addToFavouriteLabel = addToFavoriteButton.querySelector('.wishlist-label');
  const wishlistState = addToFavoriteButton.classList.contains('in-wishlist');
  if (wishlistState) {
    addToFavoriteButton.setAttribute('aria-label', addedToFavouritesLabel);
    addToFavouriteLabel.innerText = addedToFavouritesLabel;
  } else {
    addToFavoriteButton.setAttribute('aria-label', addToFavouritesLabel);
    addToFavouriteLabel.innerText = addToFavouritesLabel;
  }
  if (productData && window.location.href.indexOf('wishlist') === -1) {
    datalayerAddToWishlistEvent(wishlistState, productData, 'pdp');
  }
}

export async function createSocialShareButton(data, url) {
  const {
    socialShareOverlayTitle,
    socialShareOverlay,
  } = await loadSocialShareModal(data);
  createModal({
    socialShareOverlayTitle,
    socialShareOverlay,
    shareUrl: url,
  });
}

// update quantity button states based on the input value
function updateQuantityButtons(quantityInput, incrementButton, decrementButton) {
  const value = parseInt(quantityInput.value, 10);
  const max = parseInt(quantityInput.max, 10);

  if (value >= max) {
    incrementButton.disabled = true;
  } else {
    incrementButton.disabled = false;
  }

  if (value <= 1) {
    decrementButton.disabled = true;
  } else {
    decrementButton.disabled = false;
  }
}

function createQuantityStepper() {
  const stepperDiv = document.createElement('div');
  stepperDiv.classList.add('quantity-stepper');

  const decrementButton = document.createElement('button');
  decrementButton.classList.add('decrement');
  decrementButton.disabled = true;

  const quantityInput = document.createElement('input');
  quantityInput.type = 'number';
  quantityInput.classList.add('quantity');
  quantityInput.value = 1;
  quantityInput.min = 1;
  quantityInput.max = 10;

  const incrementButton = document.createElement('button');
  incrementButton.classList.add('increment');

  stepperDiv.appendChild(decrementButton);
  stepperDiv.appendChild(quantityInput);
  stepperDiv.appendChild(incrementButton);

  quantityInput?.addEventListener('input', () => {
    const value = parseInt(quantityInput.value, 10);
    if (value < quantityInput.min) {
      quantityInput.value = quantityInput.min;
    } else if (value > quantityInput.max) {
      quantityInput.value = quantityInput.max;
    }
    updateQuantityButtons(quantityInput, incrementButton, decrementButton);
  });

  // Increment value
  incrementButton.addEventListener('click', () => {
    const currentValue = parseInt(quantityInput.value, 10);
    if (currentValue < quantityInput.max) {
      quantityInput.value = currentValue + 1;
      updateQuantityButtons(quantityInput, incrementButton, decrementButton);
    }
  });

  // Decrement value
  decrementButton.addEventListener('click', () => {
    const currentValue = parseInt(quantityInput.value, 10);
    if (currentValue > 1) {
      quantityInput.value = currentValue - 1;
      updateQuantityButtons(quantityInput, incrementButton, decrementButton);
    }
  });

  // Set initial state of buttons
  updateQuantityButtons(quantityInput, incrementButton, decrementButton);

  return stepperDiv;
}

function toggleMainImage(event, block) {
  event.preventDefault();
  let selectedImage = event.currentTarget.querySelector('img');
  selectedImage.classList.add('clicked');
  selectedImage = selectedImage.getAttribute('src')?.split('?')[0];
  const mainImages = block.querySelectorAll('.pdp-gallery-grid__item');
  mainImages.forEach((image) => {
    const mainImage = image.querySelector('img').getAttribute('src')?.split('?')[0];
    image.classList.remove('selected');
    if (selectedImage === mainImage) {
      image.classList.add('selected');
    }
  });
}

function handleGalleryImages(block) {
  block.querySelector('.pdp-gallery-grid__item')?.classList.add('selected');
  block.querySelector('.pdp-gallery-carousel .carousel-item img')?.classList.add('clicked');
  const galleryImages = block.querySelectorAll('.pdp-gallery-carousel .carousel-item a');
  galleryImages.forEach((imageLink) => imageLink.addEventListener('click', (event) => {
    // Remove the 'clicked' class from all carousel images for border
    galleryImages.forEach((item) => {
      item.querySelector('img')?.classList.remove('clicked');
    });
    toggleMainImage(event, block);
  }));
}

function getSelectedVariant(data) {
  const { optionUIDs } = data;
  if (optionUIDs?.length > 0 && data.variants?.length > 0) {
    return data.variants.find((variant) => optionUIDs
      .filter((optionUID) => variant.selections?.includes(optionUID))
      ?.length === optionUIDs.length)?.product?.sku;
  }
  return null;
}

export default async function slot(ctx, $block, placeholders, isVisitorEligible, productQuantity) {
  const showCartButtons = await getConfigValue('pdp-oos-show-cart') === 'true';
  const { lang } = document.documentElement;
  const previewPreaccessAttr = ctx.data.attributes?.find((el) => el.id === 'preview_preaccess_data')?.value;
  const previewPreaccessData = previewPreaccessAttr ? JSON.parse(previewPreaccessAttr) : null;

  const typeInfo = getPreviewPreaccessType(previewPreaccessData, lang);

  let addToCartLabel = placeholders.addToCartLabel || 'Add to Cart';
  const outOfStockLabel = placeholders.outOfStockLabel || 'Out of Stock';

  const addToCartButton = document.createElement('button');
  addToCartButton.classList.add('dropin-button', 'dropin-button--medium', 'dropin-button--primary');

  if (!ctx.data.addToCartAllowed) {
    addToCartButton.classList.add('addtocart-not-allowed');
  }
  if (typeInfo.type === 'preview') {
    addToCartButton.classList.add('pdp-product-add-to-cart__hide');
  }
  if (typeInfo.type === 'pre-access') {
    if (!isVisitorEligible) {
      addToCartButton.classList.add('pdp-product-add-to-cart__hide');
    }
  }
  if (typeInfo?.type && typeInfo?.pdpText) {
    const divElement = document.createElement('div');
    const spanElement = document.createElement('span');
    spanElement.textContent = typeInfo?.pdpText;
    divElement.classList.add('pdp-product__previewtxt');
    divElement.appendChild(spanElement);
    ctx.appendChild(divElement);
  }

  // when the product is in stock but atleast one size is not available
  const swatchContainers = document.querySelectorAll('.dropin-text-swatch__container');
  swatchContainers.forEach((inStockSwatchContainer) => {
    const inStockLabel = inStockSwatchContainer.querySelector('label');
    if (inStockLabel.classList.contains('dropin-text-swatch__label--out-of-stock')) {
      const inStockInput = inStockSwatchContainer.querySelector('input');
      inStockInput.disabled = true;
    }
  });

  const customStepper = createQuantityStepper();
  const enableCustomQuantity = enablePdpCustomQuantity === 'true';
  if (enableCustomQuantity) {
    ctx.appendChild(customStepper);
    customStepper.querySelector('input').setAttribute('max', productQuantity);
  }

  // when the product is out of stock
  if (!ctx.data.inStock) {
    if (showCartButtons) {
      // disable quantity stepper
      customStepper.classList.add('OOS-disabled');
      customStepper.querySelector('button.increment').disabled = true;

      // disabled add to card button and lable it with out of stock
      addToCartButton.classList.add('dropin-button--primary--disabled');
      addToCartButton.disabled = true;
      addToCartLabel = outOfStockLabel;
    }

    ctx?.data?.options?.filter((option) => option.id === 'size').forEach((sizeOption) => {
      // check if all the sizes are out of stock
      const OOSItems = sizeOption.items.filter((sizeItem) => sizeItem.inStock === false);

      sizeOption.items.forEach((sizeItem) => {
        const sizeElement = document.querySelector(`input[value='${sizeItem.value}']`);
        if (sizeItem.inStock === false) {
          sizeElement.setAttribute('disabled', true);
        } else {
          sizeElement.removeAttribute('disabled');
        }
      });

      if (sizeOption.items.length === OOSItems.length) {
        // disabled add to card button and lable it with out of stock
        addToCartButton.classList.add('dropin-button--primary--disabled');
        addToCartButton.disabled = true;
        addToCartLabel = outOfStockLabel;
      }
    });
  }

  addToCartButton.setAttribute('aria-label', addToCartLabel);
  addToCartButton.innerHTML = `<span>${addToCartLabel}</span>`;
  ctx.appendChild(addToCartButton);

  const buttonBar = document.createElement('div');
  buttonBar.classList.add('dropin-button-bar');
  const carousel = $block.querySelector('.pdp-carousel');
  const productButtons = $block.querySelector('.pdp-product__buttons');

  // hide add to fav and share for OOS products
  if (ctx.data.inStock || showCartButtons) {
    ctx.appendChild(buttonBar);

    // listen to the resize event to update the button bar position
    // Create a ResizeObserver instance
    if (!ctx.data.inStock) {
      buttonBar.classList.add('OOS-disabled');
    }
    const resizeObserver = new ResizeObserver(() => {
      if (isMobile) {
        carousel.appendChild(buttonBar.parentElement);
      } else if (buttonBar.parentElement) {
        productButtons.appendChild(buttonBar.parentElement);
      }
    });

    // Start observing the element
    resizeObserver.observe($block);
  }
  // image swipe mutationObserver
  const targetNode = $block.querySelector('.pdp-carousel__wrapper');
  let previousActiveImage = $block.querySelector('.pdp-carousel__slide--active');

  const observer = new MutationObserver((mutationList) => {
    mutationList.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const { target } = mutation;
        target.classList.forEach((className) => {
          if (className.endsWith('--active')) {
            let direction;
            if (previousActiveImage) {
              // Determine swipe direction based on previous and current active images
              const allSlides = Array.from(document.querySelectorAll('.pdp-carousel__slide '));
              const previousIndex = allSlides.indexOf(previousActiveImage);
              const currentIndex = allSlides.indexOf(target);
              if (previousIndex !== currentIndex) {
                if (currentIndex > previousIndex) {
                  direction = 'left';
                } else if (currentIndex < previousIndex) {
                  direction = 'right';
                }
                datalayerImageSwipeEvent(direction, 'pdp');
              }
            }
            previousActiveImage = target;
          }
        });
      }
    });
  });
  const observerButtonBar = new MutationObserver((mutationList) => {
    mutationList.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation?.previousSibling?.className === 'amastyLabel') {
        const findButtonBar = document.querySelector('.pdp-carousel .dropin-button-bar');
        if (!findButtonBar) {
          carousel?.appendChild(buttonBar?.parentElement);
        }
      }
    });
  });

  observerButtonBar.observe(carousel, {
    attributes: true, subtree: true, childList: true, attributeFilter: ['class'],
  });

  observer.observe(targetNode, { attributes: true, subtree: true, attributeFilter: ['class'] });

  // Add to favorite button
  const addToFavoriteButton = await renderAddToFavoriteButton(placeholders);
  addToFavoriteButton.classList.add('dropin-button', 'dropin-button--medium', 'dropin-button--secondary', 'add-to-favorite', 'secondary');

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      isProductInWishlist(ctx.data.sku).then((index) => {
        const itemInWishlist = index !== -1;
        if (itemInWishlist) {
          addToFavoriteButton.classList.add('in-wishlist');
          updateFavoriteLabelStatus(addToFavoriteButton, placeholders);
        } else {
          addToFavoriteButton.classList.remove('in-wishlist');
        }
      });
    }
  });
  // check if the product is already in the wishlist
  isProductInWishlist(ctx.data.sku).then((index) => {
    if (index !== -1) {
      addToFavoriteButton.classList.add('in-wishlist');
      updateFavoriteLabelStatus(addToFavoriteButton, placeholders);
    }
  });

  function handleAddToFavorite(data) {
    if (addToFavoriteButton.classList.contains('disabled')) {
      return;
    }
    addToFavoriteButton.classList.add('loader');

    addToFavoriteButton.classList.add('disabled');
    import('../../../scripts/wishlist/api.js')
      .then(async (module) => {
        const wishListIconState = addToFavoriteButton.classList.contains('in-wishlist');

        const variantSku = getSelectedVariant(data);

        const productObj = { variantSku, sku: data.sku, name: data.name };
        const status = await module.updateWishlist(productObj, wishListIconState);

        addToFavoriteButton.classList.remove('loader');

        addToFavoriteButton.classList.remove('disabled');
        const [, , productDL] = await window.product;
        // productDL is used to obtain product values in English for DL for non-English websites

        if (status && status.status) {
          addToFavoriteButton.classList.toggle('in-wishlist');
          updateFavoriteLabelStatus(addToFavoriteButton, placeholders, productDL);
        } else {
          console.error(status?.message);
        }
      });
  }

  // listener to add the product to the wishlist
  let addToFavoriteListener = () => {
    handleAddToFavorite(ctx.data);
  };

  // listener to add the product to the wishlist
  addToFavoriteButton.addEventListener('click', addToFavoriteListener);

  buttonBar.appendChild(addToFavoriteButton);

  const shareButton = document.createElement('button');
  shareButton.classList.add('dropin-button', 'dropin-button--medium', 'dropin-button--secondary', 'dropin-button--icon', 'secondary', 'social-share--icon');

  const shareLink = await createShareIcon();
  shareButton.appendChild(shareLink);

  const shareDisabled = document.createElement('span');
  shareDisabled.classList.add('icon', 'icon-share-disabled');
  shareButton.querySelector('.social-share-link').prepend(shareDisabled);

  buttonBar.appendChild(shareButton);
  decorateIcons(buttonBar);

  let addToCartListener;
  addToCartListener = async (e) => {
    handleAddToCart(e, ctx.data, $block, placeholders);
  };
  addToCartButton.addEventListener('click', addToCartListener);

  ctx.onChange((next) => {
    if (addToCartListener) {
      addToCartButton.removeEventListener('click', addToCartListener);
    }
    addToCartListener = (e) => handleAddToCart(e, next.data, $block, placeholders);
    addToCartButton.addEventListener('click', addToCartListener);

    addToFavoriteButton.removeEventListener('click', addToFavoriteListener);
    addToFavoriteListener = () => {
      handleAddToFavorite(next.data);
    };
    addToFavoriteButton.addEventListener('click', addToFavoriteListener);
  });

  shareButton.addEventListener('click', async (e) => {
    e.preventDefault();
    openModal(SOCIAL_SHARE_DIALOG_ID);
    datalayerSocialShareEvent('open');
  });
  shareButton.setAttribute('disabled', 'disabled');
  if (await getConfigValue('pdp-gallery-carousel-enable') === 'true') {
    handleGalleryImages($block);
  }

  window.addEventListener('delayed-loaded', async () => {
    // Checks if the device is a mobile and if the displaySocialShareIcons setting is enabled.
    // If displaySocialShareIcons is not enabled, it shows default display.
    if ((hasValue(displaySocialShareIcons) && displaySocialShareIcons !== 'true') || isMobile) {
      await createSocialShareButton(ctx.data, window.location.href);
      shareButton.removeAttribute('disabled');
    }
  });
}
