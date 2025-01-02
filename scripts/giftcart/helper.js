import { validateInput } from '../forms.js';
import { getConfigValue } from '../configs.js';
import { createCart } from '../minicart/cart.js';
import { store } from '../minicart/api.js';

export function getTopUpAmount(topUpOptionsRadios, customAmountInput) {
  const selectedRadio = [...topUpOptionsRadios].find((radio) => radio.checked);
  return selectedRadio ? selectedRadio.value : customAmountInput.value;
}

export function enableTopUpButton(
  form,
  customAmountInput,
  topUpOptionsRadios,
  egiftTopUpButton,
  egiftCardNumberInput = false,
  egiftCardAmountInput = false,
) {
  const customAmount = customAmountInput.value;
  const topUpAmountSelected = [...topUpOptionsRadios].some((radio) => radio.checked);
  let isValidEgiftCardNumber = true;
  let isValidEgiftAmount = true;

  if (egiftCardNumberInput) {
    isValidEgiftCardNumber = validateInput(egiftCardNumberInput);
  }

  if (egiftCardAmountInput) {
    isValidEgiftAmount = topUpAmountSelected
      ? true
      : egiftCardAmountInput.getAttribute('aria-invalid') === 'false';
  }

  const shouldEnableButton = isValidEgiftCardNumber
                              && isValidEgiftAmount
                              && (topUpAmountSelected || customAmount);

  egiftTopUpButton.disabled = !shouldEnableButton;
}

export async function getTopUpOptions() {
  const topUpOptions = await getConfigValue('egift-top-up-options') || '50,75,100,200,300,400,500,1000';
  return topUpOptions.split(',');
}

export async function checkoutTopUpEgift(digitalCartId) {
  sessionStorage.setItem('digital-cart-id', digitalCartId);
  const lang = document.documentElement.lang || 'en';
  const checkoutUrl = `/${lang}/checkout`;

  if (!store.getCartId()) {
    await createCart();
  }
  window.location = `${checkoutUrl}`;
}

export function containsArabicDigits(str) {
  const arabicDigitPattern = /[\u0660-\u0669]/;
  return arabicDigitPattern.test(str);
}

export function arabicToLatinDigits(str) {
  const arabicToLatinMap = {
    '\u0660': '0',
    '\u0661': '1',
    '\u0662': '2',
    '\u0663': '3',
    '\u0664': '4',
    '\u0665': '5',
    '\u0666': '6',
    '\u0667': '7',
    '\u0668': '8',
    '\u0669': '9',
  };

  return str.replace(/[\u0660-\u0669]/g, (digit) => arabicToLatinMap[digit]);
}
