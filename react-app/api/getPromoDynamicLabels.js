import { getGraphqlClient } from '../utils/api-client.js';
import ApiConstants from './api.constants.js';
import AppConstants from '../utils/app.constants.js';

export const getPromoDynamicLabels = async (cart) => {
    try {
        // Destructure necessary properties from cart
        const {
            data: {
                prices: { subtotal_including_tax: { value: subtotal } = {} } = {},
                extension_attributes: { cart: { applied_rule_ids: appliedRuleIds } = {} } = {},
                items: cartItems = []
            } = {}
        } = cart || {};

        // If subtotal or appliedRuleIds are missing, return early
        if (!subtotal || !appliedRuleIds) return {};

        // Map items into the required structure
        const items = cartItems.map(({ product, quantity }) => ({
            sku: product?.sku,
            qty: quantity,
            price: product?.price_range?.maximum_price?.final_price?.value,
        }));

        const fetchConfigQuery = `query($subtotal: Float!, $appliedRuleIds: String!, $items: [commerce_ItemInputData]!) {
            commerce_promoDynamicLabelCart(
                context: "${AppConstants.PROMOTION_DYNAMIC_LABEL_CONTEXT}",
                cart: {
                    subtotal: $subtotal,
                    applied_rules: $appliedRuleIds,
                    items: $items
                }
            ) {
                ${ApiConstants.PROMOTION_DYNAMIC_LABEL}
            }
        }`;

        // Call the GraphQL client
        const response = await getGraphqlClient(fetchConfigQuery, { subtotal, appliedRuleIds, items }, false);
        return response?.response?.data?.commerce_promoDynamicLabelCart || {};
    } catch (error) {
        console.error('Error while fetching the dynamic promo label:', error.message);
        return {}; // Optionally return an empty object to avoid undefined results
    }
};
