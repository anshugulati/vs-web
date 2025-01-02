import { createJoinAura } from '../../blocks/aura-join/aura-join.js';
import { createLinkAura } from '../../blocks/link-your-aura/link-your-aura.js';
import { getConfigValue } from '../configs.js';
import { createModalFromContent, openModal, fetchPlaceholdersForLocale } from '../scripts.js';

const placeholders = await fetchPlaceholdersForLocale();
const clmDowntime = await getConfigValue('clm-downtime');

export async function showAuraClmDowntimeModal() {
  const auraClmDowntimeModalId = 'aura-clm-downtime-modal';
  const auraClmDowntimeTitle = placeholders.auraClmDowntimeHeader || 'Oops!';
  const auraClmDowntimeContent = document.createElement('div');
  auraClmDowntimeContent.classList.add('aura-clm-downtime-content');

  auraClmDowntimeContent.innerHTML = `<span class="aura-clm-downtime-message">${placeholders.auraClmDowntimePopup || 'Aura is offline to refresh and enhance your experience and will be back soon. Please try again in some time.'}</span>`;

  await createModalFromContent(
    auraClmDowntimeModalId,
    auraClmDowntimeTitle,
    auraClmDowntimeContent.outerHTML,
    ['aura-clm-downtime-modal'],
    null,
    false,
  );
  openModal(auraClmDowntimeModalId);
}

export default async function openAuraModal(auraType, reDecorate = false, notyou = false) {
  if (clmDowntime && clmDowntime === 'true') {
    showAuraClmDowntimeModal(placeholders);
  } else if (auraType === 'join') {
    createJoinAura(reDecorate);
  } else if (auraType === 'link') {
    createLinkAura(reDecorate, notyou);
  }
}
