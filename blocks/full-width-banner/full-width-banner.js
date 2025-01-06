export default function decorate(block) {
  // Extracting data from the block's HTML content
  const img = block.querySelector("img");
  const limitedTimeText = block.querySelector("p").textContent;
  const h2Content = block.querySelector("h2").innerHTML;
  const shopLink = block.querySelector("a").href;

  // Creating the new inner HTML structure with background image
  block.innerHTML = `
    <div class="text-content">
            <h2>${limitedTimeText}</h2>
            <h1>40% Off Sport</h1>
            <p>Orig. up to AED250 Details</p>
            <a href="${shopLink}" class="shop-now">Shop Now</a>
        </div>
  `;

  // Setting the image as background
  block.style.backgroundImage = `url('${img.src}')`;
}
