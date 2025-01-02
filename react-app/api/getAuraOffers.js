import { getGraphqlClient } from '../utils/api-client.js';
/**
 * Fetches the Aura offers available for the current logged in user
 * @returns {{offersData: {}}}
 */
const useGetAuraOffers = async () => {
  let offersData = {};
  const qrOffersQuery = `query {
    displayQROffers {
      coupons {
        category_name
        id
        code
        type
        description
        expiry_date
        small_image
        status
        promotion_type
        tag
        tag_name
        value_type
        value_type_name
      }
      message
      error
    }
  }`;

  const activatedOffersQuery = `query {
    displayActivatedOffers {
      accepted_offer {
        category
        code
        customer_id
        description
        name
        opted_in_date
        partner
        country
        partner_image_id
        partner_name
        tag
        tag_name
        weight
      }
      message
      error
    }
  }`;

  const promise1 = getGraphqlClient(qrOffersQuery, {}, true);
  const promise2 = getGraphqlClient(activatedOffersQuery, {}, true);

  await Promise.all([promise1, promise2]).then(([qrOffers, activatedOffers]) => {
    offersData = { qrOffers: qrOffers?.response?.data?.displayQROffers, activatedOffers: activatedOffers?.response?.data?.displayActivatedOffers };
  });

  return offersData;
};

export default useGetAuraOffers;
