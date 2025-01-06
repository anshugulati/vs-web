import { decorateIcons } from '../../scripts/aem.js';

export default function decorate(block) {
  const data = {
    title: block.querySelector('div > div > p:nth-of-type(1)').textContent,
    subtitle: block.querySelector('div > div > p:nth-of-type(2)').textContent,
    description: block.querySelector('div > div > p:nth-of-type(3)').textContent,
    ctaText: block.querySelector('div:nth-of-type(2) > div:nth-of-type(1)').textContent,
    ctaLink: block.querySelector('div:nth-of-type(2) > div:nth-of-type(2) > a').href,
  };

  block.innerHTML = `
    <h1>${data.title}</h1>
    <h2>${data.subtitle}</h2>
    <p>${data.description}</p>
    <a class="shoplink" href="${data.ctaLink}">${data.ctaText}</a>
  `;

  // Add click event listener to the blackoffer-banner-wrapper
  const wrapper = document.querySelector('.blackoffer-banner-wrapper');
  if (wrapper) {
    wrapper.addEventListener('click', () => {
      window.location.href = 'https://www.victoriassecret.ae/en/victorias-secret/shop-apparel/vsx/';
    });
  }

  decorateIcons(block);
}
