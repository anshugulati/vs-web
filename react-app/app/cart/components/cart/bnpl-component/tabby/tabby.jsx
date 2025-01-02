import React, { useContext, useEffect, useRef } from 'react'
import { getConfigValue, getLanguageAttr } from '../../../../../../../scripts/configs';
import { loadScriptHelper } from '../../../../../../utils/base-utils';
import CartContext from '../../../../../../context/cart-context';

const TabbyComponent = () => {
    const { cart } = useContext(CartContext)
    const grandTotal = cart?.data?.extension_attributes?.totals?.base_grand_total ?? 0;
    const tabbyRef = useRef(null)

    useEffect(() => {
        const renderTabbyUI = async () => {
            if (tabbyRef.current) {
                const tabbyApiKey = await getConfigValue('bnpl-tabby-api-key');
                const checkoutTabbyIntegration = await getConfigValue('checkout-tabby-integration');
                const checkoutTabbyPromo = await getConfigValue('checkout-tabby-promo');
                const currency = await getConfigValue('currency');
                //Loading scripts for tabby
                await Promise.all([
                    await loadScriptHelper(checkoutTabbyIntegration),
                    await loadScriptHelper(checkoutTabbyPromo)
                ].filter(Boolean));

                // eslint-disable-next-line no-undef
                window?.TabbyProductPageSnippetAlShaya?.({
                    selector: '#tabby-view',
                    currency,
                    price: grandTotal,
                    lang: getLanguageAttr(),
                    source: 'product',
                    api_key: tabbyApiKey,
                });
            }
        }
        renderTabbyUI()
    }, [tabbyRef.current, grandTotal])
    return (
        <div id={'tabby-view'} ref={tabbyRef}>

        </div>
    )
}

export default TabbyComponent