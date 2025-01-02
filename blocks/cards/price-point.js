import { loadCSS } from '../../scripts/aem.js';
import {
  updateBannerTextConfigs, getInlineStyle, scheduleBannerFromMetaConfig, initSettingsPanel,
} from '../../scripts/banner-utils/banner-utils.js';
import { getBrandPath } from '../../scripts/scripts.js';

export default async function decorateBanner(block) {
  const ul = block.querySelector('ul');
  [...ul.children].slice(0, -1).forEach((row) => {
    const link = row.querySelector('.button-container a') || null;
    link.setAttribute('target', '_self');
    const pic = row.querySelector('picture');
    link.closest('.cards-card-body').classList.add('content');
    const anchor = link.parentElement;
    anchor.remove();
    if (link && pic) {
      row.firstElementChild.appendChild(anchor);
      pic.parentElement.classList.add('cards-image');
    } else {
      const wrapperLink = document.createElement('a');
      wrapperLink.href = link.href;
      while (row.firstChild) wrapperLink.appendChild(row.firstChild);
      wrapperLink.appendChild(anchor);
      row.appendChild(wrapperLink);
    }
  });

  if ([...ul.children].length < 6) {
    ul.classList.add('min-col');
  }

  if (await scheduleBannerFromMetaConfig(block)) {
    await loadCSS('/blocks/cards/price-point.css');
    const bannerWrapper = block.closest('.pricepoint');
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    const styleConfigurations = ul.querySelector('li:last-child');
    styleConfigurations?.classList.add('style-configurations');
    styleConfigurations.style.display = 'none';
    block.parentElement.previousElementSibling.classList.add('price-point-block-header');
    block.classList.add('active');

    if (styleConfigurations) {
      block.style.cssText = getInlineStyle(styleConfigurations);
    }

    if (bannerWrapper) {
      await updateBannerTextConfigs(bannerWrapper, true, 'pricePoint');
    }

    if (isSidekickLibrary) {
      await loadCSS(`/blocks/cards/${getBrandPath()}sidekick-helper.css`);
      await initSettingsPanel(block);
    }
  }
}
