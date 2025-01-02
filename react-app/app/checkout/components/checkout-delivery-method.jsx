import React, { useContext, useEffect, useState, useMemo } from 'react';
import CartContext from '../../../context/cart-context.jsx';
import { getConfigValue } from '../../../../scripts/configs.js';
import CheckoutMethodOption from './checkout-method-option/checkout-method-option.jsx';
import Icon from '../../../library/icon/icon.jsx';
import useCurrencyFormatter from '../../../utils/hooks/useCurrencyFormatter.jsx';
import DeliveryInformationHeader from './delivery-information/delivery-information-header.jsx';
import AddressForm from './address-form.jsx';
import CollectionDetailsForm from './collection-store/collection-details-form.jsx';

function CheckoutDeliveryMethod({ onSelectedMethodChange }) {
  const {
    placeholders, cart, isLoggedIn, deliveryInformation, setDeliveryInformation, setUserAddressList, isCollectionDetails, selectedMethod, setSelectedMethod, lastOrderDetailsLoaded, cncCollectionPointsEnabled, setEditAddress, configs, shouldEnableProductCardV2
  } = useContext(CartContext);
  const [hideClickAndCollect, setHideClickAndCollect] = useState(false);
  const [isGlobalClickCollectDisabled, setIsGlobalClickCollectDisabled] = useState(false);
  const [thresholdText, setThresholdText] = useState('');
  const shipping = useMemo(() => { return cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping }, [cart]);
  const shippingAddress = useMemo(() => { return shipping?.address; }, [shipping, cart]);
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

  const {
    deliveryMethodTitle = '',
    homeDelivery = '',
    clickCollect = '',
    homeDeliveryTitle = '',
    clickCollectTitle = '',
    // clickCollectDisabled = '',
    deliveryInformationTitle = '',
    deliveryInformationBtnText = '',
    collectionStoreTitle = '',
    collectionPointTitle = '',
    collectionStoreBtnText = '',
    collectionPointBtnText = '',
    clickCollectThresholdText = '',
    clickCollectNotAvailableText = '',
  } = placeholders;

  const items = cart?.data?.items;
  const isMultiBrandCart = cart?.data?.extension_attributes?.cart?.extension_attributes?.is_multi_brand_cart ?? false;
  const isThresholdReached = cart?.data?.extension_attributes?.cart?.extension_attributes?.cnc_min_value;

  const isShippingAddressAvailable = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type === 'home_delivery';

  const fetchGlobalConfig = async () => {
    const isDisabled = await getConfigValue('global-click-collect-disabled');
    const thresholdValue = await getConfigValue('cnc-threshold-value');
    setThresholdText(thresholdValue);
    setIsGlobalClickCollectDisabled(isDisabled === 'true');
  };

  const determineHideClickAndCollect = () => {
    if (items && !isGlobalClickCollectDisabled) {
      if (shouldEnableProductCardV2) {
        const shouldHide = items.some((item) => item?.product?.reserve_and_collect === 2 && item?.product?.ship_to_store === 2);
        setHideClickAndCollect(shouldHide);
      } else {
        const shouldHide = items.some((item) => item?.configured_variant?.reserve_and_collect === 2 && item?.configured_variant?.ship_to_store === 2);
        setHideClickAndCollect(shouldHide);
      }
    }
  };

  useEffect(() => {
    fetchGlobalConfig();
    determineHideClickAndCollect();
  }, [items]);

  useEffect(() => {
    const onGetCustomerData = (event) => {
      const customer = event?.detail?.response;
      if (customer?.addresses) {
        setUserAddressList(customer.addresses);
      }
    };
    window.addEventListener('react:getCustomerResult', onGetCustomerData);
    if (isLoggedIn) {
      window.dispatchEvent(new CustomEvent('react:getCustomer'));
    }
  }, [isLoggedIn]);

  const handleDeliveryMethodChange = (event) => {
    const selectedValue = event.target.value;
    setSelectedMethod(selectedValue);
    onSelectedMethodChange(selectedValue);
    window.dispatchEvent(new CustomEvent(
        'react:datalayerEvent',
        {
          detail: {
            type: 'deliveryOption',
            payload: {
              deliverySelected: selectedValue === 'home_delivery' ? 'Home Delivery' : 'Click & Collect',
            },
          },
        },
    ));
  };

  const handleButtonClick = () => {
    if (selectedMethod === 'home_delivery') setDeliveryInformation({ ...deliveryInformation, isDialogOpen: true, isModalVisible: true, changeAddress: 'shipping' });
    else {
      // Add your collection store logic here
      setDeliveryInformation({ ...deliveryInformation, isDialogOpen: true, changeAddress: 'mapAddress' });
    }
  };

  const isClickAndCollectDisabled = isGlobalClickCollectDisabled || hideClickAndCollect || isMultiBrandCart || (isThresholdReached !== null && !isThresholdReached);
  const formattedThresholdValue = useCurrencyFormatter({ price: thresholdText ? thresholdText : 0, priceDecimals: 0 })

  let clickNcollectTitle = '';
  if (isGlobalClickCollectDisabled || hideClickAndCollect || isMultiBrandCart) {
    clickNcollectTitle = clickCollectNotAvailableText;
  } else if (isThresholdReached !== null && !isThresholdReached) {
    clickNcollectTitle = clickCollectThresholdText?.replace('{{TOTAL_AMOUNT}}', formattedThresholdValue);
  } else {
    clickNcollectTitle = clickCollectTitle;
  }

  const deliveryMethods = [
    {
      id: 1,
      subTitle: homeDelivery,
      title: homeDeliveryTitle,
      iconHM: 'home-delivery',
      iconBBW: 'delivery-truck',
      value: 'home_delivery',
    },
    {
      id: 2,
      subTitle: clickCollect,
      title: clickNcollectTitle,
      iconHM: 'click-collect',
      iconBBW: 'delivery-click-collect',
      value: 'click_and_collect',
      isDisabled: isClickAndCollectDisabled,
    },
  ];

  const renderTitle = () => {
    if (selectedMethod === 'home_delivery') return deliveryInformationTitle;
    else if (cncCollectionPointsEnabled) return collectionPointTitle;
    else return collectionStoreTitle;
  }

  const handleChangeClick = (address) => {
    setEditAddress(address);
    setDeliveryInformation({
      ...deliveryInformation, isDialogOpen: true, isModalVisible: true, changeAddress: 'shipping',
    });
  };

  return (
      <>
        <div className="checkout__delivery-methods-container">
          <div className="checkout-title checkout__sub-container-title">
            {deliveryMethodTitle}
          </div>
          <div className="checkout__delivery-methods-wrapper">
            {deliveryMethods.map((method) => (
                // eslint-disable-next-line react/jsx-props-no-spreading
                <CheckoutMethodOption key={method.id} name="delivery-method" selectedMethod={selectedMethod} handleDeliveryMethodChange={handleDeliveryMethodChange} {...method} />
            ))}
          </div>
        </div>
        <div className={`checkout__delivery-information ${shouldEnableDeliveryAndBillingAddressV2 ? 'checkout__delivery-information-v2' : ''} `}>
          <div className={`checkout__delivery_information_title checkout__sub-container-title ${selectedMethod !== 'home_delivery' ? 'bbw-c-c-title': ''}`}>
            {renderTitle()}
          </div>
          {selectedMethod === 'home_delivery' && !isShippingAddressAvailable && lastOrderDetailsLoaded && (
              <>
                {shouldEnableDeliveryAndBillingAddressV2 ? (
                    <AddressForm />
                ) : (
                    <button
                        type="button"
                        className="checkout__delivery-information-btn"
                        onClick={handleButtonClick}
                    >
                      <div>
                        {deliveryInformationBtnText}
                        <Icon name="arrow-right" className="checkout-btn-arrow" />
                      </div>
                    </button>
                )}
              </>
          )}
          {selectedMethod === 'home_delivery' && isShippingAddressAvailable && shouldEnableDeliveryAndBillingAddressV2 && (
              <DeliveryInformationHeader
                  shippingAddress={shippingAddress}
                  placeholders={placeholders}
                  handleChangeClick={() => handleChangeClick(shippingAddress)}
              />
          )}
          {selectedMethod !== 'home_delivery' && !isCollectionDetails && lastOrderDetailsLoaded &&
              shouldEnableDeliveryAndBillingAddressV2 && (
                  <div className="bbw-delivery-checkout">
                    <div className="checkout__delivery_information_title checkout__sub-container-title">
                      {renderTitle()}
                    </div>
                    <span className='click-collect-bbw'><Icon name='info-black' className='black-icon-info'/>{placeholders.clickCollectInfo}</span>
                    <button type="button" className="checkout__delivery-information-btn" onClick={handleButtonClick}>
                      {cncCollectionPointsEnabled ? collectionPointBtnText : collectionStoreBtnText}
                    </button>
                  </div>)
          }
          {selectedMethod !== 'home_delivery' && !isCollectionDetails && lastOrderDetailsLoaded && (
              <button type="button" className="checkout__delivery-information-btn" onClick={handleButtonClick}>
                <div>
                  {cncCollectionPointsEnabled ? collectionPointBtnText : collectionStoreBtnText}
                  <Icon name="arrow-right" className="checkout-btn-arrow" />
                </div>
              </button>
          )}
        </div>

        {selectedMethod !== 'home_delivery' && !isCollectionDetails && lastOrderDetailsLoaded &&
            shouldEnableDeliveryAndBillingAddressV2 && (

                <div className='checkout__delivery-information checkout__delivery-information-v2'>
                  <div className='form-contact-info-title'>{placeholders.mapContactInfo}</div>
                  <CollectionDetailsForm />
                </div>)}
      </>
  );
}

export default CheckoutDeliveryMethod;