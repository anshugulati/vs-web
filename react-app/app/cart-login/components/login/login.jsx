import React, { useContext, useEffect, useRef } from 'react';
import './login.css';
import CartContext from '../../../../context/cart-context';
import { getLanguageAttr } from '../../../../../scripts/configs';

function Login() {
  const { placeholders, reactBridgeLoaded, configs } = useContext(CartContext);
  const containerRef = useRef(null);
  const shouldEnableLoginV2 = configs['enable-cart-checkout-login-v2'] === 'true';

  useEffect(() => {
    document?.querySelector('body')?.classList.add('user');
    document?.querySelector('body')?.classList.add('login');
  }, [])


  useEffect(() => {
    if (containerRef.current) {
      window.dispatchEvent(new CustomEvent('react:loadFragment', { detail: { path: `/${getLanguageAttr()}/user/login`, targetSelector: '.cart__login-container' } }));

      const container = document.getElementById('cart__login-container');

      const observer = new MutationObserver((mutationsList) => {
        document?.querySelector('.cart__login-container')?.classList.add('main-wrapper');
        document?.querySelector('.cart__login-container')?.classList.add('checkout-flow');

        window.dispatchEvent(new CustomEvent('react:loginFragmentLoaded'));

        Array.from(mutationsList).forEach((mutation) => {
          if (mutation.type === 'childList') {
            // const h2TitleRef = container.querySelector('.default-content-wrapper');
            // if (h2TitleRef) {
            //   h2TitleRef.remove();
            // }
            // const loginFormWrapper = container.querySelector('.commerce-login-wrapper');
            // if (loginFormWrapper) {
            //   const htmlContent = `<legend class="cart__login-legend"><span>${placeholders?.signInEmail}</span></legend>`;
            //   loginFormWrapper.insertAdjacentHTML('afterbegin', htmlContent);
            // }

            // const socialLoginWrapper = container.querySelector('.social-login-wrapper');
            // if (socialLoginWrapper) {
            //   const htmlContent = `<legend class="cart__login-legend"><span>${placeholders?.signInSocial}</span></legend>`;
            //   socialLoginWrapper.insertAdjacentHTML('afterbegin', htmlContent);
            // }

            const accTxtRef = container.querySelector('.social-login .account-text');
            if (accTxtRef) {
              accTxtRef.innerHTML = '';
            }
            const signRef = container.querySelector('.sign-up');
            if (signRef) {
              signRef.innerHTML = placeholders?.checkoutAsGuest;
              signRef.href = `/${document.documentElement.lang}/checkout`;
            }

            const commWrapperRef = container.querySelector('.commerce-login-wrapper');
            const anchorElement = document.createElement('a');
            anchorElement.href = `/${document.documentElement.lang}/cart`;
            anchorElement.innerHTML = placeholders?.backToBasket;
            anchorElement.classList = ['back-to-basket'];
            if (commWrapperRef) {
              commWrapperRef.appendChild(anchorElement);
              commWrapperRef.classList.add('slide-up-animation');
            }
            const socialLoginWrapper = container.querySelector('.social-login-wrapper');
            socialLoginWrapper.classList.add('slide-up-animation');
          }
        });
      });

      observer.observe(container, { childList: true });

      return () => {
        observer.disconnect();
      };
    }
  }, [containerRef, reactBridgeLoaded]);

  return (
    <>
      {!shouldEnableLoginV2 && <div className="cart__login-checkout-mobile-container">
        <a className="cart__login-btn-mobile" href={`/${document.documentElement.lang}/checkout`}>{placeholders?.checkoutAsGuest}</a>
        <div className="cart__login-mobile-separator">
          <span>{placeholders?.sepratorOrLabel}</span>
        </div>
      </div>}
      <div id="cart__login-container" className="cart__login-container" ref={containerRef} />
    </>
  );
}

export default Login;
