import React, {useContext, useEffect, useState} from 'react';
import ProductSummaryCardGql from './product-summary-card-graphql.jsx';
import CartContext from '../../../context/cart-context.jsx';
import {getPromoDynamicLabels} from '../../../api/getPromoDynamicLabels.js';
import AppConstants from "../../../utils/app.constants";

function ItemShoppingList() {
    const {cart, shouldEnableProductCardV2,shouldEnableDynamicPromoLabels} = useContext(CartContext);
    const [dynamicPromoLabels, setDynamicPromoLabels] = useState([]);

    const items = cart?.data?.items?.sort((a, b) => b.id - a.id);

    if(shouldEnableDynamicPromoLabels) {
        useEffect(() => {
            async function getPromoLabels() {
                const result = await getPromoDynamicLabels(cart);
                setDynamicPromoLabels(result)
            }

            getPromoLabels();
        }, [cart]);
    }

    return (
        <div className={`cart__shopping-list__items ${shouldEnableProductCardV2 ? 'cart__product-card-v2' : ''}`}>
            {
                items?.map((product, index) => {
                        const isSimpleProduct = product?.product?.__typename === AppConstants?.PRODUCT_TYPE_SIMPLE;
                        const productInfo = isSimpleProduct ? product?.product : product.product?.configured_variant;
                        let dynamicLabels = [];
                    if (shouldEnableDynamicPromoLabels) {
                        const promoLabels = dynamicPromoLabels?.products_labels?.filter(promo => promo.sku === productInfo?.sku && promo.labels);
                         dynamicLabels = promoLabels?.length ? promoLabels[0].labels : [];
                    }
                    return (
                        <ProductSummaryCardGql
                            key={`product-sku-${productInfo?.sku ?? index}`}
                            product={product}
                            currency={cart?.data?.prices?.grand_total?.currency}
                            dynamicPromoLabels={dynamicLabels}
                        />
                    );
                })
            }
        </div>
    );
}

export default ItemShoppingList;
