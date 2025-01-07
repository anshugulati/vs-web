export default function decorate(block) {
  const links = Array.from(block.querySelectorAll('a'));
  
  let bannerContent = '<div class="banner-bar-content">';
  
  links.forEach(link => {
    const textParts = link.textContent.split(' ');
    const mainText = textParts.slice(0, -2).join(' ');
    const spanText = textParts.slice(-2).join(' ');
    
    bannerContent += `
      <a href="${link.href}" class="banner-bar-link">
        ${mainText} <span>${spanText}</span>
      </a>
    `;
  });
  
  bannerContent += '</div>';
  
  block.innerHTML = bannerContent;
}
