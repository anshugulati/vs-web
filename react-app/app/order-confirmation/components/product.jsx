import React, { useContext } from 'react';
import CartContext from '../../../context/cart-context.jsx';
import useCurrencyFormatter from '../../../utils/hooks/useCurrencyFormatter.jsx';
import { getLanguageAttr } from '../../../../scripts/configs.js';
import AppConstants from '../../../utils/app.constants.js';
import Icon from '../../../library/icon/icon.jsx';

function PurchasedProduct({ product, index, uniqueProducts, completeOrderData }) {
  const { placeholders, configs, isLoggedIn } = useContext(CartContext);
  const price = uniqueProducts?.[index]?.price_incl_tax;
  const decimalPrice = useCurrencyFormatter({ price });
  const isGiftCardTopup = product?.sku === AppConstants.GIFT_CARD_TOPUP;
  const isEgift = uniqueProducts?.[index]?.extension_attributes?.product_options?.[0]?.indexOf('hps_giftcard_recipient_email') != -1;
  const egiftDetails = isEgift ? JSON.parse(uniqueProducts?.[index]?.extension_attributes?.product_options?.[0]) : null;
  const orderSummaryVersionTwo = configs?.['oredr-confirmation-order-summary-v2'] === 'true';
  
  const originalPrice = useCurrencyFormatter({ price: uniqueProducts[index]?.base_original_price ?? null });
  const memberPrice = uniqueProducts?.[index]?.extension_attributes?.member_price
  const memberPriceValue = useCurrencyFormatter({ price: uniqueProducts?.[index]?.extension_attributes?.member_price ?? null })
  const enableExtraProductInfo = configs?.['enable-order-confirmation-product-extra-info'] === 'true';
  const regularPrice = useCurrencyFormatter({ price: product?.price_range?.maximum_price?.regular_price?.value  ?? null });

  const renderPrice = () => {
    if (isLoggedIn && memberPrice) {
      return <div className='product-info__price__discount'>
        <div class='price' style={{ textDecoration: 'line-through' }}>{originalPrice}</div>
        <div className='member-price-wrapper'>
          <span className='member-price-container'>
            <span className='member-price-label'>
              {decimalPrice}
            </span>
            <span className='member-price-label'>
              {placeholders.memberPriceLabel}
            </span>
          </span>
        </div>
      </div>
    }
    return <div className={`product-info__price__discount ${enableExtraProductInfo && (decimalPrice === regularPrice) ? 'product-info__price__discount-v2' : ''}`}>
      <span className='price'>
        {Number(memberPrice) !== Number(price) ? decimalPrice : originalPrice}
      </span>
      {enableExtraProductInfo && (decimalPrice !== regularPrice) && <span className="orignal-price-without-discount">{regularPrice}</span>}
      {memberPriceValue && <span className='member-price-container'>
        <label className='member-price-label'>
        {enableExtraProductInfo && <Icon name="auraicon" className="member-cart-aura-icon" />}{memberPriceValue}
        </label>
        <label className='member-price-label'>
          {placeholders.memberPriceLabel}
        </label>
      </span>}

      {/* Enable the below code for member price
      {memberPriceValue && <div className='member-price-wrapper'>
          <span className='member-price-container'>
            <span className='member-price-label'>
              {decimalPrice}
            </span>
            <span className='member-price-label'>
              {placeholders.memberPriceLabel}
            </span>
          </span>
        </div>} */}
    </div>
  }

  

  const renderProductTag = () => {
    const productTag = product?.form;
    return <span className="product-tag">{productTag}</span>
  }

  const renderProductPromotion = () => {
    const promotionLabels = product?.promotions;
    if (!promotionLabels?.length) {
      return null;
    }
  
    return (
      <>
        {promotionLabels.map((item) => (
          <span key={item}>{item.label}</span>
        ))}
      </>
    );
  }

  const renderPercentOff = ()=>{
    const precentoff = Math.round(product?.price_range?.maximum_price?.discount?.percent_off);
    if(!precentoff > 0){
      return null
    }
    return <span>-{precentoff}%</span>
  }

  const renderQuantity = ()=>{
    let orderedQuantity = 0;
    const productSkufromItem = product?.sku;
    completeOrderData?.items?.map((item)=>{
      if(item.sku === productSkufromItem){
        const quantity = item?.extension_attributes?.product_options?.[0]
  ? JSON.parse(item.extension_attributes.product_options[0])?.info_buyRequest?.qty
  : 0;
        orderedQuantity = isLoggedIn ? Number(quantity).toFixed(0) :item?.qty_ordered;
      }
    })
    if(orderedQuantity == 0){
      return null;
    }
    return <span className='ordered-quantity'>{placeholders.quantityText}:{orderedQuantity}</span>
  }
  
  return (
    <div
      key={`item-${index}`}
      id={`item-${index}`}
      className={`ordered-product ${price === 0 || price === 0.01 ? 'freegiftwithpurchase' : ''}`}
    >
      {
        isGiftCardTopup || isEgift
          ? <div className="product-image-topup">
            <img
              src={uniqueProducts?.[index]?.extension_attributes?.product_media?.[0]?.file}
              alt={product?.name}
            />
          </div>
          : <div className="product-image">
            <img
              src={orderSummaryVersionTwo ? JSON.parse(product?.media_gallery?.[0]?.styles)?.cart_thumbnail : product?.assets_cart?.[0]?.styles?.cart_thumbnail}
              alt={product?.name}
            />
          </div>
      }

      <div className={`product-information ${enableExtraProductInfo ? "product-information-v2": ""}`}>
        <div>
          <span>
            {
              isGiftCardTopup
                ? <span id="product-title">{placeholders?.egiftCardTopupLabel}</span>
                : isEgift
                  ? <span id="product-title">{placeholders?.egiftcardtext}</span>
                  : <a id="product-title" href={`/${getLanguageAttr()}/${product?.url_key ?? ''}`}>{product?.name}</a>
            }
          </span>
          {enableExtraProductInfo && renderProductTag()}
          {price === 0 || price === 0.01
            ? <span> {placeholders.freeGiftPriceText}</span>
            : renderPrice()}
          {enableExtraProductInfo && <div className='promotion-labe-and-discount'>
            {renderPercentOff()}
            {renderProductPromotion()}
            </div>}
            {enableExtraProductInfo && renderQuantity()}
        </div>
        {/* } */}
        <div>
          {product?.variants?.product?.color_label && <span>
            {placeholders.productColorLabel}
            :
            {' '}
            {product?.variants?.product?.color_label}
          </span>}
          {product?.variants?.product?.dynamicAttributes?.size_label && <span>
            {placeholders.productSize}
            :
            {' '}
            {product?.variants?.product?.dynamicAttributes?.size_label}
          </span>}
          {isEgift && (
            <>
              {product?.name && <span>
                {placeholders.styleText}
                :
                {' '}
                {product?.name}
              </span>}
              {egiftDetails?.hps_giftcard_recipient_email && <span>
                {placeholders.sendToText}
                :
                {' '}
                {egiftDetails?.hps_giftcard_recipient_email}
              </span>}
              {egiftDetails?.hps_giftcard_message && (
                <span className='egift-message'>
                  {placeholders.customMessageEgift}
                  :
                  {' '}
                  {egiftDetails?.hps_giftcard_message}
                </span>
              )}
            </>
          )}
        </div>
        {completeOrderData?.extension_attributes?.topup_card_number && <span className='cardNumber'>
          {placeholders?.cardNumber} :  {completeOrderData?.extension_attributes?.topup_card_number}
        </span>}
      </div>
      {(price === 0 || price === 0.01) && (
        <span className="freegiftwithpurchasetext">
          {placeholders.freeGiftLabel}
        </span>
      )}
    </div>
  );
}

export default PurchasedProduct;
