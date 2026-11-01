import { config } from './config.mjs';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch helper with exponential backoff and jitter for rate-limiting (429) & server errors (5xx)
 */
async function fetchWithRetry(url, options = {}, retries = config.retryAttempts, baseDelay = config.retryBaseDelayMs) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      // Handle 429 Too Many Requests or 5xx Server Errors
      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
        const jitter = Math.floor(Math.random() * 200);
        const delay = (retryAfterSec > 0 ? retryAfterSec * 1000 : baseDelay * Math.pow(2, attempt - 1)) + jitter;

        console.warn(`[Fetcher] HTTP ${response.status} on ${url}. Retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
        if (attempt < retries) {
          await sleep(delay);
          continue;
        }
      }

      return response;
    } catch (err) {
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
        console.warn(`[Fetcher] Network error (${err.message}). Retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Fetches all products from Shopify endpoint with pagination
 * @param {string} endpoint - e.g. '/collections/watches/products.json'
 * @returns {Promise<Array>} raw products list
 */
export async function fetchProductsFromEndpoint(endpoint) {
  const allProducts = [];
  let page = 1;

  while (page <= config.maxPages) {
    const url = new URL(endpoint, config.baseUrl);
    url.searchParams.set('limit', String(config.pageSize));
    url.searchParams.set('page', String(page));

    try {
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          'User-Agent': 'CasioPriceTracker/2.0 (GitHub-Hosted; Node.js; +https://github.com)',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[Fetcher] Warning: ${url.pathname} returned HTTP ${response.status} after retries.`);
        break;
      }

      const data = await response.json();
      const products = data.products || [];

      if (products.length === 0) {
        break;
      }

      allProducts.push(...products);

      // If page had fewer items than pageSize, we've reached the end of the collection
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
export function detectSeries(title = '', tags = []) {
  const upperTitle = String(title).toUpperCase().trim();
  const tagsStr = Array.isArray(tags) ? tags.join(' ').toUpperCase() : String(tags).toUpperCase();

  // 1. Baby-G (Check before G-Shock to avoid misclassifying BABY-G as G-Shock)
  const babyGPrefixes = ['BA-', 'BGD-', 'BGA-', 'BG-', 'MSG-'];
  if (
    upperTitle.includes('BABY-G') ||
    upperTitle.includes('BABYG') ||
    tagsStr.includes('BABY-G') ||
    tagsStr.includes('BABYG') ||
    babyGPrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'Baby-G';
  }

  // 2. G-Shock / CasiOak
  const gShockPrefixes = [
    'GA-', 'DW-', 'GM-', 'GMD-', 'GMA-', 'GST-', 'GBD-', 'GW-', 'GWG-',
    'GBX-', 'GD-', 'GG-', 'GR-', 'GX-', 'MTG-', 'MRG-', 'GLX-', 'G-', 'GA-B', 'DW-B'
  ];
  if (
    upperTitle.includes('G-SHOCK') ||
    upperTitle.includes('GSHOCK') ||
    upperTitle.includes('CASIOAK') ||
    tagsStr.includes('G-SHOCK') ||
    tagsStr.includes('GSHOCK') ||
    gShockPrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'G-Shock';
  }

  // 3. Edifice
  const edificePrefixes = [
    'ECB-', 'EFV-', 'EFR-', 'EQB-', 'EFS-', 'ERA-', 'EFA-', 'EQW-', 'EFB-', 'EF-', 'EQS-'
  ];
  if (
    upperTitle.includes('EDIFICE') ||
    tagsStr.includes('EDIFICE') ||
    edificePrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'Edifice';
  }

  // 4. Pro Trek
  const proTrekPrefixes = ['PRG-', 'PRW-', 'PRT-', 'PAG-', 'PAW-'];
  if (
    upperTitle.includes('PRO TREK') ||
    upperTitle.includes('PROTREK') ||
    tagsStr.includes('PRO TREK') ||
    tagsStr.includes('PROTREK') ||
    proTrekPrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'Pro Trek';
  }

  // 5. Sheen
  const sheenPrefixes = ['SHE-', 'SHS-'];
  if (
    upperTitle.includes('SHEEN') ||
    tagsStr.includes('SHEEN') ||
    sheenPrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'Sheen';
  }

  // 6. Vintage / Heritage
  const vintagePrefixes = [
    'A168', 'A158', 'A159', 'A164', 'F-91W', 'CA-53', 'A100', 'B640',
    'B650', 'DB-', 'CA-500', 'AQ-230', 'AQ-800', 'A1000', 'A700',
    'F-105W', 'F-108WH', 'A171', 'LA670', 'LA680', 'A500', 'LF-20W'
  ];
  if (
    upperTitle.includes('VINTAGE') ||
    tagsStr.includes('VINTAGE') ||
    vintagePrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'Vintage';
  }

  // 7. Enticer
  const enticerPrefixes = ['MTP-', 'LTP-'];
  if (
    tagsStr.includes('ENTICER') ||
    enticerPrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'Enticer';
  }

  // 8. Youth / General Digital (Casio Royale AE-1200, W-218H, etc.)
  const youthPrefixes = ['AE-', 'W-', 'WS-', 'MW-', 'MRW-', 'HDA-', 'F-201', 'SGW-'];
  if (
    tagsStr.includes('YOUTH') ||
    youthPrefixes.some((p) => upperTitle.startsWith(p))
  ) {
    return 'Youth';
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
            price: Number(price.toFixed(2)),
            originalPrice: Number(compareAtPrice.toFixed(2)),
            savings,
            discountPercent,
            available: Boolean(variant.available),
            // Link directly to the discounted variant SKU
            url: `${config.baseUrl}/products/${product.handle}?variant=${variant.id}`,
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
