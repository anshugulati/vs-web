import React, { useContext } from 'react';
import { findValueFromAddress } from '../map-utils';
import CartContext from '../../../../../context/cart-context';
import useCurrencyFormatter from '../../../../../utils/hooks/useCurrencyFormatter';

function StoreDetails({ item, hours }) {
  const { placeholders, cncCollectionPointsEnabled, cart, priceDecimals, configs } = useContext(CartContext);
  const addressFloorSegment = findValueFromAddress(item.address, 'address_floor_segment');
  const addressBuildingSegment = findValueFromAddress(item.address, 'address_building_segment');
  const street = findValueFromAddress(item.address, 'street');
  const shouldEnableDeliveryAndBillingAddressV2 = configs?.['checkout-delivery-and-billing-address-v2'] === 'true';

  const grandTotalCurrency = cart?.data?.prices?.grand_total?.currency ?? '';
  const formattedPrice = useCurrencyFormatter({ price: item.price_amount, priceDecimals, currency: grandTotalCurrency });

  return (
    <div className="collection-store-li-add">
      {
        cncCollectionPointsEnabled
          ? <div className='collection-point-address'>
            {addressFloorSegment && <span className="col-section-card-streetname">{addressFloorSegment}</span>}
            {addressBuildingSegment && <span className="col-section-card-streetname">{addressBuildingSegment}</span>}
            {street && <span className="col-section-card-streetname">{street}</span>}
          </div>
          : <div>{findValueFromAddress(item.address, 'street')}</div>
      }
      <div className="collection-store-time">
      {!shouldEnableDeliveryAndBillingAddressV2 && (<> <span>{cncCollectionPointsEnabled ? placeholders.mapCollectFromPoint : placeholders.mapCollectFromStore}</span> 
          {' '}
          <span>
           {item.sts_delivery_time_label}   </span> </>)}
         {shouldEnableDeliveryAndBillingAddressV2 && (<> 
         {' '}
           <span>
          {' '}
          {item.store_phone}
        </span> </>)}
        {cncCollectionPointsEnabled && item.pudo_service === 1 && <span>{' '}{placeholders.mapCollectionFor} {formattedPrice}</span>}

      </div>
      <div className="collection-store-time">
        {hours?.map((hour) => (
          <div>
            <span>{hour.label}</span>
            <span>
              {' '}
              (
              {hour?.value}
              )
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StoreDetails;