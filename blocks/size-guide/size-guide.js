import {
  applyFilter,
  loadDefaultFilterValues,
  initSizeGuideDefaults,
} from './size-guide-utility.js';

function initSizeMap(block) {
  const sizeRangeMap = {};
  const sizes = [];
  const sizeRange = [];
  [...block.children].forEach((row) => {
    const key = row.firstElementChild.textContent.trim();
    if (key.toLowerCase().indexOf('sizes') >= 0) {
      row.lastElementChild.querySelectorAll('li').forEach((li) => {
        sizes.push(li.textContent.trim().toUpperCase());
      });
    } else if (key.toLowerCase().indexOf('size-range') >= 0) {
      row.lastElementChild.querySelectorAll('li').forEach((li) => {
        sizeRange.push(li.textContent.trim().toLowerCase());
      });
    }
  });
  for (let i = 0; i < sizes.length; i += 1) {
    sizeRangeMap[sizeRange[i]] = sizes[i];
  }
  return sizeRangeMap;
}

export default async function decorate(block) {
  const sizeRangeMap = initSizeMap(block);
  const filtersCollection = document.createElement('div');
  const filtersDropdown = document.createElement('div');
  filtersDropdown.className = 'size-guide-filters';
  const filterSelection = document.createElement('div');
  filterSelection.className = 'size-guide-filter-selection';

  [...block.children].forEach((row) => {
    let key = row.firstElementChild.textContent.trim();
    let labelToShow = key;
    if (key.toLowerCase().indexOf('sizes') >= 0) {
      row.lastElementChild.querySelectorAll('li').forEach((li) => {
        const sizeSelectionBtn = document.createElement('button');
        sizeSelectionBtn.setAttribute('data-key', key);
        sizeSelectionBtn.innerHTML = li.textContent.trim().toUpperCase();
        filterSelection.appendChild(sizeSelectionBtn);
      });
    } else {
      const values = [];
      const filter = document.createElement('div');
      filter.className = 'size-guide-filter';
      const label = document.createElement('label');
      const labelMatch = key.match(/([^{]*)\{([^}]+)\}/);
      if (labelMatch) {
        labelToShow = labelMatch[1]?.trim();
        key = labelMatch[2]?.trim();
      }
      label.textContent = labelToShow;
      label.setAttribute('for', key.toLowerCase());
      const filterBlock = document.createElement('div');
      filterBlock.classList.add('size-guide-filter-block');
      filterBlock.appendChild(label);
      filter.appendChild(filterBlock);
      const select = document.createElement('select');
      select.id = key.toLowerCase();
      select.classList.add('size-guide-filter-select');
      select.dataset.key = key.toLowerCase();
      row.lastElementChild.querySelectorAll('li').forEach((li) => {
        values.push(li.textContent.trim().toLowerCase());
        const option = document.createElement('option');
        option.value = li.textContent.trim().toLowerCase();
        option.textContent = li.textContent.trim();
        option.classList.add('size-guide-filter-option');
        select.appendChild(option);
      });

      filterBlock.appendChild(select);
      filtersDropdown.appendChild(filter);
    }
  });
  block.innerHTML = '';
  filtersCollection.appendChild(filtersDropdown);
  filtersCollection.appendChild(filterSelection);
  block.appendChild(filtersCollection);
  block.querySelectorAll('.size-guide-filter select').forEach((select) => {
    select.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-key');
      document.querySelector('.size-guide-selectedFilters.hide').setAttribute(`data-${key.toLowerCase()}`, e.target.value);
      let sizesVal = sizeRangeMap[e.target.value];
      if (!sizesVal) {
        sizesVal = sizeRangeMap[document.querySelector('.size-guide-selectedFilters.hide').getAttribute('data-size-range')];
      }
      document.querySelector('.size-guide-selectedFilters.hide').setAttribute('data-sizes', sizesVal);
      applyFilter();
    });
    select.addEventListener('tab-change', (e) => {
      document.querySelector('.size-guide-selectedFilters.hide')?.getAttributeNames().forEach((key) => {
        if (key.startsWith('data-') && !key.startsWith('data-pdp-')) {
          document.querySelector('.size-guide-selectedFilters.hide').removeAttribute(key);
        }
      });
      document.querySelector('.size-guide-selectedFilters.hide')?.setAttribute('data-tab', e.detail.id.substr(4));
      loadDefaultFilterValues();
      applyFilter();
    });
  });
  window.addEventListener('delayed-loaded', () => {
    initSizeGuideDefaults();
  });
}
