import React, {
  useContext, useState, useRef, useEffect,
  useCallback,
} from 'react';
import CartContext from '../../../../../context/cart-context.jsx';
import AuraToolTip from '../aura-tool-tip/aura-tool-tip';
import { getRedeemPoint, verifyOtp } from '../../../../../api/auraDetails.js';
import AuraFormRedeemPoints from './aura-form-redeem-points.jsx';
import Loader from '../../../../../shared/loader/loader.jsx';
import { getConfigValue } from '../../../../../../scripts/configs.js';
import AppConstants from '../../../../../utils/app.constants.js';
import ApiConstants from '../../../../../api/api.constants.js';

function RedeemAuraPoints({
  points, mobile, expiryDate, expiringPoints, apcIdentifierNumber, shouldRenderV2 = false
}) {
  const { isLoggedIn, placeholders, cart } = useContext(CartContext);
  const currencyCode = cart?.data?.prices?.grand_total?.currency;
  const { API_URI_VERIFY_OTP_AURA, API_URI_GET_REDEEM_PTS_AURA } = ApiConstants;
  const [state, setState] = useState({
    redeemPoints: false,
    customerVerified: false,
    otpResponseError: false,
    isLoading: false,
    otpFieldError: '',
    conversionRate: 0,
    isAuraRedeemed: false,
  });

  useEffect(() => {
    const cartTotalSegment = cart?.data?.extension_attributes?.totals?.total_segments;
    const isPaidByAura = cartTotalSegment?.find((segment) => segment.code === AppConstants.REDEEM_PAYMENT_METHOD_CODE);

    if (isPaidByAura && isPaidByAura?.value) {
      setState((prevState) => ({ ...prevState, customerVerified: true, isAuraRedeemed: true }));
    }
  }, [cart?.data?.extension_attributes?.totals?.total_segments]);

  useEffect(() => {
    const getConfigs = async () => {
      const conversionLabelCountry = `aura-conversion-base-value`
      const conversionRate = await getConfigValue(conversionLabelCountry) || 0;
      const decimalPlaces = await getConfigValue('aura-decimal-places');

      setState((prevState) => ({
        ...prevState,
        conversionRate,
        decimalPlaces,
      }));
    };

    getConfigs();
  }, []);

  const {
    redeemPointQuestion = '',
    redeemPointButton = '',
    auraOtpTooltip = '',
    redeemAuraOtpTitle = '',
    redeemAuraOtpPlaceholder = '',
    redeemAuraOtpButton = '',
    redeemAuraResendButton = '',
    redeemAuraOtpInfo = '',
    auraRedeemInfoTitleTwo = '',
    auraRedeemTooltip = '',
    redeemAuraOtpEmpty = '',
    redeemAuraOtpIncorrect = '',
    apiGenericError = '',
    redeemAuraSuccessMessagePoints = '',
    auraTooltipInfoTextone = '',
  } = placeholders;

  const inputRef = useRef(null);

  const callRedeemPoints = async () => {
    setState((prevState) => ({ ...prevState, isLoading: true }));

    try {
      const getRedeemPtsAuraEndPoint = API_URI_GET_REDEEM_PTS_AURA?.replace('{{identifierNo}}', apcIdentifierNumber);
      const redeemPointsData = await getRedeemPoint(getRedeemPtsAuraEndPoint, isLoggedIn);

      if (redeemPointsData) {
        setState((prevState) => ({
          ...prevState,
          redeemPoints: true,
        }));
      }
    } catch (error) {
      console.error('Error redeeming points:', error);

      setState((prevState) => ({
        ...prevState,
        redeemPoints: false,
        error: 'Failed to redeem points. Please try again later.',
      }));
    } finally {
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }
  };

  const submitOtp = async () => {
    const otp = document.getElementById('otp').value;

    if (otp.length === 0) {
      setState((prevState) => ({ ...prevState, otpFieldError: redeemAuraOtpEmpty }));

      return;
    }

    setState((prevState) => ({ ...prevState, isLoading: true, otpFieldError: '' }));
    try {
      const verifyOtpAuraEndPoint = API_URI_VERIFY_OTP_AURA?.replace('{{identifierNo}}', apcIdentifierNumber).replace('{{otp}}', otp);
      const otpData = await verifyOtp(verifyOtpAuraEndPoint, isLoggedIn);
      if (typeof otpData === 'boolean') {
        if (otpData) {
          setState((prevState) => ({
            ...prevState,
            customerVerified: true,
            otpFieldError: '',
          }));
        } else {
          setState((prevState) => ({ ...prevState, otpFieldError: redeemAuraOtpIncorrect }));
        }
      } else if (typeof otpData === 'object' && otpData !== null) {
        const errorMessage = otpData?.parameters[0] || apiGenericError;
        setState((prevState) => ({ ...prevState, otpFieldError: errorMessage }));
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
    } finally {
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }
  };

  const handleBlur = () => {
    inputRef?.current?.classList.toggle('focus', inputRef.current.value.length > 0);
  };

  const {
    redeemPoints,
    customerVerified,
    isLoading,
    otpFieldError,
    conversionRate,
    decimalPlaces,
    isAuraRedeemed,
  } = state;

  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);

    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options);
  });

  const renderRedeemButton = () => (
    <button type="submit" className="spc-aura-redeem-card spc-aura-button" onClick={() => shouldRenderV2
      ? setState((prevState) => ({ ...prevState, redeemPoints: true, customerVerified }))
      : callRedeemPoints()}>
      {redeemPointButton}
    </button>
  );

  const renderPointsExpireBy = (showTooltip = true) => (
    <div className='checkout__aura-details__expired-points'>
      <span> {expiringPoints}  {auraRedeemInfoTitleTwo} </span>
      <span className="spc-aura-highlight">{shouldRenderV2 ? formatDate(expiryDate) : expiryDate}</span>
      {showTooltip ? <AuraToolTip newClass="question" data="" type="info" content={auraRedeemTooltip} /> : null}
    </div>
  );

  const renderAuraRedeemPoints = () => (
    <AuraFormRedeemPoints
      pointsInAccount={points}
      conversionRate={conversionRate}
      decimalPlaces={decimalPlaces}
      apcIdentifierNumber={apcIdentifierNumber}
      isAuraRedeemed={isAuraRedeemed}
      showRemoveIcon={shouldRenderV2}
      shouldRenderV2={shouldRenderV2}
      renderPointsExpireBy={renderPointsExpireBy}
    />
  );

  const convertPointsToAmount = (numericValue) => {
    const convertedPoints = (numericValue * conversionRate).toFixed(decimalPlaces);
    return convertedPoints;
  };

  const render = () => (
    <div className="spc-aura-link-card-form active">
      {isLoading && (
        <div className="loader_overlay">
          <Loader />
        </div>
      )}
      <div className="customer-points">
        <div className="aura-points-info">
          <div className="total-points">
            <span>
              {auraTooltipInfoTextone}
              <span className="spc-aura-highlight">
                {points} {redeemAuraSuccessMessagePoints}
              </span>
            </span>
          </div>
          <div className="spc-aura-checkout-messages">
            <div className="spc-aura-points-expiry-item">
              {renderPointsExpireBy()}
            </div>
          </div>
        </div>

        {!customerVerified
          && (
            <div className="aura-redeem-points">
              {!redeemPoints
                && (
                  <>
                    <div className="redeem-msg">{redeemPointQuestion}</div>
                    {renderRedeemButton()}
                  </>
                )}
              {redeemPoints
                && (
                  <div className="aura-send-otp">
                    <div className="aura-modal-form">
                      <div className="aura-enter-otp">
                        <AuraToolTip data={redeemAuraOtpTitle} type="info" content={auraOtpTooltip} />
                      </div>

                      <div className="aura-modal-form-items">
                        <div className="otp-field-section">
                          <div className="spc-type-textfield">
                            <input
                              type="text"
                              id="otp"
                              name="otp"
                              ref={inputRef}
                              onBlur={handleBlur}
                            />
                            <div className="c-input__bar" />
                            <label htmlFor="otp-input">{redeemAuraOtpPlaceholder}</label>
                            <div id="otp-error" className="error">{otpFieldError}</div>
                          </div>
                          <div className="aura-verify-otp">
                            <button type="button" className="aura-modal-form-submit" onClick={submitOtp}>{redeemAuraOtpButton}</button>
                          </div>
                          <div className="aura-otp-submit-description">
                            <button type="button" className="resend-otp" onClick={callRedeemPoints}>{redeemAuraResendButton}</button>
                          </div>
                          <div className="otp-sent-to-mobile-label">
                            <span>
                              {redeemAuraOtpInfo}
                              {' '}
                              {mobile}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        {(customerVerified && conversionRate) ? renderAuraRedeemPoints() : null}
      </div>
    </div>
  );

  const renderV2 = () => (
    <>
      {
        isLoading && (
          <div className="loader_overlay">
            <Loader />
          </div>
        )

      }
      {
        redeemPoints || isAuraRedeemed
          ? renderAuraRedeemPoints()
          : <div className='aura__redeem-points__container'>
            <div className='aura__redeem-points__left'>
              <div className='aura__redeem-points__available-points'>
                <span className='aura__text-bold'>{points}</span>
                <span>{placeholders.redeemAuraSuccessMessagePoints} |</span>
                <span className='aura__text-bold'>{currencyCode} {convertPointsToAmount(points)}</span>
                <span>{placeholders.availableText}</span>
              </div>
              {renderPointsExpireBy(false)}
            </div>
            <div className='aura__redeem-points__right'>
              {renderRedeemButton()}
            </div>
          </div>
      }
    </>
  );

  return shouldRenderV2 ? renderV2() : render();
}

export default RedeemAuraPoints;
