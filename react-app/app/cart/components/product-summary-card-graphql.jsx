import React, {
  useCallback, useContext, useEffect, useState,
} from 'react';
import CartContext from '../../../context/cart-context.jsx';
import QuantityUpdate from './quantity-update.jsx';
import { updateWishlist } from '../../../../scripts/wishlist/api.js';
import removeCartGraphql from '../../../api/removeCartGraphql.js';
import DeletePopup from './delete-item-popup/delete-item-popup.jsx';
import Loader from '../../../shared/loader/loader.jsx';
import CartShippingMethods from './cart-shipping-methods/cart-shipping-methods.jsx';
import { getLanguageAttr } from '../../../../scripts/configs.js';
import useCurrencyFormatter from '../../../utils/hooks/useCurrencyFormatter.jsx';
import { removeRedeemCardRedemptionOnCartUpdate } from '../../../api/removeRedeemCardRedemption';
import TabbyUtils from '../../../utils/tabby-utils.js';
import Tamara from '../../../utils/tamara-utils.js';
import { getConfigValue } from '../../../../scripts/configs.js';
import AppConstants from '../../../utils/app.constants.js';
import DeletePopupBBW from './delete-item-popup/delete-item-popup-bbw.jsx';
import Icon from '../../../library/icon/icon.jsx';

function ProductSummaryCardGql({ product, currency, checkoutHideSection, dynamicPromoLabels = {} }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFovoriteLoading, setFavoriteLoading] = useState(false);
  const [isRemoveBagLoading, setRemoveBagLoading] = useState(false);
  const [partialStockAvailable, setPartialStockAvailable] = useState(false);
  const [isQtyAvailable, setIsQtyAvailable] = useState(true);
  const [auraDetails, setAuraDetails] = useState({});

  const {
    cart, setCart, placeholders, priceDecimals, promotion, isTopupFlag, isLoggedIn, setTamaraAvailable, setIsTabbyAvailable, setIsCheckoutFlag, shouldEnableProductCardV2, shouldEnableDynamicPromoLabels, setToastErrorMessage, outOfStockData
  } = useContext(CartContext);

  const isSimpleProduct = product?.product?.__typename === AppConstants?.PRODUCT_TYPE_SIMPLE;
  const topupPrice = useCurrencyFormatter({ price: product?.price, priceDecimals, currency });
  const memberAuraPrice = product?.extensionAttributes?.extension_attributes?.member_price;
  const getextensionattributes = () => cart?.data?.extension_attributes?.cart?.items?.find((item) => Number(product.id) === item?.item_id);
  const extensionAttributes = getextensionattributes();

  const ecartEstention = extensionAttributes?.extension_attributes;
  const isEgift = ecartEstention?.is_egift === '1';
  const isFreeGift = ecartEstention?.is_free_gift;
  const giftCardMessage = ecartEstention?.egift_options?.hps_giftcard_message;
  let productImageUrl = '';
  if (shouldEnableProductCardV2 && !isEgift) {
    const productStyle = JSON.parse(product?.product?.media_gallery?.[0]?.styles ?? '{}');
    productImageUrl = productStyle?.cart_thumbnail ?? '';
  } else {
    const productAsset = JSON.parse(product?.product?.assets_cart ?? '[]')[0];
    productImageUrl = productAsset?.styles?.cart_thumbnail ?? '';
  }

  const getLocalData = () => {
    const auraDetails = JSON.parse(localStorage.getItem('aura_common_data')) || {};
    setAuraDetails(auraDetails);
  }

  useState(() => {
    getLocalData();
    window.addEventListener('storage', getLocalData);
    return () => window.removeEventListener('storage', getLocalData);
  }, []);

  const actionAfterFav = (favNotification, results, deleteSuccess) => {
    window.dispatchEvent(new CustomEvent('updateMiniCart'));
    setCart({ ...cart, data: results });

    const resultsLength = results?.items?.length;
    if (resultsLength && favNotification) {
      if (shouldEnableProductCardV2) {
        window.dispatchEvent(new CustomEvent('react:showToastNotification', { detail: { message: deleteSuccess } }));
      } else {
        window.dispatchEvent(new CustomEvent('react:showPageSuccessMessage', { detail: { message: deleteSuccess } }));
        const successNotification = document.querySelector('.page-success-message.visible');
        successNotification.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.dispatchEvent(new CustomEvent('react:resetPageMessage'));
    }
  };

  const moveToFavorite = async (productItem) => {
    window.dispatchEvent(new CustomEvent('react:resetPageMessage'));
    setIsLoading(true);
    setFavoriteLoading(true);
    setIsOpen(false);
    const { uid } = productItem;
    let productInfo = productItem?.configured_variant;
    if (isSimpleProduct) {
      productInfo = productItem?.product;
    }
    if (shouldEnableProductCardV2 && productItem?.extensionAttributes) {
      productInfo = productItem?.extensionAttributes;
    }
    await updateWishlist(productInfo, false);
    const deleteSuccess = shouldEnableProductCardV2 ? `${product?.extensionAttributes?.name} ${placeholders.removedFromBag}` : placeholders?.deleteSuccess;
    const cartId = cart?.data?.id;
    const results = await removeCartGraphql(uid, cartId, deleteSuccess);

    await removeRedeemCardRedemptionOnCartUpdate(cart, isLoggedIn);
    if (results) {
      setFavoriteLoading(false);
      setIsOpen(false);
    }

    results.items = results?.items?.map((item) => {
      const productInfo = isSimpleProduct ? item?.product : item?.configured_variant;
      if (Number(item?.quantity) <= Number(productInfo?.stock_data?.qty)
      ) {
        return {
          ...item,
          isQuantityNotAvailable: false,
          extensionAttributes: results?.extension_attributes?.cart?.items?.find(
            (element) => Number(item?.id) === Number(element?.item_id),
          ),
        };
      }
      return {
        ...item,
        isQuantityNotAvailable: true,
        extensionAttributes: results?.extension_attributes?.cart?.items?.find(
          (element) => Number(item?.id) === Number(element?.item_id),
        ),
      };
    });

    setCart({
      ...cart,
      data: {
        ...cart?.data,
        items: results.items
      }
    });

    if (product) {
      const gtmAttributes = product?.product?.gtm_attributes;
      const productDynamicAttributes = productDetails?.dynamicAttributes ? JSON.parse(productDetails?.dynamicAttributes) : null;
      window.dispatchEvent(new CustomEvent(
        'react:datalayerRemoveFromCartEvent',
        {
          detail: {
            quantity: product.quantity, // calculating quantity removed from cart
            productData: {
              gtm: {
                id: gtmAttributes?.id || '',
                name: gtmAttributes?.name || '',
                brand: product?.product?.brand_full_name || gtmAttributes?.brand || (await getConfigValue('brand')),
                category: gtmAttributes?.category || '',
                variant: gtmAttributes?.variant || product?.extensionAttributes?.sku || '',
                price: product?.configured_variant?.price_range?.maximum_price?.final_price?.value || gtmAttributes?.price || '',
                size: productDynamicAttributes?.size_gtm || '',
                color: productDynamicAttributes?.color_gtm || product?.configured_variant?.color_label || ''
              },
              inStock: product?.configured_variant?.stock_status === 'IN_STOCK',
              memberPrice: product?.configured_variant?.member_price || '',
              dynamicAttributes: product?.configured_variant?.dynamicAttributes || '',
              isReturnable: product?.configured_variant?.is_returnable || '',
            },
          },
        },
      ));
    }
    // triggering custom events on product removal from cart
    window.addEventListener('favourites-widget-removed', (evt) => {
      actionAfterFav(evt.detail, results, deleteSuccess);
    });
  };
  const deleteItemfromCart = async (productItem) => {
    setIsLoading(true);
    setRemoveBagLoading(true);
    const { uid } = productItem;
    const deleteSuccess = shouldEnableProductCardV2 ? `${product?.extensionAttributes?.name} ${placeholders.removedFromBag}` : placeholders?.deleteSuccess;
    const cartId = cart?.data?.id;
    const results = await removeCartGraphql(uid, cartId, deleteSuccess);

    await removeRedeemCardRedemptionOnCartUpdate(cart, isLoggedIn);
    if (results) {
      setRemoveBagLoading(false);
      setIsOpen(false);
    }

    results.items = results?.items?.map((item) => {
      const productInfo = isSimpleProduct ? item?.product : item?.configured_variant;
      if (Number(item?.quantity) <= Number(productInfo?.stock_data?.qty)
      ) {
        return {
          ...item,
          isQuantityNotAvailable: false,
          extensionAttributes: results?.extension_attributes?.cart?.items?.find(
            (element) => Number(item?.id) === Number(element?.item_id),
          ),
        };
      }
      return {
        ...item,
        isQuantityNotAvailable: true,
        extensionAttributes: results?.extension_attributes?.cart?.items?.find(
          (element) => Number(item?.id) === Number(element?.item_id),
        ),
      };
    });

    const isProductOOSInCart = results?.items?.filter((item) => item?.extensionAttributes?.extension_attributes?.is_egift !== '1' && !item?.extensionAttributes?.extension_attributes?.is_free_gift && item?.extensionAttributes?.extension_attributes?.error_message);

    if (isProductOOSInCart?.length == 0) {
      setIsCheckoutFlag(true);
    }

    if (product) {
      const gtmAttributes = product?.product?.gtm_attributes;
      const productDynamicAttributes = productDetails?.dynamicAttributes ? JSON.parse(productDetails?.dynamicAttributes) : null;
      window.dispatchEvent(new CustomEvent(
        'react:datalayerRemoveFromCartEvent',
        {
          detail: {
            quantity: product.quantity, // calculating quantity removed from cart
            productData: {
              gtm: {
                id: gtmAttributes?.id || '',
                name: gtmAttributes?.name || '',
                brand: product?.product?.brand_full_name || gtmAttributes?.brand || (await getConfigValue('brand')),
                category: gtmAttributes?.category || '',
                variant: product?.extensionAttributes?.sku || gtmAttributes?.variant || '',
                price: product?.configured_variant?.price_range?.maximum_price?.final_price?.value || gtmAttributes?.price || '',
                size: productDynamicAttributes?.size_gtm || '',
                color: productDynamicAttributes?.color_gtm || product?.configured_variant?.color_label || ''
              },
              inStock: product?.configured_variant?.stock_status === 'IN_STOCK',
              memberPrice: product?.configured_variant?.member_price || '',
              dynamicAttributes: product?.configured_variant?.dynamicAttributes || '',
              isReturnable: product?.configured_variant?.is_returnable || '',
            },
          },
        },
      ));
    }
    setCart({
      ...cart,
      data: {
        ...cart?.data,
        total_quantity: results?.total_quantity,
        items: results.items,
        ...(results.prices ? { prices: results.prices } : {}),
        extension_attributes: {
          ...cart.data.extension_attributes,
          cart: {
            ...cart.data.extension_attributes.cart,
            extension_attributes: {
              ...cart.data.extension_attributes.cart.extension_attributes,
              free_shipping_text: results?.extension_attributes?.cart?.extension_attributes?.free_shipping_text,
            }
          }
        }
      }
    });
    //Condition: To see the tamara widget is available or not.
    await Tamara.isAvailable({ ...cart, data: results }, setTamaraAvailable, isLoggedIn);
    await TabbyUtils.isAvailable({ ...cart, data: results }, setIsTabbyAvailable, isLoggedIn);
    setIsLoading(false);
    const resultsLength = results?.items?.length;
    if (resultsLength) {
      if (shouldEnableProductCardV2) {
        window.dispatchEvent(new CustomEvent('react:showToastNotification', { detail: { message: deleteSuccess } }));
      } else {
        window.dispatchEvent(
          new CustomEvent('react:showPageSuccessMessage', {
            detail: { message: deleteSuccess },
          }),
        );
        const successNotification = document.querySelector(
          '.page-success-message.visible',
        );
        successNotification.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.dispatchEvent(new CustomEvent('react:resetPageMessage'));
    }
  };

  const size = product?.configured_variant?.size ?? '';
  const configurableOptions = product?.configurable_options ?? '';
  let sizeLabel = '';
  if (size && configurableOptions) {
    sizeLabel = configurableOptions.find((option) => option.value_id === size)?.value_label ?? '';
  }

  const handleQtyNotAvailable = useCallback((flag = false) => {
    setIsQtyAvailable(flag);
  }, []);

  useEffect(() => {
    if (!isQtyAvailable) {
      window.dispatchEvent(
        new CustomEvent('react:dataLayerCartErrorsEvent', {
          detail: {
            eventLabel: 'quantity-not-available',
            eventAction: placeholders?.quantityNotAvailableLabel || 'The requested quantity is not available',
            eventPlace: `Error occured on ${window.location.href}`,
          },
        }),
      );
    }
  }, [isQtyAvailable]);
  const productDetails = !isSimpleProduct ? product?.configured_variant : product?.product;
  const regularPrice = isEgift ? extensionAttributes?.price : productDetails?.price_range?.maximum_price?.regular_price?.value ?? 0;
  const finalPrice = isEgift || isFreeGift ? extensionAttributes?.price : productDetails?.price_range?.maximum_price?.final_price?.value ?? 0;
  const discountPercent = productDetails?.price_range?.maximum_price?.discount?.percent_off ?? 0;

  const regularPriceFormatted = useCurrencyFormatter({ price: regularPrice, priceDecimals, currency });
  const finalPriceFormatted = useCurrencyFormatter({ price: finalPrice, priceDecimals, currency });
  const member_price = product?.extensionAttributes?.extension_attributes?.member_price
  const memberPriceFormated = useCurrencyFormatter({ price: member_price, priceDecimals, currency })

  const getProductSKU = () => (isFreeGift ? product?.product?.sku : productDetails?.sku) ?? '';

  const renderPrice = () => {
    if (isLoggedIn && member_price) {
      return <div>
        {regularPrice !== finalPrice && (
          <span style={{ textDecoration: 'line-through' }}>
            {regularPriceFormatted}
          </span>
        )}
        {!shouldEnableProductCardV2 && (<div className='member-price-wrapper'>
          <span className='member-price-container'>
            <span className='member-price-label'>
              {memberPriceFormated}
            </span>
            <span className='member-price-label'>
              {placeholders.memberPriceLabel}
            </span>
          </span>
        </div>)}
      </div>
    }

    if (shouldEnableProductCardV2) {
      return (<span id="price">
        {
          auraDetails?.aura_membership && !isEgift && memberAuraPrice
            ? null
            : <>
              <span className={regularPrice !== finalPrice ? 'price__discounted' : ''}>
                {finalPriceFormatted}
              </span>
              {' '}
            </>
        }
        {regularPrice !== finalPrice && (
          <span style={{ textDecoration: 'line-through' }}>
            {regularPriceFormatted}
          </span>
        )}
      </span>);
    }

    return <div>
      <span id="price">
        {regularPrice !== finalPrice && (
          <span style={{ textDecoration: 'line-through' }}>
            {regularPriceFormatted}
          </span>
        )}
        {' '}
        <span className={regularPrice !== finalPrice ? 'price__discounted' : ''}>
          {finalPriceFormatted}
        </span>
      </span>
      {member_price && !checkoutHideSection && <div className='member-price-wrapper'>
        <span className='member-price-container'>
          <span className='member-price-label'>
            {memberPriceFormated}
          </span>
          <span className='member-price-label'>
            {placeholders.memberPriceLabel}
          </span>
        </span>
      </div>}
    </div>
  };

  const renderProductBrand = () => {
    const brand = product?.product?.brand_full_name ?? '';
    return brand ? <span id="product-brand">{brand}</span> : null;
  };

  const renderMemberAuraPrice = () => {
    const formatmemberAuraPrice = useCurrencyFormatter({ price: memberAuraPrice });
    return memberAuraPrice ? <span id="member-aura-price"><Icon name="auraicon" className="member-cart-aura-icon" />{formatmemberAuraPrice}<span className='aura-price'>{placeholders.cartAuraPriceText}</span></span> : null;
  };

  const renderSavePercentage = () => {
    if (isLoggedIn && member_price) {
      return
    }
    const savePercentage = shouldEnableProductCardV2 ? `-${Math.round(discountPercent)}%` : `(${placeholders.productPriceSaveLabel} ${Math.round(discountPercent)}%)`;
    return regularPrice !== finalPrice ? <span id="save-percentage">{savePercentage}</span> : null;
  };

  const renderProductOffers = () => {
    const promotions = product?.product?.promotions ?? [];

    return promotions?.length ? (
      <div className="product-offer-wrapper">
        {
          promotions.map((promo) => (
            checkoutHideSection ? (
              <span key={`${product?.product?.name ?? ''}-${promo?.label ?? ''}`} className="product-offer">{promo?.label ?? ''}
              </span>
            ) : (
              <a
                key={`${product?.product?.name ?? ''}-${promo?.label ?? ''}`}
                href={''}
                className="product-offer"
                onClick={(event) => {
                  event.preventDefault();
                  // Set the item-list name as cart in local storage on click
                  localStorage.setItem('categoryListName', `cart-pl-${promo?.label}`);
                  window.location.href = `/${getLanguageAttr()}/${promo?.url ?? ''}`;
                }}
              >
                {promo?.label ?? ''}
              </a>
            )
          ))
        }
      </div>
    ) : null;
  };

  const renderTitle = () => (isEgift ? <span id="product-title">{placeholders.egiftcardtext}</span> : <a id="product-title" href={`/${getLanguageAttr()}/${product?.product?.url_key ?? ''}`}>{product?.product?.name ?? ''}</a>);

  const renderproductTag = () => {
    const productTag = product?.product?.form ?? ''
    return productTag ? <span id="product-tag">{productTag}</span> : null;
  };

  const renderLowStockMessage = () => (productDetails?.only_x_left_in_stock ? <span className="low-stock-messgae">{placeholders.cartProductLowStockMessage}</span> : null);

  const renderImage = () => (!isTopupFlag ? (isEgift ? ecartEstention?.product_media?.[0]?.file : productImageUrl) : (""));
  const renderProductLabels = () => {
    const allProductLabels = promotion?.data?.promoDynamicLabelCart?.products_labels ?? [];
    const sku = getProductSKU();
    const productLabels = allProductLabels.find((label) => label.sku === sku)?.labels ?? [];
    return productLabels.map((productLabel) => (
      <div className="product-label__container" key={`product-label-${sku}-${productLabel}`}>
        <span className="product-label">
          {productLabel.label}
        </span>
      </div>
    ));
  };

  const productStockError = productDetails?.stock_status;
  const productStockQty = productDetails?.stock_data;
  const isOutOfStock = !productStockQty?.qty || productStockError === AppConstants.PRODUCT_OOS_ERROR;
  const isPartialStock = productStockQty?.qty < product?.quantity;

  useEffect(() => {
    if (isOutOfStock) {
      setIsQtyAvailable(false);
    } else if (isPartialStock && shouldEnableProductCardV2) {
      setPartialStockAvailable(true);
    } else {
      setIsQtyAvailable(true);
      setPartialStockAvailable(false);
    }
  }, [isOutOfStock, isPartialStock, shouldEnableProductCardV2, productDetails, product?.quantity]);

  const showOutOfStockToast = () => {
    if (shouldEnableProductCardV2) {
      setToastErrorMessage(placeholders?.outOfStockToast);
    }
    else {
      window.dispatchEvent(
        new CustomEvent('react:showPageErrorMessage', {
          detail: { message: placeholders?.outOfStockToast },
        }),
      );

      const errorNotification = document.querySelector(
        '.page-error-message.visible',
      );
      errorNotification?.scrollIntoView({ behavior: 'smooth' });
    }
    window.dispatchEvent(
      new CustomEvent('react:dataLayerCartErrorsEvent', {
        detail: {
          eventLabel: 'out-of-stock',
          eventAction: placeholders?.outOfStockToast,
          eventPlace: `Error occured on ${window.location.href}`,
        },
      }),
    );

    const errorNotification = document.querySelector(
      '.page-error-message.visible',
    );
    errorNotification?.scrollIntoView({ behavior: 'smooth' });
  }

  const getDynamicAttributes = () => {
    const serializedDynamicAttributes = isFreeGift ? product?.product?.dynamicAttributes : product?.configured_variant?.dynamicAttributes;
    return serializedDynamicAttributes ? JSON.parse(serializedDynamicAttributes) : {};
  };

  useEffect(() => {
    if (ecartEstention?.error_message?.includes(AppConstants.OOS_TEXT) || !isQtyAvailable || partialStockAvailable) {
      showOutOfStockToast();
    }
    if (!outOfStockData?.length && !partialStockAvailable) {
      setToastErrorMessage(null);
      setIsQtyAvailable(true);
    }
  }, [ecartEstention?.error_message, outOfStockData, partialStockAvailable, isQtyAvailable]);

  return (
    <div className='product-card'>
      <div className="product-summary__card">
        <div className={`product-summary__container ${isLoading ? 'loader' : ''}`}>
          <div className="product-summary">
            {!isTopupFlag ?
              <div className={`product-image ${isEgift ? 'egift-class' : ''}`}>
                <img src={renderImage()} alt={product?.product?.name ?? ''} />
              </div>
              : <div className={`product-image-topup ${isEgift ? 'egift-class' : ''}`}>
                <img src={product?.extension_attributes?.product_media[0]?.file} alt={product?.extension_attributes?.product_media[0]?.file ?? ''} />
              </div>
            }
            {!isTopupFlag ? <div className={`product-info ${isEgift ? 'egift-spaces' : ''} ${!isQtyAvailable || partialStockAvailable ? 'product-qty-error' : ''}`}>
              <div className="product-info-title-wrapper">
                {!isEgift && renderProductBrand()}
                {renderTitle()}
                {shouldEnableProductCardV2 && !isEgift && renderproductTag()}
                <div className="product-info__price__discount">
                  <div className={`product-info__price__container ${shouldEnableProductCardV2 && !isEgift && auraDetails?.aura_membership ? 'product-info__price__container-reverse' : ''}`}>
                    {renderPrice()}
                    {shouldEnableProductCardV2 && !isEgift && renderMemberAuraPrice()}
                  </div>
                  <div className='save-percentage-and-offers'>
                    {!isEgift && renderSavePercentage()}
                    {shouldEnableProductCardV2 && !isEgift && renderProductOffers()}
                  </div>
                </div>
                {shouldEnableProductCardV2 && checkoutHideSection && (
                  <div className='quantity-section'>
                    <span className='quantity-section-title'>{placeholders.quantityText}:</span>
                    <span>{product.quantity}</span>
                  </div>
                )}
              </div>
              {shouldEnableProductCardV2 && !isEgift && renderLowStockMessage()}
              {isEgift ? (
                <div className="product-info__sub eGift-info">
                  {!shouldEnableProductCardV2 && <span>
                    {placeholders.styleText}
                    :
                    {' '}
                    <span>{ecartEstention?.hps_style_msg}</span>
                  </span>}
                  <span>
                    {placeholders.sendToText}
                    :
                    {' '}
                    <span>{ecartEstention?.egift_options?.hps_giftcard_recipient_email}</span>
                  </span>
                  {giftCardMessage && (
                    <span>
                      {placeholders.customMessageEgift}
                      :
                      {' '}
                      <span>{giftCardMessage}</span>
                    </span>
                  )}
                </div>
              ) : (!shouldEnableProductCardV2 && (
                <div className="product-info__sub">
                  {!checkoutHideSection && <span>
                    {placeholders?.productArtNo ?? ''}
                    :
                    {' '}
                    {getProductSKU()}
                  </span>}
                  <span>
                    {placeholders?.productColorLabel ?? ''}
                    :
                    {' '}
                    {getDynamicAttributes()?.color_label ?? ''}
                  </span>
                  <span>
                    {placeholders?.productSize ?? ''}
                    :
                    {' '}
                    {isFreeGift ? getDynamicAttributes()?.size_label : (sizeLabel ?? size)}
                  </span>
                </div>)
              )}
              {!shouldEnableProductCardV2 && (!isEgift && !isFreeGift && !checkoutHideSection && <button type="button" id="move-to-fav" onClick={() => moveToFavorite(product)}>{placeholders?.moveToFav ?? ''}</button>)}
            </div> :
              <div>
                <div className={`product-info ${isEgift ? 'egift-spaces' : ''}`}>
                  <div className="product-info-title-wrapper">
                    {placeholders?.egiftCardTopupLabel}
                    <div className="topup_price">
                      {topupPrice}
                    </div>
                  </div>

                </div>
                <div className="cardNumber">
                  {placeholders?.cardNumber}: {product?.extension_attributes?.topup_card_number}
                </div>
              </div>
            }
          </div>

          {!checkoutHideSection && !isTopupFlag && (
            <div className="product-summary__actions">
              {!shouldEnableProductCardV2
                ? (
                  isLoading
                    ? <Loader />
                    : <DeletePopup productImageUrl={productImageUrl} onMoveToFav={() => moveToFavorite(product)} onRemove={() => deleteItemfromCart(product)} productSku={product?.configured_variant?.sku ?? ''} isEgift={isEgift} isFreeGift={isFreeGift} disabled={ecartEstention?.error_message?.includes(AppConstants.OOS_TEXT) || product?.isQuantityNotAvailable || isFreeGift} quantityNotAvailable={product?.isQuantityNotAvailable} isOOS={ecartEstention?.error_message?.includes(AppConstants.OOS_TEXT)} isQtyAvailable={isQtyAvailable} />
                ) : (
                  <DeletePopupBBW productImageUrl={productImageUrl} onMoveToFav={() => moveToFavorite(product)} onRemove={() => deleteItemfromCart(product)} productSku={product?.configured_variant?.sku ?? ''} isEgift={isEgift} isFreeGift={isFreeGift} disabled={ecartEstention?.error_message?.includes(AppConstants.OOS_TEXT) || product?.isQuantityNotAvailable || isFreeGift} quantityNotAvailable={product?.isQuantityNotAvailable} isOOS={ecartEstention?.error_message?.includes(AppConstants.OOS_TEXT)} isOpen={isOpen} setIsOpen={setIsOpen} isFovoriteLoading={isFovoriteLoading} isRemoveBagLoading={isRemoveBagLoading} isQtyAvailable={isQtyAvailable} />

                )}
              {((!isEgift && !isTopupFlag) || isFreeGift) && (
                <div className={!ecartEstention?.error_message ? 'product-qty-update' : 'product-qty-update-disable'}>

                  {shouldEnableProductCardV2 && partialStockAvailable && (
                    <div className='card-oos-field'>  <Icon name="info-circle" className="icon icon-info iconInfo qty-Info" /><span className='items-available-text'>{placeholders.quantityNotAvailableTxt}</span> </div>
                  )}
                  {shouldEnableProductCardV2 && !isQtyAvailable && (
                    <div className='card-oos-field'>  <Icon name="info-circle" className="icon icon-info iconInfo qty-Info" /><span className='items-available-text'>{placeholders.oosTextError} </span> </div>
                  )}
                  <QuantityUpdate
                    isDisabled={isFreeGift || ecartEstention?.error_message?.includes(AppConstants.OOS_TEXT)}
                    totalQtyAvailable={productDetails?.stock_data?.qty}
                    orderedQty={product.quantity}
                    qtyNotAvailable={handleQtyNotAvailable}
                    bagUpdatedSuccessLabel={placeholders?.bagUpdatedSuccessLabel || 'Your bag has been updated successfuly.'}
                    product={product}
                    isQtyAvailable={isQtyAvailable}
                    partialStockAvailable={partialStockAvailable}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {!isEgift && !isTopupFlag && (
          <div className="product-summary__footer">
            {!shouldEnableProductCardV2 && !member_price && renderProductOffers()}
            {!shouldEnableProductCardV2 && (!checkoutHideSection && <CartShippingMethods product={product} cart={cart} />)}
            {shouldEnableProductCardV2 && (!isEgift && !isFreeGift && !checkoutHideSection && <button type="button" className={`${!isQtyAvailable ? "move-to-fav-disable" : ""}`} id="move-to-fav" onClick={() => moveToFavorite(product)}><Icon name="favourites" className="move-to-fav-prefix-icon" />{placeholders?.moveToFav ?? ''}</button>)}
          </div>
        )}
        {
          !shouldEnableProductCardV2
            ? <>
              {isFreeGift && !isTopupFlag && (
                <div className="free_gift_container">
                  <span className="free_gift_label">
                    {placeholders?.freeGiftLabel}
                  </span>
                </div>
              )}
              {(!isEgift && !isTopupFlag && ecartEstention?.error_message) || !isQtyAvailable ? (
                <div className="product-label__container">
                  <span className="product-label">
                    {ecartEstention?.error_message || placeholders.quantityNotAvailableLabel}
                  </span>
                </div>
              ) : null}
            </>
            : null
        }

        {renderProductLabels()}
      </div>
      {shouldEnableDynamicPromoLabels && !isEgift && dynamicPromoLabels[0]?.label && (<div className='add1get1section'>
        <div className="add1get1">
          <button type="button">
            <a
              href={dynamicPromoLabels[0]?.link || '#'}
              onClick={(event) => {
                event.preventDefault();
                // Set the item-list-name as cart in local storage on click
                localStorage.setItem('categoryListName', `cart-pl-${dynamicPromoLabels[0]?.label}`);
                window.location.href = `${dynamicPromoLabels[0]?.link}`;
              }}
            >{dynamicPromoLabels[0]?.label}
            </a>
          </button>
        </div>
      </div>)}

    </div>
  );
}

export default ProductSummaryCardGql;
