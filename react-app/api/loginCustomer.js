import getRestApiClient from '../utils/api-client.js';
import ApiConstants from './api.constants.js';

/**
 * Login customer
 * @param payload
 * @returns {Promise<{response: null}>|*}
 */
const loginCustomer = (payload) => getRestApiClient(ApiConstants.API_URI_LOGIN_CUSTOMER, true, 'POST', payload);

export default loginCustomer;
