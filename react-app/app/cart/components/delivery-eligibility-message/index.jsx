import React, { useContext } from 'react';
import CartContext from '../../../../context/cart-context.jsx';
import './index.css';
import Icon from '../../../../library/icon/icon.jsx';

const DeliveryEligibilityMessage = ({auraMemeberText}) => {
  const { cart, brandName } = useContext(CartContext);
  const extAttr = cart?.data.extension_attributes.cart.extension_attributes;
  const freeShippingText = auraMemeberText || extAttr?.free_shipping_text;
  return (
    <>
      {freeShippingText && (
        <div className='delivery-eligibility__container'>
          <div className="delivery-content">
            <Icon name={brandName === 'BB' ? "free-delivery-star" : "free-delivery-black"} />
            <div className='delivery-content-info'>
              <div dangerouslySetInnerHTML={{ __html: freeShippingText }} />
              <div className='free-delivery__progress-bar__wrapper'>
                <div className='free-delivery__progress-bar'></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeliveryEligibilityMessage;