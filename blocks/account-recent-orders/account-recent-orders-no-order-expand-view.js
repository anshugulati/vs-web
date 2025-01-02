/* eslint-disable max-len */
import {
  fetchPlaceholdersForLocale, formatPrice,
} from '../../scripts/scripts.js';
import { decorateIcons } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import {
  getOrderStatus, convertToCamelCase,
  getCancelledOrderCount, countryToTimeZone,
  getTotalItemsCount, numberOfOrders,
  isRefundedFully, decorateOrderDetails, getLocale,
  fetchProductDataForOrders, getRecentOrdersUsingAPI,
} from './account-recent-orders-util.js';

function getOrdinalSuffix(day) {
  const lang = document.documentElement.lang || 'en';
  let suffixes = ['th', 'st', 'nd', 'rd'];
  if (lang === 'ar') {
    suffixes = ['ي', 'ا', 'ث', 'ث'];
  }
  const remainder = day % 10;
  const isTeen = ((day % 100) - remainder) === 10;
  const isValidRemainder = remainder < 4;
  const suffix = suffixes[!isTeen && isValidRemainder ? remainder : 0];
  return `${day}${suffix}`;
}

export async function formatDateTime(dateString, locale) {
  let newLocale = locale;
  if (locale?.includes('_')) {
    newLocale = locale.replaceAll('_', '-');
  }

  const date = new Date(`${dateString}+0000`);
  const countryCode = await getConfigValue('country-code');
  const timeZone = countryToTimeZone[countryCode].tz;

  const dateOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
    numberingSystem: 'latn',
  };

  const timeOptions = {
    timeZone,
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn',
  };

  const formattedDate = new Intl.DateTimeFormat(newLocale, dateOptions).format(date);
  const formattedTime = new Intl.DateTimeFormat(newLocale, timeOptions).format(date);

  const day = date.getDate();
  const dayWithSuffix = getOrdinalSuffix(day);

  return `${formattedDate.replace(day, dayWithSuffix)}, ${formattedTime}`;
}

async function decorateRecentOrders(recentOrdersContainer, orders, productData, placeholders, locale) {
  const lang = document.documentElement.lang || 'en';
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

    const orderDate = document.createElement('div');
    orderDate.classList.add('order-date', 'order-header');

    const orderDateLabel = document.createElement('span');
    orderDateLabel.classList.add('order-date', 'order-detail-label');
    orderDateLabel.textContent = placeholders.orderDate || 'Order Date';

    orderDate.appendChild(orderDateLabel);

    const orderDateText = document.createElement('span');
    orderDateText.classList.add('order-date', 'order-detail-value');
    formatDateTime(order.created_at, locale).then((formattedDate) => {
      orderDateText.textContent = formattedDate;
    });

    orderDate.appendChild(orderDateText);

    const orderTotal = document.createElement('div');
    orderTotal.classList.add('order-total-items', 'order-header');

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

    const orderTotalItems = document.createElement('div');
    orderTotalItems.classList.add('order-total-items', 'order-header');

    const orderTotalItemsLabel = document.createElement('span');
    orderTotalItemsLabel.classList.add('order-total-items', 'order-detail-label');
    orderTotalItemsLabel.textContent = placeholders.TotalOrderItems || 'Total Order Items';

    orderTotalItems.appendChild(orderTotalItemsLabel);

    const orderTotalItemsValue = document.createElement('span');
    orderTotalItemsValue.classList.add('order-total-items', 'order-detail-value');
    orderTotalItemsValue.textContent = getTotalItemsCount(order);

    orderTotalItems.appendChild(orderTotalItemsValue);

    const cancelledItems = getCancelledOrderCount(order);
    if (cancelledItems > 0) {
      const orderCancelledItemsMessage = placeholders.orderItemsCancelled || 'Cancelled: {{}} items';

      const orderItemsCancelled = document.createElement('span');
      orderItemsCancelled.classList.add('order-items-cancelled', 'order-detail-label');
      orderItemsCancelled.innerHTML = `<a href="#">${orderCancelledItemsMessage.replace('{{}}', cancelledItems)}</a>`;
      orderTotalItems.appendChild(orderItemsCancelled);

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

    const orderDetail = document.createElement('div');
    orderDetail.classList.add('order-detail');

    const orderDetailLink = document.createElement('a');
    orderDetailLink.classList.add('order-detail-link');
    const viewDetailsLink = `/${lang}/user/account/orders/details?orderId=`;
    orderDetailLink.href = `${viewDetailsLink}${order.entity_id}`;

    orderDetailLink.innerHTML = `
            <span class="icon icon-chevron-right-black"></span>`;

    orderDetail.appendChild(orderDetailLink);

    orderSummary.appendChild(orderNumber);
    orderSummary.appendChild(orderDate);
    orderSummary.appendChild(orderTotal);
    orderSummary.appendChild(orderTotalItems);
    orderSummary.appendChild(orderStatus);
    orderSummary.appendChild(orderDetail);

    orderItem.appendChild(orderSummary);

    decorateOrderDetails(orderItem, order, productData, placeholders, locale);

    recentOrdersList.appendChild(orderItem);
  });
  recentOrdersContainer.appendChild(recentOrdersList);
  decorateIcons(recentOrdersList);
}

export default async function decorateAccountOrdersWihtoutOrderExpandedView(block) {
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
    } else {
      if (successTitleWrapper) {
        successTitleWrapper.classList.add('hidden');
      }
      if (note) {
        note.classList.add('hidden');
      }
    }

    recentOrdersContainer.classList.remove('loading');
    recentOrdersContainer.appendChild(note);
  });

  block.appendChild(recentOrdersContainer);
}
