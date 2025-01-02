import { getGraphqlClient } from '../utils/api-client.js';
import ApiConstants from './api.constants.js';

export const getTamaraAvailability = async(cartId, isLoggedIn) => {
    let responseDataCart = {};

  try {
    const fetchConfigQuery = isLoggedIn ? `query {
      Commerce_TamaraConfig ${ApiConstants.TAMARA_AVAILABILITY}
    }` : `query ($cartId: String) {
      Commerce_TamaraConfig(input: {cartId: $cartId}) ${ApiConstants.TAMARA_AVAILABILITY}
    }`;

  await getGraphqlClient(fetchConfigQuery, isLoggedIn ? {} : {cartId}, true).then((response) => {
      responseDataCart = response?.response?.data?.Commerce_TamaraConfig;
    });
  } catch (error) {
    console.error('Error while fetching the tamara availability:', error);
  }

  return responseDataCart;

};


