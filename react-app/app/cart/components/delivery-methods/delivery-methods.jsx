import React, { useContext } from 'react';
import './delivery-method.css';
import CartContext from '../../../../context/cart-context';

function DeliveryMethods({ data }) {
  const { configs } = useContext(CartContext);
  const enableOrderSummaryV2 = configs['cart-enable-order-summary-v2'] === 'true';

  return (
    <div className={`delivery__proposition-wrapper slide-up-animation ${enableOrderSummaryV2 ? 'delivery__proposition-wrapper-v2' : ''}`}>
      {data && Array.from(data).map((item, index) => (
        <div className="proposition-item" key={`delivery-method-${index}`}>
          <span dangerouslySetInnerHTML={{ __html: item.innerHTML }} />
        </div>
      ))}
    </div>
  );
}

export default DeliveryMethods;
