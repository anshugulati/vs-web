import { loadFragment, fetchPlaceholdersForLocale } from '../../scripts/scripts.js';

function closeDrawer(sideDrawer, overlay) {
  sideDrawer.remove();
  overlay.remove();
}

export async function createSideDrawer(contentNodes) {
  const placeholders = await fetchPlaceholdersForLocale();
  const sideDrawer = document.createElement('div');
  sideDrawer.setAttribute('id', 'side-drawer-wrapper');
  sideDrawer.classList.add('side-drawer-wrapper');
  const overlay = document.createElement('div');
  overlay.classList.add('overlay');
  const sideDrawerContent = document.createElement('div');

  sideDrawerContent.classList.add('side-drawer-content');
  sideDrawerContent.append(...contentNodes);

  sideDrawer.append(sideDrawerContent);
  document.body.append(overlay);
  document.body.append(sideDrawer);
  const sideDrawerHeader = document.querySelector('.side-drawer-wrapper .default-content-wrapper');
  const closeButton = document.createElement('button');
  closeButton.classList.add('close-button');
  closeButton.setAttribute('aria-label', `${placeholders.close || 'Close'}`);
  closeButton.type = 'button';
  closeButton.innerHTML = '<span class="icon icon-close"></span>';
  closeButton.addEventListener('click', () => sideDrawer.close());
  sideDrawerHeader.append(closeButton);
  sideDrawer.prepend(sideDrawerHeader);

  closeButton.addEventListener('click', () => {
    closeDrawer(sideDrawer, overlay);
  });

  overlay.addEventListener('click', () => {
    closeDrawer(sideDrawer, overlay);
  });

  document.body.append(sideDrawer);
}

export async function openDrawer(fragmentUrl) {
  try {
    const path = fragmentUrl.startsWith('http')
      ? new URL(fragmentUrl, window.location).pathname
      : fragmentUrl;
    const fragment = await loadFragment(path);
    createSideDrawer(fragment.childNodes);
  } catch (error) {
    console.log(error);
  }
}

export function renderSideDrawer() {
  const detailsCTA = document.querySelector('.vif .section.carousel-container .carousel-wrapper.promo-bar .carousel.promo-bar .carousel-item .carousel-item-columns-container .carousel-item-column .carousel-item-text > a');
  detailsCTA?.setAttribute('id', 'details-cta');

  detailsCTA.addEventListener('click', async (e) => {
    e.preventDefault();
    const origin = e.target;
    if (origin && origin.href) {
      openDrawer(origin.href);
    }
  });
}

export default async function decorate(block) {
  console.log('Promo bar block', block.outerHTML);
}
