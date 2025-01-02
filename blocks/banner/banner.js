import { loadCSS } from '../../scripts/aem.js';
import {
  updateBannerTextConfigs, getInlineStyle, shouldBeDisplayed, getCounterValue, initExpiryTimer,
  createSettingsPanel, scheduleBanner, renderPromotionBanner, datalayerEvents, fetchAndExtractMeta,
  removeBanner,
} from '../../scripts/banner-utils/banner-utils.js';
import { getBrandPath, redirectRegisterURL } from '../../scripts/scripts.js';

const deskViewportWidth = 1600;
const mobViewportWidth = 412;

// Observer to capture the text changes and update the anchor link
function initAchorTextChange(targetNode) {
  // Create a MutationObserver instance
  const observer = new MutationObserver((mutationsList) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const mutation of mutationsList) {
      if (mutation.type === 'characterData') {
        mutation.target.parentElement.href = mutation.target.textContent;
      }
    }
  });

  // Set the observer options to watch for text changes
  const config = {
    characterData: true, // Observe changes to the text content
    subtree: true, // Observe all descendants
    childList: true, // Observe addition/removal of child nodes
  };

  // Start observing the text node of the anchor element
  observer.observe(targetNode, config);

  targetNode.addEventListener('paste', async (e) => {
    e.target.href = e.target.innerText;
  });
}

/* eslint-disable no-mixed-operators */
let currentItem = null;
function addPriceTagHandler(block) {
  const items = block.querySelectorAll('.price-content');
  if (!items.length) {
    return;
  }
  let isDragging = false;
  let offsetX;
  let offsetY;
  let positionData;
  let positionDataMobile;
  let key;
  let mobilekey;
  items.forEach((item) => {
    initAchorTextChange(item.querySelector('a'));
    item.addEventListener('mousedown', (e) => {
      currentItem = e.target;
      isDragging = true;
      const parentRect = item.parentElement.getBoundingClientRect();
      offsetX = (e.clientX - item.getBoundingClientRect().left) / parentRect.width * 100;
      offsetY = (e.clientY - item.getBoundingClientRect().top) / parentRect.height * 100;
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const isMobileView = window.matchMedia('(max-width: 767px)').matches;
      const parentRect = currentItem?.parentElement.getBoundingClientRect();
      const arrowPosition = currentItem.querySelector('p:last-child')?.innerText?.split(':')[1].trim().toLowerCase();
      // eslint-disable-next-line  max-len
      let x;

      if (arrowPosition === 'left') {
        x = Math.floor(
          ((e.clientX - (offsetX * parentRect.width / 100) - parentRect.left)
            / parentRect.width) * 100,
        );
      } else {
        x = Math.floor(
          ((parentRect.right - e.clientX - (offsetX * parentRect.width / 100))
            / parentRect.width) * 100,
        );
      }
      // eslint-disable-next-line  max-len
      let y = Math.floor(((e.clientY - (offsetY * parentRect.height / 100) - parentRect.top) / parentRect.height) * 100);

      x = Math.max(0, Math.min(100 - currentItem.offsetWidth / parentRect.width * 100, x));
      y = Math.max(0, Math.min(100 - currentItem.offsetHeight / parentRect.height * 100, y));
      [positionData, positionDataMobile] = currentItem.querySelectorAll('p:nth-last-child(3), p:nth-last-child(2)');
      [key] = positionData && positionData.innerText.split(':');
      [mobilekey] = positionDataMobile && positionDataMobile.innerText.split(':');

      if (currentItem.querySelectorAll('div > p').length > 5) {
        // consider x is based on current banner width and y is based on current banner height
        // calculate x and y for width 1600 and relevant height
        const scaleFactor = (isMobileView ? mobViewportWidth : deskViewportWidth)
          / parentRect.width;
        const deltaPercentatge = scaleFactor - Math.floor(scaleFactor);
        x += deltaPercentatge;
        y += deltaPercentatge;

        if (isMobileView) {
          positionDataMobile.innerText = `${mobilekey}: ${x}%, ${y}%`;
        } else {
          positionData.innerText = `${key}: ${x}%, ${y}%`;
        }
      } else {
        positionDataMobile.innerText = `${key}: ${x}%, ${y}%`;
      }

      currentItem.style[arrowPosition] = `${x}%`;
      currentItem.style.top = `${y}%`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    currentItem = null;
  });
}

function registerExpandClick(block) {
  const buttonGroup = block.querySelector('.button-group');
  const buttonContainers = buttonGroup.querySelectorAll('.button-container');
  const mobileOverlay = document.createElement('div');
  mobileOverlay.classList.add('mobile-overlay');
  if (buttonContainers.length > 1) {
    const clonedButtonGroup = buttonGroup.cloneNode(true);
    clonedButtonGroup.classList.add('mobile');
    block.closest('.banner-wrapper').appendChild(clonedButtonGroup);
    mobileOverlay.classList.add('expandable');
    mobileOverlay.addEventListener('click', () => {
      block.classList.toggle('expanded');
      clonedButtonGroup.classList.toggle('expanded');
    });
  } else {
    try {
      const buttonLink = buttonGroup.querySelector('a.button');
      if (buttonLink) {
        const linkOverlay = document.createElement('a');
        linkOverlay.href = buttonLink.href;
        linkOverlay.classList.add('link-overlay');
        linkOverlay.title = buttonLink.title;
        mobileOverlay.appendChild(linkOverlay);
      }
    } catch (error) {
      console.error('Error registerExpandClick', error);
    }
  }
  block.prepend(mobileOverlay);
}

let pricecontentMarkup;
function pricePointerPositionUpdate(priceContents, isSidekickLibrary) {
  let tagPosition = '';
  let arrowPosition = '';
  let priceTagElement = '';
  const isMobileView = window.matchMedia('(max-width: 767px)').matches;
  priceContents.forEach((priceContent) => {
    const priceLink = priceContent?.querySelector('a');
    if (priceLink?.parentElement instanceof HTMLParagraphElement && !isSidekickLibrary) {
      priceContent.removeChild(priceLink.parentElement);
    }
    // wrap pricecontent with anchor tag
    if (!isSidekickLibrary && priceLink) priceContent.innerHTML = `<a href="${priceLink.href}" target="_blank">${priceContent.innerHTML}</a>`;
    const priceContentlength = !isSidekickLibrary ? priceContent.querySelectorAll('p').length > 4 : priceContent.querySelectorAll('p').length > 5;
    if (priceContentlength) {
      priceTagElement = isMobileView ? priceContent.querySelector('p:nth-last-child(2)') : priceContent.querySelector('p:nth-last-child(3)');
    } else {
      priceTagElement = priceContent.querySelector('p:nth-last-child(2)');
    }
    const priceTagPosition = priceTagElement?.innerText?.split(':')[1].trim();
    arrowPosition = priceContent.querySelector('p:last-child')?.innerText?.split(':')[1].trim().toLowerCase();
    let [x, y] = priceTagPosition.split(',').map((coord) => coord.trim());
    const scaleFactor = (isMobileView ? mobViewportWidth : deskViewportWidth) / document.querySelector('main').clientWidth;
    const deltaPercentatge = scaleFactor - Math.floor(scaleFactor);
    x = Number(x.split('%')[0]) + deltaPercentatge;
    y = Number(y.split('%')[0]) + deltaPercentatge;
    tagPosition = `top:${(Number(y))}%;${arrowPosition}:${(Number(x))}%;`;
    pricecontentMarkup += `<div class="price-content arrow-${arrowPosition}" style="${tagPosition}">
    ${priceContent?.outerHTML}
  </div>`;
  });
}

function updatePricePointPositions(priceContents, isMobile, isSidekickLibrary) {
  priceContents?.forEach((priceContent) => {
    let priceTagElement;
    const priceContentlength = !isSidekickLibrary ? priceContent.querySelectorAll('p').length > 4 : priceContent.querySelectorAll('p').length > 5;
    if (priceContentlength) {
      priceTagElement = isMobile ? priceContent.querySelector('p:nth-last-child(2)') : priceContent.querySelector('p:nth-last-child(3)');
    } else {
      priceTagElement = priceContent.querySelector('p:nth-last-child(2)');
    }
    const priceTagPosition = priceTagElement?.innerText?.split(':')[1].trim();

    const arrowPosition = priceContent.querySelector('p:last-child')?.innerText?.split(':')[1].trim().toLowerCase();
    const [x, y] = priceTagPosition.split(',').map((coord) => coord.trim());
    priceContent.style = `top:${(Number(y.split('%')[0]))}%;${arrowPosition}:${(Number(x.split('%')[0]))}%;`;
  });
}

export default async function decorate(block) {
  const bannerWrapper = block.closest('.banner-wrapper');
  const sectionWrapper = block.closest('.section');
  const isSidekickLibrary = document.body.classList.contains('sidekick-library');
  const mediaQueryList = window.matchMedia('(max-width: 767px)');
  const [backgrounds, content, styleConfigurations, ...priceContents] = block.querySelectorAll(':scope div > div');
  const [desktopBg, mobileBg, leftOverlay, rightOverlay] = backgrounds.querySelectorAll('picture');
  const [desktopBgLink, mobileBgLink, leftOverlayLink, rightOverlayLink] = backgrounds.querySelectorAll('a');
  const buttonContainers = content.querySelectorAll('.button-container');
  const bannerLink = backgrounds.querySelector('a');
  const isImageBanner = block.classList.contains('with-image');
  const isWithBadge = block.classList.contains('with-badge');

  styleConfigurations?.classList.add('style-configurations');
  pricecontentMarkup = '';
  if (!isWithBadge && desktopBg && content.innerHTML) {
    block.classList.add('has-image');
  }
  if (priceContents.length) {
    pricePointerPositionUpdate(priceContents, isSidekickLibrary);
    mediaQueryList.addEventListener('change', (event) => {
      const isMobileView = event.matches;
      const priceContent = block.querySelectorAll('.price-content');
      updatePricePointPositions(priceContent, isMobileView, isSidekickLibrary);
    });
  }

  const buttonGroup = document.createElement('div');
  buttonGroup.classList.add('button-group');
  content.insertBefore(buttonGroup, buttonContainers[0]);
  buttonContainers.forEach((buttonContainer) => {
    buttonGroup.appendChild(buttonContainer);
  });
  content.classList.add('banner-content');
  desktopBg?.classList.add('desktop-bg');
  mobileBg?.classList.add('mobile-bg');
  leftOverlay?.classList.add('badge-left');
  rightOverlay?.classList.add('badge-right');
  content.querySelector('picture')?.classList.add('logo');
  const bannerHeading = content.querySelector('h2')?.textContent;
  const logoLink = content.querySelector('a.hide');
  if (isSidekickLibrary) {
    desktopBgLink?.classList.add('desktop-bg-link');
    mobileBgLink?.classList.add('mobile-bg-link');
    leftOverlayLink?.classList.add('badge-left-link');
    rightOverlayLink?.classList.add('badge-right-link');
    if (logoLink) {
      const lbl = document.createElement('span');
      lbl.innerHTML = 'Logo: ';
      lbl.setAttribute('class', 'logo-link-lbl');
      logoLink.insertAdjacentElement('beforeBegin', lbl);
      logoLink.classList.add('logo-link');
    }
  }

  if (window.matchMedia('(width >= 768px)').matches) {
    desktopBg?.querySelector('img')?.setAttribute('loading', 'eager');
  } else {
    mobileBg?.querySelector('img')?.setAttribute('loading', 'eager');
  }

  const bannerBlock = `
    ${isSidekickLibrary ? `
      <div class='image-wrapper'>
      ${desktopBgLink ? `<span class="desktop-bg-lbl">DesktopBG :</span> ${desktopBgLink?.outerHTML}` : ''}
      ${mobileBgLink ? `<span class="mobile-bg-lbl">MobileBG :</span> ${mobileBgLink?.outerHTML}` : ''}
      ${leftOverlayLink ? `<span class="badge-left-lbl">LeftOverlay :</span> ${leftOverlayLink?.outerHTML}` : ''}
      ${rightOverlayLink ? `<span class="badge-right-lbl">RightOverlay :</span> ${rightOverlayLink?.outerHTML}` : ''}
      </div>` : ''}
      ${isWithBadge && !leftOverlay ? `
        <div class="banner-overlay">
        ${desktopBg?.outerHTML || ''}
        ${mobileBg?.outerHTML || ''}
      </div>`
    : `<div class="banner-bg">
        ${desktopBg?.outerHTML || ''}
        ${mobileBg?.outerHTML || ''}
      </div>
      <div class="banner-overlay">
        ${leftOverlay?.outerHTML || ''}
        ${rightOverlay?.outerHTML || ''}
      </div>`}
    <div class="banner-content-wrapper">
      ${content.outerHTML}
    </div>
    ${pricecontentMarkup}
    ${styleConfigurations?.outerHTML || ''}
    ${!isSidekickLibrary && bannerLink
    ? `<a href="${bannerLink.href}" class="banner-link" title ="${bannerHeading}"></a>`
    : ''}
  `;

  if (styleConfigurations) {
    // add inline style to block
    block.style.cssText = getInlineStyle(styleConfigurations);
  }

  if (bannerWrapper) {
    const sheetType = isImageBanner ? 'image' : 'default';
    await updateBannerTextConfigs(bannerWrapper, isImageBanner, sheetType);
  }

  block.innerHTML = bannerBlock;

  registerExpandClick(block);

  // check if block should be displayed based on expiry date
  const timerElem = block.querySelector('h5');
  const pathWrapper = block.closest('.section[data-path]');

  let path;
  if (pathWrapper) {
    ({ path } = pathWrapper.dataset);
  }
  // get meta data from html document from the path
  let scheduleId;
  let startDate;
  let endDate;
  if (path) {
    ({ scheduleId, startDate, endDate } = await fetchAndExtractMeta(path));
  } else {
    ({ scheduleId, startDate, endDate } = await fetchAndExtractMeta());
  }

  if (scheduleId) {
    // Promotion Banners
    renderPromotionBanner(block, scheduleId);
  } else if (startDate || endDate) { // Schedule Banners if start and end date is configured
    const parsedStartDate = new Date(startDate).getTime();
    const parsedEndDate = new Date(endDate).getTime();
    scheduleBanner(parsedStartDate, parsedEndDate, block);
  } else if (timerElem && !isSidekickLibrary) {
    // Banner with timer
    const timerDate = timerElem.innerText.trim();
    const countDownDate = new Date(timerDate).getTime();
    if (shouldBeDisplayed(timerDate)) {
      block.classList.add('active');
      if (countDownDate > new Date().getTime()) {
        datalayerEvents(block, scheduleId);
      }
    }
    // Updates the timer and removes the banner on expiry time
    initExpiryTimer(countDownDate, () => {
      removeBanner(block);
    }, () => {
      timerElem.innerHTML = getCounterValue(countDownDate).value;
    });
  } else {
    block.classList.add('active');
    datalayerEvents(block, scheduleId);
  }

  // include tools options for block configurations only inside sidekick library
  if (isSidekickLibrary) {
    // add drag handler for price tag
    addPriceTagHandler(block);

    // add settings panel for block configurations
    if (sectionWrapper?.dataset?.librarySettings) {
      import('../../tools/settings-panel/src/index.js').then(() => {
        const blockStyles = block.style.cssText;
        const settingsPanel = createSettingsPanel(sectionWrapper?.dataset, block, blockStyles);
        block.appendChild(settingsPanel);
      });
    }

    // load DAM image handler helper resources only if the banner has images
    if (isImageBanner || (desktopBgLink || mobileBgLink || logoLink)) {
      await loadCSS(`/blocks/banner/${getBrandPath()}sidekick-helper.css`);
      import('./sidekick-helper.js').then((module) => {
        block.querySelectorAll('picture').forEach((image) => {
          module.default(block, image);
        });
      });
    }
  }
  redirectRegisterURL(block, '.slug a');
}
