import React, { useContext, useEffect, useState, useMemo } from 'react';
import './delivery-information.css';
import CheckoutMethodOption from '../checkout-method-option/checkout-method-option';
import CartContext from '../../../../context/cart-context';
import { formatPrice, isSameAddress } from '../../../../utils/base-utils';
import estimateShippingMethods from '../../../../api/estimateShippingMethods';
import Loader from '../../../../shared/loader/loader';
import { getConfigValue } from '../../../../../scripts/configs';
import DeliveryInformationHeader from './delivery-information-header';
import getSubCartGraphql from '../../../../api/getSubCartGraphql';
import ApiConstants from '../../../../api/api.constants';
import updateCart from '../../../../api/updateCart';
import Tamara from '../../../../utils/tamara-utils';
import TabbyUtils from '../../../../utils/tabby-utils';
import Icon from '../../../../library/icon/icon';
import removeRedemption from '../../../../api/removeRedemption';
import { STANDARD_DELIVERY_CODE } from '../../../cart/constants';

function DeliveryInformation({ deliveryMethodsList }) {
  const {
    cart, setCart, cartId, isLoggedIn, placeholders, deliveryInformation, setDeliveryInformation, setEditAddress, userAddressList,
    setDeliveryFeeLoader, lastOrderDetailsLoaded, setTamaraAvailable, setIsTabbyAvailable, setTabbyConfig, tabbyConfig, configs, isBNPLAllowed, isTelephoneInShipping, isInvalidAddress,
  } = useContext(CartContext);
  const [selectedMethod, setSelectedMethod] = useState();
  const [shippingMethods, setShippingMethods] = useState([]);
  const [currency, setCurrency] = useState('');
  const availableShippingMethods = deliveryInformation.shippingMethods;
  const shipping = useMemo(() => { return cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping }, [cart]);
  const shippingAddress = useMemo(() => { return shipping?.address; }, [shipping, cart]);
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';
  const [isAuraStartOrVip, setAuraTierInfo] = useState(false);

  const getFormattedPrice = async (amount, shippingCode) => {
    let price = placeholders.shippingMethodFreeLabel;
    if (isAuraStartOrVip && shippingCode === STANDARD_DELIVERY_CODE) {
      return price;
    }
    if (amount) {
      price = await formatPrice(currency, amount);
    }
    return price;
  };

  const getShippingIcon = (method) => {
    switch (method.method_code) {
      case 'armx_s01':
        return isAuraStartOrVip ? 'auraicon' : 'delivery';
      case 'qd2_qd002':
        return 'delivery-truck';
      default:
        return 'delivery';
    }
  }
  const dMList = deliveryMethodsList && Array.from(deliveryMethodsList)?.map((deliveryMethod) => (deliveryMethod.innerHTML));
  const dMListMap = dMList ? new Map(dMList.map((value, index) => [value, index])) : new Map();
  const sortDeliveryMethods = (method1, method2) => {
    const orderA = dMListMap.has(method1.method_code) ? dMListMap.get(method1.method_code) : Infinity;
    const orderB = dMListMap.has(method2.method_code) ? dMListMap.get(method2.method_code) : Infinity;
    return orderA - orderB;
  }

  useEffect(() => {
    const fetchShippingMethods = async () => {
      if (availableShippingMethods) {
        const methods = await Promise.all(
          availableShippingMethods
            .filter((method) => method.method_code !== 'click_and_collect')
            .sort(sortDeliveryMethods)
            .map(async (method, index) => ({
              id: index + 1,
              title: isAuraStartOrVip && method.method_code === STANDARD_DELIVERY_CODE ? placeholders.auraStandardDeliveryText : method.method_title,
              subTitle: method.carrier_title,
              value: `${method.carrier_code}_${method.method_code}`,
              subTitleRight: await getFormattedPrice(method.amount, method.method_code),
              info: method.error_message,
              methodCode: method.method_code,
              carrierCode: method.carrier_code,
              isDisabled: !method.available,
              shippingIcon: getShippingIcon(method)
            })),
        );
        setShippingMethods(methods);
      }
    };

    fetchShippingMethods();
  }, [availableShippingMethods]);

  useEffect(() => {
    const fetchCurrency = async () => {
      const configValue = await getConfigValue('currency');
      setCurrency(configValue);
    };
    fetchCurrency();
    const auraDetails = JSON.parse(localStorage.getItem('aura_common_data')) || {};
    const auraTierInfo = auraDetails.aura_Status === 'Tier2' || auraDetails.aura_Status === 'Tier3';
    const auraLinkInfo = auraDetails.aura_link === 2 || auraDetails.aura_link === 3;
    setAuraTierInfo(auraTierInfo && auraLinkInfo && isLoggedIn);
  }, []);

  const getShippingMethods = async () => {
    if (shippingAddress?.firstname) {

      const shippingBody = {
        address: {
          city: shippingAddress?.city,
          country_id: shippingAddress?.country_id,
          custom_attributes: shippingAddress?.custom_attributes,
          email: shippingAddress?.email,
          firstname: shippingAddress?.firstname,
          lastname: shippingAddress?.lastname,
          street: shippingAddress?.street,
          telephone: shippingAddress?.telephone
        }
      };

      if (!isSameAddress(deliveryInformation.payload, shippingBody)) {
        setDeliveryInformation(prev => ({ ...prev, isLoadingShippingMethods: true, payload: shippingBody }));
        const allShippingMethods = await estimateShippingMethods(shippingBody, cartId, isLoggedIn);
        setDeliveryInformation(prev => ({ ...prev, shippingMethods: (allShippingMethods ?? []), isLoadingShippingMethods: false }));
        window.dispatchEvent(new CustomEvent(
          'react:datalayerEvent',
          {
            detail: {
              type: 'add_shipping_info',
              payload: {
                value: cart?.data?.prices?.grand_total?.value || 0,
                currency: cart?.data?.prices?.grand_total?.currency || "",
                coupon: cart?.data?.extension_attributes?.totals?.coupon_code ?? '',
                discount: cart?.data?.prices?.discount?.amount?.value || 0,
                shippingTier: cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type,
                productData: cart?.data?.items?.map((item) => {
                  return {
                    item: item,
                  };
                }),
              },
            },
          }));
      }
      else if (isLoggedIn) {
        window.dispatchEvent(new CustomEvent(
          'react:datalayerEvent',
          {
            detail: {
              type: 'add_shipping_info',
              payload: {
                value: cart?.data?.prices?.grand_total?.value || 0,
                currency: cart?.data?.prices?.grand_total?.currency || "",
                coupon: cart?.data?.extension_attributes?.totals?.coupon_code ?? '',
                discount: cart?.data?.prices?.discount?.amount?.value || 0,
                shippingTier: cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type,
                productData: cart?.data?.items?.map((item) => {
                  return {
                    item: item,
                  };
                }),
              },
            },
          }));
      }

    }
  };

  useEffect(() => {
    if (shipping?.extension_attributes?.click_and_collect_type === 'home_delivery' && lastOrderDetailsLoaded) {
      getShippingMethods();
    }
  }, [shipping?.extension_attributes?.click_and_collect_type, lastOrderDetailsLoaded]);

  useEffect(() => {
    if (!shipping?.method && deliveryInformation?.shippingMethods && deliveryInformation.shippingMethods.length > 0 && shippingAddress?.firstname && lastOrderDetailsLoaded) {
      const selectedShipping = deliveryInformation?.shippingMethods?.find((item) => item?.available)
      const concatedShippingCode = `${selectedShipping?.carrier_code}_${selectedShipping?.method_code}`
      setSelectedMethod(concatedShippingCode)
      const payload = {
        shipping: {
          shipping_address: shippingAddress,
          shipping_carrier_code: selectedShipping?.carrier_code,
          shipping_method_code: selectedShipping?.method_code,
        },
        extension: {
          action: 'update shipping',
        },
      };
      const updateData = async () => {
        const updatedCartData = await updateCart(payload, cartId, isLoggedIn);
        setCart({
          ...cart,
          data: {
            ...cart?.data,
            prices: {
              ...cart?.data?.prices,
              grand_total: {
                ...cart?.data?.prices?.grand_total,
                value: updatedCartData?.totals?.base_grand_total,
              },
            },
            extension_attributes: {
              ...cart.data.extension_attributes,
              totals: updatedCartData?.totals,
              cart: {
                ...cart.data.extension_attributes.cart,
                extension_attributes: {
                  ...cart.data.extension_attributes.cart.extension_attributes,
                  shipping_assignments: updatedCartData?.cart?.extension_attributes?.shipping_assignments,
                  surcharge: updatedCartData?.cart?.extension_attributes?.surcharge,
                }
              }
            },
          },
        });
      }
      updateData();
    }
    else setSelectedMethod(shipping?.method);
  }, [shipping?.method, deliveryInformation?.shippingMethods, shippingAddress, lastOrderDetailsLoaded]);



  const getUpdatedPaymentMethods = async (updatedCartData) => {
    const availablePaymentMethods = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PAYMENTS_METHODS]);
    if (availablePaymentMethods) {
      setDeliveryFeeLoader(false);
      setCart({
        ...cart,
        data: {
          ...cart?.data,
          ...availablePaymentMethods,
          prices: {
            ...cart?.data?.prices,
            grand_total: {
              ...cart?.data?.prices?.grand_total,
              value: updatedCartData?.totals?.base_grand_total,
            },
          },
          extension_attributes: {
            ...cart.data.extension_attributes,
            totals: updatedCartData?.totals,
            cart: {
              ...cart.data.extension_attributes.cart,
              extension_attributes: {
                ...cart.data.extension_attributes.cart.extension_attributes,
                surcharge: updatedCartData?.cart?.extension_attributes?.surcharge,
                shipping_assignments: updatedCartData?.cart?.extension_attributes?.shipping_assignments,
              }
            }
          },
        },
      });
    }
  };

  const handleDeliveryMethodChange = async (event, method) => {
    setDeliveryFeeLoader(true);
    const selectedValue = event.target.value;
    setSelectedMethod(selectedValue);
    const clonedShippingAddress = { ...shippingAddress };
    delete clonedShippingAddress.extension_attributes;
    const payload = {
      shipping: {
        shipping_address: clonedShippingAddress,
        shipping_carrier_code: method.carrierCode,
        shipping_method_code: method.methodCode,
      },
      extension: {
        action: 'update shipping',
      },
    };
    const cartResponse = await updateCart(payload, cartId, isLoggedIn);
    getUpdatedPaymentMethods(cartResponse);
    await Tamara.isAvailable(cart, setTamaraAvailable, isLoggedIn);
    await TabbyUtils.refresh(cart, isLoggedIn, setIsTabbyAvailable, setTabbyConfig, tabbyConfig);

    if (isLoggedIn) {
      const removeData = await removeRedemption({
        redemptionRequest: {
          quote_id: cart?.data?.extension_attributes?.cart.id,
        },
      }, true);

      if (removeData) {
        const cartData = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__TOTALS]);
        if (cartData?.extension_attributes?.totals) {
          setCart((prevCart) => ({
            ...prevCart,
            data: {
              ...prevCart.data,
              extension_attributes: {
                ...prevCart.data.extension_attributes,
                totals: cartData.extension_attributes.totals
              }
            }
          }));
        }
      }
    }
    if (isBNPLAllowed) {
      await Tamara.isAvailable(cart, setTamaraAvailable, isLoggedIn);
      await TabbyUtils.refresh(cart, isLoggedIn, setIsTabbyAvailable, setTabbyConfig, tabbyConfig);
    }
  };

  const renderShippingMethods = () => {
    const filteredShippingMethods = shippingMethods?.filter((method) => !method.isHidden) ?? [];
    return filteredShippingMethods.map((method, index) => (
      <React.Fragment key={`shipping-method-${method.id}`}>
        <CheckoutMethodOption
          className="checkout__shipping-method-option"
          name="shipping-method"
          selectedMethod={selectedMethod}
          isAuraStartOrVip={isAuraStartOrVip}
          handleDeliveryMethodChange={(event) => handleDeliveryMethodChange(event, method)}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...method}
        />
        {index < filteredShippingMethods.length - 1 && <div className="divider" />}
      </React.Fragment>
    ));
  };

  const handleChangeClick = (address) => {
    setEditAddress(address);
    setDeliveryInformation({
      ...deliveryInformation, isDialogOpen: true, isModalVisible: true, changeAddress: 'shipping',
    });
  };

  const defaultDeliveryUIRender = () => {
    if (shipping?.extension_attributes?.click_and_collect_type === 'home_delivery' && availableShippingMethods?.length && !shouldEnableDeliveryAndBillingAddressV2) {
      return (
        <div className="checkout__delivery-information__wrapper">
          {
            shippingAddress?.firstname
              ? (
                <>
                  <DeliveryInformationHeader
                    shippingAddress={shippingAddress}
                    placeholders={placeholders}
                    handleChangeClick={() => handleChangeClick(shippingAddress)}
                    isInfoSection={true}
                  />
                  {!isInvalidAddress && <div className='checkout__delivery-information_error'>{placeholders.addressGenericErrorMsg}</div>}
                </>
              )
              : null
          }
          {
            deliveryInformation.isLoadingShippingMethods
              ? <Loader />
              : availableShippingMethods?.length > 0 && (
                <>
                  <div className="divider" />
                  {renderShippingMethods()}

                </>
              )
          }
        </div>
      );
    } else if (shipping?.extension_attributes?.click_and_collect_type !== 'ship_to_store' && shouldEnableDeliveryAndBillingAddressV2) {
      return (
        <div className="checkout__delivery-information__wrapper">
          <div className='delivery-option-title'>
            {placeholders.deliveryOptionTitle}
          </div>
          {!availableShippingMethods?.length ? (
            <div className='delivery-info-empty'>
              <Icon name={'info'} className="icon-wrapper" />
              <span>{placeholders.deliveryInfoEmptyMessage}</span>
            </div>
          ) : null}
          {
            deliveryInformation.isLoadingShippingMethods
              ? <Loader />
              : availableShippingMethods?.length > 0 && (
                <>
                  {renderShippingMethods()}
                </>
              )
          }
        </div>
      )
    }
    return null;
  };
  return (
    !deliveryInformation?.isLoadingShippingMethods && (!isLoggedIn || lastOrderDetailsLoaded)
      ? (defaultDeliveryUIRender()) : (<Loader />)
  );
}

export default DeliveryInformation;