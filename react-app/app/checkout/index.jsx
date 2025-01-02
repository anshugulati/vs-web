import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/app.jsx';
import '../cart/index.css';
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
  const [checkoutOrderSummaryContainer, userEmailError, paymentMethods, paymentLogosContainer, reedemEgiftContainer, loyalty, purchasePrivacyPolicy, deliveryMethods ] = block.querySelectorAll('.checkout > div');
  const paymentlogolist = paymentLogosContainer?.querySelectorAll('li'); 
  const reedemEgiftText = reedemEgiftContainer?.querySelectorAll('p');
  const deliveryMethodsList = deliveryMethods?.querySelectorAll('li');
  const [, ...paymentMethodsContent] = paymentMethods?.querySelectorAll('div > table > tbody > tr') || [];
  const purchasePolicyText = purchasePrivacyPolicy?.querySelector('div');
  const checkoutSummaryContainer = checkoutOrderSummaryContainer?.querySelectorAll('div')[0];
  const checkoutOrderSummaryTitle = checkoutSummaryContainer?.querySelector('strong');

  const loyaltyContent = loyalty?.querySelectorAll('div')?.[0];
  const loyaltyTitle = loyaltyContent?.querySelector('p');
  const loyaltyOptions = loyaltyContent?.querySelectorAll('ul li');

  const userEmailExist = userEmailError?.querySelector('div');

  let content = {
    checkoutOrderSummaryTitle: '',
    userEmailExist: '',
    paymentMethods: '',
    paymentlogolist: null,
    deliveryMethodsList: null,
    redeemegifthead: '',
    redeemegifttitle: '',
    redeemegiftsubtitle: '',
    loyalty: {},
    purchasePolicyText: '',
  };
  const [redeemegifthead, redeemegifttitle, redeemegiftsubtitle] = reedemEgiftText ?? [];
  content = {
    checkoutOrderSummaryTitle: checkoutOrderSummaryTitle ? checkoutOrderSummaryTitle?.innerHTML : '',
    userEmailExist: userEmailExist? userEmailExist.innerHTML : '',
    paymentMethods: paymentMethodsContent,
    paymentlogolist,
    deliveryMethodsList,
    redeemegifthead: redeemegifthead ? redeemegifthead.innerHTML : '',
    redeemegifttitle: redeemegifttitle ? redeemegifttitle.innerHTML : '',
    redeemegiftsubtitle: redeemegiftsubtitle ? redeemegiftsubtitle.innerHTML : '',
    loyalty: {
      title: loyaltyTitle ? loyaltyTitle.innerText : '',
      options: loyaltyOptions || '',
    },
    purchasePolicyText: purchasePolicyText ? purchasePolicyText.innerHTML : '',
  };

  root.render(
    <CartContextProvider placeholders={{ ...INIT_PLACEHOLDERS, ...placeholders }} content={content}>
      <App content={content} />
    </CartContextProvider>,
  );
}
