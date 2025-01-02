import { decorateIcons } from '../../../scripts/aem.js';
import { getProductPromotionByRuleId, getFreeGiftProductImageBySku } from '../../../scripts/commerce.js';
import { getConfigValue } from '../../../scripts/configs.js';
import {
  loadFragment,
  createModalFromContent,
  openModal,
  getLanguageAttr,
} from '../../../scripts/scripts.js';

const MODALS = [
  {
    key: 'member-info',
    path: 'member-info',
    cls: ['pdp-modal'],
  },
  {
    key: 'online-returns',
    path: 'online-returns',
    cls: ['pdp-modal'],
  },
];

const MODALS_AURA = 'aura-member-info';
const isCLMDowntime = await getConfigValue('clm-downtime');

function isReturnable(ctx) {
  const { attributes } = ctx.data;
  const isReturnableAttribute = attributes.filter((attr) => attr.id === 'is_returnable')?.[0]?.value;
  return isReturnableAttribute === '1';
}

function sanitize(text) {
  return text?.toLowerCase().trim().replace(/[\s]+/g, '').replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function getPromotionRuleId(ctx) {
  const productPromotions = ctx.data.promotions || [];
  if (
    productPromotions.length === 1
    && !Object.prototype.hasOwnProperty.call(productPromotions?.[0], 'rule_id')
  ) {
    return null;
  }
  const elementsWithRuleId = productPromotions.filter((item) => Object.prototype.hasOwnProperty.call(item, 'rule_id'));
  if (elementsWithRuleId.length > 0) {
    const { rule_id: ruleId, label } = elementsWithRuleId[0];
    return { ruleId, label };
  }
  return null;
}

function getFreeGiftPromotion(ctx) {
  const freeGiftProductPromotions = ctx.data.freeGiftPromotions || [];
  let freeGiftMarketingSlotData = null;

  Object.keys(freeGiftProductPromotions).forEach((key) => {
    const freeGiftPromotionHavingRuleId = freeGiftProductPromotions[key];

    if (freeGiftPromotionHavingRuleId?.rule_id && !freeGiftMarketingSlotData) {
      const label = freeGiftPromotionHavingRuleId?.rule_label;
      const url = freeGiftPromotionHavingRuleId?.rule_web_url;
      const sku = freeGiftPromotionHavingRuleId?.gifts?.[0]?.sku || null;

      freeGiftMarketingSlotData = {
        rule_id: freeGiftPromotionHavingRuleId.rule_id,
        label,
        sku,
        url,
      };
    }
  });

  return freeGiftMarketingSlotData;
}

async function getFreeGiftImageOfSku(freeGiftProductSku) {
  let freeGiftImagePath = '';
  if (freeGiftProductSku) {
    const pdpDetailsWithImage = await getFreeGiftProductImageBySku(freeGiftProductSku);
    freeGiftImagePath = pdpDetailsWithImage?.[0]?.images?.[0]?.url;
  }
  return freeGiftImagePath;
}

function createFreeGiftMarketingSlot(
  marketParentBlock,
  freeGiftImage,
  freeGiftPromo,
  placeholders,
) {
  marketParentBlock.classList.add('marketing-parent-block');
  const marketingBlock = document.createElement('div');
  marketingBlock.classList.add('marketing-block');
  const marketingImg = document.createElement('div');
  marketingImg.classList.add('marketing-img');
  const img = document.createElement('img');
  img.src = freeGiftImage;
  marketingImg.appendChild(img);
  const marketingContent = document.createElement('div');
  marketingContent.classList.add('marketing-content');
  const h6 = document.createElement('h6');
  h6.textContent = freeGiftPromo?.label ? freeGiftPromo?.label : '';
  const button = document.createElement('a');
  button.href = freeGiftPromo?.url ? freeGiftPromo.url : '';
  button.classList.add('button', 'secondary');
  button.target = '_blank';
  button.textContent = placeholders.pdpMarketingSlotButtonLabel || 'Shop Now';
  marketingContent.appendChild(h6);
  if (button.href) {
    marketingContent.appendChild(button);
  }
  if (img.src) {
    marketingBlock.appendChild(marketingImg);
  }
  marketingBlock.appendChild(marketingContent);
  marketParentBlock.appendChild(marketingBlock);
  if (freeGiftPromo.url && document.querySelector('.marketing-parent-block')) {
    document.querySelector('.marketing-parent-block').addEventListener('click', () => {
      window.location.href = freeGiftPromo.url;
    });
  }
}

const websiteCode = await getConfigValue('commerce-website-code');
function createPdpMarketingSlot(
  ctx,
  pdpMarketingSlotEnabled,
  marketParentBlock,
  placeholders,
) {
  const promotionDataHavingRuleId = getPromotionRuleId(ctx);
  const pdpPromoRuleId = promotionDataHavingRuleId?.ruleId;
  const pdpPromoLabel = promotionDataHavingRuleId?.label;
  const freeGiftPromo = getFreeGiftPromotion(ctx);
  if (pdpMarketingSlotEnabled === 'true') {
    if (freeGiftPromo?.sku && pdpPromoRuleId) {
      getFreeGiftImageOfSku(freeGiftPromo.sku).then((freeGiftImage) => {
        createFreeGiftMarketingSlot(marketParentBlock, freeGiftImage, freeGiftPromo, placeholders);
      });
    } else if (!freeGiftPromo?.sku && pdpPromoRuleId) {
      getProductPromotionByRuleId(pdpPromoRuleId).then((promotionDetailsResponse) => {
        const lang = getLanguageAttr();
        const { data } = promotionDetailsResponse?.promotionsEnrichmentData || {};
        const promoData = data?.[0] || {};
        marketParentBlock.classList.add('marketing-parent-block');
        const marketingBlock = document.createElement('div');
        marketingBlock.classList.add('marketing-block');
        const marketingImg = document.createElement('div');
        marketingImg.classList.add('marketing-img');
        const img = document.createElement('img');
        img.src = promoData?.image_path ? promoData?.image_path : '';
        marketingImg.appendChild(img);
        const marketingContent = document.createElement('div');
        marketingContent.classList.add('marketing-content');
        const h6 = document.createElement('h6');
        const descriptionAttrLang = `description_${lang}`;
        if (promoData[descriptionAttrLang]) {
          const descriptionJson = JSON.parse(promoData[descriptionAttrLang]);
          h6.textContent = descriptionJson[websiteCode] || pdpPromoLabel;
        }
        const p = document.createElement('p');
        const tncAttrLang = `short_terms_and_conditions_${lang}`;
        if (promoData[tncAttrLang]) {
          const tncJson = JSON.parse(promoData[tncAttrLang]);
          p.textContent = tncJson[websiteCode];
        }
        const button = document.createElement('a');
        button.href = promoData?.url_key ? promoData?.url_key : '';
        button.classList.add('button', 'secondary');
        button.target = '_blank';
        button.textContent = placeholders.pdpMarketingSlotButtonLabel || 'Shop Now';
        marketingContent.appendChild(h6);
        marketingContent.appendChild(p);
        if (button.href) {
          marketingContent.appendChild(button);
        }
        if (img.src) {
          marketingBlock.appendChild(marketingImg);
        }
        marketingBlock.appendChild(marketingContent);
        marketParentBlock.appendChild(marketingBlock);
        document.querySelector('.marketing-parent-block').addEventListener('click', () => {
          window.location.href = promoData?.url_key;
        });
      });
    } else if (freeGiftPromo?.sku && !pdpPromoRuleId) {
      getFreeGiftImageOfSku(freeGiftPromo.sku).then((freeGiftImage) => {
        createFreeGiftMarketingSlot(marketParentBlock, freeGiftImage, freeGiftPromo, placeholders);
      });
    }
  }
}

export default async function productStatusSlot(ctx, _, placeholders) {
  const isReturnableProduct = isReturnable(ctx);

  let returnableText = placeholders.pdpFreeOnlineReturns || 'Free online returns within statutory period';
  const notReturnableText = placeholders.pdpNonReturnable || 'Not eligible for return';

  const currentBrand = await getConfigValue('brand-code') || 'HEN';
  const brandFiltered = ctx.data.attributes?.find((el) => el.id === 'main_brand_code')?.value;

  if (isReturnableProduct
    && brandFiltered
    && brandFiltered?.toUpperCase !== currentBrand?.toUpperCase()) {
    const brand = sanitize(brandFiltered);
    const isModal = MODALS.find((modal) => modal.key === 'online-returns');
    if (isModal && isModal.path !== undefined) {
      isModal.path = `${brand}-online-returns`;
    }
    const capitalizedBrand = brand.charAt(0).toUpperCase() + brand.slice(1);
    returnableText = placeholders[`pdp${capitalizedBrand}FreeOnlineReturns`] || placeholders.pdpFreeOnlineReturns;
  }

  const isAuraEnabled = await getConfigValue('aura-price-enabled');
  const productStatusSection = document.createElement('div');
  productStatusSection.classList.add('product-status-container');
  const memberEarnString = placeholders.pdpMemberEarn || 'Member earns {{points}} points';
  const memberEarn = memberEarnString.replace('{{points}}', Math.floor(ctx.data.prices?.final?.amount || 0));

  const auraEarnString = placeholders.pdpAuraEarn || 'Earn {{points}} points with Aura';
  const offlineString = placeholders.auraIsOffline || 'Aura is offline to refresh and enhance your experience and will be back soon.';

  if (isAuraEnabled && isAuraEnabled === 'true') {
    const auraData = localStorage.getItem('aura_common_data');
    const basePoints = Math.floor(ctx.data.prices?.final?.amount || 0);
    const auraHelloMemberMultiplier = await getConfigValue(
      'aura-hello-member-multiplier',
    );
    const auraStarMemberMultiplier = await getConfigValue(
      'aura-star-member-multiplier',
    );
    const auraVipMemberMultiplier = await getConfigValue(
      'aura-vip-member-multiplier',
    );

    let multiplier = parseFloat(auraHelloMemberMultiplier) || 1;
    if (auraData) {
      const parsedData = JSON.parse(auraData);
      const auraStatus = parsedData?.aura_Status;

      if (auraStatus === 'Tier2') {
        multiplier = parseFloat(auraStarMemberMultiplier) || 1.5;
      } else if (auraStatus === 'Tier3') {
        multiplier = parseFloat(auraVipMemberMultiplier) || 2;
      }
    }

    productStatusSection.innerHTML = (isCLMDowntime && isCLMDowntime === 'true') ? `
      <div class="aura-offline-container">
        <span class="icon icon-aura-icon"></span>
        <span class="aura-offline-text">${offlineString}<span>
      </div>
      <div class="is-returnable ${isReturnable ? 'returnable' : 'not-returnable'}">
        <span class="returnable-icon icon icon-delivery-return"></span>
        <span class="not-returnable-icon icon icon-info"></span>
        <span class="returnable-text">${isReturnableProduct ? returnableText : notReturnableText}<span>
      </div>`
      : `<div class="aura-earnpoints">
        <span class="icon icon-aura-icon"></span>
        <span class="aura-points-text"><span>
      </div>
      <div class="is-returnable ${isReturnable ? 'returnable' : 'not-returnable'}">
        <span class="returnable-icon icon icon-delivery-return"></span>
        <span class="not-returnable-icon icon icon-info"></span>
        <span class="returnable-text">${isReturnableProduct ? returnableText : notReturnableText}<span>
      </div>`;
    import('../../../scripts/aura/api.js').then(({ getCashbackAccrualRatio }) => {
      getCashbackAccrualRatio().then(async (accrualRatio) => {
        const currency = await getConfigValue('currency') || 'AED';
        const conversionRatio = accrualRatio?.items?.filter(
          (item) => item.code === currency,
        )[0]?.value;
        const calculatedPoints = Math.floor(basePoints * parseFloat(conversionRatio) * multiplier);
        const auraEarnStringUpdated = auraEarnString.replace('{{points}}', calculatedPoints);
        const auraDiv = productStatusSection?.querySelector('.aura-points-text');
        if (auraDiv) {
          auraDiv.textContent = auraEarnStringUpdated;
        }
      });
    });
  } else {
    let productStatusHtml = '';
    const hideMembership = (await getConfigValue('pdp-hide-membership')) === 'true';
    if (!hideMembership) {
      productStatusHtml += `
        <div>
          <span class="icon icon-logo"></span>
          <span class="member-points-text">${memberEarn}<span>
        </div>
      `;
      MODALS.push({
        key: 'member-info',
        path: 'member-info',
      });
    }
    productStatusHtml += `
      <div class="is-returnable ${isReturnable ? 'returnable' : 'not-returnable'}">
        <span class="returnable-icon icon icon-delivery-return"></span>
        <span class="not-returnable-icon icon icon-info"></span>
        <span class="returnable-text">${isReturnableProduct ? returnableText : notReturnableText}<span>
      </div>
    `;
    MODALS.push({
      key: 'online-returns',
      path: 'online-returns',
    });
    productStatusSection.innerHTML = productStatusHtml;
  }
  decorateIcons(productStatusSection);

  const returnableElement = productStatusSection.querySelector('.is-returnable');
  const returnableTextElement = returnableElement.querySelector('.returnable-text');

  const memberPointsText = productStatusSection.querySelector(
    '.member-points-text',
  );
  const auraPointsText = productStatusSection.querySelector('.aura-points-text');

  // Add read more links
  productStatusSection.querySelectorAll(':scope > div').forEach((row, idx) => {
    let dialogId = `${MODALS[idx].key}-dialog`;
    if (isAuraEnabled && isAuraEnabled === 'true' && idx === 0) {
      dialogId = `${MODALS_AURA}-dialog`;
    }
    const readMoreLink = document.createElement('a');
    readMoreLink.textContent = placeholders.readMoreLabel || 'Read more';
    readMoreLink.href = '#';
    readMoreLink.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(dialogId);
    });
    const linkColumn = document.createElement('div');
    linkColumn.appendChild(readMoreLink);
    row.appendChild(linkColumn);
  });

  const pdpMarketingSlotEnabled = await getConfigValue('pdp-marketing-slot-enable');
  ctx.replaceWith(productStatusSection);
  const marketParentBlock = document.createElement('div');
  if (pdpMarketingSlotEnabled === 'true') {
    ctx.prependChild(marketParentBlock);
  }

  createPdpMarketingSlot(
    ctx,
    pdpMarketingSlotEnabled,
    marketParentBlock,
    placeholders,
  );

  window.addEventListener('delayed-loaded', () => {
    MODALS.forEach((modalObj, idx) => {
      let modalPath = modalObj.path;
      let modalKey = modalObj.key;
      let modalCls = modalObj.cls;
      if (isAuraEnabled && isAuraEnabled === 'true' && idx === 0) {
        modalPath = MODALS_AURA;
        modalKey = MODALS_AURA;
        modalCls = ['pdp-aura-modal', 'close-transition'];
      }
      loadFragment(
        `/${document.documentElement.lang}/fragments/pdp/${modalPath}`,
      ).then((fragment) => {
        const [titleDiv, modalContent] = [...fragment.querySelectorAll(':scope > div')];
        createModalFromContent(
          `${modalKey}-dialog`,
          titleDiv.textContent,
          modalContent.outerHTML,
          modalCls,
        );
      });
    });
  });

  ctx.onChange(async (next) => {
    if (isAuraEnabled && isAuraEnabled === 'true') {
      if (auraPointsText) {
        auraPointsText.textContent = auraEarnString;
      }
    } else {
      memberPointsText.textContent = memberEarnString.replace('{{points}}', Math.floor(next.data.prices?.final?.amount || 0));
    }
    const isReturnableFlag = isReturnable(next);

    if (isReturnableFlag) {
      returnableTextElement.textContent = returnableText;
      returnableElement.classList.remove('not-returnable');
      returnableElement.classList.add('returnable');
    } else {
      returnableTextElement.textContent = notReturnableText;
      returnableElement.classList.remove('returnable');
      returnableElement.classList.add('not-returnable');
    }
  });
}
