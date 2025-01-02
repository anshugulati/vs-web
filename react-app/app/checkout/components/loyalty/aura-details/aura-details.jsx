import React, { useContext, useState, useEffect } from 'react';
import AuraFormFieldOptions from '../aura-form-field-options/aura-form-field-options.jsx';
import CartContext from '../../../../../context/cart-context.jsx';
import AuraToolTip from '../aura-tool-tip/aura-tool-tip';
import LinkCardOptionCard from './link-card-option.jsx';
import LinkCardOptionEmail from './link-email-option.jsx';
import LinkCardOptionMobile from './link-mobile-option.jsx';
import { hasValue, showError, removeError } from '../../../../../utils/loyalty/conditions-util.js';
import { getInlineErrorSelector } from '../../../../../utils/loyalty/link_card_sign_up_modal_helper';
import getUserInput from '../../../../../utils/loyalty/checkout_helper.js';
import {
  getEnrolledStatus, setLoyaltyCard, simulateSales, getApcPointsBalance,
} from '../../../../../api/auraDetails.js';
import { getCountryIso } from '../../../../../../scripts/helpers/country-list.js';
import { getConfigValue } from '../../../../../../scripts/configs.js';
import RedeemAuraPoints from './redeem-aura-points.jsx';
import Loader from '../../../../../shared/loader/loader.jsx';
import AppConstants from '../../../../../utils/app.constants.js';
import ApiConstants from '../../../../../api/api.constants.js';
import './aura-details.css';
import getSubCartGraphql from '../../../../../api/getSubCartGraphql.js';
import Icon from '../../../../../library/icon/icon.jsx';
import getRestApiClient from '../../../../../utils/api-client.js';
import { getCustomer } from '../../../../../../scripts/customer/api.js';
import { getAuraCustomerData, getAuraGuestInfo } from '../../../../../../scripts/aura/api.js';

function AuraDetailsForm({ defaultLoyalType, defaultLoyalCard, apcNumber }) {
  const {
    placeholders,
    isLoggedIn,
    cartId,
    cart,
    salesPoints,
    setSalesPoints,
    setCart,
    configs
  } = useContext(CartContext);

  const {
    API_URI_SET_LOYALTY_AURA,
    API_URI_SET_LOYALTY_AURA_GUEST,
    API_URI_GET_ENROLLED_AURA,
    API_URI_SIMULATE_SALES_AURA,
    API_URI_GUEST_CART_SIMILATE_SALES_AURA,
    API_URI_APC_PTS_BALANCE_AURA,
  } = ApiConstants;

  const [state, setState] = useState({
    linkCardOption: 'mobile',
    loyaltyCardLinkedToCart: false,
    cardNumber: '',
    email: '',
    mobile: '',
    isFullyEnrolled: false,
    points: 0,
    expiringPoints: 0,
    expiryDate: null,
    userInput: {},
    isLoading: false,
    countryPrefix: '',
    apcIdentifierNumber: '',
    showOTPVerification: false,
    otp: '',
    errorMessage: ''
  });

  const [auraDetails, setAuraDetails] = useState({});

  const {
    enterAuraDetails = '',
    enterAuraDetailsToolTip = '',
    loyaltyCardPlaceholder = '',
    loyaltyEmailPlaceholder = '',
    loyaltyMobilePlaceholder = '',
    loyalCardInvalid = '',
    loyalMobileNotRegistered = '',
    loyalEmailNotRegistered = '',
    earnAuraPointsInfo = '',
    earnAuraSalesPoints = '',
    submitText = '',
    auraEarn = '',
    auraPoints = '',
    accountToLink = '',
    auraLinkAccountInfoText = 'To earn points on this purchase & unlock offers, Aura price and more',
    checkoutAuraEnterEnrollmentDetailsText = 'Enter the details used during your Aura enrollment.',
    checkoutAuraSendOtpText = "We'll send an OTP to your registered mobile number.",
    checkoutAuraSendOtpBtnText = 'Send OTP',
    checkoutAuraVerifyBtnText = 'Verify',
    checkoutAuraEarnPointsText = 'Earn {{AURA_POINTS}} Points',
    checkoutAuraOtpSentText = 'A One Time Password (OTP) has been sent to your mobile number',
    checkoutAuraResendOtpBtnText = 'Resend OTP',
    checkoutAuraRedeemPointsAppText = 'To redeem your points, complete your registration on the Aura MENA app available on the App Store and Google Play',
    checkoutAuraLinkAuraBtnText = 'Link your Aura',
    checkoutAuraInvalidOtpErrorMessage = 'Incorrect OTP. Please enter a valid OTP.',
    checkoutAuraResendOtpSuccessMessage = 'Resend OTP successful'
  } = placeholders;

  const {
    linkCardOption,
    cardNumber,
    email,
    mobile,
    points,
    isLoading,
    expiringPoints,
    expiryDate,
    apcIdentifierNumber,
    showOTPVerification,
    otp,
    errorMessage
  } = state;

  const updatedSalesText = earnAuraSalesPoints.replace('{points}', salesPoints);

  const shouldEnableCheckoutAuraV2 = configs['enable-checkout-aura-v2'] === 'true';

  const getLocalData = () => {
    const auraDetails = JSON.parse(localStorage.getItem('aura_common_data')) || {};
    setAuraDetails(auraDetails);
  }

  useEffect(() => {
    setState((prevState) => ({ ...prevState, cardNumber: defaultLoyalType === AppConstants.LOYALTY_AURA ? defaultLoyalCard : '' }));

    if (defaultLoyalType === AppConstants.LOYALTY_AURA) {
      const userData = {
        key: 'cardNumberCheckout',
        type: 'apcNumber',
        value: defaultLoyalCard,
      };
      addCard(null, userData);
    }

    const fetchCountryPrefix = async () => {
      const countryCode = await getConfigValue('country-code');
      const prefix = `+${await getCountryIso(countryCode)}`;

      setState((prevState) => ({
        ...prevState,
        countryPrefix: prefix,
      }));
    };

    fetchCountryPrefix();
    getLocalData();
  }, []);

  useEffect(() => {
    if (apcNumber) setState(prevState => ({ ...prevState, apcIdentifierNumber: apcNumber }));
    else if (!apcIdentifierNumber && auraDetails?.aura_membership) setState(prevState => ({ ...prevState, apcIdentifierNumber: auraDetails.aura_membership }));
  }, [apcNumber, auraDetails?.aura_membership])

  useEffect(() => {
    if (!points && (state?.apcIdentifierNumber || auraDetails?.aura_membership) && +auraDetails?.aura_link === AppConstants.APC_LINK_STATUSES.LINKED_VERIFIED) getAvailableAPCPoints(state.apcIdentifierNumber || auraDetails?.aura_membership);
  }, [points, auraDetails?.aura_link, auraDetails?.aura_membership, state?.apcIdentifierNumber]);

  useEffect(() => {
    if (!isLoggedIn) getSalesPoints();
  }, [isLoggedIn]);

  const showErrorMessage = (type) => {
    const { linkCardOption } = state;

    let errorMessage;
    if (linkCardOption === 'email') {
      errorMessage = loyalEmailNotRegistered;
    } else if (linkCardOption === 'mobile') {
      errorMessage = loyalMobileNotRegistered;
    } else {
      errorMessage = loyalCardInvalid;
    }

    showError(getInlineErrorSelector(type)[type], errorMessage);
  };

  const getAuraData = async () => {
    await isLoggedIn ? getAuraCustomerData() : getAuraGuestInfo(apcIdentifierNumber);
    getLocalData();
  }

  const getAvailableAPCPoints = async (apcIdentifierNumber) => {
    try {
      const apcPtsBalanceAuraEndPoint = API_URI_APC_PTS_BALANCE_AURA?.replace('{{identifierNo}}', apcIdentifierNumber);
      const apcPointsBalanceData = await getApcPointsBalance(apcPtsBalanceAuraEndPoint, isLoggedIn);
      if (!apcPointsBalanceData.error) {
        const {
          apc_points: apcPoints,
          apc_points_expiry_date: apcPointsExpiryDate,
          apc_points_to_expire: apcPointsToExpire,
        } = apcPointsBalanceData;
        setState((prevState) => ({
          ...prevState,
          points: apcPoints,
          expiringPoints: apcPointsToExpire,
          expiryDate: apcPointsExpiryDate,
        }));

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

        await getAuraData();
      } else {
        console.error('Error fetching APC points balance:', apcPointsBalanceData.error);
        setState((prevState) => ({ ...prevState, isLoading: false }));
      }
    } catch (error) {
      console.error('Error fetching APC points balance:', error);
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }
  }

  const getSalesPoints = async () => {
    const { apcIdentifierNumber } = state;
    try {
      const simulateSaleAuraEndPoint = isLoggedIn ? API_URI_SIMULATE_SALES_AURA?.replace('{{identifierNo}}', apcIdentifierNumber) : API_URI_GUEST_CART_SIMILATE_SALES_AURA;
      const idCart = isLoggedIn ? cart?.data?.extension_attributes?.cart?.id : cartId;
      const salesData = await simulateSales(simulateSaleAuraEndPoint, isLoggedIn, idCart);
      if (salesData && salesData?.data?.apc_points) {
        setSalesPoints(salesData?.data?.apc_points);
      }
    } catch (error) {
      console.error('Error simulating sales:', error);
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }
  }

  const processCheckout = async (data, type) => {
    const countryCode = data?.countryCode?.replace('+', '') || '';
    const value = (data.type === 'phone')
      ? countryCode + data.value
      : data.value;

    try {
      const enrolledEndPoint = `${API_URI_GET_ENROLLED_AURA}?checkEnrolledStatus=1`
        ?.replace('{{inputValue}}', value)
        ?.replace('{{searchedType}}', data.type);

      const enrolledData = await getEnrolledStatus(enrolledEndPoint, isLoggedIn);
      const { apc_identifier_number: apcIdentifierNumber, email, mobile } = enrolledData ?? {};

      if (!apcIdentifierNumber) {
        showErrorMessage(type);

        return;
      }

      setState((prevState) => ({
        ...prevState, email, mobile, apcIdentifierNumber,
      }));

      try {
        await setLoyaltyCard(apcIdentifierNumber, isLoggedIn, cartId, isLoggedIn ? API_URI_SET_LOYALTY_AURA : API_URI_SET_LOYALTY_AURA_GUEST);
      } catch (error) {
        console.error('Error setting loyalty card:', error);
        setState((prevState) => ({ ...prevState, isLoading: false }));
      }

      await getSalesPoints();
      await getAvailableAPCPoints(apcIdentifierNumber);
    } catch (error) {
      setState((prevState) => ({ ...prevState, isLoading: false }));
    } finally {
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }
  };

  const addCard = (event, inputData = false) => {
    const { linkCardOption, countryPrefix } = state;
    const userInput = inputData || getUserInput(`${linkCardOption}Checkout`, placeholders);

    if (userInput && Object.keys(userInput).length === 0) return;

    setState((prevState) => ({
      ...prevState,
      userInput,
    }));

    if (hasValue(userInput)) {
      const { type } = userInput;
      setState((prevState) => ({ ...prevState, isLoading: true }));
      const data = { ...userInput, action: 'add' };
      if (type === 'phone') {
        data.countryCode = countryPrefix;
      }

      if (shouldEnableCheckoutAuraV2) checkEnrollmentAndSendOTP(data, `${linkCardOption}Checkout`);
      else processCheckout(data, `${linkCardOption}Checkout`);
    }
  };

  const checkEnrollmentAndSendOTP = async (data, type) => {
    const countryCode = data?.countryCode?.replace('+', '') || '';
    const value = (data.type === 'phone')
      ? countryCode + data.value
      : data.value;

    const enrolledEndPoint = API_URI_GET_ENROLLED_AURA
      ?.replace('{{inputValue}}', value)
      ?.replace('{{searchedType}}', data.type);

    const enrolledData = await getEnrolledStatus(enrolledEndPoint, isLoggedIn);
    const { apc_identifier_number: apcIdentifierNumber, email, mobile } = enrolledData ?? {};

    if (!apcIdentifierNumber) {
      showErrorMessage(type);
      setState((prevState) => ({ ...prevState, isLoading: false }));
      return;
    }

    setState((prevState) => ({ ...prevState, email, mobile, apcIdentifierNumber }));

    await sendOTP(apcIdentifierNumber);
  }

  const sendOTP = async (identifierNo, showSuccessMessage = false) => {
    const { type } = state.userInput;
    const { apcIdentifierNumber } = state;
    setState((prevState) => ({ ...prevState, isLoading: true, errorMessage: '' }));
    const getRedeemPtsAuraEndPoint = ApiConstants.API_URI_GET_REDEEM_PTS_AURA?.replace('{{identifierNo}}', apcIdentifierNumber || identifierNo);
    const response = await getRestApiClient(getRedeemPtsAuraEndPoint, isLoggedIn, 'GET', '', 'V2');
    if (!response?.response) {
      showError(getInlineErrorSelector(type)[type], 'OTP send unsuccessful');
      setState((prevState) => ({ ...prevState, isLoading: false }));
    }

    if (showSuccessMessage) window.dispatchEvent(new CustomEvent('react:showToastNotification', { detail: { message: checkoutAuraResendOtpSuccessMessage } }));
    setState((prevState) => ({ ...prevState, isLoading: false, showOTPVerification: true }));
  }

  const verifyOTP = async (verifyOTPToLink = false) => {
    setState((prevState) => ({ ...prevState, isLoading: true, errorMessage: '' }));
    const { linkCardOption, countryPrefix, userInput, apcIdentifierNumber } = state;
    const { type } = userInput;
    const verifyOtpAuraEndPoint = ApiConstants.API_URI_VERIFY_OTP_AURA?.replace('{{identifierNo}}', apcIdentifierNumber).replace('{{otp}}', otp);
    const response = await getRestApiClient(verifyOtpAuraEndPoint, isLoggedIn, 'GET', '', 'V2');
    if (!response?.response) {
      setState(prevState => ({ ...prevState, errorMessage: checkoutAuraInvalidOtpErrorMessage, isLoading: false }));
      return;
    }

    const data = { ...userInput, action: 'add' };
    if (type === 'phone') {
      data.countryCode = countryPrefix;
    }
    if (!verifyOTPToLink) processCheckout(data, `${linkCardOption}Checkout`);
  }

  const selectOption = (option) => {
    const type = `${option}Checkout`;
    removeError(getInlineErrorSelector(type)[type]);

    setState((prevState) => ({
      ...prevState,
      linkCardOption: option,
    }));
  };

  const verifyOtpLinkAura = async (otpValue, apcIdentifierId) => {
    setState(prevState => ({ ...prevState, isLoading: true }));
    const customer = await getCustomer();
    if (customer?.id) {
      const body = {
        statusUpdate: {
          apcIdentifierId,
          link: 'Y',
          autoLink: false,
          otp: otpValue,
          customerId: customer.id,
        },
      };
      const response = await getRestApiClient(ApiConstants.API_URI_APC_STATUS_UPDATE, isLoggedIn, 'POST', body, 'V1');
      if (response?.response?.data?.message) {
        console.error('Error:', response.response.data.message);
        setState(prevState => ({ ...prevState, isLoading: false }));
        return;
      }

      await getAuraData();
      setState(prevState => ({ ...prevState, isLoading: false }));
      return;
    }

    await verifyOTP();
    setState(prevState => ({ ...prevState, isLoading: false }));
  }

  const renderSalesInfo = () => (
    <div className="loyalty__salesinfo">
      <span className="loyalty__salesinfo__points-earned-message">{updatedSalesText}</span>
      <AuraToolTip data='' newClass="question" type="info" content={earnAuraPointsInfo} salesPoints={salesPoints} />
    </div>
  );

  const renderFormItems = () => (
    <>
      <div className="spc-aura-link-card-wrapper">
        <div className="form-items">
          {
            !showOTPVerification
              ? (
                <>
                  {(linkCardOption === 'email')
                    && <LinkCardOptionEmail email={email} loyaltyEmailPlaceholder={loyaltyEmailPlaceholder} />}
                  {(linkCardOption === 'cardNumber')
                    && <LinkCardOptionCard cardNumber={cardNumber} loyaltyCardPlaceholder={loyaltyCardPlaceholder} />}
                  {(linkCardOption === 'mobile')
                    && (
                      <LinkCardOptionMobile
                        loyaltyMobilePlaceholder={loyaltyMobilePlaceholder}
                      />
                    )}
                </>
              )
              : <input
                type="number"
                id="spc-aura-link-card-input-card"
                autoComplete="off"
                name="spc-aura-link-card-input-card"
                className="spc-aura-link-card-input-card spc-aura-link-card-input"
                aria-label="mobile number"
                placeholder={'OTP'}
                value={otp}
                required
                onChange={(event) => setState((prevState) => ({ ...prevState, otp: event.target.value, errorMessage: '' }))}
              />
          }
          <button
            type="submit"
            className="spc-aura-link-card-submit spc-aura-button"
            disabled={false}
            onClick={() => showOTPVerification
              ? +auraDetails?.aura_link === AppConstants.APC_LINK_STATUSES.NOT_LINKED_DATA_PRESENT ? verifyOtpLinkAura(otp, auraDetails.aura_membership) : verifyOTP()
              : addCard()}
          >
            {
              showOTPVerification
                ? checkoutAuraVerifyBtnText
                : shouldEnableCheckoutAuraV2 ? checkoutAuraSendOtpBtnText : submitText}
          </button>
        </div>
        {errorMessage ? <div id="spc-aura-link-api-response-message" className="spc-aura-link-api-response-message error">{errorMessage}</div> : null}
      </div>
    </>
  );

  const renderOTPVerification = () => (
    <div className='checkout__aura__otp-verifications'>
      <span>{checkoutAuraOtpSentText}</span>
      {renderFormItems()}
      <span className='aura__resend-otp' onClick={() => sendOTP('', true)}>{checkoutAuraResendOtpBtnText}</span>
    </div>
  )

  const render = () => (
    <>
      {
        points === 0 && (
          <>
            <div className="aura-details__container">
              <AuraToolTip data={enterAuraDetails} type="info" content={enterAuraDetailsToolTip} />
            </div>
            <AuraFormFieldOptions
              selectedOption={linkCardOption}
              selectOptionCallback={selectOption}
              cardNumber={cardNumber}
            />
          </>
        )
      }
      <div className="spc-aura-link-card-form-content active">
        {
          points === 0
            ? renderFormItems()
            : <RedeemAuraPoints points={points} mobile={mobile} expiryDate={expiryDate} expiringPoints={expiringPoints} apcIdentifierNumber={apcIdentifierNumber} />
        }
      </div>
    </>
  );

  const renderV2 = () => (
    <>
      <div className='loyalty__header'>
        <div className='loyalty__header-left'>
          <Icon name='cart-aura' />
        </div>
        <div className='loyalty__header-right'>
          <div className='checkout__aura__info-chip' dangerouslySetInnerHTML={{ __html: checkoutAuraEarnPointsText?.replace('{{AURA_POINTS}}', `<span>${salesPoints}</span>`) }}></div>
        </div>
      </div>
      <div className='checkout__aura-details-container'>
        {renderContent()}
      </div>
    </>
  );

  const renderContent = () => {
    if (points > 0) {
      return <RedeemAuraPoints shouldRenderV2={true} points={points} mobile={mobile} expiryDate={expiryDate} expiringPoints={expiringPoints} apcIdentifierNumber={apcIdentifierNumber} />;
    } else {
      switch (+auraDetails?.aura_link) {
        case AppConstants.APC_LINK_STATUSES.NOT_LINKED_DATA_PRESENT:
          return (
            showOTPVerification
              ? renderOTPVerification()
              : <div className='checkout__aura__link-account-container'>
                <div className='aura__link-account__top'>
                  <div className='checkout__aura__info-chip'>
                    {accountToLink} <span>{auraDetails?.aura_membership?.match(/.{1,4}/g).join(' ')}</span>
                  </div>
                </div>
                <div className='aura__link-account__bottom'>
                  <span className='checkout__aura__primary-text'>{auraLinkAccountInfoText}</span>
                  <button
                    type="submit"
                    className="spc-aura-button"
                    onClick={sendOTP}
                  >
                    {checkoutAuraLinkAuraBtnText}
                  </button>
                </div>
              </div>
          );

        case AppConstants.APC_LINK_STATUSES.LINKED_VERIFIED:
          return (
            <RedeemAuraPoints
              shouldRenderV2={true}
              points={points}
              mobile={mobile}
              expiryDate={expiryDate}
              expiringPoints={expiringPoints}
              apcIdentifierNumber={apcIdentifierNumber}
            />
          );

        case AppConstants.APC_LINK_STATUSES.LINKED_NOT_VERIFIED:
          return (
            <span className='checkout__aura__primary-text'>{checkoutAuraRedeemPointsAppText}</span>
          );

        default:
          return (
            !showOTPVerification
              ? (
                <div className='checkout__aura__enrollment-container'>
                  <span>{checkoutAuraEnterEnrollmentDetailsText}</span>
                  <div className='checkout__aura__enrollment-input-container'>
                    <AuraFormFieldOptions
                      selectedOption={linkCardOption}
                      selectOptionCallback={selectOption}
                      cardNumber={cardNumber}
                    />
                    {renderFormItems()}
                  </div>
                  <span className='checkout__aura__text-dark'>{checkoutAuraSendOtpText}</span>
                </div>
              )
              : renderOTPVerification()
          );
      }
    }
  };

  return (
    <>
      <div className="loyalty__main-wrapper">
        {isLoading && (
          <div className="loader_overlay">
            <Loader />
          </div>
        )}
        {shouldEnableCheckoutAuraV2 ? renderV2() : render()}
      </div>
      {!shouldEnableCheckoutAuraV2 ? renderSalesInfo() : null}
    </>
  );
}

export default AuraDetailsForm;
