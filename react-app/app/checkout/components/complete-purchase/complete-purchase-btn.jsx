import React, { useContext, useEffect, useRef, useState } from 'react';
import './complete-purchase-btn.css';
import CartContext from '../../../../context/cart-context';
import Loader from '../../../../shared/loader/loader.jsx';
import AppConstants from '../../../../utils/app.constants.js';

function CompletePurchase({ purchasePolicyText, paymentRef }) {
  const { placeholders, checkoutOOSDisable, isDisablePurchaseBtn, cart, paymentMethodsContinuePurchaseLabels, selectedPaymentMethod, configs, selectedCollectionStoreForCheckout, isTelephoneInShipping, isInvalidAddress } = useContext(CartContext);
  const [isComplePurchaseLoading, setCompletePurchaseLoading] = useState(false);
  const privacyTextRef = useRef();
  const isCashOnDeliverySelected = selectedPaymentMethod === AppConstants.PAYMENT_METHOD_CODE_COD || false;
  const mobileNumberVerified = cart?.data?.extension_attributes?.cart?.extension_attributes?.mobile_number_verified;
  const isMobileNumberVerified = mobileNumberVerified === 1 || mobileNumberVerified === 2;
  const isCODSelectedAndNotVerified = isCashOnDeliverySelected && !isMobileNumberVerified;
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

  const updateDataLayer = () => {
    const deliveryOption = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type === 'home_delivery'
      ? 'Home Delivery'
      : 'Click & Collect';

    let paymentType = null;
    if (selectedPaymentMethod === 'checkout_com_upapi') {
      paymentType = 'Credit / Debit Card';
    }
    if (selectedPaymentMethod === 'checkout_com_upapi_qpay') {
      paymentType = 'NAPS Qatar Debit Card';
    }
    if (selectedPaymentMethod === 'cashondelivery') {
      paymentType = 'Cash on Delivery';
    }

    window.dispatchEvent(new CustomEvent(
      'react:datalayerEvent',
      {
        detail: {
          type: 'addPaymentInfo',
          payload: {
            value: cart.data?.prices?.grand_total?.value || 0,
            currency: cart.data?.prices?.grand_total?.currency || '',
            coupon: cart.data?.extension_attributes?.totals?.coupon_code ?? '',
            discount: cart?.data?.prices?.discount?.amount?.value || 0,
            shippingTier: cart.data.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type?.split('_').join(' '),
            deliveryOption,
            paymentType,
            storeLocation: selectedCollectionStoreForCheckout?.address?.find(item => item?.code === 'street')?.value || null,
            productData: cart?.data?.items?.map((item) => {
              return {
                item: item,
              };
            }),
          }
        },
      },
    ));
  }
  useEffect(() => {
    if(purchasePolicyText && privacyTextRef.current) {
      const anchorTags = privacyTextRef.current.getElementsByTagName('a');
      for (let ele of anchorTags) {
        ele.setAttribute("target", "_blank");
      }
    }
  },[purchasePolicyText])
  const handlePurchase = async () => {
    setCompletePurchaseLoading(true);

    try {
      updateDataLayer();
      await paymentRef?.current?.completePurchase();
    } catch (error) {
      console.error('action failed', error);
    } finally {
      setCompletePurchaseLoading(false);
    }
  };

  const renderCompletePurchaseButton = () => {
    let labelHTML = paymentMethodsContinuePurchaseLabels?.find(purchaseLabel => purchaseLabel.code === selectedPaymentMethod)?.label ?? null;

    if(!paymentRef?.current?.completePurchase){
      labelHTML = ''
    }

    return (
      <button
        id="cardPayButton"
        type="button"
        onClick={handlePurchase}
        className="complete_purchase_click"
        disabled={checkoutOOSDisable || isComplePurchaseLoading || isDisablePurchaseBtn || isCODSelectedAndNotVerified || !isInvalidAddress || (!paymentRef?.current?.completePurchase)}
      >
        {
          labelHTML
            ? <span className="complete_purchase--text" dangerouslySetInnerHTML={{ __html: labelHTML }} />
            : <span className="complete_purchase--text">{shouldEnableDeliveryAndBillingAddressV2 ? placeholders.placeOrderButton : placeholders.completePurchaseButton}</span>
        }

      </button>
    )
  };

  return (
    <div className="complete_purchase_container">
      {isComplePurchaseLoading && (
        <div className="loader_overlay">
          <Loader />
        </div>
      )}
      {shouldEnableDeliveryAndBillingAddressV2 && (

        <div className="purchase_button_wrapper">
          {renderCompletePurchaseButton()}
        </div>
      )}

      <div className="checkbox_confirm_text">
        <label className="checkbox_container" htmlFor="checkbox_purchase">
          <input id="checkbox_purchase" className="checkbox_purchase" type="checkbox" />
          <span className="custom_checkbox" />
          <span className="checkbox_text">{placeholders.completePurchaseCheckbox}</span>
        </label>
      </div>

      <div>
        <p className="purchase_policy_text">
          <span ref={privacyTextRef} dangerouslySetInnerHTML={{ __html: purchasePolicyText }} />
        </p>
      </div>
      {!shouldEnableDeliveryAndBillingAddressV2 && (
        <div className="purchase_button_wrapper">
          {renderCompletePurchaseButton()}
        </div>
      )
      }

    </div>
  );
}

export default CompletePurchase;