import { getTimestamp, fetchPlaceholdersForLocale } from '../scripts.js';
import { calcEnvironment } from '../configs.js';
import { decorateIcons } from '../aem.js';

const env = calcEnvironment();
function setStatus(categoryItem, placeholders) {
  const inactiveBanner = document.createElement('div');
  inactiveBanner.classList.add('inactive-content');

  const ptagEle = document.createElement('p');
  const lockIcon = document.createElement('span');
  lockIcon.className = 'icon icon-lock';

  if (!categoryItem.classList.contains('expired')) {
    categoryItem.classList.add('coming-soon');
    ptagEle.textContent = placeholders.comingSoon || 'Coming Soon';
    categoryItem.parentElement.classList.add('noreverse');
  } else {
    ptagEle.textContent = placeholders.expired || 'Expired';
  }

  inactiveBanner.append(lockIcon, ptagEle);
  categoryItem.appendChild(inactiveBanner);
  decorateIcons(categoryItem);
}

/**
 * function to check if css variable is in inline style or update only its value
 * and retain other style properties
 * @param {*} element
 * @param {*} cssVariable
 * @param {*} value
 */

function setCssVariable(element, variable, value) {
  const style = element.style.cssText;
  const cssVariable = `var(${variable})`;
  if (style.includes(cssVariable)) {
    element.style.cssText = style.replace(new RegExp(`${cssVariable}`, 'g'), value);
  } else {
    element.style.setProperty(variable, value);
  }
}

/**
 * update banner text configurations
 * @param {*} bannerWrapper
 * */
export async function updateBannerTextConfigs(bannerWrapper, istemplate, sheetType = 'default') {
  try {
    const bannerConfigEndpoint = `/${document.documentElement.lang}/fragments/banners/meta/banner-typography.json${istemplate ? `?sheet=${sheetType}` : ''}`;
    const bannerTextConfigs = await fetch(bannerConfigEndpoint).then((res) => res.json());
    bannerTextConfigs?.data.forEach((bannerTextConfig) => {
      const { type } = bannerTextConfig;
      const properties = [
        { key: 'font-size', cssVar: `--size-text-${type}` },
        { key: 'line-height', cssVar: `--line-height-${type}` },
        { key: 'desktop-font-size', cssVar: `--desktop-size-text-${type}` },
        { key: 'desktop-line-height', cssVar: `--desktop-line-height-${type}` },
      ];
      properties.forEach(({ key, cssVar }) => {
        if (bannerTextConfig[key]) {
          const value = (key.indexOf('font-size') !== -1) ? `${bannerTextConfig[key]}px` : bannerTextConfig[key];
          setCssVariable(bannerWrapper, cssVar, value);
        }
      });
    });
  } catch (e) {
    console.error('Error fetching banner typography configurations', e);
  }
}

/**
 * extract css variables and replace the configuration values
 * @param {*} element
 * @param {*} styleConfigurations
 */
function updateStyleConfigs(element) {
  const cssVariables = element.style.cssText.split(';');
  const styleConfigurations = element.querySelector('.style-configurations');
  // remove last element which is empty
  cssVariables.pop();
  cssVariables.forEach((cssVariable) => {
    // find the parent element with innerText the matches cssVariable and update its value
    styleConfigurations.querySelectorAll('p').forEach((pElement) => {
      const [key] = pElement.innerText.split(':');
      if (cssVariable.includes(key)) {
        const trimmedCSSVar = cssVariable.split('--')[1];
        pElement.innerText = trimmedCSSVar;
      }
    });
  });
}

/**
 * get inner text of all p elements of element and convert to inline style
 * @param {*} element
 * @returns
 */
export function getInlineStyle(element) {
  const pElements = element.querySelectorAll('p');
  let inlineStyle = '';
  pElements.forEach((pElement) => {
    const [key, value] = pElement.innerText.split(':');
    inlineStyle += `--${key}:${value};`;
  });
  return inlineStyle;
}

/**
 * Determines whether block with a given expiry date string should be displayed.
 */
export function shouldBeDisplayed(date) {
  const now = getTimestamp();
  if (date !== '') {
    const from = Date.parse(date.trim());
    return now <= from;
  }
  return false;
}

export function getCounterValue(countDownDate) {
  const now = new Date().getTime();
  const distance = countDownDate - now;
  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  return { distance, value: `<span>${days}d</span> : <span>${hours}h</span>: <span>${minutes}m</span> : <span>${seconds}s</span>` };
}

/**
 * Remove the banner from the DOM
 * @param {*} block
 */
export function removeBanner(block) {
  if (env !== 'prod') {
    return;
  }
  // TODO: Need to check if the banner could be inside a section and
  // remove the section along with the banner
  // const blockSection = block.closest('.section');
  // if (blockSection) {
  //   blockSection.remove();
  // } else {
  block.remove();
  // }
}

/**
 * @param {String} expiryDate
 * @param {HTMLElement} bannerElem
 * @param {Function} callback
 */
export function initExpiryTimer(expiryDate, endCallback, timerCallback) {
  let timerInterval;

  const updateCounter = () => {
    const result = getCounterValue(expiryDate);

    if (result.distance < 0 && env === 'prod') {
      clearInterval(timerInterval);
      if (endCallback) endCallback();
    } else if (timerCallback) { // if timerCallback is provided call it with the timer value
      timerCallback(result.value);
    }
  };

  const result = getCounterValue(expiryDate);
  if (result.distance < 0 && env === 'prod') {
    endCallback();
    return;
  }

  timerInterval = setInterval(updateCounter, 1000);
  // Initial call to set the counter immediately
  updateCounter();
}

export function createSettingsPanel(dataset, block, styles) {
  const settingsPanel = document.createElement('settings-panel');
  settingsPanel.setAttribute('props', JSON.stringify(dataset));
  settingsPanel.setAttribute('styles', styles);
  settingsPanel.addEventListener('CONFIG_UPDATED', (e) => {
    const { cssVariable, data, fieldType } = e.detail;
    if (fieldType !== 'image') {
      setCssVariable(block, cssVariable, data);
      updateStyleConfigs(block);
    } else {
      console.info('Image data:', cssVariable, data);
      block.querySelector(`.${cssVariable.split('--')[1]}-link`)?.setAttribute('href', data);
      block.querySelector(`.${cssVariable.split('--')[1]} img`)?.setAttribute('src', data);
      block.querySelectorAll(`.${cssVariable.split('--')[1]} source`).forEach((source) => {
        source.srcset = data;
      });
    }
  });

  settingsPanel.addEventListener('TOGGLE_EVENT', (e) => {
    document.body.classList.toggle('settings-panel-active', e.detail.isExpanded);
  });
  return settingsPanel;
}

/**
 * Datalayer events for banner view and select
 */
export async function datalayerEvents(block, scheduleId) {
  if (window.DISABLE_MARTECH) {
    return;
  }
  const bannerHeading = block.querySelector('h2')?.textContent;
  const { datalayerViewBannerEvent, datalayerSelectBannerEvent } = await import('../analytics/google-data-layer.js');

  const fullBannerCTA = block.querySelector('a.banner-link');
  let ctaList = [];

  // DL View banner event
  const targetId = block.closest('.target-banner')?.getAttribute('data-target-id') || null;
  if (fullBannerCTA) {
    datalayerViewBannerEvent([bannerHeading], targetId, scheduleId, bannerHeading);
  } else {
    ctaList = [...block.querySelectorAll('.button-container a.button, :scope.slug h3 > a:not([href="#close"])')];
    const ctaNameList = ctaList?.map((button) => button.textContent?.trim());
    if (!block.closest('header')) {
      datalayerViewBannerEvent(ctaNameList, targetId, scheduleId, bannerHeading);
    }
  }

  // DL Select banner event on CTA click
  block.addEventListener('click', (e) => {
    const cta = e.target;

    if (cta.tagName === 'A') {
      if (cta.classList.contains('button')) {
        datalayerSelectBannerEvent(
          cta.textContent,
          targetId,
          ctaList.indexOf(cta) + 1,
          scheduleId,
          bannerHeading,
        );
      } else {
        datalayerSelectBannerEvent(
          cta.title,
          targetId,
          1,
          scheduleId,
          bannerHeading,
        );
      }
      if (!e.ctrlKey && !e.metaKey) {
        localStorage.removeItem('categoryListId');
        localStorage.setItem('categoryListName', `bn_promo_${bannerHeading
          .toLowerCase()?.replace(/\s+/g, '')}`);
      }
    }
  });
  // DL Select banner event on CTA click in expanded menu for mobile view
  block.nextElementSibling
    ?.addEventListener('click', ({ target: cta }) => {
      if (cta.tagName === 'A' && cta.classList.contains('button')) {
        const index = ctaList.findIndex((el) => el.title === cta.title);
        datalayerSelectBannerEvent(
          cta.textContent,
          targetId,
          index + 1,
          scheduleId,
          bannerHeading,
        );
      }
    });
}

// Start timer for banner with end date and remove banner on expiry
export function startTimer(endDate, timerElem, block, scheduleId) {
  // block will be removed if end date is expired
  // and timer will be started if timerElem is present
  if (endDate || timerElem) {
    const callback = timerElem ? (timer) => {
      timerElem.innerHTML = timer;
    } : null;
    if (env !== 'prod' || endDate > new Date().getTime()) {
      datalayerEvents(block, scheduleId);
    }
    initExpiryTimer(endDate, () => {
      removeBanner(block);
    }, callback);
  }
}

export function scheduleBanner(startDate, endDate, block, scheduleId) {
  const timerElem = block.querySelector('h5');
  if (env !== 'prod') {
    block.classList.add('active');
    startTimer(endDate, timerElem, block, scheduleId);
    return;
  }
  if (startDate && startDate >= new Date().getTime()) {
    removeBanner(block);
  } else {
    block.classList.add('active');
    startTimer(endDate, timerElem, block, scheduleId);
  }
}

export function scheduleProgressiveBanner(startDate, endDate, block, scheduleId) {
  const timerElem = block.querySelector('.active-category h5');
  if (env !== 'prod') {
    block.classList.add('active');
    startTimer(endDate, timerElem, block, scheduleId);
    return;
  }
  const countDownDate = new Date(timerElem.innerText.trim()).getTime();
  if (startDate && startDate >= new Date().getTime()) {
    removeBanner(block);
  } else {
    block.classList.add('active');
    if (countDownDate > new Date().getTime()) {
      datalayerEvents(block, scheduleId);
    }
    initExpiryTimer(countDownDate, () => {
      document.dispatchEvent(new CustomEvent('updateBanner'));
    }, () => {
      timerElem.innerHTML = getCounterValue(countDownDate).value;
    });
  }
}

export async function renderPromotionBanner(block, scheduleId) {
  if (env !== 'prod') {
    block.classList.add('active');
    return;
  }

  // Retrieves the promotion data
  fetch('/promotion-schedule.json').then((response) => response.json()).then((data) => {
    if (data.total === 0) return;

    const { data: promotData } = data;
    const activePromo = promotData.find((promo) => promo.schedule_id === scheduleId && promo.status === '1' && promo.channel_web === 'true');

    if (!activePromo) return;
    const { start_date: sDate, end_date: eDate } = activePromo;

    const startDate = new Date(sDate).getTime();
    const endDate = new Date(eDate).getTime();
    if (block.classList.contains('progressive-banner')) {
      scheduleProgressiveBanner(startDate, endDate, block, scheduleId);
    } else {
      scheduleBanner(startDate, endDate, block, scheduleId);
    }
  });
}

// Function to fetch HTML content and extract meta data
export async function fetchAndExtractMeta(url) {
  try {
    let doc = document;
    if (url && window.fragmentCacheForBanners[url]) {
      const parser = new DOMParser();
      doc = parser.parseFromString(window.fragmentCacheForBanners[url], 'text/html');
    } else if (url) {
      // Fetch the HTML document from the given URL
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'max-age 60',
        },
      });

      // Ensure the request was successful
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // Get the text content of the fetched HTML
      const htmlString = await response.text();

      // Parse the HTML content into a DOM object
      const parser = new DOMParser();
      doc = parser.parseFromString(htmlString, 'text/html');
    }
    // Extract the desired meta tags using querySelector or querySelectorAll
    const scheduleIdMeta = doc.querySelector('meta[name="schedule-id"]');
    const startDateTimeMeta = doc.querySelector('meta[name="start-date-time"]');
    const endDateTimeMeta = doc.querySelector('meta[name="end-date-time"]');

    // Extract the content attribute from each meta tag
    const scheduleId = scheduleIdMeta ? scheduleIdMeta.getAttribute('content') : null;
    const startDateTime = startDateTimeMeta ? startDateTimeMeta.getAttribute('content') : null;
    const endDateTime = endDateTimeMeta ? endDateTimeMeta.getAttribute('content') : null;

    return {
      scheduleId,
      startDate: startDateTime,
      endDate: endDateTime,
    };
  } catch (error) {
    console.error('Error fetching HTML:', error);
  }

  return null;
}

function isDateInRange(today, startDate, endDate) {
  const sDate = new Date(startDate).getTime();
  const eDate = new Date(endDate).getTime();
  return sDate < today && eDate > today;
}

async function fetchActivePromotion(scheduleId) {
  const response = await fetch('/promotion-schedule.json');
  const data = await response.json();
  if (data.total === 0) return null;
  return data.data.find((promo) => promo.schedule_id === scheduleId && promo.status === '1' && promo.channel_web === 'true');
}

/**
 * Schedule banner based on start, end date and scheduleID from meta tags
 * @param {*} block
 * */
export async function scheduleBannerFromMetaConfig(block) {
  const isSidekickLibrary = document.body.classList.contains('sidekick-library');
  const pathWrapper = block.closest('.section[data-path]');
  const path = pathWrapper ? pathWrapper.dataset.path : null;

  const { startDate, endDate, scheduleId } = path ? await fetchAndExtractMeta(path)
    : await fetchAndExtractMeta(); // get meta data from html document from the path

  const today = Date.now();
  let isActive = false;
  if ((startDate === null && endDate === null) && scheduleId === null) {
    isActive = true;
  } else if (isSidekickLibrary) {
    isActive = true;
  } else if (env !== 'prod') {
    isActive = true;
  } else if (scheduleId) {
    const activePromo = await fetchActivePromotion(scheduleId);
    if (activePromo) {
      const { start_date: promoStartDate, end_date: promoEndDate } = activePromo;
      isActive = isDateInRange(today, promoStartDate, promoEndDate);
    }
  } else {
    isActive = isDateInRange(today, startDate, endDate);
  }
  if (isActive && !isSidekickLibrary) {
    datalayerEvents(block, scheduleId);
  }
  return isActive;
}

export async function initSettingsPanel(block) {
  const sectionWrapper = block.closest('.section');
  // add settings panel for block configurations
  if (sectionWrapper?.dataset?.librarySettings) {
    import('../../tools/settings-panel/src/index.js').then(() => {
      const blockStyles = block.style.cssText;
      const settingsPanel = createSettingsPanel(sectionWrapper?.dataset, block, blockStyles);
      block.appendChild(settingsPanel);
    });
  }
}

// load DAM image handler helper resources only if the banner has images
export async function sidekickImageSettings(block, isVideo = false) {
  import('./sidekick-helper.js').then((module) => {
    const sidekickSelector = isVideo ? block.querySelectorAll('.video-bg-link') : block.querySelectorAll('picture');
    sidekickSelector.forEach((image) => {
      module.default(block, image);
    });
  });
}

export async function decorateProgressive(block) {
  const placeholders = await fetchPlaceholdersForLocale();
  const bannerWrapper = block.closest('.progressive-banner-wrapper');
  const sectionWrapper = block.closest('.section');
  const isSidekickLibrary = document.body.classList.contains('sidekick-library');
  const isMobileView = window.matchMedia('(max-width: 767px)').matches;
  const categoryList = Array.from(block.querySelectorAll(':scope div > div')).slice(0, -1);
  const styleConfigurations = Array.from(block.querySelectorAll(':scope div > div')).slice(-1)[0];
  const content = document.createElement('div');

  categoryList.sort((a, b) => {
    const dateA = new Date(a.querySelector('h5')?.innerText.trim());
    const dateB = new Date(b.querySelector('h5')?.innerText.trim());
    return dateA - dateB;
  });
  const now = new Date();
  let timerDate = '';
  let timerValue = Infinity;
  let nearestActiveIndex = -1;
  categoryList.forEach((categoryItem, index) => {
    const buttonGroup = document.createElement('div');
    buttonGroup.classList.add('button-group');
    const buttonContainers = categoryItem.querySelectorAll('.button-container');
    categoryItem?.insertBefore(buttonGroup, buttonContainers[0]);
    buttonContainers.forEach((buttonContainer) => {
      buttonGroup.appendChild(buttonContainer);
    });

    const timerElement = categoryItem.querySelector('h5');
    timerDate = new Date(timerElement?.innerText.trim());
    if (now <= timerDate) {
      const timeDifference = Math.abs(timerDate - now);
      if (timeDifference < timerValue) {
        timerValue = timeDifference;
        nearestActiveIndex = index;
      }
    } else {
      categoryItem.classList.add('expired');
    }
    content.appendChild(categoryItem);
  });

  categoryList[nearestActiveIndex]?.classList.add('active-category');
  // eslint-disable-next-line  max-len
  const nonnearestActiveIndices = Object.keys(categoryList).filter((index) => index !== String(nearestActiveIndex));
  nonnearestActiveIndices.forEach((index) => setStatus(categoryList[index], placeholders));

  styleConfigurations?.classList.add('style-configurations');
  content.classList.add('banner-content');
  const categoryLength = content.children.length;
  if (content && categoryLength === 2) content.classList.add('has-two-category');

  const bannerBlock = `
    <div class="banner-content-wrapper">
      ${content.outerHTML}
    </div>
    ${styleConfigurations?.outerHTML || ''}
  `;

  if (styleConfigurations) {
    block.style.cssText = getInlineStyle(styleConfigurations);
  }

  if (bannerWrapper) {
    await updateBannerTextConfigs(bannerWrapper, true);
  }

  block.innerHTML = bannerBlock;

  // check if block should be displayed based on expiry date
  const timerElem = bannerWrapper?.querySelector('.active-category h5');
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

  if (!timerElem) {
    // remove banner if all categories are expired
    removeBanner(block);
  } else if (scheduleId) {
    // Promotion Banners
    renderPromotionBanner(block, scheduleId);
  } else if (startDate || endDate) { // Schedule Banners if start and end date is configured
    const parsedStartDate = new Date(startDate).getTime();
    const parsedEndDate = new Date(endDate).getTime();

    scheduleProgressiveBanner(parsedStartDate, parsedEndDate, block);
  } else if (timerElem && !isSidekickLibrary) {
    // Banner with timer
    timerDate = timerElem.innerText.trim();
    if (shouldBeDisplayed(timerDate)) {
      block.classList.add('active');
      datalayerEvents(block, scheduleId);
    }
    // Updates the timer and removes the banner on expiry time
    const countDownDate = new Date(timerDate).getTime();
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
  if (!isMobileView && isSidekickLibrary) {
    // add settings panel for block configurations
    if (sectionWrapper?.dataset?.librarySettings) {
      import('../../tools/settings-panel/src/index.js').then(() => {
        const blockStyles = block.style.cssText;
        const settingsPanel = createSettingsPanel(sectionWrapper?.dataset, block, blockStyles);
        block.appendChild(settingsPanel);
      });
    }
  }
}
