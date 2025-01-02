export default function decorate(block) {
  const links = [...block.querySelectorAll('a')];
  
  const content = links.map(link => {
    const text = link.textContent;
    let iconSrc = '';
    let iconAlt = '';

    switch (text) {
      case 'Free delivery on certain orders':
        iconSrc = '/icons/free-delivery.svg';
        iconAlt = 'Free delivery icon';
        break;
      case 'Shop online 24/7':
        iconSrc = '/icons/download-app.svg';
        iconAlt = 'Download our app icon';
        break;
      case 'Free returns available online and in store':
        iconSrc = '/icons/buy-now-pay-later.svg';
        iconAlt = 'Buy now, pay later icon';
        break;
      default:
        break;
    }

    return `
      <div class="abc-item">
        <img src="${iconSrc}" alt="${iconAlt}" class="abc-icon">
        <span>${text}</span>
      </div>
    `;
  }).join('');

  block.innerHTML = `<div class="abc-content">${content}</div>`;
}
