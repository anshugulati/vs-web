import { loadCSS, getMetadata } from '../../scripts/aem.js';
import { initSettingsPanel, scheduleBannerFromMetaConfig } from '../../scripts/banner-utils/banner-utils.js';
import { getBrandPath } from '../../scripts/scripts.js';

export default async function getMultiCategoryBannerDom(block) {
  if (await scheduleBannerFromMetaConfig(block)) {
    const numOfCol = getMetadata('number-of-columns');
    const divWrapper = document.createElement('div');
    const listedCards = block.querySelectorAll('li');
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    block.parentNode.parentNode.classList.add('multi-col-banner-section');
    await loadCSS(`/blocks/cards/${getBrandPath()}multi-col-cat-banner.css`);
    block.parentNode.querySelector('.cards').classList.remove('cards');
    block.classList.add('active');
    divWrapper.className = 'multi-col-cat-banner';
    divWrapper.classList.add(`full-width-multi-col-${parseInt(numOfCol, 10) > 4 && parseInt(numOfCol, 10) <= 8 ? numOfCol : 5}`);
    listedCards?.forEach((productCards) => {
      const link = productCards.querySelector('a');
      if (link && productCards.querySelector('picture')) {
        const { href } = link;
        const wrapperLink = document.createElement('a');
        wrapperLink.classList.add('column-category-item');
        wrapperLink.setAttribute('target', '_blank');
        wrapperLink.href = href;
        link.remove();
        productCards.querySelectorAll('div')?.forEach((contentEle) => {
          if (contentEle.classList.contains('cards-card-body') && !contentEle.querySelector('picture')) {
            const actionDom = document.createElement('div');
            actionDom.classList.add('cards-card-body');
            const spanChild = document.createElement('span');
            spanChild.classList.add('link', 'custom-action');
            spanChild.innerHTML = contentEle.querySelector('a')?.innerHTML;
            actionDom.append(spanChild);
            wrapperLink.append(actionDom);
          } else {
            wrapperLink.append(contentEle);
          }
        });
        divWrapper.append(wrapperLink);
      }
    });
    if (isSidekickLibrary) {
      await initSettingsPanel(block);
      await loadCSS(`/blocks/cards/${getBrandPath()}sidekick-helper.css`);
    }
    block.append(divWrapper);
    block.querySelector('ul').remove();
  } else {
    block.closest('.cards-container').remove();
  }
}
