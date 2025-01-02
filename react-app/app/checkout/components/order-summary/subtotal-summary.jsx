import React, { useCallback, useContext, useState, useEffect, useMemo } from "react";
import Tooltip from '../../../../library/tooltip/tooltip';
import Icon from '../../../../library/icon/icon.jsx';
import Loader from '../../../../shared/loader/loader.jsx';
import CartContext from "../../../../context/cart-context.jsx";
import useCurrencyFormatter from '../../../../utils/hooks/useCurrencyFormatter';
import { formatPrice } from '../../../../utils/base-utils.js';
import { getConfigValue } from '../../../../../scripts/configs.js';

function SubTotalSummary() {
    const [currency, setCurrency] = useState('');
    const [formattedSurcharge, setFormattedSurcharge] = useState('');
    const [isEgiftPay, setIsEgiftPay] = useState(false);
    const { cart, deliveryFeeLoader, cardAppliedAmount, selectedMethod, isTopupFlag, selectedCollectionStoreForCheckout, placeholders, priceDecimals, configs } = useContext(CartContext);
    const subTotalValue = cart?.data?.extension_attributes?.totals?.total_segments?.find((item) => item?.code === "subtotal")
    const surCharge = cart?.data?.extension_attributes?.cart?.extension_attributes?.surcharge;
    const isAppliedSurcharge = Number(surCharge?.is_applied) === 1 && surCharge?.amount;
    const grandTotal = cart?.data?.extension_attributes?.totals?.base_grand_total ?? 0;
    const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
    const subtotalIncludingTax = cart?.data?.prices?.subtotal_including_tax?.value ?? 0;
    const appliedTaxes = cart?.data?.prices?.applied_taxes ?? [];
    const taxesTotal = appliedTaxes.reduce((acc, tax) => acc + (tax.amount.value ?? 0), 0);
    const deliveryAmountFee = cart?.data?.extension_attributes?.totals?.shipping_incl_tax;
    const totalDiscountAmount = cart?.data?.prices?.discount?.amount?.value;
    const topupGrantTotalValue = cart?.data?.extension_attributes?.totals?.base_grand_total ?? 0;
    const subtotalIncludingTaxFormatted = useCurrencyFormatter({ price: !isTopupFlag ? subtotalIncludingTax : subTotalValue?.value, priceDecimals, currency: grandTotalCurrency });
    const totalDiscountAmountFormatted = useCurrencyFormatter({ price: totalDiscountAmount, priceDecimals, currency: grandTotalCurrency });
    const surchargeAmountFormatted = useCurrencyFormatter({ price: surCharge?.amount, priceDecimals, currency: grandTotalCurrency });
    const subtotalWithDiscountInclTax = cart?.data?.extension_attributes?.totals?.total_segments?.find(item => item.code === 'subtotal_with_discount_incl_tax');
    const subtotalWithDiscountInclTaxFormatted = useCurrencyFormatter({ price: subtotalWithDiscountInclTax?.value ?? 0, priceDecimals, currency: grandTotalCurrency });
    const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

    const grandTotalFormatted = useCurrencyFormatter({ price: !isTopupFlag ? grandTotal : topupGrantTotalValue, priceDecimals, currency: grandTotalCurrency });
    const cardAppliedAmountFormatted = useCurrencyFormatter({
        price: cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_redeemed_amount,
        priceDecimals,
        currency: grandTotalCurrency,
    });

    const paidWithAuraObject = cart?.data?.extension_attributes?.totals?.total_segments?.find((item) => item?.code === 'aura_payment');
    const balancePaymentObject = cart?.data?.extension_attributes?.totals?.total_segments?.find((item) => item?.code === 'balance_payable');

    const balancePaymentValue = useCurrencyFormatter({ price: balancePaymentObject?.value, priceDecimals, currency: grandTotalCurrency });
    const paidAuraValue = useCurrencyFormatter({ price: `-${paidWithAuraObject?.value}`, priceDecimals, currency: grandTotalCurrency });
    const deliveryFeeValue = useCurrencyFormatter({ price: deliveryAmountFee, priceDecimals, currency: grandTotalCurrency });
    const deliveryMethodSelected = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.method;

    const shippingAssign = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes;
    let collectionChargeVal = '';
    const shouldEnableCartOrderSummaryV2 = configs['cart-enable-order-summary-v2'] === 'true';

    if (shippingAssign?.price_amount) {
        if (!isNaN(Number(shippingAssign.price_amount))) {
            const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
            const formattedPrice = useCurrencyFormatter({ price: shippingAssign.price_amount, priceDecimals, currency: grandTotalCurrency });
            collectionChargeVal = formattedPrice;
        } else {
            collectionChargeVal = shippingAssign.price_amount;
        }
    }

    useEffect(() => {
        const extAttr = cart?.data?.extension_attributes?.totals?.extension_attributes;
        if (extAttr?.hps_redemption_type && extAttr.hps_redeemed_amount > 0) {
            setIsEgiftPay(true);
        } else {
            setIsEgiftPay(false);
        }
    }, [cart?.data?.extension_attributes?.totals?.extension_attributes]);

    const discountToolTipContent = useMemo(() => {
        const tooltipData = `<div className="applied-discounts-title">${placeholders.discountTooltipMessageApplied}</div>`;
        return tooltipData;
    }, [placeholders.discountTooltipMessageApplied]);

    const cashOnDeliveryTooltipContent = useMemo(() => placeholders.codSurchargeTooltipText.replace('{{SURCHARGE}}', formattedSurcharge), [placeholders.codSurchargeTooltipText, formattedSurcharge]);

    useEffect(() => {
        const fetchCurrency = async () => {
            const configValue = await getConfigValue('currency');
            setCurrency(configValue);
        };
        fetchCurrency();
    }, []);

    useEffect(() => {
        const fetchFormattedSurcharge = async () => {
            const formattedPrice = await formatPrice(currency, surCharge?.amount);
            setFormattedSurcharge(formattedPrice);
        };

        fetchFormattedSurcharge();
    }, [currency, surCharge]);

    const renderDeliveryFeeValue = useCallback(() => {
        if (!deliveryFeeLoader) {
            if (deliveryAmountFee) {
                return deliveryFeeValue;
            }
            return placeholders?.shippingMethodFreeLabel;
        }
        return <Loader />;
    }, [deliveryFeeLoader, deliveryAmountFee, deliveryFeeValue, placeholders]);
    const renderDeliveryCharge = () => {
        if (deliveryMethodSelected === 'click_and_collect_click_and_collect' && shippingAssign?.pudo_available) {
            return <div className="checkout-subtotal-line">
                <div className="checkout-subtotal-label">{placeholders?.collectionCharge}</div>
                <div className="checkout-subtotal-price">
                    <span className="checkout-subtotal-amount">{collectionChargeVal}</span>
                </div>
            </div>
        } else if (deliveryMethodSelected === 'click_and_collect_click_and_collect') {
            return null;
        }

        return <div className="checkout-subtotal-line">
            <div className="checkout-subtotal-label">{placeholders?.deliveryLabel}</div>
            <div className="checkout-subtotal-price">
                <span className="checkout-subtotal-amount">{renderDeliveryFeeValue()}</span>
            </div>
        </div>
    }
    return (
        <div className="checkout-subtotal-container">
            <div className="checkout-subtotal-wrapper">
                {shouldEnableDeliveryAndBillingAddressV2 ? (
                    <div className="subtotal-summary-heading">{placeholders.orderSummaryTitle}</div>
                ) : null}
                <div className="checkout-subtotal">
                    <div className="checkout-subtotal-line">
                        <div className="checkout-subtotal-label">{placeholders?.subTotalLabel}</div>
                        <div className="checkout-subtotal-price">
                            {subtotalIncludingTaxFormatted}
                        </div>
                    </div>
                    {isAppliedSurcharge ? (
                        <div className="checkout-subtotal-line">
                            <label className="checkout-subtotal-label checkout-subtotal-label-with-tooltip">
                                {placeholders?.cashOnDeliveryLabel}
                                {!shouldEnableCartOrderSummaryV2 ? <Tooltip content={cashOnDeliveryTooltipContent}>
                                    <Icon name="info-blue" />
                                </Tooltip> : null}
                            </label>
                            <div className="checkout-subtotal-price">
                                {surchargeAmountFormatted}
                            </div>
                        </div>
                    ) : null}

                    {totalDiscountAmount < 0 && (
                        <div className="checkout-subtotal-line">
                            <label aria-label="discount" className="discount-label">
                                {placeholders?.discountsLabel}
                                {!shouldEnableCartOrderSummaryV2
                                    ? <Tooltip content={discountToolTipContent}>
                                        <Icon name="info-blue" className="discount-icon" />
                                    </Tooltip>
                                    : null}
                            </label>
                            <label aria-label="value" className="discount-label">{totalDiscountAmountFormatted}</label>
                        </div>
                    )}
                    {renderDeliveryCharge()}

                    {shouldEnableCartOrderSummaryV2 && subtotalWithDiscountInclTaxFormatted && totalDiscountAmount < 0 && <hr className="order_summary_border_bottom checkout__order_summary_border_bottom" />}
                    {shouldEnableCartOrderSummaryV2 && subtotalWithDiscountInclTaxFormatted && totalDiscountAmount < 0 && <div className="common_container common_container_v2 checkout__common_container">
                        <span aria-label="discount" className="checkout-subtotal-label">{subtotalWithDiscountInclTax?.title}</span>
                        <span aria-label="value" className="checkout-subtotal-label">{subtotalWithDiscountInclTaxFormatted}</span>
                    </div>}
                </div>

                <div className="checkout-order-total-sec1">
                    <div className="checkout-order-total-label">{placeholders?.orderTotalLabel}</div>
                    <div className="checkout-order-total-price">
                        {grandTotalFormatted}
                    </div>
                </div>

                {isEgiftPay && (
                    <div className="checkout-order-total-redeem">
                        <div className="checkout-order-total-label-redeem">{placeholders.redeemPayOrderSummary}</div>
                        <div className="checkout-order-total-price-redeem">
                            {cardAppliedAmountFormatted}
                        </div>
                    </div>
                )}


                <div className="checkout-order-total">
                    {paidWithAuraObject?.value > 0 && (
                        <div className="checkout-subtotal-line">
                            <div className="checkout-subtotal-label">{placeholders?.paidWithAuraLabel}</div>
                            <div className="checkout-subtotal-price">
                                <span className="checkout-subtotal-amount">{paidAuraValue}</span>
                            </div>
                        </div>
                    )}
                    {balancePaymentObject && (
                        <div className="checkout-subtotal-line">
                            <div className="checkout-subtotal-label">{placeholders?.balancePaymentLabel}</div>
                            <div className="checkout-subtotal-price">
                                <span className="checkout-subtotal-amount">{balancePaymentValue}</span>
                            </div>
                        </div>
                    )}

                    <div className="checkout-order-total-sec2">
                        {!deliveryMethodSelected && <label className="excluding_label" aria-label="excluding">{placeholders.excludingDelivery}</label>}
                        {taxesTotal > 0 && <label className="excluding_label">{placeholders.inclusiveVat}</label>}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SubTotalSummary;