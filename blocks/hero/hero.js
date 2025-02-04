import { fetchPlaceholdersForLocale, redirectRegisterURL, replacePlaceholders } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const imageLink = block.classList.contains('image-link');
  const [picture, title, description, link] = block.querySelectorAll(':scope div > div > *');
  const placeholders = await fetchPlaceholdersForLocale();
  let heroBlock = `
    <div class="hero-left">
        ${picture.outerHTML}
    </div>
  `;

  if (title || description || link) {
    heroBlock += `
    <div class="hero-right">
        ${title?.outerHTML || ''}
        ${description?.outerHTML || ''}
        ${link?.outerHTML || ''}
    </div>`;
  }

  if (imageLink) {
    const linkUrl = block.querySelector('a')?.href;

    heroBlock = `
    <div class="hero-left">
      <a href="${linkUrl}" class="hero-link">
        ${picture?.outerHTML}
      </a>
    </div>`;

    if (title || description) {
      heroBlock += `
      <div class="hero-right">
      <a href="${linkUrl}" class="hero-link"></a>
        ${title?.outerHTML}
        ${description?.outerHTML}
      </div>`;
    }
  }

  heroBlock = `<div>${heroBlock}</div>`;
  block.innerHTML = heroBlock;

  if (block.classList.contains('dynamic-keys')) {
    replacePlaceholders(block, placeholders);
  }

  redirectRegisterURL(block, 'a.button');
}
