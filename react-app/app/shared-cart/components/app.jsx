// eslint-disable-next-line no-unused-vars
import React, { useEffect } from 'react';
import { getConfigValue, getLanguageAttr } from '../../../../scripts/configs';
import getResumeCart from '../../../api/getResumeCart.js';
import { getSignInToken } from '../../../../scripts/commerce.js';
import associateCarts from '../../../api/associateCarts.js';
import Loader from '../../../shared/loader/loader.jsx';

function App() {

  useEffect(() => {
    (async () => {
      let cartUrl = await getConfigValue('cart-url');
      if(!cartUrl){
        cartUrl = '/cart'
      }

      const redirectUrl = `/${getLanguageAttr()}${cartUrl}`;

      const params = new URLSearchParams(window.location.search);
      const channelId = params.get('channel');
      const urlData = params.get('data');
      if(!channelId || !urlData){
        window.location.href = redirectUrl;
      }
      const response = await getResumeCart(urlData, channelId);
      let cartId = '';
      if(response?.response?.data){
        const isLoggedIn = getSignInToken();
        if(isLoggedIn){
          cartId = response?.response?.data?.commerce_resumeCart?.extension_attributes?.cart?.id;
          if(cartId){
            await associateCarts({ cartId });
          }
          window.location.href = redirectUrl;
        }
        else {
          cartId = response?.response?.data?.commerce_resumeCart?.id;
          if(cartId){
            window.dispatchEvent(new CustomEvent('react:setCartId', {detail: { cartId }}));
            setTimeout(()=>{
              window.location.href = redirectUrl;
            }, 300)
          } else {
            window.location.href = redirectUrl;
          }
        }
      } else {
        window.location.href = redirectUrl;
      }
      
    })();
  }, []);

  return <div className="loader_overlay">
    <Loader />
  </div>;
}

export default App;
