import React, {
  useContext, useEffect, useMemo, useState,
} from 'react';
import './account-registration.css';
import Icon from '../../../../library/icon/icon';
import Input from '../../../../library/Form/Input/input';
import { fetchStoreViews } from '../../../../../scripts/customer/register-api';
import CartContext from '../../../../context/cart-context';
import registerCustomer from '../../../../api/registerCustomer';
import loginCustomer from '../../../../api/loginCustomer';
import { setCookie } from '../../../../../scripts/commerce';
import AuraDetails from '../aura-details/aura-details';
import OtpVerify from '../aura-details/otp-verify';
import ApiConstants from '../../../../api/api.constants';
import { getRedeemPoint } from '../../../../api/auraDetails';

function AccountRegistration({ customerDetails }) {
  const {
    configs, content, placeholders, isLoggedIn, auraAccountData, shouldEnableProductCardV2,
  } = useContext(CartContext);
  const [accountRegistrationTitle, ...accountRegistrationOffersAndDeals] = content?.accountRegistration ?? [];
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [offersConfirmation, setOffersConfirmation] = useState(true);
  const [isAccountRegistered, setIsAccountRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isValidLength, setIsValidLength] = useState(false);
  const [isValidSpecialChar, setIsValidSpecialChar] = useState(false);
  const [isValidNumber, setIsValidNumber] = useState(false);
  const [isValidNoSpaces, setIsValidNoSpaces] = useState(true);
  const [auraChecked, setAuraChecked] = useState(true);
  const [showOtpBlock, setShowOtpBlock] = useState(false);
  const [isSendingOtp, setSendingOtp] = useState(false);

  const isPasswordValid = useMemo(() => isValidLength && isValidSpecialChar && isValidNumber && isValidNoSpaces);
  const storeCode = configs['commerce-store-view-code'];
  const cookieExpiryDays = configs['commerce-login-cookie-expiry-days'] || 100;
  const isAuraEnabled = configs['is-aura-enabled'] === 'true';

  useEffect(() => {
    window.addEventListener('react:handleQuickEnrollResponse', (response) => {
      setIsAccountRegistered(!!response);
    }, { once: true });
  }, []);

  const buttonCta = useMemo(() => {
    let buttonText = placeholders.completeRegistration;
    if (auraChecked) {
      if (auraAccountData.apc_identifier_number) {
        buttonText = placeholders.registerLinkAuraCtaText;
      } else {
        buttonText = placeholders.orderConfirmationAccountRegistrationCta;
      }
    }
    return buttonText;
  }, [auraChecked, auraAccountData]);

  const validatePassword = (password) => {
    setIsValidLength(password.length >= 8);
    setIsValidSpecialChar(/[\W_]/.test(password));
    setIsValidNumber(/\d/.test(password));
    setIsValidNoSpaces(!/\s/.test(password));
  };

  const handlePasswordChange = (event) => {
    setErrorMessage('');
    const newPassword = event.target.value;
    setPassword(newPassword);
    validatePassword(newPassword);
  };

  const sendOtp = (mobile) => {
    setSendingOtp(true);
    window.dispatchEvent(
      new CustomEvent('react:handleLoginMobile', {
        detail: {
          message: {
            mobile,
          },
        },
      }),
    );
    window.addEventListener('react:loginMobileResponse', (response) => {
      setShowOtpBlock(response.detail.response);
      if (response.detail.response) {
        window.dispatchEvent(new CustomEvent('react:showToastNotification', { detail: { message: placeholders.otpSentTextToast } }));
      } else {
        window.dispatchEvent(new CustomEvent('react:showPageErrorMessage', {
          detail: {
            message: placeholders.otpMaxLimitReached,
          },
        }));
      }
      setSendingOtp(false);
    }, { once: true });
  };

  const onAccountRegisterHandler = async () => {
    if (isPasswordValid) {
      setIsRegistering(true);
      const storeViews = await fetchStoreViews();
      const storeView = storeViews.find((view) => view.code === storeCode);
      const websiteId = storeView?.website_id || 1;
      const storeId = storeView?.id || 1;

      const payload = {
        customer: {
          email: customerDetails.email,
          firstname: customerDetails.firstName,
          lastname: customerDetails.lastName,
          websiteId,
          storeId,
          custom_attributes: [
            { attribute_code: 'channel', value: 'web' },
            { attribute_code: 'phone_number', value: `${customerDetails.phoneNumber}` },
            { attribute_code: 'communication_preference', value: 'email' },
          ],
          extension_attributes: {
            is_subscribed: offersConfirmation,
            is_verified: 'Y',
          },
        },
        password,
      };
      const result = await registerCustomer(payload);
      if (result?.response?.id) await login(customerDetails.email, password, result.response.id);
      else if (result?.response?.message) window.dispatchEvent(new CustomEvent('react:showToastNotification', { detail: { message: result.response.message } }));
      setIsRegistering(false);
      if (auraChecked) {
        if (auraAccountData.apc_identifier_number) {
          const getRedeemPtsAuraEndPoint = ApiConstants.API_URI_GET_REDEEM_PTS_AURA?.replace('{{identifierNo}}', auraAccountData.apc_identifier_number);
          const redeemPointsData = await getRedeemPoint(getRedeemPtsAuraEndPoint, isLoggedIn);
          setShowOtpBlock(redeemPointsData);
        } else {
          sendOtp(customerDetails.phoneNumber);
        }
      }
    } else {
      setErrorMessage('Please follow the below mentioned password criteria');
    }
  };
  const login = async (username, password, userID) => {
    const payload = { username, password };
    const result = await loginCustomer(payload);
    if (result?.response) {
      sessionStorage.setItem('userId', userID);
      setCookie('auth_user_token', result.response, cookieExpiryDays);
    }
    if (!auraChecked) setIsAccountRegistered(true);
  };

  const renderRegistrationForm = () => {
    if (showOtpBlock) { return <OtpVerify customerDetails={customerDetails} sendOtp={sendOtp} isSendingOtp={isSendingOtp} />; }
    return (
      <>
        <div className="account-registration__header">
          <span className="account-registration__title" dangerouslySetInnerHTML={{ __html: accountRegistrationTitle?.innerHTML }} />
          <div className="account-registration__offers__wrapper">
            {
                            accountRegistrationOffersAndDeals?.map((offer) => <div className="account-registration__offer" dangerouslySetInnerHTML={{ __html: offer?.innerHTML }} />)
                        }
          </div>
        </div>
        <div className="account-registration__body">
          <Input
            label={placeholders?.orderConfirmationPasswordPlaceholder}
            type={showPassword ? 'text' : 'password'}
            value={password}
            icon="eye"
            onIconClick={() => setShowPassword((prev) => !prev)}
            onChange={handlePasswordChange}
            errorMessage={errorMessage}
          />
          <div className="account-registration__password-validations">
            <div className={`account-registration__password-validation ${password && isValidLength ? 'valid' : 'invalid'}`}>
              <Icon name="tick-green" className="account-registration__password-validation-icon icon-valid" />
              <Icon name="pagination" className="account-registration__password-validation-icon icon-default" />
              <span className="account-registration__password-validation-text">{placeholders.orderConfirmationValidationsLength}</span>
            </div>
            <div className={`account-registration__password-validation ${password && isValidSpecialChar ? 'valid' : 'invalid'}`}>
              <Icon name="tick-green" className="account-registration__password-validation-icon icon-valid" />
              <Icon name="pagination" className="account-registration__password-validation-icon icon-default" />
              <span className="account-registration__password-validation-text">{placeholders.orderConfirmationValidationsSpecialChar}</span>
            </div>
            <div className={`account-registration__password-validation ${password && isValidNumber ? 'valid' : 'invalid'}`}>
              <Icon name="tick-green" className="account-registration__password-validation-icon icon-valid" />
              <Icon name="pagination" className="account-registration__password-validation-icon icon-default" />
              <span className="account-registration__password-validation-text">{placeholders.orderConfirmationValidationsNumber}</span>
            </div>
            <div className={`account-registration__password-validation ${password && isValidNoSpaces ? 'valid' : 'invalid'}`}>
              <Icon name="tick-green" className="account-registration__password-validation-icon icon-valid" />
              <Icon name="pagination" className="account-registration__password-validation-icon icon-default" />
              <span className="account-registration__password-validation-text">
                {placeholders.orderConfirmationValidationsSpaces}
                .
              </span>
            </div>
          </div>
        </div>
        {!isLoggedIn && shouldEnableProductCardV2 && (auraAccountData.apc_link !== 2 || auraAccountData.apc_link !== 3) && isAuraEnabled && (
        <AuraDetails customerDetails={customerDetails} auraChecked={auraChecked} setAuraChecked={setAuraChecked} isShowHideBorder={false} />
        )}
        <div className="account-registration__confirmation__wrapper">
          <input type="checkbox" id="account-registration-confirmation" name="account-registration-confirmation" checked={offersConfirmation} onChange={() => setOffersConfirmation((prev) => !prev)} />
          <label className="account-registration__confirmation-text" htmlFor="account-registration-confirmation">
            {' '}
            {placeholders.orderConfirmationOffersAndDealsConfirmationLabel}
          </label>
        </div>
        <div className="account-registration__actions">
          <button onClick={onAccountRegisterHandler} className={isRegistering ? 'loader' : ''}>{!isRegistering ? buttonCta : ''}</button>
        </div>
      </>
    );
  };

  const renderRegistrationSuccess = () => (
    <>
      <div className="account-registration__success-header">
        <span>{placeholders.orderConfirmationAccountRegistrationSuccessHeading}</span>
        <span>{placeholders.orderConfirmationAccountRegistrationSuccessSubHeading}</span>
      </div>
      <div className="account-registration__success-message">
        {placeholders.orderConfirmationAccountRegistrationSuccessInfo}
      </div>
    </>
  );

  return (
    <div className="order-confirmation__account-registration__wrapper">
      {!isAccountRegistered ? renderRegistrationForm() : renderRegistrationSuccess()}
    </div>
  );
}

export default AccountRegistration;
