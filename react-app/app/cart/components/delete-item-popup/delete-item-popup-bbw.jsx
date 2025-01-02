import React, {
    useEffect, useState, useRef, useContext,
} from 'react';
import { decorateIcons } from '../../../../../scripts/aem.js';
import CartContext from '../../../../context/cart-context.jsx';
import './delete-item-popup.css';
import { getWishlist } from '../../../../../scripts/wishlist/api.js';
import Loader from '../../../../shared/loader/loader.jsx';
import './delete-item-popup-bbw.css'

function DeletePopupBBW({
    onMoveToFav, onRemove, productImageUrl, isEgift, productSku, disabled, isFreeGift, quantityNotAvailable, isOOS, isOpen, setIsOpen, isFavoriteLoading, isRemoveBagLoading,
}) {
    const itemRef = useRef(null);
    const popupRef = useRef(null);

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
    const isTrashRed = isOOS ? true : !quantityNotAvailable && !isEgift && !isFreeGift && disabled;

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

    useEffect(() => {
        function handleClickOutside(event) {
            if (popupRef.current && !popupRef.current.contains(event.target)) {
                handleCloseModal();
            }
        }
        // Bind the event listener
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Unbind the event listener on clean up
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [popupRef]);

    const handleCloseModal = () => {
        setIsOpen(false);
    };

    const addExtratext = (text) => {
        return (
            <span className={`${isFreeGift ? 'icon-delete-disabled' : ''}`}>{text}</span>
        )
    }

    return (
        <div className="delete-item" ref={itemRef}>
            <span className={`${!isTrashRed ? 'removeTxt' : 'remove-item-error'} `} {...(isFreeGift ? {} : {
                onClick: isEgift || isTrashRed ? onRemove : handleOpenModal,
                onKeyUp: (e) => e.key === 'Enter' && (isEgift ? onRemove() : handleOpenModal())
            })} role="button" tabIndex={0} aria-label={placeholders.ariaLabelDeleteBtn}>
                {shouldEnableProductCardV2 && addExtratext(!isTrashRed ? placeholders.cartProductCardRemoveItemPrefix : placeholders.cartProductCardRemoveItemPrefixError)}
                <span className={`icon ${isTrashRed ? 'icon-trash-red trash-red' : 'icon-trash-grey trash-grey'} ${isFreeGift ? 'icon-delete-disabled' : ''} icon-md`} /></span>
            {
                isOpen && (
                    <div className="remove-cart delete_popup_overlay">
                        <div className="popup-delete" ref={popupRef}>
                            <div id="item-popup-modal" className="delete_popup_main ">
                                <div className="popup_header">
                                    {placeholders.removeCartTitle}
                                </div>
                                <span onClick={handleCloseModal} onKeyUp={(e) => e.key === 'Enter' && handleCloseModal()} role="button" tabIndex={0} aria-label={placeholders.ariaLabelClose}>
                                    <span className="icon icon-close" />
                                </span>
                                <div className="popup_body">
                                    <img src={productImageUrl} alt="item" />
                                    <div className="item_confirmation">
                                        <p>{placeholders.removeCartMessage}</p>
                                    </div>
                                </div>
                                <div className="popup_footer">
                                    <button type="button" onClick={onRemove} id="remove_from_cart">
                                        {isRemoveBagLoading ? <>{placeholders.removing}<Loader /></> : placeholders.removeFromBag}
                                    </button>
                                    <button type="button" onClick={onMoveToFav} id="move_to_fav_list">
                                        {isFavoriteLoading ? <>{placeholders.moving}<Loader /></> : placeholders.moveToFav}
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

export default DeletePopupBBW;
