import React, {
  useContext, useEffect, useState, useCallback,
} from 'react';
import CartContext from '../../../context/cart-context.jsx';
import Loader from '../../../shared/loader/loader.jsx';
import AppConstants from '../../../utils/app.constants.js';
import OrderConfirmation from './order-confirmation.jsx';
import getCustomerOrders from '../../../api/getCustomerOrders.js';
import Feedbackform from './feedbackform.jsx';
import { getConfigValue } from '../../../../scripts/configs.js';
import CartAndCheckoutLayout from '../../../shared/cart-and-checkout-layout/cart-and-checkout-layout.jsx';
import getGuestOrderDetails from '../../../api/getGuestOrderDetails.js';

/**
 * App Component.getGuestOrderDetails
 * @param {string} [content] block content from sharepoint docx
 * @param {string} [placeholders] locale based placeholders coming from placeholders.xlsx
 */

function App() {
  const { activeProgressStep , isLoggedIn, content } = useContext(CartContext);
  const [orderData, setOrderData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOrderId, setcurrentOrderId] = useState();
  const [showModal, setShowModal] = useState(false);
  const [formUrl, setFormUrl] = useState(null);
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [guestOrderToken , setGuestOrderToken] = useState(null);
  const [tokenvalidity , setTokenValidity] = useState(true);
  const [showErrorMessage, setshowErrorMessage] = useState(false)

  useEffect(() => {

    const fetchOrderData = async () => {
      setIsLoading(true);
      try {
        const currentUrl = new URL(window.location.href);
        let encodedStringParam = currentUrl.searchParams.get('oid');
        if (encodedStringParam) {
          encodedStringParam = encodedStringParam.replace(/}$/, '');
          const decodedString = atob(encodedStringParam);
          const jsonObject = JSON.parse(decodedString);
          const orderId = String(jsonObject.reserveOrderId);
          const bearerToken = String(jsonObject.token);
          setcurrentOrderId(orderId);
          setGuestOrderToken(bearerToken);
          let increment_id, grand_total, items;
          if (!isLoggedIn && bearerToken) {
            try {
              const getGuestOrder = await getGuestOrderDetails(bearerToken);
              if (getGuestOrder?.error){
                setTokenValidity(false);
                window.location.href = `/${document.documentElement.lang}`;
                return;
              }
              setOrderData(getGuestOrder?.data);
              ({ increment_id, base_grand_total:grand_total, items } = getGuestOrder?.data.items?.[0] || {});
            } catch (error) {
              console.error("Error generating guest order token:", error);
            }
          }
          else{
            const orderResponse = await getCustomerOrders(orderId);
            if(orderResponse?.errors || !orderResponse?.response?.data?.commerce_customer?.orders?.commerce_rest_details){
              setshowErrorMessage(true)
            }
            setOrderData(orderResponse?.response?.data?.commerce_customer?.orders?.commerce_rest_details);
            ({ increment_id, base_grand_total:grand_total, items } = orderResponse?.response?.data?.commerce_customer?.orders?.commerce_rest_details?.items?.[0] || {});
          }
          window.dispatchEvent(
            new CustomEvent('react:fireTargetCall', {
              detail: {
                type: 'orderConfirmation',
                payload: {
                  purchaseId: increment_id,
                  totalPrice: grand_total,
                  products: items,
                }

              },
            })
          );
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!currentOrderId && !showErrorMessage) {
      fetchOrderData();
    }
  }, [currentOrderId , tokenvalidity]);

  useEffect(() => {
    let timer;

    if (!isLoading) {
      timer = setTimeout(() => {
        if(!document.querySelector('.personalization-dialog')) {
          setShowModal(true);
        }
      }, 5000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  useEffect(() => {
    async function fetchfeedbackform() {
      try {
        const url = await getConfigValue('cart-feedback-form-url');
        setFormUrl(url);
      } catch (error) {
        console.error('Error:', error);
      }
    }
    fetchfeedbackform();
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  useEffect(() => {
    setShowProgressBar(!!currentOrderId);
  }, [currentOrderId])

  const render = () => {
    if (isLoading) return <Loader />;

    if (!currentOrderId || showErrorMessage) {
      return (<div className="pagenotrequested" dangerouslySetInnerHTML={{__html: content.errorPage ?? ''}}></div>);
    }

    return (
      <>
        <div className="cart__checkout__blocks">
          {activeProgressStep === AppConstants.PROGRESS_BAR_STEP_CONFIRMATION && <OrderConfirmation content={content} completeOrderData={orderData} />}
        </div>
        {
          formUrl && showModal && (
            <Feedbackform closeModal={closeModal} formUrl={formUrl} />
          )
        }
      </>
    )
  }

  return (
    <CartAndCheckoutLayout showProgressBar={showProgressBar} shouldDisableAllSteps={true}>
      {render()}
    </CartAndCheckoutLayout>
  );
}

export default App;
