/* eslint-disable */
import*as e from"/scripts/aem.js";var t,a,n,o,r,i={2838:(e,t,a)=>{a.a(e,(async(e,n)=>{try{a.d(t,{A:()=>z});var o=a(6965);const e="hello-member/carts/mine/bonusVouchers",r="hello-member/carts/mine/memberOffers",i="guest-carts/{{CART_ID}}/estimate-shipping-methods",c="carts/mine/estimate-shipping-methods",_="checkoutcomupapi/getTokenList",s="guest-carts/{{CART_ID}}/getCart",d="carts/mine/getCart",l="deliverymatrix/address-locations/search",A="hello-member/customers/coupons",E="carts/mine/associate-cart",u="carts/mine/tamara-payment-availability",T="guestcarts/{{CART_ID}}/tamara-payment-availability",m="tamara/config",I="verifyotp/identifierNo/{{identifierNo}}/otp/{{otp}}/type/link",R="customers/mine/set-loyalty-card",p="apc/set-loyalty-card",w="customers/apc-search/{{searchedType}}/{{inputValue}}",h="apc/{{identifierNo}}/simulate/sales",O="apc/guest/simulate/sales",P="guest/apc-points-balance/identifierNo/{{identifierNo}}",f="sendotp/identifierNo/{{identifierNo}}/type/link",C="apc/{{identifierNo}}/redeem-points",S="guest/{{identifierNo}}/redeem-points",y="customers/apc-points-balance/{{customerId}}",U="customers/apcCustomerData/{{customerId}}",g="customers/apc-status-update",N="customers",b="integration/customer/token",D=await(0,o.EP)("cart_shipping_address"),v=await(0,o.EP)("cart_extension_attributes"),M=await(0,o.EP)("cart_items"),L=await(0,o.EP)("cart_prices"),Y=await(0,o.EP)("cart_payment_methods"),G=await(0,o.EP)("cart_extension_attribute_mobile_number"),B=`\n    {\n        id\n        total_quantity\n        ${v}\n        ${M}\n        ${L}\n        ${Y}\n    }\n`,k=await(0,o.EP)("tabby_user"),$=await(0,o.EP)("customer_order"),H=await(0,o.EP)("product_details"),x=await(0,o.EP)("checkoutcom_config"),j=await(0,o.EP)("digital_cart_extension_attribute"),K=`\n    {\n        id\n        total_quantity\n        ${j}\n        ${Y}\n    }\n`,V=await(0,o.EP)("tamara_availability"),F=await(0,o.EP)("tabby_config"),Q=`query ( $cartId: String ) {\n    Commerce_TabbyConfig (input: {cartId: $cartId}){\n      ${k}\n    }\n}`,q=`query {\n    Commerce_TabbyConfig {\n        ${k}\n    }\n}`,W=await(0,o.EP)("cart_promo_labels"),z={API_URI_MEMBER_BONUS_VOUCHERS:e,API_URI_MEMBER_OFFERS:r,API_URI_GUESTS_ESTIMATE_SHIPPING_METHODS:i,API_URI_LOGGED_IN_ESTIMATE_SHIPPING_METHODS:c,API_URI_GET_TOKEN_LIST:_,API_URI_GUESTS_GET_CART:s,API_URI_LOGGED_IN_GET_CART:d,API_URI_ADDRESS_LOCATIONS_SEARCH:l,API_URI_CUSTOMER_COUPONS:A,API_URI_ASSOCIATE_CARTS:E,API_URI_TAMARA_AVAILABILITY_CUSTOMER:u,API_URI_TAMARA_AVAILABILITY_GUEST:T,API_URI_GET_TAMARA_CONFIG:m,API_URI_VERIFY_OTP_AURA:I,API_URI_SET_LOYALTY_AURA:R,API_URI_GET_ENROLLED_AURA:w,API_URI_SIMULATE_SALES_AURA:h,API_URI_APC_PTS_BALANCE_AURA:P,API_URI_GET_REDEEM_PTS_AURA:f,API_URI_REMOVE_REDEEM_PTS_AURA:C,API_URI_REMOVE_REDEEM_PTS_AURA_GUEST:S,API_URI_GUEST_CART_SIMILATE_SALES_AURA:O,API_URI_APC_CUSTOMER_BALANCE_POINTS:y,API_URI_APC_CUSTOMER_AURA_DATA:U,API_URI_REGISTER_CUSTOMER:N,API_URI_LOGIN_CUSTOMER:b,API_URI_APC_STATUS_UPDATE:g,API_URI_SET_LOYALTY_AURA_GUEST:p,CART_QUERY__SHIPPING_ADDRESSES:D,CART_QUERY__EXTENSION_ATTRIBUTE:v,CART_QUERY__ITEMS:M,CART_QUERY__PRICES:L,CART_QUERY__PAYMENTS_METHODS:Y,CART_QUERY__MOBILE_NUMBER_VERIFIED:G,CART_QUERY:B,CHECKOUTCOM_CONFIG_QUERY:x,CUSTOMER_ORDER_QUERY:$,GET_PRODUCTS:H,DIGITAL_CART_QUERY:K,DIGITAL_QUERY__EXTENSION_ATTRIBUTE:j,TABBY_CONFIG:F,TABBY_USER:k,GUEST_TABBY_USER:Q,TAMARA_AVAILABILITY:V,TABBY_LOGGED_IN_USER:q,CART_QUERY__TOTALS:"\nextension_attributes {\n    totals{\n            base_grand_total\n            base_subtotal\n            subtotal_incl_tax\n            base_discount_amount\n            total_segments{\n                code\n                title\n                value\n            }\n            shipping_incl_tax\n            coupon_code\n            extension_attributes {\n                coupon_label\n                reward_points_balance\n                reward_currency_amount\n                base_reward_currency_amount\n                is_hm_applied_voucher_removed\n                is_all_items_excluded_for_adv_card\n                hps_redeemed_amount\n                hps_current_balance\n                hps_redemption_type\n            }\n            items {\n                extension_attributes {\n                    adv_card_applicable\n                }\n            }\n        }\n}",PROMOTION_DYNAMIC_LABEL:W};n()}catch(e){n(e)}}),1)},9164:(e,t,a)=>{a.a(e,(async(e,n)=>{try{a.d(t,{A:()=>c});var o=a(2554),r=a(2838),i=e([r]);r=(i.then?(await i)():i)[0];const c=e=>(0,o.Ay)(r.A.API_URI_ASSOCIATE_CARTS,!0,"POST",e);n()}catch(e){n(e)}}))},3496:(e,t,a)=>{a.a(e,(async(e,n)=>{try{a.d(t,{A:()=>c});var o=a(2554),r=a(2838),i=e([r]);r=(i.then?(await i)():i)[0];const c=async(e,t)=>{const a=`query ($encryptedData: String!) {\n  commerce_resumeCart(encrypted_key: $encryptedData) ${r.A.CART_QUERY}\n}`;try{return await(0,o.HA)(a,{encryptedData:e},!0,{"Alshaya-Channel":t,"Alshaya-Page-Identifier":"cart"})}catch(e){throw console.error("Error fetching customer orders:",e),e}};n()}catch(e){n(e)}}))},6077:(e,t,a)=>{a.a(e,(async(e,n)=>{try{a.d(t,{A:()=>A});var o=a(6540),r=a(8800),i=a(3496),c=a(220),_=a(9164),s=a(3275),d=e([i,_]);function l(){return(0,o.useEffect)((()=>{(async()=>{let e=await(0,r.Ct)("cart-url");e||(e="/cart");const t=`/${(0,r.mz)()}${e}`,a=new URLSearchParams(window.location.search),n=a.get("channel"),o=a.get("data");n&&o||(window.location.href=t);const s=await(0,i.A)(o,n);let d="";if(s?.response?.data){(0,c.o)()?(d=s?.response?.data?.commerce_resumeCart?.extension_attributes?.cart?.id,d&&await(0,_.A)({cartId:d}),window.location.href=t):(d=s?.response?.data?.commerce_resumeCart?.id,d?(window.dispatchEvent(new CustomEvent("react:setCartId",{detail:{cartId:d}})),setTimeout((()=>{window.location.href=t}),300)):window.location.href=t)}else window.location.href=t})()}),[]),o.createElement("div",{className:"loader_overlay"},o.createElement(s.A,null))}[i,_]=d.then?(await d)():d;const A=l;n()}catch(E){n(E)}}))},7913:(e,t,a)=>{a.a(e,(async(e,n)=>{try{a.d(t,{A:()=>_});var o=a(6540),r=a(5338),i=a(6077),c=e([i]);function _(e){(0,r.H)(e).render(o.createElement(i.A,null))}(i=(c.then?(await c)():c)[0]).A,n()}catch(s){n(s)}}))},3275:(e,t,a)=>{a.d(t,{A:()=>r});var n=a(6540),o=a(9364);const r=function(){const e=(0,n.useRef)(null);return(0,n.useEffect)((()=>{e.current&&(0,o.decorateIcons)(e.current)}),[]),n.createElement("div",{className:"loading-spinner",ref:e},n.createElement("span",{className:"icon icon-ic-loader"}))}},2554:(e,t,a)=>{a.d(t,{Ay:()=>s,HA:()=>d});var n=a(220),o=a(8800),r=a(7443),i=a(2768);const c="web";function _(){const e=window.location.href;return e.includes("/cart")?"cart":e.includes("/checkout")?"checkout":""}async function s(e,t=!1,a="GET",r=null,i="V1",_=!1,s){let d=null;try{const s={method:a,headers:{"Content-Type":"application/json",Store:await(0,o.Ct)("commerce-store-view-code"),"Alshaya-Channel":c}};if(t){const e=(0,n.o)();e&&(s.headers.Authorization=`Bearer ${e}`)}!r||"POST"!==a&&"PUT"!==a||(s.body=JSON.stringify(r));const l=await(0,o.Ct)("commerce-rest-endpoint"),A=await(0,o.Ct)("commerce-store-view-code"),E=await fetch(`${l}/${A}/${i}/${e}`,s);if(401===E.status){const e=`/${document.documentElement.lang||"en"}/cart`;return void window.dispatchEvent(new CustomEvent("react:logout",{detail:{redirectUrl:e}}))}d=_?{success:!!E.ok,status:E.status,message:E.statusText,data:await E.json()}:await E.json(),d.data?.message&&(d.message=d.data.message)}catch(e){console.error(e)}return{response:d}}async function d(e,t={},a=!1,s){let d=null;try{const l=(0,n.o)();let A={"Content-Type":"application/json",Store:await(0,o.Ct)("commerce-store-view-code"),"Alshaya-Channel":c,"Alshaya-Page-Identifier":_(),"Alshaya-Country-Code":await(0,o.Ct)("country-code"),"Alshaya-Brand":await(0,o.Ct)("brand"),"Alshaya-Market":await(0,o.Ct)("apimesh-market"),...l?{Authorization:`Bearer ${l}`}:{}};(0,r.j)()&&(A={...A,"Alshaya-Digital-Cart-Id":(0,r.j)()}),s&&(A={...A,...s});const E={method:"POST",headers:A,body:JSON.stringify({query:e,variables:t})},u=a?await(0,o.Ct)("cart-mesh-endpoint"):await(0,o.Ct)("commerce-endpoint"),T=await fetch(u,E);if(d=await T.json(),d?.errors?.[0]?.extensions?.category===i.A.GRAPHQL_AUTHORIZATION){const e=`/${document.documentElement.lang||"en"}/cart`;window.dispatchEvent(new CustomEvent("react:logout",{detail:{redirectUrl:e}}))}}catch(e){console.error(e)}return{response:d}}},2768:(e,t,a)=>{a.d(t,{A:()=>n});const n={GRAPHQL_AUTHORIZATION:"graphql-authorization",PROGRESS_BAR_STEP_CART:1,PROGRESS_BAR_STEP_LOGIN:2,PROGRESS_BAR_STEP_CHECKOUT:3,PROGRESS_BAR_STEP_CONFIRMATION:4,PAYMENT_METHOD_CODE_COD:"cashondelivery",PAYMENT_METHOD_CODE_CC:"checkout_com_upapi",REDEEM_PAYMENT_METHOD_CODE:"aura_payment",BALANCE_PAYMENT_METHOD_CODE:"balance_payable",GRAND_TOTAL_METHOD_CODE:"grand_total",PAYMENT_METHOD_CODE_APPLEPAY:"checkout_com_upapi_applepay",PAYMENT_METHOD_CODE_TAMARA:"tamara",PAYMENT_METHOD_APPLEPAY_TYPE:"applepay",PAYMENT_METHOD_TABBY:"tabby",PAYMENT_METHOD_CODE_FAWRY:"checkout_com_upapi_fawry",CHECKOUT_COMMERCE_CART_CACHE:"COMMERCE_CART_CACHE_",PAYMENT_METHOD_M2_VENIA_BROWSER_PERSISTENCE__CARTID:"M2_VENIA_BROWSER_PERSISTENCE__cartId",PAYMENT_EGIFT_CARD_GUEST:"guest",PAYMENT_EGIFT_CARD_linked:"linked",hps_payment_method:"hps_payment",LOYALTY_HM_TYPE:"hello_member",LOYALTY_AURA:"aura",GIFT_CARD_TOPUP:"giftcard_topup",LOCAL_STORAGE_KEY_DIGITAL_CART_ID:"digital-cart-id",GOVERNATE_ATTRIBUTE:"governate",KUWAIT_MARKET:"KW",SHIPPING_METHODS:{CLICK_AND_COLLECT:"click_and_collect",ALSHAYA_DELIVERY:"alshayadelivery"},OOS_TEXT:"out of stock",PRODUCT_OOS_ERROR:"OUT_OF_STOCK",PRODUCT_TYPE_SIMPLE:"commerce_SimpleProduct",BRAND_NAME_BBW:"BBW",PROMOTION_DYNAMIC_LABEL_CONTEXT:"web",APC_LINK_STATUSES:{NOT_LINKED_DATA_PRESENT:1,LINKED_VERIFIED:2,LINKED_NOT_VERIFIED:3,NOT_LINKED_DATA_NOT_PRESENT:4}}},7443:(e,t,a)=>{a.d(t,{j:()=>o});a(9364),a(8800);var n=a(2768);const o=()=>{if(window.location.pathname?.includes("/checkout")){if(sessionStorage.getItem(n.A.LOCAL_STORAGE_KEY_DIGITAL_CART_ID))return sessionStorage.getItem(n.A.LOCAL_STORAGE_KEY_DIGITAL_CART_ID)}else sessionStorage.removeItem(n.A.LOCAL_STORAGE_KEY_DIGITAL_CART_ID)}},220:(e,t,a)=>{a.d(t,{o:()=>n});a(8800);function n(){return function(e){let t;return document.cookie.split(";").forEach((a=>{const[n,o]=a.trim().split("=");n===e&&(t=decodeURIComponent(o))})),t}("auth_user_token")??""}},8800:(e,t,a)=>{a.d(t,{Ct:()=>E,mz:()=>_});const n="prod",o="stage",r="preview",i=[n,"aem","dev",r],c=[o,r];function _(){return function(){if("about:srcdoc"!==window.location.href)return window.location.href;const{location:e}=window.parent,t=new URLSearchParams(e.search);return`${e.origin}${t.get("path")}`}().includes("/ar/")?"ar":document.documentElement.lang||"en"}window.configsPromises={};function s(e,t){const a=function(){const{location:e}=window;return"about:srcdoc"===e.href?window.parent.location.origin:e.origin}(),n=t?`${t}/`:"";let o="configs.json";c.includes(e)&&(o=`configs-${e}.json`);return new URL(`${a}/${n}${o}`)}const d=(e,t)=>{const a=t?`config:${t}`:"config";return window.sessionStorage.getItem(a)},l=(e,t,a)=>{const n=a?`config:${a}`:"config";return window.sessionStorage.setItem(n,e)},A=async()=>{const e=_(),t=(()=>{const{href:e}=window.location;let t=n;e.includes(".hlx.page")||e.includes(".aem.page")?t="aem":e.includes("-stage.factory.alshayauat.com")?t=o:e.includes("localhost")?t="dev":e.includes("-eds.factory.alshayauat.com")&&(t=r);const a=window.sessionStorage.getItem("environment");return a&&i.includes(a)&&t!==n?a:t})();let a=d(),c=d(0,e);if(!a||!c){const n=fetch(s(t)),o=fetch(s(t,e));try{const t=await Promise.all([n,o]);[a,c]=await Promise.all(t.map((e=>e.text()))),l(a),l(c,0,e)}catch(e){console.error("no config loaded",e)}}const A=JSON.parse(a);if(c){JSON.parse(c).data.forEach((e=>{const t=A.data.find((t=>t.key===e.key));t?t.value=e.value:A.data.push(e)}))}return A},E=async e=>{const t=n;window.configsPromises?.[t]||(window.configsPromises[t]=A());const a=(await window.configsPromises[t]).data;return a.find((t=>t.key===e))?.value}},6965:(e,t,a)=>{a.d(t,{EP:()=>_});const n="prod",o=[n,"stage","dev"];window.payloadPromises={};function r(){const e=window.location.href;return e.includes("/cart")?"cart":e.includes("/checkout")?"checkout":e.includes("/confirmation")?"confirmation":""}function i(){const e=function(){const{location:e}=window;return"about:srcdoc"===e.href?window.parent.location.origin:e.origin}(),t=r();return new URL(`${e}/${t}-payloads.json`)}const c=async()=>{(()=>{const{href:e}=window.location;let t="prod";(e.includes(".hlx.page")||e.includes(".aem.page"))&&(t="stage"),e.includes("localhost")&&(t="dev"),e.includes("eds.factory.alshayauat.com")&&(t="preview");const a=window.sessionStorage.getItem("environment");a&&o.includes(a)})();let e=(()=>{const e=r(),t=e?`payload:${e}`:"payload";return window.sessionStorage.getItem(t)})();if(!e){const t=fetch(i());try{const a=await Promise.all([t]);[e]=await Promise.all(a.map((e=>e.text()))),((e,t)=>{const a=r(),n=a?`payload:${a}`:"payload";window.sessionStorage.setItem(n,t)})(0,e)}catch(e){console.error("no payload config loaded",e)}}return JSON.parse(e)},_=async e=>{const t=n;window.payloadPromises?.[t]||(window.payloadPromises[t]=c());const a=(await window.payloadPromises[t]).data;return a.find((t=>t.key===e))?.value}},9364:(t,a,n)=>{t.exports=(e=>{var t={};return n.d(t,e),t})({decorateIcons:()=>e.decorateIcons})}},c={};function _(e){var t=c[e];if(void 0!==t)return t.exports;var a=c[e]={exports:{}};return i[e].call(a.exports,a,a.exports,_),a.exports}_.m=i,t="function"==typeof Symbol?Symbol("webpack queues"):"__webpack_queues__",a="function"==typeof Symbol?Symbol("webpack exports"):"__webpack_exports__",n="function"==typeof Symbol?Symbol("webpack error"):"__webpack_error__",o=e=>{e&&e.d<1&&(e.d=1,e.forEach((e=>e.r--)),e.forEach((e=>e.r--?e.r++:e())))},_.a=(e,r,i)=>{var c;i&&((c=[]).d=-1);var _,s,d,l=new Set,A=e.exports,E=new Promise(((e,t)=>{d=t,s=e}));E[a]=A,E[t]=e=>(c&&e(c),l.forEach(e),E.catch((e=>{}))),e.exports=E,r((e=>{var r;_=(e=>e.map((e=>{if(null!==e&&"object"==typeof e){if(e[t])return e;if(e.then){var r=[];r.d=0,e.then((e=>{i[a]=e,o(r)}),(e=>{i[n]=e,o(r)}));var i={};return i[t]=e=>e(r),i}}var c={};return c[t]=e=>{},c[a]=e,c})))(e);var i=()=>_.map((e=>{if(e[n])throw e[n];return e[a]})),s=new Promise((e=>{(r=()=>e(i)).r=0;var a=e=>e!==c&&!l.has(e)&&(l.add(e),e&&!e.d&&(r.r++,e.push(r)));_.map((e=>e[t](a)))}));return r.r?s:i()}),(e=>(e?d(E[n]=e):s(A),o(c)))),c&&c.d<0&&(c.d=0)},r=[],_.O=(e,t,a,n)=>{if(!t){var o=1/0;for(d=0;d<r.length;d++){for(var[t,a,n]=r[d],i=!0,c=0;c<t.length;c++)(!1&n||o>=n)&&Object.keys(_.O).every((e=>_.O[e](t[c])))?t.splice(c--,1):(i=!1,n<o&&(o=n));if(i){r.splice(d--,1);var s=a();void 0!==s&&(e=s)}}return e}n=n||0;for(var d=r.length;d>0&&r[d-1][2]>n;d--)r[d]=r[d-1];r[d]=[t,a,n]},_.d=(e,t)=>{for(var a in t)_.o(t,a)&&!_.o(e,a)&&Object.defineProperty(e,a,{enumerable:!0,get:t[a]})},_.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),_.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),_.j="shared-cart",(()=>{var e={"shared-cart":0};_.O.j=t=>0===e[t];var t=(t,a)=>{var n,o,[r,i,c]=a,s=0;if(r.some((t=>0!==e[t]))){for(n in i)_.o(i,n)&&(_.m[n]=i[n]);if(c)var d=c(_)}for(t&&t(a);s<r.length;s++)o=r[s],_.o(e,o)&&e[o]&&e[o][0](),e[o]=0;return _.O(d)},a=self.webpackChunk_adobe_aem_boilerplate=self.webpackChunk_adobe_aem_boilerplate||[];a.forEach(t.bind(null,0)),a.push=t.bind(null,a.push.bind(a))})();var s=_.O(void 0,["vendor"],(()=>_(7913)));s=_.O(s);var d=(s=await s).A;export{d as default};