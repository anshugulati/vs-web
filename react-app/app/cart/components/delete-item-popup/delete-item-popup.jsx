import React, {
  useEffect, useState, useRef, useContext,
} from 'react';
import { decorateIcons } from '../../../../../scripts/aem.js';
import CartContext from '../../../../context/cart-context.jsx';
import './delete-item-popup.css';
import { getWishlist } from '../../../../../scripts/wishlist/api.js';

function DeletePopup({
  onMoveToFav, onRemove, productImageUrl, isEgift, productSku, disabled, isFreeGift,isOOS,quantityNotAvailable, isQtyAvailable
}) {
  const [isOpen, setIsOpen] = useState(false);
  const itemRef = useRef(null);

  const handleOpenModal = () => {
    getWishlist().then((data) => {
      if (data && data.items && data.items.findIndex((item) => item.sku === productSku) > -1) {
        onRemove();
      } else {
        setIsOpen(true);
      }
    }).catch(() => {
      setIsOpen(true);
    });
  };
  const { placeholders, shouldEnableProductCardV2 } = useContext(CartContext);
  const isTrashRed = isOOS ? true: !quantityNotAvailable && !isEgift && !isFreeGift && disabled;

  useEffect(() => {
    if (isOpen && document.querySelector('#item-popup-modal')) {
      decorateIcons(document.querySelector('#item-popup-modal'));
    }
  }, [isOpen]);

  useEffect(() => {
    if (itemRef.current) {
      if (itemRef.current.querySelector('img')) {
        itemRef.current.querySelector('img').remove();
      }
      decorateIcons(itemRef.current);
    }
  }, [isTrashRed]);

  const handleCloseModal = () => {
    setIsOpen(false);
  };

  const addExtratext = (text) => {
    return (
      <span>{text}</span>
    )
  }

  return (
    <div className="delete-item" ref={itemRef}>
      <span onClick={isEgift ? onRemove : handleOpenModal} onKeyUp={(e) => e.key === 'Enter' && (isEgift ? onRemove() : handleOpenModal())} role="button" tabIndex={0} aria-label="delete button" >
      {addExtratext(placeholders.cartProductCardRemoveItemPrefix)}
      <span className={`icon ${isTrashRed ? 'icon-trash-red trash-red' : 'icon-trash-grey trash-grey'} ${isFreeGift ? 'icon-delete-disabled' : ''} icon-md`} /></span>
      {
        isOpen && (
          <div className="delete_popup_overlay">
            <div className="popup-delete">
              <div id="item-popup-modal" className="delete_popup_main">
                <span onClick={handleCloseModal} onKeyUp={(e) => e.key === 'Enter' && handleCloseModal()} role="button" tabIndex={0} className="close_icon" aria-label="close">
                  <span className="icon icon-close-icon" />
                </span>

                <div className="popup_body">
                  <img src={productImageUrl} alt="item" />
                  <div className="item_confirmation">
                    <p>{placeholders.deleteitempopupmessage}</p>
                  </div>
                </div>
                <div className="popup_footer">
                  <button type="button" onClick={onMoveToFav} className="move_to_fav_list">
                    {placeholders.itemmovetofavtext}
                  </button>
                  <button type="button" onClick={onRemove} className="remove_from_cart">
                    {placeholders.itemremovetext}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

export default DeletePopup;