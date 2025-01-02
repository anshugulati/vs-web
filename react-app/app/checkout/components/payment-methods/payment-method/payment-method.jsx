import React, { useContext } from 'react';
import './payment-method.css';
import CartContext from '../../../../../context/cart-context';
import AppConstants from '../../../../../utils/app.constants';
import TamaraInfoWidget from '../tamara/tamara-info-widget';

function PaymentMethod(props) {
  const {
    children,
    methodCode,
    method,
    onChangePaymentMethod,
    isDisabled,
    isDisableSection
  } = props;

  const {
    cart, configs
  } = useContext(CartContext);

  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';
  
  let disablePayment = isDisableSection;

  const checkForAuraEnable = () => {
    const isPaidByAura = cart?.data?.extension_attributes?.totals?.total_segments?.find((segment) => segment.code === AppConstants.REDEEM_PAYMENT_METHOD_CODE);
    return isPaidByAura && isPaidByAura?.value ? true : disablePayment;
  }

  // Function to check if any egift is available in cart items
  const isEgiftInCart = () => {
    const onlyEgiftItems = cart?.data?.items?.some((item) => item?.extensionAttributes?.extension_attributes?.is_egift && item?.extensionAttributes?.extension_attributes?.is_egift === '1');
    return onlyEgiftItems;
  }

  if (methodCode === AppConstants.PAYMENT_METHOD_CODE_COD || methodCode === AppConstants.PAYMENT_METHOD_TABBY || methodCode === AppConstants.PAYMENT_METHOD_CODE_TAMARA) {
    const hpsType = cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_redemption_type;
    if (hpsType) {
      disablePayment = AppConstants.PAYMENT_EGIFT_CARD_linked || hpsType === AppConstants.PAYMENT_EGIFT_CARD_GUEST ? true : isDisableSection;
    }
  }
  if (!disablePayment && (methodCode === AppConstants.PAYMENT_METHOD_CODE_TAMARA || methodCode === AppConstants.PAYMENT_METHOD_TABBY || methodCode === AppConstants.PAYMENT_METHOD_CODE_COD)) {
    disablePayment = checkForAuraEnable();
  }
  if(!disablePayment && (methodCode === AppConstants.PAYMENT_METHOD_TABBY || methodCode === AppConstants.PAYMENT_METHOD_CODE_COD || methodCode === AppConstants.PAYMENT_METHOD_CODE_FAWRY)) {
    disablePayment = isEgiftInCart();
  }

  return (
    <div className={`payment-method fadeInUp payment-method-${method.code} ${disablePayment ? 'in-active' : ''}`} role="button" tabIndex="0" disabled={isDisabled}>
      <div className="payment-method-top-panel">
        <div className="payment-method-card">
          <input
            id={`payment-method-${methodCode}`}
            className="payment-method-radio"
            type="radio"
            checked={!isDisabled && method.isSelected}
            value={methodCode}
            name="payment-method"
            disabled={isDisabled}
            onChange={() => { if (!isDisabled) onChangePaymentMethod(method); }}
          />

          <label className="radio-sim radio-label" htmlFor={`payment-method-${methodCode}`}>
            {method.title} {methodCode === AppConstants.PAYMENT_METHOD_CODE_TAMARA && <TamaraInfoWidget onInfoWidgetClick={() => { if (!isDisabled) onChangePaymentMethod(method); }}
            />}
          </label>
          <span className="payment-method-icon-container" dangerouslySetInnerHTML={{ __html: method.icon.innerHTML }} />
        </div>
        {methodCode === AppConstants.PAYMENT_METHOD_CODE_TAMARA && (
          <div className="payment-method__subtitle" dangerouslySetInnerHTML={{ __html: method.body[0]?.innerHTML }} />
        )}
      </div>
      {method.isSelected && !isDisabled && !disablePayment && children ? children : ''}
    </div>
  );
}

export default PaymentMethod;