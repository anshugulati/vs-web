import { getGraphqlClient } from '../utils/api-client.js';
import ApiConstants from './api.constants.js';

/**
 * deletes the product from cart
 * @returns {{cartData: boolean|{}}}
 */
const removeCartGraphql = async (cartItemId, cartId) => {
  const deleteProductQuery = `mutation removeItemFromCart($cartId: String!, $cartItemId: ID!) {
      commerce_removeItemFromCart(
        input: {
          cart_id: $cartId,
          cart_item_uid: $cartItemId
        }
      )
      {
        cart ${ApiConstants.CART_QUERY}
      }
    }`;

  let responseDataCart = [];

  try {
    const response = await getGraphqlClient(deleteProductQuery, { cartId, cartItemId }, true);
    responseDataCart = response.response.data.commerce_removeItemFromCart.cart;
    const cartIdAfterDeleting = responseDataCart?.items?.map(item => item?.product?.sku);
    window.addEventListener('updateMiniCartResult', ({ detail })=> {
      window.dispatchEvent(
        new CustomEvent('react:fireTargetCall', {
          detail: {
            type: 'cart',
            payload: {
              cartId : cartIdAfterDeleting
            },
          },
        })
      );
    },{once:true})
    
    window.dispatchEvent(new CustomEvent('updateMiniCart'));
  } catch (error) {
    console.error('Error removing item from cart:', error);
  }

  return responseDataCart;
};

export default removeCartGraphql;
