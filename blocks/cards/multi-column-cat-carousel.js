import { createCarousel } from '../carousel/carousel.js';
import { initSettingsPanel, scheduleBannerFromMetaConfig } from '../../scripts/banner-utils/banner-utils.js';
import { getMetadata, loadCSS } from '../../scripts/aem.js';
import { fetchPlaceholdersForLocale, getBrandPath } from '../../scripts/scripts.js';

export default async function getMultiCategoryCarouselDom(block) {
  if (await scheduleBannerFromMetaConfig(block)) {
    block.parentNode.parentNode.classList.add('full-width');
    const configItems = getMetadata('number-of-carousel-items') || 0;
    const carouselItems = block.querySelectorAll('picture')?.length;
    const placeholders = await fetchPlaceholdersForLocale();
    const divWrapper = document.createElement('div');
    const listedCards = block.querySelectorAll('li');
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    loadCSS(`/blocks/cards/${getBrandPath()}multi-col-cat-banner.css`);
    block.classList.add('active');
    if (parseInt(carouselItems, 10) <= parseInt(configItems, 10)) {
      divWrapper.className = 'multi-col-cat-banner';
      divWrapper.classList.add(`full-width-multi-col-${parseInt(configItems, 10) > 4 && parseInt(configItems, 10) <= 8 ? configItems : 5}`);
    } else {
      divWrapper.className = 'multi-col-cat-carousel';
    }
    listedCards?.forEach((eleChild) => {
      const link = eleChild.querySelector('.cards-card-body a');
      const subElement = eleChild?.querySelector('.cards-card-body h4');
      if (link && eleChild.querySelector('picture')) {
        const { href } = link;
        const wrapperLink = document.createElement('a');
        if (parseInt(carouselItems, 10) <= parseInt(configItems, 10)) {
          wrapperLink.classList.add('column-category-item');
        }
        wrapperLink.href = href;
        link.remove();
        eleChild.querySelectorAll('div')?.forEach((contentEle) => {
          if (contentEle.classList.contains('cards-card-body') && !contentEle.querySelector('picture')) {
            const actionDom = document
              .createElement('div');
            actionDom.classList.add('cards-card-body');
            const spanChild = document.createElement('span');
            spanChild.setAttribute('data-action', href);
            spanChild.classList.add('link', 'custom-action');
            spanChild.innerHTML = link?.innerHTML;
            actionDom.append(spanChild);
            // check for subtext element
            if (subElement) {
              const subTextTag = document.createElement('span');
              subTextTag.classList.add('sub-text');
              subTextTag.innerHTML = subElement.innerHTML;
              actionDom.appendChild(subTextTag);
            }

            wrapperLink.append(actionDom);
          } else {
            wrapperLink.append(contentEle);
          }
        });
        divWrapper.append(wrapperLink);
      }
    });
    block.append(divWrapper);
    block.querySelector('ul').remove();
    block.parentNode.parentNode.classList.add('multi-col-carousel-section');
    block.parentNode.querySelector('.cards').classList.remove('cards');
    if (parseInt(carouselItems, 10) >= parseInt(configItems, 10)) {
      /* Carousel creation */
      const commonStyleConfig = {
        navButtons: true,
        isRTL: document.documentElement.dir === 'rtl',
        defaultStyling: true,
        fullPageScroll: true,
        visibleItems: [
          {
            items: 2,
            condition: () => window.innerWidth < 768,
          },
          {
            items: 5,
          },
        ],
      };
      const sliderElements = block.querySelectorAll('.multi-col-cat-carousel');
      Array.from(sliderElements)
        ?.slice(0, 20)
        .forEach((element) => {
          if (element.querySelector('picture')) {
            createCarousel(element, null, { ...commonStyleConfig });
          }
        });
      block.querySelectorAll('.carousel-item')?.forEach((cardElement) => {
        cardElement.addEventListener('click', () => {
          const actionUrl = cardElement.querySelector('.custom-action').getAttribute('data-action');
          if (actionUrl) window.open(actionUrl, '_blank').focus();
        });
      });
    }

    if (isSidekickLibrary) {
      await initSettingsPanel(block);
      await loadCSS(`/blocks/cards/${getBrandPath()}sidekick-helper.css`);
    }
    const nextBtn = block.querySelector('.carousel-nav-right');
    nextBtn?.setAttribute('aria-label', placeholders.next || 'Next');
    const prevBtn = block.querySelector('.carousel-nav-left');
    prevBtn?.setAttribute('aria-label', placeholders.previous || 'Previous');
  } else {
    block.closest('.cards-container').remove();
  }
}
