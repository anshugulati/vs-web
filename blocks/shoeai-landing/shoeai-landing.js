import { createShoeAi } from '../../scripts/scripts.js';

export default async function decorate() {
  // Select the banner content element on the page.
  const bannerContent = document.querySelector('.shoeai-landing-container .banner-content-wrapper .banner-content');
  if (bannerContent) {
    // Create a new div element for the ShoeSizeMe functionality.
    const shoeSizeMe = document.createElement('div');
    // Add relevant classes.
    shoeSizeMe.classList.add('ShoeSizeMe', 'ssm_LP', 'cta-red');
    shoeSizeMe.setAttribute('data-touchpoint', 'ssm-landing');
    // Clear any existing content in the banner.
    bannerContent.innerHTML = '';
    bannerContent.appendChild(shoeSizeMe);
  }
  createShoeAi();
}
