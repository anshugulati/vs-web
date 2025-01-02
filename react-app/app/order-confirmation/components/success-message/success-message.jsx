import React, { useContext } from "react";
import CartContext from "../../../../context/cart-context";

function SuccessMessage({ email }) {
    const { placeholders } = useContext(CartContext);

    return (
        <div className='order-details-version-two'>
            <div className='order-confirmation-message'>
                <span>{placeholders.orderConfirmationThanksMeaage}</span>
                <span>{placeholders.orderConfirmationEmailText} <span>{email}</span></span>
            </div>
        </div>
    );
}

export default SuccessMessage;