export default function decorate(block) {
  // Extract image source and alt text
  const imgElement = block.querySelector("picture img");
  const imgSrc = imgElement?.src || "";
  const imgAlt = imgElement?.alt || "Victoria's Secret Faded Coast Collection";

  // Extract content
  const limitedEditionText = block.querySelector("p")?.innerText || "";
  const mainHeadingHTML = block.querySelector("h2")?.innerHTML || "";
  const [collectionTitle, collectionDescription] = mainHeadingHTML.split("<br><br>");
  const shopNowLink = block.querySelector("a")?.href || "#";

  // Define new HTML structure
  const newHTML = `
    <div class="banner-collection-image">
      <img src="${imgSrc}" alt="${imgAlt}">
    </div>
    <div class="banner-collection-content">
      <p class="limited-edition">${limitedEditionText}</p>
      <h1 class="collection-title">${collectionTitle}</h1>
      <p class="collection-subtitle">Collection</p>
      <p class="collection-description">${collectionDescription}</p>
      <a href="${shopNowLink}" class="shop-now">Shop Now</a>
    </div>
  `;

  // Replace block inner HTML
  block.innerHTML = newHTML;
}
