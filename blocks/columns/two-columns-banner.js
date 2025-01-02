import {
  updateBannerTextConfigs, getInlineStyle, scheduleBannerFromMetaConfig, initSettingsPanel,
} from '../../scripts/banner-utils/banner-utils.js';

export default async function decorateBanner(block) {
  [...block.children].slice(0, -1).forEach((row) => {
    [...row.children].forEach((column) => {
      const anchor = document.createElement('a');
      anchor.href = column.querySelector('a').href;
      while (column.firstChild) {
        anchor.appendChild(column.firstChild);
      }
      column.appendChild(anchor);
    });
  });
  if (await scheduleBannerFromMetaConfig(block)) {
    const isSidekickLibrary = document.body.classList.contains('sidekick-library');
    const bannerWrapper = block.closest('.two-column-banner');
    const styleConfigurations = Array.from(block.querySelectorAll(':scope div > div')).slice(-1)[0];
    styleConfigurations.style.display = 'none';
    styleConfigurations?.parentElement.classList.add('style-configurations');
    block.classList.add('active');
    block.parentElement.previousElementSibling.classList.add('block-header');

    if (styleConfigurations) {
      block.style.cssText = getInlineStyle(styleConfigurations);
    }
    if (bannerWrapper) {
      await updateBannerTextConfigs(bannerWrapper, true, 'twoColumn');
    }
    if (isSidekickLibrary) {
      await initSettingsPanel(block);
    }
  }
}
