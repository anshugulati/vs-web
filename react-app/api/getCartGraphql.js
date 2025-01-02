import {
  useCallback, useContext, useEffect,
} from 'react';
import { getGraphqlClient } from '../utils/api-client.js';
import CartContext from '../context/cart-context.jsx';
import ApiConstants from './api.constants.js';
import { getTopupEgiftCardId } from '../utils/base-utils.js';
import AppConstants from "../utils/app.constants";

/**
 * Fetches the current guest cart
 * @returns {{cartData: boolean|{}}}
 */
const useGetCartGraphql = (step) => {
  const {
    isLoggedIn, cart, setCart, cartId, setCouponCode
  } = useContext(CartContext); // Get the cart context
  const updatedCartId = getTopupEgiftCardId() ?? cartId;

  const fetchGuestCartQuery = `query ($cartId: String!) {
  commerce_cart(cart_id: $cartId) ${getTopupEgiftCardId() ? ApiConstants.DIGITAL_CART_QUERY : ApiConstants.CART_QUERY}
}`;

  //session stoarge based condition need to implement
  const fetchCustomerCartQuery = `query customerCart {
  commerce_customerCart ${getTopupEgiftCardId() ? ApiConstants.DIGITAL_CART_QUERY : ApiConstants.CART_QUERY}
}`;

  const cartQuery = isLoggedIn ? fetchCustomerCartQuery : fetchGuestCartQuery;

  const fetchCart = useCallback(
    () => {
      setCart({ ...cart, isLoading: true });
      getGraphqlClient(cartQuery, { cartId: updatedCartId }, true).then((response) => {
        const responseData = isLoggedIn
          ? response.response.data.commerce_customerCart
          : response.response.data.commerce_cart;

        responseData.items = responseData?.items?.map((item, index) => {
          if (!responseData?.extension_attributes?.cart
            ?.items[index]?.extension_attributes?.is_free_gift) {
            const productType = item?.product?.__typename;
            const stockQutatity = productType === AppConstants.PRODUCT_TYPE_SIMPLE ? item?.product?.stock_data?.qty : item?.configured_variant?.stock_data?.qty;
            if ((Number(item?.quantity) <= Number(stockQutatity))
            ) {
              return {
                ...item,
                isQuantityNotAvailable: false,
                extensionAttributes: responseData?.extension_attributes?.cart?.items
                  ?.find((element) => Number(item?.id) === Number(element?.item_id)),
              };
            }
            return {
              ...item,
              isQuantityNotAvailable: true,
              extensionAttributes: responseData?.extension_attributes?.cart?.items
                ?.find((element) => Number(item?.id) === Number(element?.item_id)),
            };
          }
          return {
            ...item,
          };
        });

        // update cart id after associate cart
        if(isLoggedIn && responseData?.extension_attributes?.cart?.id && updatedCartId !== String(responseData?.extension_attributes?.cart?.id)){
          window.dispatchEvent(new CustomEvent('react:setCartId', {detail: {cartId: responseData?.extension_attributes?.cart?.id}}));
        }

        setCouponCode(responseData?.extension_attributes?.totals?.coupon_code);

        setCart({ ...cart, data: responseData, isLoading: false });
        window.dispatchEvent(new CustomEvent('updateMiniCart'));
        switch (step) {
          case 1: {
            return window.dispatchEvent(new CustomEvent(
              'react:datalayerViewCartEvent',
              {
                detail: {
                  value: responseData?.prices?.grand_total?.value || 0,
                  currency: responseData?.prices?.grand_total?.currency || '',
                  coupon: responseData?.extension_attributes?.totals?.coupon_code ?? '',
                  productData: responseData?.items?.map((item) => {
                    return {
                      item: item,   
                    };
                  }),
                },
              },
            ));
          }
          case 3: {
            return window.dispatchEvent(new CustomEvent(
              'react:datalayerEvent',
              {
                detail: {
                  type: 'beginCheckoutEvent',
                  payload: {
                    value: responseData?.prices?.grand_total?.value || 0,
                    currency: responseData?.prices?.grand_total?.currency || '',
                    coupon: responseData?.extension_attributes?.totals?.coupon_code ?? '',
                    memberOfferType: responseData?.extension_attributes?.cart?.extension_attributes?.applied_hm_offer_code || '',
                    productData: responseData?.items?.map((item) => {
                      return {
                        item: item,
                      };
                    }),
                  },
                },
              },
            ));
          }
          default: return null;
        }
      }).catch((error) => {
        console.error('getcart error', error);
        setCart({ ...cart, isError: true, isLoading: false });
      });
    },
    [isLoggedIn, cartId, setCart, cart],
  );

  useEffect(() => {
    if (cartId) {
      fetchCart();
    }
  }, [cartId]);

  return null;
};

export default useGetCartGraphql;