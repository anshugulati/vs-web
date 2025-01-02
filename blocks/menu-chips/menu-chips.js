import { getConfigValue } from '../../scripts/configs.js';

const showMenuChips = await getConfigValue('show-menu-chips');
const lang = document.documentElement.lang || 'en';
const isMobile = window.innerWidth < 1024;

export default async function decorate() {
  const menuChipsData = document.querySelector('a[href$=".json"]');
  if (showMenuChips === 'false' || !isMobile || !menuChipsData) {
    return;
  }

  // Funtion to fetch the menu-chips data from the json.
  async function fetchMenuChipsData(formHref) {
    const { pathname } = new URL(formHref);
    const resp = await fetch(pathname);
    const json = await resp.json();

    // Function to restructure the menu-chips json data.
    function restructureData(data) {
      return data.map((row) => ({
        category_name: row.name || '',
        category_url: row.path || '',
      }));
    }
    const { data } = json;
    const restructuredData = restructureData(data);
    // Returning the restructured data.
    return restructuredData;
  }

  async function decorateMenuChipsBlock(data) {
    const menuChips = document.createElement('ul');
    menuChips.classList.add('menu-chips');
    data.forEach((category) => {
      const li = document.createElement('li');
      li.classList.add('menu-chips-element');
      const a = document.createElement('a');
      const pathName = `/${lang}/${category.category_url}`;
      a.setAttribute('href', pathName);
      a.innerHTML = category.category_name;
      li.appendChild(a);
      menuChips.appendChild(li);
    });

    // Loading the Menu-chips once header is loaded completly.
    window.addEventListener('delayed-loaded', async () => {
      const header = document.querySelector('.header-wrapper .header');
      if (header) {
        header.appendChild(menuChips);
      }
    });
  }

  const result = await fetchMenuChipsData(menuChipsData.href);
  decorateMenuChipsBlock(result);
}
