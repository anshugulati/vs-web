import getRestApiClient from '../utils/api-client.js';
import { removeCartInfoFromLocal } from '../utils/local-storage-util.js';
import { getTopupEgiftCardId } from '../utils/base-utils.js';

const updateCart = async (body, cartId, isLoggedIn, responseObj = false, guestUrl = false) => {
  // Get the cart context


  const updatedCartId = getTopupEgiftCardId() ?? cartId;
  const customerLoggedIn = getTopupEgiftCardId() ? false : isLoggedIn;

  const getCartURI = guestUrl || !customerLoggedIn
    ? `guest-carts/${updatedCartId}/updateCart`
    : 'carts/mine/updateCart';

  let responseData = {};
  try {
    const response = await getRestApiClient(getCartURI, customerLoggedIn, 'POST', body, 'V1', responseObj);
    if(responseObj && response?.response?.status === 404) {
      removeCartInfoFromLocal();
      window.location.href = `/${document.documentElement?.lang || 'en'}/cart`;
    }
    responseData = response?.response;
    window.dispatchEvent(new CustomEvent('updateMiniCart'));
  } catch (error) {
    console.log(error, 'error');
  }
  return responseData;
};

export default updateCart;
