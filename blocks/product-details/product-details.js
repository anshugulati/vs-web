import {
  formatPDPUrlAttributes,
  isDynamicPage,
  isPrerendering,
  getProductAssetsData,
  showCommerceErrorPage,
} from '../../scripts/scripts.js';
import { loadProduct } from '../../scripts/commerce.js';
import { extractQueryParamsToSession } from '../../scripts/analytics/google-data-layer.js';
import { getConfigValue } from '../../scripts/configs.js';

export default async function decorate(block) {
  // set name for ld+json if it's not dynamic page
  if (!isDynamicPage()) {
    const ldJson = document.head.querySelector('script[type="application/ld+json"]');
    if (ldJson) {
      try {
        const jsonData = JSON.parse(ldJson.innerHTML);
        if (jsonData['@type'] === 'Product') {
          ldJson.dataset.name = 'product';
        }
      } catch (e) {
        console.error('Error parsing ld+json', e);
      }
    }
  }

  window.product = (window.product || loadProduct());
  // eslint-disable-next-line no-unused-vars
  const [_, product, productDL] = await window.product;
  // productDL is used to obtain product values in English for DL for non-English websites

  if (product) {
    // Following extraction is done one time to avoid the same in multiple datalayer events
    const gtm = productDL?.attributes?.find((el) => el.name === 'gtm_attributes')?.value;
    productDL.gtm = gtm ? JSON.parse(gtm) : null;
    extractQueryParamsToSession(productDL.gtm?.id);
    let imagesJson;
    if (await getConfigValue('product-fetch-direct-attributes')) {
      imagesJson = getProductAssetsData('assets_pdp', product);
    } else {
      imagesJson = product.attributes.find((a) => a.name === 'assets_pdp');
    }
    const firstImage = JSON.parse(imagesJson.value)?.[0];

    const prerenderHtml = `
    <div class="prerender-container">
        <img width="960" height="1191" src="${formatPDPUrlAttributes(firstImage.url)}" class="prerender-img">
    </div>
  `;

    block.innerHTML = prerenderHtml;

    await new Promise((res) => {
      block.querySelector('.prerender-img')
        .addEventListener('load', () => {
          res();
        });
      block.querySelector('.prerender-img')
        .addEventListener('error', () => {
          res();
        });
    });

    window.pdpLoadedPromise = new Promise((res) => {
      if (isPrerendering()) {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            import('./product-details-render.js').then((module) => module.default(block))
              .then(res);
          }
        }, { once: true });
      } else {
        import('./product-details-render.js').then((module) => module.default(block))
          .then(res);
      }
    });
  } else {
    showCommerceErrorPage();
  }
}
