import { loadBlocks } from '../../scripts/aem.js';
import { createModalFromContent, openModal, decorateMain } from '../../scripts/scripts.js';

export async function renderPersonalizationDialog(blockData) {
  const PERSONALIZATION_DIALOG_ID = 'personalization-dialog';

  const personalizationOverlay = document.createElement('div');
  personalizationOverlay.appendChild(blockData);

  await createModalFromContent(
    PERSONALIZATION_DIALOG_ID,
    '',
    personalizationOverlay.outerHTML,
    [PERSONALIZATION_DIALOG_ID],
  );
  openModal(PERSONALIZATION_DIALOG_ID);
}

const dataListener = async (block) => {
  const { EVENT_QUEUE, targetClickTrackingEvent } = await import('../../scripts/target/target-events.js');
  const key = block.dataset.targetId;
  const personalizedFragment = EVENT_QUEUE.find((el) => el.key === key)?.data[0]?.data?.content;
  if (typeof personalizedFragment !== 'string') {
    return;
  }
  // This is added as safety check if there is misconfiguration in target
  // and full fragment HTML is returned instead of just plain html content.
  // As a guideline, fragment banner's plain.html should be returned by target
  const preDecoratedFragment = new DOMParser().parseFromString(personalizedFragment, 'text/html')?.querySelector('main');

  if (preDecoratedFragment) {
    block.innerHTML = '';
    block.append(preDecoratedFragment);
  } else {
    block.innerHTML = personalizedFragment;
    decorateMain(block);
  }

  const blockEl = block.querySelector('.block.banner');
  if (blockEl) {
    blockEl.dataset.targetId = key;
  }
  await loadBlocks(block);

  if (block.classList.contains('target-popup')) {
    await renderPersonalizationDialog(block);
  }

  document.querySelectorAll('.personalization.block')?.forEach(
    (personalizationBlock) => personalizationBlock.addEventListener('click', async (event) => {
      const { target: cta } = event;
      if (cta.tagName === 'A') {
        if (cta.getAttribute('href') === '#close') {
          document.querySelector('.personalization-dialog')?.close();
        } else {
          event.preventDefault();
          await targetClickTrackingEvent({ key, personalizationCta: cta.title });
          window.location.href = cta.href;
        }
      }
    }),
  );
};

export default async function decorate(block) {
  if (window.DISABLE_MARTECH) {
    return;
  }
  window.addEventListener('target-response', () => dataListener(block), { once: true });
}
