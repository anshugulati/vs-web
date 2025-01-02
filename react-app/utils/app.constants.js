const AppConstants = {
  GRAPHQL_AUTHORIZATION: 'graphql-authorization',
  PROGRESS_BAR_STEP_CART: 1,
  PROGRESS_BAR_STEP_LOGIN: 2,
  PROGRESS_BAR_STEP_CHECKOUT: 3,
  PROGRESS_BAR_STEP_CONFIRMATION: 4,
  PAYMENT_METHOD_CODE_COD: 'cashondelivery',
  PAYMENT_METHOD_CODE_CC: 'checkout_com_upapi',
  REDEEM_PAYMENT_METHOD_CODE: 'aura_payment',
  BALANCE_PAYMENT_METHOD_CODE: 'balance_payable',
  GRAND_TOTAL_METHOD_CODE: 'grand_total',
  PAYMENT_METHOD_CODE_APPLEPAY: 'checkout_com_upapi_applepay',
  PAYMENT_METHOD_CODE_TAMARA: 'tamara',
  PAYMENT_METHOD_APPLEPAY_TYPE: 'applepay',
  PAYMENT_METHOD_TABBY: 'tabby',
  PAYMENT_METHOD_CODE_FAWRY: 'checkout_com_upapi_fawry',
  CHECKOUT_COMMERCE_CART_CACHE: 'COMMERCE_CART_CACHE_',
  PAYMENT_METHOD_M2_VENIA_BROWSER_PERSISTENCE__CARTID: 'M2_VENIA_BROWSER_PERSISTENCE__cartId',
  PAYMENT_EGIFT_CARD_GUEST: 'guest',
  PAYMENT_EGIFT_CARD_linked: 'linked',
  hps_payment_method: 'hps_payment',
  LOYALTY_HM_TYPE: 'hello_member',
  LOYALTY_AURA: 'aura',
  GIFT_CARD_TOPUP: 'giftcard_topup',
  LOCAL_STORAGE_KEY_DIGITAL_CART_ID: 'digital-cart-id',
  GOVERNATE_ATTRIBUTE: 'governate',
  KUWAIT_MARKET: 'KW',
  SHIPPING_METHODS: {
    CLICK_AND_COLLECT: 'click_and_collect',
    ALSHAYA_DELIVERY: 'alshayadelivery'
  },
  OOS_TEXT: 'out of stock',
  PRODUCT_OOS_ERROR: 'OUT_OF_STOCK',
  PRODUCT_TYPE_SIMPLE: 'commerce_SimpleProduct',
  BRAND_NAME_BBW: 'BBW',
  PROMOTION_DYNAMIC_LABEL_CONTEXT: 'web',
  APC_LINK_STATUSES: {
    NOT_LINKED_DATA_PRESENT: 1,
    LINKED_VERIFIED: 2,
    LINKED_NOT_VERIFIED: 3,
    NOT_LINKED_DATA_NOT_PRESENT: 4
  }
};

export default AppConstants;