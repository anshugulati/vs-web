/**
 * Utility to find attribute is array of objects and return it's value
 * @param {*} arr Array of attributes object
 * @param {*} attribute Attribute name to find
 * @returns Attribute value if present else undefined
 */
export function getValue(arr, attribute) {
  const value = arr?.find((el) => el.name === attribute)?.value || undefined;
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return value.join(', ');
  }
  return value;
}

/**
 * Method to create common data object for all pages
 * @returns page data object
 */
export function brandPageLoadData() {
  return {
    // Add brand specific common data here
  };
}

/**
 * Method to create data object for PDP page
 * @param {attributes} product Product data from commerce
 * @returns pdp data object
 */
export async function brandPdpLoadData() {
  return {
    // TBD
    // 'entity.fragrance_category': getValue(attributes, 'fragrance_category'),
  };
}
