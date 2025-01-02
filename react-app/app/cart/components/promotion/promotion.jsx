import React, { useContext, useEffect, useState } from 'react';
import './promotion.css';
import DiscountAndVouchers from '../discount-and-vouchers/discount-and-vouchers';
import CartContext from '../../../../context/cart-context';
import Loader from '../../../../shared/loader/loader.jsx';
import { getConfigValue, getLanguageAttr } from '../../../../../scripts/configs.js';
import Icon from '../../../../library/icon/icon.jsx';
import updateCart from '../../../../api/updateCart.js';
import getSubCartGraphql from '../../../../api/getSubCartGraphql.js';
import ApiConstants from '../../../../api/api.constants.js';
import Tamara from '../../../../utils/tamara-utils';

function Promotion() {
  const lang = getLanguageAttr();
  const {
    cartId, isLoggedIn, cart, setCart, promotion, setPromotion, placeholders, oosDisableButton, setTamaraAvailable, bbwPromotionalSection, outOfStockData, bbwVoucherApply, isBBWVoucherEnabled
  } = useContext(CartContext);
  const appliedCoupon = cart?.data?.extension_attributes?.totals?.coupon_code ?? '';
  const [promoCode, setPromoCode] = useState(appliedCoupon);
  const [appliedPromoCode, setAppliedPromoCode] = useState(appliedCoupon);
  const [configData, setConfigData] = useState({});

  useEffect(() => {
    (async () => {
      const helloMemberDisabled = await getConfigValue('hello-member-disabled');
      setConfigData({ helloMemberDisabled : helloMemberDisabled && helloMemberDisabled.toLowerCase() === 'true' ? true : false });
    })()
  }, [])

  useEffect(() => {
    setPromoCode(appliedCoupon);
    setAppliedPromoCode(appliedCoupon);
  }, [appliedCoupon]);

  useEffect(() => {
    if (bbwVoucherApply) {
      setPromoCode(bbwVoucherApply);
      setAppliedPromoCode(bbwVoucherApply);
    }
  }, [bbwVoucherApply]);

  const promoCodeChangeHandler = (promoCodeValue) => {
    setPromoCode(promoCodeValue);
    setPromotion({ ...promotion, errorMessage: '' });
  };

  const getErrorMessage = (message) => (message?.toLowerCase() === 'internal server error' ? placeholders.promotionInvalidCodeMessage : (message ?? ''));

  const getUpdatedCart = async () => {
    const result = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PRICES, ApiConstants.CART_QUERY__EXTENSION_ATTRIBUTE]);
    if (result) {
      setCart({ ...cart, data: { ...cart?.data, ...result } });
      await Tamara.isAvailable({ ...cart, data: { ...cart?.data, ...result } }, setTamaraAvailable, isLoggedIn)
    };
  };

  const handleApplyClick = async () => {
    if (promoCode) {
      setPromotion({ ...promotion, isApplyingPromoCode: true, errorMessage: '' });
      const request = {
        extension: {
          action: 'apply coupon',
        },
        coupon: promoCode,
      };
      const result = await updateCart(request, cartId, isLoggedIn);
      if (result.response_message?.[1] === 'success') {
        window.dispatchEvent(
          new CustomEvent('react:dataLayerPromoCodeEvent', {
            detail: {
              couponCode: promoCode,
              couponStatus: 'pass',
            },
          }),
        );
        setAppliedPromoCode(promoCode);
        await getUpdatedCart();
      }
      if (result.response_message?.[1] === 'error_coupon') {
        window.dispatchEvent(
          new CustomEvent('react:dataLayerPromoCodeEvent', {
            detail: {
              couponCode: promoCode,
              couponStatus: 'fail',
            },
          }),
        );

        window.dispatchEvent(
          new CustomEvent('react:dataLayerCartErrorsEvent', {
            detail: {
              eventLabel: promoCode,
              eventAction: result.response_message?.[0],
              eventPlace: `Error occured on ${window.location.href}`,
              couponCode: promoCode,
            },
          }),
        );
      }
      setPromotion({
        ...promotion,
        isApplyingPromoCode: false,
        errorMessage: result.response_message?.[1] === 'error_coupon' ? getErrorMessage(result.response_message?.[0]) : '',
      });
    } else {
      window.dispatchEvent(
        new CustomEvent('react:dataLayerPromoCodeEvent', {
          detail: {
            couponCode: promoCode,
            couponStatus: 'fail',
          },
        }),
      );
      setPromotion({ ...promotion, errorMessage: placeholders.promotionRequiredValidationErrorMessage });
    }
  };

  const handleRemovePromoClick = async () => {
    setPromotion({ ...promotion, isRemovingPromoCode: true, errorMessage: '' });
    const request = {
      extension: {
        action: 'remove coupon',
      },
      coupon: promoCode,
    };
    const result = await updateCart(request, cartId, isLoggedIn);
    if (result.response_message?.[1] === 'success') {
       await getUpdatedCart();
       if(result.totals.coupon_code === promoCode){
        setAppliedPromoCode('');
        setPromoCode('');
      } else {
        setAppliedPromoCode(result.totals.coupon_code);
        setPromoCode(result.totals.coupon_code);
      }
    }
    setPromotion({
      ...promotion,
      isRemovingPromoCode: false,
      errorMessage: result.response_message?.[1] === 'error_coupon' ? getErrorMessage(result.response_message?.[0]) : '',
    });
   
  };

  let checkAllProductOutOfStock = cart?.data?.items?.length === outOfStockData.length;

  const renderPromoButton = () => {
    if(bbwPromotionalSection){
      if (checkAllProductOutOfStock) return <button type="button" id="promotion-btn" className="promotion__btn-disabled">{placeholders.promotionApplyButtonLabel}</button>;
    }else{
      if (oosDisableButton) return <button type="button" id="promotion-btn" className="promotion__btn-disabled">{placeholders?.promoBtn}</button>;
    }
    if (appliedPromoCode) return <button type="button" id="promotion-btn" className="promotion__btn-disabled">{placeholders.promotionAppliedButtonLabel}</button>;
    return <button type="button" id="promotion-btn" className={promotion.isApplyingPromoCode ? 'loader' : ''} onClick={handleApplyClick}>{!promotion.isApplyingPromoCode ? `${placeholders.promotionApplyButtonLabel}` : ''}</button>;
  };

  return (
    <div className={`cart__promotion slide-up-animation ${bbwPromotionalSection ? 'bbw-promotional-section' : ''}`}>
      <div className="promotion__header">
        <span id="promotion__label">{bbwPromotionalSection && <Icon name="tag" className="promotion_tag" />}{placeholders.promotionLabel}</span>
        {!configData?.helloMemberDisabled && ((isBBWVoucherEnabled && bbwPromotionalSection) || !bbwPromotionalSection) ? <DiscountAndVouchers className={`${lang === 'ar' ? 'promotion__discount-mg-rt-auto' : 'promotion__discount-mg-lt-auto'} promotion__discount--desktop`} /> : null}
      </div>
      <div className="promotion__form">
        <div className="promotion__input-error-container">
          <div className="promotion__input-container">
            <div className={`promotion__input ${promotion.errorMessage && !appliedPromoCode ? 'promotion__input-error' : ''} ${checkAllProductOutOfStock ? 'disable-promo-input' : ''}`}>
              {bbwPromotionalSection ? 
              (<input className={(appliedPromoCode || checkAllProductOutOfStock) ? 'promotion__input-disabled' : ''} type="text" id="promotion-input" placeholder={placeholders.promotionInputPlaceholder} value={promoCode} onChange={(e) => promoCodeChangeHandler(e.target.value)} disabled={promotion.isApplyingPromoCode} />): 
              (<input className={(appliedPromoCode || oosDisableButton) ? 'promotion__input-disabled' : ''} type="text" id="promotion-input" placeholder={placeholders.promotionInputPlaceholder} value={promoCode} onChange={(e) => promoCodeChangeHandler(e.target.value)} disabled={promotion.isApplyingPromoCode} />)}
            </div>
            {appliedPromoCode && (promotion.isRemovingPromoCode
              ? <div className="promotion__remove-icon"><Loader /></div>
              : <Icon className="promotion__remove-icon" id="remove-promo" name={bbwPromotionalSection ? 'close-round-grey':'close-round-black'} onIconClick={handleRemovePromoClick} />
            )}
            {renderPromoButton()}
          </div>
          {promotion.errorMessage && !appliedPromoCode &&(
            <div className="promotion_error">
              <Icon name="info-circle" className="promotion_error-icon" />
              <span className="error">{promotion.errorMessage}</span>
            </div>
          )}
        </div>
        {!configData?.helloMemberDisabled &&<DiscountAndVouchers className="promotion__discount--mobile" />}
      </div>
    </div>
  );
}

export default Promotion;