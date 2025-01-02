import React, { useContext, useEffect } from 'react';
import './empty-cart.css';
import CartContext from '../../context/cart-context';
import Icon from '../../library/icon/icon.jsx'

function EmptyCart() {
  const { placeholders , shouldEnableEmptyCartBagV2 } = useContext(CartContext);

  useEffect(() => {
    const cartContainerEl = document.querySelector('.cart-container');
    const cartBlockEl = document.querySelector('.cart.block');
    const carouselEmptyCartEl = document.querySelector('.cart-container .carousel-wrapper');

    if (cartContainerEl) cartContainerEl.classList.add('cart-container-full');
    if (cartBlockEl) cartBlockEl.classList.add('empty-cart-block');
    if (carouselEmptyCartEl) carouselEmptyCartEl.classList.add('carousel-empty-cart');

    window.dispatchEvent(new CustomEvent('updateMiniCart'));

    return () => {
      if (cartContainerEl) cartContainerEl.classList.remove('cart-container-full');
      if (cartBlockEl) cartBlockEl.classList.remove('empty-cart-block');
      if (carouselEmptyCartEl) carouselEmptyCartEl.classList.remove('carousel-empty-cart');
    };
  }, []);


  const shoptoHomePage = ()=>{
    window.location.href = `/${document.documentElement.lang}/`;
  }

  if(shouldEnableEmptyCartBagV2){
    return (
      <div className={`cart__empty ${shouldEnableEmptyCartBagV2 ? 'enable-empty-cart-bag-v2' : ''}`}>
        <Icon name="bag" className="icon bag" />
        <span className="cart-empty__title">{placeholders.emptyCartTitleV2}</span>
        <span className="cart-empty__message">{placeholders.emptyCartMessageV2}</span>
        <button className='continue_shopping' onClick={shoptoHomePage}>{placeholders.emptyCartCountinueShopping}<Icon name="chevron-right-white" className="chevron-right-white" /></button>
    </div>
    )
  }

  return (
    <div className="cart__empty">
      <span className="cart-empty__title">{placeholders.emptyCartMessage}</span>
    </div>
  );
}

export default EmptyCart;
