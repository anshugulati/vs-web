import { getMetadata } from '../../scripts/aem.js';
import { getCustomer } from '../../scripts/customer/api.js';
import {
  isLoggedInUser,
  loadFragment,
  fetchPlaceholdersForLocale,
  logout,
  closeModal,
  openModal,
  createModalFromContent,
} from '../../scripts/scripts.js';

import { getConfigValue } from '../../scripts/configs.js';

let superCategory = getMetadata('super-category');
function addLogoutEvent(lang) {
  const aside = document.querySelector('aside');
  const logoutLink = aside.querySelector('li:last-child a');
  if (logoutLink?.href.endsWith('/user/logout')) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout(`/${lang}/user/login`, true);
    });
  }
}

function addSignOutFromModal(lang) {
  const signOut = document.querySelector('aside');
  const signOutLink = signOut.querySelector('li:last-child a');
  if (signOutLink?.href.endsWith('/user/logout')) {
    signOutLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('.sign-out-modal .sign-out-cancel').addEventListener('click', () => {
        closeModal('sign-out-modal');
      });

      document.querySelector('.sign-out-modal .sign-out-confirm').addEventListener('click', () => {
        closeModal('sign-out-modal');
        logout(`/${lang}/`);
      });
    });
  }
}

async function showSignOutModal(placeholders) {
  const signOutModalId = 'sign-out-modal';
  const signOutTitle = placeholders.confirmation || 'Confirmation';
  const signOutContent = document.createElement('div');
  signOutContent.classList.add('sign-out-content');

  signOutContent.innerHTML = `<span class="sign-out-message">${placeholders.signoutMessage || 'Do you want to Signout?'}</span>`;

  const signOutFooter = document.createElement('div');
  signOutFooter.classList.add('modal-footer');
  signOutFooter.innerHTML = `<div class="sign-out-buttons">
    <button class="sign-out-cancel secondary" aria-label="${placeholders.cancel || 'Cancel'}">${placeholders.cancel || 'Cancel'}</button>
    <button class="sign-out-confirm" aria-label="${placeholders.signoutConfirm || 'Confirm'}">${placeholders.signoutConfirm || 'Confirm'}</button>
  </div>`;

  await createModalFromContent(
    signOutModalId,
    signOutTitle,
    signOutContent.outerHTML,
    ['sign-out-modal'],
    null,
    false,
    'icon-close-blue',
  );

  // Select the modal dialog and content after it's been created
  const signOutDialog = document.getElementById(signOutModalId);
  const modalContentDiv = signOutDialog.querySelector('.modal-content');

  // Append the footer after the content div
  modalContentDiv.insertAdjacentElement('afterend', signOutFooter);

  openModal(signOutModalId);
}

function highlightCurrentPage() {
  const aside = document.querySelector('aside');
  const links = aside.querySelectorAll('li a');
  links.forEach((link) => {
    if (link.href === window.location.href) {
      link.classList.add('active');
    }
  });
}

export async function getWelcomeMessage(welcometext, loggedinUsername) {
  const customer = await getCustomer(true);

  const welcomeMessage = document.createElement('div');
  welcomeMessage.classList.add('welcome-message');

  const welcomeMessageTitle = document.createElement('h4');
  const message = welcometext || 'Hi {{name}}';
  const customerName = loggedinUsername === 'fullname' ? ` ${customer?.firstname} ${customer?.lastname}` : ` ${customer?.firstname}`;
  welcomeMessageTitle.textContent = message.replace('{{name}}', customerName);
  welcomeMessage.appendChild(welcomeMessageTitle);

  return welcomeMessage;
}

function decorateTitleForSubpages(main) {
  if (document.querySelector('body').classList.contains('sub-page')) {
    const lang = document.documentElement.lang || 'en';
    const redirectUrl = `/${lang}/user/account`;
    const title = main.querySelector(
      'div.section:first-child h2, div.section:first-child h3, div.section:first-child h4, div.section:first-child h5',
    );
    if (title) {
      const titleClone = title.cloneNode(true);
      const titleLink = document.createElement('a');
      titleLink.href = redirectUrl;
      titleLink.appendChild(titleClone);
      titleLink.classList.add('section-title');
      main.prepend(titleLink);
    }
  }
}

export default async function decorate(main) {
  const lang = document.documentElement.lang || 'en';
  const redirectUrl = `/${lang}/user/login`;
  if (!isLoggedInUser()) {
    window.location = redirectUrl;
  }
  const placeholders = await fetchPlaceholdersForLocale();
  main.classList.add('sidebar-main');

  decorateTitleForSubpages(main);

  superCategory = superCategory ? `/${superCategory}` : '';
  await loadFragment(`/${lang}${superCategory}/fragments/user/sidenav`);
  const helloMemberFragment = await loadFragment(`/${lang}/fragments/user/hello-member`);

  const aside = document.querySelector('aside');
  const helloMember = helloMemberFragment?.querySelector('.hello-member-wrapper');
  if (helloMember) {
    aside.prepend(helloMember);
  }

  const welcomeMessage = await getWelcomeMessage(placeholders.welcomeMember, 'firstname');
  aside.prepend(welcomeMessage);
  highlightCurrentPage();

  const isSignOutModalEnabled = await getConfigValue('signout-modal-enabled');
  if (isSignOutModalEnabled === 'true') {
    const signoutbutton = aside.querySelector(`a[title="${placeholders.signout}"]`);
    signoutbutton?.addEventListener('click', async () => {
      await showSignOutModal(placeholders);
    });
    addSignOutFromModal(lang);
  } else {
    addLogoutEvent(lang);
  }
  return main;
}
