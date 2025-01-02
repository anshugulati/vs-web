import getRestApiClient from '../utils/api-client.js';
import { getTopupEgiftCardId } from '../utils/base-utils.js';

const removeRedeemCardRedemption = async (body, isLoggedIn) => {
  const removeRedemptionURI = isLoggedIn ? 'egiftcard/remove-redemption': 'guest-carts/remove-redemption';

  let responseData = {};
  try {
    const response = await getRestApiClient(removeRedemptionURI, isLoggedIn, 'POST', body);
    responseData = response?.response;
  } catch (error) {
    console.log(error, 'error');
  }
  return responseData;
};

export const removeRedeemCardRedemptionOnCartUpdate = async (cart, isLoggedIn) => {
  if(cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_redemption_type){
    const payload = isLoggedIn ? {
        redemptionRequest: {
            quote_id: cart?.data?.extension_attributes?.cart?.id,
        }
    } : {
        redemptionRequest: {
            mask_quote_id: getTopupEgiftCardId() ?? cart?.data?.id,
        }
    };
    const response = await removeRedeemCardRedemption(payload, isLoggedIn);
    return response;
  }
  return;
};

export default removeRedeemCardRedemption;
