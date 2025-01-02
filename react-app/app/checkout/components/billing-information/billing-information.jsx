import React, { useContext } from 'react';
import './billing-information.css';
import CartContext from '../../../../context/cart-context';
import DeliveryInformationHeader from '../delivery-information/delivery-information-header.jsx';
import AppConstants from '../../../../utils/app.constants.js';
import AddressForm from '../address-form.jsx';

function BillingInformation({ selectedMethod }) {
  const {
    cart,
    placeholders,
    deliveryInformation,
    setDeliveryInformation,
    setEditAddress,
    isHideSectionInCheckout,
    methods,
    isTopupFlag,
    configs
  } = useContext(CartContext);
  const shouldEnableDeliveryAndBillingAddressV2 = configs['checkout-delivery-and-billing-address-v2'] === 'true';

  const {
    billingAddressTitle = 'Billing Address',
    deliveryInformationBtnText = '',
  } = placeholders;

  const billingAddress = cart?.data?.extension_attributes?.cart?.billing_address;
  const handleChangeClick = (address) => {
    setEditAddress(address);
    setDeliveryInformation({
      ...deliveryInformation, isDialogOpen: true, isModalVisible: true, changeAddress: 'billing',
    });
  };

  const isCashOnDeliverySelected = methods?.find((method) => method?.code === AppConstants.PAYMENT_METHOD_CODE_COD)?.isSelected || false;
  const handleButtonClick = () => {
    setDeliveryInformation({
      ...deliveryInformation, isDialogOpen: true, isModalVisible: true, changeAddress: 'billing',
    });
  };
  if ((isHideSectionInCheckout && !billingAddress?.firstname) || (isTopupFlag && !billingAddress?.firstname) || (selectedMethod !== 'home_delivery' && !billingAddress?.firstname)) {
    return (
      <div className={`checkout__delivery-information ${shouldEnableDeliveryAndBillingAddressV2 ? 'checkout__delivery-information-v2' : ''}`}>
        <div className="checkout__billing-information-title checkout__sub-container-title">
          {billingAddressTitle}
        </div>
        {
          shouldEnableDeliveryAndBillingAddressV2
            ? <AddressForm isBilling={true} />
            : <button type="button" className="checkout__delivery-information-btn" onClick={handleButtonClick}>
              {deliveryInformationBtnText}
            </button>
        }
      </div>
    );
  }

  const defaultRenderUI = ((!isCashOnDeliverySelected && billingAddress?.firstname && !isHideSectionInCheckout) || (isTopupFlag && billingAddress?.firstname) || (isHideSectionInCheckout && billingAddress?.firstname));
  return (
    defaultRenderUI ? (
      <div className="checkout__billing-information">
        <div className="checkout__billing-information-title checkout__sub-container-title">
          {billingAddressTitle}
        </div>
        <div className="checkout__billing-information-wrapper">
          <div className="checkout__billing-information__header">
            <DeliveryInformationHeader
              shippingAddress={billingAddress}
              placeholders={placeholders}
              handleChangeClick={() => handleChangeClick(billingAddress)}
              isInfoSection={true}
            />
          </div>
        </div>
      </div>
    ) : null
  );
}

export default BillingInformation;
