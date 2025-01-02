import { getAppbuilderClient } from "../utils/api-client.js";
import { getConfigValue } from '../../scripts/configs.js';

/** ** @returns {Promise<null>} */ 

const getGuestOrderDetails =
  async (bearerToken) => {
    const requestData = {
      storeViewCode: await getConfigValue("commerce-store-view-code"),
    };
    
    const endpoints = await getConfigValue("appbuilder-guest-order-details");
    const completeEndpoint = `${endpoints}/${requestData?.storeViewCode}`
    
    const responseData = await getAppbuilderClient(
      completeEndpoint,
      requestData,
      'GET',
      bearerToken
    );
    return responseData?.response;
  };
  
export default getGuestOrderDetails;
