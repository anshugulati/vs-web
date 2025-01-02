/* eslint-disable linebreak-style */
import { createModalFromContent, openModal, getBrandPath } from '../../scripts/scripts.js';
import {
  updateBannerTextConfigs, getInlineStyle,
  scheduleBannerFromMetaConfig, initSettingsPanel, sidekickImageSettings,
} from '../../scripts/banner-utils/banner-utils.js';
import { loadCSS } from '../../scripts/aem.js';

export async function renderPromoDialog(blockData, promoHeader) {
  const PROMO_DIALOG_ID = 'promo-dialog';
  const promoOverlay = document.createElement('div');
  promoOverlay.innerHTML = blockData;
  await createModalFromContent(
    PROMO_DIALOG_ID,
    promoHeader?.innerHTML,
    promoOverlay.outerHTML,
    [PROMO_DIALOG_ID],
  );
}

/* decorate function */
export default async function decorate(block) {
  if (await scheduleBannerFromMetaConfig(block)) {
    const bannerWrapper = block.closest('.promo-banner-wrapper');
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    const [backgrounds, popup, styleConfigurations, content] = block.querySelectorAll(':scope div > div');

    const promoLink = popup.querySelector('p');
    const promoPreamble = popup.querySelector('h2');
    const promoHeader = popup.querySelector('h4');
    const promoContent = Array.from(popup.querySelectorAll('p')).slice(1);
    const popupContent = document.createElement('div');
    promoContent.forEach((contentEle) => {
      popupContent.appendChild(contentEle);
    });

    const [desktopBg, mobileBg] = backgrounds.querySelectorAll('picture');
    const [desktopBgLink, mobileBgLink] = backgrounds.querySelectorAll('a');
    const isImageBanner = backgrounds.querySelectorAll('picture').length === 2;
    desktopBg?.classList.add('desktop-bg');
    mobileBg?.classList.add('mobile-bg');
    desktopBgLink?.classList.add('desktop-bg-link');
    mobileBgLink?.classList.add('mobile-bg-link');

    const ImageContainer = document.createElement('div');
    ImageContainer.classList.add('image-container');
    if (isImageBanner) {
      ImageContainer.appendChild(desktopBg);
      ImageContainer.appendChild(mobileBg);
    }
    styleConfigurations?.classList.add('style-configurations');

    content.classList.add('banner-content');
    const bannerBlock = `
      ${isSidekickLibrary ? `
      <div class='image-wrapper'>
      ${desktopBgLink ? `<span class="desktop-bg-lbl">DesktopBG :</span> ${desktopBgLink?.outerHTML}` : ''}
      ${mobileBgLink ? `<span class="mobile-bg-lbl">MobileBG :</span> ${mobileBgLink?.outerHTML}` : ''}
      </div>` : ''}
       <div class='image-container'>
       ${isSidekickLibrary ? '' : `<a href='${desktopBgLink}' target='_blank'>`}
        ${ImageContainer?.innerHTML}
        ${isSidekickLibrary ? '' : '</a>'}
        </div>
        ${promoPreamble ? `<h2>${promoPreamble?.innerHTML || ''}</h2>` : ''}
        <p>
        <a class="promo-link" href="#">
        ${promoLink?.innerHTML || ''}
      </a> 
      </p>
      <div class="banner-buttons">
        ${content.innerHTML}
      </div>
      ${styleConfigurations?.outerHTML || ''}  
    `;

    block.innerHTML = bannerBlock;
    block.classList.add('active');

    if (styleConfigurations) {
      block.style.cssText = getInlineStyle(styleConfigurations);
    }

    if (promoLink && promoContent.length > 0) {
      block.querySelector('.promo-link').addEventListener('click', async (e) => {
        e.preventDefault();
        openModal('promo-dialog');
        block.closest('main').querySelector('.promo-dialog').style.cssText = getInlineStyle(styleConfigurations);
      });
      renderPromoDialog(popupContent.innerHTML, promoHeader);
    }

    if (bannerWrapper) {
      await updateBannerTextConfigs(bannerWrapper, true, 'bannerImage');
    }

    if (isSidekickLibrary) {
      await initSettingsPanel(block);
      if (isImageBanner || (desktopBgLink || mobileBgLink)) {
        await loadCSS(`/blocks/promo-banner/${getBrandPath()}sidekick-helper.css`);
        await sidekickImageSettings(block);
      }
    }
  }
}
