import { fetchPlaceholdersForLocale, replacePlaceholders, redirectRegisterURL } from '../../scripts/scripts.js';

function linkPicture(picture) {
  const parent = picture.parentNode;
  if (parent) {
    const a = parent.querySelector('a');
    if (a && a.textContent.startsWith('https://')) {
      a.innerHTML = '';
      a.className = '';
      a.appendChild(picture);
    }
  }
}

/**
 * Adds link to images
 * @param {Element} main The main element
 */
function decorateLinkedPictures(block) {
  block.querySelectorAll('picture').forEach((picture) => {
    linkPicture(picture);
  });
}

export default async function decorate(block) {
  const placeholders = await fetchPlaceholdersForLocale();
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  if (block.classList.contains('dynamic-keys')) {
    replacePlaceholders(block, placeholders);
  }
  block.classList.add(`columns-${cols.length}-cols`);
  const isTwoColumnBanner = block.classList.contains('two-column-banner');
  const isImageWithLink = block.classList.contains('image-with-link');
  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });
  if (isTwoColumnBanner) {
    import('./two-columns-banner.js').then((module) => {
      module.default(block);
    });
  }
  if (isImageWithLink) {
    decorateLinkedPictures(block);
  }
  const columnsContainer = block.parentNode.parentNode;
  if (columnsContainer) {
    redirectRegisterURL(columnsContainer, 'a.button');
  }
}
