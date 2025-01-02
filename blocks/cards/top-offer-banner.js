import { loadCSS } from '../../scripts/aem.js';
import { createCarousel } from '../carousel/carousel.js';
import {
  updateBannerTextConfigs,
  getInlineStyle,
  scheduleBannerFromMetaConfig,
  initSettingsPanel,
} from '../../scripts/banner-utils/banner-utils.js';
import { getBrandPath } from '../../scripts/scripts.js';

export default async function getTopOfferBannerDom(block) {
  if (await scheduleBannerFromMetaConfig(block)) {
    await loadCSS(`/blocks/cards/${getBrandPath()}top-offer-banner.css`);
    const divWrapper = document.createElement('div');
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    divWrapper.classList.add('top-offer-ul-wrapper');
    const cardWrapper = block.querySelector('ul');
    const listedCards = block.querySelectorAll('li');
    const styleConfigurations = cardWrapper.querySelector('li:last-child');
    listedCards?.forEach((eleChild) => {
      const link = eleChild.querySelector('a');
      if (link) {
        const { href } = link;
        const childWrapper = document.createElement('div');
        childWrapper.setAttribute('data-action', href);
        link.remove();
        eleChild.querySelectorAll('div')?.forEach((contentEle) => {
          contentEle.querySelector('a')?.remove();
          const actionLink = document.createElement('span');
          actionLink.classList.add('card-action');
          actionLink.setAttribute('data-action', href);
          contentEle.append(actionLink);
          childWrapper.append(contentEle);
        });
        divWrapper.append(childWrapper);
      }
    });
    block.append(divWrapper);
    block.querySelector('ul').remove();
    /* Carousel creation */
    const commonStyleConfig = {
      navButtons: true,
      isRTL: document.documentElement.dir === 'rtl',
      defaultStyling: true,
      fullPageScroll: !(window.innerWidth < 768),
      visibleItems: [
        {
          items: 1,
          condition: () => window.innerWidth < 768,
        },
        {
          items: 3,
        },
      ],
    };
    const sliderElements = block.querySelectorAll('.top-offer-ul-wrapper');
    Array.from(sliderElements)
      ?.slice(0, 20)
      .forEach((element) => {
        if (element.querySelector('picture')) {
          createCarousel(element, null, { ...commonStyleConfig });
        }
      });
    block.querySelectorAll('.carousel-item')?.forEach((element) => {
      element.classList.add('cards-top-offer-banner');
    });
    const nextBtn = block.querySelector('.carousel-nav-right');
    nextBtn?.setAttribute('aria-label', 'Next');
    const prevBtn = block.querySelector('.carousel-nav-left');
    prevBtn?.setAttribute('aria-label', 'Previous');
    block.parentNode.parentNode.classList.add('top-offer-banner-wrapper');
    block.parentNode.querySelector('.cards').classList.remove('cards');
    block.classList.add('active');
    const bannerWrapper = block.closest('.top-offer-banner');
    if (styleConfigurations) {
      // eslint-disable-next-line max-len
      block.parentNode.parentNode.style.cssText = getInlineStyle(styleConfigurations); /* add inline style to block */
    }
    if (bannerWrapper) {
      await updateBannerTextConfigs(bannerWrapper, true, 'topOffer');
    }

    block.querySelectorAll('.cards-top-offer-banner')?.forEach((cardElement) => {
      cardElement.addEventListener('click', () => {
        const actionUrl = cardElement.querySelector('.card-action').getAttribute('data-action');
        if (actionUrl) window.open(actionUrl).focus();
      });
    });

    /* include tools options for block configurations only inside sidekick library */
    if (isSidekickLibrary) {
      await initSettingsPanel(block.parentNode.parentNode);
      await loadCSS(`/blocks/cards/${getBrandPath()}sidekick-helper.css`);
    }
  } else {
    block.closest('.cards-container').remove();
  }
}
