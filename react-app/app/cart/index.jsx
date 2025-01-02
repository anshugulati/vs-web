import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/app.jsx';
import './index.css';
import fetchPlaceholdersForLocale from '../../utils/placeholders.js';
import { CartContextProvider, INIT_PLACEHOLDERS } from '../../context/cart-context.jsx';

export default async function decorate(block) {
  // render React components
  const langCode = document.documentElement.lang;
  const placeholders = await fetchPlaceholdersForLocale(
    langCode ? `/${langCode}` : '',
    'sheet=cart',
  );
  const root = createRoot(block);
  const [titleConentContainer, deliveryMethodsContainer, paymentLogosContainer] = block.querySelectorAll('.cart > div');
  const shoppingbagtitle = titleConentContainer?.querySelectorAll('p');
  const deliverymethods = deliveryMethodsContainer?.querySelectorAll('li');
  const paymentlogotitle = paymentLogosContainer?.querySelector('p');
  const paymentlogolist = paymentLogosContainer?.querySelectorAll('li');
  
  let content = {
    mobilecarttitle: '',
    carttitle: '',
    freereturnlable: '',
    cardmethodtitle: '',
    paymentlogolist: null,
    deliverymethods: null,
  };
  const [mobilecarttitle, carttitle, freereturnlable] = shoppingbagtitle;
  content = {
    mobilecarttitle: mobilecarttitle ? mobilecarttitle.innerHTML : '',
    carttitle: carttitle ? carttitle.innerText : '',
    freereturnlable: freereturnlable ? freereturnlable.innerHTML : '',
    cardmethodtitle: paymentlogotitle ? paymentlogotitle.innerHTML : '',
    paymentlogolist,
    deliverymethods,
  };

  root.render(
    <CartContextProvider placeholders={{ ...INIT_PLACEHOLDERS, ...placeholders }}>
      <App content={content} />
    </CartContextProvider>,
  );
}
