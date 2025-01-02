import React, {
  useEffect, useContext,
  useCallback,
  useState,
  useRef,
} from 'react';
import PaymentMethod from './payment-method/payment-method';
import PaymentMethodEGiftCard from './payment-method/payment-method-egift-card';
import CartContext from '../../../../context/cart-context';
import {
  isApplePayAvailable,
  preparePaymentData,
  isUpapiPaymentMethod,
  isPostpayPaymentMethod,
  getLastOrder,
  validateOrder,
  getPayable
} from './utilities/utils.js';
import updateCart from '../../../../api/updateCart.js';
import './payment-methods.css';
import CashOnDelivery from './payment-method/cash-on-delivery/cash-on-delivery';
import AppConstants from '../../../../utils/app.constants';
import CheckoutComUpiContext from '../../../../context/checkoutcomupi-context.jsx';
import CheckoutComUpapi from './checkout-com-upapi/index.jsx';
import placeOrder from '../../../../api/placeOrder';
import { GTM_CONSTANTS, PAYMENT_METHODS_NOT_FOR_EGIFTS } from '../../../cart/constants.js';
import validateCartResponse from './utilities/validation_utils.js';
import { getTopupEgiftCardId, hasValue } from '../../../../utils/base-utils.js';
import validateBeforePaymentFinalise from './utilities/validateBeforePaymentFinalize.js';
import getSubCartGraphql from '../../../../api/getSubCartGraphql.js';
import ApiConstants from '../../../../api/api.constants.js';
import DefaultPayment from './default-payment/default-payment.jsx';
import Loader from '../../../../shared/loader/loader.jsx';
import RedeemEgiftCard from '../redeem-egift-card/redeem-egift-card.jsx';
import Loyalty from '../loyalty/loyalty.jsx';
import { getConfigValue, getLanguageAttr } from '../../../../../scripts/configs.js';
import CheckoutComUpiApplePay from './checkout-com-upi-apple-pay';
import { removeCartInfoFromLocal } from '../../../../utils/local-storage-util.js';
import generateGuestOrderToken from '../../../../api/generateGuestOrderToken.js';
import Tabby from './payment-method/tabby/tabby';
import Icon from '../../../../library/icon/icon';
import TamaraPayment from './tamara/index.jsx';
import { getTamaraAvailability } from '../../../../api/getTamaraAvailability.js';
import Tamara from '../../../../utils/tamara-utils.js';
import TabbyUtils from '../../../../utils/tabby-utils';
import FawryPayment from './payment-method/fawry/index.jsx';

function PaymentMethods({ paymentMethods, paymentRef, paymentLogoList, blockContent }) {
  const [isLoading, setIsLoading] = useState(true);
  const [paymentCallbackSuccess, setPaymentCallbackSuccess] = useState();
  const [paymentCallbackError, setPaymentCallbackError] = useState();
  const [confirmationURI, setConfirmationURI] = useState();

  const paymentMethodsRef = useRef();

  const {
    cart, setCart, placeholders, isLoggedIn, methods, setMethods, setCompletePurchaseLoading, isDisablePayment, selectedMethod, deliveryInformation, setPaymentMethodsContinuePurchaseLabels, fullPaymentByEgift, isHideSectionInCheckout, isTopupFlag, lastOrderDetails, lastOrderDetailsLoaded, isTamaraAvailable, selectedPaymentMethod, setSelectedPaymentMethod, setTamaraAvailable, setIsTabbyAvailable, setTabbyConfig, tabbyConfig, isTabbyAvailable, fullPaymentUsingAura, configs, isBNPLAllowed
  } = useContext(CartContext);
  const {
    checkoutComUpiConfig, isConfigLoaded
  } = useContext(CheckoutComUpiContext);

  const allPaymentMethodv2 = configs?.['checkout-all-payment-methods-v2'] === 'true';
  const shouldEnableCheckoutAuraV2 = configs['enable-checkout-aura-v2'] === 'true';
  const shouldEnableDeliveryAndBillingAddressV2 = configs['checkout-delivery-and-billing-address-v2'] === 'true';
  const isCLMDowntime = configs['clm-downtime'] === 'true';

  let grandTotal = getPayable(cart);
  const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
  const updateCartApi = async (methodCode) => {
    const shippingDetails = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping;
    const isAllEgift = cart?.data?.extension_attributes?.cart?.items?.every((d) => d?.extension_attributes?.is_egift === '1');
    if (isTopupFlag || (shippingDetails?.method && shippingDetails?.address?.firstname) || isAllEgift) {
      const mCode = fullPaymentByEgift ? AppConstants.hps_payment_method : methodCode;
      const paymentData = {
        payment: {
          method: mCode,
          additional_data: {},
        },
      };

      const paymentInfo = preparePaymentData(paymentData, paymentCallbackSuccess, paymentCallbackError);
      const result = await updateCart(paymentInfo, cart.data.id, isLoggedIn, true);
      if (result?.status !== 200 && result?.message) { // response will have a error message
        showErrorMessage(result.message);
      } else if (result?.success) {
        setSelectedPaymentMethod(methodCode);
        setCart(prevCart => ({
          ...prevCart,

          data: {
            ...prevCart?.data,
            selected_payment_method: {
              code: methodCode
            },
            extension_attributes: {
              ...prevCart.data.extension_attributes,
              cart: {
                ...prevCart.data.extension_attributes.cart,
                reserved_order_id: result?.data?.cart?.reserved_order_id,
                extension_attributes: {
                  ...prevCart.data.extension_attributes.cart.extension_attributes,
                  surcharge: result.data.cart.extension_attributes.surcharge
                }
              },
              totals: result.data.totals
            },
          },
        }));

        return result;
      }
    }
  };

  useEffect(() => {
    (async () => {
      const successCallback = await getConfigValue('cart-payment-callback-success-uri');
      const errorCallback = await getConfigValue('cart-payment-callback-error-uri');
      const confirmation = await getConfigValue('cart-confirmation-uri');

      setPaymentCallbackSuccess(successCallback);
      setPaymentCallbackError(errorCallback);
      setConfirmationURI(confirmation);
      // await TabbyUtils.refresh(cart, isLoggedIn, setIsTabbyAvailable, setTabbyConfig, tabbyConfig);
      // await Tamara.isAvailable(cart, setTamaraAvailable, isLoggedIn);
    })();
  }, []);

  const updatePaymentListener = useCallback(()=>{
    updateCartApi(cart.data?.selected_payment_method?.code)
  }, [cart])

  useEffect(() => {
    window.addEventListener('react:updatePaymentMethod', updatePaymentListener);
    return () => {
      window.removeEventListener('react:updatePaymentMethod', updatePaymentListener);
    }
  }, [updatePaymentListener])
  useEffect(() => {
    if (fullPaymentByEgift) {
      const updatedMethods = methods.map((method) => {
        method.isSelected = false;
        return method;
      });
      setMethods(updatedMethods);
    } else {
      const updatedMethods = methods.map((method) => {
        method.isSelected = method.code === cart?.data?.selected_payment_method?.code;
        return method;
      });
      setMethods(updatedMethods);
    }
  }, [fullPaymentByEgift, cart?.data?.selected_payment_method?.code]);


  const onChangePaymentMethod = async (paymentMethod) => {
    const updatedMethods = methods.map((method) => {
      if (method.code === paymentMethod.code) {
        method.isSelected = true;
      } else {
        method.isSelected = false;
      }
      return method;
    });
    setMethods(updatedMethods);
    updateCartApi(paymentMethod.code);
  };

  const getPaymentMethodContinuePurchase = (code, content) => {
    const elements = content.querySelectorAll('p');
    let label = '';
    if (code === AppConstants.PAYMENT_METHOD_CODE_APPLEPAY) label = elements?.[1]?.innerHTML ?? '';

    if (code === AppConstants.PAYMENT_METHOD_TABBY) label = placeholders.tabbyCtaBtn ?? '';

    if (code === AppConstants.PAYMENT_METHOD_CODE_TAMARA) label = placeholders.continueWithTamara;
    return {
      code,
      label
    };
  }

  useEffect(() => {
    const shippingDetails = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping;
    const availablePaymentMethods = isConfigLoaded && !checkoutComUpiConfig ? cart.data?.available_payment_methods?.filter(method => method.code !== AppConstants.PAYMENT_METHOD_CODE_CC) : cart.data?.available_payment_methods || [];
    //remove payment methods from the list that are not supported for egift purchase
    const isContainEgift = cart.data?.extension_attributes?.cart?.items.some(item => item.extension_attributes?.is_egift === '1');
    const availablePayments = isContainEgift && availablePaymentMethods.filter(payment => !PAYMENT_METHODS_NOT_FOR_EGIFTS.includes(payment.code)) || availablePaymentMethods;
    let filteredPayments = paymentMethods;

    if (isConfigLoaded && filteredPayments && lastOrderDetailsLoaded) {
      const paymentMethodsJson = [];
      const methodsPurchaseLabels = [];

      Object.values(filteredPayments).forEach(async (method) => {
        const [key, isDefaultSelected, content, icon] = method.querySelectorAll('td');
        const paymentMethodCode = key.innerHTML;
        if (availablePayments.find((available) => available.code === paymentMethodCode)) {
          if (paymentMethodCode === AppConstants.PAYMENT_METHOD_CODE_APPLEPAY && !isApplePayAvailable()) {
            return;
          }
          methodsPurchaseLabels.push(getPaymentMethodContinuePurchase(paymentMethodCode, content));
          //logics for selecting payment method.
          const getPaymentMethodSelected = () => {
            if (cart.data?.selected_payment_method.code) {
              return cart.data?.selected_payment_method.code === paymentMethodCode
            } else if (isApplePayAvailable()) {
              return paymentMethodCode === AppConstants.PAYMENT_METHOD_CODE_APPLEPAY
            } else {
              return !!isDefaultSelected.innerHTML
            }
          }
          const metaData = {
            code: paymentMethodCode,
            isSelected: getPaymentMethodSelected(),
            icon,
            title: content.querySelector('p') ? content.querySelector('p').innerHTML : content.innerHTML,
            body: content.querySelectorAll('p').length > 1 ? Array.from(content.querySelectorAll('p')).slice(1) : [],
          };
          if (paymentMethodCode === AppConstants.PAYMENT_METHOD_TABBY) {
            const titleText = content.querySelector('p') ? content.querySelector('p').innerHTML : content.innerHTML;
            const tabbyTitle = <div className='tabby-method-label'>{titleText}
              <div className='tabby-popup-btn'><button
                type="button"
                className="installment-popup"
                data-tabby-info-alshaya="installments"
                data-tabby-language={document.documentElement.lang}
                data-tabby-price={grandTotal}
                data-tabby-currency={grandTotalCurrency}
              ></button>
                <Icon name='info-blue' />
              </div>
            </div>;

            metaData.title = tabbyTitle;
          }

          paymentMethodsJson.push(metaData);
          if (paymentMethodCode === AppConstants.PAYMENT_METHOD_TABBY && shippingDetails?.method && shippingDetails?.address?.firstname && isBNPLAllowed) {
            await TabbyUtils.refresh(cart, isLoggedIn, setIsTabbyAvailable, setTabbyConfig, tabbyConfig);
          }
          if (paymentMethodCode === AppConstants.PAYMENT_METHOD_CODE_TAMARA && shippingDetails?.method && shippingDetails?.address?.firstname && isBNPLAllowed) {
            await Tamara.isAvailable(cart, setTamaraAvailable, isLoggedIn);
          }
        }
      });

      setPaymentMethodsContinuePurchaseLabels(methodsPurchaseLabels);

      if (!cart.data?.selected_payment_method?.code) {
        if (lastOrderDetails?.payment?.method) {
          let isAvailable = paymentMethodsJson.some(m => m.code === lastOrderDetails?.payment?.method);
          if (isAvailable) {
            paymentMethodsJson.forEach(m => {
              m.isSelected = m.code === lastOrderDetails?.payment?.method;
            })
          }
        }
        const selectedMethodPay = paymentMethodsJson.find((methodJson) => methodJson.isSelected);

        if (selectedMethodPay?.code) {
          updateCartApi(selectedMethodPay.code);
        } else if (paymentMethodsJson.length > 0) {
          paymentMethodsJson[0].isSelected = true;
          updateCartApi(paymentMethodsJson[0].code);
        }
      } else {
        /*const selectedMethodIndex = paymentMethodsJson.findIndex((methodJson) => methodJson.code === cart.data?.selected_payment_method.code);
        if (selectedMethodIndex > -1) {
          paymentMethodsJson[selectedMethodIndex].isSelected = true;
        } else if (paymentMethodsJson.length > 0) {
          paymentMethodsJson[0].isSelected = true;
          updateCartApi(paymentMethodsJson[0].code);
        }*/
      }
      const selectedMethodPay = paymentMethodsJson.find((methodJson) => methodJson.isSelected);
      if (!selectedMethodPay && paymentMethodsJson.length > 0) {
        paymentMethodsJson[0].isSelected = true;
        updateCartApi(paymentMethodsJson[0].code);
      }
      paymentMethodsRef.current = paymentMethodsJson;
      setMethods(paymentMethodsJson);
      setIsLoading(false);
    }
  }, [cart.data?.available_payment_methods, cart.data?.selected_payment_method?.code, paymentMethods, setMethods, isConfigLoaded, lastOrderDetails, lastOrderDetailsLoaded]);

  useEffect(() => {
    if (isConfigLoaded && !methods?.length) {
      return;
    }
    let availableMethods = [...methods];

    if (!isTamaraAvailable) {
      availableMethods = methods?.filter(method => method.code !== AppConstants.PAYMENT_METHOD_CODE_TAMARA);
    } else {
      if (!methods.some(method => method.code === AppConstants.PAYMENT_METHOD_CODE_TAMARA)) {
        const tamara = paymentMethodsRef?.current?.find(method => method.code === AppConstants.PAYMENT_METHOD_CODE_TAMARA);
        if (tamara) {
          const tabbyIndex = methods?.findIndex(method => method.code === AppConstants.PAYMENT_METHOD_TABBY);
          if (tabbyIndex > -1)
            availableMethods.splice(tabbyIndex, 0, tamara);
          else
            availableMethods = availableMethods.concat(tamara);
        }
      }
    }
    if (!isTabbyAvailable) {
      availableMethods = methods?.filter(method => method.code !== AppConstants.PAYMENT_METHOD_TABBY);
    }
    else {
      if (!methods.some(method => method.code === AppConstants.PAYMENT_METHOD_TABBY)) {
        const tabby = paymentMethodsRef?.current?.find(method => method.code === AppConstants.PAYMENT_METHOD_TABBY);
        if (tabby)
        {
          availableMethods = availableMethods.concat(tabby);
        }
      }
    }
    const availablePaymentMethods = cart.data?.available_payment_methods || [];
    if (availablePaymentMethods?.length) {
      const allAvailableMethodCodes = availablePaymentMethods.map(m => m.code);
      availableMethods = availableMethods.map(method => {
        return {
          ...method,
          hide: !(method && allAvailableMethodCodes.includes(method.code))
        }
      })
    }
    setMethods(availableMethods);
  }, [cart.data?.available_payment_methods, cart.data?.selected_payment_method?.code, paymentMethods, isTamaraAvailable, isTabbyAvailable]);


  useEffect(() => {
    const paymentMethodCode = cart.data?.selected_payment_method?.code;
    if (paymentMethodCode) {
      setSelectedPaymentMethod(paymentMethodCode)
    }
  }, [cart]);

  const showErrorMessage = (errorMessage) => {
    if (errorMessage) {
      window.dispatchEvent(new CustomEvent('react:showPageErrorMessage', {
        detail: {
          message: errorMessage,
        },
      }));
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  // eslint-disable-next-line consistent-return
  const submitOrder = useCallback(async (paymentMethod, guestOrderToken, reservedOrderId) => {
    let cartId, customerLoggedIn;
    if (getTopupEgiftCardId()) {
      cartId = getTopupEgiftCardId() ?? cart?.data?.id
      customerLoggedIn = getTopupEgiftCardId() ? false : isLoggedIn
    } else {
      cartId = cart?.data?.id
      customerLoggedIn = isLoggedIn
    }
    const cartResult = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__EXTENSION_ATTRIBUTE]);
    if (cartResult) setCart({ ...cart, data: { ...cart?.data, ...cartResult } });
    const validationResponse = await validateBeforePaymentFinalise({ data: cartResult }, placeholders, selectedMethod);
    if (hasValue(validationResponse.data)
      && hasValue(validationResponse.data.error) && validationResponse.data.error
    ) {
      if (!validateCartResponse(validationResponse.data, placeholders)) {
        if (typeof validationResponse.data.message !== 'undefined') {
          console.error(validationResponse.message, GTM_CONSTANTS.CHECKOUT_ERRORS);
        }
      }
      if (validationResponse.data.errorMessage) showErrorMessage(validationResponse.data.errorMessage);
      setCompletePurchaseLoading(false);
      return null;
    }

    const placeOrderResponse = await placeOrder(
      {
        cartId,
      },
      cartId,
      customerLoggedIn,
    ).then(async (response) => {
      if (!response) {
        console.error('Got empty response while placing the order.');
        setCompletePurchaseLoading(false);
        return response;
      }
      if (!response.data && response.message) {
        showErrorMessage(response.message);
        window.dispatchEvent(new CustomEvent(
          'react:datalayerEvent',
          {
            detail: {
              type: 'paymentErrors',
              payload: {
                eventLabel: response.message
              }
            }
          }
        ));
        return null;
      }
      const redirectUrl = response?.data?.redirect_url;
      const result = {
        success: true,
      };
      if (redirectUrl) {
        result.success = false;
        result.redirectUrl = response.data.redirect_url;

        // This is postpay specific. In future if any other payment gateway sends
        // token, we will have to add a condition here.
        if (typeof response?.data?.token !== 'undefined') {
          result.token = response.data.token;
        }

        return { data: result };
      }

      let orderId = parseInt(response.data, 10);
      const cartId = cart?.data?.extension_attributes?.cart?.id;
      if (hasValue(response.status)
        && response.status >= 500
        && !isPostpayPaymentMethod(paymentMethod)
        && !isUpapiPaymentMethod(paymentMethod)
      ) {
        if (isLoggedIn) {
          const lastOrder = await getLastOrder();
          if (hasValue(lastOrder)
            && hasValue(lastOrder.quote_id)
            && lastOrder.quote_id === cartId
          ) {
            orderId = lastOrder.order_id;
          }
        } else {
          const maskedCartId = cart?.data?.id;
          const orderPlaced = await validateOrder(maskedCartId);
          if (hasValue(orderPlaced)
            && hasValue(orderPlaced.quote_id)) {
            orderId = orderPlaced.order_id;
          }
        }
      }

      if (!orderId || Number.isNaN(orderId)) {
        result.error = true;
        result.error_message = placeholders?.globalDefaultErrorMessage;
        try {
          if (response.data?.message && JSON.parse(response.data.message)) {
            const parsedMessage = JSON.parse(response.data.message);
            result.error_message = parsedMessage?.system_error;
          }
        } catch(err) {}
        return { data: result };
      }

      const secureOrderId = btoa(JSON.stringify({
        reserveOrderId: reservedOrderId,
        email: cart.data.extension_attributes.cart.billing_address.email,
        token: guestOrderToken,
      }));

      // clear cart info from local storage
      removeCartInfoFromLocal();
      result.redirectUrl = `/${getLanguageAttr()}${confirmationURI}?oid=${secureOrderId}`;
      const { message } = response.data;
      showErrorMessage(message);

      return { data: result };
    }).catch((error) => console.error(error, 'place order error'));
    if (placeOrderResponse?.data?.error_message) {
      showErrorMessage(placeOrderResponse?.data.error_message);
      return;
    }
    if (placeOrderResponse?.data) {
      window.location.href = placeOrderResponse.data.redirectUrl;
    }
  }, [cart, confirmationURI]);

  // eslint-disable-next-line consistent-return
  const finalisePayment = useCallback(async (paymentData, applePaySessionObject = '') => {
    let reservedOrderId = cart?.data?.extension_attributes?.cart?.reserved_order_id;
    let guestOrderToken = null;
    const currentLanguage = getLanguageAttr();


    // update reserve order id on mismatch
    const shippingCode = reservedOrderId?.substring(4,6);
    const deliveryType = cart.data.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type;

    const disableReserveOrderCheck = await getConfigValue('disable-reserve-order-check');
    if(disableReserveOrderCheck !== 'true'){
      if((deliveryType === 'home_delivery' && shippingCode !== 'HD') || // check home delivery
      (deliveryType === 'ship_to_store' && shippingCode !== 'SS') || // check click and collect
      (!deliveryType && shippingCode !== 'DH') || // check egift
      (reservedOrderId?.[6] && reservedOrderId[6] !== currentLanguage.toUpperCase()[0]) // check language mismatch
      ) {
        const respData = await updateCartApi(cart.data?.selected_payment_method?.code)
        reservedOrderId = respData?.data?.cart?.reserved_order_id ?? reservedOrderId;
      }
    }

    if (!isLoggedIn && reservedOrderId) {
      try {
        const responseGuestOrderToken = await generateGuestOrderToken(reservedOrderId);
        guestOrderToken = responseGuestOrderToken?.token;
      } catch (error) {
        console.error("Error generating guest order token:", error);
      }
    }
    const paymentInfo = preparePaymentData(paymentData, paymentCallbackSuccess, paymentCallbackError, guestOrderToken, reservedOrderId);
    const response = await validateBeforePaymentFinalise(cart, placeholders, selectedMethod);
    if (hasValue(response.data)
      && hasValue(response.data.error) && response.data.error
    ) {
      if (!validateCartResponse(response.data, placeholders)) {
        if (typeof response.data.message !== 'undefined') {
          console.error(response.message, GTM_CONSTANTS.CHECKOUT_ERRORS);
        }
      }
      if (response.data.error_message) {
        showErrorMessage(response.data.error_message);
      }
      setCompletePurchaseLoading(false);
      return null;
    }
    const paymentMethod = paymentData.payment.method;
    let cartId, customerLoggedIn;
    if (getTopupEgiftCardId()) {
      cartId = getTopupEgiftCardId() ?? cart?.data?.id
      customerLoggedIn = getTopupEgiftCardId() ? false : isLoggedIn
    } else {
      cartId = cart?.data?.id
      customerLoggedIn = isLoggedIn
    }
    await updateCart(paymentInfo, cartId, customerLoggedIn, true).then(async (response) => {
      if (response?.status !== 200 && response?.message) { // response will have a error
        showErrorMessage(response.message);
        return;
      }

      const resultData = response?.data;
      if (!resultData) {
        setCompletePurchaseLoading(false);
        return;
      }

      if (resultData.error === undefined && paymentMethod === AppConstants.PAYMENT_METHOD_CODE_APPLEPAY) {
        applePaySessionObject.completePayment(window.ApplePaySession.STATUS_SUCCESS);
      }
      if (resultData.error !== undefined && resultData.error) {
        setCompletePurchaseLoading(false);
        if (resultData.error_code !== undefined) {
          const errorCode = parseInt(resultData.error_code, 10);
          if (errorCode === 404) {
            window.location.href = `/${getLanguageAttr()}/cart`;
          } else {
            const errorMessage = resultData.message === undefined
              ? resultData.error_message
              : resultData.message;
            showErrorMessage(errorMessage);
          }
        }
        window.dispatchEvent(new CustomEvent(
          'react:datalayerEvent',
          {
            detail: {
              type: 'paymentErrors',
              payload: {
                eventLabel: errorMessage
              }
            }
          }
        ))
      } else if (resultData.cart?.id !== undefined && resultData.cart?.id) {
        await submitOrder(paymentMethod, guestOrderToken, reservedOrderId);
        updateDataLayer(paymentMethod)
        window.dispatchEvent(new CustomEvent(
          'react:datalayerEvent',
          {
            detail: {
              type: 'placeOrderButtonClick',
            },
          },
        ));
      } else if (resultData.success === undefined || !(resultData.success)) { /* empty */ } else if (resultData.redirectUrl !== undefined) {
        window.location = resultData.redirectUrl;
      }
    }).catch((error) => {
      console.error(error);
      if (paymentMethod === AppConstants.PAYMENT_METHOD_CODE_APPLEPAY) {
        applePaySessionObject.completePayment(window.ApplePaySession.STATUS_FAILURE);
      }
    });
  }, [paymentCallbackSuccess, paymentCallbackError, cart, placeholders, selectedMethod, isLoggedIn, setCompletePurchaseLoading, submitOrder]);

  const renderMethodBody = (method) => {
    if (method?.code === AppConstants.PAYMENT_METHOD_CODE_COD) {
      return (
        <div className="payment-method-bottom-panel">
          <CashOnDelivery ref={paymentRef} finalisePayment={finalisePayment} />
        </div>
      );
    }
    if (method?.code === AppConstants.PAYMENT_METHOD_CODE_CC) {
      return (
        <>
        {allPaymentMethodv2 && <span className='cc-label-title'>{placeholders.checkoutEnterTheCardDetailsText}</span>}
        <div className="payment-method-bottom-panel">
          {/* <CheckoutComUpiContextProvider> */}

          <CheckoutComUpapi
            finalisePayment={finalisePayment}
            ref={paymentRef}
            paymentLogoList={paymentLogoList}
            isTopupFlag={isTopupFlag}
          />
          {/* </CheckoutComUpiContextProvider> */}
        </div></>
      );
    }
    if (method?.code === AppConstants.PAYMENT_METHOD_CODE_APPLEPAY && isApplePayAvailable()) {
      return (
        <div className="payment-method-bottom-panel">
          {/* <CheckoutComUpiContextProvider> */}
          <CheckoutComUpiApplePay
            finalisePayment={finalisePayment}
            cart={cart}
            placeholders={placeholders}
            ref={paymentRef}
          />
          {/* </CheckoutComUpiContextProvider> */}
        </div>
      );
    }
    if (method?.code === AppConstants.PAYMENT_METHOD_CODE_TAMARA) {
      return (
        <div className="payment-method-bottom-panel">
          {allPaymentMethodv2 && <div className="payment-method__subtitle__two">{placeholders.checkoutTamaraInfoText}</div>}
          <TamaraPayment
            finalisePayment={finalisePayment}
            placeholders={placeholders}
            method={method}
            context="installment"
            ref={paymentRef} />
        </div>
      );
    }
    if (method?.code === AppConstants.PAYMENT_METHOD_TABBY) {
      return (
        <div className="payment-method-bottom-panel">
          <Tabby ref={paymentRef} finalisePayment={finalisePayment} amount={grandTotal} currency={grandTotalCurrency} />
        </div>
      );
    }
    if (method?.code === AppConstants.PAYMENT_METHOD_CODE_FAWRY) {
      return (
        <div className="payment-method-bottom-panel">
          <FawryPayment
            finalisePayment={finalisePayment}
            placeholders={placeholders}
            method={method}
            ref={paymentRef} />
        </div>
      );
    }
    return <DefaultPayment ref={paymentRef} code={method.code} finalisePayment={finalisePayment} />;
  };

  const isFullRedeemEgift = cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_redemption_type === AppConstants.PAYMENT_EGIFT_CARD_GUEST && fullPaymentByEgift;
  const isFullPaymentEgift = cart?.data?.extension_attributes?.totals?.extension_attributes?.hps_redemption_type === AppConstants.PAYMENT_EGIFT_CARD_linked && fullPaymentByEgift;

  const { redeemegifthead, redeemegifttitle, redeemegiftsubtitle, loyalty } = blockContent;
  const methodsToRender = Array.from(methods)?.filter((d) => {
    if (d.code === AppConstants.PAYMENT_METHOD_TABBY) {
      return isDisablePayment ? true : isTabbyAvailable;
    } else if (d.code === AppConstants.PAYMENT_METHOD_CODE_TAMARA) {
      return isDisablePayment ? true : isTamaraAvailable;
    } else {
      return !d.hide;
    }
  });

  return (
    <>
      <div id="spc-payment-methods" className={`spc-checkout-payment-options fadeInUp ${isDisablePayment ? 'in-active' : ''} ${allPaymentMethodv2 ? 'payment-method-version-two' : ''}`}>
        <div className="spc-checkout-section-title fadeInUp payment-method-title checkout__sub-container-title">{placeholders?.paymentMethodsTitle}</div>
        {
          isLoading
            ? <Loader />
            : (
              <div className={`payment-methods ${isDisablePayment ? 'in-active' : ''}`}>
                {isLoggedIn && !isHideSectionInCheckout && selectedPaymentMethod && !isTopupFlag && <PaymentMethodEGiftCard ref={isFullPaymentEgift ? paymentRef : null} finalisePayment={finalisePayment} />}
                {methodsToRender?.map((method) => (
                  <PaymentMethod
                    key={method.code}
                    methodCode={method.code}
                    method={method}
                    onChangePaymentMethod={(methodCode) => onChangePaymentMethod(methodCode)}
                    isLoggedIn={isLoggedIn}
                    isDisabled={isDisablePayment}
                    paymentRef={paymentRef}
                    paymentLogoList={paymentLogoList}
                    isDisableSection={fullPaymentByEgift}
                  >
                    {renderMethodBody(method)}
                  </PaymentMethod>
                ))}
              </div>
            )
        }
      </div>
      {(isLoggedIn || shouldEnableCheckoutAuraV2) && !isHideSectionInCheckout && !isTopupFlag && !shouldEnableDeliveryAndBillingAddressV2 && <Loyalty content={loyalty} ref={fullPaymentUsingAura ? paymentRef : null} finalisePayment={finalisePayment} />}
      {(isLoggedIn || shouldEnableCheckoutAuraV2) && !isHideSectionInCheckout && !isTopupFlag && shouldEnableDeliveryAndBillingAddressV2 && !isCLMDowntime && <Loyalty content={loyalty} ref={fullPaymentUsingAura ? paymentRef : null} finalisePayment={finalisePayment} />}
      {!isHideSectionInCheckout && <RedeemEgiftCard redeemegifthead={redeemegifthead} redeemegifttitle={redeemegifttitle} redeemegiftsubtitle={redeemegiftsubtitle} ref={isFullRedeemEgift ? paymentRef : null} finalisePayment={finalisePayment} />}
    </>
  );
}
export default PaymentMethods;