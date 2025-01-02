import { fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
import { getAuraCustomerTiers, getAuraTierProgressData } from '../../scripts/aura/api.js';

export default async function decorate(block) {
  const placeholders = await fetchPlaceholdersForLocale();
  const auraCustomerTier = await getAuraCustomerTiers();
  if (!auraCustomerTier.tier_code) {
    block.classList.add('tier-3');
    return;
  }
  const userTier = auraCustomerTier.tier_code.toLowerCase();
  const response = await getAuraTierProgressData();

  const lastIndex = response.tier_progress_tracker.length - 1;

  let lowerTier;
  let upperTier;
  let statusTierName = '';
  const statusTierPoints = response.tier_progress_tracker[lastIndex].max_value
                         - response.tier_progress_tracker[lastIndex].current_value;

  let fillWidth = (response.tier_progress_tracker[lastIndex].current_value
    / response.tier_progress_tracker[lastIndex].max_value) * 100;

  fillWidth = Math.round(fillWidth * 10000) / 10000;

  if (fillWidth > 100) {
    fillWidth = 100;
  }

  if (userTier === 'tier1') {
    lowerTier = placeholders.auraHello || 'Aura Hello';
    upperTier = placeholders.auraStar || 'Aura Star';
    statusTierName = placeholders.auraStatusStar || 'STAR';
  } else if (userTier === 'tier2') {
    lowerTier = placeholders.auraStar || 'Aura Star';
    upperTier = placeholders.auraVip || 'Aura VIP';
    statusTierName = placeholders.auraStatusVip || 'VIP';
  } else {
    block.classList.add('tier-3');
  }

  block.querySelector('div').classList.add('aura-progress-title');

  const auraProgressBar = document.createElement('div');
  auraProgressBar.classList.add('aura-progress-bar');
  auraProgressBar.innerHTML = `<div class="tier lower-tier"> 
                                    <p> ${lowerTier} </p> 
                                </div>
                                <div class="aura-progress">
                                    <div class="start">
                                        <div id="aura-fill" class="fill fill-tier-${userTier}"></div>
                                    </div>
                                </div>
                                <div class="tier upper-tier">
                                    <p> ${upperTier} </p>
                                </div>`;

  const statusTitle = placeholders.auraStatusTitle || 'You are Here:';
  const earnText = placeholders.auraEarnText || 'Earn';
  const pointsText = placeholders.auraPointsText || 'points to reach';
  const statusText = placeholders.auraStatusText || 'status';
  const statusDesc = ` ${earnText} ${statusTierPoints} ${pointsText} ${statusTierName} ${statusText}`;
  const auraProgressText = document.createElement('div');
  auraProgressText.classList.add('aura-progress-text');
  auraProgressText.innerHTML = `<p class='status-title'>
                                    ${statusTitle}
                                </p>
                                <p class='status-description'>
                                    ${statusDesc}
                                </p>`;

  block.append(auraProgressBar);
  block.append(auraProgressText);

  block.querySelector('.fill').style.width = `${fillWidth}%`;
}
