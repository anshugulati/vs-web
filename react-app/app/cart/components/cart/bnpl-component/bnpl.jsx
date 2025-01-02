import React, { useContext, useEffect, useState, } from 'react'
import './bnpl.css'
import CartContext from '../../../../../context/cart-context'
import TamaraComponent from './tamara/tamara';
import TabbyComponent from './tabby/tabby';
import Icon from '../../../../../library/icon/icon';
import { getConfigValue } from '../../../../../../scripts/configs';
import Tamara from '../../../../../utils/tamara-utils';
import TabbyUtils from '../../../../../utils/tabby-utils';
import Loader from '../../../../../shared/loader/loader';
import { hasValue } from '../../../../../utils/base-utils';
const BNPLComponent = () => {
    const { placeholders,
        bnplActiveOptions,
        isTabbyAvailable,
        setBnplActiveOptions,
        setIsAccordionOpen,
        cart,
        setIsTabbyAvailable,
        isLoggedIn,
        isAccordionOpen,
        cartBnplPayments,
        cartTamaraAvailable,
        setCartTamaraAvailable, isBNPLAllowed } = useContext(CartContext)
    const [loading, setLoading] = useState(false)
    const handleAccordion = () => {
        setIsAccordionOpen(!isAccordionOpen)
    }
    const { value } = cart?.data?.prices?.grand_total;
    const { surcharge } = cart?.data?.extension_attributes?.cart?.extension_attributes;
    useEffect(() => {
        const getConfigDatas = async () => {
            const bnplOptionsConfig = await getConfigValue('cart-bnpl-options')
            const isAccordionOpenFlag = await getConfigValue('cart-bnpl-accordion-expand')
            setIsAccordionOpen(isAccordionOpenFlag)

            //Checking from EDS whether the config file is having tamara key
            const checkAvailability = async () => {
                const bnplOptions = bnplOptionsConfig?.split(',')?.map((option) => option?.trim());
                const isTabbyActive = bnplOptions?.find((item) => item?.toLowerCase() === 'tabby')
                setBnplActiveOptions(bnplOptions)
                //Tabby Available is checked based on the api call.
                if (isTabbyActive) await TabbyUtils.isAvailable(cart, setIsTabbyAvailable, isLoggedIn)
                setLoading(false)
            };

            if (bnplOptionsConfig?.length) {
                setLoading(true)
                checkAvailability();
            }
        }
        getConfigDatas()
    }, [])


    //Tamara availability is checked based on the api call made in bnplPaymentMethods.js file
    useEffect(() => {
        const checkTamaraAvailability = async () => {
            const bnplOptionsConfig = await getConfigValue('cart-bnpl-options')
            const cartBnplInstallments = await getConfigValue('cart-bnpl-installments')
            const bnplOptions = bnplOptionsConfig?.split(',')?.map((option) => option?.trim());
            if (bnplOptions?.length) {
                const isTamaraActive = bnplOptions?.find((item) => item?.toLowerCase() === 'tamara')
                if (isTamaraActive && cartBnplInstallments) {
                    let total = value;
                    const suppliedInstallments = cartBnplPayments?.[0]?.supported_instalments?.find((item) => Number(item?.instalments) === Number(cartBnplInstallments))
                    if (suppliedInstallments) {
                        const maxTotal = Number(suppliedInstallments?.max_limit?.amount);
                        const minTotal = Number(suppliedInstallments?.min_limit?.amount)
                        if (hasValue(value) && hasValue(surcharge)) {
                            if (surcharge.is_applied)
                                total = value - surcharge.amount;
                        }
                        if (Number(total) >= minTotal && Number(total) <= maxTotal) {
                            return setCartTamaraAvailable(true)
                        }
                    }
                    return setCartTamaraAvailable(false)
                }
            }
        }
        checkTamaraAvailability()
    }, [value])
    return (
        //Rendering the bnpl accodrion based on the below logic
        isBNPLAllowed
            ?
            !loading ? bnplActiveOptions?.length && (isTabbyAvailable || cartTamaraAvailable) &&
                <div className='bnpl-container'>
                    <div className='bnpl-label-icon' onClick={() => handleAccordion()} >
                        <label className='bnpl-label'>
                            {placeholders.bnplPaymentLabel}
                        </label>
                        <Icon name={'chevron-down'} className={`${isAccordionOpen ? 'open' : 'close'}`} />
                    </div>
                    <div className={isAccordionOpen ? 'bnpl-display-accordion' : `bnpl-hide-accordion`}>
                        {isTabbyAvailable &&
                            <>
                                <hr className='bnpl-border-bottom' />
                                <TabbyComponent />
                            </>}
                        {cartTamaraAvailable &&
                            <>
                                <hr className='bnpl-border-bottom' />
                                <TamaraComponent />
                            </>}
                    </div>
                </div >
                : <div><Loader /></div> : <></>)
}

export default BNPLComponent