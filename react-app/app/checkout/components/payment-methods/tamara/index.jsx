import React, { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import AppConstants from '../../../../../utils/app.constants';
import { getConfigValue, getLanguageAttr } from '../../../../../../scripts/configs';
import CartContext from '../../../../../context/cart-context';
import { getPayable } from '../utilities/utils';
import './tamara.css';
import { loadScriptHelper } from '../../../../../utils/base-utils';

const TamaraPayment = forwardRef(({ finalisePayment }, ref) => {
    const { cart } = useContext(CartContext);
    const [currencyCode, setCurrencyCode] = useState('AE');
    useEffect(() => {
        const amount = getPayable(cart);
        document.getElementsByClassName('tamara-installment-plan-widget')[0]?.remove();
        const tamaraElement = document.createElement("div");
        tamaraElement.setAttribute('class', 'tamara-installment-plan-widget');
        tamaraElement.setAttribute('data-lang', getLanguageAttr());
        tamaraElement.setAttribute('data-price', amount);
        tamaraElement.setAttribute('data-currency', currencyCode);
        tamaraElement.setAttribute('data-number-of-installments', 4);
        document.getElementsByClassName('tamara-installment-widget')[0]?.appendChild(tamaraElement);
        window.TamaraInstallmentPlan?.render();
    }, [cart]);

    useImperativeHandle(ref, () => ({
        completePurchase: async () => {
            const payload = {
                payment: {
                    method: AppConstants.PAYMENT_METHOD_CODE_TAMARA,
                },
            };
            if (finalisePayment) await finalisePayment(payload);
        },
    }));

    useEffect(() => {
        (async () => {
            const tamaraApiKey = await getConfigValue('bnpl-tamara-api-key');
            const currency = await getConfigValue('currency');
            const tamaraInstallmentUrl = await getConfigValue('tamara-installment-widget-url');
            await loadScriptHelper(tamaraInstallmentUrl, { "type": "module" });
            setCurrencyCode(await getConfigValue('currency'));
            if (window.TamaraInstallmentPlan) {
                window.TamaraInstallmentPlan.init({
                    lang: getLanguageAttr(),
                    currency: currency,
                    publicKey: tamaraApiKey
                })
                window.TamaraInstallmentPlan.render();
            }
        })();
    }, []);
    return (
        <div className="tamara-installment-widget" />
    );
});

export default TamaraPayment;
