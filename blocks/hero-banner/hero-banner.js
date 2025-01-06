import { createOptimizedPicture } from '../../scripts/scripts.js';

export default function decorate(block) {
  const picture = block.querySelector('picture');
  const texts = block.querySelectorAll('div:nth-child(2) p');

  const optimizedPicture = createOptimizedPicture(
    picture.querySelector('img').src,
    picture.querySelector('img').alt
  );

  const limitedTimeText = texts[0]?.textContent || '';
  const priceText = `${texts[1]?.textContent || ''}<br>${texts[2]?.textContent || ''}`;
  const detailsText = texts[3]?.textContent || '';
  const shopNowLink = document.createElement('a');
  shopNowLink.href = '#';
  shopNowLink.classList.add('shop-now');
  shopNowLink.textContent = texts[4]?.textContent || '';

  block.innerHTML = `
    <div class="hero-banner-content">
      <div class="hero-banner-images">
        ${optimizedPicture.outerHTML}
        <div class="hero-banner-text-overlay">
          <p class="limited-time">${limitedTimeText}</p>
          <p class="price">${priceText}</p>
          <p class="details">${detailsText}</p>
          ${shopNowLink.outerHTML}
        </div>
      </div>
    </div>
  `;
}
