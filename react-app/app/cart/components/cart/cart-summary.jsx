import React, { useContext, useEffect, useState } from 'react';
import Promotion from '../promotion/promotion.jsx';
import OrderSummary from './order-summary.jsx';
import DeliveryEligibilityMessage from '../delivery-eligibility-message';
import DeliveryMethods from '../delivery-methods/delivery-methods.jsx';
import AuraDetails from '../aura-details/aura-details.jsx';
import CartContext from '../../../../context/cart-context.jsx';

function CartSummary({
  deliveryMethods, cardMethodTitle, paymentLogoList, showDeliveryEligibility, isMobile,
}) {
  const { placeholders, configs } = useContext(CartContext);
  const [isAuraVip, setAuraVip] = useState('Tier 1');
  const [auraMemeberText, setAuraMemberText] = useState('');
  const isAuraEnabled = configs['is-aura-enabled'] === 'true';
  const isClmDown = configs['clm-downtime'] === 'true';
  useEffect(() => {
    (async function () {
      window.addEventListener('storage', (event) => {
        if (event.storageArea === localStorage) {
          const auraDetails = JSON.parse(localStorage.getItem('aura_common_data')) || {};
          setAuraVip(auraDetails.aura_Status === 'Tier 2' || auraDetails.aura_Status === 'Tier 3');
          const memberText = placeholders.auraMemberText.replace('x', auraDetails.aura_TierInfo);
          setAuraMemberText(memberText);
        }
      });
    }());
  });

  return (
    <div className="cart__summary-wrapper">
      {(showDeliveryEligibility && !isMobile) && <DeliveryEligibilityMessage auraMemeberText={isAuraVip && !isClmDown ? auraMemeberText : null} />}
      <Promotion />
      {isAuraEnabled && (
        <AuraDetails />
      )}
      <OrderSummary cardMethodTitle={cardMethodTitle} paymentLogoList={paymentLogoList} />
      <DeliveryMethods data={deliveryMethods} />
    </div>
  );
}

export default CartSummary;
