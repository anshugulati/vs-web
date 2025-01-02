import React, { useContext, useEffect, useState } from 'react';
import './discount-and-vouchers.css';
import CartContext from '../../../../context/cart-context';
import Dialog from '../../../../shared/dialog/dialog';
import DiscountAndVouchersGuestUser from './components/discount-and-vouchers-guest-user/discount-and-vouchers-guest-user';
import DiscountAndVouchersLoggedinUser from './components/discount-and-vouchers-loggedin-user/discount-and-vouchers-loggedin-user';
import BBWVouchers from './components/bbw-voucher/bbw-voucher';

function DiscountAndVouchers({ className }) {
  const { placeholders, isLoggedIn, cart, bbwPromotionalSection } = useContext(CartContext);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  let containerClassName;
  let headerClassName;
  if (bbwPromotionalSection) {
    containerClassName = 'dialog__container-voucher-all-user';
    headerClassName = 'dialog__header-voucher-all-user';
  } else if (isLoggedIn) {
    containerClassName = 'dialog__container-discount-and-voucher-loggedin-user';
    headerClassName = 'dialog__header-discount-and-voucher-loggedin-user';
  } else {
    containerClassName = 'dialog__container-discount-and-voucher-guest-user';
    headerClassName = 'dialog__header-discount-and-voucher-guest-user';
  }

  const appliedOffer = cart?.data?.extension_attributes?.cart?.extension_attributes?.applied_hm_offer_code;
  const appliedVouchers = cart?.data?.extension_attributes?.cart?.extension_attributes?.applied_hm_voucher_codes?.split(',') ?? [];
  const appliedOfferAndVouchersCount = (appliedOffer ? 1 : 0) + (appliedVouchers?.length ?? 0);

  const handleOpenDialog = () => {
    setIsDialogOpen(true)
    window.dispatchEvent(new CustomEvent(
      'react:datalayerEvent',
      {
        detail: {
          type: 'helloMemberPromoSection',
          payload: {
            eventActionLabel: 'discount & voucher - link click',
          },
        }
      }
    )); 
    window.dispatchEvent(new CustomEvent(
      'react:datalayerEvent',
      {
        detail: {
          type: 'handlePromoSelectorEvent',
          payload: {
            eventAction: 'click label',
            eventLabelData: placeholders.promotionDiscountAndVouchersLabel,
          },
        }
      }
    ));
  };
  const handleCloseDialog = () => setIsDialogOpen(false);

  useEffect(()=>{
    if(isDialogOpen){
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  },[isDialogOpen])

  return (
    <>
      <Dialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        headerClassName={headerClassName}
        containerClassName={containerClassName}
      >
      {bbwPromotionalSection ? (
        <BBWVouchers handleCloseDialog={handleCloseDialog} />
      ) : (
        isLoggedIn ? (
          <DiscountAndVouchersLoggedinUser handleCloseDialog={handleCloseDialog} />
        ) : (
          <DiscountAndVouchersGuestUser />
        )
      )}
      </Dialog>
      <span onClick={handleOpenDialog} className={`${className} cart-discount-vouchers`} onKeyUp={(e) => e.key === 'Enter' && handleOpenDialog()} role="button" tabIndex={0}>
        {`${placeholders.promotionDiscountAndVouchersLabel}${appliedOfferAndVouchersCount ? ` : ${appliedOfferAndVouchersCount}` : ''}`}
        {' '}
        {appliedOfferAndVouchersCount ? null : <div className="promo-notification" />}
      </span>
    </>
  );
}

export default DiscountAndVouchers;
