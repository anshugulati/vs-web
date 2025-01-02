import {
  updateBannerTextConfigs, getInlineStyle, scheduleBannerFromMetaConfig, initSettingsPanel,
  sidekickImageSettings,
} from '../../scripts/banner-utils/banner-utils.js';
import { loadCSS } from '../../scripts/aem.js';
import { getBrandPath } from '../../scripts/scripts.js';

export default async function decorate(block) {
  if (await scheduleBannerFromMetaConfig(block)) {
    const bannerWrapper = block.closest('.collection-banner-wrapper');
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    const [backgrounds, content, styleConfigurations] = block.querySelectorAll(':scope div > div');
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
      <div class="collectioncontent-wrapper">
        ${content.outerHTML}
      </div>
      ${styleConfigurations?.outerHTML || ''}
      ${isImageBanner ? `
        <div class='image-container'>
        ${ImageContainer?.innerHTML}
        </div>` : ''}    
    `;

    block.innerHTML = bannerBlock;
    block.classList.add('active');

    if (styleConfigurations) {
      block.style.cssText = getInlineStyle(styleConfigurations); // add inline style to block
    }

    if (bannerWrapper) {
      await updateBannerTextConfigs(bannerWrapper, true, 'collection');
    }

    window.addEventListener('lazy-loaded', async () => {
      const parent = block.closest('.section');
      const collectionblocks = Array.from(parent.children);
      const settingsPanel = block.querySelector('settings-panel');
      collectionblocks.slice(1).forEach((collection) => {
        block.insertBefore(collection, settingsPanel);
      });

      // include tools options for block configurations only inside sidekick library
      if (isSidekickLibrary) {
        await initSettingsPanel(block);
        await loadCSS(`/blocks/collection-banner/${getBrandPath()}sidekick-helper.css`);
        const videoLink = parent.querySelector('.video-wrapper .sidekickVideo');
        let isVideo = false;
        if (videoLink) {
          block.querySelector('.image-wrapper').appendChild(videoLink);
          isVideo = true;
        }
        await sidekickImageSettings(block, isVideo);
      }
    });
  }
}
