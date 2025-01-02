/** Helpers for sidekick specific customizations * */

/**
 * Listener to handle the image replacement using DAM image
 * @param {*} block
 * @param {*} target
 */
// Observer to capture the text changes and update the anchor link
export default function initImageAnchorChangeListener(block, target) {
  if (target.classList.contains('video-bg-link')) {
    const targetClasses = Array.from(target.classList).join('.');
    const imageLink = block.querySelector(`.${targetClasses}`);
    imageLink?.addEventListener('paste', async (e) => {
      setTimeout(() => {
        const updatedAnchor = e.target.querySelector('a');
        target.setAttribute('href', updatedAnchor.href);
        target.textContent = updatedAnchor.innerText;
      });
    });
  } else {
    const imageLink = block.querySelector(`.${target.className}-link`);
    imageLink?.addEventListener('paste', async (e) => {
      setTimeout(() => {
        const updatedAnchor = e.target.querySelector('a');
        e.target.href = updatedAnchor.href;
        target.src = e.target.href;
        e.target.innerText = updatedAnchor.innerText;
        target.setAttribute('src', e.target.href);
        target.querySelectorAll('source').forEach((source) => {
          source.srcset = e.target.href;
        });
      });
    });
  }
}
