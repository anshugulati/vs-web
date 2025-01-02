import { fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
import { datalayerPromoSelectorEvent } from '../../scripts/analytics/google-data-layer.js';

export async function processCouponSection(child, promoCode, placeholders) {
  const h2 = child.querySelector('h2');
  const parent = h2?.parentElement;

  if (h2 && parent) {
    const div = document.createElement('div');
    div.className = 'offer-selector__wrapper';

    const buttonContainer = child.querySelector('.button-container');
    const button = buttonContainer?.querySelector('.button');

    const innerTxt = h2.innerText.split(':');
    const span1 = document.createElement('span');
    span1.textContent = `${innerTxt[0]} : `;

    const trimmerVoucherCode = innerTxt[1]?.trim();
    const span2 = document.createElement('span');
    span2.className = 'offer-selector__voucher-code';
    span2.textContent = trimmerVoucherCode;

    child.setAttribute('data-voucher', trimmerVoucherCode);
    button?.setAttribute('data-voucher-code', trimmerVoucherCode);

    if (promoCode === trimmerVoucherCode) {
      button.classList.add('disabled');
      button.textContent = placeholders.bbwVoucherApplied;
    }

    h2.innerText = '';
    h2.appendChild(span1);
    h2.appendChild(span2);

    div.appendChild(h2);
    if (buttonContainer) {
      div.appendChild(buttonContainer);
    }

    parent.insertBefore(div, parent.firstChild);

    const offerDetailPara = child.querySelector('.offer-selector__wrapper');
    offerDetailPara.nextElementSibling.className = 'offer-selector__description';

    const ul = child.querySelector('ul');
    if (ul) {
      ul.style.display = 'none';

      const detailsButton = document.createElement('button');
      detailsButton.textContent = placeholders.bbwVoucherViewDetails;
      detailsButton.className = 'offer-selector__details-button';

      detailsButton.addEventListener('click', () => {
        if (ul.style.display === 'none') {
          ul.style.display = 'block';
          detailsButton.textContent = placeholders.bbwVoucherHideDetails;
        } else {
          ul.style.display = 'none';
          detailsButton.textContent = placeholders.bbwVoucherViewDetails;
        }
      });

      ul.insertAdjacentElement('afterend', detailsButton);
    }

    button?.addEventListener('click', async (event) => {
      event.preventDefault();
      const voucherCode = event.target.getAttribute('data-voucher-code');
      datalayerPromoSelectorEvent({
        eventAction: 'select promos',
        eventLabelData: voucherCode,
      });
      window.dispatchEvent(new CustomEvent('applyCoupon', { detail: { voucherCode } }));
    });
  }
}

function handleApplyCouponResponse(event, childElements, placeholders) {
  const { result, voucherCode } = event.detail;

  if (!result) {
    return;
  }

  Array.from(childElements).forEach((child) => {
    if (child.getAttribute('data-voucher') === voucherCode) {
      const errorMessage = result?.response_message?.[1] === 'error_coupon' ? placeholders.bbwVoucherApiError : '';
      const buttonContainer = child.querySelector('.button-container a');

      buttonContainer.classList.add('disabled');

      if (result.response_message?.[1] === 'success') {
        buttonContainer.textContent = placeholders.bbwVoucherApplied;
      } else {
        const voucherWrapper = child.querySelector('.offer-selector__wrapper');

        const errorElement = document.createElement('span');
        errorElement.textContent = errorMessage;
        errorElement.className = 'offer-selector__error-message';

        voucherWrapper.insertAdjacentElement('afterend', errorElement);
      }
    }
  });
}

export default async function decorate(block) {
  const placeholders = await fetchPlaceholdersForLocale();
  const childElements = block.children;
  let promoCode = '';
  const removePromoId = document.getElementById('remove-promo');
  if (removePromoId) {
    promoCode = document.getElementById('promotion-input')?.value;
  }

  Array.from(childElements).forEach((child) => {
    processCouponSection(child, promoCode, placeholders);
  });

  const applyCouponResponseHandler = (event) => {
    handleApplyCouponResponse(event, childElements, placeholders);
  };

  window.addEventListener('applyCouponResponse', applyCouponResponseHandler);

  return () => {
    window.removeEventListener('applyCouponResponse', applyCouponResponseHandler);
  };
}
