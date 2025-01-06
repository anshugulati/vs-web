import { createOptimizedPicture } from "../../scripts/scripts.js";

export default async function decorate(block) {
  const titleElement = block.querySelector("h2");
  const images = block.querySelectorAll("picture");

  const titleText = titleElement.innerHTML.split("<br>")[0];
  const subtitleText = titleElement.innerHTML.split("<br>")[1];

  const cardsData = Array.from(images)
    .map((picture, index) => {
      const imgElement = picture.querySelector("img");
      const imgSrc = imgElement.src;
      const imgAlt = imgElement.alt;
      const imgOptimized = createOptimizedPicture(imgSrc, false, imgAlt);

      return `
      <div class="category-block-card">
        ${imgOptimized.outerHTML}
      </div>
    `;
    })
    .join("");

  block.innerHTML = `
    <h2>${titleText}</h2>
    <p>${subtitleText}</p>
    <div class="category-block-cards">
      ${cardsData}
    </div>
  `;
}
