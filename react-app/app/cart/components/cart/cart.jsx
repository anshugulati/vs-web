import React, { useContext, useEffect, useState } from 'react';
import ItemShoppingList from '../item-shopping-list.jsx';
import CartContext from '../../../../context/cart-context.jsx';
import CartSummary from './cart-summary.jsx';
import ShowErrorToast from '../show-error-toast.jsx';
import { hasValue } from '../../../../utils/base-utils.js';
import { getAPCCustomerData } from '../../../../../scripts/hellomember/api.js';
import { setLoyaltyCard } from '../../../../api/auraDetails.js';
import ApiConstants from '../../../../api/api.constants.js';
import AppConstants from '../../../../utils/app.constants.js';
import Loader from '../../../../shared/loader/loader.jsx';

function Cart({ content }) {
  const { cart, cartShowFreeReturns, toastErrorMessage, isLoggedIn, cartId, setCart, isMobile, showDeliveryEligibility , configs } = useContext(CartContext);
  const { cardmethodtitle, paymentlogolist, deliverymethods, } = content;
  const totalQuantity = cart?.data?.total_quantity ?? 0;
  const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
  const grandTotal = cart?.data?.prices?.grand_total?.value ?? 0;
  const updatedTitle = content.carttitle?.replace('{{COUNT}}', totalQuantity);
  const updateTitleforMobile = content.mobilecarttitle?.replace('{{COUNT}}', totalQuantity).replace('{{CURRENCY}}', grandTotalCurrency).replace('{{PRICE}}', grandTotal.toFixed(2));
  const items = cart?.data?.items;
  const carouselContainerEl = document.querySelector('.section.carousel-container:not(.cart-section)');
  const [isMobileTitleFixed, setIsMobileTitleFixed] = useState(false);
  const [showPageLoader, setshowPageLoader] = useState(false);
  const shouldShowCartTitleV2 = configs?.['should-show-cart-title-v2'] === 'true';

  const showCarousel = () => {
    if (carouselContainerEl) {
      carouselContainerEl.classList.remove('hidden');
    }
  };

  const hideCarousel = () => {
    if (carouselContainerEl) {
      carouselContainerEl.classList.add('hidden');
    }
  };

  useEffect(() => {
    hideCarousel();
    const fetchData = async () => {
      try {
        const { loyalty_type } = cart?.data?.extension_attributes?.cart?.extension_attributes || {};
        let identifierNo = '';
        if (loyalty_type === AppConstants.LOYALTY_AURA) {
          const response = await getAPCCustomerData();
          if (hasValue(response) && !hasValue(response.error)) {
            identifierNo = response?.apc_identifier_number;
          } else if (hasValue(response?.error)) {
            console.error('Error while trying to get hello member customer data. Data: @data.', {
              '@data': JSON.stringify(response),
            });
          }

          if (identifierNo) {
            setshowPageLoader(true)
            await setLoyaltyCard(identifierNo, isLoggedIn, cartId, ApiConstants.API_URI_SET_LOYALTY_AURA, AppConstants.LOYALTY_HM_TYPE);
            window.dispatchEvent(new CustomEvent('updateMiniCart'));
            setTimeout(()=>{
              setshowPageLoader(false)
            }, 3000)
          }
        }

      } catch (error) {
        console.error('An error occurred while fetching loyalty options:', error);
      }
    };

    window.addEventListener('updateMiniCartResult', ({ detail })=> {
      setshowPageLoader(false)
      if(detail?.totals){
        setCart((prevCart) => ({
          ...prevCart,
          data: {
              ...prevCart.data,
              extension_attributes: {
                  ...prevCart.data.extension_attributes,
                  totals: detail?.totals
              },
          }
        }));
      }
    })
    fetchData();
  }, []);

  useEffect(() => {
    if (items?.length) {
      showCarousel();
    } else {
      hideCarousel();
    }

    return () => {
      showCarousel();
    };
  }, [items]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 100; // You can adjust this value based on where you want it to become fixed
      if (window.scrollY > scrollThreshold) {
        setIsMobileTitleFixed(true);
      } else {
        setIsMobileTitleFixed(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
    {shouldShowCartTitleV2 && <div className="cart-title">
      {updatedTitle && (
      <span dangerouslySetInnerHTML={{ __html: updatedTitle }} />
      )}
    </div>}
    <div className="cart__shopping-block">
      {showPageLoader && (
        <div className="loader_overlay">
          <Loader />
        </div>
      )}
      <div className="cart__shopping-list slide-up-animation">
        <div className="cart-body-title-section">
          <div className={`cart-title-mobile ${isMobileTitleFixed ? 'fixed' : ''}`}>
            {content.mobilecarttitle && (
            <span dangerouslySetInnerHTML={{ __html: updateTitleforMobile }} />
            )}
          </div>
          {!shouldShowCartTitleV2 && <div className="cart-title">
            {updatedTitle && (
            <span dangerouslySetInnerHTML={{ __html: updatedTitle }} />
            )}
          </div>}
          {content.freereturnlable && cartShowFreeReturns && (
          <div className="online-returns-cart-banner">
            <div dangerouslySetInnerHTML={{ __html: content.freereturnlable }} />
          </div>
          )}
          { toastErrorMessage? <ShowErrorToast/>:null}
          <ItemShoppingList />
        </div>
      </div>

      <CartSummary
        deliveryMethods={deliverymethods}
        cardMethodTitle={cardmethodtitle}
        paymentLogoList={paymentlogolist}
        showDeliveryEligibility={showDeliveryEligibility}
        isMobile={isMobile}
      />

    </div>
    </>
  );
}

export default Cart;
