import { getGraphqlClient } from '../utils/api-client.js';
import ApiConstants from './api.constants.js';

/**
 * Fetches customer orders using GraphQL query
 * @param {string} orderId - The ID of the order to fetch
 * @returns {Promise<object>} - A promise that resolves to the response data
 */
const getResumeCart = async (encryptedData, channel) => {
  const fetchOrderQuery = `query ($encryptedData: String!) {
  commerce_resumeCart(encrypted_key: $encryptedData) ${ApiConstants.CART_QUERY}
}`;

  try {
    // Await the result of the GraphQL client
    const response = await getGraphqlClient(fetchOrderQuery, { encryptedData }, true, {
        'Alshaya-Channel': channel,
        'Alshaya-Page-Identifier': 'cart'
    });
    return response; // Return the full response object
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    throw error; // Re-throw the error to handle it where the function is called
  }
};

export default getResumeCart;
