import { fetchPlaceholdersForLocale } from '../../scripts/scripts.js';
import { fetchCommerceCategories } from '../../scripts/commerce.js';
import {
  buildAlgoliaRequest,
  getProductListingConfig,
  buildHits,
  updateWishlistIcons,
} from '../algolia-product-listing/algolia-product-listing.js';
import { getCategoryProducts } from '../../scripts/product-list/api.js';

export default async function decorate(block) {
  const productListingConfig = await getProductListingConfig();
  const categoryId = block.textContent.trim();
  const categories = await fetchCommerceCategories(categoryId);
  const categoryPath = categories?.items?.find((item) => item.id === Number(categoryId))?.url_path
  || null;
  const data = buildAlgoliaRequest(productListingConfig);
  const response = await getCategoryProducts(data.requests, categoryPath);
  const placeholders = await fetchPlaceholdersForLocale();
  const config = await getProductListingConfig();
  buildHits(response, { config, placeholdersList: placeholders, blocktype: block });
  updateWishlistIcons();
}
