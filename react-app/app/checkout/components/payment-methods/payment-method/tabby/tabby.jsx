import React, { forwardRef, useContext, useImperativeHandle } from "react";
import './tabby.css';
import AppConstants from "../../../../../../utils/app.constants";
import CartContext from "../../../../../../context/cart-context";

const Tabby = forwardRef(({ amount, currency, finalisePayment }, ref ) => {

    const { isTabbyAvailable } = useContext(CartContext);
    
    if(isTabbyAvailable && window.TabbyCard) {
        new TabbyCard({
            selector: '#tabby-card-checkout',
            currency,
            lang: document.documentElement.lang,
            price: amount,
            size: 'wide',
            theme: 'default',
            header: false
        });
    }

    useImperativeHandle(ref, () => ({
        completePurchase: async () => {
            const payload = {
                payment: {
                    method: AppConstants.PAYMENT_METHOD_TABBY,
                },
            };
            if (finalisePayment) await finalisePayment(payload);
        },
    }));

    return (
        <div id='tabby-card-checkout'></div>
    )
})

export default Tabby;