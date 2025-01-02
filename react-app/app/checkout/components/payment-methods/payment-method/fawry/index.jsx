import React, { forwardRef, useContext, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import AppConstants from '../../../../../../utils/app.constants';
import './fawry.css';
import CartContext from '../../../../../../context/cart-context';

const FawryPayment = forwardRef(({ finalisePayment, method }, ref) => {
    const { cart } = useContext(CartContext);
    const { address } = cart.data.extension_attributes.cart.extension_attributes.shipping_assignments?.[0].shipping;
    const [subtitle, email, mobileNumber, infoText] = method.body;

    useImperativeHandle(ref, () => ({
        completePurchase: async () => {
            const payload = {
                payment: {
                    method: AppConstants.PAYMENT_METHOD_CODE_FAWRY,
                },
            };
            if (finalisePayment) await finalisePayment(payload);
        },
    }));
    return (
        <div className='payment-method-fawry-container'>
            <div className='payment-method-fawry-subtitle' dangerouslySetInnerHTML={{ __html: subtitle.innerHTML }} />
            <div className='payment-method-fawry-elements'>
                <label for="fawry-email" dangerouslySetInnerHTML={{ __html: email.innerHTML }} />
                <input type="email" id='fawry-email' value={address.email} disabled />
            </div>
            <div className='payment-method-fawry-elements'>
                <label for="fawry-mobile" dangerouslySetInnerHTML={{ __html: mobileNumber.innerHTML }} />
                <input type="mobile" id='fawry-mobile' value={address.telephone} disabled />
            </div>
            <div className='payment-method-fawry-info-text' dangerouslySetInnerHTML={{ __html: infoText.innerHTML }} />
        </div>
    );
});

export default FawryPayment;
