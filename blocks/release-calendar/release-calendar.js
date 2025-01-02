// eslint-disable-next-line import/no-unresolved
import { toClassName } from '../../scripts/aem.js';
import { fetchPlaceholdersForLocale } from '../../scripts/scripts.js';

const lang = document.documentElement.lang || 'en';

// Get the products data from release calender sheet.
async function getReleaseCalendarData(srcOrigin) {
  return fetch(srcOrigin)
    .then((response) => response.json());
}

function convertSpreadsheetDate(spreadsheetDate, format = 'en-US') {
  // Base date assuming January 1, 1900
  const baseDate = new Date(1900, 0, 1);

  // Subtract 2 days to account for the difference between Excel's and JavaScript's date systems
  const actualDate = new Date(baseDate.getTime() + (spreadsheetDate - 2) * 86400000);

  // Format the actual date according to the specified format
  const formattedDate = actualDate.toLocaleDateString(format, { day: '2-digit', month: 'short' });

  return formattedDate;
}

// Decorates the products data in the form card.
function getProductCard(calenderProducts) {
  /* change to ul, li */
  const cardData = document.createElement('div');
  const ul = document.createElement('ul');
  cardData.className = 'card-list';

  // Prepare card to render under tabs.
  [...calenderProducts].forEach((row) => {
    const li = document.createElement('li');
    const productLink = document.createElement('a');
    productLink.classList.add('card-link');
    productLink.href = `${row.product_link}`;
    const cardImgWrapper = document.createElement('div');
    cardImgWrapper.classList.add('card-img-wrapper');
    const cardBody = document.createElement('div');
    const cardImage = document.createElement('img');
    cardImage.classList.add('store-banner');
    cardImage.setAttribute('rel', 'preload');
    cardImage.setAttribute('fetchpriority', 'high');
    cardImage.src = row.image;
    cardImgWrapper.appendChild(cardImage);
    cardBody.classList.add('card-info');
    cardBody.innerHTML += `<div class="brand"> ${row.brand}</p>`;
    cardBody.innerHTML += `<div class="product-name"> ${row.name}</p>`;

    let date = '';
    if (lang === 'ar') {
      date = convertSpreadsheetDate(row.date, 'ar');
    } else {
      date = convertSpreadsheetDate(row.date);
    }
    cardImgWrapper.innerHTML += `<span class="date"> ${date}</span>`;

    productLink.append(cardImgWrapper);
    productLink.append(cardBody);
    li.append(productLink);
    ul.append(li);
  });
  cardData.append(ul);

  return cardData;
}

// Decorate tabs based on the data provided in doc.
export default async function decorate(block) {
  let srcOrigin;
  let calendarData;
  const placeholder = await fetchPlaceholdersForLocale();
  // Get json sourch path containing the release product data.
  if (block.querySelector('a') && block.querySelector('a').href) {
    srcOrigin = block.querySelector('a').href;
  }

  // Fetch release calendar data based on the provided json source.
  if (srcOrigin !== undefined) {
    calendarData = await getReleaseCalendarData(srcOrigin);
  }

  // Prepare tablist.
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  // Decorate tabs and tabpanels.
  const tabs = [...block.children].map((child) => child.firstElementChild);
  tabs.forEach((tab, i) => {
    // Don't process tab contains anchor tag.
    if (tab.querySelector('a')) {
      return;
    }
    const id = toClassName(tab.textContent);
    // decorate tabpanel
    const tabpanel = block.children[i];
    tabpanel.className = 'tabs-panel';
    tabpanel.id = `tabpanel-${id}`;
    tabpanel.setAttribute('aria-hidden', !!i);
    tabpanel.setAttribute('aria-labelledby', `tab-${id}`);
    tabpanel.setAttribute('role', 'tabpanel');

    const cards = getProductCard(calendarData[id].data);
    tabpanel.append(cards);

    // build tab button
    const button = document.createElement('button');
    button.className = 'tabs-tab';
    button.id = `tab-${id}`;
    const buttonText = id === 'upcoming'
      ? placeholder.upcoming
      : placeholder.launched;
    button.innerHTML = buttonText;

    button.setAttribute('aria-controls', `tabpanel-${id}`);
    button.setAttribute('aria-selected', !i);
    button.setAttribute('role', 'tab');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      block.querySelectorAll('[role=tabpanel]').forEach((panel) => {
        panel.setAttribute('aria-hidden', true);
      });
      tablist.querySelectorAll('button').forEach((btn) => {
        btn.setAttribute('aria-selected', false);
      });
      tabpanel.setAttribute('aria-hidden', false);
      button.setAttribute('aria-selected', true);
    });
    tablist.append(button);
    tab.remove();
  });

  block.prepend(tablist);
}
