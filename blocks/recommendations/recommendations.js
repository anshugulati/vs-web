import { decorateDynamicCarousel, recommendationData } from '../carousel/carousel.js';
import { EVENT_QUEUE, targetDisplayEvent } from '../../scripts/target/target-events.js';
import { recommendationsViewItemList } from '../../scripts/analytics/google-data-layer.js';
import { loadFragment, getLanguageAttr, fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
import { getConfigValue } from '../../scripts/configs.js';

/**
 * Map to store previously visited tabs
 */
const previouslyVisitedTabs = new Map();
const productListingLanguage = getLanguageAttr();
const recommendCarouselVariation = await getConfigValue('recommendation-carousel-variation');

/**
 * set count of visible items
 */
const visibleItems = window.innerWidth < 768 ? 2 : 4;

/**
 * loader DOM structre is created for carousel
 * @returns DOM structure
 */
function createSkeletonLoader() {
  let skeletonCards = '';
  for (let i = 0; i < visibleItems; i += 1) {
    skeletonCards += `
      <div class="carousel-item carousel-item-${i + 1}">
        <div class="card">
          <div class="skeleton-image"></div>
          <div class="skeleton-text skeleton-text-title"></div>
          <div class="skeleton-text skeleton-text-price"></div>
        </div>
      </div>
    `;
  }
  const skeletonHTML = `
    <div class="skeleton-container">
      ${skeletonCards}
    </div>
  `;
  const skeletonContainer = document.createElement('div');
  skeletonContainer.innerHTML = skeletonHTML;
  return skeletonContainer;
}

/**
 * Add data attributes to the block
 * @param {*} block Block to be decorated
 * @param {*} param list of data attributes to be updated
 */
function updateDataAttributes(block, [targetId, titleEn = '', blockName = 'recommendations']) {
  block.dataset.targetId = targetId;
  block.dataset.titleEn = titleEn;
  block.dataset.blockName = blockName;
}

/**
 * Function to trigger view_item_list DL once it is in viewport or on changing tabs
 */
function triggerViewItemListDL(block, data, key) {
  recommendationData(data, block.dataset.targetId);

  // Create an IntersectionObserver to trigger `recommendationsViewItemList` when in viewport
  // eslint-disable-next-line no-shadow
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const totalProductCount = data?.length || 0;
        recommendationsViewItemList(
          totalProductCount,
          data?.slice(0, visibleItems),
          block.dataset.titleEn,
          0,
          key,
        );
        // Disconnect observer after triggering to avoid repeated calls
        observer.disconnect();
      }
    });
  });

  // Observe the block element
  observer.observe(block);
}

/**
 * Decorate/update tabbed carousel with selectd tab data
 * @param {*} block
 * @param {*} recommendations New data according to user selected tab
 */
function updateCarouselContainerClasses(block, recommendations) {
  const carouselContainer = block.querySelector('.tabs-panel[aria-hidden="false"] div');
  carouselContainer.classList.add(...block.classList.value.split(' '));
  const { targetId, titleEn, blockName } = block.dataset;
  updateDataAttributes(carouselContainer, [targetId, titleEn, blockName]);
  carouselContainer.parentElement.replaceChildren(carouselContainer);
  decorateDynamicCarousel(carouselContainer, recommendations);
  if (!previouslyVisitedTabs.has(targetId)) {
    triggerViewItemListDL(block, recommendations, targetId);
  }
  carouselContainer.classList.add('hide-clone');
}

/**
 * Get the event data from event queue based on the provided key
 * @param {*} selectedKey
 * @returns
 */
function getRecommendationsData(selectedKey) {
  const eventData = EVENT_QUEUE?.find((el) => el.key === selectedKey)
    ?.data[0]?.data?.content || null;
  try {
    const parsedEventData = JSON.parse(eventData);
    if (parsedEventData?.recommendations?.length > 20) {
      parsedEventData.recommendations.length = 20;
    }
    return parsedEventData;
  } catch {
    return null;
  }
}

/**
 * Send display event for the tab if it is not visited previously.
 * It is applicable only for the tabbed carousel in recommendations block
 * @param {*} selectedTabKey targetId of the currently active tab
 */
function sendTabDisplayEvent(selectedTabKey) {
  if (previouslyVisitedTabs.has(selectedTabKey)) return;
  const eventData = EVENT_QUEUE.find((event) => event.key === selectedTabKey);
  if (!eventData) return;
  targetDisplayEvent([eventData]);
  previouslyVisitedTabs.set(selectedTabKey, true);
}

/**
 * Handle the user tab click, Based on the click decorate carousel block
 * @param {*} event
 * @param {*} block
 * @returns
 */
function handleTabClick(event, block) {
  const { target: { dataset: { tabKey }, classList } } = event;
  if (classList.contains('tabs-tab')) {
    const selectedTabKey = tabKey;
    const newData = getRecommendationsData(selectedTabKey);
    updateDataAttributes(block, [selectedTabKey, block.dataset.titleEn]);
    if (!newData) return;
    updateCarouselContainerClasses(block, newData.recommendations);
    sendTabDisplayEvent(selectedTabKey);
  }
}

/**
 * Handles fallback scenario of not having data for tab at event queue
 * @param {*} block
 */
async function setTabVisibility(block) {
  const tabButtons = block.querySelectorAll('.tabs-tab');
  tabButtons.forEach((button) => {
    const currentTabKey = button.dataset.tabKey;
    const responseDataCheck = EVENT_QUEUE?.find((event) => event.key === currentTabKey)
      ?.data[0]?.data?.content;
    if (!responseDataCheck) {
      button.remove();
      const associatedPanel = button.getAttribute('aria-controls');
      block.querySelector(`#${associatedPanel}`)?.remove();
    }
  });
  block.querySelectorAll('.tabs-tab')?.[0]?.setAttribute('aria-selected', 'true');
  block.querySelectorAll('.tabs-panel')?.[0]?.setAttribute('aria-hidden', 'false');
}

/**
 * Creates title structure for recommendations
 * @param {*} title getting title for recommendations
 * @param {*} lang getting global language
 * @returns
 */
function createTitleContainer(title, lang) {
  const recommendationsHeading = document.createElement('h5');
  recommendationsHeading.classList.add('default-content-wrapper');
  recommendationsHeading.textContent = title?.[lang];
  return recommendationsHeading;
}

/**
 * Fun adds title from target response dynamically
 * @param {*} parentDiv getting parent of block
 * @param {*} title getting title from target
 */
function dynamicRecommendationsTitle(parentDiv, title) {
  const lang = getLanguageAttr();
  const recommendationsTitle = parentDiv.querySelector('.default-content-wrapper');
  if (recommendationsTitle) {
    recommendationsTitle.innerHTML = createTitleContainer(title, lang).outerHTML;
  } else if (parentDiv.classList.contains('no-results')) {
    const titleContainer = createTitleContainer(title, lang);
    const noSearchText = parentDiv?.querySelector('.default-content-wrapper p');
    noSearchText?.insertAdjacentElement('afterend', titleContainer);
  } else if (!parentDiv.querySelector('h5')) {
    const titleContainer = createTitleContainer(title, lang);
    parentDiv.prepend(titleContainer);
  }
}

function dynamicRecommendationsSubTitle(parentDiv, subTitle) {
  const titleContainer = createTitleContainer(subTitle, productListingLanguage);
  titleContainer.classList.add('recommendation-carousel-subtext');
  if (parentDiv && parentDiv.firstChild) {
    parentDiv.insertBefore(titleContainer, parentDiv.firstChild.nextSibling);
  }
}

// Map Recommendation Carousel data
function mapRecommendationProducts(recommendationProducts, title) {
  return recommendationProducts.map((dataItems) => ({
    ...dataItems.productData,
    sku: dataItems.sku,
    attr_bv_average_overall_rating: dataItems.productData.rating,
    attr_product_brand: dataItems.productData.brand[productListingLanguage],
    title: dataItems.productData.name[productListingLanguage],
    attr_collection_1: [dataItems.productData.form[productListingLanguage]],
    media: [dataItems.productData.image_url[productListingLanguage]].map((img) => ({
      url: img,
    })),
    original_price: {
      [productListingLanguage]: dataItems.productData.regular_price,
    },
    final_price: {
      [productListingLanguage]: dataItems.productData.special_price,
    },
    gtm: {
      gtm_price: dataItems.productData.special_price,
      gtm_name: dataItems.productData.name.en,
      gtm_brand: dataItems.productData.brand,
      gtm_category: dataItems.productData.category.en.replaceAll('|', '/'),
      gtm_listname: title,
    },
  }));
}

const dataListener = async (block) => {
  if (block.classList.contains('tab')) {
    const recommendationsBlock = await loadFragment(`${block.dataset.tabUrl}`);
    const blockTitle = recommendationsBlock?.querySelector('.default-content-wrapper')?.textContent;
    if (EVENT_QUEUE?.length === 0 || !EVENT_QUEUE?.some((event) => event?.key?.startsWith('hm-hp-pr-1-'))) {
      const recommendationsMainBlock = document.querySelector('.recommendations.tab.block');
      recommendationsMainBlock?.remove();
      return;
    }
    await setTabVisibility(recommendationsBlock);
    block.appendChild(recommendationsBlock);
    const tabList = block.querySelector('.tabs-list');
    tabList?.addEventListener('click', (tabsEvent) => handleTabClick(tabsEvent, block));
    const selectedTab = block.querySelector('.tabs-list button[aria-selected="true"]');
    const selectedTabKey = selectedTab ? selectedTab.dataset.tabKey : null;
    updateDataAttributes(block, [selectedTabKey, blockTitle]);
    const tabData = getRecommendationsData(selectedTabKey);
    if (!tabData) return;
    const skeletonContainer = block.querySelector('.skeleton-container');
    skeletonContainer?.remove();
    updateCarouselContainerClasses(block, tabData.recommendations);
    sendTabDisplayEvent(selectedTabKey);
  } else {
    const key = block.dataset.targetId;
    const data = getRecommendationsData(key);
    block.dataset.titleEn = data?.title?.en || 'Recommendations';
    if (!data) {
      block.innerHTML = '';
      return;
    }

    block.parentElement.classList.add('carousel-wrapper');
    dynamicRecommendationsTitle(block.parentElement.parentNode, data.title);
    if (recommendCarouselVariation && recommendCarouselVariation !== 'false') {
      dynamicRecommendationsSubTitle(block.parentElement.parentNode, data.sub_text);
      const placeholders = await fetchPlaceholdersForLocale();
      const { buildHits, getProductListingConfig, updateWishlistIcons } = await import('../algolia-product-listing/algolia-product-listing.js');
      const config = await getProductListingConfig();
      let recommendationProducts = data?.recommendations;
      recommendationProducts = mapRecommendationProducts(
        recommendationProducts,
        data.title.en,
      );
      const response = {
        results: [
          {
            hits: recommendationProducts,
          },
        ],
      };
      buildHits(response, { config, placeholdersList: placeholders, blocktype: block });
      updateWishlistIcons();
    } else {
      decorateDynamicCarousel(block, data.recommendations);
    }

    triggerViewItemListDL(block, data?.recommendations, key);
  }
};

export default async function decorate(block) {
  const initialBlock = block.outerHTML;
  block.append(createSkeletonLoader());
  window.addEventListener('target-response', () => dataListener(block), { once: true });
  if (block.classList.contains('refresh')) {
    window.addEventListener('refresh-target', () => {
      block.innerHTML = initialBlock;
      dataListener(block);
    });
  }
}
