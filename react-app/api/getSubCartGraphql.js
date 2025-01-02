import { getGraphqlClient } from '../utils/api-client.js';
import { getTopupEgiftCardId } from '../utils/base-utils.js';

/**
 * get sub cart
 * @returns {{cartData: boolean|{}}}
 */
const getSubCartGraphql = async (isLoggedIn, cartId, subCart) => {
  const updatedCartId = getTopupEgiftCardId() ?? cartId;

  const query = subCart.join('');
  const fetchGuestCartQuery = `query ($cartId: String!) {
    commerce_cart(cart_id: $cartId) { 
      id
      ${query}
    }
  }`;
  const fetchCustomerCartQuery = `query customerCart {
    commerce_customerCart { 
      id  
      ${query}
    }
  }`;

  const getSubCartQuery = isLoggedIn ? fetchCustomerCartQuery : fetchGuestCartQuery;

  let responseDataCart = null;

  try {
    const response = await getGraphqlClient(getSubCartQuery, { cartId: updatedCartId }, true);
    responseDataCart = isLoggedIn
      ? response?.response?.data?.commerce_customerCart
      : response?.response?.data?.commerce_cart;
  } catch (error) {
    console.error('Error getting sub cart:', error);
  }

  return responseDataCart;
};

export default getSubCartGraphql;
