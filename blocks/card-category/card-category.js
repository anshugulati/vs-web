import { createOptimizedPicture } from '../../scripts/scripts.js';

export default function decorate(block) {
  const items = [...block.children];
  const newInnerHTML = items.map((item) => {
    const imgElement = item.querySelector('picture');
    const imgSrc = imgElement.querySelector('img').src;
    const href = item.querySelector('a').href;
    const altText = item.querySelector('div:nth-child(2)').textContent.trim();
    
    const optimizedPicture = createOptimizedPicture(imgSrc, altText,  false, [
      { media: '(min-width: 600px)', width: '2000' },
      { width: '750' }
    ]);
    
    return `
   
      <div class="card-category-card" >
       <a href="${href}">
        ${optimizedPicture.outerHTML}
        <p>${altText}</p>
           </a>
      </div>
 
    `;
  }).join('');
  
  block.innerHTML = newInnerHTML;
}
