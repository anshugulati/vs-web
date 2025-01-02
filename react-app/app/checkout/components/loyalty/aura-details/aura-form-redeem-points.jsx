import React, { useContext, useState, useEffect } from 'react';
import CartContext from '../../../../../context/cart-context.jsx';
import { redeemOrRemovePoints, simulateSales } from '../../../../../api/auraDetails.js';
import Loader from '../../../../../shared/loader/loader.jsx';
import AppConstants from '../../../../../utils/app.constants.js';
import ApiConstants from '../../../../../api/api.constants.js';
import { PAYMENT_METHODS_NOT_FOR_AURA } from '../../../../cart/constants.js';
import Icon from '../../../../../library/icon/icon.jsx';
import getSubCartGraphql from '../../../../../api/getSubCartGraphql.js';

function AuraFormRedeemPoints({ pointsInAccount, apcIdentifierNumber, conversionRate, decimalPlaces, isAuraRedeemed, showRemoveIcon = false, shouldRenderV2, renderPointsExpireBy }) {
  const {
    cart,
    isLoggedIn,
    placeholders,
    setCart,
    setSalesPoints,
    methods,
    selectedPaymentMethod,
    cartId
  } = useContext(CartContext);

  const { REDEEM_PAYMENT_METHOD_CODE, PAYMENT_METHOD_CODE_COD } = AppConstants;

  const {
    API_URI_REMOVE_REDEEM_PTS_AURA,
    API_URI_REMOVE_REDEEM_PTS_AURA_GUEST,
    API_URI_SIMULATE_SALES_AURA,
    API_URI_GUEST_CART_SIMILATE_SALES_AURA,
  } = ApiConstants;

  const {
    redeemAuraPointsTitle = '',
    redeemAuraPointsUseButton = '',
    redeemAuraPointsRemoveButton = '',
    redeemAuraSuccessMessage = '',
    redeemAuraSuccessMessagePoints = '',
    redeemAuraSuccessMessageWorth = '',
    redeemingMoreThanTotal = 'The number of points exceeds your order total. Please re-enter the number of points you’d like to redeem.',
    auraCantBeClubbedWithCOD = 'Aura points can not be redeemed with cash on delivery.',
    redeemPointButton = ''
  } = placeholders;

  const quoteId = cart?.data?.extension_attributes?.cart?.id;
  const grandTotal = cart?.data?.prices?.grand_total;
  const currencyCode = grandTotal?.currency;

  const [enteredPoints, setEnteredPoints] = useState(0);
  const [auraTransaction, setAuraTransaction] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [convertedValue, setConvertedValue] = useState(0.000);
  const [maxRedeemPoints, setMaxRedeemPoints] = useState(0);
  const [showMaxRedeemError, setShowMaxRedeemError] = useState(false);
  const [isNotSupportedPayment, setNotSupportedPayment] = useState(false);

  useEffect(() => {
    if (conversionRate) {
      const finalAmount = cart?.data?.extension_attributes?.totals?.base_grand_total;
      redemptionLimit(finalAmount);
    }
  }, [cart?.data?.extension_attributes?.totals?.base_grand_total, conversionRate]);

  useEffect(() => {
    if (selectedPaymentMethod) {
      const isNotSupported = PAYMENT_METHODS_NOT_FOR_AURA.includes(selectedPaymentMethod);
      setNotSupportedPayment(isNotSupported);
    }
  }, [selectedPaymentMethod]);

  useEffect(() => {
    if (isAuraRedeemed) {
      setAuraTransaction(true);
    }
  }, []);

  const redemptionLimit = (finalAmount) => {
    const cartTotalSegment = cart?.data?.extension_attributes?.totals?.total_segments;
    const isPaidByAura = cartTotalSegment?.find((segment) => segment.code === AppConstants.REDEEM_PAYMENT_METHOD_CODE);
    const isPaidByAuraValue = isPaidByAura?.value;
    const auraAmountToPoints = isPaidByAuraValue ? convertAmountToPoints(isPaidByAuraValue) : 0;

    const grandTotalPoints = convertAmountToPoints(finalAmount);
    const pointsAllowedToRedeem = (pointsInAccount < grandTotalPoints)
      ? pointsInAccount
      : grandTotalPoints;

    setMaxRedeemPoints(pointsAllowedToRedeem);

    handleChange({
      target: {
        value: isPaidByAura ? auraAmountToPoints : pointsAllowedToRedeem
      }
    });
  };

  const convertPointsToAmount = (numericValue) => {
    const convertedPoints = (numericValue * conversionRate).toFixed(decimalPlaces);

    return convertedPoints;
  }

  const convertAmountToPoints = amount => amount / conversionRate;

  const handleChange = async (e) => {
    const userEnteredPoints = e.target.value;
    const numericValue = typeof userEnteredPoints === 'string'
      ? userEnteredPoints.replace(/[^0-9]/g, '')
      : userEnteredPoints;

    if (numericValue.length > 1 && numericValue.startsWith('0')) {
      return;
    }

    setEnteredPoints(numericValue);
    if (numericValue === '') {
      setConvertedValue('0.000');
      return;
    }

    const pts = convertPointsToAmount(numericValue);
    setConvertedValue(pts);
  };

  const updateCartTotal = async () => {

    const cartData = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__TOTALS]);
    if (cartData?.extension_attributes?.totals) {
      setCart((prevCart) => ({
        ...prevCart,
        data: {
          ...prevCart.data,
          extension_attributes: {
            ...prevCart.data.extension_attributes,
            totals: cartData.extension_attributes.totals
          }
        }
      }));
    }

    /*
    setCart((prevState) => {
      const balancePayableSegment = {
        code: 'balance_payable',
        title: 'Balance Payable',
        value: data?.redeem_response?.balance_payable || 0,
      };

      const auraPaymentSegment = {
        code: REDEEM_PAYMENT_METHOD_CODE,
        title: 'Paid By Aura',
        value: data?.redeem_response?.cashback_requested_value || 0,
      };

      const totalSegments = prevState.data.extension_attributes.totals.total_segments;

      const balancePayableIndex = totalSegments.findIndex((segment) => segment.code === 'balance_payable');
      const auraPaymentIndex = totalSegments.findIndex((segment) => segment.code === REDEEM_PAYMENT_METHOD_CODE);

      let updatedTotalSegments = totalSegments.map((segment, index) => {
        if (index === balancePayableIndex) {
          return balancePayableSegment;
        } if (index === auraPaymentIndex) {
          return auraPaymentSegment;
        }
        return segment;
      });

      if (balancePayableIndex === -1) {
        updatedTotalSegments = [...updatedTotalSegments, balancePayableSegment];
      }

      if (auraPaymentIndex === -1) {
        updatedTotalSegments = [...updatedTotalSegments, auraPaymentSegment];
      }

      return {
        ...prevState,
        data: {
          ...prevState.data,
          extension_attributes: {
            ...prevState.data.extension_attributes,
            totals: {
              ...prevState.data.extension_attributes.totals,
              total_segments: updatedTotalSegments,
            },
          },
        },
      };
    }); */
  };

  const triggerRedeemPoints = async () => {
    if (!auraTransaction && (Number(enteredPoints) > Number(maxRedeemPoints))) {
      setShowMaxRedeemError(true);
      return;
    }

    setShowMaxRedeemError(false);
    setIsLoading(true);

    const redeemPointsBody = {
      redeemPoints: {
        quote_id: quoteId,
        action: auraTransaction ? 'remove points' : 'set points',
        ...(auraTransaction ? { ...(isLoggedIn ? {} : { masked_quote_id: cartId }) } : {
          redeem_points: enteredPoints,
          converted_money_value: convertedValue,
          currencyCode,
          payment_method: REDEEM_PAYMENT_METHOD_CODE,
          ...(isLoggedIn ? {} : { masked_quote_id: cartId })
        }),
      },
    };

    try {
      const redeemOrRemoveEndpoint = (isLoggedIn ? API_URI_REMOVE_REDEEM_PTS_AURA : API_URI_REMOVE_REDEEM_PTS_AURA_GUEST)?.replace('{{identifierNo}}', apcIdentifierNumber);
      const responseData = await redeemOrRemovePoints(redeemPointsBody, redeemOrRemoveEndpoint, isLoggedIn);
      if (!responseData?.error) {
        await updateCartTotal();
        setAuraTransaction(!auraTransaction);

        try {
          const simulateSaleAuraEndPoint = isLoggedIn ? API_URI_SIMULATE_SALES_AURA?.replace('{{identifierNo}}', apcIdentifierNumber) : API_URI_GUEST_CART_SIMILATE_SALES_AURA;
          const salesData = await simulateSales(simulateSaleAuraEndPoint, isLoggedIn, redeemPointsBody.redeemPoints.quote_id);
          if (salesData?.data?.apc_points) {
            setSalesPoints(salesData?.data?.apc_points);
          }
        } catch (error) {
          console.error('Error simulating sales:', error);
          // Handle the error appropriately, e.g., show an error message to the user
        }
      }
    } catch (error) {
      console.error('Error using or removing points:', error);

      // Handle error (e.g., show error message to the user)
    } finally {
      setIsLoading(false);
    }
  };

  const btnLabel = auraTransaction
    ? redeemAuraPointsRemoveButton
    : shouldRenderV2 ? redeemPointButton : redeemAuraPointsUseButton;
  const redeemButtonDisabled = auraTransaction ? false : enteredPoints === 0;

  return (
    <div className="spc-aura-redeem-points-form-wrapper">
      {isLoading && (
        <div className="loader_overlay">
          <Loader />
        </div>
      )}
      {!auraTransaction && <span className="label">{redeemAuraPointsTitle}</span>}
      <div className="form-items">
        <div className="inputs">
          {
            !auraTransaction
              ? (
                <>
                  <div className="spc-aura-textfield spc-aura-redeem-field-points-form-item">
                    <input
                      placeholder="0"
                      name="spc-aura-redeem-field-points"
                      className="spc-aura-redeem-field-points"
                      type="text"
                      value={enteredPoints}
                      onChange={handleChange}
                    />
                  </div>
                  <span className="spc-aura-redeem-points-separator">=</span>
                  <div className="spc-aura-textfield spc-aura-redeem-field-amount-form-item">
                    <input
                      placeholder={`${currencyCode} 0.000`}
                      name="spc-aura-redeem-field-amount"
                      className="spc-aura-redeem-field-amount"
                      type="text"
                      value={`${currencyCode} ${convertedValue}`}
                      disabled
                    />
                  </div>
                </>
              )
              : (
                <div className="successful-redeem-msg" data-aura-points-used={enteredPoints}>
                  <span> {enteredPoints} </span>
                  <span> {redeemAuraSuccessMessagePoints} </span>
                  <span className='successful-redeem-msg'> {redeemAuraSuccessMessageWorth} </span>
                  <span> {currencyCode} </span>
                  <span> {convertedValue} </span>
                  <span className='successful-redeem-msg'> {redeemAuraSuccessMessage} </span>
                </div>
              )
          }

          <button
            type="submit"
            className={`spc-aura-redeem-form-submit spc-aura-button ${auraTransaction && showRemoveIcon ? 'spc-aura-button-inline' : ''}`}
            onClick={triggerRedeemPoints}
            disabled={redeemButtonDisabled || isNotSupportedPayment}
          >
            {btnLabel} {auraTransaction && showRemoveIcon ? <Icon name='close-x-cancel-dark-grey' /> : null}
          </button>
        </div>
      </div>
      <div
        id="spc-aura-link-api-response-message"
        className={`spc-aura-link-api-response-message ${showMaxRedeemError ? '' : 'hidden'}`}
      >
        {redeemingMoreThanTotal}
      </div>
      <div
        className={`spc-aura-cod-disabled-message ${isNotSupportedPayment ? '' : 'hidden'}`}
      >
        {auraCantBeClubbedWithCOD}
      </div>
      {!auraTransaction && renderPointsExpireBy(false)}
    </div>
  );
}

export default AuraFormRedeemPoints;
