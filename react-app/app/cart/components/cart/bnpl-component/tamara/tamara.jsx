import React, { useContext, useEffect, useState } from 'react'
import { getConfigValue, getLanguageAttr } from '../../../../../../../scripts/configs';
import CartContext from '../../../../../../context/cart-context';

const TamaraComponent = () => {
    const { cart } = useContext(CartContext)
    const totalPrice = cart?.data?.extension_attributes?.totals?.base_grand_total ?? 0;
    const [countryCode, setCountryCode] = useState(null)
    useEffect(() => {
        const renderTamaraUI = async () => {
            const tamaraAPIKey = await getConfigValue('bnpl-tamara-api-key');
            const tamaraURL = await getConfigValue('bnpl-tamara-url')
            const country = await getConfigValue('country-code');
            const currency = await getConfigValue('currency');
            setCountryCode(country)
            window.tamaraWidgetConfig = {
                lang: getLanguageAttr(),
                country: country,
                publicKey: tamaraAPIKey,
                currency
            }
            var tamara_script = document.createElement('script');
            tamara_script.src = tamaraURL;
            document.body.appendChild(tamara_script);
        }
        renderTamaraUI()
    }, [])
    return (
        <div className="tamara">
            <tamara-widget
                type="tamara-summary"
                class="tamara-product-widget"
                id='tamara-widget-product'
                inline-type="5"
                amount={totalPrice}
                lang={getLanguageAttr()}
                country={countryCode}
            />
        </div>
    )
}

export default TamaraComponent