import { getPayloads } from '../../scripts/payload.js';

const API_URI_MEMBER_BONUS_VOUCHERS = 'hello-member/carts/mine/bonusVouchers';
const API_URI_MEMBER_OFFERS = 'hello-member/carts/mine/memberOffers';
const API_URI_GUESTS_ESTIMATE_SHIPPING_METHODS = 'guest-carts/{{CART_ID}}/estimate-shipping-methods';
const API_URI_LOGGED_IN_ESTIMATE_SHIPPING_METHODS = 'carts/mine/estimate-shipping-methods';
const API_URI_GET_TOKEN_LIST = 'checkoutcomupapi/getTokenList';
const API_URI_GUESTS_GET_CART = 'guest-carts/{{CART_ID}}/getCart';
const API_URI_LOGGED_IN_GET_CART = 'carts/mine/getCart';
const API_URI_ADDRESS_LOCATIONS_SEARCH = 'deliverymatrix/address-locations/search';
const API_URI_CUSTOMER_COUPONS = 'hello-member/customers/coupons';
const API_URI_ASSOCIATE_CARTS = 'carts/mine/associate-cart';
const API_URI_TAMARA_AVAILABILITY_CUSTOMER = 'carts/mine/tamara-payment-availability';
const API_URI_TAMARA_AVAILABILITY_GUEST = 'guestcarts/{{CART_ID}}/tamara-payment-availability';
const API_URI_GET_TAMARA_CONFIG = 'tamara/config';
const API_URI_VERIFY_OTP_AURA = 'verifyotp/identifierNo/{{identifierNo}}/otp/{{otp}}/type/link';
const API_URI_SET_LOYALTY_AURA = 'customers/mine/set-loyalty-card';
const API_URI_SET_LOYALTY_AURA_GUEST = 'apc/set-loyalty-card';
const API_URI_GET_ENROLLED_AURA = 'customers/apc-search/{{searchedType}}/{{inputValue}}';
const API_URI_SIMULATE_SALES_AURA = 'apc/{{identifierNo}}/simulate/sales';
const API_URI_GUEST_CART_SIMILATE_SALES_AURA = 'apc/guest/simulate/sales';
const API_URI_APC_PTS_BALANCE_AURA = 'guest/apc-points-balance/identifierNo/{{identifierNo}}';
const API_URI_GET_REDEEM_PTS_AURA = 'sendotp/identifierNo/{{identifierNo}}/type/link';
const API_URI_REMOVE_REDEEM_PTS_AURA = 'apc/{{identifierNo}}/redeem-points';
const API_URI_REMOVE_REDEEM_PTS_AURA_GUEST = 'guest/{{identifierNo}}/redeem-points';
const API_URI_APC_CUSTOMER_BALANCE_POINTS = 'customers/apc-points-balance/{{customerId}}';
const API_URI_APC_CUSTOMER_AURA_DATA = 'customers/apcCustomerData/{{customerId}}';
const API_URI_APC_STATUS_UPDATE = 'customers/apc-status-update';
const API_URI_REGISTER_CUSTOMER = 'customers';
const API_URI_LOGIN_CUSTOMER = 'integration/customer/token';

const CART_QUERY__SHIPPING_ADDRESSES = await getPayloads('cart_shipping_address');
const CART_QUERY__EXTENSION_ATTRIBUTE = await getPayloads('cart_extension_attributes');
const CART_QUERY__ITEMS = await getPayloads('cart_items');
const CART_QUERY__PRICES = await getPayloads('cart_prices');
const CART_QUERY__PAYMENTS_METHODS = await getPayloads('cart_payment_methods');
const CART_QUERY__MOBILE_NUMBER_VERIFIED = await getPayloads('cart_extension_attribute_mobile_number');
const CART_QUERY = `
    {
        id
        total_quantity
        ${CART_QUERY__EXTENSION_ATTRIBUTE}
        ${CART_QUERY__ITEMS}
        ${CART_QUERY__PRICES}
        ${CART_QUERY__PAYMENTS_METHODS}
    }
`;
const TABBY_USER = await getPayloads('tabby_user');

const CUSTOMER_ORDER_QUERY = await getPayloads('customer_order');
const GET_PRODUCTS = await getPayloads('product_details');
const CHECKOUTCOM_CONFIG_QUERY = await getPayloads('checkoutcom_config');
const DIGITAL_QUERY__EXTENSION_ATTRIBUTE = await getPayloads('digital_cart_extension_attribute');
const DIGITAL_CART_QUERY = `
    {
        id
        total_quantity
        ${DIGITAL_QUERY__EXTENSION_ATTRIBUTE}
        ${CART_QUERY__PAYMENTS_METHODS}
    }
`;
const TAMARA_AVAILABILITY = await getPayloads('tamara_availability');
const TABBY_CONFIG = await getPayloads('tabby_config');

const GUEST_TABBY_USER = `query ( $cartId: String ) {
    Commerce_TabbyConfig (input: {cartId: $cartId}){
      ${TABBY_USER}
    }
}`;

const TABBY_LOGGED_IN_USER = `query {
    Commerce_TabbyConfig {
        ${TABBY_USER}
    }
}`;

const PROMOTION_DYNAMIC_LABEL = await getPayloads('cart_promo_labels');

const CART_QUERY__TOTALS = `
extension_attributes {
    totals{
            base_grand_total
            base_subtotal
            subtotal_incl_tax
            base_discount_amount
            total_segments{
                code
                title
                value
            }
            shipping_incl_tax
            coupon_code
            extension_attributes {
                coupon_label
                reward_points_balance
                reward_currency_amount
                base_reward_currency_amount
                is_hm_applied_voucher_removed
                is_all_items_excluded_for_adv_card
                hps_redeemed_amount
                hps_current_balance
                hps_redemption_type
            }
            items {
                extension_attributes {
                    adv_card_applicable
                }
            }
        }
}`;

const ApiConstants = {
  API_URI_MEMBER_BONUS_VOUCHERS,
  API_URI_MEMBER_OFFERS,
  API_URI_GUESTS_ESTIMATE_SHIPPING_METHODS,
  API_URI_LOGGED_IN_ESTIMATE_SHIPPING_METHODS,
  API_URI_GET_TOKEN_LIST,
  API_URI_GUESTS_GET_CART,
  API_URI_LOGGED_IN_GET_CART,
  API_URI_ADDRESS_LOCATIONS_SEARCH,
  API_URI_CUSTOMER_COUPONS,
  API_URI_ASSOCIATE_CARTS,
  API_URI_TAMARA_AVAILABILITY_CUSTOMER,
  API_URI_TAMARA_AVAILABILITY_GUEST,
  API_URI_GET_TAMARA_CONFIG,
  API_URI_VERIFY_OTP_AURA,
  API_URI_SET_LOYALTY_AURA,
  API_URI_GET_ENROLLED_AURA,
  API_URI_SIMULATE_SALES_AURA,
  API_URI_APC_PTS_BALANCE_AURA,
  API_URI_GET_REDEEM_PTS_AURA,
  API_URI_REMOVE_REDEEM_PTS_AURA,
  API_URI_REMOVE_REDEEM_PTS_AURA_GUEST,
  API_URI_GUEST_CART_SIMILATE_SALES_AURA,
  API_URI_APC_CUSTOMER_BALANCE_POINTS,
  API_URI_APC_CUSTOMER_AURA_DATA,
  API_URI_REGISTER_CUSTOMER,
  API_URI_LOGIN_CUSTOMER,
  API_URI_APC_STATUS_UPDATE,
  API_URI_SET_LOYALTY_AURA_GUEST,

  CART_QUERY__SHIPPING_ADDRESSES,
  CART_QUERY__EXTENSION_ATTRIBUTE,
  CART_QUERY__ITEMS,
  CART_QUERY__PRICES,
  CART_QUERY__PAYMENTS_METHODS,
  CART_QUERY__MOBILE_NUMBER_VERIFIED,
  CART_QUERY,
  CHECKOUTCOM_CONFIG_QUERY,
  CUSTOMER_ORDER_QUERY,
  GET_PRODUCTS,
  DIGITAL_CART_QUERY,
  DIGITAL_QUERY__EXTENSION_ATTRIBUTE,
  TABBY_CONFIG,
  TABBY_USER,
  GUEST_TABBY_USER,
  TAMARA_AVAILABILITY,
  TABBY_LOGGED_IN_USER,
  CART_QUERY__TOTALS,
  PROMOTION_DYNAMIC_LABEL,
};

export default ApiConstants;
