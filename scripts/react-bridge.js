/** Bridge between React and Vanilla JS
 * This script listens for custom events dispatched by React components and handles them.
 * It also dispatches custom events to notify React components about certain actions.
 */

import {
  resetMessageForm, showPageErrorMessage, showPageSuccessMessage, validatePhone,
} from './forms.js';
import {
  loadFragment, fireTargetCall, logout, showToastNotification,
  formatDateToCurrentLocale,
} from './scripts.js';
import { pageLoadData, targetOrderConfirmationLoadData } from './target/target-events.js';
import { showAddressForm } from '../blocks/account-address-book/account-address-book-util.js';
import {
  datalayerViewCartEvent,
  datalayerRemoveFromCartEvent,
  datalayerAddToCartEvent,
  dataLayerCartErrorsEvent, dataLayerPromoCodeEvent,
  datalayerBeginCheckoutEvent,
  datalayerAddShippingInfo,
  dataLayerDeliveryOption,
  dataLayerPlaceOrderButtonClick,
  dataLayerSaveAddressEvent,
  dataLayerCustomerExistCheckoutErrors,
  dataLayerCheckoutErrors,
  datalayerConfirmationPageViewEvent,
  datalayerAddPaymentInfo,
  datalayerCodOtpVerification,
  datalayerPaymentErrors,
  datalayerLoyaltySwitchEvent,
  datalayerEgiftCard,
  datalayerHelloMemberPromoSection,
  datalayerHelloMembersOffersSelection,
  datalayerHelloMembersOffersApply,
  datalayerPromoSelectorEvent,
} from './analytics/google-data-layer.js';
import { getConfigValue } from './configs.js';
import { getCustomerLastOrder, getCustomer } from './customer/api.js';
import { store } from './minicart/api.js';
import { createJoinAura } from '../blocks/aura-join/aura-join.js';
import { createLinkAura } from '../blocks/link-your-aura/link-your-aura.js';
import { loginMobile, userRegister, verifyOtpApiCall } from './aura/api.js';

/**
 * Dispatches a custom event with the given name and detail.
 * @param {*} eventName
 * @param {*} detail
 */
function dispatchCustomEvent(eventName, detail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/** Event handlers */
function handleLoadFragment({ detail: { path, targetSelector } }) {
  loadFragment(path).then((fragment) => {
    if (fragment) {
      document.querySelector(targetSelector)?.appendChild(fragment);
    }
  });
}

function handleShowPageErrorMessage({ detail: { message } }) {
  showPageErrorMessage(message, '');
}

function handleShowPageSuccessMessage({ detail: { message } }) {
  showPageSuccessMessage(message, '');
}

function handleResetPageMessage() {
  resetMessageForm();
}

function handleShowToastNotification({ detail: { message } }) {
  showToastNotification(message);
}

function handleFormatDate({ detail: { message } }) {
  dispatchCustomEvent('react:handleFormatDateResult', { value: formatDateToCurrentLocale(message.expiryDate, message.options) });
}

function handleLoadAddressForm({ detail }) {
  const {
    targetSelector,
    placeholder,
    newCustomer,
    isCheckoutPage,
    address,
    isLoggedIn,
    config,
    updateOnlyTelephone,
    infoMessage,
    isTopup,
  } = detail;
  const updatedAddress = Object.keys(address).length === 0
    ? address
    : { ...address, address: address?.custom_attributes?.find((attribute) => attribute.attribute_code === 'address')?.value };
  showAddressForm(
    targetSelector,
    placeholder,
    updatedAddress,
    newCustomer,
    isCheckoutPage,
    isLoggedIn,
    config,
    updateOnlyTelephone,
    infoMessage,
    isTopup,
  );
}

function handleDatalayerViewCartEvent({ detail }) {
  datalayerViewCartEvent(detail);
}

function handleDatalayerRemoveFromCartEvent({ detail }) {
  datalayerRemoveFromCartEvent(detail);
}

function handleDatalayerAddToCartEvent({
  detail: {
    addProduct,
    productData,
    quantity,
    selectedSize,
  },
}) {
  datalayerAddToCartEvent(addProduct, productData, quantity, selectedSize);
}

function handleDataLayerCartErrorsEvent({ detail }) {
  dataLayerCartErrorsEvent(detail);
}

function handleDataLayerPromoCodeEvent({ detail }) {
  dataLayerPromoCodeEvent(detail);
}

function handleDatalayerEvent({ detail: { type, payload } }) {
  const eventMap = {
    beginCheckoutEvent: datalayerBeginCheckoutEvent,
    add_shipping_info: datalayerAddShippingInfo,
    deliveryOption: dataLayerDeliveryOption,
    placeOrderButtonClick: dataLayerPlaceOrderButtonClick,
    saveAddressOnCheckoutPage: dataLayerSaveAddressEvent,
    customerExistError: dataLayerCustomerExistCheckoutErrors,
    checkoutErrors: dataLayerCheckoutErrors,
    PurchaseView: datalayerConfirmationPageViewEvent,
    addPaymentInfo: datalayerAddPaymentInfo,
    codOtpVerification: datalayerCodOtpVerification,
    paymentErrors: datalayerPaymentErrors,
    loyaltySwitch: datalayerLoyaltySwitchEvent,
    eGiftCard: datalayerEgiftCard,
    helloMemberPromoSection: datalayerHelloMemberPromoSection,
    helloMembersOffersSelection: datalayerHelloMembersOffersSelection,
    helloMembersOffersApply: datalayerHelloMembersOffersApply,
    handlePromoSelectorEvent: datalayerPromoSelectorEvent,
  };
  const handler = eventMap[type];
  if (handler) {
    handler(payload);
  } else {
    console.warn(`Unhandled event type: ${type}`);
  }
}

function handleValidateMobileNumber({ detail: { mobile } }) {
  getConfigValue('country-code').then((countryCode) => {
    validatePhone(mobile, countryCode).then((isValidPhoneNumber) => {
      dispatchCustomEvent('react:validateMobileNumberResult', { mobile: !isValidPhoneNumber });
    });
  });
}

function handleGetCustomerLastOrder() {
  getCustomerLastOrder(true).then((response) => {
    dispatchCustomEvent('react:getCustomerLastOrderResult', { response });
  });
}

function handleGetCustomer() {
  getCustomer(true).then((response) => {
    dispatchCustomEvent('react:getCustomerResult', { response });
  });
}

async function handleFireTargetCall({ detail: { type, payload } }) {
  let targetPayload;
  switch (type) {
    case 'orderConfirmation':
      targetOrderConfirmationLoadData(payload).then(async ({ data, xdm = {} }) => {
        await fireTargetCall(data, [`orderConfirmationMbox${data.brand || ''}`], true, xdm);
        window.dispatchEvent(new CustomEvent('target-response'));
      });
      break;
    case 'cart': {
      targetPayload = await pageLoadData();
      const cartIdsWithMarket = payload?.cartId?.map((id) => `${id}_${targetPayload?.market}`).join(', ');
      targetPayload.cartIds = cartIdsWithMarket;
      targetPayload.excludedIds = cartIdsWithMarket;
      await fireTargetCall(targetPayload, [], true, {}, true);
      window.dispatchEvent(new CustomEvent('refresh-target'));
      break;
    }
    default:
      break;
  }
}

function handleLogout({ detail: { redirectUrl } }) {
  logout(redirectUrl);
}

function setCartId({ detail: { cartId } }) {
  store.setCartId(cartId);
}

function handleJoinAura() {
  createJoinAura();
}

function handleLinkAura() {
  createLinkAura();
}

function handleLoginMobile({ detail: { message } }) {
  loginMobile(message.mobile, '').then((response) => {
    dispatchCustomEvent('react:loginMobileResponse', { response });
  });
}

function handleQuickEnroll({
  detail: {
    otp, firstName, lastName, email, phoneNumber, isVerified,
  },
}) {
  verifyOtpApiCall('', phoneNumber, otp).then((res) => {
    if (res) {
      userRegister(firstName, lastName, email, phoneNumber, isVerified).then((response) => {
        dispatchCustomEvent('react:handleQuickEnrollResponse', { response });
      });
    } else {
      dispatchCustomEvent('react:otpVerificationFailed');
    }
  });
}

/**
 * Event handlers map.
 */
const eventHandlers = {
  'react:loadFragment': handleLoadFragment,
  'react:showPageErrorMessage': handleShowPageErrorMessage,
  'react:showPageSuccessMessage': handleShowPageSuccessMessage,
  'react:resetPageMessage': handleResetPageMessage,
  'react:loadAddressForm': handleLoadAddressForm,
  'react:datalayerViewCartEvent': handleDatalayerViewCartEvent,
  'react:datalayerRemoveFromCartEvent': handleDatalayerRemoveFromCartEvent,
  'react:datalayerAddToCartEvent': handleDatalayerAddToCartEvent,
  'react:dataLayerCartErrorsEvent': handleDataLayerCartErrorsEvent,
  'react:dataLayerPromoCodeEvent': handleDataLayerPromoCodeEvent,
  'react:datalayerEvent': handleDatalayerEvent,
  'react:validateMobileNumber': handleValidateMobileNumber,
  'react:getCustomerLastOrder': handleGetCustomerLastOrder,
  'react:getCustomer': handleGetCustomer,
  'react:fireTargetCall': handleFireTargetCall,
  'react:logout': handleLogout,
  'react:setCartId': setCartId,
  'react:showToastNotification': handleShowToastNotification,
  'react:handleJoinAura': handleJoinAura,
  'react:handleLinkAura': handleLinkAura,
  'react:handleFormatDate': handleFormatDate,
  'react:handleLoginMobile': handleLoginMobile,
  'react:handleQuickEnroll': handleQuickEnroll,
};

/** Add event listeners */
Object.keys(eventHandlers).forEach((eventName) => {
  window.addEventListener(eventName, eventHandlers[eventName]);
});

/** Dispatch custom event to notify React that the bridge is loaded */
window.dispatchEvent(new CustomEvent('reactBridgeLoaded'));
