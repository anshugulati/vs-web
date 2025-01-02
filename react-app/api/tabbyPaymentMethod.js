import { getGraphqlClient } from '../utils/api-client.js';
import ApiConstants from './api.constants.js';

export const getTabbyAvailableProducts = async (cartId, isLoggedIn) => {
    let query = ApiConstants.GUEST_TABBY_USER

    if (isLoggedIn) {
        query = ApiConstants.TABBY_LOGGED_IN_USER
    }

    let responseData = {};
    try {
        const variables = isLoggedIn ? {} : { cartId };
        const response = await getGraphqlClient(query, variables, true);
        responseData = response.response.data?.Commerce_TabbyConfig || {};
    } catch (error) {
        console.error('Error fetching tabby available products:', error);
    }

    return responseData;
};
