import { loadCSS } from '../../scripts/aem.js';
import {
  updateBannerTextConfigs,
  getInlineStyle,
  scheduleBannerFromMetaConfig,
  initSettingsPanel,
} from '../../scripts/banner-utils/banner-utils.js';
import { getBrandPath } from '../../scripts/scripts.js';

export default async function getTopOfferCardDom(block) {
  if (await scheduleBannerFromMetaConfig(block)) {
    await loadCSS(`/blocks/cards/${getBrandPath()}top-offer-banner.css`);
    const cardWrapper = block.querySelector('ul');
    const listedCards = block.querySelectorAll('li');
    block.parentNode.parentNode.classList.add('top-offer-card-wrapper');
    const styleConfigurations = cardWrapper.querySelector('li:last-child');
    styleConfigurations?.classList.add('style-configurations');
    styleConfigurations.style.display = 'none';
    listedCards?.forEach((eleChild) => {
      if (eleChild.querySelector('picture')) {
        eleChild.querySelector('br')?.remove();
        const link = eleChild.querySelector('a');
        if (link) {
          const { href } = link;
          link.remove();
          const actionLink = document.createElement('span');
          actionLink.classList.add('card-action');
          actionLink.setAttribute('data-action', href);
          eleChild.classList.add('top-offer-card-item');
          eleChild.append(actionLink);
        }
      }
    });
    block.querySelectorAll('.top-offer-card-item')?.forEach((cardElement) => {
      cardElement.addEventListener('click', () => {
        const actionUrl = cardElement.querySelector('.card-action').getAttribute('data-action');
        if (actionUrl) window.open(actionUrl, '_blank').focus();
      });
    });
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    cardWrapper.classList.add('top-offer-card-wrapper');
    block.classList.add('active');
    const bannerWrapper = block.closest('.top-offer-card');

    if (styleConfigurations) {
      block.style.cssText = getInlineStyle(styleConfigurations);
    }
    if (bannerWrapper) {
      await updateBannerTextConfigs(bannerWrapper, true, 'topOffer');
    }

    /* include tools options for block configurations only inside sidekick library */
    if (isSidekickLibrary) {
      await initSettingsPanel(block);
      await loadCSS(`/blocks/cards/${getBrandPath()}sidekick-helper.css`);
    }
  } else {
    block.closest('.cards-container').remove();
  }
}
