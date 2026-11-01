import fs from 'fs';
import path from 'path';
import { config } from './config.mjs';
import { fetchDiscountedWatches } from './fetcher.mjs';
import { dispatchAlerts } from './alerter.mjs';

function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true });
  }
}

export function loadJson(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn(`[Tracker] Could not load ${filePath}: ${err.message}. Using fallback.`);
  }
  return fallback;
}

export function saveJson(filePath, data) {
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Pure delta analysis: compares current scan with historical snapshot
 * Detects: NEW_DISCOUNT, RETURNED_TO_SALE, PRICE_DROP, RESTOCKED, and ALL-TIME LOW
 */
export function detectAlerts(allDiscounted, previousItems = {}, options = {}) {
  const {
    alertMinDiscountPercent = config.alertMinDiscountPercent,
    alertInStockOnly = config.alertInStockOnly,
    forceAlertAll = config.forceAlertAll
  } = options;

  const currentDiscountedIds = new Set(allDiscounted.map((i) => i.id));
  const newAlerts = [];
  const updatedHistory = {};

  // 1. Ingest clean previous items (discard corrupted entries where price <= 0)
  for (const [id, prev] of Object.entries(previousItems)) {
    if (prev && typeof prev.price === 'number' && prev.price > 0) {
      updatedHistory[id] = { ...prev };
      // If the watch was previously on sale, but is no longer in current discounts, mark its sale ended
      if (!currentDiscountedIds.has(id) && prev.isDiscounted !== false) {
        updatedHistory[id].isDiscounted = false;
        updatedHistory[id].saleEndedAt = new Date().toISOString();
      }
    }
  }

  // 2. Evaluate current discounted watches
  for (const item of allDiscounted) {
    const prev = updatedHistory[item.id];
    let shouldAlert = false;
    let reason = '';

    if (!prev || prev.isDiscounted === false) {
      // First time seen, OR returning to discount after sale ended!
      shouldAlert = true;
      reason = prev ? 'RETURNED_TO_SALE' : 'NEW_DISCOUNT';
    } else if (item.price < prev.price) {
      // Price dropped even lower!
      shouldAlert = true;
      reason = 'PRICE_DROP';
    } else if (!prev.available && item.available) {
      // Restocked with active discount!
      shouldAlert = true;
      reason = 'RESTOCKED';
    }

    // Determine all-time low & highest discount recorded
    const lowestPrev = prev && typeof prev.lowestPriceEver === 'number' && prev.lowestPriceEver > 0
      ? prev.lowestPriceEver
      : (prev ? prev.price : item.price);
    const isAllTimeLow = !prev || !prev.lowestPriceEver || item.price < lowestPrev;
    const lowestPriceEver = Math.min(lowestPrev, item.price);
    const highestDiscountEver = Math.max(prev?.highestDiscountEver || 0, item.discountPercent);

    item.isAllTimeLow = isAllTimeLow;
    item.lowestPriceEver = lowestPriceEver;

    const meetsDiscountThreshold = item.discountPercent >= alertMinDiscountPercent;
    const meetsStockCondition = !alertInStockOnly || item.available;

    if (forceAlertAll) {
      shouldAlert = true;
      reason = 'FORCED_TEST';
    }

    if (shouldAlert && meetsDiscountThreshold && meetsStockCondition) {
      newAlerts.push({
        ...item,
        alertReason: reason,
        previousPrice: prev ? prev.price : null
      });
    }

    // Update historical state
    updatedHistory[item.id] = {
      title: item.title,
      price: item.price,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
      available: item.available,
      isDiscounted: true,
      lowestPriceEver,
      highestDiscountEver,
      lastSeen: new Date().toISOString()
    };
  }

  newAlerts.sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);

  return { newAlerts, updatedHistory };
}

export async function runTracker() {
  console.log('='.repeat(65));
  console.log(`⌚ Casio Watch Discount Tracker & Alerter ${config.dryRun ? '[DRY RUN MODE]' : ''}`);
  console.log(`Target: ${config.baseUrl}/collections/watches`);
  console.log(`Time:   ${new Date().toISOString()}`);
  console.log('='.repeat(65));

  // 1. Load historical state
  const history = loadJson(config.paths.historyJson, { items: {}, lastRun: null });
  const previousItems = history.items || {};

  // 2. Fetch fresh discounted watches
  const scanResult = await fetchDiscountedWatches();
  const { items: allDiscounted, totalProductsScanned } = scanResult;

  // 3. Detect changes (new discounts, returned to sale, price drops, restocks)
  const { newAlerts, updatedHistory } = detectAlerts(allDiscounted, previousItems, {
    alertMinDiscountPercent: config.alertMinDiscountPercent,
    alertInStockOnly: config.alertInStockOnly,
    forceAlertAll: config.forceAlertAll
  });

  console.log(`\n[Tracker] Analysis Summary:`);
  console.log(`- Scanned Total:        ${totalProductsScanned} watches`);
  console.log(`- Total Discounted:     ${allDiscounted.length} watches`);
  console.log(`- New Alerts Triggered: ${newAlerts.length} watches`);

  // Console preview of top discounts
  if (allDiscounted.length > 0) {
    console.log(`\nTop current discounts:`);
    console.table(
      allDiscounted.slice(0, 8).map((w) => ({
        Model: w.title,
        'Discount %': `${w.discountPercent}%`,
        Price: `₹${Math.round(w.price).toLocaleString('en-IN')}`,
        MRP: `₹${Math.round(w.originalPrice).toLocaleString('en-IN')}`,
        'All-Time Low': w.isAllTimeLow ? '🌟 Yes' : 'No',
        Stock: w.available ? 'In Stock' : 'Out of Stock',
        Series: w.series
      }))
    );
  }

  // 4. Dispatch alerts to Telegram, Discord, NTFY, and GitHub Summary
  await dispatchAlerts(newAlerts, allDiscounted);

  // 5. Save data artifacts for GitHub Pages and future runs (unless in dry-run mode)
  const payload = {
    updatedAt: new Date().toISOString(),
    storeUrl: `${config.baseUrl}/collections/watches`,
    stats: {
      totalScanned: totalProductsScanned,
      totalDiscounted: allDiscounted.length,
      inStockDiscounted: allDiscounted.filter((w) => w.available).length
    },
    items: allDiscounted
  };

  if (config.dryRun) {
    console.log(`\n[Tracker] [DRY RUN] Skipping file writes to ${config.paths.discountsJson}`);
  } else {
    saveJson(config.paths.discountsJson, payload);
    saveJson(config.paths.webDataJson, payload);
    saveJson(config.paths.historyJson, {
      items: updatedHistory,
      lastRun: new Date().toISOString()
    });

    console.log(`\n[Tracker] Saved current discounts to ${config.paths.discountsJson}`);
    console.log(`[Tracker] Saved web data to ${config.paths.webDataJson}`);
  }

  console.log('='.repeat(65));
}

import { fileURLToPath } from 'url';

// Execute if run directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runTracker().catch((err) => {
    console.error('[Tracker] Fatal error:', err);
    process.exit(1);
  });
}
