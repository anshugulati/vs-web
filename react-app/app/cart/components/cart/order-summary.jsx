import React, { useContext, useMemo, useState } from 'react';
import CartContext from '../../../../context/cart-context.jsx';
import CardPaymentOptions from '../cart-payment-method/card-payment-options.jsx';
import updateCart from '../../../../api/updateCart.js';
import useCurrencyFormatter from '../../../../utils/hooks/useCurrencyFormatter.jsx';
import Tooltip from '../../../../library/tooltip/tooltip.jsx';
import Icon from '../../../../library/icon/icon.jsx';
import Loader from '../../../../shared/loader/loader.jsx';
import { removeRedeemCardRedemptionOnCartUpdate } from '../../../../api/removeRedeemCardRedemption';
import BNPLComponent from './bnpl-component/bnpl.jsx';

function OrderSummary({ cardMethodTitle, paymentLogoList }) {
  const [isLoading, setIsLoading] = useState(false);
  const [openBreakdown, setOpenBreakdown] = useState(false);
  const {
    cart, configs, placeholders, priceDecimals, isLoggedIn, oosDisableButton, cartId, setIsCheckoutFlag, setCart, shouldEnableProductCardV2, shouldEnableCartOrderSummaryV2
  } = useContext(CartContext);
  const enableOrderSummaryV2 = configs['cart-enable-order-summary-v2'] === 'true';
  const freeShippingText = cart?.data.extension_attributes.cart.extension_attributes?.free_shipping_text;
  const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
  const deliveryAmountFee = cart?.data?.extension_attributes?.totals?.shipping_incl_tax;
  const deliveryFeeValue = useCurrencyFormatter({ price: deliveryAmountFee, priceDecimals, currency: grandTotalCurrency });
  const deliveryMethodSelected = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.method;
  const total = cart?.data?.prices?.grand_total?.value ?? 0;
  const grandTotal = total;
  const subtotalIncludingTax = cart?.data?.prices?.subtotal_including_tax?.value ?? 0;
  const subtotalWithDiscountInclTax = cart?.data?.extension_attributes?.totals?.total_segments?.find(item => item.code === 'subtotal_with_discount_incl_tax');
  const redirectUrlCheckout = `/${document.documentElement.lang}/checkout`;
  const redirectUrlLogin = `/${document.documentElement.lang}/cart/login`;
  const appliedTaxes = cart?.data?.prices?.applied_taxes ?? [];
  const taxesTotal = appliedTaxes.reduce((acc, tax) => acc + (tax.amount.value ?? 0), 0);

  const totalDiscountAmount = cart?.data?.prices?.discount?.amount?.value;
  const bonusVoucherDiscount = cart?.data?.extension_attributes?.cart?.extension_attributes?.hm_voucher_discount;
  const appliedVoucherCount = cart?.data?.extension_attributes?.cart?.extension_attributes?.applied_hm_voucher_codes?.split(',')?.length ?? 0;

  const auraPrice = cart?.data?.extension_attributes?.cart?.extension_attributes?.member_price_discount;
  const auraDiscount = cart?.data?.extension_attributes?.cart?.extension_attributes?.aura_promotion_discount;

  const showErrorMessage = (errorMessage) => {
    if (errorMessage) {
      window.dispatchEvent(new CustomEvent('react:showPageErrorMessage', {
        detail: {
          message: errorMessage,
        },
      }));
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  const handleCheckoutPage = async () => {
    window.dispatchEvent(new CustomEvent('react:resetPageMessage'));
    setIsLoading(true);
    const body = {
      extension: { action: 'refresh' },
    };

    const result = await updateCart(body, cartId, isLoggedIn, true);
    if (result?.status !== 200 && result?.message) { // response will have a error
      showErrorMessage(result.message);
      setIsLoading(false);
      return;
    }

    await removeRedeemCardRedemptionOnCartUpdate(cart, isLoggedIn);
    const response = result?.data;

    const responseCart = response?.cart?.items;
    const currentCartItems = cart?.data?.extension_attributes?.cart?.items;
    const updateCartItems = currentCartItems?.map((items) => {
      const findProduct = responseCart?.find((element) => items?.sku === element?.sku);
      if (findProduct && Object.keys(findProduct)?.length) {
        return {
          ...items,
          extension_attributes: findProduct?.extension_attributes,
        };
      }
      return items;
    });
    if (response?.response_message[1] === 'success') {
      setIsCheckoutFlag(true);
      setIsLoading(true);
      if (isLoggedIn) {
        window.location.href = redirectUrlCheckout;
      } else {
        window.location.href = redirectUrlLogin;
      }
    } else {
      setIsCheckoutFlag(false);
      setCart({
        ...cart,
        data: {
          ...cart?.data,
          extension_attributes: {
            ...cart?.data?.extension_attributes,
            cart: {
              ...cart?.data?.extension_attributes?.cart,
              items: updateCartItems,
            },
          },
          items: cart?.data?.items?.map((item) => {
            const currentExtensionAttributes = updateCartItems?.find((element) => Number(item?.id) === Number(element?.item_id));
            if (Object?.keys(currentExtensionAttributes)?.length) {
              return {
                ...item,
                extensionAttributes: currentExtensionAttributes,
              };
            }
            return {
              ...item,
            };
          }),
        },
      });
      setIsLoading(false);
    }
  };
  const surCharge = cart?.data?.extension_attributes?.cart?.extension_attributes?.surcharge;
  const subtotalIncludingTaxFormatted = useCurrencyFormatter({ price: subtotalIncludingTax, priceDecimals, currency: grandTotalCurrency });
  const totalDiscountAmountFormatted = useCurrencyFormatter({ price: totalDiscountAmount, priceDecimals, currency: grandTotalCurrency });
  const auraPriceFormatted = useCurrencyFormatter({ price: auraPrice, priceDecimals, currency: grandTotalCurrency });
  const auraDiscountFormatted = useCurrencyFormatter({ price: auraDiscount, priceDecimals, currency: grandTotalCurrency });
  const subtotalWithDiscountInclTaxFormatted = useCurrencyFormatter({ price: subtotalWithDiscountInclTax?.value ?? 0, priceDecimals, currency: grandTotalCurrency });
  const grandTotalWithoutCharge = grandTotal - (surCharge?.is_applied && surCharge?.amount > 0 ? surCharge?.amount : 0) - deliveryAmountFee;
  const grandTotalFormatted = useCurrencyFormatter({ price: grandTotalWithoutCharge, priceDecimals, currency: grandTotalCurrency });
  const bonusVoucherDiscountFormatted = useCurrencyFormatter({ price: bonusVoucherDiscount, priceDecimals, currency: grandTotalCurrency });
  const discountToolTipContent = useMemo(() => {
    const extensionAttributes = cart?.data?.extension_attributes?.cart?.extension_attributes;
    const hasExclusiveCoupon = !!extensionAttributes?.has_exclusive_coupon;
    const hasHMOfferCode = !!extensionAttributes?.applied_hm_offer_code;
    const couponCode = cart?.data?.extension_attributes?.totals?.coupon_code ?? '';
    const hasAdvantageCard = cart?.data?.extension_attributes?.totals?.items?.some((item) => !!item?.extension_attributes?.adv_card_applicable);

    let tooltipData = `<div className="applied-discounts-title">${placeholders.discountTooltipMessageApplied}</div>`;

    if (hasExclusiveCoupon) {
      tooltipData += `<div className="applied-exclusive-couponcode">${couponCode}</div>`;
      return tooltipData;
    }

    if (hasHMOfferCode) {
      tooltipData = `<div className="applied-hm-discounts-title">${placeholders.discountTooltipMessageMemberDiscount}</div>`;
    }

    if (hasAdvantageCard) {
      tooltipData += `<div class="promotion-label"><strong>${placeholders.discountTooltipMessageAdvantageCardDiscount}</strong></div>`;
    }

    return tooltipData;
  }, [cart]);

  return (
    <div className={`slide-up-animation ${enableOrderSummaryV2 ? 'cart__order-summary-container-v2' : ''}`}>
      {
        isLoading
          ? <div className="loader_overlay">
            <Loader />
          </div>
          : null
      }
      <div aria-label="order-summary" className="order-summary-label">
        {placeholders?.orderSummaryTitle}
      </div>
      <div className={`order__summary ${shouldEnableCartOrderSummaryV2 ? 'order__summary_v2' : ''}`}>
        <div className="order__summary__secondaryCard">
          <div className="common_container common_container_v2">
            <span aria-label="sub-total" className="sub-total-label">{placeholders?.subTotalLabel}</span>
            <span aria-label="value">
              {' '}
              {subtotalIncludingTaxFormatted}
            </span>
          </div>
          {deliveryMethodSelected && deliveryAmountFee > 0 && !shouldEnableCartOrderSummaryV2 && <div className="common_container common_container_v2">
            <span className="sub-total-label">{placeholders?.deliveryLabel}</span>
            <div className="checkout-subtotal-price">
              <span className="checkout-subtotal-amount">{deliveryFeeValue}</span>
            </div>
          </div>}
          {totalDiscountAmount < 0 && (
            <div className="common_container common_container_v2">
              <span aria-label="discount" className="discount-label">
                {shouldEnableCartOrderSummaryV2 ? placeholders?.cartSavedAmountLabel : placeholders?.discountsLabel}
                {!shouldEnableCartOrderSummaryV2 ? <Tooltip content={discountToolTipContent}>
                  <Icon name="info-blue" className="discount-icon" />
                </Tooltip> : null}
              </span>
              <span aria-label="value" className="discount-label no-gap">
                {
                  shouldEnableCartOrderSummaryV2 &&
                  ((auraDiscount !== 0 && auraDiscount !== null) ||
                  (auraPrice !== 0 && auraPrice !== null)) && (
                    <Icon name="chevron-down" className={`discount-breakdown-icon ${openBreakdown ? 'invert' : ''}`} onIconClick={() => setOpenBreakdown((prev) => !prev)}/>
                  )
                }
                {totalDiscountAmountFormatted}
              </span>
            </div>
          )}
          {
            openBreakdown && (
              <>
                {
                  shouldEnableCartOrderSummaryV2 && auraDiscount !== 0 && auraDiscount !== null && (
                    <div className="common_container common_container_v2">
                    <span aria-label="discount" className="discount-label">{placeholders?.auraDiscountLabel}</span>
                    <span aria-label="value" className="discount-label">{auraDiscountFormatted}</span>
                  </div>
                  )
                }
                {
                  shouldEnableCartOrderSummaryV2 && auraPrice !== 0 && auraPrice !== null && (
                    <div className="common_container common_container_v2">
                    <span aria-label="discount" className="discount-label">{placeholders?.auraPriceLabel}</span>
                    <span aria-label="value" className="discount-label">{auraPriceFormatted}</span>
                  </div>
                  )
                }
              </>
            )
          }
          {appliedVoucherCount ? (
            <div className="common_container common_container_v2">
              <span aria-label="bonus-voucher-discount" className="bonus-voucher-discount-label">{`${appliedVoucherCount} ${placeholders?.bonusVoucherAppliedLabel}`}</span>
              <span aria-label="value" className="bonus-voucher-discount-label">{bonusVoucherDiscountFormatted}</span>
            </div>
          ) : null}

          {(!shouldEnableCartOrderSummaryV2 || (shouldEnableCartOrderSummaryV2 && subtotalWithDiscountInclTaxFormatted && totalDiscountAmount < 0)) && <hr className="order_summary_border_bottom" />}
          {shouldEnableCartOrderSummaryV2 && subtotalWithDiscountInclTaxFormatted && totalDiscountAmount < 0 && <div className="common_container common_container_v2">
            <span aria-label="bonus-voucher-discount" className="bonus-voucher-discount-label">{subtotalWithDiscountInclTax?.title}</span>
            <span aria-label="value" className="bonus-voucher-discount-label">{subtotalWithDiscountInclTaxFormatted}</span>
          </div>}
        </div>
        <div className='order-total-delivery__container'>
          <div className="common_container order-total__container-v2">
            <span className="order_total_label" aria-label="order-total">{placeholders?.orderTotalLabel}</span>
            <span className="order_total_label" aria-label="value">{grandTotalFormatted}</span>
          </div>
          <div className="common_container">
            {(shouldEnableCartOrderSummaryV2 || (!shouldEnableCartOrderSummaryV2 && !deliveryMethodSelected)) && (!shouldEnableCartOrderSummaryV2 || (shouldEnableCartOrderSummaryV2 && !!freeShippingText)) && <span className="excluding_label" aria-label="excluding">{placeholders.excludingDelivery}</span>}
            {taxesTotal > 0 && <span className="excluding_label">{placeholders.inclusiveVat}</span>}
          </div>
          {!shouldEnableCartOrderSummaryV2 && <div className='order-summary__bnpl'>
            <BNPLComponent />
          </div>}
        </div>
        <div className={`checkout__action_container ${shouldEnableProductCardV2 ? 'bbw_checkout' : ''}`}>
          {shouldEnableProductCardV2 ? <div className='footer_total_order'> <span className='total_span'>{placeholders.totalText}<span className='excl_delivery_span'>{placeholders.exclusiveDeliveryText}</span></span><span className='grand_total_price'>{grandTotalFormatted}</span></div> : null}
          {shouldEnableProductCardV2 ?
            <button className={`${oosDisableButton ? 'checkout-disable' : 'checkout_action'} bbw_checkout_action`} onClick={handleCheckoutPage} onKeyUp={(e) => e.key === 'Enter' && handleCheckoutPage()} role="button" tabIndex={oosDisableButton ? -1 : 0}>
              <span className="checkout">
                {oosDisableButton ? <Icon name="lock-grey" key="lock-grey" className="lock-icon-grey" /> : <Icon name="lock-white" key="lock-white" className="lock-icon-white" />}
                <span>{placeholders.secureCheckout}</span>
              </span>
            </button>
            :
            <button className={`${oosDisableButton ? 'checkout-disable' : 'checkout_action'} `} onClick={handleCheckoutPage} onKeyUp={(e) => e.key === 'Enter' && handleCheckoutPage()} role="button" tabIndex={oosDisableButton ? -1 : 0}>
              <span className="checkout">
                {placeholders.checkoutBtn}
              </span>
            </button>
          }
        </div>
        {shouldEnableCartOrderSummaryV2 && <div className='order-summary__bnpl'>
          <BNPLComponent />
        </div>}
        <CardPaymentOptions cardMethodTitle={cardMethodTitle} paymentLogoList={paymentLogoList} />
      </div>
    </div>
  );
}

export default OrderSummary;