import { getWelcomeMessage } from '../../templates/account/account.js';
import {
  fetchPlaceholdersForLocale,
} from '../../scripts/scripts.js';

export default async function decorate(block) {
  block.innerHTML = '';
  const placeholders = await fetchPlaceholdersForLocale();
  const welcomeMessage = await getWelcomeMessage(placeholders.welcomeMember, 'firstname');
  block.appendChild(welcomeMessage);
}
