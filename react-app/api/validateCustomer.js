import { getAppbuilderClient } from "../utils/api-client";
import { getConfigValue } from "../../scripts/configs";


const validateCustomerEmail = async (email) => {
    const requestData = {
      storeViewCode: await getConfigValue('commerce-store-view-code'),
      email,
    };
    const responseData = await getAppbuilderClient(
      await getConfigValue('appbuilder-email-verification-endpoint'),
      requestData,
    );
    return responseData?.response;
}

export default validateCustomerEmail;