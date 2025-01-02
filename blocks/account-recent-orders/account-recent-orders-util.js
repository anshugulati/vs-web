/* eslint-disable max-len, camelcase */
import {
  formatDate,
  formatPrice,
  openModal,
  getProductAssetsData,
} from '../../scripts/scripts.js';
import { getConfigValue } from '../../scripts/configs.js';
import { getRMAsByOrderId, getRecentOrders } from '../../scripts/order/api.js';
import { performAPIMeshGraphQLQuery, productDetailsBySkuListQuery } from '../../scripts/commerce.js';

export const ORDER_STATUSES = {
  COMPLETE: ['COMPLETE'],
  PROCESSING: ['ACCEPTED',
    'CUSTOMER_CANCELLATION_INITIATED',
    'FAILED_DELIVERY',
    'IN_TRANSIT',
    'PAYMENT_SETTLED',
    'PENDING_PAYMENT',
    'PICKED',
    'RECEIVED_IN_OMS',
    'SENT_TO_OMS',
    'REMINDER_SENT',
    'STOCK_SHORTAGE',
    'STOCK_SHORTAGE_PARTIAL',
    'CANCELLED_STOCK_SHORTAGE_PARTIAL',
    'BACKORDER'],
  DELIVERED: ['DELIVERED'],
  COLLECTED: ['COLLECTED_BY_CUSTOMER'],
  REFUNDED: ['PARTIAL_REFUND'],
  REFUNDED_FULLY: ['COMPLETE_REFUND', 'CANCELLED_FAILED_DELIVERY'],
  RETURNED: ['COMPLETE_RETURN',
    'PARTIAL_RETURN'],
  CANCELLED: ['AUTO_CANCELED',
    'CUSTOMER_CANCELLED',
    'CANCELLED_STOCK_SHORT',
    'CUSTOMER_CANCELLATION_COMPLETE',
    'PAYMENT_GATEWAY_DECLINED',
    'SETTLEMENT_FAILED',
    'ORDER_PAYMENT_EXPIRED',
    'ORDER_EXPIRED_BENEFIT_PAY',
    'ORDER_CANCELED',
    'CANCELED'],
  DISPATCHED: ['DISPATCHED'],
  READY_TO_COLLECT: ['READY_TO_COLLECT'],
};

export function getOrderStatus(order) {
  if (ORDER_STATUSES.COMPLETE.includes(order.status.toUpperCase())) {
    return 'complete';
  } if (ORDER_STATUSES.PROCESSING.includes(order.status.toUpperCase())) {
    return 'processing';
  } if (ORDER_STATUSES.DELIVERED.includes(order.status.toUpperCase())) {
    return 'delivered';
  } if (ORDER_STATUSES.COLLECTED.includes(order.status.toUpperCase())) {
    return 'collected';
  } if (ORDER_STATUSES.REFUNDED.includes(order.status.toUpperCase())) {
    return 'refunded';
  } if (ORDER_STATUSES.REFUNDED_FULLY.includes(order.status.toUpperCase())) {
    return 'refunded-fully';
  } if (ORDER_STATUSES.RETURNED.includes(order.status.toUpperCase())) {
    return 'returned';
  } if (ORDER_STATUSES.CANCELLED.includes(order.status.toUpperCase())) {
    return 'cancelled';
  } if (ORDER_STATUSES.DISPATCHED.includes(order.status.toUpperCase())) {
    return 'dispatched';
  } if (ORDER_STATUSES.READY_TO_COLLECT.includes(order.status.toUpperCase())) {
    return 'ready to collect';
  }
  return 'unknown';
}

export const FREE_ITEM_PRICE = 0.01;

export const countryToTimeZone = {
  AE: { tz: 'Asia/Dubai', offset: '+04:00' },
  QA: { tz: 'Asia/Qatar', offset: '+03:00' },
  SA: { tz: 'Asia/Riyadh', offset: '+03:00' },
  KW: { tz: 'Asia/Kuwait', offset: '+03:00' },
  BH: { tz: 'Asia/Bahrain', offset: '+03:00' },
  OM: { tz: 'Asia/Muscat', offset: '+04:00' },
  JO: { tz: 'Asia/Amman', offset: '+03:00' },
  LB: { tz: 'Asia/Beirut', offset: '+02:00' },
  EG: { tz: 'Africa/Cairo', offset: '+02:00' },
};

export function convertToCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

async function getCountryCode() {
  return getConfigValue('country-code').then((value) => value || 'AE');
}

export async function getLocale() {
  const countryCode = await getCountryCode();
  return `${(document.documentElement.lang || 'en').toLowerCase()}_${countryCode.toUpperCase()}`;
}

function getCancelledOrderLineCount(item) {
  if (item?.extension_attributes?.qty_adjustments) {
    const { qty_stock_shortage: qty } = JSON.parse(item.extension_attributes.qty_adjustments);

    return qty || 0;
  }

  return 0;
}

export function getCancelledOrderCount(order) {
  return order.items
    .filter((item) => !item.parent_item_id && item?.extension_attributes?.qty_adjustments)
    .reduce((acc, item) => {
      let updatedQty = acc;
      updatedQty += getCancelledOrderLineCount(item);

      return updatedQty;
    }, 0);
}

export function getTotalItemsCount(order) {
  return order.items
    .filter((item) => !item.parent_item_id)
    .reduce((acc, item) => acc + item.qty_ordered, 0);
}

export async function numberOfOrders() {
  return getConfigValue('recent-order-count') || 3;
}

export async function getRecentOrdersUsingAPI(numberOfOrdersToDisplay) {
  return getRecentOrders(numberOfOrdersToDisplay || 3);
}

export function isRefundedFully(order) {
  return order.status === ORDER_STATUSES.REFUNDED.COMPLETE_REFUND;
}

export function getDeliveredItemsCount(item) {
  return item?.qty_ordered || 0;
}

export function getCancelledItemsCount(item, cancelDelivery = false) {
  if (item?.extension_attributes?.qty_adjustments) {
    const { qty_stock_shortage: qty } = JSON.parse(item.extension_attributes.qty_adjustments);

    return qty;
  }
  if (cancelDelivery) {
    return item?.qty_ordered || 0;
  }
  return 0;
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

export async function fetchProductDataForOrders(orders) {
  const isSimpleProduct = await getConfigValue('pdp-simple-product');
  const productSkuList = getProductSkuList(orders, isSimpleProduct);

  const { data: { products } } = await performAPIMeshGraphQLQuery(productDetailsBySkuListQuery, {
    sku: productSkuList,
  });

  return products;
}

export async function getProductImage(product) {
  let productTeaser;
  if (await getConfigValue('product-fetch-direct-attributes')) {
    productTeaser = getProductAssetsData('assets_teaser', product);
  } else {
    const productTeaserImages = product?.attributes.find((attr) => attr.name === 'assets_teaser')?.value;
    const assets = JSON.parse(productTeaserImages);
    if (assets.length > 0) {
      productTeaser = assets[0].styles.product_teaser;
    }
  }
  if (productTeaser) {
    const productSwatchImg = document.createElement('div');
    productSwatchImg.classList.add('swatch-img');
    const img = document.createElement('img');
    img.setAttribute('src', productTeaser);
    img.alt = product?.name || '';
    productSwatchImg.appendChild(img);

    return productSwatchImg;
  }
  return document.createDocumentFragment();
}

export function getOrderDeliveredItems(order) {
  return order.items
    .filter((item) => !item.parent_item_id)
    .filter((item) => (getCancelledOrderLineCount(item)) !== item.qty_ordered);
}

export function getOrderCancelledItems(order, rmaData, cancelDelivery = false) {
  return order.items
    .filter((item) => !item.parent_item_id)
    .filter((item) => {
      if (item?.extension_attributes?.qty_adjustments) {
        const { qty_stock_shortage: qty } = JSON.parse(item.extension_attributes.qty_adjustments);

        return qty > 0;
      }
      // If there are refunded items, they may have been cancelled
      if (cancelDelivery && item.qty_refunded > 0) {
        const rmaQuantity = rmaData?.items
          ?.filter((rmaItem) => rmaItem.order_item_id === item.item_id)
          .reduce((acc, rmaItem) => acc + rmaItem.qty_requested, 0);
        if (rmaQuantity < item.qty_refunded) {
          return true;
        }
      }
      return false;
    });
}

export function getOrderRefundedItems(order) {
  if (order.items.some((item) => item?.extension_attributes?.qty_adjustments)) {
    return null;
  }

  return order.items
    .filter((item) => !item.parent_item_id)
    .filter((item) => item.qty_ordered > 0 && item.qty_refunded > 0);
}

export function getOrderItems(order, isCancelled = false) {
  if (isCancelled) {
    return getOrderCancelledItems(order);
  }

  if (order?.state === 'closed') {
    return getOrderRefundedItems(order);
  }

  return getOrderDeliveredItems(order);
}

function isReturnEligible(order) {
  return order?.extension_attributes?.is_return_eligible === 1;
}

export const getReturnEligibleItems = (order) => order.items
  .filter((item) => !item.parent_item_id)
  .filter((item) => item.qty_ordered && (item.qty_ordered - item.qty_refunded > 0)
    && !item?.extension_attributes?.qty_adjustments);

function getCountryTimeZone(countryCode) {
  return countryToTimeZone[countryCode.toUpperCase().trim()].offset || '+04:00';
}

export function getReturnExpirationDate(order) {
  return order?.extension_attributes?.return_expiration;
}

function isInReturnWindow(order, countryCode) {
  const returnExpirationDate = getReturnExpirationDate(order);

  if (!returnExpirationDate) {
    return false;
  }

  const returnDate = new Date(`${returnExpirationDate} 00:00:00${getCountryTimeZone(countryCode)}`);

  returnDate.setDate(returnDate.getDate() + 1);

  const now = new Date();

  return returnDate > now;
}

function isReturnInStoreEligible() {
  return true;
}
/**
 * Returns if the return is requested for an order
 * @param {Object} rmaData The RMA return object
 * @returns Boolean
 */
export async function isReturnRequested(rmaData) {
  if (!rmaData) {
    return false;
  }

  if (rmaData?.total_count === 0) {
    return false;
  }

  // If there are items in the RMA object &
  // all the items in the RMA data is in closed state,
  // means there are items requested for return state
  const isAllRmasClosed = rmaData?.items.every(
    (item) => item.status === 'closed' || item.status === 'processed_closed',
  );

  if (isAllRmasClosed) {
    return false;
  }

  return true;
}

function getRefundPendingItemsCount(order) {
  return order.items
    .filter((item) => !item.parent_item_id)
    .reduce((acc, item) => acc + item.qty_refunded, 0);
}

export function getDiscountPercentage(originalPrice, finalPrice) {
  const discountAmount = originalPrice - finalPrice;
  const discountPercentage = (discountAmount / originalPrice) * 100;
  return Math.round(discountPercentage);
}

export function isClickAndCollect(order) {
  return order?.extension_attributes?.shipping_assignments?.some((shipping_assignments) => (shipping_assignments.shipping?.extension_attributes?.click_and_collect_type === 'reserve_and_collect' || shipping_assignments.shipping?.extension_attributes?.click_and_collect_type === 'ship_to_store'));
}

export async function decorateOrderReturnDetails(orderReturn, order, placeholders, locale) {
  const isReturnable = isReturnEligible(order);
  const countryCode = await getConfigValue('country-code');
  const inReturnWindow = isInReturnWindow(order, countryCode);
  const returnInStoreEligible = isReturnInStoreEligible(order);
  const orderReturnDate = formatDate(getReturnExpirationDate(order), locale);
  const storeLink = `/${document.documentElement.lang || 'en'}/store-finder`;
  const returnLink = `/${document.documentElement.lang || 'en'}/user/account/orders/return?orderId=`;

  if (isReturnable && inReturnWindow) {
    const rmaData = await getRMAsByOrderId(order.entity_id);
    const returnRequested = await isReturnRequested(rmaData);
    const isClickAndCollectOrder = isClickAndCollect(order);

    const onlineReturnText = placeholders.orderReturnOnline || 'You have until {{date}} to return the items';
    const onlineReturnTextRequested = placeholders.orderReturnOnlineRequested || 'Eligible for return until {{date}}.';
    let onlineReturnTextRequestedMsg = '';

    if (!isClickAndCollectOrder) {
      const onlineReturnWrapper = document.createElement('div');
      onlineReturnWrapper.classList.add('order-return-online');

      const returnWrapperLeftContent = document.createElement('div');
      returnWrapperLeftContent.classList.add('order-return-left-flexwrapper');
      onlineReturnWrapper.appendChild(returnWrapperLeftContent);

      orderReturn.appendChild(onlineReturnWrapper);

      const orderReturnIcon = document.createElement('span');
      orderReturnIcon.classList.add('icon', 'icon-delivery-return');
      returnWrapperLeftContent.appendChild(orderReturnIcon);

      const orderReturnLabel = document.createElement('span');
      orderReturnLabel.classList.add('order-return-text');

      const orderReturnLabelMsg = document.createElement('span');
      orderReturnLabelMsg.classList.add('order-return-text-msg');

      if (returnRequested) {
        orderReturnLabel.textContent = onlineReturnTextRequested.replace('{{date}}', orderReturnDate);

        onlineReturnTextRequestedMsg = placeholders.orderReturnOnlineRequestedMsg || 'Online returns can be placed once existing returns are processed.';
        orderReturnLabelMsg.innerText = onlineReturnTextRequestedMsg;
      } else {
        orderReturnLabel.textContent = onlineReturnText.replace('{{date}}', orderReturnDate);
      }

      const orderReturnInnerWrapper = document.createElement('div');
      orderReturnInnerWrapper.appendChild(orderReturnLabel);
      orderReturnInnerWrapper.appendChild(orderReturnLabelMsg);

      if (!returnRequested && getReturnEligibleItems(order)?.length > 0) {
        const orderReturnButton = document.createElement('a');
        orderReturnButton.classList.add('order-return-button', 'button', 'secondary');
        orderReturnButton.textContent = placeholders.orderReturnOnlineButton || 'Return Items Online';
        orderReturnButton.href = `${returnLink}${order.increment_id}`;

        orderReturnInnerWrapper.appendChild(orderReturnButton);
      }

      returnWrapperLeftContent.appendChild(orderReturnInnerWrapper);
    }

    if (returnInStoreEligible) {
      const orderReturnStoreText = placeholders.orderReturnInStore || 'or return directly in a store';
      const orderReturnStoreReturnText = placeholders.orderReturnOnline || 'you have until {{date}} to return the items';
      const orderReturnStoreCnCText = placeholders.orderReturnInStoreClickCollect || '(CLICK & COLLECT orders can only be returned at stores)';
      const orderReturnStoreSearch = placeholders.orderReturnStoreSearch || 'Search for a nearby store';

      const orderReturnStore = document.createElement('div');
      orderReturnStore.classList.add('order-return-store');

      if (isClickAndCollectOrder) {
        orderReturnStore.classList.add('order-cnc');
        orderReturnStore.innerHTML = `
                    <div class="order-return-left-flexwrapper">
                    <span class="icon icon-delivery-return"></span>
                    <div>
                    <span>${orderReturnStoreReturnText.replace('{{date}}', orderReturnDate)}</span>
                    <span>${orderReturnStoreCnCText}</span>
                    </div>
                    </div>
                    <div class="order-return-right-flexwrapper">
                    <span>${orderReturnStoreSearch}</span>
                     <a href="${storeLink}">${placeholders.orderReturnInStoreButton || 'Find a store'}</a>
                    </div>`;
      } else {
        orderReturnStore.innerHTML = `
                    <span>${orderReturnStoreText}</span>
                    <a href="${storeLink}">${placeholders.orderReturnInStoreButton || 'Find a store'}</a>`;
      }

      orderReturn.appendChild(orderReturnStore);
    }
    orderReturn.classList.remove('hide');
  } else if (isReturnable && getReturnEligibleItems(order)?.length > 0) {
    const onlineReturnWrapper = document.createElement('div');
    orderReturn.classList.add('order-return-online', 'out-of-return-window');

    orderReturn.appendChild(onlineReturnWrapper);

    const orderReturnIcon = document.createElement('span');
    orderReturnIcon.classList.add('icon', 'icon-delivery-return');
    onlineReturnWrapper.appendChild(orderReturnIcon);

    const orderReturnClosedText = placeholders.orderReturnWindowClosed || 'Return window closed on {{date}}';

    const orderReturnLabel = document.createElement('span');
    orderReturnLabel.classList.add('order-return-text');
    orderReturnLabel.textContent = orderReturnClosedText.replace('{{date}}', orderReturnDate);
    onlineReturnWrapper.appendChild(orderReturnLabel);

    orderReturn.classList.remove('hide');
  }
}

function decorateOrderItems(parent, order, productData, placeholders, locale, isSimpleProduct, isCancelled = false) {
  const orderItems = getOrderItems(order, isCancelled);

  if (orderItems.length === 0) {
    return;
  }
  const orderItemsList = document.createElement('div');
  orderItemsList.classList.add('order-items-wrapper', isCancelled ? 'order-items-cancelled' : 'order-items-delivered');
  const {
    orderDetailsCancelled, orderDetailsDelivered,
  } = placeholders;

  parent.appendChild(orderItemsList);

  const orderItemsHeader = document.createElement('div');
  orderItemsHeader.classList.add('order-items-header');

  const orderItemsDesc = document.createElement('h5');
  orderItemsDesc.classList.add('order-items-desc');
  orderItemsDesc.textContent = isCancelled ? orderDetailsCancelled || 'Cancelled Items' : orderDetailsDelivered || 'Delivered Items';

  orderItemsHeader.appendChild(orderItemsDesc);

  orderItemsList.appendChild(orderItemsHeader);

  if (isCancelled && getRefundPendingItemsCount(order) > 0) {
    const refundNote = document.createElement('div');
    refundNote.classList.add('refund-note');
    refundNote.textContent = placeholders.orderItemsRefundNote || 'The refund for the cancelled items will be made to your account within 14 working days if you have paid for your order.';
    orderItemsList.appendChild(refundNote);
  }

  orderItems.forEach(async (item) => {
    const itemSku = isSimpleProduct === 'true' ? item?.sku : item.extension_attributes?.parent_product_sku;
    const product = productData?.find((p) => p.sku === itemSku);
    const orderItem = document.createElement('div');
    orderItem.classList.add('order-item');

    const orderItemImage = document.createElement('div');
    orderItemImage.classList.add('order-item-image');

    const orderItemImg = await getProductImage(product);

    orderItemImage.appendChild(orderItemImg);

    const orderItemInfo = document.createElement('div');
    orderItemInfo.classList.add('order-item-info');

    const recentOrderBrandFullNameValue = item.extension_attributes?.brand_full_name;

    if (recentOrderBrandFullNameValue) {
      const recentOrderBrandFullNameSpan = document.createElement('span');
      recentOrderBrandFullNameSpan.classList.add('order-item-brand', 'order-brand-label');
      recentOrderBrandFullNameSpan.textContent = recentOrderBrandFullNameValue;
      orderItemInfo.appendChild(recentOrderBrandFullNameSpan);
    }

    const orderItemName = document.createElement('span');
    orderItemName.classList.add('order-item-name', 'order-detail-value');
    orderItemName.textContent = item.name;

    orderItemInfo.appendChild(orderItemName);

    const orderItemSku = document.createElement('span');
    orderItemSku.classList.add('order-item-sku', 'order-detail-label');
    orderItemSku.textContent = `${placeholders?.orderItemCode || 'Item Code'}: ${item.sku}`;

    orderItemInfo.appendChild(orderItemSku);

    const orderItemQuantityMessage = placeholders.orderItemQuantity || 'Quantity: {{}}';

    const orderItemQuantity = document.createElement('span');
    orderItemQuantity.classList.add('order-item-quantity', 'order-detail-label');
    orderItemQuantity.textContent = `${orderItemQuantityMessage.replace('{{}}', (isCancelled ? getCancelledItemsCount(item) : getDeliveredItemsCount(item)))}`;

    orderItemInfo.appendChild(orderItemQuantity);

    const orderItemAmount = document.createElement('div');
    orderItemAmount.classList.add('order-item-amount');

    const orderItemPriceLabel = document.createElement('span');
    orderItemPriceLabel.classList.add('order-item-price-label', 'order-detail-label');
    orderItemPriceLabel.textContent = placeholders.unitPrice || 'Unit Price';

    orderItemAmount.appendChild(orderItemPriceLabel);

    const orderItemPrice = document.createElement('span');
    orderItemPrice.classList.add('order-item-price', 'order-detail-value');

    // Set price or set as free if price is 0.01
    orderItemPrice.textContent = item.price_incl_tax === FREE_ITEM_PRICE ? placeholders.orderPriceFree ?? 'Free' : await formatPrice(order.order_currency_code, item.price_incl_tax);

    orderItemAmount.appendChild(orderItemPrice);

    const orderItemReview = document.createElement('div');
    orderItemReview.classList.add('order-item-review');
    orderItemReview.dataset.productId = product?.sku;
    orderItemReview.dataset.productName = product?.name;
    orderItemReview.innerHTML = `
              <button class="order-item-review-button"><span>${placeholders.orderItemWriteReview || 'Write a Review'}</span></button>`;

    const productImage = orderItemImage.querySelector('img');
    orderItemReview.querySelector('button').addEventListener('click', (e) => {
      e.preventDefault();
      e.target.classList.add('loader');
      import('../product-details/slots/write-review.js').then((module) => {
        module.default({
          sku: product?.sku,
          name: product?.name,
          images: [{
            url: `${productImage?.getAttribute('src') || ''}`,
          }],
        }, null, placeholders, locale, true).then(() => {
          openModal('write-ratings-dialog');
          e.target.classList.remove('loader');
        });
      });
    });
    orderItem.appendChild(orderItemImage);
    orderItem.appendChild(orderItemInfo);
    orderItem.appendChild(orderItemAmount);
    if (!isCancelled) {
      orderItem.appendChild(orderItemReview);
    }
    orderItemsList.appendChild(orderItem);
  });
}

export async function decorateOrderDetails(parent, order, productData, placeholders, locale) {
  const orderItemsList = document.createElement('div');
  orderItemsList.classList.add('order-details-wrapper', 'hide');

  const orderReturn = document.createElement('div');
  orderReturn.classList.add('order-return', 'hide');

  orderItemsList.appendChild(orderReturn);

  await decorateOrderReturnDetails(orderReturn, order, placeholders, locale);

  const lang = document.documentElement.lang || 'en';
  const viewDetailsLink = `/${lang}/user/account/orders/details?orderId=`;
  const isSimpleProduct = await getConfigValue('pdp-simple-product');
  decorateOrderItems(orderItemsList, order, productData, placeholders, locale, isSimpleProduct, false);
  decorateOrderItems(orderItemsList, order, productData, placeholders, locale, isSimpleProduct, true);

  const orderItemsFooter = document.createElement('div');
  orderItemsFooter.classList.add('order-items-footer');

  orderItemsFooter.innerHTML = `
            <span class="order-items-footer-link">
                <a href="${viewDetailsLink}${order.increment_id}">${placeholders.orderDetailsViewOrders || 'View order details'}</a>
            </span>`;

  orderItemsList.appendChild(orderItemsFooter);

  parent.appendChild(orderItemsList);
}
