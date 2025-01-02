import {
  getWishlist,
  responsesCollection,
  removeMissingWishlistItems,
  updateWishlist,
} from '../../scripts/wishlist/api.js';
import {
  fetchPlaceholdersForLocale,
  loadFragment,
  createModalFromContent,
  openModal, closeModal,
} from '../../scripts/scripts.js';
import {
  buildHits,
  getProductListingConfig,
  attributesToRetrieve,
  responseFields,
  buildLoadMoreContainer,
  updatePageLoader,
  buildQuickViewModal,
  updateWishlistIcons,
} from '../algolia-product-listing/algolia-product-listing.js';
import {
  getProductData, getProductStockStatus, getSignInToken, loadProduct,
} from '../../scripts/commerce.js';
import { decorateIcons } from '../../scripts/aem.js';
import { getFilteredProducts } from '../../scripts/product-list/api.js';
import { datalayerSelectItemListEvent, datalayerViewItemEvent } from '../../scripts/analytics/google-data-layer.js';
import renderAddToBagDialog from '../added-to-bag/added-to-bag.js';
import {
  updateProductPopup,
  renderProduct,
} from '../../scripts/plp-utils/plp-utils.js';

let selectedOptions = {};
let wishlistConfig;
let placeholders;
let wishlistPage = 0;
let wishlistRemoveEventInitialized = false;
let spinnerTimeoutId;

const MAX_ITEMS_IN_CHUNK = 30;

document.addEventListener('WISHLIST_PRODUCT_SIZE_CHANGE', (event) => {
  selectedOptions.size = event.detail;
});

function getColumnsClass(block) {
  const columnsClass = Array.from(block.classList).find((className) => className.startsWith('columns-'));
  block.classList.remove(columnsClass);
  return columnsClass || 'columns-4';
}

function displayEmptyWishlist() {
  const block = document.querySelector('.wishlist.block');
  let emptyWishlistContainer = block.querySelector('.empty-wishlist-container');
  if (!emptyWishlistContainer) {
    emptyWishlistContainer = document.createElement('div');
    emptyWishlistContainer.classList.add('empty-wishlist-container');

    const emptyWishlistText = document.createElement('p');
    emptyWishlistText.innerText = placeholders.favouritesEmptyText;
    emptyWishlistContainer.appendChild(emptyWishlistText);

    if (wishlistConfig['enable-favourites-with-options']) {
      const emptyWishlistSubText = document.createElement('p');
      emptyWishlistSubText.classList.add('sub-text');
      emptyWishlistText.classList.add('text');
      emptyWishlistSubText.innerText = placeholders.favouritesEmptySubText;
      emptyWishlistContainer.appendChild(emptyWishlistSubText);

      const icon = document.createElement('span');
      icon.classList.add('empty-fav-icon', 'icon');
      emptyWishlistContainer.prepend(icon);
    }

    const emptyWishlistButton = document.createElement('a');
    emptyWishlistButton.classList.add('button');
    emptyWishlistButton.classList.add('primary');
    emptyWishlistButton.setAttribute('href', placeholders.favouritesGoShoppingUrl);
    emptyWishlistButton.innerText = placeholders.favouritesEmptyButton;
    emptyWishlistContainer.appendChild(emptyWishlistButton);
    block.appendChild(emptyWishlistContainer);
  }
}

function preventProductZoom() {
  document.querySelectorAll('.pdp-product .pdp-product__images .pdp-gallery-grid__item').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.stopImmediatePropagation();
    }, { capture: true });
  });
}

export async function createProductPopup(
  productSku,
  indexVal,
  variantSku = null,
  addToBasket = null,
) {
  selectedOptions = {};
  if (addToBasket) {
    addToBasket.classList.add('loader');
  }

  window.product = await loadProduct(productSku);
  const [, , productDL] = await window.product;
  const gtm = productDL?.attributes?.find((el) => el.name === 'gtm_attributes')?.value;
  productDL.gtm = gtm ? JSON.parse(gtm) : null;
  const productOverviewElement = await renderProduct(placeholders, 'wishlist', variantSku);
  createModalFromContent('wishlist-product-overview', placeholders.favouritesQuickView, productOverviewElement, ['wishlist-product-overview'], '', true).then(async () => {
    await openModal('wishlist-product-overview').then(() => {
      if (addToBasket) {
        addToBasket.classList.remove('loader');
      }
      preventProductZoom();
    });
  });
  localStorage.setItem('categoryListName', 'Wishlist');
  const totalItems = document.querySelectorAll('.wishlist-container .products-container .product-item').length;
  await datalayerSelectItemListEvent(productDL, totalItems, indexVal);
  await datalayerViewItemEvent(productDL, indexVal);
}

async function updateProductPopupEvent(productSku, placeHolders) {
  const container = document.querySelector('.wishlist-product-overview .modal-content');
  container.classList.add('wishlist-model-content');
  updateProductPopup(productSku, placeHolders, container, 'wishlist-model-content', 'wishlist');
}

function createSpinnerOverlay() {
  if (!document.querySelector('.spinner-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'spinner-overlay';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
  }
}

function showSpinner() {
  const overlay = document.querySelector('.spinner-overlay');
  if (overlay) {
    overlay.classList?.add('active');
  }
}

function hideSpinner() {
  const overlay = document.querySelector('.spinner-overlay');
  if (overlay) {
    overlay.classList?.remove('active');
    overlay.remove();
  }
  document.querySelector('.products-container')?.classList.remove('disabled-fade');
}

function showMessageInHeader(messageBlock, className) {
  const wishlistBlock = document.querySelector('.wishlist.block');
  if (!wishlistBlock.querySelector(`.${className}`)) {
    const contentBlock = document.createElement('div');
    const icon = document.createElement('span');

    icon.classList.add('icon', 'icon-info');
    contentBlock.classList.add('header-message', className);
    contentBlock.appendChild(icon);
    decorateIcons(contentBlock);
    contentBlock.appendChild(messageBlock);
    wishlistBlock.insertBefore(contentBlock, wishlistBlock.firstChild);
  }
}

async function showHoldOnFavoritesMessage() {
  const lang = document.documentElement.lang || 'en';
  const fragmentPath = `/${lang}/fragments/wishlist/hold-on-favorites`;
  const messageBlock = await loadFragment(fragmentPath);
  showMessageInHeader(messageBlock, 'info-message');
}

function showProductDoesNotExistMessage() {
  const messageBlock = document.createElement('div');
  messageBlock.innerText = placeholders.favouritesProductDoesNotExistText;
  decorateIcons(messageBlock);
  showMessageInHeader(messageBlock, 'warn-message');
}

function getWishlistItemsForPage() {
  const itemsPerPage = wishlistConfig['favourites-hits-per-page'];

  const removedItemCount = responsesCollection.removed || 0;
  const baseIndex = (wishlistPage * itemsPerPage) - removedItemCount;

  let startIndex = baseIndex;
  const endIndex = (wishlistPage + 1) * itemsPerPage;

  if (removedItemCount > 0) {
    /* there are some items that are removed, re-populate
    deleted items from backlog if present */
    startIndex = (wishlistPage + 1) * itemsPerPage - removedItemCount;
  }
  return {
    results: [{
      hits: responsesCollection.hits.slice(
        Math.max(0, startIndex),
        endIndex,
      ),
      hitsPerPage: itemsPerPage,
      nbHits: responsesCollection.nbHits,
      page: wishlistPage,
      collectionHitsEn: responsesCollection?.collectionHitsEn,
    }],
  };
}

async function fetchWishlistItemsFromAlgolia(requests) {
  const response = await getFilteredProducts(requests, true);
  if (response?.results?.length) {
    const wishListDlItemsEn = response?.results?.[1]?.hits || [];
    responsesCollection.hits.push(...response.results[0].hits);
    responsesCollection.nbHits += response.results[0].nbHits;
    // collectionHitsEn is an array for english values in arabic site
    responsesCollection.collectionHitsEn.push(wishListDlItemsEn);
  }
}

async function addWishlistButtons(productItem, items, response) {
  // Build add to basket button for the product Item
  const buttonsDiv = document.createElement('div');
  buttonsDiv.classList.add('basket-buttons-container');
  const addToBasket = document.createElement('button');
  addToBasket.classList.add('add-to-basket');
  addToBasket.setAttribute('aria-label', 'Add to basket');
  addToBasket.innerHTML = `<span>${placeholders.favouritesAddToBasket}</span>`;

  const { product: wishlistIdInfoList } = productItem.querySelector('.wishlist-button-wrapper').dataset;
  const productData = JSON.parse(wishlistIdInfoList);
  productItem.setAttribute('data-sku', productData.sku);
  if (productItem.querySelector('.overlay-out-of-stock-container') || productItem.querySelector('.preview')) {
    addToBasket.disabled = true;
  } else {
    addToBasket.addEventListener('click', async () => {
      if (wishlistConfig['enable-favourites-with-options']) {
        const product = (response?.results[0]?.hits || []).find((p) => p.sku === productData.sku);
        const productResult = await getProductData(product.sku);
        console.log(items);
        const { items: stockResponse } = await getProductStockStatus(product.sku);
        await buildQuickViewModal({
          ...productResult,
          ...product,
          ...stockResponse[0],
        }, productItem);
        await openModal('quick-view-modal');
      } else {
        const variantSku = items.find((item) => item.parent_sku === productData.sku)?.sku;
        const indexVal = buttonsDiv.closest('.product-item').getAttribute('data-index');
        await createProductPopup(productData.sku, indexVal, variantSku, addToBasket);
      }
    });
  }
  buttonsDiv.appendChild(addToBasket); // TODO: add to basket functionality
  productItem.appendChild(buttonsDiv);

  // Build remove from wishlist button
  const { product: wishlistIdInfo } = productItem.querySelector('.wishlist-button-wrapper').dataset;
  const removeFromWishlist = document.createElement('a');
  removeFromWishlist.classList.add('remove-from-wishlist');
  removeFromWishlist.setAttribute('data-product', `${wishlistIdInfo}`);
  removeFromWishlist.innerText = `${placeholders.favouritesRemove}`;

  // Add event listeners
  if (!removeFromWishlist.hasAttribute('wishlist-remove-listener')) {
    removeFromWishlist.addEventListener('click', async (event) => {
      const wishlistButton = event.target.closest('.product-item').querySelector('.wishlist-button-wrapper');
      if (wishlistButton) {
        document.querySelector('.products-container').classList.add('disabled-fade');
        createSpinnerOverlay();
        showSpinner();
        if (wishlistConfig['enable-favourites-with-options']) {
          wishlistButton.firstElementChild.click();
        } else {
          wishlistButton.click();
        }
        // fallback scenario: in-case of error hide the spinner after 10 secs
        spinnerTimeoutId = setTimeout(hideSpinner, 10000);
      }
    });
    removeFromWishlist.setAttribute('wishlist-remove-listener', 'initialized');
  }
  buttonsDiv.appendChild(removeFromWishlist);
}

async function buildWishlist(replaceProducts = true, isFirstLoad = true) {
  const wishlistItems = await getWishlist();
  if (!wishlistItems.items.some((item) => Object.prototype.hasOwnProperty.call(item, 'added_at'))) {
    wishlistItems.items.reverse();
  } else {
    wishlistItems.items = wishlistItems.items.sort(
      (a, b) => new Date(b.added_at) - new Date(a.added_at),
    );
  }
  if (wishlistItems.items.length === 0) {
    displayEmptyWishlist();
    return;
  }
  // If no hits, it means this is the first request and need to fetch products from Algolia
  if (responsesCollection.nbHits === 0) {
    // Build and run chunked queries
    const promises = [];
    for (let i = 0; i < wishlistItems.items.length; i += MAX_ITEMS_IN_CHUNK) {
      const wishlistQuery = wishlistItems.items.slice(i, i + MAX_ITEMS_IN_CHUNK).map((item) => item.sku).join(' OR ');
      const requests = [{
        indexName: wishlistConfig['algolia-search-index'],
        params: `query=${wishlistQuery}&attributesToRetrieve=${attributesToRetrieve}&responseFields=${responseFields}&hitsPerPage=${MAX_ITEMS_IN_CHUNK}`,
      }];

      promises.push(fetchWishlistItemsFromAlgolia(requests));
    }
    await Promise.all(promises);
    if (wishlistItems.items.length > responsesCollection.nbHits) {
      const responseSkus = responsesCollection.hits.map((item) => item.sku);

      // Find wishlist SKUs not present in responseSkus
      const missingWishlistItems = wishlistItems.items.filter(
        (wishlistItem) => !responseSkus.includes(wishlistItem.parent_sku ?? wishlistItem.sku),
      );

      // Show message with missing wishlist SKUs
      if (missingWishlistItems.length > 0) {
        removeMissingWishlistItems(missingWishlistItems);
        showProductDoesNotExistMessage();
      }
    }
    // Show sign in/sign up message for guest users
    const token = await getSignInToken();
    if (!token && responsesCollection.nbHits > 0) {
      showHoldOnFavoritesMessage();
    }
  }

  // If after requests there are still no hits, display empty wishlist
  if (responsesCollection.nbHits === 0) {
    displayEmptyWishlist();
    return;
  }

  // Sort the hits based on the order of the wishlist items
  responsesCollection.hits.sort((a, b) => {
    const hasAddedAt = wishlistItems.items.every((item) => Object.prototype.hasOwnProperty.call(item, 'added_at'));
    let indexA; let
      indexB;
    if (hasAddedAt) {
      indexA = wishlistItems.items.findIndex(
        (item) => item.sku === b.sku || item.parent_sku === b.sku,
      );
      indexB = wishlistItems.items.findIndex(
        (item) => item.sku === a.sku || item.parent_sku === a.sku,
      );

      return new Date(wishlistItems.items[indexA]?.added_at)
    - new Date(wishlistItems.items[indexB]?.added_at) || -1;
    }
    indexA = wishlistItems.items.findIndex(
      (item) => item.sku === a.sku || item.parent_sku === a.sku,
    );
    indexB = wishlistItems.items.findIndex(
      (item) => item.sku === b.sku || item.parent_sku === b.sku,
    );
    return indexA - indexB;
  });

  const response = getWishlistItemsForPage();
  buildHits(response, {
    replace: replaceProducts,
    isWishlist: true,
    config: wishlistConfig,
    placeholdersList: placeholders,
  });
  if (wishlistConfig['enable-favourites-with-options']) {
    updateWishlistIcons();
  }
  if (!document.querySelector('.products-pager-container')) {
    const block = document.querySelector('.wishlist.block');
    const loadMoreContainer = buildLoadMoreContainer(placeholders.plpLoadMoreProducts);
    loadMoreContainer.querySelector('.pager-button').addEventListener('click', async () => {
      wishlistPage += 1;
      await buildWishlist(false, false);
      const updatedResponse = getWishlistItemsForPage();
      responsesCollection.removed = 0;
      response.results[0].hits.push(...(updatedResponse?.results?.[0]?.hits || []));
      updatePageLoader(updatedResponse, placeholders, 'loadMore');
    });
    block.appendChild(loadMoreContainer);
    if (isFirstLoad) {
      updatePageLoader(response, placeholders);
    }
  }

  // Observer used to wait for a blocking function in buildHits
  const observer = new MutationObserver((mutationsList) => {
    if (mutationsList[0]?.type === 'childList') {
      mutationsList[0].addedNodes.forEach((item) => {
        if (!item.querySelector('.basket-buttons-container')) {
          addWishlistButtons(item, wishlistItems.items, response);
        }
      });
      // TODO: Need to disconnet the observer at the right time.
      // obs.disconnect();
    }
  });
  const targetNode = document.querySelector('.products-container');
  const config = {
    childList: true,
  };
  if (targetNode && config) {
    observer?.observe(targetNode, config);
  }
}

const handleWishlistRemoveComplete = async (event) => {
  const { sku } = event.detail;
  const element = document.querySelector(`.product-item[data-sku="${sku}"]`);
  element?.remove();
  const productsContainer = document.querySelector('.products-container');
  const holdOnFavoritesMessage = document.querySelector('.header-message');
  if (productsContainer.children.length === 0 && responsesCollection.nbHits < 1) {
    productsContainer.remove();
    displayEmptyWishlist();
    holdOnFavoritesMessage.remove();
  }
  await buildWishlist(false, false);
  const updatedResponse = getWishlistItemsForPage();
  responsesCollection.removed = 0;
  await updatePageLoader(updatedResponse, placeholders, 'loadMore');

  productsContainer.classList?.remove('disabled-fade');
  clearTimeout(spinnerTimeoutId);
  hideSpinner();
};

function initWishlistRemoveListener() {
  if (!wishlistRemoveEventInitialized) {
    document.addEventListener('wishlistRemoveComplete', async (event) => {
      await handleWishlistRemoveComplete(event);
    });
    wishlistRemoveEventInitialized = true;
  }
}

export default async function decorate(block) {
  // Get config values
  placeholders = await fetchPlaceholdersForLocale();
  wishlistConfig = await getProductListingConfig();
  const columnSetting = getColumnsClass(block);

  // Create products container
  const productsContainer = document.createElement('div');
  productsContainer.classList.add('products-container');
  productsContainer.classList.add(columnSetting);
  block.appendChild(productsContainer);

  // Build wishlist cards
  buildWishlist();
  initWishlistRemoveListener();
  document.querySelector('main').addEventListener('addtobag-updated', async (event) => {
    const { detail: { product } } = event;
    const addToWishlistButton = document.querySelector('.dropin-button-bar button.add-to-favorite');
    const quickViewAddToBagButton = document.querySelector('.quick-view-add-to-bag');
    const productContainer = document.querySelector(`[data-sku="${product.sku}"]`);
    if (addToWishlistButton?.classList.contains('in-wishlist')) {
      productContainer.remove();
      addToWishlistButton.click();
    } else if (quickViewAddToBagButton?.classList.contains('in-wishlist')) {
      await updateWishlist(product, true);
      productContainer.remove();
    }
    const thisProductsContainer = document.querySelector('.products-container');
    if (thisProductsContainer.children.length === 0) {
      thisProductsContainer.remove();
      displayEmptyWishlist();
    }
    await closeModal('wishlist-product-overview');
  });
  document.addEventListener('updateProductPopup', (event) => {
    updateProductPopupEvent(event.detail.sku, placeholders);
  });

  if (wishlistConfig['enable-favourites-with-options']) {
    document.querySelector('main').addEventListener('addtobag-updated', async (event) => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      await renderAddToBagDialog(event);
    });
  }
}
