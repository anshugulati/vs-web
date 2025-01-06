import { createOptimizedPicture } from "../../scripts/scripts.js";

export default function decorate(block) {
  const videoBannerURL = block
    .querySelector("div > div > div")
    .textContent.trim();
  block.innerHTML = `
    <video autoplay loop muted>
        <source src="${videoBannerURL}" type="video/mp4">
        Your browser does not support the video tag.
    </video>
  `;
}
