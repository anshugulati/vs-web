/* eslint-disable jsx-a11y/label-has-associated-control */
import React, {
  useContext
} from 'react';
import './order-summary.css';
import CartContext from '../../../../context/cart-context';
import ProductSummaryCardGql from '../../../cart/components/product-summary-card-graphql';
import SubTotalSummary from './subtotal-summary';

function OrderSummary({ content }) {
  const {
    cart, isTopupFlag, configs
  } = useContext(CartContext);
  const updatedTitle = content.checkoutOrderSummaryTitle?.replace('{{COUNT}}', !isTopupFlag ? cart?.data?.total_quantity : cart?.data?.extension_attributes?.cart?.items?.length);
  const topupEgiftItems = cart?.data?.extension_attributes?.cart?.items?.filter((item) => Number(item?.extension_attributes?.is_topup) === 1);
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

  // Sort the items in the cart by id descending
  const cartItems = cart?.data?.items?.sort((a, b) => b.id - a.id);

  return (
      <div>
        <div className="checkout-order-summary-title checkout__sub-container-title">
          <span>{updatedTitle}</span>
        </div>
        <div className="checkout-order-summary-wrapper">
          <div id="checkout-items" className="checkout-items-list-container">
            {!isTopupFlag ? cart?.data?.items?.length && cartItems?.map((product) => (
                <ProductSummaryCardGql
                    key={product?.id}
                    product={product}
                    currency={cart?.data?.prices?.grand_total?.currency}
                    checkoutHideSection
                />
            )) : (topupEgiftItems?.length && topupEgiftItems?.map((product) => (
                < ProductSummaryCardGql
                    key={product?.item_id}
                    product={product}
                    // currency={product?.currency}
                    // checkoutHideSection
                />
            )))}
          </div>
          {!shouldEnableDeliveryAndBillingAddressV2 ?
              <SubTotalSummary /> : null
          }
        </div>
      </div>
  );
}

export default OrderSummary;