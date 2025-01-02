import React, { useContext, useState, useEffect } from 'react';
import AppConstants from '../../../utils/app.constants.js';
import estimateShippingMethods from '../../../api/estimateShippingMethods.js';
import updateCart from '../../../api/updateCart.js';
import getSubCartGraphql from '../../../api/getSubCartGraphql.js';
import ApiConstants from '../../../api/api.constants.js';
import { getTopupEgiftCardId } from '../../../utils/base-utils.js';
import Tamara from '../../../utils/tamara-utils.js';
import TabbyUtils from '../../../utils/tabby-utils.js';
import CartContext from '../../../context/cart-context.jsx';
import { getConfigValue } from '../../../../scripts/configs.js';
import Loader from '../../../shared/loader/loader.jsx';

function AddressForm({ onClose, isBilling = false }) {
    const { configs, cart, setCart, cartId, deliveryInformation, setDeliveryInformation, selectedMethod, isTopupFlag, editAddress, setTamaraAvailable, setIsTabbyAvailable, setTabbyConfig, tabbyConfig, isShippingAddressAvailable, lastOrderDetailsLoaded, isLoggedIn, setUserAddressList, areaItems } = useContext(CartContext);

    const [loading, setLoading] = useState(true);
    const [countryCode, setCountryCode] = useState(null);

    const createAddressPayload = (arg1) => {
        const isAddrAttribute = arg1?.address?.custom_attributes?.find(
            (attribute) => attribute.attribute_code === 'address'
        );

        let customAttributes = arg1?.address?.custom_attributes || [];

        if (!isAddrAttribute) {
            customAttributes = [...arg1?.address?.custom_attributes, {
                attribute_code: 'address',
                name: 'address',
                value: arg1?.address?.address
            }];
        }

        // passing governate value in case of Kuwait market
        const areaAttribute = customAttributes.find(attr => attr.attribute_code === 'area');
        if (countryCode === AppConstants.KUWAIT_MARKET) {
            const mappedLocations = areaItems
                ?.filter(item => areaAttribute && item.location_id === Number(areaAttribute.value))
                ?.map(item => item.parent_id);

            if (mappedLocations?.length > 0) {
                const governateValue = mappedLocations[0];
                const governateAttributeIndex = customAttributes.findIndex(attr => attr.attribute_code === 'governate');

                if (governateAttributeIndex > -1) {
                    customAttributes[governateAttributeIndex].value = governateValue;
                } else {
                    customAttributes.push({
                        attribute_code: AppConstants.GOVERNATE_ATTRIBUTE,
                        name: AppConstants.GOVERNATE_ATTRIBUTE,
                        value: governateValue
                    });
                }
            }
        }

        const { country_code, id, customer_id, street, ...addressWithoutCountryCode } = arg1.address;


        // area should be set as city for Kuwait as city is a mandatory api field
        if (!addressWithoutCountryCode.city) {
            addressWithoutCountryCode.city = arg1?.address?.custom_attributes?.find(
                (attribute) => attribute.attribute_code === 'area'
            )?.value ?? '';
        }
        const addressPayload = {
            address: {
                ...addressWithoutCountryCode,
                country_id: country_code || addressWithoutCountryCode.country_id,
                street: Array.isArray(street) ? street : [street],
                custom_attributes: customAttributes
            }
        };

        return addressPayload;
    };

    const invokeUpdateShippingAddress = async (arg1) => {
        const addressPayload = createAddressPayload(arg1);
        setDeliveryInformation(prev => ({ ...prev, isLoadingShippingMethods: true, payload: addressPayload }));
        const availableShippingMethods = await estimateShippingMethods(addressPayload, cartId, isLoggedIn);
        setDeliveryInformation(prev => ({ ...prev, shippingMethods: (availableShippingMethods ?? []), isLoadingShippingMethods: false }));
        const firstShippingMethod = availableShippingMethods?.find((method) => method.available) ?? null;

        if (!availableShippingMethods?.length) {
            window.dispatchEvent(
                new CustomEvent('react:showPageErrorMessage', {
                    detail: { message: placeholders?.shippingMethodsNotAvailable },
                }),
            );
            window.dispatchEvent(
                new CustomEvent('react:dataLayerCartErrorsEvent', {
                    detail: {
                        eventLabel: 'shippingMethodsNotAvailable',
                        eventAction: placeholders?.shippingMethodsNotAvailable,
                        eventPlace: `Error occured on ${window.location.href}`,
                    },
                }),
            );
            const errorNotification = document.querySelector(
                '.page-error-message.visible',
            );
            errorNotification.scrollIntoView({ behavior: 'smooth' });
            if (onClose) onClose();

            return;
        }

        const shipData = await invokeUpdateCart(firstShippingMethod, addressPayload, 'shipping');
        if (shipData === 'error') return;

        if (isBilling || shipData === 'setbilling') {
            await invokeUpdateCart(null, addressPayload, 'billing');
        }

        if (onClose) onClose();
    };

    const invokeUpdateCart = async (firstShippingMethod, addressPayload, addressType) => {
        const createAddressBody = (type, action, additionalFields = {}) => ({
            [type]: {
                ...(type !== 'shipping' && addressPayload.address),
                ...additionalFields,
            },
            extension: {
                action,
            },
        });
        let customerCartId, customerLoggedIn;
        let addressBody;
        if (addressType === 'billing') {
            addressBody = createAddressBody('billing', 'update billing');
            customerCartId = getTopupEgiftCardId() ?? cartId
            customerLoggedIn = getTopupEgiftCardId() ? false : isLoggedIn
        } else {
            addressBody = createAddressBody('shipping', 'update shipping', {
                ...(firstShippingMethod && {
                    shipping_carrier_code: firstShippingMethod.carrier_code,
                    shipping_method_code: firstShippingMethod.method_code,
                }),
                shipping_address: {
                    ...addressPayload.address,
                },
            });
            customerCartId = cartId
            customerLoggedIn = isLoggedIn
        }
        const response = await updateCart(addressBody, customerCartId, customerLoggedIn);

        if (response?.response_message?.[1] === 'success') {
            const shipping = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping;
            const shippingAddress = shipping?.address;
            if (addressType === 'shipping') {
                window.dispatchEvent(new CustomEvent(
                    'react:datalayerEvent',
                    {
                        detail: {
                            type: 'saveAddressOnCheckoutPage',
                            payload: {
                                category: shippingAddress?.firstname ? 'update' : 'add',
                                isValid: response?.response_message?.[1] === 'success' ? 1 : 0,
                                addressType: isBilling ? 'billing information' : 'delivery information'
                            },
                        },
                    },
                ));
                window.dispatchEvent(new CustomEvent(
                    'react:datalayerEvent',
                    {
                        detail: {
                            type: 'add_shipping_info',
                            payload: {
                                value: response?.totals?.base_grand_total || 0,
                                currency: response?.totals?.base_currency_code || "",
                                coupon: cart?.data?.extension_attributes?.totals?.coupon_code ?? '',
                                discount: cart?.data?.prices?.discount?.amount?.value || 0,
                                shippingTier: response?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.click_and_collect_type,
                                productData: cart?.data?.items?.filter((element) =>
                                    response?.cart?.items?.find((responseItem) => element?.extensionAttributes?.sku === responseItem?.sku)
                                ).map((item) => {
                                    return {
                                        item: item,
                                    };
                                }),
                            },
                        },
                    },
                ));
            }

            if (addressType !== 'billing') {
                const result = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PAYMENTS_METHODS, ApiConstants.CART_QUERY__MOBILE_NUMBER_VERIFIED]);
                if (result) {
                    setCart((prevCart) => ({
                        ...prevCart,
                        data: {
                            ...prevCart.data,
                            available_payment_methods: result.available_payment_methods,
                            prices: {
                                ...cart?.data?.prices,
                                grand_total: {
                                    ...cart?.data?.prices?.grand_total,
                                    value: response?.totals?.base_grand_total,
                                },
                            },
                            extension_attributes: {
                                ...prevCart.data.extension_attributes,
                                totals: response?.totals,
                                cart: {
                                    ...prevCart.data.extension_attributes.cart,
                                    extension_attributes: {
                                        ...prevCart.data.extension_attributes.cart.extension_attributes,
                                        mobile_number_verified: result?.extension_attributes?.cart?.extension_attributes?.mobile_number_verified,
                                        shipping_assignments: response.cart?.extension_attributes?.shipping_assignments,
                                    },
                                },
                            },
                        },
                    }));
                }

                if (!response.cart.billing_address.firstname) {
                    return 'setbilling';
                }
            } else {
                setCart((prevCart) => ({
                    ...prevCart,
                    data: {
                        ...prevCart.data,
                        prices: {
                            ...cart?.data?.prices,
                            grand_total: {
                                ...cart?.data?.prices?.grand_total,
                                value: response?.totals?.base_grand_total,
                            },
                        },
                        extension_attributes: {
                            ...prevCart.data.extension_attributes,
                            totals: response?.totals,
                            cart: {
                                ...prevCart.data.extension_attributes.cart,
                                billing_address: response.cart?.billing_address,
                                extension_attributes: {
                                    ...prevCart.data.extension_attributes.cart.extension_attributes,
                                    shipping_assignments: response.cart?.extension_attributes?.shipping_assignments,
                                },
                            },
                        },
                    },
                }));
            }
            await Tamara.isAvailable(cart, setTamaraAvailable, isLoggedIn);
            await TabbyUtils.refresh(cart, isLoggedIn, setIsTabbyAvailable, setTabbyConfig, tabbyConfig);
        } else if (
            response?.response_message?.[1] !== 'success' && response?.response_message?.[0]?.includes('out of stock')
        ) {
            setDeliveryInformation(prev => ({ ...prev, isModalVisible: false }));
            setCheckoutOOSDisable(true);
            window.dispatchEvent(new CustomEvent(
                'react:datalayerEvent',
                {
                    detail: {
                        type: 'checkoutErrors',
                        payload: {
                            action: placeholders?.outOfStockToast,
                            label: 'Cart contains some items which are not in stock'
                        }
                    },
                },
            ));
        } else if (response?.response_message?.[1] === 'error') {
            showFormError(response?.response_message?.[0]);
            return response?.response_message?.[1];
        }
    };

    useEffect(() => {
        const handleAddressFormLoading = () => {
            setLoading(true);
            setDeliveryInformation({ ...deliveryInformation, updateOnlyTelephone: false, infoMessage: '' });
        }

        const handleAddressFormLoaded = () => {
            setLoading(false);
        };

        const handleAddressFormSubmitted = async (event) => {
            setDeliveryInformation({
                ...deliveryInformation, changeAddress: isBilling ? 'billing' : 'shipping',
            });

            const { isUpdate, address } = event?.detail;
            if (isLoggedIn) {
                if (!isUpdate) {
                    setUserAddressList((prevAddressList) => prevAddressList ? [...prevAddressList, { ...address }] : [{ ...address }]);
                    address['customer_address_id'] = address?.id;
                    delete address?.id;
                }
                else {
                    setUserAddressList(prevAddressList =>
                        prevAddressList.map(item =>
                            item.id === address.id ? { ...item, ...address } : item
                        )
                    );
                    address['customer_address_id'] = address?.id;
                    delete address?.id;
                }
            }

            if (isBilling) {
                const addressPayload = createAddressPayload(event.detail);
                await invokeUpdateCart(null, addressPayload, 'billing');
                if (onClose) onClose();
                return;
            }
            invokeUpdateShippingAddress(event.detail);
        };

        window.addEventListener('react:addressFormLoading', handleAddressFormLoading);
        window.addEventListener('react:addressFormLoaded', handleAddressFormLoaded);
        window.addEventListener('react:addressFormSubmitted', handleAddressFormSubmitted);

        return () => {
            window.addEventListener('react:addressFormLoading', handleAddressFormLoading);
            window.removeEventListener('react:addressFormLoaded', handleAddressFormLoaded);
            window.removeEventListener('react:addressFormSubmitted', handleAddressFormSubmitted);
        };
    }, [deliveryInformation, setDeliveryInformation]);

    useEffect(() => {
        (async () => {
            const checkoutHomeDelivery = document.getElementById('checkout-home-delivery');
            const endpoint = await getConfigValue('apimesh-endpoint');
            const country = await getConfigValue('country-code');
            setCountryCode(country);
            const config = {
                endpoint
            };

            const langCode = document.documentElement.lang;
            const addressPlaceHolders = window.placeholders[langCode ? `/${langCode}` : 'default'];
            window.dispatchEvent(new CustomEvent('react:loadAddressForm',
                {
                    detail: {
                        targetSelector: checkoutHomeDelivery,
                        placeholder: addressPlaceHolders ? addressPlaceHolders : placeholders,
                        newCustomer: true,
                        isCheckoutPage: true,
                        address: editAddress ?? {},
                        isLoggedIn,
                        config,
                        updateOnlyTelephone: deliveryInformation.updateOnlyTelephone,
                        infoMessage: deliveryInformation.infoMessage,
                        isTopup: isTopupFlag,
                    }
                }
            ));
        })()
    }, [configs, selectedMethod, isShippingAddressAvailable, lastOrderDetailsLoaded])

    return (<>
        {loading ? <Loader /> : null}
        <div id="checkout-home-delivery"></div>
    </>);

}

export default AddressForm;