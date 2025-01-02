import React, {
  useState, useEffect, useRef, useCallback, useContext,
} from 'react';
import { decorateIcons } from '../../../../scripts/aem';
import updateQuantityGraphql from '../../../api/updateQuantity';
import { removeRedeemCardRedemptionOnCartUpdate } from '../../../api/removeRedeemCardRedemption';
import CartContext from '../../../context/cart-context';
import Loader from '../../../shared/loader/loader';
import Tamara from '../../../utils/tamara-utils';
import TabbyUtils from '../../../utils/tabby-utils';
import { getConfigValue } from '../../../../scripts/configs.js';
import Icon from '../../../library/icon/icon.jsx';

function QuantityUpdate({
  isDisabled, totalQtyAvailable, orderedQty = 1, qtyNotAvailable, product, bagUpdatedSuccessLabel, partialStockAvailable, isQtyAvailable
}) {
  const { cart, setCart, isLoggedIn, setTamaraAvailable, setIsTabbyAvailable, setIsCheckoutFlag, placeholders, shouldEnableProductCardV2 } = useContext(CartContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(orderedQty.toString());
  const dropdownRef = useRef(null);
  const dropdownBtnRef = useRef(null);
  const dropdownOptionRef = useRef(null);
  const dropdownSelOptionRef = useRef(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (dropdownBtnRef.current) {
      decorateIcons(dropdownBtnRef.current);
    }
  }, [isLoading]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = useCallback(async (option, cartData) => {
    const { uid } = product;
    setIsOpen(false);
    setIsLoading(true);
    window.dispatchEvent(new CustomEvent('react:resetPageMessage'));
    const cartId = cart?.data?.id;
    const result = await updateQuantityGraphql(uid, cartId, +option);
    if (result?.data?.commerce_updateCartItems?.cart) {
      const comparedData = result.data.commerce_updateCartItems.cart?.items?.map((item) => {
        const existingCartItem = cartData?.data?.items?.find((element) => item?.product?.sku === element?.product?.sku);
        if (item?.product?.sku === product?.product?.sku) {
          return {
            ...item,
            isQuantityNotAvailable: false,
            extensionAttributes: result.data.commerce_updateCartItems?.cart?.extension_attributes?.cart?.items?.find((extAttribute) => Number(item?.id) === Number(extAttribute?.item_id)),
          };
        }
        return {
          ...item,
          isQuantityNotAvailable: existingCartItem?.isQuantityNotAvailable,
          extensionAttributes: existingCartItem?.extensionAttributes,
        };
      });
      result.data.commerce_updateCartItems.cart.items = comparedData;

      const existingCartItem = cartData?.data?.items?.find((element) => product?.product?.sku === element?.product?.sku);
      if (existingCartItem && option < existingCartItem.quantity) {
        const gtmAttributes = existingCartItem?.product?.gtm_attributes;
        const productDynamicAttributes = existingCartItem?.configured_variant?.dynamicAttributes ? JSON.parse(
          existingCartItem?.configured_variant?.dynamicAttributes
        ) : null;
        window.dispatchEvent(new CustomEvent(
          'react:datalayerRemoveFromCartEvent',
          {
            detail: {
              quantity: existingCartItem.quantity - option, // calculating quantity removed from cart
              productData: {
                gtm: {
                  id: gtmAttributes?.id || '',
                  name: gtmAttributes?.name || '',
                  brand: existingCartItem?.product?.brand_full_name || gtmAttributes?.brand || (await getConfigValue('brand')),
                  category: gtmAttributes?.category || '',
                  variant: gtmAttributes?.variant || '',
                  price: existingCartItem?.configured_variant?.price_range?.maximum_price?.final_price?.value || gtmAttributes?.price || '',
                  sku: existingCartItem?.configured_variant?.sku || null,
                  size: productDynamicAttributes?.size_gtm || '',
                  color: productDynamicAttributes?.color_gtm || existingCartItem?.configured_variant?.color_label || '',
                },
                inStock: existingCartItem?.configured_variant?.stock_status === 'IN_STOCK',
                memberPrice: existingCartItem?.configured_variant?.member_price || '',
                isReturnable: existingCartItem?.configured_variant?.is_returnable || '',
                dynamicAttributes: existingCartItem?.configured_variant?.dynamicAttributes || '',
              },
            },
          },
        ));
      }

      // when quantity increased
      if (existingCartItem && option > existingCartItem.quantity) {
        const gtmAttributes = existingCartItem?.product?.gtm_attributes;
        const productDynamicAttributes = existingCartItem?.configured_variant?.dynamicAttributes ? JSON.parse(
          existingCartItem?.configured_variant?.dynamicAttributes
        ) : null;
        window.dispatchEvent(new CustomEvent(
          'react:datalayerAddToCartEvent',
          {
            detail: {
              addProduct: true,
              productData: {
                gtm: {
                  id: gtmAttributes?.id || '',
                  name: gtmAttributes?.name || '',
                  brand: existingCartItem?.product?.brand_full_name || gtmAttributes?.brand || (await getConfigValue('brand')),
                  category: gtmAttributes?.category || '',
                  variant: gtmAttributes?.variant || '',
                  price: existingCartItem?.configured_variant?.price_range?.maximum_price?.final_price?.value || gtmAttributes?.price || '',
                  sku: existingCartItem?.configured_variant?.sku || null,
                  size: productDynamicAttributes?.size_gtm || '',
                  color: productDynamicAttributes?.color_gtm || existingCartItem?.configured_variant?.color_label || '',
                },
                inStock: existingCartItem?.configured_variant?.stock_status === 'IN_STOCK',
                memberPrice: existingCartItem?.configured_variant?.member_price || '',
                isReturnable: existingCartItem?.configured_variant?.is_returnable || '',
                dynamicAttributes: existingCartItem?.configured_variant?.dynamicAttributes || '',
              },
              quantity: option, // calculating quantity removed from cart
              selectedSize: productDynamicAttributes?.size_label || '',
            },
          },
        ));
      }

      setCart({ ...cartData, data: result.data.commerce_updateCartItems.cart });
      //Condition: To see the tamara widget is available or not.
      await Tamara.isAvailable({ ...cartData, data: result.data.commerce_updateCartItems.cart }, setTamaraAvailable, isLoggedIn);
      await TabbyUtils.isAvailable({ ...cartData, data: result.data.commerce_updateCartItems.cart }, setIsTabbyAvailable, isLoggedIn);
      if (!shouldEnableProductCardV2) {
        window.dispatchEvent(new CustomEvent('react:showPageSuccessMessage', { detail: { message: bagUpdatedSuccessLabel } }));
      }
      qtyNotAvailable(true);
      const msgEle = document.getElementsByClassName('page-success-message');
      if (msgEle && msgEle[0]) {
        msgEle[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      await removeRedeemCardRedemptionOnCartUpdate(cart, isLoggedIn);

      const isProductOOSInCart = result?.data?.commerce_updateCartItems?.cart?.items?.filter((item) => item?.extensionAttributes?.extension_attributes?.is_egift !== '1' && !item?.extensionAttributes?.extension_attributes?.is_free_gift && item?.extensionAttributes?.extension_attributes?.error_message);

      if (isProductOOSInCart?.length == 0) {
        setIsCheckoutFlag(true);
      }

    } else if (result.errors) {
      const dataCheck = cart?.data?.items?.map((item) => {
        if (item?.product?.sku === product?.product?.sku) {
          return {
            ...item,
            isQuantityNotAvailable: true,
          };
        }
        return {
          ...item,
        };
      });
      setCart({ ...cart, data: { ...cart?.data, items: dataCheck } });
      qtyNotAvailable();
    }
    setIsLoading(false);
    setSelected(option);
  }, [cart]);

  const renderOptions = () => {
    const ret = [];
    const availableQty = (+selected > 10) || (+selected > +totalQtyAvailable) ? selected : Math.min(+totalQtyAvailable, 10);

    for (let i = 1; i <= availableQty; i += 1) {
      let setClasses = '';
      let disabled = false;
      if (i === +selected) {
        setClasses += 'selected';
      }
      if (+totalQtyAvailable < i) {
        setClasses += ' disabled';
        disabled = true;
      }
      ret.push(<div role="button" tabIndex={!disabled ? 0 : -1} key={i} className={setClasses} onClick={() => !disabled && handleOptionClick(i, cart)} onKeyUp={(e) => e.key === 'Enter' && !disabled && handleOptionClick(i, cart)} ref={i === +selected ? dropdownSelOptionRef : null}>{i}</div>);
    }
    return ret;
  };

  useEffect(() => {
    if (isOpen && dropdownOptionRef.current && dropdownSelOptionRef.current) {
      const { offsetTop } = dropdownSelOptionRef.current;
      const { offsetHeight } = dropdownSelOptionRef.current;
      const offsetBottom = offsetTop + offsetHeight;
      const containerHeight = dropdownOptionRef.current.clientHeight;
      dropdownOptionRef.current.scrollTop = offsetBottom - containerHeight + 10;
    }
  }, [isOpen]);

  useEffect(() => {
    if (orderedQty?.toString() !== selected) setSelected(orderedQty?.toString());
  }, [orderedQty, selected])

  return (

    <div className="qty-dropdown" ref={dropdownRef}>
      {partialStockAvailable && isQtyAvailable && <div className='partial-qty-txt'><Icon name="info-circle" className="icon icon-info iconInfo qty-Info" /> <span className='qty-update-error'> {placeholders.partialProductQty} </span></div>}
      {!isLoading
        ? (
          <>
            <button type="button" ref={dropdownBtnRef} onClick={toggleDropdown} className={`qty-dropdown__toggle ${(isQtyAvailable && partialStockAvailable) ? 'qty-dropdown__error' : ''} ${isDisabled ? 'qty-dropdown-disabled' : ''}`}>
              <span>{shouldEnableProductCardV2 && <span>{placeholders.cartProductCardQuantityPrefix}</span>}{selected}</span>
              <span className={`chevron${isOpen ? ' open' : ''}`}>
                <span className="icon icon-chevron-down" />
              </span>
            </button>
            {isOpen && (
              <div className="qty-dropdown__menu" ref={dropdownOptionRef}>{renderOptions()}</div>
            )}
          </>
        )
        : <Loader />}
    </div>
  );
}

export default QuantityUpdate;