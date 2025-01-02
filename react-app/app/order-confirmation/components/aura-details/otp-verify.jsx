import React, { useContext, useState } from 'react';
import OtpTimer from 'otp-timer';
import CartContext from '../../../../context/cart-context';
import './aura-details.css';
import Icon from '../../../../library/icon/icon';
import ApiConstants from '../../../../api/api.constants';
import { verifyOtp } from '../../../../api/auraDetails';
import Loader from '../../../../shared/loader/loader';

export default function OtpVerify({ customerDetails, sendOtp, isSendingOtp }) {
  const { placeholders, auraAccountData, isLoggedIn } = useContext(CartContext);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  function otpOnChangeHandler(event) {
    const otpStr = event.target.value.slice(0, 6);
    setOtp(otpStr);
    setError('');
  }
  async function onClickVerify() {
    if (!otp) {
      setError(placeholders.otpEmptyError);
      return;
    }
    if (auraAccountData.apc_identifier_number) {
      const verifyOtpAuraEndPoint = ApiConstants.API_URI_VERIFY_OTP_AURA?.replace('{{identifierNo}}', auraAccountData.apc_identifier_number).replace('{{otp}}', otp);
      const otpData = await verifyOtp(verifyOtpAuraEndPoint, isLoggedIn);
      if (otpData)
        window.dispatchEvent(new CustomEvent('react:handleQuickEnrollResponse', { response: otpData }));
      else
        setError(placeholders.otpWrongError);
    } else {
      window.dispatchEvent(new CustomEvent('react:handleQuickEnroll', {
        detail: {
          otp,
          isVerified: 'Y',
          ...customerDetails,
        },
      }));
    }
    window.addEventListener('react:otpVerificationFailed', () => {
      setError(placeholders.otpWrongError);
    }, { once: true });
  }
  return (
    <div id="otp-verify-form">
      <div>
        {placeholders.otpSentText}
        {' '}
        {customerDetails.phoneNumber}
      </div>
      <input
        type="number"
        id="otp-input"
        name="otp-input"
        value={otp}
        placeholder={placeholders.otpPlaceholder}
        required
        maxLength={6}
        onChange={otpOnChangeHandler}
        onKeyDown={(event) => event.key !== 'e' && event.key !== 'E'}
        autoComplete="one-time-code"
      />
      {error && (
        <div className="otp-error">
          <Icon name="info-small-error" className="info-error-icon" />
          <span>{error}</span>
        </div>
      )}
      <button onClick={onClickVerify}>{placeholders.verifyButtonText}</button>
      <div className='otp-timer-text-wrapper'>
        {placeholders.codResendOtpText}
        {' '}
        <div className='cod-text-action'>
          {isSendingOtp ? <div><Loader />Resending</div> :
            <OtpTimer
              key={customerDetails.phoneNumber}
              seconds={+placeholders.codOtpResendTimeInSeconds}
              minutes={0}
              resend={() => sendOtp(customerDetails.phoneNumber)}
              text="Resend in"
              ButtonText={<span className='otp-timer-text'>{placeholders.codResendOtpCta} <Icon name="chevron-right-blue" /></span>}
            />}
        </div>
      </div>
    </div>
  );
}
