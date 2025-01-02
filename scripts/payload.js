export const PROD_ENV = 'prod';
export const STAGE_ENV = 'stage';
export const DEV_ENV = 'dev';
const ALLOWED_CONFIGS = [PROD_ENV, STAGE_ENV, DEV_ENV];
// store payloads globally to avoid multiple requests
window.payloadPromises = {};

/*
 * Returns the true origin of the current page in the browser.
 * If the page is running in a iframe with srcdoc, the ancestor origin is returned.
 * @returns {String} The true origin
 */
function getOrigin() {
  const { location } = window;
  return location.href === 'about:srcdoc' ? window.parent.location.origin : location.origin;
}

/**
 * This function calculates the environment in which the site is running based on the URL.
 * It defaults to 'prod'. In non 'prod' environments, the value can be overwritten using
 * the 'environment' key in sessionStorage.
 *
 * @returns {string} - environment identifier (dev, stage or prod'.
 */
export const calcEnvironment = () => {
  const { href } = window.location;
  let environment = 'prod';
  if (href.includes('.hlx.page') || href.includes('.aem.page')) {
    environment = 'stage';
  }
  if (href.includes('localhost')) {
    environment = 'dev';
  }
  if (href.includes('eds.factory.alshayauat.com')) {
    environment = 'preview';
  }

  const environmentFromConfig = window.sessionStorage.getItem('environment');
  if (environmentFromConfig && ALLOWED_CONFIGS.includes(environmentFromConfig) && environment !== 'prod') {
    return environmentFromConfig;
  }

  return environment;
};

function getPageIdentifier() {
  const url = window.location.href;
  if (url.includes('/cart')) {
    return 'cart';
  } if (url.includes('/checkout')) {
    return 'checkout';
  } if (url.includes('/confirmation')) {
    return 'confirmation';
  }
  return '';
}

function buildConfigURL() {
  const origin = getOrigin();
  const pageIdentifier = getPageIdentifier();

  return new URL(`${origin}/${pageIdentifier}-payloads.json`);
}

const getStoredPayload = () => {
  const pageIdentifier = getPageIdentifier();
  const payloadKey = pageIdentifier ? `payload:${pageIdentifier}` : 'payload';

  return window.sessionStorage.getItem(payloadKey);
};

const storePayload = (env, payloadJSON) => {
  const pageIdentifier = getPageIdentifier();
  const payloadKey = pageIdentifier ? `payload:${pageIdentifier}` : 'payload';

  return window.sessionStorage.setItem(payloadKey, payloadJSON);
};

const getConfig = async () => {
  const env = calcEnvironment();
  let payloadsJSON = getStoredPayload();
  if (!payloadsJSON) {
    const fetchGlobalConfig = fetch(buildConfigURL());

    try {
      const responses = await Promise.all([fetchGlobalConfig]);
      // Extract JSON data from responses
      [payloadsJSON] = await Promise.all(responses
        .map((response) => response.text()));
      storePayload(env, payloadsJSON);
    } catch (e) {
      console.error('no payload config loaded', e);
    }
  }

  return JSON.parse(payloadsJSON);
};

/**
 * This function retrieves a configuration value for a given environment.
 *
 * @param {string} payloadParam - The payloadParam parameter to retrieve.
 * @returns {Promise<string|undefined>} - The value of the configuration parameter, or undefined.
 */
export const getPayloads = async (payloadParam) => {
  const env = PROD_ENV;
  if (!window.payloadPromises?.[env]) {
    window.payloadPromises[env] = getConfig(env);
  }
  const payloadsJSON = await window.payloadPromises[env];
  const payloadElements = payloadsJSON.data;
  return payloadElements.find((c) => c.key === payloadParam)?.value;
};
