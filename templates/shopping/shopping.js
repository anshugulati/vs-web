import { loadCSS, loadScript } from '../../scripts/aem.js';
import { getBrandPath } from '../../scripts/scripts.js';

export default async function decorate(main) {
  await Promise.all([
    loadCSS(`/styles/${getBrandPath()}forms.css`),
    loadCSS(`/blocks/account-address-book/${getBrandPath()}account-address-book.css`),
    loadScript('/scripts/react-bridge.js', { type: 'module' }),
    loadCSS(`/templates/user/${getBrandPath()}user.css`)]);
  setTimeout(() => main, 1000);
}
