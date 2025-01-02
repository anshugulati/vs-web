/* eslint-disable no-unused-expressions, linebreak-style */
import { decorateIcons, loadCSS } from '../../scripts/aem.js';
import { getConfigValue } from '../../scripts/configs.js';
import {
  createOptimizedPicture,
  fetchPlaceholdersForLocale,
  formatPrice,
  getBrandPath,
  isLoggedInUser,
  getLanguageAttr,
} from '../../scripts/scripts.js';

const ConfigAutoScroll = await getConfigValue('autoscroll-interval');
const AUTOSCROLL_INTERVAL = ConfigAutoScroll || 7000;
const recommenData = [];
const lang = getLanguageAttr();
/**
 * Clone a carousel item
 * @param {Element} item carousel item to be cloned
 * @returns the clone of the carousel item
 */
function createClone(item) {
  const clone = item.cloneNode(true);
  // Adding fallback to clone
  const cloneImg = clone.querySelector('img');
  if (cloneImg) {
    cloneImg.onerror = function (event) {
      event.onerror = null;
      const fallbackSrc = '/icons/fallback.svg';
      const elements = Array.from(event.target.parentNode.children);
      elements.forEach((element) => {
        if (element.tagName.toLowerCase() === 'source') {
          element.srcset = fallbackSrc;
        } else if (element.tagName.toLowerCase() === 'img') {
          element.classList.add('fallback');
          element.src = fallbackSrc;
        }
      });
    };
  }
  clone.classList.add('clone');
  clone.classList.remove('selected');
  return clone;
}

/**
 * trigger view_item_list DL
 */
async function triggerRecommendationDL(result, newIndex, visibleItems) {
  const { recommendationsViewItemList } = await import('../../scripts/analytics/google-data-layer.js');
  const totalProductCount = result?.[0]?.prodData?.length || 0;
  recommendationsViewItemList(
    totalProductCount,
    result?.[0]?.prodData?.slice(newIndex, newIndex + visibleItems),
    result?.[0]?.title,
    newIndex,
  );
}

function itemClassUpdation(items, newIndex, visibleItems) {
  const stopAt = newIndex + visibleItems;
  items.forEach((item, i) => {
    item.classList.remove('selected');
    if (i >= newIndex && i < stopAt && !item.classList.contains('viewed')) {
      item.classList.add('viewed');
    }
  });
}

class Carousel {
  constructor(block, data, config, mode = 'horizontal') {
    // Set defaults
    this.cssFiles = [];

    this.defaultStyling = true;

    this.defaultStyling = true;
    this.dotButtons = false;
    this.navButtons = true;
    this.infiniteScroll = false;
    this.autoScroll = false; // only available with infinite scroll
    this.autoScrollInterval = AUTOSCROLL_INTERVAL;
    this.fullPageScroll = false;
    this.currentIndex = 0;
    this.currentPage = 0;
    this.counterText = '';
    this.counterNavButtons = true;
    this.cardRenderer = this;
    this.hasImageInDots = false;
    this.mode = mode;
    this.isRTL = false;
    // this is primarily controlled by CSS,
    // but we need to know then intention for scrolling purposes
    this.visibleItems = [
      {
        items: 1,
        condition: () => true,
      },
    ];

    // Set information
    this.block = block;
    this.data = data || [...block.children];

    // Will be replaced after rendering, if available
    this.navButtonLeft = null;
    this.navButtonRight = null;

    // Apply overwrites
    Object.assign(this, config);

    this.stepSize = this.fullPageScroll ? this.getCurrentVisibleItems() : 1;

    if (this.getCurrentVisibleItems() >= this.data.length) {
      this.infiniteScroll = false;
      this.navButtons = false;
      this.block.classList.add('fully-visible');
    }

    if (this.defaultStyling) {
      this.cssFiles.push(`/blocks/carousel/${getBrandPath()}carousel.css`);
    }
  }

  getBlockPadding() {
    if (!this.blockStyle) {
      this.blockStyle = window.getComputedStyle(this.block);
    }
    return +this.blockStyle.getPropertyValue('padding-left').replace('px', '');
  }

  getScrollPosition(item) {
    let containerSize = 0;
    let itemSize = 0;
    let targetPosition = 0;
    if (this.mode === 'horizontal') {
      containerSize = item.offsetParent?.offsetWidth || 0;
      itemSize = item.offsetWidth;
      targetPosition = item.offsetLeft - this.getBlockPadding() - this.block.offsetLeft;
      if (this.isRTL && this.type === 'card') {
        targetPosition += itemSize - containerSize;
      }
      return { left: targetPosition, top: 0 };
    }
    containerSize = item.offsetParent?.offsetHeight || 0;
    itemSize = item.offsetHeight;
    targetPosition = item.offsetTop - this.getBlockPadding() - this.block.offsetTop;
    return { top: targetPosition, left: 0 };
  }

  /**
   * Scroll the carousel to the next item
   */
  nextItem() {
    const items = this.block.querySelectorAll('.carousel-item:not(.clone)');
    const selectedItem = this.block.querySelector('.carousel-item.selected');

    let index = [...items].indexOf(selectedItem);
    index = index !== -1 ? index : 0;

    let newIndex = index + this.stepSize;
    if (newIndex >= items.length) {
      newIndex = 0;
    }
    const newSelectedItem = items[newIndex];
    if (newIndex === 0 && !this.infiniteScroll) {
      return;
    }

    !this.infiniteScroll && this.navButtonRight && this.navButtonRight.classList.remove('disabled');
    !this.infiniteScroll && this.navButtonLeft && this.navButtonLeft.classList.remove('disabled');

    if (newIndex >= items.length - this.getCurrentVisibleItems() && !this.infiniteScroll) {
      this.isRTL ? this.navButtonLeft.classList.add('disabled') : this.navButtonRight.classList.add('disabled');
    }

    if (newIndex === 0) {
      // create the illusion of infinite scrolling
      let cloneItemIndex = this.getCurrentVisibleItems() - this.stepSize;
      if (cloneItemIndex < 0) {
        cloneItemIndex = 0;
      }
      const cloneCurrentItem = this.block.querySelectorAll('.carousel-item')[cloneItemIndex];
      newSelectedItem.parentNode.scrollTo(
        this.getScrollPosition(cloneCurrentItem),
      );
    }

    newSelectedItem.parentNode.scrollTo({
      ...this.getScrollPosition(newSelectedItem),
      behavior: 'smooth',
    });

    if (!newSelectedItem.classList.contains('viewed')) {
      const result = recommenData.filter((el) => el.title === this.block.getAttribute('data-target-id'));
      if (result) {
        triggerRecommendationDL(result, newIndex, this.getCurrentVisibleItems());
      }
    }

    itemClassUpdation(items, newIndex, this.getCurrentVisibleItems());
    newSelectedItem.classList.add('selected');
    this.updateGlobalState(newIndex);
  }

  getCurrentVisibleItems() {
    return this.visibleItems.filter((e) => !e.condition || e.condition())[0]
      .items;
  }

  /**
   * Scroll the carousel to the previous item
   */
  prevItem() {
    const items = this.block.querySelectorAll('.carousel-item:not(.clone)');
    const selectedItem = this.block.querySelector('.carousel-item.selected');

    let index = [...items].indexOf(selectedItem);
    index = index !== -1 ? index : 0;
    let newIndex = index - this.stepSize;
    if (newIndex < 0) {
      newIndex = items.length - this.stepSize;
    }
    const newSelectedItem = items[newIndex];

    if (newIndex === items.length - this.stepSize && !this.infiniteScroll) {
      return;
    }

    !this.infiniteScroll && this.navButtonRight && this.navButtonRight.classList.remove('disabled');
    !this.infiniteScroll && this.navButtonLeft && this.navButtonLeft.classList.remove('disabled');
    if (newIndex === 0 && !this.infiniteScroll) {
      this.isRTL
        ? this.navButtonRight.classList.add('disabled')
        : this.navButtonLeft.classList.add('disabled');
    }

    if (newIndex === items.length - this.stepSize) {
      // create the illusion of infinite scrolling
      const cloneCurrentItem = items[items.length - 1].nextElementSibling;
      newSelectedItem.parentNode.scrollTo(
        this.getScrollPosition(cloneCurrentItem),
      );
    }

    newSelectedItem.parentNode.scrollTo({
      ...this.getScrollPosition(newSelectedItem),
      behavior: 'smooth',
    });

    if (!newSelectedItem.classList.contains('viewed')) {
      const result = recommenData.filter((el) => el.title === this.block.getAttribute('data-target-id'));
      if (result) {
        triggerRecommendationDL(result, newIndex, this.getCurrentVisibleItems());
      }
    }

    itemClassUpdation(items, newIndex, this.getCurrentVisibleItems());
    newSelectedItem.classList.add('selected');
    this.updateGlobalState(newIndex);
  }

  updateGlobalState(newIndex = this.currentIndex) {
    this.currentIndex = newIndex;
    this.currentPage = Math.floor(newIndex / this.stepSize);
    if (this.dotButtons) {
      const dotButtonEls = this.block.parentNode.querySelectorAll(
        '.carousel-dot-button',
      );
      dotButtonEls.forEach((r) => r.classList.remove('selected'));
      dotButtonEls[this.currentPage].classList.add('selected');
    }
  }

  /**
   * Create clone items at the beginning and end of the carousel
   * to give the appearance of infinite scrolling
   */
  createClones() {
    if (this.block.children.length < this.getCurrentVisibleItems()) return;

    const initialChildren = [...this.block.children];
    for (let i = 0; i < this.getCurrentVisibleItems(); i += 1) {
      this.block.lastChild.after(createClone(initialChildren[i]));
      this.block.firstChild.before(
        createClone(initialChildren[initialChildren.length - 1 - i]),
      );
    }
  }

  /**
   * Create left and right arrow navigation buttons
   */
  createNavButtons(parentElement) {
    const hasHpUsp = document.querySelector('.hp-usp') !== null;
    const buttonLeft = document.createElement('button');
    buttonLeft.classList.add('carousel-nav-left');
    buttonLeft.ariaLabel = 'Scroll to previous item';
    const navIconLeft = document.createElement('span');
    navIconLeft.classList.add('icon', 'icon-chevron-left');
    buttonLeft.append(navIconLeft);
    buttonLeft.addEventListener('click', () => {
      if (!hasHpUsp) {
        clearInterval(this.intervalId);
      }
      this.isRTL ? this.nextItem() : this.prevItem();
    });

    const buttonRight = document.createElement('button');
    buttonRight.classList.add('carousel-nav-right');
    buttonRight.ariaLabel = 'Scroll to next item';
    const navIconRight = document.createElement('span');
    navIconRight.classList.add('icon', 'icon-chevron-right');
    buttonRight.append(navIconRight);
    buttonRight.addEventListener('click', () => {
      if (!hasHpUsp) {
        clearInterval(this.intervalId);
      }
      this.isRTL ? this.prevItem() : this.nextItem();
    });

    [buttonLeft, buttonRight].forEach((navButton) => {
      navButton.classList.add('carousel-nav-button');
      parentElement.append(navButton);
    });

    if (!this.infiniteScroll) {
      this.isRTL
        ? buttonRight.classList.add('disabled')
        : buttonLeft.classList.add('disabled');
    }

    decorateIcons(buttonLeft);
    decorateIcons(buttonRight);
    this.navButtonLeft = buttonLeft;
    this.navButtonRight = buttonRight;
  }

  /**
   * Adds event listeners for touch UI swiping
   */
  addSwipeCapability() {
    if (this.block.swipeCapabilityAdded) {
      return;
    }

    let touchstartX = 0;
    let touchstartY = 0;
    let touchendX = 0;
    let touchendY = 0;
    let touchmoveX = 0;
    let touchmoveY = 0;
    let carouselStartPosition = 0;
    let isScrolled = false;

    this.block.addEventListener(
      'touchstart',
      (e) => {
        carouselStartPosition = this.block.scrollLeft;
        touchstartX = e.changedTouches[0].clientX;
        touchstartY = e.changedTouches[0].clientY;
        touchmoveX = touchstartX;
        touchmoveY = touchstartY;
      },
      { passive: false }, // Allow prevention of default behavior
    );

    this.block.addEventListener(
      'touchmove',
      (e) => {
        this.block.style.scrollBehavior = 'auto';
        touchendX = e.changedTouches[0].clientX;
        touchendY = e.changedTouches[0].clientY;
        const diffX = touchendX - touchmoveX;
        const diffY = touchendY - touchmoveY;

        if (Math.abs(diffY) > Math.abs(diffX)) {
          // Allow vertical scrolling
          isScrolled = false;
        } else if (Math.abs(diffX) > 10) {
          // Lock vertical scrolling while swiping horizontally
          e.preventDefault(); // Prevent page scroll
          this.block.scrollLeft -= diffX;
          touchmoveX = touchendX;
          touchmoveY = touchendY;
          isScrolled = true;
        }
      },
      { passive: false }, // Required to use preventDefault
    );

    this.block.addEventListener(
      'touchend',
      (e) => {
        touchendX = e.changedTouches[0].clientX;
        touchendY = e.changedTouches[0].clientY;
        const diffX = touchendX - touchstartX;
        const diffY = touchendY - touchstartY;

        if (isScrolled) {
          if (Math.abs(diffX) < Math.abs(diffY) || Math.abs(diffX) < 30) {
            this.block.scrollLeft = carouselStartPosition;
            return;
          }

          if (touchendX < touchstartX) {
            clearInterval(this.intervalId);
            this.isRTL ? this.prevItem() : this.nextItem();
          }

          if (touchendX > touchstartX) {
            clearInterval(this.intervalId);
            this.isRTL ? this.nextItem() : this.prevItem();
          }
        } else if (Math.abs(diffY) >= 30 || Math.abs(diffX) <= 10) {
          this.block.scrollLeft = carouselStartPosition;
        }
      },
      { passive: false },
    );
    this.block.swipeCapabilityAdded = true;
  }

  setInitialScrollingPosition() {
    const scrollToSelectedItem = () => {
      const item = this.block.querySelector('.carousel-item.selected');
      item?.parentNode?.scrollTo(this.getScrollPosition(item));
    };

    if (this.block.classList.contains('dynamic')) {
      scrollToSelectedItem();
      return;
    }
    const section = this.block.closest('.section');

    const observer = new MutationObserver((mutationList) => {
      mutationList.forEach((mutation) => {
        if (mutation.type === 'attributes'
          && mutation.attributeName === 'data-section-status'
          && section.attributes.getNamedItem('data-section-status').value === 'loaded') {
          scrollToSelectedItem();
          observer.disconnect();
        }
      });
    });

    observer.observe(section, { attributes: true });

    // just in case the mutation observer didn't work
    setTimeout(scrollToSelectedItem, 700);

    // ensure that we disconnect the observer
    // if the animation has kicked in, we for sure no longer need it
    setTimeout(() => {
      observer.disconnect();
    }, AUTOSCROLL_INTERVAL);
  }

  createDotButtons() {
    const buttons = document.createElement('div');
    buttons.className = `carousel-dot-buttons ${
      this.hasImageInDots ? 'carousel-dot-img-buttons' : ''
    }`;
    const items = [...this.block.children];
    const numPages = Math.ceil(items.length / this.stepSize);

    for (let i = 0; i < numPages; i += 1) {
      const item = items[i * this.stepSize];
      const button = document.createElement('button');
      button.ariaLabel = `Scroll to item ${i * this.stepSize + 1}`;
      button.classList.add('carousel-dot-button');

      if (this.hasImageInDots) {
        const imgPath = item.querySelector('img').getAttribute('src');
        const customPath = imgPath.split('?')[0];
        const imgFormat = customPath.split('.')[1];
        const imgPrefix = `${customPath}?width=100&format=${imgFormat}&optimize=medium`;
        const imgEl = document.createElement('img');
        imgEl.src = imgPrefix;
        button.appendChild(imgEl);
      }

      if (i === this.currentPage) {
        button.classList.add('selected');
      }

      button.addEventListener('click', () => {
        clearInterval(this.intervalId);
        this.block.scrollTo({
          ...this.getScrollPosition(item),
          behavior: 'smooth',
        });
        [...buttons.children].forEach((r) => r.classList.remove('selected'));
        items.forEach((r) => r.classList.remove('selected'));
        button.classList.add('selected');
        item.classList.add('selected');
      });
      buttons.append(button);
    }
    this.block.parentElement.append(buttons);
  }

  /*
   * Changing the default rendering may break carousels that rely on it
   * (e.g. CSS might not match anymore)
   */
  // eslint-disable-next-line class-methods-use-this
  renderItem(item) {
    // create the carousel content
    const columnContainer = document.createElement('div');
    columnContainer.classList.add('carousel-item-columns-container');

    const columns = [
      document.createElement('div'),
      document.createElement('div'),
    ];

    const itemChildren = [...item.children];
    itemChildren.forEach((itemChild, idx) => {
      if (itemChild.querySelector('img')) {
        itemChild.classList.add('carousel-item-image');
      } else {
        itemChild.classList.add('carousel-item-text');
      }
      columns[idx].appendChild(itemChild);
    });

    columns.forEach((column) => {
      column.classList.add('carousel-item-column');
      columnContainer.appendChild(column);
    });
    return columnContainer;
  }

  async render() {
    // copy carousel styles to the wrapper too
    if (this.block.classList.contains('recommendations')) {
      this.block.parentElement.classList.add(
        ...[...this.block.classList].filter(
          (item, idx) => idx !== 0 && item !== 'block' && item !== 'carousel',
        ),
      );
    } else {
      this.block.parentElement.classList.add(
        ...[...this.block.classList].filter(
          (item, idx) => idx !== 0 && item !== 'block',
        ),
      );
    }

    let defaultCSSPromise;
    if (Array.isArray(this.cssFiles) && this.cssFiles.length > 0) {
      // add default carousel classes to apply default CSS
      defaultCSSPromise = Promise.all(this.cssFiles.map(loadCSS));
      this.block.parentElement.classList.add('carousel-wrapper');
      this.block.classList.add('carousel');
    }

    this.block.innerHTML = '';
    this.data.forEach((item, index) => {
      const itemContainer = document.createElement('div');
      itemContainer.classList.add(
        'carousel-item',
        `carousel-item-${index + 1}`,
      );
      itemContainer.setAttribute('data-index', `${index + 1}`);

      let renderedItem = this.cardRenderer.renderItem(item);
      renderedItem = Array.isArray(renderedItem)
        ? renderedItem
        : [renderedItem];
      renderedItem.forEach((renderedItemElement) => {
        itemContainer.appendChild(renderedItemElement);
      });
      this.block.appendChild(itemContainer);
    });

    // set initial selected carousel item
    const activeItems = this.block.querySelectorAll(
      '.carousel-item:not(.clone)',
    );
    activeItems[this.currentIndex]?.classList.add('selected');

    // create autoscrolling animation
    this.autoScroll && this.infiniteScroll
    && (this.intervalId = setInterval(() => { this.nextItem(); }, this.autoScrollInterval));
    this.dotButtons && this.createDotButtons();
    this.navButtons && this.createNavButtons(this.block.parentElement);
    this.infiniteScroll && this.createClones();
    this.addSwipeCapability();
    this.infiniteScroll && this.setInitialScrollingPosition();
    this.cssFiles && (await defaultCSSPromise);

    // set viewed class
    itemClassUpdation(activeItems, this.currentIndex, this.getCurrentVisibleItems());
  }
}

/**
 * Create and render default carousel.
 * Best practice: Create a new block and call the function, instead using or modifying this.
 * @param {Element}  block        required - target block
 * @param {Array}    data         optional - a list of data elements.
 *  either a list of objects or a list of divs.
 *  if not provided: the div children of the block are used
 * @param {Object}   config       optional - config object for
 * @param {String}   mode       optional - vertical or horizontal
 * customizing the rendering and behaviour
 */
export async function createCarousel(block, data, config, mode) {
  if (block?.classList?.contains('banner-carousel')) {
    const isCollectionCarousel = block?.classList?.contains('banner-carousel');
    config.visibleItems[1].items = isCollectionCarousel ? 3 : 4;
  }
  const carousel = new Carousel(block, data, config, mode);
  await carousel.render();
  return carousel;
}

function findIndexVal(anchor) {
  const carouselItem = anchor?.parentElement?.parentElement;
  const [, indexVal] = carouselItem?.className?.match(/carousel-item-(\d+)/) || [];
  return indexVal;
}

/**
 * Method to handle datalayer and target events on recommendations card click
 *
 * @param {*} item Careousel item
 * @param {*} anchor selected anchor
 * @param {*} productData Product Data
 * @param {*} totalProducts Total number of products
 */
async function handleCardClick(event, block, anchor, productData, totalProducts) {
  if (block.dataset.blockName !== 'recommendations' || window.DISABLE_MARTECH) {
    return;
  }
  event.preventDefault();
  const {
    dataset: { targetId, titleEn: recommendationName },
  } = block;

  const [
    { targetClickTrackingEvent },
    { datalayerSelectRecommendedItemListEvent },
  ] = await Promise.all([
    import('../../scripts/target/target-events.js'),
    import('../../scripts/analytics/google-data-layer.js'),
  ]);

  await Promise.all([
    targetClickTrackingEvent({ key: targetId, recommendationName }),
    datalayerSelectRecommendedItemListEvent(
      productData,
      targetId,
      totalProducts,
      recommendationName,
      findIndexVal(anchor),
    ),
  ]);
  const indexVal = anchor?.parentNode?.parentNode?.getAttribute('data-index');
  const currentUrl = new URL(anchor.href, window.location.origin); // Creating URL object
  const dlObject = {
    index: indexVal,
  };
  // Adding Base64 encoded dlObject to URL query params
  currentUrl.searchParams.append(
    'dlObject',
    btoa(JSON.stringify(dlObject)),
  );
  anchor.href = currentUrl.toString(); // Updating href with new URL
  // Check if the user pressed the Ctrl key (Windows/Linux) or Command key (macOS)
  const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey for macOS
  // Check if the user clicked the link
  const isClicked = event.type === 'click';
  if (isCtrlPressed && isClicked) {
    const a = document.createElement('a');
    a.target = '_blank';
    a.href = anchor.href;
    a.click();
  } else {
    window.location.href = anchor.href;
  }
}

/**
 * Custom card style config and rendering of carousel items.
 */
export function renderCardItem(item) {
  item.classList.add('card');
  const itemLink = item.querySelector(':scope > div:first-child a');
  if (itemLink) {
    itemLink.textContent = '';
    item.append(itemLink);
    if (this.socialShare) {
      const shareIconEl = this.socialShare.socialShareLink.cloneNode(true);
      const productTitle = item.querySelector(
        ':scope > div:nth-child(2) p',
      )?.textContent;
      item.prepend(shareIconEl);
      shareIconEl.addEventListener('click', async (e) => {
        const { createAndOpenModal } = await import(
          '../social-share/social-share.js'
        );
        e.preventDefault();
        await createAndOpenModal({
          ...this.socialShare.socialShareModal,
          shareTitle: productTitle,
          shareUrl: itemLink.getAttribute('href'),
        });
      });
    }
    item.querySelectorAll(':scope > div').forEach((el) => {
      itemLink.append(el);
    });
  }
  return item;
}

const cardStyleConfig = {
  visibleItems: [
    {
      items: 2,
      condition: () => window.innerWidth < 768,
    },
    {
      items: 4,
    },
  ],
  renderItem: renderCardItem,
  type: 'card',
};

const inlineStyleConfig = {};
function setTextContent(element, englishText, arabicText) {
  if (document.documentElement.lang === 'ar') {
    element.textContent = arabicText;
  } else {
    element.textContent = englishText;
  }
}

function commonStyle(block) {
  return {
    dotButtons: block.classList.contains('dot-buttons'),
    autoScroll: block.classList.contains('auto-scroll'),
    infiniteScroll: block.classList.contains('infinite-scroll'),
    fullPageScroll: block.classList.contains('full-page-scroll'),
    isRTL: document.documentElement.dir === 'rtl',
  };
}
export default async function decorate(block) {
  const blockChildren = [...block.children];
  const showShareIcon = block.classList.contains('social-share');
  let socialShare = null;
  if (showShareIcon) {
    const { loadSocialShareModal, createShareIcon } = await import(
      '../social-share/social-share.js'
    );
    const socialShareModal = await loadSocialShareModal();
    const socialShareLink = await createShareIcon(
      socialShareModal?.socialShareOverlayTitle,
      'icon-share round-icon no-border',
    );
    socialShare = {
      socialShareLink,
      socialShareModal,
    };
    decorateIcons(socialShareLink);
  }
  const commonStyleConfig = Object.assign(commonStyle(block), { socialShare });
  if (block.classList.contains('cards')) {
    await createCarousel(block, blockChildren, {
      ...commonStyleConfig,
      ...cardStyleConfig,
    });
  } else if (block.classList.contains('inline')) {
    if (blockChildren.length <= 4) {
      inlineStyleConfig.visibleItems = [
        {
          items: 1,
          condition: () => window.innerWidth < 768,
        },
        {
          items: blockChildren.length,
        },
      ];
    }
    await createCarousel(block, blockChildren, {
      ...commonStyleConfig,
      ...inlineStyleConfig,
    });
  } else {
    await createCarousel(block, null, commonStyleConfig);
  }
}

export function recommendationCarousalVariation(block, products) {
  if (products.children.length > 0) {
    Array.from(products.children).forEach((product) => {
      block.appendChild(product);
    });
  }
  decorate(block);
}

export async function decorateDynamicCarousel(block, jsonData) {
  const placeholders = await fetchPlaceholdersForLocale();
  const currencyCode = await getConfigValue('currency');
  block.parentElement.replaceChildren(block);
  block.innerHTML = '';
  block.classList.add('dynamic');
  /* Creating structure for card consisting Image and Title/Price */
  await jsonData.reduce(async (promise, products) => {
    await promise;
    const { en, ar } = products.productData.name;
    const itemContainer = document.createElement('div');
    let imageWrapper = null;
    if (products?.productData?.amasty_label) {
      const firstLink = products.productData.amasty_label.split(',')[0].trim();
      imageWrapper = document.createElement('div');
      imageWrapper.className = 'image-wrapper';
      const imgElement = document.createElement('img');
      imgElement.src = firstLink;
      imageWrapper.appendChild(imgElement);
    }
    const parentLinkImgDiv = document.createElement('div');
    parentLinkImgDiv.classList.add('recommendation-picture');
    const imgSrc = products?.productData?.image_url?.[document.documentElement.lang] || ('/icons/fallback.svg');
    const image = createOptimizedPicture(
      imgSrc,
      false,
      placeholders?.imageUnavailableAltText,
    );
    const anchor = document.createElement('a');
    const firstUrl = window.location.origin + (products?.productData?.url[document.documentElement.lang] || '');
    anchor.href = firstUrl;
    anchor.target = '_self';
    anchor.rel = 'noopener';
    setTextContent(anchor, en, ar);
    parentLinkImgDiv.appendChild(image);
    parentLinkImgDiv.appendChild(anchor);
    const titleDiv = document.createElement('div');
    const titleParagraph = document.createElement('p');
    setTextContent(titleParagraph, en, ar);
    titleDiv.appendChild(titleParagraph);

    const promotionsDiv = document.createElement('div');
    promotionsDiv.className = 'promotions';

    const skuPromotionLink = document.createElement('p');
    skuPromotionLink.className = 'promotion-link';
    const promos = products?.productData?.promo_label[document.documentElement.lang] || '';

    // Split the promos into parts and filter only those starting with "web|"
    const promosWebPart = promos.split(',')
      .map((part) => part.trim()) // Trim whitespace
      .filter((part) => part.startsWith('web|')) // Only include web parts
      .map((part) => part.slice(4)); // Remove the "web|" prefix

    skuPromotionLink.textContent = promosWebPart;
    promotionsDiv.appendChild(skuPromotionLink);
    if (products.productData.discount > 0) {
      const priceContainer = document.createElement('div');
      priceContainer.classList.add('price-wrapper');
      const originalPriceParagraph = document.createElement('p');
      originalPriceParagraph.classList.add('dynamic-price');
      originalPriceParagraph.textContent = await formatPrice(
        currencyCode,
        products.productData.regular_price,
      );

      const spcialPrice = products.productData.special_price;
      const specialPriceParagraph = document.createElement('p');
      specialPriceParagraph.classList.add('discount-text');
      specialPriceParagraph.textContent = await formatPrice(
        currencyCode,
        spcialPrice,
      );

      priceContainer.appendChild(originalPriceParagraph);
      priceContainer.appendChild(specialPriceParagraph);

      const memberPrice = products.productData.hello_member;
      if (memberPrice > 0) {
        const memberPriceContainer = document.createElement('div');
        memberPriceContainer.classList.add('member-price-wrapper');
        const memberPriceTextParagraph = document.createElement('p');
        memberPriceTextParagraph.classList.add('member-price');
        const formattedPrice = await formatPrice(
          currencyCode,
          memberPrice,
        );
        memberPriceTextParagraph.textContent = `${formattedPrice} ${placeholders.memberText || 'Member Price'}`;
        if (isLoggedInUser()) {
          priceContainer.classList.add('logged-in');
        }

        priceContainer.appendChild(memberPriceTextParagraph);
        memberPriceContainer.appendChild(memberPriceTextParagraph);
        priceContainer.appendChild(memberPriceContainer);
      }

      if (spcialPrice < memberPrice) {
        specialPriceParagraph.classList.add('not-scratched');
      }

      const discountTextParagraph = document.createElement('div');
      discountTextParagraph.classList.add('discount-text');
      discountTextParagraph.textContent = `(${placeholders.plpSave} ${Math.round(
        parseInt(products.productData.discount, 10),
      )}%)`;

      titleDiv.appendChild(priceContainer);
      titleDiv.appendChild(discountTextParagraph);
    } else {
      const priceParagraph = document.createElement('p');
      priceParagraph.textContent = await formatPrice(
        currencyCode,
        products.productData?.special_price,
      );
      titleDiv.appendChild(priceParagraph);
      const memberPrice = products?.productData?.hello_member;
      if (memberPrice > 0) {
        const formattedPrice = await formatPrice(currencyCode, memberPrice);
        titleDiv.insertAdjacentHTML(
          'beforeend',
          `<p class="member-price">${
            lang === 'ar'
              ? `${placeholders.memberText || 'Member Price'} ${formattedPrice}`
              : `${formattedPrice} ${placeholders.memberText || 'Member Price'}`
          }</p>`,
        );
      }
    }
    anchor?.addEventListener('click', async (event) => handleCardClick(event, block, anchor, products, jsonData.length));
    itemContainer.appendChild(parentLinkImgDiv);
    if (imageWrapper) { itemContainer.appendChild(imageWrapper); }
    itemContainer.appendChild(titleDiv);
    itemContainer.appendChild(promotionsDiv);
    block.appendChild(itemContainer);
  }, Promise.resolve());

  /* Passing that structure to decorate to build the DOM */
  decorate(block);
}

export function recommendationData(prodData, title) {
  const tempObj = {
    prodData,
    title,
  };
  recommenData.push(tempObj);
}
