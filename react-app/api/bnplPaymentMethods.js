import React, { useCallback, useContext, useEffect } from 'react'
import { getConfigValue } from '../../scripts/configs'
import getRestApiClient from '../utils/api-client'
import CartContext from '../context/cart-context';

const useGetBNPLPaymentMethods = async () => {
    const {
        isLoggedIn, cartId, setCartBnplPayments, isBNPLAllowed
    } = useContext(CartContext);

    const getBnplPayments = useCallback(async () => {
        const apiEndpoints = 'checkout/payment-types'
        const countryCode = await getConfigValue('country-code')
        const bnplOptionsConfig = await getConfigValue('cart-bnpl-options')
        const bnplOptions = bnplOptionsConfig?.split(',')?.map((option) => option?.trim());
        const isTamaraActive = bnplOptions?.find((item) => item?.toLowerCase() === 'tamara')
        if (isTamaraActive) {
            const response = await getRestApiClient(apiEndpoints, isLoggedIn, 'POST', { data: { country: countryCode } }, 'V1')
            setCartBnplPayments(response?.response)
        }
    }, [cartId]);

    useEffect(() => {
        if (cartId) {
            getBnplPayments()
        }
    }, [cartId])
}

export default useGetBNPLPaymentMethods