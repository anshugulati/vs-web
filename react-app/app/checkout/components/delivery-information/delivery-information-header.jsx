import React, { useContext, useState, useEffect } from 'react';
import Icon from '../../../../library/icon/icon.jsx';
import CartContext from '../../../../context/cart-context.jsx';
import parsePhoneNumberFromString from 'libphonenumber-js';

function DeliveryInformationHeader({
  shippingAddress, placeholders, handleChangeClick, handleSelectClick, handleEditClick, addressSelected, isInfoSection, selectedAddressID, setSelectedAddressID, isSelectingAddress
}) {
  const { cart, configs, areaItems } = useContext(CartContext);
  const [isBtnDisabled, setIsBtnDisabled] = useState(true);
  const deliveryMatrixCity = cart?.data?.extension_attributes?.delivery_matrix_address?.items;
  const {
    changeDeliveryAddressCta,
    addressSelectButton,
    addressSelectedButton,
    editDeliveryAdrressCta
  } = placeholders;
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

  const areaCode = shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'area')?.value;
  const areaObj = areaCode && areaItems?.find(item => (''+item.location_id === ''+areaCode && item.status));

  const regionCode = shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'address_region_segment')?.value;
  const regionObj = regionCode && areaItems?.find(item => (''+item.location_id === ''+regionCode && item.status));

  const city = deliveryMatrixCity?.find((obj) => Number(obj.location_id) === Number(shippingAddress.city));

  useEffect(() => {
    if (addressSelected) setSelectedAddressID(shippingAddress.id);
  }, [addressSelected, setSelectedAddressID, shippingAddress.id]);

  const renderFullName = () => <span className="delivery-information__customer-name">{`${shippingAddress?.firstname} ${shippingAddress?.lastname}`}</span>;

  const renderEmail = () => (shippingAddress?.email ? (
    <span className="mobile-only">{shippingAddress.email}</span>
  ) : null);

  const renderTelephone = (bool) => (shippingAddress?.telephone ? (
    <span className={`${bool ? 'mobile-only' : 'delivery-information__customer-mobile'}`}>{shippingAddress.telephone}</span>
  ) : null);

  const renderAddress = () => {
    const addressDetails = {
      region: regionObj?.label,
      area: areaObj?.label,
      city: city?.label,
      street: shippingAddress?.street?.join(', '),
      building: shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'address_building_segment')?.value,
      address: shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'address')?.value,
      address_block_segment: shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'address_block_segment')?.value,
      address_apartment_segment: shippingAddress?.custom_attributes?.find((attribute) => attribute.attribute_code === 'address_apartment_segment')?.value,
    };
    const address = Object.keys(addressDetails).map((key) => addressDetails[key]).filter((value) => value?.trim()).join(', ');
    return address ? <span>{address}</span> : null;
  };

  const renderDeliveryInformationHeader = () => (
    <div className="delivery-information__header__customer-info">
      {renderFullName()}
      <div className="delivery-information__header__customer-address">
        {renderEmail()}
        {handleChangeClick ? (
          <div className='delivery-information__header__customer-sub-address'>
            {renderTelephone(!shouldEnableDeliveryAndBillingAddressV2)}
            {renderAddress()}
          </div>
        ) : (
          <>
            {renderAddress()}
            {renderTelephone(false)}
          </>
        )}
      </div>
    </div>
  );

  const checkDisabled = () => {
    let flag = false;
    if(!shippingAddress.telephone) {
      flag = true;
    }
    const parsedNumber = parsePhoneNumberFromString(shippingAddress.telephone);

    if(parsedNumber) {
      let nationalNumber = parsedNumber.formatNational().replace(/\s/g, "");
      if(!nationalNumber) {
        flag = true;
      }
    } else {
      flag = true;
    }
    if(areaCode && !areaObj && areaItems) {
      flag = true;
    }
    return flag;
  }

  useEffect(() => {
    setIsBtnDisabled(checkDisabled());
  }, [shippingAddress, areaItems]);

  const render = () => {
    return <>
      <div className={`delivery-information__header ${shouldEnableDeliveryAndBillingAddressV2 ? 'delivery-information__header-v2' : ''}`}>
        {shouldEnableDeliveryAndBillingAddressV2 && !handleChangeClick && <input
          id={`delivery-method-${shippingAddress.id}`}
          key={`delivery-method-${shippingAddress.id}`}
          name='radio_delivery-information-header'
          type="radio"
          value={shippingAddress.id}
          onChange={(event) => setSelectedAddressID(+event.target.value)}
          checked={shippingAddress?.id === selectedAddressID}
          disabled={isSelectingAddress}
        />}
        {renderDeliveryInformationHeader()}
        {
          shouldEnableDeliveryAndBillingAddressV2 && !handleChangeClick && <div className='delivery-information__header__customer-info__actions'>
            <button disabled={isSelectingAddress} type="button" className="secondary" onClick={handleEditClick}>{placeholders.deliveryInformationEditBtnCta}</button>
          </div>
        }
        {
          handleChangeClick || (!handleChangeClick && !shouldEnableDeliveryAndBillingAddressV2)
            ? <div className="delivery-information__header__action">
              {
                handleChangeClick
                  ? <button type="button" className="secondary" onClick={handleChangeClick}>{changeDeliveryAddressCta}</button>
                  : !shouldEnableDeliveryAndBillingAddressV2 &&
                  (
                    <>
                      <button disabled={isBtnDisabled} type="button" className={`secondary${isBtnDisabled ? ' select-disabled' : ''}`} onClick={!isBtnDisabled && handleSelectClick}>
                        {addressSelected
                          ? (
                            <>
                              <Icon name="right-checked-green" className="secondary-tick" />
                              {' '}
                              {addressSelectedButton}
                            </>
                          ) : (
                            addressSelectButton
                          )}
                      </button>
                      {
                        handleEditClick
                          ? (
                            <button
                              type="button"
                              className="secondary edit-btn"
                              onClick={handleEditClick}
                              aria-label="Edit address"
                            >
                              <Icon name="edit-black-bottom-border" className="edit-address" />
                            </button>
                          ) : null
                      }
                    </>
                  )
              }
            </div>
            : null
        }
      </div>
    </>
  }

  return shouldEnableDeliveryAndBillingAddressV2 && handleChangeClick ? <div className='delivery-information__header__container'>{render()}</div> : render();
}

export default DeliveryInformationHeader;
