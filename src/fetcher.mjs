import { config } from './config.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches all products from Shopify endpoint with pagination
 * @param {string} endpoint - e.g. '/collections/watches/products.json'
 * @returns {Promise<Array>} raw products list
 */
async function fetchProductsFromEndpoint(endpoint) {
  const allProducts = [];
  let page = 1;

  while (page <= config.maxPages) {
    const url = new URL(endpoint, config.baseUrl);
    url.searchParams.set('limit', String(config.pageSize));
    url.searchParams.set('page', String(page));

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'CasioPriceTracker/1.0 (GitHub-Hosted; Node.js)',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[Fetcher] Warning: ${url.pathname} returned HTTP ${response.status}`);
        break;
      }

      const data = await response.json();
      const products = data.products || [];

      if (products.length === 0) {
        break;
      }

      allProducts.push(...products);

      // If page had fewer items than pageSize, we've reached the end
      if (products.length < config.pageSize) {
        break;
      }

      page++;
      if (config.requestDelayMs > 0) {
        await sleep(config.requestDelayMs);
      }
    } catch (err) {
      console.error(`[Fetcher] Error on page ${page} of ${endpoint}:`, err.message);
      break;
    }
  }

  return allProducts;
}

/**
 * Extract series/brand categorization from Casio model names and tags
 */
function detectSeries(title, tags = []) {
  const upperTitle = title.toUpperCase();
  const tagsStr = tags.join(' ').toUpperCase();

  if (upperTitle.includes('G-SHOCK') || upperTitle.startsWith('GA-') || upperTitle.startsWith('DW-') || upperTitle.startsWith('GM-') || upperTitle.startsWith('GMD-') || upperTitle.startsWith('GMA-') || upperTitle.startsWith('GST-')) {
    return 'G-Shock';
  }
  if (upperTitle.includes('EDIFICE') || upperTitle.startsWith('ECB-') || upperTitle.startsWith('EFV-') || upperTitle.startsWith('EFR-') || upperTitle.startsWith('EQB-')) {
    return 'Edifice';
  }
  if (upperTitle.includes('BABY-G') || upperTitle.startsWith('BA-') || upperTitle.startsWith('BGD-')) {
    return 'Baby-G';
  }
  if (upperTitle.includes('PRO TREK') || upperTitle.startsWith('PRG-') || upperTitle.startsWith('PRW-')) {
    return 'Pro Trek';
  }
  if (upperTitle.includes('VINTAGE') || upperTitle.startsWith('A168') || upperTitle.startsWith('A158') || upperTitle.startsWith('F-91W') || upperTitle.startsWith('CA-53') || upperTitle.startsWith('A100')) {
    return 'Vintage';
  }
  if (upperTitle.startsWith('MTP-') || upperTitle.startsWith('LTP-') || tagsStr.includes('ENTICER')) {
    return 'Enticer';
  }
  return 'Casio Classic';
}

/**
 * Main fetch function: Scans the target collections, filters & calculates discounts
 */
export async function fetchDiscountedWatches() {
  console.log(`[Fetcher] Starting scan on ${config.baseUrl}...`);
  const rawProducts = [];
  const seenProductIds = new Set();

  for (const endpoint of config.scanEndpoints) {
    console.log(`[Fetcher] Querying endpoint: ${endpoint}`);
    const products = await fetchProductsFromEndpoint(endpoint);
    for (const p of products) {
      if (!seenProductIds.has(p.id)) {
        seenProductIds.add(p.id);
        rawProducts.push(p);
      }
    }
  }

  console.log(`[Fetcher] Total unique products scanned: ${rawProducts.length}`);

  const discounted = [];

  for (const product of rawProducts) {
    const variants = product.variants || [];
    const image = product.images && product.images.length > 0 ? product.images[0].src : null;
    const series = detectSeries(product.title, product.tags);

    for (const variant of variants) {
      const price = parseFloat(variant.price || 0);
      const compareAtPrice = parseFloat(variant.compare_at_price || 0);

      // Check if there is an active discount on a valid price
      if (price > 0 && compareAtPrice > price) {
        const savings = Math.round(compareAtPrice - price);
        const discountPercent = Math.round(((compareAtPrice - price) / compareAtPrice) * 100);

        if (discountPercent >= config.minDiscountPercent) {
          discounted.push({
            id: `${product.id}_${variant.id}`,
            productId: product.id,
            variantId: variant.id,
            title: product.title,
            variantTitle: variant.title !== 'Default Title' ? variant.title : null,
            sku: variant.sku || 'N/A',
            series,
            price,
            originalPrice: compareAtPrice,
            savings,
            discountPercent,
            available: Boolean(variant.available),
            url: `${config.baseUrl}/products/${product.handle}`,
            image,
            updatedAt: variant.updated_at || product.updated_at || new Date().toISOString()
          });
        }
      }
    }
  }

  // Sort strictly by discount percent descending.
  // In case of a tie, sort by highest savings in ₹ descending, then by availability
  discounted.sort((a, b) => {
    if (b.discountPercent !== a.discountPercent) {
      return b.discountPercent - a.discountPercent;
    }
    if (b.savings !== a.savings) {
      return b.savings - a.savings;
    }
    return Number(b.available) - Number(a.available);
  });

  const inStockCount = discounted.filter((w) => w.available).length;
  console.log(`[Fetcher] Found ${discounted.length} discounted items (${inStockCount} currently in-stock).`);

  return {
    scannedAt: new Date().toISOString(),
    totalProductsScanned: rawProducts.length,
    totalDiscounted: discounted.length,
    inStockDiscounted: inStockCount,
    items: discounted
  };
}
