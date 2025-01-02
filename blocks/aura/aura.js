import {
  fetchPlaceholdersForLocale,
  isLoggedInUser,
  formatPrice,
} from '../../scripts/scripts.js';
import { getConfigValue } from '../../scripts/configs.js';
import {
  getAuraCustomerData,
  getAuraCustomerPoints,
  getAuraCustomerTiers,
  getAuraGuestInfo,
  getAuraGuestPoints,
} from '../../scripts/aura/api.js';
import { decorateIcons } from '../../scripts/aem.js';
import openAuraModal from '../../scripts/aura/common.js';

export const membershipNumberFormat = (number) => {
  const formattedNumber = number?.replace(/(\d{4})(?=\d)/g, '$1 ')?.trim();
  return `${formattedNumber}`;
};

function dateFormat(dateInfo) {
  const date = new Date(dateInfo);
  const months = Array.from(
    { length: 12 },
    (_, i) => new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2000, i)),
  );
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export default async function decorateAuraBanner(block) {
  const placeholders = await fetchPlaceholdersForLocale();
  const clmDowntime = await getConfigValue('clm-downtime');
  const auraContainer = document.createElement('div');
  auraContainer.classList.add('aura-banner-container');
  const wrapperElement = document.querySelector('.aura-wrapper');
  if (wrapperElement) {
    wrapperElement.classList.add('aura-banners');
  }
  if (clmDowntime === 'true') {
    wrapperElement.classList.remove('aura-banners');
    wrapperElement.innerHTML = `
    <div class="aura-clm-downtime-banner">
       <span class="icon icon-aura-icon"></span>
      <p class="notification-text">${placeholders.auraClmDowntimePopup || 'Aura is offline to refresh and enhance your experience and will be back soon. Please try again in some time.'}</p>
    </div>`;
  }
  const loggedCheck = isLoggedInUser();
  const auraGuestMemberNumber = JSON.parse(localStorage.getItem('aura_common_data') || '{}')?.aura_membership;
  const primaryButtons = await getConfigValue('aura-primary-buttons');
  const sequenceOrderGet = await getConfigValue('aura-banner-chip-sequence') || 'my-tier,points-balance,points-value,points-expiring';
  const currency = await getConfigValue('currency') || 'AED';
  const region = await getConfigValue('country-code') || 'AE';
  const auraPointsConversion = await getConfigValue('aura-conversion-base-value') || await getConfigValue(`aura-conversion-base-value-${region}`);
  auraContainer.classList.add('loading-parent', 'loading');
  const loadingBlock = document.createElement('span');
  loadingBlock.classList.add('loading-block', 'aura-banner-loader');
  loadingBlock.innerHTML = `
        <div class="loading-spinner">
          <span class="icon icon-ic-loader"></span>
        </div>
      `;
  decorateIcons(loadingBlock);
  async function fetchAuraData() {
    try {
      let auraCustomerData = {};
      let auraCustomerPoints = {};
      let auraCustomerTiersData = {};
      /* based on tier value we are mapping the aura membership */
      const tierInfoMap = {
        Tier1: placeholders.auraHello || 'Aura Hello',
        Tier2: placeholders.auraStar || 'Aura Star',
        Tier3: placeholders.auraVip || 'Aura VIP',
      };

      if (loggedCheck) {
        // Use Promise.all to make calls in parallel
        const [customerData, customerPoints, customerTiersData] = await Promise.all([
          getAuraCustomerData(),
          getAuraCustomerPoints(),
          getAuraCustomerTiers(),
        ]);
        const tierInfo = tierInfoMap[customerTiersData?.tier_code] || tierInfoMap.Tier1;
        customerTiersData.tier_info = tierInfo;
        auraCustomerData = customerData;
        auraCustomerPoints = customerPoints;
        auraCustomerTiersData = customerTiersData;
      } else if (auraGuestMemberNumber) {
        const [customerData, customerPoints] = await Promise.all([
          getAuraGuestInfo(),
          getAuraGuestPoints(),
        ]);
        const tierInfo = tierInfoMap[customerData?.tier_code] || tierInfoMap.Tier1;
        const customerTiersData = { tier_code: customerData?.tier_code, tier_info: tierInfo };
        // Map guest user data to the same structure as logged-in users
        auraCustomerData = {
          ...customerData,
          apc_first_name: customerData.first_name,
          apc_last_name: customerData.last_name,
        };
        // auraCustomerData = customerData;
        auraCustomerPoints = customerPoints;
        auraCustomerTiersData = customerTiersData;
      }
      return { auraCustomerData, auraCustomerPoints, auraCustomerTiersData };
    } catch (error) {
      console.error('Error fetching Aura data:', error);
      throw error;
    } finally {
      document.querySelector('.aura-banner-loader').classList.add('hide');
    }
  }
  block.parentNode.parentNode.parentNode.insertBefore(loadingBlock, block.nextSibling);

  const { auraCustomerData, auraCustomerPoints, auraCustomerTiersData } = await fetchAuraData();
  // Utility to create buttons with specified classes and text
  const createButton = (className, text) => {
    const button = document.createElement('button');
    button.classList.add(...className.split(' '));
    button.innerText = text;
    if (primaryButtons?.includes(className.split('-')[1])) {
      button.classList.add('primary-btn');
    }
    return button;
  };

  const loginButton = createButton('aura-login', placeholders.auraLoginButton);
  const joinButton = createButton('aura-join', placeholders.auraJoinButton);
  const linkButton = createButton('aura-link', placeholders.linkYourAura);

  const linkNotNow = document.createElement('a');
  linkNotNow.classList.add('aura-link-not-now', 'auto-text');
  linkNotNow.innerText = placeholders.auraNotYou;
  const auraPointsValue = await formatPrice(
    currency,
    (parseInt(auraCustomerPoints?.apc_points, 10) || 0) * auraPointsConversion,
  );

  // Utility func- creating chips with title, values and checking the sequence order from config
  const createBannerInfo = () => sequenceOrderGet.split(',').map((val) => {
    const chipTitles = {
      'my-tier': placeholders.auraMytierTitle,
      'points-balance': placeholders.auraPointsBalanceTitle,
      'points-value': placeholders.auraPointsValueTitle,
      'points-expiring': placeholders.auraPointsExpiringTitle,
    };
    const chipValues = {
      'my-tier': auraCustomerTiersData?.tier_info || '',
      'points-balance': `${auraCustomerPoints?.apc_points || 0} ${placeholders.auraPointsValueLabel || 'pts'}`,
      'points-value': `${auraPointsValue}`,
      'points-expiring': auraCustomerPoints?.apc_points_to_expire
        ? `${auraCustomerPoints?.apc_points_to_expire} ${placeholders.auraPointsValueLabel || 'pts'} <span class="auto-text date">${dateFormat(auraCustomerPoints?.apc_points_expiry_date)}</span>`
        : '',
    };

    if (chipValues[val]) {
      return `
        <div class="info-value-widget">
          <p class="auto-text info-value-title">${chipTitles[val]}${val === 'points-expiring' ? '<span title="Points are expiring soon"><img data-icon-name="aura-exclamination" src="/icons/aura-exclamination.svg" alt="Expire Warning" loading="lazy"></span>' : ''}</p>
          <p class="info-value">${chipValues[val]}</p>
        </div>`;
    }
    return '';
  }).join('');

  // Create logo container
  const auraLogo = block.querySelectorAll('.aura-banner div:first-of-type > div > span');
  const innerHTMLLogoContainer = `
    <div class="logo-container">
      ${Array.from(auraLogo)?.map((element) => element.outerHTML).join('')}
    </div>
  `;

  // Left content
  const auraLeftContent = block.querySelector('.aura-banner div:last-of-type > div').outerHTML;

  // Bottom containers for aura existence and non-existence
  const innerBottomContainer = `
    <div class="bottom-container">
      <div class="left-container">${auraLeftContent}</div>
      <div class="right-container">
        ${`<div class="join-aura-container"><p>${placeholders.auraJoinButtonTitle}</p>${joinButton.outerHTML}</div>`}
        ${!loggedCheck && auraCustomerData && !auraCustomerData?.apc_identifier_number ? `<div class="login-aura-container"><p>${placeholders.auraLoginButtonTitle}</p>${loginButton.outerHTML}</div>` : ''}
        ${loggedCheck && auraCustomerData && !auraCustomerData?.apc_identifier_number ? `<div class="link-aura-container"><p>${placeholders.auraLoginButtonTitle}</p>${linkButton.outerHTML}</div>` : ''}
      </div>
    </div>
  `;

  const innerBottomAuraExistContainer = `
    <div class="bottom-container aura-exist-container">
      <div class="left-container">
        <h3 class='membership-name'>${auraCustomerData?.apc_first_name} ${auraCustomerData?.apc_last_name}</h3>
        <p class="auto-text">${placeholders.auraLoyaltyAccount}</p>
      </div>
      <div class="right-container">
        <div class="membership-aura-container">
          <p class="auto-text">${placeholders.auraMembershipNumber}</p>
          <p class="membership-number">${membershipNumberFormat(auraCustomerData?.apc_identifier_number)}</p>
        </div>
      </div>
    </div>
    <div class="aura-linking-now-container">
      <div><p class="auto-text auto-bold-text">${placeholders.auraWantToLink}</p></div>
      <div class="aura-linking-button-container"></div>
    </div>
  `;

  const innerBottomAuraDetailsContainer = `
  <div class="enrolled-banner ${auraCustomerTiersData?.tier_code?.toLowerCase() || 'tier1'}">
    <div class="banner-left-container">
      <div class="logo-container">
        ${Array.from(auraLogo)?.map((element) => element.outerHTML).join('')}
      </div>
      <div>
        <h3 class='membership-name enrolled-membership-name'>${auraCustomerData?.apc_first_name} ${auraCustomerData?.apc_last_name}</h3>
      </div>
      <div class="membership-aura-container">
        <p class="auto-text">${placeholders.auraMembershipNumber}</p>
        <p class="membership-number enrolled-member">${membershipNumberFormat(auraCustomerData?.apc_identifier_number) || ''}</p>
      </div>     
    </div>
    <div class="banner-right-container">
      <div class="banner-aura-info">
      ${createBannerInfo()}
      </div>
      ${auraCustomerData && (auraCustomerData?.apc_link === 3 || auraCustomerData?.apc_link === '3') ? `<div class="membership-aura-container">
          <p class="auto-text aura-app-info">${placeholders.auraAppDescription}</p>
        </div>` : ''}
    </div>
  </div>
`;

  // Insert the appropriate bottom container based on aura existence
  // apc_link 1-email found but not linked, 2- fully enrolled, 3-quick enrolled
  if (loggedCheck && auraCustomerData) {
    if (
      auraCustomerData?.apc_link
      && (auraCustomerData.apc_link === 2 || auraCustomerData.apc_link === 3)
    ) {
      auraContainer.insertAdjacentHTML('beforeend', innerBottomAuraDetailsContainer);
    } else {
      auraContainer.insertAdjacentHTML('beforeend', innerHTMLLogoContainer);
      const innerContainer = auraCustomerData?.apc_link === 1
        ? innerBottomAuraExistContainer
        : innerBottomContainer;
      auraContainer.insertAdjacentHTML('beforeend', innerContainer);
    }
  } else if (auraGuestMemberNumber) {
    // Not Ecom logged in and Aura logged in customer data
    auraContainer.insertAdjacentHTML('beforeend', innerBottomAuraDetailsContainer);
  } else {
    // Not Ecom logged in and no Aura customer data
    auraContainer.insertAdjacentHTML('beforeend', innerHTMLLogoContainer);
    auraContainer.insertAdjacentHTML('beforeend', innerBottomContainer);
  }

  const auraLinkButtonContainer = auraContainer.querySelector('.aura-linking-button-container');
  if (auraLinkButtonContainer) {
    linkButton.classList.remove('primary-btn');
    linkButton.classList.add('secondary-btn');
    auraLinkButtonContainer.append(linkButton, linkNotNow);
  }

  block.innerHTML = '';
  block.appendChild(auraContainer);

  block.addEventListener('click', (event) => {
    const { target } = event;
    if (target.classList.contains('aura-join')) {
      openAuraModal('join', () => decorateAuraBanner(block));
    } else if (target.classList.contains('aura-link') || target.classList.contains('aura-login')) {
      openAuraModal('link', () => decorateAuraBanner(block));
    } else if (target.classList.contains('aura-link-not-now')) {
      openAuraModal('link', () => decorateAuraBanner(block), true);
    }
  });
}
