function createElement(tag, classNames = [], attributes = {}) {
  const element = document.createElement(tag);
  element.classList.add(...classNames);

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

function createAccordionTab(tabLabel, index) {
  const newAccordionTab = createElement('button', ['accordion-tab'], {
    'data-actab-group': '0',
    'data-actab-id': index,
  });
  newAccordionTab.textContent = tabLabel.textContent;
  return newAccordionTab;
}

function createAccordionContentItem(tabLabel, contentHTML, index) {
  const newContentItem = createElement('article', ['accordion-item'], {
    'data-actab-group': '0',
    'data-actab-id': index,
  });

  const label = createElement('h4', ['accordion-item__label']);
  label.textContent = tabLabel.textContent;

  const container = createElement('div', ['accordion-item__container']);
  container.innerHTML = contentHTML.innerHTML;

  newContentItem.appendChild(label);
  newContentItem.appendChild(container);

  return newContentItem;
}

function toggleShow(event) {
  const { actabGroup, actabId } = event.currentTarget.dataset;
  document.querySelectorAll(`[data-actab-group="${actabGroup}"]`).forEach((el) => {
    el.classList.toggle('accordion-active', el.dataset.actabId === actabId);
  });
}

function createAccordionStructure(block) {
  const newAccordion = createElement('section', ['accordion-tab-section']);
  const accordionTabsSection = createElement('section', ['accordion-tabs']);
  const contentSection = createElement('section', ['accordion-content']);

  [...block.children].forEach((row, index) => {
    const [tabLabel, contentHTML] = row.children;

    const newAccordionTab = createAccordionTab(tabLabel, index);
    accordionTabsSection.appendChild(newAccordionTab);

    const newContentItem = createAccordionContentItem(tabLabel, contentHTML, index);
    contentSection.appendChild(newContentItem);
  });

  newAccordion.appendChild(accordionTabsSection);
  newAccordion.appendChild(contentSection);

  return { newAccordion, accordionTabsSection, contentSection };
}

function addAccordionEventListeners() {
  document.querySelectorAll('.accordion-tab, .accordion-item').forEach((el) => {
    el.addEventListener('click', toggleShow);
  });
}

export default async function decorate(block) {
  const oldAccordionTab = document.querySelector('.accordion-tab.block');
  const { newAccordion } = createAccordionStructure(block);

  oldAccordionTab.parentNode.replaceChild(newAccordion, oldAccordionTab);

  addAccordionEventListeners();

  document.querySelector('.accordion-tab')?.classList.add('accordion-active');
  document.querySelector('.accordion-item')?.classList.add('accordion-active');
  document.querySelector('.accordion-tab-wrapper')?.classList.add('column');
}
