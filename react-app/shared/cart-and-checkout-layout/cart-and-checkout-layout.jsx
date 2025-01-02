import React, { useContext } from "react";
import ProgressBar from "../progress-bar/progress-bar";
import CartContext from "../../context/cart-context";

function CartAndCheckoutLayout({ showProgressBar = true, shouldDisableAllSteps = false, children }) {
    const { cartId, cart } = useContext(CartContext);
    const backToTopEle = document.querySelector('.scroll-to-top');
    if (backToTopEle) {
        backToTopEle.remove();
    }
    return <>
        {showProgressBar ? <ProgressBar shouldDisableAllSteps={shouldDisableAllSteps} /> : null}
        {children}
    </>
}

export default CartAndCheckoutLayout;