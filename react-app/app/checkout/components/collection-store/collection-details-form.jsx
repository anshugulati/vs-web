import React, {
    useContext, useEffect, useRef, useState,
  } from 'react';
  import CartContext from '../../../../context/cart-context';
  import validateCustomerEmail from '../../../../api/validateCustomer';
  import { getConfigValue } from '../../../../../scripts/configs';
  import { getCountryIso } from '../../../../../scripts/helpers/country-list';
  import updateCart from '../../../../api/updateCart';
  import { findValueFromAddress } from './map-utils';
  import { getMaxLengthByCountryCode } from '../../../../../scripts/helpers/country-list';
  import  getSubCartGraphql from '../../../../api/getSubCartGraphql';
  import removeRedemption from '../../../../api/removeRedemption';
  import ApiConstants from '../../../../api/api.constants';
  import Icon from '../../../../library/icon/icon';



  function CollectionDetailsForm({setIsModalOpen, isModalOpen}){
    const { placeholders, isLoggedIn, setCart,content,cartId, selectedCollectionStore, cart ,setCAndCInfo, cAndCInfo, cncCollectionPointsEnabled, setSelectedCollectionStoreForCheckout, configs } = useContext(CartContext);
    const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';
    const infoWindowRef = useRef(null);
    const searchInputRef = useRef(null);
    const [isUpdatingStore, setIsUpdatingStore] = useState(false);
    const [fullname, setFullname] = useState(cAndCInfo?.fullname || '');
  const [email, setEmail] = useState(cAndCInfo?.email || '');
  const [mobile, setMobile] = useState(cAndCInfo?.mobile || '');
  const [configData, setConfigData] = useState({});
  const [isContactInfo, setIsContactInfo] = useState(false);
  const [contactInfoRef, setContactInfoRef] = useState();
  const [contactInfoErrors, setContactInfoErrors] = useState({ fullname: false, mobile: false, email: false });
  const formRef = useRef();
  const [isContinueDirty, setIsContinueDirty] = useState(false);
  const [emailExist, setEmailExist] = useState(false);
  const [isEmailEditable, setIsEmailEditable] = useState(true); 

  const dataAddressInfo = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.address;
  const dataAddressMail= dataAddressInfo?.email;
  const checkIfAllDetails = (dName, dEmail, dMobile) => {
    if (isLoggedIn) {
      if (dName && dMobile) {
        return true;
      }
      return false;
    }
    if (dName && dMobile && dEmail) {
      return true;
    }
    return false;
  };
  const FULLNAME_PATTERN_FORM = new RegExp(String.raw`^\p{L}+(?:\s\p{L}+)+$`, 'u');
  const nameChangeHandler = (eve) => {
    const val = eve.target.value;
     const isValidFullName = FULLNAME_PATTERN_FORM.test(val);
    setFullname(val);
    setContactInfoErrors((prev) => ({
      ...prev,
      fullname: !isValidFullName,
    }));
  };

  const mobileChangeHandler = (eve) => {
    const val = eve.target.value;
 
    if (val.length > 10) return;
    setMobile(val);
    const isValidMobile = /^[0-9]{8,10}$/.test(val);
    setContactInfoErrors((prev) => ({
      ...prev,
      mobile: !isValidMobile, 
    }));
  };
  
  useEffect(() => {
    if (isModalOpen) {
      setEmail(dataAddressMail || ''); 
      setIsEmailEditable(true);
    }
  }, [isModalOpen, dataAddressMail]);

  const emailChangeHandler = (eve) => {
    const val = eve.target.value;
    setEmail(val);
  };

  const loadConfigData = async () => {
    const countryCode = await getConfigValue('country-code');
    const countryPrefix = `+${await getCountryIso(countryCode)}`;
    const maxLength = await getMaxLengthByCountryCode(countryCode);
    setConfigData({ countryCode, countryPrefix, maxLength: maxLength ? maxLength : 8 });

    const dataAddress = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.address;
    let fullName = dataAddress?.firstname ?? '';
    fullName += dataAddress?.lastname ? ' ' + dataAddress?.lastname : '';
    const contactInfo = { fullname: fullName, mobile: dataAddress?.telephone, email: dataAddress?.email };

    setFullname(cAndCInfo?.fullname || contactInfo?.fullname || '');
    setMobile(cAndCInfo?.mobile || contactInfo?.mobile?.replace(countryPrefix, '') || '');
  };

  useEffect(() => {
    loadConfigData();
  }, []);

  useEffect(() => {
    if (checkIfAllDetails(fullname, email, mobile)) {
      contactInfoUpdated(true, {
        formRef: formRef.current, mobile, fullname, email,
      });
    } else {
      contactInfoUpdated(false, {
        formRef: formRef.current, mobile, fullname, email,
      });
    }
  }, [fullname, email, mobile, formRef]);

  useEffect(() => {
    if (!isContinueDirty) {
      return;
    }
    continueAndUpdateCart();
  }, [isContinueDirty, contactInfoRef]);


    const contactInfoUpdated = (flag, formData) => {
        if (isContinueDirty) {
          setIsContinueDirty(false);
        }
        setIsContactInfo(flag);
        setContactInfoRef(formData);
        setCAndCInfo({ fullname: formData.fullname, mobile: formData.mobile, email: formData.email });
      };
    
      function validateEmail(email) {
        if (!email) {
          return false;
        }
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
        return regex.test(email);
      } 

    const continueClickHandler = async () => {
        const { fullname, email } = contactInfoRef;
        let isValidFullName = false;
        if (fullname && fullname.split(' ').length > 1) {
          isValidFullName = true;
        }
        let isValidEmail = true;
        if (!isLoggedIn) {
          isValidEmail = validateEmail(email);
          const emailInput = document.querySelector('#collectedby-info-email-input');
          const responseData = await validateCustomerEmail(emailInput.value);
          if (responseData?.customerExists) {
            setEmailExist(true);
            return;
          }
          else {
            setEmailExist(false);
          }
        }
    
        if (isValidFullName && isValidEmail && !emailExist) {
          setContactInfoErrors({ ...contactInfoErrors, fullname: false, email: false });
          window.dispatchEvent(new CustomEvent('react:validateMobileNumber', { detail: { ...contactInfoRef } }));
        } else {
          setContactInfoErrors({ ...contactInfoErrors, fullname: !isValidFullName, email: !isValidEmail });
        }
      };

      

      const createAddressBody = (additionalFields = {}) => ({
        shipping: {
          ...additionalFields,
        },
        extension: {
          action: 'update shipping',
        },
      });

      const continueAndUpdateCart = async () => {
        setIsUpdatingStore(true);
        const countryCode = await getConfigValue('country-code');
        const { fullname, mobile, email } = contactInfoRef;
        const addressBody = createAddressBody({
          shipping_carrier_code: 'click_and_collect',
          shipping_method_code: 'click_and_collect',
          extension_attributes: {
            click_and_collect_type: 'ship_to_store',
            store_code: selectedCollectionStore?.store_code,
          },
          shipping_address: {
            city: findValueFromAddress(selectedCollectionStore.address, 'address_city_segment'),
            country_id: countryCode,
            custom_attributes: [
              {
                attribute_code: 'area',
                value: findValueFromAddress(selectedCollectionStore.address, 'area'),
              },
              {
                attribute_code: 'address_city_segment',
                value: findValueFromAddress(selectedCollectionStore.address, 'address_city_segment'),
              },
            ],
            firstname: fullname.split(' ')[0],
            lastname: fullname.split(' ').slice(1, fullname.length - 1).join(' '),
            street: [findValueFromAddress(selectedCollectionStore.address, 'street')],
            telephone: mobile,
            email: email
          },
        });
        const response = await updateCart(addressBody, cartId, isLoggedIn);
        if (response?.response_message?.[1] === 'success') {
          setSelectedCollectionStoreForCheckout(selectedCollectionStore);
          const availablePaymentMethods = await getSubCartGraphql(isLoggedIn, cartId, [ApiConstants.CART_QUERY__PAYMENTS_METHODS]);
          if (availablePaymentMethods ) {
            setCart({
              ...cart,
              data: {
                ...cart?.data,
                ...availablePaymentMethods,
                extension_attributes: {
                  ...cart.data.extension_attributes,
                  cart: {
                    ...cart.data.extension_attributes.cart,
                    extension_attributes: {
                      ...cart.data.extension_attributes.cart.extension_attributes,
                      shipping_assignments: response?.cart?.extension_attributes?.shipping_assignments,
                    },
                  },
                },
    
              },
            });
          }
          if (isLoggedIn) {
            removeRedemption({
              redemptionRequest: {
                quote_id: cart?.data?.extension_attributes?.cart.id,
              },
            }, true);
          }
        } else if (response?.response_message?.[1] === 'error') {
          const errorMessage = response?.response_message?.[0];
          if (errorMessage) {
            window.dispatchEvent(
              new CustomEvent('react:showPageErrorMessage', {
                detail: { message: errorMessage },
              }),
            );
          }
        }
        setIsUpdatingStore(false);
        setIsModalOpen?.(false); 
      };

      window.addEventListener('react:validateMobileNumberResult', async (event) => {
        setContactInfoErrors({ ...contactInfoErrors, mobile: event.detail.mobile });
        if (!event.detail.mobile) {
          setIsContinueDirty(true);
        }
      });

    return (
        <>
          <div className="checkout__collection-form-fields">

          <div ref={formRef} className="collection-details-form">
          <div className="collection-info-form-input name-input">
            <input id="collectedby-info-fullname-input" type="text" className={`${fullname ? 'focus' : '' } ${contactInfoErrors?.fullname ? 'contact-info-error': ''}`} onChange={nameChangeHandler} value={fullname} />
            <label htmlFor="collectedby-info-fullname-input">{placeholders.mapFullName}</label>
            {contactInfoErrors?.fullname && <span> <Icon name='info-small-error'/> <span className="collection-details-form-error">{placeholders.mapEnterFullname}</span></span>}
          </div>

          <div className="collection-info-form-input collection-info-form-mobile">
            <div dir="ltr">
              <input id="collectedby-info-mobile-input" className={`${mobile ? 'focus' : '' } ${contactInfoErrors?.mobile ? 'contact-info-error': ''}`}  value={mobile} type="number" onChange={mobileChangeHandler} maxLength={configData.maxLength} />
              <label id="mobile-input" htmlFor="collectedby-info-mobile-input">{placeholders.mapMobileNumber}</label>
            </div>
            {contactInfoErrors?.mobile && <span> <Icon name='info-small-error'/> <span className="collection-details-form-error">{placeholders.mapValidNumber}</span></span>}
          </div>

          {
            <div className={`collection-info-form-input ${isLoggedIn ? 'disable-contact-info' : '' }`}>
              <input id="collectedby-info-email-input" type="email" className={`${email || dataAddressMail ? 'focus' : '' } ${contactInfoErrors?.email ? 'contact-info-error': ''}`} onChange={emailChangeHandler} 
                     value={email}
                     readOnly={!isEmailEditable}  />
              <label htmlFor="collectedby-info-email-input">{placeholders.mapEmail}</label>
              {emailExist && <span className="collection-details-form-error" dangerouslySetInnerHTML={{ __html: content?.userEmailExist }} />}
              {contactInfoErrors?.email && !emailExist && <span> <Icon name='info-small-error'/>  <span className="collection-details-form-error">{placeholders.mapEmailError}</span></span>}
            </div>
          }

          {<div className={`save-contact-info-btn ${(contactInfoErrors?.mobile  || contactInfoErrors?.fullname ||  contactInfoErrors?.email ) ? 'disable-contact-info' : ''}`}> <button onClick={continueClickHandler}>{placeholders.saveCollectionContactInfo}</button></div>} 
        </div>
            </div>
        </>
    )

  }

  export default CollectionDetailsForm;