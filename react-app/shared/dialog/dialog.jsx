import React from 'react';
import { useContext } from 'react';
import './dialog.css';
import Icon from '../../library/icon/icon.jsx';
import CartContext from '../../context/cart-context.jsx';

function Dialog({
  isOpen, children, onClose, containerClassName, headerClassName, bodyClassName,
}) {
  const {configs} = useContext(CartContext);
  const dialogContainerClassName = `dialog__container ${containerClassName ?? ''}`.trim();
  const dialogHeaderClassNames = `dialog__header ${headerClassName ?? ''}`.trim();
  const dialogBodyClassNames = `dialog__body ${bodyClassName ?? ''}`.trim();
  const shouldEnableDeliveryAndBillingAddressV2 = configs['checkout-delivery-and-billing-address-v2'] === 'true';

  const handleClose = (event) => {
    event.stopPropagation();
    onClose();
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  if (!isOpen) return null;

  let isDialogToShow = true;

  return (
    <div className="dialog__overlay" onClick={isDialogToShow ? handleBackdropClick : null}>
      <div className={dialogContainerClassName}>
        <div className={dialogHeaderClassNames}>
          <Icon onIconClick={handleClose} name={`${shouldEnableDeliveryAndBillingAddressV2? 'action-cross-blue': 'close'}`} className="icon-close-wrapper" />
        </div>
        <div className={dialogBodyClassNames}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Dialog;

