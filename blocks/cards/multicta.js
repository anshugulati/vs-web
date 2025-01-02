import { loadCSS } from '../../scripts/aem.js';
import {
  updateBannerTextConfigs, getInlineStyle, scheduleBannerFromMetaConfig, initSettingsPanel,
} from '../../scripts/banner-utils/banner-utils.js';
import { getBrandPath } from '../../scripts/scripts.js';

export default async function decorateBanner(block) {
  const ul = block.querySelector('ul');
  [...ul.children].slice(0, -1).forEach((row) => {
    const link = row.querySelector('a');
    if (link) {
      const { href } = link;
      const wrapperLink = document.createElement('a');
      wrapperLink.href = href;
      link.remove();
      row.firstElementChild.lastElementChild.remove();
      wrapperLink.append(row.firstElementChild);
      row.append(wrapperLink);
    }
  });

  if (await scheduleBannerFromMetaConfig(block)) {
    await loadCSS(`/blocks/cards/${getBrandPath()}multi-cta.css`);
    const bannerWrapper = block.closest('.multictabanner');
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    const styleConfigurations = ul.querySelector('li:last-child');
    styleConfigurations?.classList.add('style-configurations');
    styleConfigurations.style.display = 'none';
    block.parentElement.previousElementSibling.classList.add('block-header');
    const bannerBlock = `
      <div class="mutlictacontent-wrapper">
        ${ul.outerHTML}
      </div>
      ${styleConfigurations?.outerHTML || ''} 
    `;
    block.innerHTML = bannerBlock;
    block.classList.add('active');

    if (styleConfigurations) {
      block.style.cssText = getInlineStyle(styleConfigurations); // add inline style to block
    }

    if (bannerWrapper) {
      await updateBannerTextConfigs(bannerWrapper, true, 'multiCta');
    }

    // include tools options for block configurations only inside sidekick library
    if (isSidekickLibrary) {
      await initSettingsPanel(block);
    }
  }
}
