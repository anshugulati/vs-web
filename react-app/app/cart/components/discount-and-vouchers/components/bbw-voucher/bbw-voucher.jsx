import React, { useEffect, useContext } from 'react';
import CartContext from '../../../../../../context/cart-context.jsx';
import updateCart from '../../../../../../api/updateCart.js';
import getSubCartGraphql from '../../../../../../api/getSubCartGraphql.js';
import ApiConstants from '../../../../../../api/api.constants.js';
import { getLanguageAttr } from '../../../../../../../scripts/configs';

function BBWVouchers({ handleCloseDialog }) {
  const {
    placeholders,
    cartId,
    isLoggedIn,
    setBBWVoucherApply,
    cart,
    setCart,
  } = useContext(CartContext);

  const applyVoucher = async (event) => {
    const { voucherCode } = event.detail;
    const request = {
      extension: {
        action: 'apply coupon',
      },
      coupon: voucherCode,
    };
    const result = await updateCart(request, cartId, isLoggedIn);
    const resultData = result?.response_message?.[1] === 'success';

    if (resultData) {
      setBBWVoucherApply(voucherCode);
      const subCartUpdate = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PRICES, ApiConstants.CART_QUERY__EXTENSION_ATTRIBUTE]);
      if (subCartUpdate) {
        setCart({ ...cart, data: { ...cart?.data, ...subCartUpdate } });
      };
      handleCloseDialog();
    } else {
      setBBWVoucherApply('');
    }

    window.dispatchEvent(new CustomEvent('applyCouponResponse', {
      detail: {
        result,
        voucherCode
      },
    }));
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('react:loadFragment', { detail: { path: `/${getLanguageAttr()}/fragments/cart/coupons`, targetSelector: '.popup-vouchers-body' } }));

    window.addEventListener('applyCoupon', applyVoucher);

    return () => {
      window.removeEventListener('applyCoupon', applyVoucher);
    }
  }, []);

  return (
    <>
      <div className="popup-header">
        <span className="popup-heading">{placeholders.discountLabel}</span>
      </div>
      <div className="popup-vouchers-body"></div>
    </>
  );
}

export default BBWVouchers;
