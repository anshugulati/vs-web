import React, { useContext, useEffect, useState } from "react";
import './tamara.css';
import { getConfigValue, getLanguageAttr } from "../../../../../../scripts/configs";
import CartContext from "../../../../../context/cart-context";
import { getPayable } from "../utilities/utils";
import { loadScriptHelper } from "../../../../../utils/base-utils";

const TamaraInfoWidget = ({onInfoWidgetClick}) => {
    const {cart} = useContext(CartContext);
    const [countryCode, setCountryCode] = useState('AE');
    useEffect(() => {
        (async () => {
            setCountryCode(await getConfigValue('country-code'));
            const infoWidgetUrl = await getConfigValue('tamara-info-widget-url');
            await loadScriptHelper(infoWidgetUrl, {"type": "module"});
            if (window.TamaraWidget) {
                window.TamaraWidget.render();
            }
        })();
    }, []);
    return (
        <div
            className="tamara-widget"
            data-lang={getLanguageAttr()}
            data-country-code={countryCode}
            data-payment-type="installment"
            data-inject-template={false}
            data-installment-available-amount={getPayable(cart)}
            onClick={onInfoWidgetClick}
        >
            <button
                className="payment-method-tamara__info"
                type="button"
                onClick={(e) => e.preventDefault()}
            >
                <span></span>
            </button>
        </div>
    )
}

export default TamaraInfoWidget;