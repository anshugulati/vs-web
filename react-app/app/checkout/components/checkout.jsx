import React, {
  useRef, useEffect, useContext, useState, useMemo
} from 'react';
import CheckoutDeliveryMethod from './checkout-delivery-method.jsx';
import './checkout.css';
import DeliveryInformation from './delivery-information/delivery-information.jsx';
import OrderSummary from './order-summary/order-summary.jsx';
import PaymentMethods from './payment-methods/payment-methods.jsx';
import BillingInformation from './billing-information/billing-information.jsx';
import CompletePurchase from './complete-purchase/complete-purchase-btn.jsx';
import CollectionSection from './collection-store/components/collection-section.jsx';
import CartContext from '../../../context/cart-context.jsx';
import CheckoutModal from './checkout-modal/index.jsx';
import getCityLocations from '../../../api/getCity.js';
import { getConfigValue } from '../../../../scripts/configs.js';
import { CheckoutComUpiContextProvider } from '../../../context/checkoutcomupi-context.jsx';
import SubTotalSummary from './order-summary/subtotal-summary.jsx';
import CheckoutHomeDeliveryModal from './checkout-home-delivery-modal.jsx';
import { getCountryIso } from '../../../../scripts/helpers/country-list.js';

function Checkout({ content }) {
  const {
    cart, setIsCollectionDetails, isCollectionDetails, isHideSectionInCheckout, selectedMethod, setSelectedMethod, isLoggedIn, isTopupFlag, setAreaItems, configs, methods, placeholders, lastOrderDetails, setIsTelephoneInShipping, setIsInvalidAddress, areaItems
  } = useContext(CartContext);
  const [showForm, setShowForm] = useState(false);
  const [configData, setConfigData] = useState(null);
  const paymentRef = useRef();
  const { redeemegifthead, redeemegifttitle, redeemegiftsubtitle } = content;
  const isPaymentMethodSelected = methods?.filter((method) => method.isSelected)?.length > 0;
  const isShippingAddressAvailable = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type === 'home_delivery';
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';
  const showBillingAddress = !shouldEnableDeliveryAndBillingAddressV2 || ((shouldEnableDeliveryAndBillingAddressV2 && ((selectedMethod === 'home_delivery' && isShippingAddressAvailable) || (selectedMethod === 'click_and_collect' && isCollectionDetails))) && isPaymentMethodSelected);
  const shipping = useMemo(() => { return cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping }, [cart]);
  const shippingAddress = useMemo(() => { return shipping?.address; }, [shipping, cart]);
  const isAllEgift = cart?.data?.extension_attributes?.cart?.items?.every(it => it.extension_attributes.is_egift === '1');

  useEffect(() => {
    let flag = false;

    if (isTopupFlag || isAllEgift) {
      flag = true;
    } else if (shippingAddress?.telephone) {
      const formattedTelephone = shippingAddress.telephone.replace(configData?.prefix, '').replace(/\s/g, "");
      if(formattedTelephone) {
        flag = true
      }
    }
    const areaCode = shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'area')?.value;
    const areaObj = areaCode && areaItems?.find(item => (''+item.location_id === ''+areaCode && item.status));

    const regionCode = shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'address_region_segment')?.value;
    const regionObj = regionCode && areaItems?.find(item => (''+item.location_id === ''+regionCode && item.status));

    if (areaCode && !areaObj) {
      flag = false;
    }
    if (regionCode && !regionObj) {
      flag = false;
    }
    setIsInvalidAddress(flag);
  }, [shippingAddress, isTopupFlag, isAllEgift, configData, areaItems]);

  useEffect(() => {
    if (cart?.data) {
      const shippingAssign = cart.data.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.find((assign) => assign.shipping.method === 'click_and_collect_click_and_collect');
      if (shippingAssign) {
        setIsCollectionDetails(true);
        setSelectedMethod('click_and_collect');
      } else {
        setIsCollectionDetails(false);
        setSelectedMethod('home_delivery');
      }
    }
  }, [cart]);

  useEffect(() => {
    let paymentErrorMessage = sessionStorage.getItem('payment-error');
    if (paymentErrorMessage) {
      paymentErrorMessage = paymentErrorMessage.split('+').join(' ');
      window.dispatchEvent(
        new CustomEvent('react:showPageErrorMessage', {
          detail: { message: paymentErrorMessage },
        }),
      );
      sessionStorage.removeItem('payment-error');
    }
  }, []);

  useEffect(() => {
    const fetchCountryCode = async () => {
      try {
        const code = await getConfigValue('country-code');
        let areadField = await getConfigValue('cart-address-area-field');
        if(!areadField) areadField = 'area';
        const response = await getCityLocations(code, areadField);
        const areaItemsResp = response?.response?.items;
        setAreaItems(areaItemsResp)
        const prefix = `+${await getCountryIso(code)}`;
        setConfigData({prefix});
      } catch (error) {
        console.error("Failed to fetch country code:", error);
      }
    };
    fetchCountryCode();
  }, []);

  useEffect(() => {
    let flag = false;
    const isResponsive = window.innerWidth <= 768;

    if((!isLoggedIn || !lastOrderDetails) && isResponsive && selectedMethod === 'home_delivery' && !isShippingAddressAvailable) {
      flag = true;
    }
    setShowForm(flag);
  }, [isLoggedIn, selectedMethod, lastOrderDetails, isShippingAddressAvailable]);

  return (
    <div>
      <div className="checkout__shopping-block">
        <div className="checkout__container">
          {!isHideSectionInCheckout && !isTopupFlag && <CheckoutDeliveryMethod hideHomeDelivery={showForm} onSelectedMethodChange={setSelectedMethod} />}
          {showForm && <div className='checkout-page-address-form'><CheckoutHomeDeliveryModal isVisible={true} onClose={() => {}} hideBackArrow={true} /></div>}
          {!isHideSectionInCheckout && !isTopupFlag && (selectedMethod === 'home_delivery' ? <DeliveryInformation deliveryMethodsList={content.deliveryMethodsList} /> : null)}
          {!isHideSectionInCheckout && !isTopupFlag && (selectedMethod === 'click_and_collect' && isCollectionDetails ? <CollectionSection /> : null)}
          <CheckoutComUpiContextProvider><PaymentMethods paymentMethods={content.paymentMethods} paymentRef={paymentRef} paymentLogoList={content.paymentlogolist} blockContent={content} /></CheckoutComUpiContextProvider>
          {showBillingAddress && <BillingInformation selectedMethod={selectedMethod} />}
        </div>
        <div className={`order-summary-container slide-up-animation ${shouldEnableDeliveryAndBillingAddressV2 ? 'order-summary-border' : ''}`}>
          {shouldEnableDeliveryAndBillingAddressV2 ? (
            <>
            <div className='sub-total-summary-wrapper-with-button'>
              <SubTotalSummary />
              <CompletePurchase purchasePolicyText={content.purchasePolicyText} paymentRef={paymentRef} />
              </div>
              <OrderSummary isAddress isCOD={selectedMethod === 'home_delivery'} content={content} />
            </>
          ) : (
            <OrderSummary isAddress isCOD={selectedMethod === 'home_delivery'} content={content} />
          )}
        </div>
        <CheckoutModal selectedMethod={selectedMethod} />
      </div>
      {!shouldEnableDeliveryAndBillingAddressV2 && (
        <CompletePurchase purchasePolicyText={content.purchasePolicyText} paymentRef={paymentRef} />
      )}
    </div>
  );
}

export default Checkout;