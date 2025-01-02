import React, { useEffect } from 'react';
import './discount-and-vouchers-guest-user.css';
import { getLanguageAttr } from '../../../../../../../scripts/configs';

function DiscountAndVouchersGuestUser() {
  const redirectURL = `/${getLanguageAttr()}/cart`;

  const handleAddRedirectURL = (anchorEl) => {
    // replace the login with the cart login if the href is /user/login
    if (anchorEl?.href?.includes('/user/login')) {
      handleDatalayerHelloMemberPromoSection('sign in - click');
      window.location.href = anchorEl.href;
    } else {
      handleDatalayerHelloMemberPromoSection('become a member - click');
      window.location.href = anchorEl.href;
    }
  };

  const handleDatalayerHelloMemberPromoSection = (actionLabel) =>{
    window.dispatchEvent(new CustomEvent(
      'react:datalayerEvent',
      {
        detail: {
          type: 'helloMemberPromoSection',
          payload: {
            eventActionLabel: actionLabel || null,
          },
        }
      }
    )); 
  }

  useEffect(() => {
    const handleClick = (e) => {
      const elem = e.target;
      if (elem.tagName === 'A' && elem.closest('#discount-vouchers-guest')) {
        e.preventDefault();
        handleAddRedirectURL(elem);
      }
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [redirectURL]);


  useEffect(() => {
    window.dispatchEvent(new CustomEvent('react:loadFragment', { detail: { path: `/${getLanguageAttr()}/fragments/banners/offers/banner-membership`, targetSelector: '#discount-vouchers-guest' } }));
  }, []);

  return <div id="discount-vouchers-guest" />;
}

export default DiscountAndVouchersGuestUser;
