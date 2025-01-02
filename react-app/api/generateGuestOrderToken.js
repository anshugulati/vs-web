import { getAppbuilderClient } from "../utils/api-client.js";
import { getConfigValue } from '../../scripts/configs.js';

/** * Generate guest order token * * @param reservedOrderId * @returns {Promise<null>} */ 

const generateGuestOrderToken =
  async (reservedOrderId) => {
    const requestData = {
      storeViewCode: await getConfigValue("commerce-store-view-code"),
      reservedOrderId,
    };
    const responseData = await getAppbuilderClient(
      await getConfigValue("appbuilder-guest-order-token"),
      requestData
    );
    return responseData?.response;
  };
  
export default generateGuestOrderToken;
