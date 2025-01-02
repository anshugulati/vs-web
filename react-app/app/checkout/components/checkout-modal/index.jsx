import React, { useContext , useEffect } from 'react';
import Dialog from '../../../../shared/dialog/dialog';
import CheckoutHomeDeliveryModal from '../checkout-home-delivery-modal';
import CollectionStore from '../collection-store/collection-store';
import CartContext from '../../../../context/cart-context';

function CheckoutModal({ selectedMethod }) {
  const { deliveryInformation, setDeliveryInformation, setIsMapDetailsView, showAddressForm } = useContext(CartContext);
  const handleCloseDialog = () => setDeliveryInformation(prev => ({ ...prev, isDialogOpen: false, changeAddress: '' }));
  const mapCloseHandler = () => {
    setIsMapDetailsView(false);
    handleCloseDialog();
  };

  useEffect(() => {
    if (deliveryInformation.isDialogOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [deliveryInformation.isDialogOpen]);

  return (
    <Dialog
      isOpen={deliveryInformation.isDialogOpen}
      onClose={selectedMethod === 'click_and_collect' ? mapCloseHandler : handleCloseDialog}
      headerClassName="dialog__header-checkout"
      containerClassName={`dialog__checkout-container ${deliveryInformation.changeAddress === 'mapAddress' ? 'click-and-collect' : `home-delivery ${showAddressForm ? 'address-input-form' : 'address-list'}`}`}
    >
      {(selectedMethod === 'home_delivery' || deliveryInformation.changeAddress === 'billing') && <CheckoutHomeDeliveryModal isVisible={deliveryInformation.isModalVisible} onClose={handleCloseDialog} />}
      {selectedMethod === 'click_and_collect' && deliveryInformation.changeAddress !== 'billing' && <CollectionStore onClose={mapCloseHandler} />}
    </Dialog>
  );
}

export default CheckoutModal;
