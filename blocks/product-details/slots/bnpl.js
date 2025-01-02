import { loadScript } from '../../../scripts/aem.js';
import { getConfigValue } from '../../../scripts/configs.js';
import { toggleExpand } from './info-content.js';

function isInBnplRange(min, max, amount) {
  return amount >= min && amount <= max;
}

// eslint-disable-next-line import/prefer-default-export
export async function decorateBnpl(ctx, bnplContainer, placeholders) {
  const lang = document.documentElement.lang || 'en';
  const country = await getConfigValue('country-code');
  const currency = await getConfigValue('currency');
  const { maximumAmount, minimumAmount, amount } = ctx.data.prices.final;
  let bnplOptionsConfig = await getConfigValue('bnpl-options');
  const bnplMinOrderTotal = await getConfigValue('bnpl-min-order-total');
  const bnplMaxOrderTotal = await getConfigValue('bnpl-max-order-total');
  const tabbyApiKey = await getConfigValue('bnpl-tabby-api-key');
  const tamaraApiKey = await getConfigValue('bnpl-tamara-api-key');

  if (amount) {
    if (amount < +bnplMinOrderTotal || amount > +bnplMaxOrderTotal) {
      return;
    }
  }

  if (minimumAmount && maximumAmount) {
    if (minimumAmount > +bnplMaxOrderTotal || maximumAmount < +bnplMinOrderTotal) {
      return;
    }
  }

  const bnplExpandedConfig = await getConfigValue('bnpl-expanded');
  if (!bnplOptionsConfig && bnplOptionsConfig !== '') {
    bnplOptionsConfig = 'tabby,tamara';
  }
  if (bnplOptionsConfig) {
    const bnplOptions = bnplOptionsConfig.split(',').map((option) => option.trim());
    const bnplHeader = document.createElement('div');
    bnplHeader.classList.add('bnpl-header');
    const bnplHeaderTitle = document.createElement('h3');
    bnplHeaderTitle.innerHTML = placeholders.bnplTitle || 'Pay in interest-free installments';
    bnplHeader.appendChild(bnplHeaderTitle);
    const bnplContent = document.createElement('div');
    bnplContent.classList.add('bnpl-content');
    const bnplContainerDivs = {};
    let bnplAmount = amount;
    bnplOptions.forEach((option) => {
      const optionContainer = document.createElement('div');
      optionContainer.classList.add('bnpl-option');
      if (option === 'tabby') {
        optionContainer.innerHTML = `
          <div id="tabby-view"></div>
        `;
      } else if (option === 'tamara') {
        optionContainer.innerHTML = `
          <tamara-widget type="tamara-summary" 
            class="tamara-product-widget"
            id="tamara-widget-pdp"
            inline-type="5"
            country="${country}"
            lang="${lang}"
            amount="${bnplAmount}">
          </tamara-widget>
        `;
      } else {
        return;
      }

      bnplContainerDivs[option] = optionContainer;
      bnplContent.appendChild(optionContainer);
    });
    bnplContainer.appendChild(bnplHeader);
    bnplContainer.appendChild(bnplContent);

    window.addEventListener('delayed-loaded', async () => {
      if (!isInBnplRange(bnplMinOrderTotal, bnplMaxOrderTotal, bnplAmount)) {
        bnplContainer.classList.add('hide');
      } else {
        bnplContainer.classList.remove('hide');
      }
      if (bnplOptions.includes('tabby')) {
        await loadScript('https://checkout.tabby.ai/integration.js');
        await loadScript('https://checkout.tabby.ai/tabby-promo-al-shaya.js');

        // eslint-disable-next-line no-undef
        TabbyProductPageSnippetAlShaya({
          selector: '#tabby-view',
          currency,
          price: bnplAmount,
          lang,
          source: 'product',
          api_key: tabbyApiKey,
        });
      }

      if (bnplOptions.includes('tamara')) {
        const tamaraScriptUrl = await getConfigValue('bnpl-tamara-url');
        await loadScript(tamaraScriptUrl);
        window.tamaraWidgetConfig = {
          lang,
          country,
          publicKey: tamaraApiKey,
        };
        window.TamaraWidgetV2?.refresh();
      }

      bnplHeaderTitle.addEventListener('click', () => toggleExpand(bnplHeaderTitle, bnplContent, bnplOptions));
      setTimeout(() => {
        if (bnplExpandedConfig === 'true') {
          toggleExpand(bnplHeaderTitle, bnplContent, bnplOptions);
        }
      }, 1000);

      ctx.onChange((next) => {
        const { final: finalChanged } = next.data.prices;
        bnplAmount = finalChanged.amount;
        if (!isInBnplRange(bnplMinOrderTotal, bnplMaxOrderTotal, bnplAmount)) {
          bnplContainer.classList.add('hide');
        } else {
          bnplContainer.classList.remove('hide');
          // eslint-disable-next-line no-undef
          if (bnplOptions.includes('tabby') && TabbyProductPageSnippetAlShaya) {
            // eslint-disable-next-line no-undef
            TabbyProductPageSnippetAlShaya({
              selector: '#tabby-view',
              currency,
              price: bnplAmount,
              lang,
              source: 'product',
              api_key: tabbyApiKey,
            });
          }
          // eslint-disable-next-line no-undef
          if (bnplOptions.includes('tamara')) {
            bnplContainerDivs?.tamara?.querySelector('tamara-widget')?.setAttribute('amount', bnplAmount);
            window.TamaraWidgetV2?.refresh();
          }
        }
      });
    });

    ctx.onChange((next) => {
      const { final: finalChanged } = next.data.prices;
      bnplAmount = finalChanged.amount;
      bnplContainerDivs?.tamara?.querySelector('tamara-widget')?.setAttribute('amount', bnplAmount);
    });
  }
}
