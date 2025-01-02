import getRestApiClient from '../utils/api-client.js';
import ApiConstants from './api.constants.js';

/**
 * Register customer
 * @param payload
 * @returns {Promise<{response: null}>|*}
 */
const registerCustomer = (payload) => getRestApiClient(ApiConstants.API_URI_REGISTER_CUSTOMER, true, 'POST', payload);

export default registerCustomer;
