import { readBlockConfig } from '../../scripts/aem.js';
import { fetchIndex, loadFragment } from '../../scripts/scripts.js';
import { getSkuFromUrl } from '../../scripts/commerce.js';

export default async function decorate(block) {
  const { type, position } = readBlockConfig(block);

  const filters = {};
  if (type === 'product') {
    const productSku = getSkuFromUrl();
    if (!productSku) return;
    filters.products = productSku;
  }

  if (type === 'category') {
    const plpBlock = document.querySelector('.block.product-list-page');
    if (!plpBlock) return;

    let categoryId = plpBlock.dataset?.category;
    if (!categoryId) {
      categoryId = readBlockConfig(plpBlock).category;
    }
    if (!categoryId) return;
    filters.categories = categoryId;
  }

  if (position) {
    filters.positions = position;
  }

  const index = await fetchIndex('enrichment/enrichment');
  const matchingFragments = index.data
    .filter((fragment) => Object.keys(filters).every((filterKey) => {
      const values = JSON.parse(fragment[filterKey]);
      return values.includes(filters[filterKey]);
    }))
    .map((fragment) => fragment.path);

  (await Promise.all(matchingFragments.map((path) => loadFragment(path))))
    .filter((fragment) => fragment)
    .forEach((fragment) => {
      const sections = fragment.querySelectorAll(':scope .section');

      // If only single section, replace block with content of section
      if (sections.length === 1) {
        block.closest('.section').classList.add(...sections[0].classList);
        const wrapper = block.closest('.enrichment-wrapper');
        Array.from(sections[0].children)
          .forEach((child) => wrapper.parentNode.insertBefore(child, wrapper));
      } else if (sections.length > 1) {
        // If multiple sections, insert them after section of block
        const blockSection = block.closest('.section');
        Array.from(sections)
          .reverse()
          .forEach((section) => blockSection
            .parentNode.insertBefore(section, blockSection.nextSibling));
      }
    });

  block.closest('.enrichment-wrapper')?.remove();
}
