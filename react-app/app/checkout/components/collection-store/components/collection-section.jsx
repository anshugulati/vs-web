
import React, { useContext, useEffect, useState } from 'react';
import CartContext from '../../../../../context/cart-context';
import './collection-section.css';
import Loader from '../../../../../shared/loader/loader';
import getStoreLocator from '../../../../../api/getStoreLocation';
import { getConfigValue } from '../../../../../../scripts/configs';
import { getCountryIso } from '../../../../../../scripts/helpers/country-list';
import Icon from '../../../../../library/icon/icon';
import { generateStoreHours } from '../../../../../utils/base-utils';
import useCurrencyFormatter from '../../../../../utils/hooks/useCurrencyFormatter';
import CollectionDetailsForm from '../collection-details-form';

function CollectionSection() {
  const {
    cart, setDeliveryInformation, isLoggedIn, deliveryInformation, placeholders, setIsMapDetailsView, selectedCollectionStoreForCheckout, setSelectedCollectionStoreForCheckout, setSelectedCollectionStore, selectedMethod, cncCollectionPointsEnabled, priceDecimals, configs, isDialogOpen
  } = useContext(CartContext);
  const shippingAssign = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments.find((assign) => assign?.shipping?.method === 'click_and_collect_click_and_collect');
  const storeCode = shippingAssign?.shipping?.extension_attributes?.store_code;
  const shippingContactInfo = shippingAssign?.shipping?.address;
  const [sectionData, setSectionData] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [configData, setConfigData] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
  const formattedPrice = useCurrencyFormatter({ price: shippingAssign?.shipping?.extension_attributes?.price_amount, priceDecimals, currency: grandTotalCurrency });
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

  const getSelectedStoreDetails = async (storeCode) => {
    setIsLoading(true);
    const result = await getStoreLocator(storeCode);
    const stores = result?.response?.items;
    if (stores?.length) {
      const storeDetails = stores.find(store => store.store_code === storeCode);
      setSelectedCollectionStore(storeDetails);
      setSelectedCollectionStoreForCheckout(storeDetails);
    }
    setIsLoading(false);
  }

  const loadConfigData = async () => {
    const countryCode = await getConfigValue('country-code');
    const countryPrefix = `+${await getCountryIso(countryCode)}`;
    setConfigData({ countryPrefix });
  }

  const editClickHandlerContact = () => {
    setDeliveryInformation({ ...deliveryInformation, isDialogOpen: false, changeAddress: 'mapAddress' });
    setIsModalOpen(true);
  };

  const closeModalHandler = () => {
    setIsModalOpen(false);
  };

  useEffect(() => {
    if (isModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isModalOpen]);

  useEffect(() => {
    loadConfigData();
  }, [])

  useEffect(() => {
    if (storeCode) {
      const dataAddress = shippingAssign?.shipping?.address;
      setSectionData({
        fullname: `${dataAddress.firstname} ${dataAddress.lastname}`,
        mobile: dataAddress.telephone ? `${dataAddress.telephone}` : '',
        email: shouldEnableDeliveryAndBillingAddressV2 ? dataAddress.email : '',
      });
      getSelectedStoreDetails(storeCode);
    }
  }, [storeCode, shouldEnableDeliveryAndBillingAddressV2, shippingAssign]);
  

  const changeClickHandler = () => {
    setDeliveryInformation({ ...deliveryInformation, isDialogOpen: true, changeAddress: 'mapAddress' });
  };

  const editClickHandler = () => {
    setDeliveryInformation({ ...deliveryInformation, isDialogOpen: true, changeAddress: 'mapAddress' });
    setIsMapDetailsView(true);
  };



  const getStoreAddress = () => selectedCollectionStoreForCheckout?.address?.find(address => address?.code === 'address')?.value ?? '';

  const getStoreStreet = () => selectedCollectionStoreForCheckout?.address?.find(address => address?.code === 'street')?.value ?? '';

  const getCollectionHours = (storeHours) => {
    let time = '';
    const itemHours = generateStoreHours(storeHours);
    itemHours.forEach((hours) => {
      time += `<div><span>${hours.label}</span><span> (${hours.value})</span></div>`;
    });
    return time;
  }
  const renderCollectionStoreDetails = () => {
    return (
      <>
      {shouldEnableDeliveryAndBillingAddressV2 ?    (<div className='store-info-selected'>
        <div className="col-section-card-storename">{selectedCollectionStoreForCheckout?.store_name}</div>
        <div className='collection-store-info'><span className={`${selectedCollectionStoreForCheckout.store_name ? 'store' : 'pickup-point'}`}>
                    {selectedCollectionStoreForCheckout.store_name ? 'Store' : 'Pickup Point'}
                          </span> <span className='collection-store-span'><span className='collection-store-info-text'> {placeholders.collectionWithinTxt} {selectedCollectionStoreForCheckout.sts_delivery_time_label}</span></span></div>

         </div> ):
    

     <div>
        <div className="col-section-card-storename">{selectedCollectionStoreForCheckout?.store_name}</div>
        <div className="col-section-card-streetname">{getStoreAddress()}</div>
        <div className="col-section-card-streetname">{getStoreStreet()}</div>
     </div>
  }
     </>
    )
  }

  const renderCollectionPointDetails = () => {
    const addressFloorSegment = selectedCollectionStoreForCheckout?.address?.find(address => address?.code === 'address_floor_segment')?.value ?? '';
    const addressBuildingSegment = selectedCollectionStoreForCheckout?.address?.find(address => address?.code === 'address_building_segment')?.value ?? '';
    const street = selectedCollectionStoreForCheckout?.address?.find(address => address?.code === 'street')?.value ?? '';
    const collectionPoint = cart?.data?.extension_attributes?.cart?.extension_attributes?.shipping_assignments?.[0]?.shipping?.extension_attributes?.collection_point;

    return (
      <div className='collection-point-details'>
        <div className='pudo-collection-list'>
          <Icon name={selectedCollectionStoreForCheckout.pudo_service === 1 ? 'brand-collection-icon' : 'brand-store-icon'} />
          <div className='collection-label-wrapper'>
            <span className="collection-point-title">{collectionPoint}</span>
            <span className="collection-store-name">{selectedCollectionStoreForCheckout.store_name}</span>
          </div>
        </div>
        <div className='collection-point-address-details'>
          <div className='collection-point-address'>
            {addressFloorSegment && <span className="col-section-card-streetname">{addressFloorSegment}</span>}
            {addressBuildingSegment && <span className="col-section-card-streetname">{addressBuildingSegment}</span>}
            {street && <span className="col-section-card-streetname">{street}</span>}
          </div>
          {selectedCollectionStoreForCheckout.store_hours && <span className="col-section-card-streetname" dangerouslySetInnerHTML={{ __html: getCollectionHours(selectedCollectionStoreForCheckout.store_hours) }} />}
          {selectedCollectionStoreForCheckout.sts_delivery_time_label && <span className="col-section-card-delivery-time-label">{`${placeholders.mapCollectFromPoint} ${shippingAssign?.shipping?.extension_attributes?.pickup_date || selectedCollectionStoreForCheckout.sts_delivery_time_label}`}{shippingAssign?.shipping?.extension_attributes?.price_amount && shippingAssign?.shipping?.extension_attributes?.pudo_available ? <span>{formattedPrice}</span> : null}</span>}
        </div>
      </div>
    )
  }

  const renderSectionData = () => {
    if (!sectionData) return null;

    return (
      <>
      <div className={`col-section-main ${shouldEnableDeliveryAndBillingAddressV2? 'bbw-selected-store': ''}`}>

        {shouldEnableDeliveryAndBillingAddressV2 ? ( <> <div className="checkout__delivery_information_title checkout__sub-container-title ">{placeholders.collectionStoreTitle}</div><div className="col-section-card col-setion-card1">
          {cncCollectionPointsEnabled ? renderCollectionPointDetails() : renderCollectionStoreDetails()}
          <div className="col-section-card-btn">
            <button type="button" onClick={changeClickHandler}>{placeholders.mapChangeBtn}</button>
          </div>
        </div>   
       
        </>

      ) : <> <div className="col-section-card col-setion-card1">
          {cncCollectionPointsEnabled ? renderCollectionPointDetails() : renderCollectionStoreDetails()}
          <div className="col-section-card-btn">
            <button type="button" onClick={changeClickHandler}>{placeholders.mapChangeBtn}</button>
          </div>
        </div>
        <div className="col-section-card col-setion-card2">
          <div>
            <div className="col-section-card-storename">{placeholders.mapCollectionBy}</div>
            <div className="col-section-card-streetname">{sectionData.fullname}</div>
            <div className="col-section-card-streetname">{`${configData.countryPrefix} ${sectionData.mobile}`}</div>
          </div>
          <div className="col-section-card-btn">
            <button type="button" onClick={editClickHandler}>{placeholders.mapEditBtn}</button>
          </div>
        </div>
        </>}
     
      </div>
      {shouldEnableDeliveryAndBillingAddressV2 && <div className='bbw-section-form-main'>
        <div className='form-contact-info-title'>{placeholders.mapContactInfo}</div>
          { sectionData?.email && sectionData.mobile ?  
          <>
          <div className="col-section-card col-setion-card2">
            <div>
              <div className="col-section-card-storename">{sectionData.fullname}</div>
              <div className="col-section-card-streetname">{`${configData.countryPrefix} ${sectionData.mobile}`}</div>
              <div className="col-section-card-streetname">{sectionData.email}</div>
            </div>
            <div className="col-section-card-btn">
              <button type="button" onClick={editClickHandlerContact}>{placeholders.mapEditBtn}</button>
            </div>
          </div>
          <div className='contact-info-note'> <Icon name='info-blue' className='infoIcon'/><div className='contact-info-note-body'> <div>{placeholders.contactInfoNoteTitle}</div> <span className='contact-info-note-span'>{placeholders.contactInfoNote}</span></div> </div>
          </> 
             : <CollectionDetailsForm/> }

      </div>}
       
      
      </>

    )
  }

  return (
<div>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {renderSectionData()}
          {isModalOpen && (
            <div className="form-modal-overlay">
              <div className="form-modal-container" role="dialog" aria-labelledby="modal-title">
                <div className='collection-form-modal-header'>
              <div className='collection-form-modal-title'> {placeholders.editContactInfoModalTitle}</div>
                <button className="modal-close" onClick={closeModalHandler}>
                  <Icon name='action-cross-blue'/>
                </button>
                </div>
                <CollectionDetailsForm isModalOpen={isModalOpen} setIsModalOpen= {setIsModalOpen}/>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

}


export default CollectionSection;
