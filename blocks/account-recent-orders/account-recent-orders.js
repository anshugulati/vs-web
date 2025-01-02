/* eslint-disable max-len */
import {
  fetchPlaceholdersForLocale, openModal,
  createModalFromContent, formatPrice,
} from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getCustomer } from '../../scripts/customer/api.js';
import { getAuthorReviews, getBVConfig, getStoredMyReview } from '../../scripts/reviews/api.js';
import { decorateReview, decorateSecondaryRatings, starRating } from '../product-details/slots/ratings.js';
import {
  getOrderStatus, convertToCamelCase,
  getCancelledOrderCount, getRecentOrdersUsingAPI,
  getTotalItemsCount, countryToTimeZone,
  isRefundedFully, decorateOrderDetails,
  fetchProductDataForOrders, numberOfOrders, getLocale,
} from './account-recent-orders-util.js';

export async function formatDateTime(dateString, locale) {
  let newLocale = locale;
  if (locale?.includes('_')) {
    newLocale = locale.replaceAll('_', '-');
  }

  const date = new Date(`${dateString}+0000`);
  const countryCode = await getConfigValue('country-code');
  const timeZone = countryToTimeZone[countryCode].tz;
  const dateOptions = {
    year: 'numeric', month: 'short', day: '2-digit', numberingSystem: 'latn',
  };

  const timeOptions = {
    timeZone, hour12: false, hour: '2-digit', hourCycle: 'h12', minute: '2-digit', numberingSystem: 'latn',
  };
  const formattedDate = new Intl.DateTimeFormat(newLocale, dateOptions).format(date);
  const formattime = new Intl.DateTimeFormat(newLocale, timeOptions).format(date);

  const [hours, minutes] = formattime.split(':');
  const formattedTime = `${hours}h${minutes}`;

  return `${formattedDate} @ ${formattedTime}`;
}

export function getProductSkuList(orders, isSimpleProduct) {
  const productSkuList = [];
  orders?.items?.forEach((order) => {
    order?.items?.forEach((item) => {
      const itemSku = isSimpleProduct === 'true' ? item?.sku : item.extension_attributes?.parent_product_sku;
      if (itemSku && !productSkuList.includes(itemSku)) {
        productSkuList.push(itemSku);
      }
    });
  });
  return productSkuList;
}

export async function fetchReviewsForOrders(orders) {
  const isSimpleProduct = await getConfigValue('pdp-simple-product');
  const productSkuList = getProductSkuList(orders, isSimpleProduct);
  if (productSkuList.length === 0) {
    return null;
  }

  const customer = await getCustomer(true);
  const reviews = await getAuthorReviews(customer.id, productSkuList, 0, productSkuList.length);

  return reviews;
}

function getReview(productSku, reviews) {
  return reviews?.Results?.find((review) => review.ProductId === productSku);
}

export function getOrderProductNames(order) {
  const name = order.items.filter((item) => !item.parent_item_id)
    .reduce((acc, item) => `${acc}${item.name}, `, '');
  return name.slice(0, -2);
}

async function decorateProductReview(productName, productImage, block) {
  const productDetails = document.createElement('div');
  productDetails.classList.add('product-details');

  const productSwatchImg = document.createElement('div');
  productSwatchImg.classList.add('swatch-img');
  const img = document.createElement('img');
  img.setAttribute('src', productImage);
  img.setAttribute('alt', productName || '');
  img.setAttribute('title', productName || '');
  productSwatchImg.appendChild(img);

  productDetails.appendChild(productSwatchImg);

  const productTitle = document.createElement('span');
  productTitle.classList.add('product-name');
  productTitle.textContent = productName || '';

  productDetails.appendChild(productTitle);

  block.appendChild(productDetails);
}

async function decorateAndShowReview(review, productImage, productName, bvConfig, placeholders, locale) {
  const reviewWrapper = document.createElement('div');
  reviewWrapper.classList.add('review-wrapper');

  decorateProductReview(productName, productImage, reviewWrapper);

  reviewWrapper.appendChild(await decorateReview(review, bvConfig, 0, locale, placeholders));

  if (review.SecondaryRatingsOrder && review.SecondaryRatings) {
    const ratingSecondary = document.createElement('div');
    ratingSecondary.classList.add('rating-secondary');
    reviewWrapper.appendChild(ratingSecondary);

    decorateSecondaryRatings(
      review.SecondaryRatingsOrder,
      review.SecondaryRatings,
      ratingSecondary,
    );
  }

  decorateIcons(reviewWrapper);
  createModalFromContent('order-view-ratings', placeholders.orderMyReview || 'My Review', reviewWrapper.outerHTML, ['pdp-modal', 'order-view-ratings']).then(() => {
    openModal('order-view-ratings');
  });
}

export async function decorateReviews(parent, orders, reviews, placeholders, locale) {
  const bvConfig = await getBVConfig();
  parent.querySelectorAll('.order-item-review').forEach((orderItemReview) => {
    const productImage = orderItemReview.closest('.order-item').querySelector('.order-item-image img');
    const { productName, productId: productSku } = orderItemReview.dataset;
    const review = getReview(productSku, reviews);
    const storedReview = getStoredMyReview(productSku);

    if (review) {
      orderItemReview.innerHTML = '';

      const reviewItem = document.createElement('div');
      reviewItem.classList.add('review-item');

      reviewItem.appendChild(starRating(review.Rating));

      const reviewLink = document.createElement('a');
      reviewLink.classList.add('review-link');
      reviewLink.textContent = placeholders.viewReview || 'View Review';
      reviewLink.href = '#';

      reviewItem.appendChild(reviewLink);

      decorateIcons(reviewItem);

      orderItemReview.appendChild(reviewItem);

      reviewLink.addEventListener('click', (event) => {
        event.preventDefault();
        decorateAndShowReview(review, productImage?.src || '', productName, bvConfig, placeholders, locale);
      });
    } else if (storedReview) {
      // disable review button
      const writeReviewButton = orderItemReview.querySelector('.order-item-review-button');
      writeReviewButton.setAttribute('disabled', 'disabled');
      writeReviewButton.classList.add('disabled');
    }
  });
}

async function decorateRecentOrders(recentOrdersContainer, orders, productData, placeholders, locale) {
  const recentOrdersList = document.createElement('div');
  recentOrdersList.classList.add('recent-orders-list');

  orders.items.forEach((order) => {
    const orderItem = document.createElement('div');
    orderItem.classList.add('recent-order-item', 'details-pending');
    orderItem.dataset.orderId = order.entity_id;

    const orderSummary = document.createElement('div');
    orderSummary.classList.add('order-summary');

    const orderNumber = document.createElement('div');
    orderNumber.classList.add('order-number', 'order-header');

    const orderNumberLabel = document.createElement('span');
    orderNumberLabel.classList.add('order-number', 'order-detail-label');
    orderNumberLabel.textContent = placeholders.orderNumber || 'Order ID';

    orderNumber.appendChild(orderNumberLabel);

    const orderNumberText = document.createElement('span');
    orderNumberText.classList.add('order-number', 'order-detail-value');
    orderNumberText.textContent = order.increment_id;

    orderNumber.appendChild(orderNumberText);

    const orderDate = document.createElement('span');
    orderDate.classList.add('order-date', 'order-detail-label');
    formatDateTime(order.created_at, locale).then((formattedDate) => {
      orderDate.textContent = formattedDate;
    });

    orderNumber.appendChild(orderDate);

    const orderItems = document.createElement('div');
    orderItems.classList.add('order-items', 'order-header');

    const orderItemsDesc = document.createElement('span');
    orderItemsDesc.classList.add('order-items-desc', 'order-detail-value');
    orderItemsDesc.textContent = `${getOrderProductNames(order)}`;

    orderItems.appendChild(orderItemsDesc);

    const orderTotalCount = getTotalItemsCount(order);
    const orderTotalItemsMessage = orderTotalCount > 1 ? placeholders.orderItemsTotal || 'Total {{}} items' : placeholders.orderItemTotal || 'Total {{}} item';

    const orderItemsValue = document.createElement('span');
    orderItemsValue.classList.add('order-items-value', 'order-detail-label');
    orderItemsValue.textContent = orderTotalItemsMessage.replace('{{}}', orderTotalCount);

    orderItems.appendChild(orderItemsValue);

    const cancelledItems = getCancelledOrderCount(order);
    if (cancelledItems > 0) {
      const orderCancelledItemsMessage = placeholders.orderItemsCancelled || 'Cancelled: {{}} items';

      const orderItemsCancelled = document.createElement('span');
      orderItemsCancelled.classList.add('order-items-cancelled', 'order-detail-label');
      orderItemsCancelled.innerHTML = `<a href="#">${orderCancelledItemsMessage.replace('{{}}', cancelledItems)}</a>`;
      orderItems.appendChild(orderItemsCancelled);

      orderItemsCancelled.addEventListener('click', (event) => {
        event.preventDefault();
        const orderItemsCancelledElem = orderItem.querySelector('.order-items-wrapper.order-items-cancelled');
        setTimeout(() => {
          orderItemsCancelledElem.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        }, 100);
      });
    }

    const orderStatus = document.createElement('div');
    orderStatus.classList.add('order-status', 'order-header');

    const orderStatusText = getOrderStatus(order);

    const orderStatusValue = document.createElement('span');
    orderStatusValue.classList.add('order-status', `order-status-${orderStatusText.replaceAll(' ', '-')}`);
    const orderStatusKey = convertToCamelCase(`order-status-${orderStatusText.replaceAll(' ', '-')}`);
    orderStatusValue.textContent = placeholders[orderStatusKey] || orderStatusText;

    if (isRefundedFully(order)) {
      orderStatusValue.classList.add('order-status-refunded-fully');
    }

    orderStatus.appendChild(orderStatusValue);

    const orderTotal = document.createElement('div');
    orderTotal.classList.add('order-total', 'order-header');

    const orderTotalLabel = document.createElement('span');
    orderTotalLabel.classList.add('order-total', 'order-detail-label');
    orderTotalLabel.textContent = placeholders.orderTotal || 'Order Total';

    orderTotal.appendChild(orderTotalLabel);

    const orderTotalValue = document.createElement('span');
    orderTotalValue.classList.add('order-total', 'order-detail-value');
    formatPrice(order.order_currency_code, order.grand_total).then((formattedPrice) => {
      orderTotalValue.textContent = formattedPrice;
    });

    orderTotal.appendChild(orderTotalValue);

    const orderExpand = document.createElement('div');
    orderExpand.classList.add('order-expand');

    const orderExpandLink = document.createElement('a');
    orderExpandLink.classList.add('order-expand-link');

    orderExpandLink.innerHTML = `
            <span class="icon icon-chevron-down"></span>
            <span class="icon icon-chevron-up expand"><span></span>`;

    orderExpand.appendChild(orderExpandLink);

    orderSummary.appendChild(orderNumber);
    orderSummary.appendChild(orderItems);
    orderSummary.appendChild(orderStatus);
    orderSummary.appendChild(orderTotal);
    orderSummary.appendChild(orderExpand);

    orderItem.appendChild(orderSummary);

    decorateOrderDetails(orderItem, order, productData, placeholders, locale);

    recentOrdersList.appendChild(orderItem);

    orderSummary.addEventListener('click', () => {
      recentOrdersList.querySelectorAll('.recent-order-item').forEach((item) => {
        if (item !== orderItem) {
          const accordionContent = item.querySelector('.order-details-wrapper');
          item.classList.remove('expanded');
          accordionContent.style.maxHeight = 0;
        }
      });
      orderItem.classList.toggle('expanded');
      const accordionContent = orderItem.querySelector('.order-details-wrapper');
      if (orderItem.classList.contains('expanded')) {
        accordionContent.style.maxHeight = `${accordionContent.scrollHeight}px`;
        setTimeout(() => {
          orderSummary.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        }, 300);
      } else {
        accordionContent.style.maxHeight = 0;
      }
    });
  });
  recentOrdersContainer.appendChild(recentOrdersList);
  decorateIcons(recentOrdersList);
}

export default async function decorate(block) {
  const RecentOrdersWithoutExpandedView = await getConfigValue('recent-orders-without-expanded-view');
  if (RecentOrdersWithoutExpandedView) {
    import('./account-recent-orders-no-order-expand-view.js').then((module) => {
      module.default(block);
    });
    return;
  }
  const placeholders = await fetchPlaceholdersForLocale();
  const numberOfOrdersToDisplay = await numberOfOrders(block);

  const titleDiv = block.children[0] ? block.children[0] : block;
  const viewAllOrdersLink = titleDiv.querySelector('a');
  const recentOrdersTitle = titleDiv.querySelector('h2, h3, h4, h5, h6');

  const emptyOrders = block.children.length >= 2 ? block.children[1] : null;

  const emptyOrdersDiv = document.createElement('div');
  emptyOrdersDiv.classList.add('empty-orders');
  emptyOrdersDiv.innerHTML = emptyOrders?.innerHTML || '';

  const noteContent = block.children.length >= 3 ? block.children[2] : null;

  const note = document.createElement('div');
  note.classList.add('order-notes');
  note.innerHTML = noteContent?.innerHTML || '';
  decorateIcons(note);

  block.innerHTML = '';

  const recentOrdersContainer = document.createElement('div');
  recentOrdersContainer.classList.add('recent-orders-container');

  const successTitleWrapper = document.createElement('div');
  successTitleWrapper.classList.add('title-wrapper');

  successTitleWrapper.appendChild(recentOrdersTitle);
  successTitleWrapper.appendChild(viewAllOrdersLink);

  viewAllOrdersLink.classList.remove('button');

  recentOrdersContainer.appendChild(successTitleWrapper);

  recentOrdersContainer.appendChild(emptyOrdersDiv);

  recentOrdersContainer.classList.add('loading-parent', 'loading');

  const loadingBlock = document.createElement('div');
  loadingBlock.classList.add('loading-block');
  loadingBlock.innerHTML = `
        <div class="loading-spinner">
          <span class="icon icon-ic-loader"></span>
        </div>
      `;
  decorateIcons(loadingBlock);
  recentOrdersContainer.appendChild(loadingBlock);

  getRecentOrdersUsingAPI(numberOfOrdersToDisplay).then(async (orders) => {
    if (orders?.items?.length > 0) {
      recentOrdersContainer.classList.add('has-orders');
      const productData = await fetchProductDataForOrders(orders);
      const locale = await getLocale();

      recentOrdersContainer.classList.remove('loading');
      await decorateRecentOrders(recentOrdersContainer, orders, productData, placeholders, locale);

      window.addEventListener('delayed-loaded', () => {
        fetchReviewsForOrders(orders).then((reviews) => {
          decorateReviews(recentOrdersContainer, orders, reviews, placeholders, locale);
        });
      });
    }

    recentOrdersContainer.classList.remove('loading');
    recentOrdersContainer.appendChild(note);
  });

  block.appendChild(recentOrdersContainer);
}
