/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import { fetchPlaceholdersForLocale, loadFragment, replacePlaceholders } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();

  const fragment = window.preloadedFragments[path] ?? await loadFragment(path);
  if (fragment) {
    const placeholders = await fetchPlaceholdersForLocale();
    replacePlaceholders(fragment, placeholders);
    const fragmentSection = fragment.querySelector(':scope .section');
    if (fragmentSection) {
      block.closest('.section').classList.add(...fragmentSection.classList);
      block.closest('.fragment').replaceWith(...fragment.childNodes);
    }
  }
}
