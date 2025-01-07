import { decorateIcons } from '../../scripts/aem.js';

export default function decorate(block) {
  const titleText = block.querySelector('div > div').textContent.trim();
  block.innerHTML = `
    <h2>${titleText}</h2>
  `;
  decorateIcons(block);
}
