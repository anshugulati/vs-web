import React, {
    useState, useEffect, useContext
  } from 'react';
  import CartContext from '../../../context/cart-context';
import Icon from '../../../library/icon/icon';

function ShowErrorToast(){
    const {toastErrorMessage } = useContext(CartContext);
    return (
        <div className='error-message-toast'>
        <span><Icon className='error-icon-info' name="error-message"/></span>
        <span>{toastErrorMessage}</span>
        </div>
    )
  }
  export default ShowErrorToast;