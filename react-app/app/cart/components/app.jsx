import React, { useContext } from 'react';
import CartContext from '../../../context/cart-context.jsx';
import useGetCartGraphql from '../../../api/getCartGraphql.js';
import Cart from './cart/cart.jsx';
import Loader from '../../../shared/loader/loader.jsx';
import EmptyCart from '../../../shared/empty-cart/empty-cart.jsx';
import AppConstants from '../../../utils/app.constants.js';
import DeliveryEligibilityMessage from './delivery-eligibility-message/index.jsx';
import CartAndCheckoutLayout from '../../../shared/cart-and-checkout-layout/cart-and-checkout-layout.jsx';
import useGetBNPLPaymentMethods from '../../../api/bnplPaymentMethods.js';

/**
 * App Component.
 * @param {string} [content] block content from sharepoint docx
 * @param {string} [placeholders] locale based placeholders coming from placeholders.xlsx
 */
function App({ content }) {
  useGetCartGraphql(1);
  useGetBNPLPaymentMethods();
  const { cartId, cart, activeProgressStep, showDeliveryEligibility, isMobile  } = useContext(CartContext);
  const items = cart?.data?.items;

  const render = () => {
    if (cart.isLoading) return <Loader />;

    if (!cartId || !items?.length) {
      return (
        <EmptyCart />
      );
    }

    return (
      <>
        {(showDeliveryEligibility && isMobile) && (
          <div className="delivery-eligibility__mobile-wrapper">
            <DeliveryEligibilityMessage />
          </div>
        )}
        <div className="cart__checkout__blocks">
          {activeProgressStep === AppConstants.PROGRESS_BAR_STEP_CART && <Cart content={content} />}
        </div>
      </>
    )
  }

  return (
    <CartAndCheckoutLayout showProgressBar={!cart.isLoading && !(!cartId || !items?.length)}>
      {render()}
    </CartAndCheckoutLayout>
  );
}

export default App;
