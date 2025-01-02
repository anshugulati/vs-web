import React, { useContext } from 'react';
import './checkout-method-option.css';
import Icon from '../../../../library/icon/icon';
import CartContext from '../../../../context/cart-context';
import { STANDARD_DELIVERY_CODE } from '../../../cart/constants';

function CheckoutMethodOption({
  isDisabled, id, value, iconHM, iconBBW, subTitle, subTitleRight, title, selectedMethod, handleDeliveryMethodChange, name, className, info, shippingIcon, isAuraStartOrVip, methodCode
}) {
  const { configs } = useContext(CartContext);
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';
  return (
    <div key={id} className={`checkout__methods-option ${className ?? ''} ${isDisabled ? 'disabled' : ''}`}>
      <input
        id={`delivery-method-${value}`}
        name={name}
        type="radio"
        value={value}
        className="radio-checked"
        disabled={isDisabled}
        checked={selectedMethod === value}
        onChange={handleDeliveryMethodChange}
      />
      <div className="checkout__methods-label">
        {iconHM && !shouldEnableDeliveryAndBillingAddressV2 && <Icon name={iconHM} className="icon-wrapper" />}
        {shippingIcon && shouldEnableDeliveryAndBillingAddressV2 && <Icon name={shippingIcon} className="icon-wrapper" />}
        <div className="checkout__methods-description">
          <div className="checkout__methods-type">
            <span className={selectedMethod === value ? 'highlight-title' : ''}>{subTitle}</span>
            {subTitleRight && <span className={`sub-title-right ${isAuraStartOrVip && methodCode === STANDARD_DELIVERY_CODE ? 'aura-free' : ''}`}>{subTitleRight}</span>}
          </div>
          <span className="checkout__methods-title">{title}</span>
          {info && <span className="checkout__methods-info">{info}</span>}
        </div>
        {shouldEnableDeliveryAndBillingAddressV2 && iconBBW && <Icon name={iconBBW} className="icon-wrapper" />}
      </div>
    </div>
  );
}

export default CheckoutMethodOption;
