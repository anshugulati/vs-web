export default function decorate(block) {
  // Extract text content
  const spotlightText = block.querySelector("p")?.innerText || "";
  const mainHeadingHTML = block.querySelector("h2")?.innerHTML || "";
  const link = block.querySelector("a")?.href || "#";

  // Extract image source
  const imgSrc = block.querySelector("img")?.src || "";
  const imgAlt = block.querySelector("img")?.alt || "";

  // Define new HTML structure
  const newHTML = `
    <div class="banner-image-text-content">
      <h3>${spotlightText}</h3>
      <h2>${mainHeadingHTML.split("<br><br>")[0]}</h2>
      <p>${mainHeadingHTML.split("<br><br>")[1]}</p>
      <a href="${link}" class="order-button">Shop Now</a>
    </div>
    <div class="banner-image-text-image">
      <img src="${imgSrc}" alt="${imgAlt}">
    </div>
  `;

  // Replace block inner HTML
  block.innerHTML = newHTML;
}
