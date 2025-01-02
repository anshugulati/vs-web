import React, {
  useEffect, useState, useMemo, useContext,
} from 'react';
import CartContext from '../../../context/cart-context.jsx';
import getProducts from '../../../api/getProducts.js';
import PurchasedProduct from './product.jsx';
import useCurrencyFormatter from '../../../utils/hooks/useCurrencyFormatter.jsx';
import Tooltip from '../../../library/tooltip/tooltip.jsx';
import Icon from '../../../library/icon/icon.jsx';
import AppConstants from '../../../utils/app.constants.js';
import { fetchCommerceCategories } from '../../../../scripts/commerce.js';

function OrderConfirmationItemBillSummary({ orderInfo, content }) {
  const [productsData, setProductsData] = useState([]);
  const { placeholders, isLoggedIn, configs, selectedCollectionStoreForCheckout} = useContext(CartContext);
  const [isLoading, setisLoading] = useState(true);
  const [isEgiftPay, setIsEgiftPay] = useState(false);
  const [amountPaid, setAmountPaid] = useState(0);
  const customerOrderData = orderInfo;
  const completeProductData = customerOrderData?.items?.[0];
  const customerOrderItems = customerOrderData?.items?.[0]?.items || [];
  const orderSummaryVersionTwo = configs?.['oredr-confirmation-order-summary-v2'] === 'true';
  const enableSubTotalAfterDisvount = configs?.['enable-subtotal-after-discount'] === 'true';

  // Sort the items in the cart by id descending
  customerOrderItems.sort((a, b) => {
    return a.sku !== b.sku ? b.item_id - a.item_id : 0
  });
  const allProductsSkuId = customerOrderItems;
  const totalQuantity = customerOrderData?.items?.[0]?.total_qty_ordered;
  const orderSummaryCountTitle = content?.checkoutOrderSummaryTitle?.replace(
    '{{COUNT}}',
    totalQuantity,
  );
  const isTopupItem = productsData?.filter(item => item?.sku === AppConstants.GIFT_CARD_TOPUP)

  const checkMethod = customerOrderData?.items?.[0]?.extension_attributes?.shipping_assignments?.[0]?.shipping?.method;
  const findDeliveryType = typeof checkMethod === 'string'
    && checkMethod.includes('click_and_collect_click_and_collect');

  const methodsArray = content?.paymentMethods;
  const paymentMethodTitle = customerOrderData?.items?.[0]?.payment?.method;
  const methodsActualArray = methodsArray?.find(
    (item) => item.querySelectorAll('tr > td')?.[0]?.innerText === paymentMethodTitle,
  );
  const setPayMentTitle = methodsActualArray?.querySelectorAll('tr > td')[1].innerText;

  const isAllEgift = customerOrderData?.items?.[0]?.items?.every(d => d?.extension_attributes?.product_options?.[0]?.indexOf('hps_giftcard_recipient_email') != -1)

  const subtotal = useCurrencyFormatter({
    price: customerOrderData?.items?.[0]?.subtotal_incl_tax,
  });
  const formatDiscount = useCurrencyFormatter({
    price: customerOrderData?.items?.[0]?.discount_amount,
  });
  const discount = customerOrderData?.items?.[0]?.discount_amount;
  const grandTotal = customerOrderData?.items?.[0]?.base_grand_total;
  const orderTotal = useCurrencyFormatter({ price: grandTotal });
  const payWithEGiftCard = customerOrderData?.items?.[0]?.extension_attributes?.hps_redeemed_amount;
  const amountEGiftWithCurrency = useCurrencyFormatter({ price: payWithEGiftCard });
  const formatShippingAmount = useCurrencyFormatter({
    price: customerOrderData?.items?.[0]?.shipping_incl_tax,
  });
  const shippingAmount = customerOrderData?.items?.[0]?.shipping_incl_tax;
  const formatSurchargeIncTax = useCurrencyFormatter({
    price:
      customerOrderData?.items?.[0]?.extension_attributes?.surcharge_incl_tax,
  });
  const surchargeIncTax = customerOrderData?.items?.[0]?.extension_attributes?.surcharge_incl_tax;
  const method = customerOrderData?.items?.[0]?.extension_attributes
    ?.shipping_assignments?.[0]?.shipping?.method;
  const findClickAndCollect = typeof method === 'string'
    && method.includes('click_and_collect_click_and_collect');
  const appliedTaxes = customerOrderData?.items?.[0]?.extension_attributes?.applied_taxes ?? [];
  const taxesTotal = appliedTaxes.reduce(
    (acc, tax) => acc + (orderSummaryVersionTwo ? tax.amount : tax.amount.value ?? 0),
    0,
  );
  const paidByAuraPoints = customerOrderData?.items?.[0]?.extension_attributes?.aura_payment_value;
  const formatPaidByAuraPoints = useCurrencyFormatter({
    price: paidByAuraPoints,
  });
  const frmattedAmountPaid = useCurrencyFormatter({
    price: amountPaid,
  });
  const baseGrandTotal = customerOrderData?.items?.[0]?.base_grand_total;
  const balancePayable = Math.max(baseGrandTotal - paidByAuraPoints, 0);
  const formatBalancePayable = useCurrencyFormatter({ price: balancePayable });
  const codeServiceCharge = placeholders?.cashondeliveryServicechargeTooltiptext;
  const updatecodeServiceCharge = codeServiceCharge?.replace(
    '{{codcharge}}',
    formatSurchargeIncTax,
  );
  const voucherDiscount = customerOrderData?.items?.[0]?.extension_attributes?.hm_voucher_discount;
  const formatvoucherDiscount = useCurrencyFormatter({
    price: voucherDiscount,
  });
  const voucherCodes = customerOrderData?.items?.[0]?.extension_attributes
    ?.applied_hm_voucher_codes;
  const voucherCodeCount = voucherCodes?.split(',')?.length;
  const aplliedVoucherText = placeholders?.bounsVoucherCountTitle?.replace(
    '{{count}}',
    voucherCodeCount,
  );

  const subTotalAfterDiscount = customerOrderData?.items?.[0]?.subtotal_incl_tax + customerOrderData?.items?.[0]?.discount_amount;
  const formatSubTotalAfterDiscount = useCurrencyFormatter({ price: subTotalAfterDiscount});

  const discountToolTipContent = useMemo(() => {
    const extensionAttributes = customerOrderData?.items?.[0]?.extension_attributes;
    // const hasExclusiveCoupon = !!extensionAttributes?.has_exclusive_coupon;
    const hasHMOfferCode = !!extensionAttributes?.applied_hm_offer_code;
    // const couponCode = customerOrderData?.items?.[0]?.coupon_code ?? "";
    const hasAdvantageCard = customerOrderData?.items?.[0]?.coupon_code === 'advantage_card';
    let tooltipData = `<div className="applied-discounts-title">${placeholders.discountTooltipMessageApplied}</div>`;

    // if (hasExclusiveCoupon) {
    //   tooltipData += `<div className="applied-exclusive-couponcode">${couponCode}</div>`;
    //   return tooltipData;
    // }

    if (hasHMOfferCode) {
      tooltipData = `<div className="applied-hm-discounts-title">${placeholders.discountTooltipMessageMemberDiscount}</div>`;
    }

    if (hasAdvantageCard) {
      tooltipData += `<div class="promotion-label"><strong>${placeholders.discountTooltipMessageAdvantageCardDiscount}</strong></div>`;
    }

    return tooltipData;
  }, [customerOrderData]);

  const uniqueProducts = useMemo(() => {
    const uniqueItems = [];
    const seenSkuIds = new Set();
    allProductsSkuId.forEach((item) => {
      if (!seenSkuIds.has(item.sku) || (item?.is_virtual == 1)) {
        seenSkuIds.add(item.sku);
        const additionalData = item.additional_data ? JSON.parse(item.additional_data) : {};
        const memberPrice = additionalData?.member_price || null; //  member_price
        uniqueItems.push({
          ...item,
          member_price: memberPrice // Add member_price to the product object
        });
     }
    });

    return uniqueItems;
  }, [allProductsSkuId]);

  async function getItems(skuId) {
    try {
      const product = await getProducts(skuId);
      const data = product?.response?.data?.commerce_products?.items?.[0];

      if (data) {
        if (data?.assets_cart) {
          data.assets_cart = JSON.parse(data.assets_cart);
        }

        const matchingVariant = data?.variants?.find((item) => item?.product?.sku?.includes(skuId));

        if (matchingVariant) {
          if (matchingVariant?.product?.dynamicAttributes) {
            matchingVariant.product.dynamicAttributes = JSON.parse(
              matchingVariant.product.dynamicAttributes,
            );
          }

          data.variants = matchingVariant;
        }
      }
      return data;
    } catch (error) {
      console.error(`Error fetching product details for SKU ${skuId}:`, error);
      return null;
    }
  }

  useEffect(() => {
    const extAttr = customerOrderData?.items?.[0]?.extension_attributes;
    if (extAttr?.hps_redeemed_amount > 0) {
      setIsEgiftPay(true);
      setAmountPaid(grandTotal - extAttr.hps_redeemed_amount);
    } else {
      setIsEgiftPay(false);
      setAmountPaid(0);
    }

  }, [customerOrderData?.items?.[0]?.extension_attributes]);

  function findObjectWithTarget(obj, target) {
    let foundObject = null;

    Object.keys(obj).forEach((key) => {
      if (foundObject) return;

      if (obj[key] === target) {
        foundObject = obj;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        const result = findObjectWithTarget(obj[key], target);
        if (result) {
          foundObject = result;
        }
      }
    });

    return foundObject;
  }

  useEffect(() => {
    async function fetchAllProducts() {
      const allProductData = await Promise.all(
        uniqueProducts.map(async (product) => {
          const item = await getItems(product.sku);
          return item;
        }),
     );
      setProductsData(allProductData);

      const filteredProductData = allProductData.filter(item => item);
      setProductsData(filteredProductData);

      const items = await Promise.all(filteredProductData.map(async (item, index) => {
        const itemCategories = item?.gtm_attributes?.category?.split('/') || [];
        const selectedProductLocal = JSON.parse(localStorage.getItem('selectedProductLocal') || null);
        const insightsQueryId = selectedProductLocal?.[item?.gtm_attributes?.id]?.insightsQueryId || null;
        const gtmProductList = selectedProductLocal?.[item?.gtm_attributes?.id]?.gtmProductList || null;
        const { items } = await fetchCommerceCategories();
        const categoryData = findObjectWithTarget(items, itemCategories[0]);
        const memberPrice = uniqueProducts[index]?.member_price || null;
        const extensionData = uniqueProducts[index] || {};
        return {
          item_id: item?.gtm_attributes?.id,
          item_name: item?.gtm_attributes?.name,
          affiliation: 'Online Store',
          index,
          item_list_id: categoryData?.id || null,
          item_list_name: gtmProductList || null,
          item_brand: item?.variants?.product?.dynamicAttributes?.product_brand_gtm || item?.gtm_attributes?.brand,
          item_category: item?.gtm_attributes?.category,
          item_category2: itemCategories[0] || null,
          item_category3: itemCategories[1] || null,
          item_category4: itemCategories[2] || null,
          item_category5: itemCategories[3] || null,
          item_variant: item?.variants?.product?.sku,
          price: item?.variants?.product?.gtm_attributes?.price || item?.gtm_attributes?.price,
          item_color: item?.variants?.product?.dynamicAttributes?.color_gtm || item?.variants?.product?.color_label,
          item_size: item?.variants?.product?.dynamicAttributes?.size_gtm || item?.variants?.product?.dynamicAttributes?.size_label,
          returnEligibility: item?.variants?.product?.is_returnable === '1' ? 'yes' : 'no',
          quantity: extensionData?.qty_ordered || null,
          'data-insights-query-id': insightsQueryId || null,
          price_type: memberPrice ? 'member price yes' : 'member price no',
          bundle_type: item?.gtm_attributes?.dimension2 || null, //”simple” or “configurable” based on what kind of product it is.
          discount_type: item?.gtm_attributes?.dimension3 || null, //”Regular Product” or “Discounted Product” based on what kind of product it is.
          discount: item?.price_range?.maximum_price?.discount?.amount_off || null, //discount value
        };
      }));

      let loyaltyType = null;
      isLoggedIn
        ? customerOrderData?.items?.[0]?.extension_attributes?.apc_accrued_points > 0
          ? loyaltyType = 'aura'
          : loyaltyType = 'hello'
        : loyaltyType = null

      const paymentOptions = [];
      const rewardType = [];

      // check if cod is used
      customerOrderData?.items?.[0]?.payment?.method === 'cashondelivery' && paymentOptions.push('Cash On Delivery');

      // check if card is used
      customerOrderData?.items?.[0]?.payment?.method === 'checkout_com_upapi' && paymentOptions.push('Credit / Debit Card');

      // check if aura payment is used
      customerOrderData?.items?.[0]?.extension_attributes?.aura_payment_value && paymentOptions.push('Aura Payment');

      // check if egift card is used
      customerOrderData?.items?.[0]?.extension_attributes?.hps_redeemed_amount && paymentOptions.push('eGift Card');

      // claculate if eGift card used fully or partial
      const isTopup = !!customerOrderData?.items?.[0]?.extension_attributes?.topup_recipientemail;
      const isEgiftCard = isTopup
        ? 'topup'
        : customerOrderData?.items?.[0]?.extension_attributes?.hps_redeemed_amount
          ? Number(customerOrderData?.items?.[0]?.base_grand_total) - Number(customerOrderData?.items?.[0]?.extension_attributes?.hps_redeemed_amount) === 0
            ? 'full'
            : 'partial'
          : 'no';

      // check eGift card type value
      const hpsRedemptionVal = customerOrderData?.items?.[0]?.extension_attributes?.payment_additional_info?.find((el) => el.key === 'hps_redemption')?.value;
      const eGitCardRedeemType = hpsRedemptionVal
        ? JSON.parse(hpsRedemptionVal)?.card_type === 'linked'
          ? 'linked'
          : 'guest'
        : null;

      // check if offer is applied
      const hmoffer = customerOrderData?.items?.[0]?.extension_attributes?.applied_hm_offer_code;
      hmoffer && rewardType.push(hmoffer);

      // check if voucher is applied
      const hmvoucher = customerOrderData?.items?.[0]?.extension_attributes?.applied_hm_voucher_codes;
      hmvoucher && rewardType.push(hmvoucher);

      // check if coupon is applied
      const hmcoupon = customerOrderData?.items?.[0]?.coupon_code;
      hmcoupon && rewardType.push(hmcoupon);

      window.dispatchEvent(
        new CustomEvent('react:datalayerEvent', {
          detail: {
            type: 'sendAuraDetails',
            payload: {
              aura_tier: null,
              aura_enrollmentStatus: null,
              aura_Status: null,
              aura_balStatus: null,
            }
          }
        }
        ));

      window.dispatchEvent(
        new CustomEvent('react:datalayerEvent', {
          detail: {
            type: 'GenericDLPurchaseSpecific',
            payload: {
              loyaltyType: loyaltyType || null,
              aura_balRedemption: Number(customerOrderData?.items?.[0]?.extension_attributes?.apc_redeemed_points) > 0 ? 'redeemed' : 'not redeemed',
              aura_pointsUsed: Number(customerOrderData?.items?.[0]?.extension_attributes?.apc_redeemed_points),
              aura_pointsEarned: Number(customerOrderData?.items?.[0]?.extension_attributes?.apc_accrued_points),
              cartTotalValue: Number(customerOrderData?.items?.[0]?.base_grand_total),
              cartItemsCount: Number(customerOrderData?.items?.[0]?.total_qty_ordered),
              deliveryOption: findDeliveryType ? 'Click & Collect' : 'Home Delivery',
              deliveryType: customerOrderData?.items?.[0]?.shipping_description,
              deliveryCity: customerOrderData?.items?.[0]?.extension_attributes?.shipping_assignments?.[0]?.shipping?.address?.city,
              deliveryArea: customerOrderData?.items?.[0]?.extension_attributes?.shipping_assignments?.[0]?.shipping?.address?.street?.[0],
              paymentOption: paymentOptions.join(),
              isEgiftCard: isEgiftCard,
              redeem_egift_card_value: customerOrderData?.items?.[0]?.extension_attributes?.hps_redeemed_amount,
              egift_redeem_type: eGitCardRedeemType,
              member_offerType: rewardType.join('_'),
              with_delivery_schedule: 'no',
              isAdvantageCard: customerOrderData?.items?.[0]?.coupon_code === 'advantage_card' ? 'True' : 'False',
              is_physical_egiftcard: customerOrderData?.items?.[0]?.extension_attributes?.is_physical_egc_redeemed === 1 ? 'yes' : 'no'
            },
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent('react:datalayerEvent', {
          detail: {
            type: 'PurchaseView',
            payload: {
              discountAmount: customerOrderData?.items?.[0]?.discount_amount,
              currency: customerOrderData?.items?.[0]?.base_currency_code,
              transaction_id: customerOrderData?.items?.[0]?.increment_id,
              value: customerOrderData?.items?.[0]?.base_grand_total,
              tax: taxesTotal,
              shipping: shippingAmount,
              shipping_tier: findDeliveryType ? 'Click & Collect' : 'Home Delivery',
              login_method: isLoggedIn ? 'Logged In' : 'Guest Login',
              coupon: customerOrderData?.items?.[0]?.coupon_code || null,
              payment_type: paymentOptions.join(),
              delivery_option: findDeliveryType ? 'Click & Collect' : 'Home Delivery',
              loyaltyType: loyaltyType || null,
              member_offerType: customerOrderData?.items?.[0]?.extension_attributes?.applied_hm_offer_code || '',
              storeLocation: selectedCollectionStoreForCheckout?.address?.find(item => item?.code === 'street')?.value || null,
              items,
            },
          },
        }),
      );

      setisLoading(false);
    }

    fetchAllProducts();
  }, [uniqueProducts]);

  return (
    <div>
      <span className="orderSummaryCountTitle">{orderSummaryCountTitle}</span>
      <div
        className={`confirmed-order-items-list ${isLoading ? 'ordersectionheight' : ''}`}
      >
        {productsData.map((product, index) => (
          <PurchasedProduct
            key={`item-${product?.sku}-${index}`}
            product={product}
            index={index}
            uniqueProducts={uniqueProducts}
            completeOrderData={completeProductData}
          />
        ))}
      </div>
      <div className="confirmed-order-summary">
      {orderSummaryVersionTwo && <div className='order-summary-two-title'>{placeholders.orderSummaryTitle}</div>}
        {subtotal && (
          <div className="complete-bill-line">
            <span>{placeholders?.subTotalLabel}</span>
            <span>{subtotal}</span>
          </div>
        )}
        {discount !== 0 && (
          <div className="complete-bill-line discount-color">
            <span>
              {placeholders?.discountsLabel}
             {!orderSummaryVersionTwo && <Tooltip content={discountToolTipContent}>
                <Icon name="info-blue" className="discount-icon" />
              </Tooltip>}
            </span>
            <span>{formatDiscount}</span>
          </div>
        )}
        {voucherCodeCount > 0 && (
          <div className="complete-bill-line">
            <span>{aplliedVoucherText}</span>
            <span>{formatvoucherDiscount}</span>
          </div>
        )}
        {!findClickAndCollect && !isTopupItem?.length && !isAllEgift && (
          <div className="complete-bill-line">
            <span>{placeholders?.deliveryLabel}</span>
            <span>
              {shippingAmount > 0
                ? formatShippingAmount
                : placeholders?.shippingMethodFreeLabel}
            </span>
          </div>
        )}
        {surchargeIncTax !== 0 && (
          <div className="complete-bill-line">
            <span>
              {placeholders?.cashOnDeliveryLabel}
             {!orderSummaryVersionTwo && <Tooltip content={updatecodeServiceCharge}>
                <Icon name="info-blue" className="discount-icon" />
              </Tooltip>}
            </span>
            <span>{formatSurchargeIncTax}</span>
          </div>
        )}
        {enableSubTotalAfterDisvount && formatSubTotalAfterDiscount &&  (
        <div className="complete-bill-line sub-total-after-discount">
          <span>{placeholders?.subTotalAfterDiscountText}</span>
          <span>{formatSubTotalAfterDiscount}</span>
        </div>
        )}
        {orderTotal && (
          <div className="complete-bill-line order-total">
            <span>{placeholders?.orderTotalLabel}</span>
            <span>{orderTotal}</span>
          </div>
        )}

        {isEgiftPay && (
          <>
            <div className="complete-bill-line egift-redeem">
              <span className="egift-redeem__label">{placeholders.redeemPayOrderSummary}</span>
              <span> {amountEGiftWithCurrency} </span>
            </div>

            <div className="complete-bill-line total-amount-paid">
              <span className="egift-redeem__label">{placeholders.amountpaid}</span>
              <span> {frmattedAmountPaid} </span>
            </div>
          </>
        )}

        <div className="complete-bill-line deliveryandvats">
          {!checkMethod && <span className="">{placeholders.excludingDelivery}</span>}
          {taxesTotal > 0 && <span>{placeholders.inclusiveVat}</span>}
        </div>
        {paidByAuraPoints > 0 && (
          <div className="complete-bill-line">
            <span>{placeholders?.paidWithAuraLabel}</span>
            <span>{formatPaidByAuraPoints}</span>
          </div>
        )}
        {paidByAuraPoints > 0 && (
          <>
            <div className="complete-bill-line balancepayable">
              <span>{placeholders?.amountpaid}</span>
              <span>{formatBalancePayable}</span>
            </div>
            <div className="complete-bill-line deliveryandvats aurapointsvat">
              {!checkMethod && <span className="">{placeholders.excludingDelivery}</span>}
              {taxesTotal > 0 && <span>{placeholders.inclusiveVat}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OrderConfirmationItemBillSummary;