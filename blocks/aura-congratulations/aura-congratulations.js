import {
  fetchPlaceholdersForLocale,
} from '../../scripts/scripts.js';

export default async function decorate(block) {
  const containerClasses = ['congratulations-title', 'aura-pointers', 'aura-quick-enrolled', 'aura-full-enrolled', 'aura-social'];
  Array.from(block.children).forEach((child, index) => {
    child.classList.add(containerClasses[index]);
  });

  const placeholders = await fetchPlaceholdersForLocale();
  const continueShoppingWrapper = document.createElement('div');
  continueShoppingWrapper.classList.add('aura-buttons');
  continueShoppingWrapper.innerHTML = `<button class="secondary-btn"><span>${placeholders.continueShopping || 'Continue Shopping'}</span></button>`;
  block.append(continueShoppingWrapper);
}
