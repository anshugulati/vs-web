export default function decorate(block) {
  const columns = block.querySelectorAll(":scope > div > div");

  const createBannerCard = (column) => {
    const img = column.querySelector("img");
    const offerDetails = ["h6", "h1", "h3", "h5", "p"].map((tag) => {
      const element = column.querySelector(tag);
      return element ? element.textContent : "";
    });
    const shopNowElement = column.querySelector("p u");
    const shopNow = shopNowElement ? shopNowElement.textContent : "";

    return `
      <div class="twocolumn-offer-banner-card">
        <img src="${img.src}" alt="${img.alt}">
        <div class="offer-details">
          ${offerDetails[0] ? `<h6>${offerDetails[0]}</h6>` : ""}
          ${offerDetails[1] ? `<h1>${offerDetails[1]}</h1>` : ""}
          ${offerDetails[2] ? `<h3>${offerDetails[2]}</h3>` : ""}
          ${offerDetails[3] ? `<h5>${offerDetails[3]}</h5>` : ""}
          <a href="#" class="shop-now">${shopNow}</a>
        </div>
      </div>
    `;
  };

  block.innerHTML = Array.from(columns).map(createBannerCard).join("");
}
