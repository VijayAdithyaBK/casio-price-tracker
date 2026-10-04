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

function loadJson(filePath, fallback = {}) {
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

function saveJson(filePath, data) {
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function runTracker() {
  console.log('='.repeat(65));
  console.log('⌚ Casio Watch Discount Tracker & Alerter');
  console.log(`Target: ${config.baseUrl}/collections/watches`);
  console.log(`Time:   ${new Date().toISOString()}`);
  console.log('='.repeat(65));

  // 1. Load historical state
  const history = loadJson(config.paths.historyJson, { items: {}, lastRun: null });
  const previousItems = history.items || {};

  // 2. Fetch fresh discounted watches
  const scanResult = await fetchDiscountedWatches();
  const { items: allDiscounted, totalProductsScanned } = scanResult;

  // 3. Detect changes (new discounts, price drops, restocks)
  const newAlerts = [];
  const updatedHistory = { ...previousItems };

  for (const item of allDiscounted) {
    const prev = previousItems[item.id];
    let shouldAlert = false;
    let reason = '';

    if (!prev) {
      // New deal detected
      shouldAlert = true;
      reason = 'NEW_DISCOUNT';
    } else if (item.price < prev.price) {
      // Price dropped even further!
      shouldAlert = true;
      reason = 'PRICE_DROP';
    } else if (!prev.available && item.available) {
      // Restocked with active discount!
      shouldAlert = true;
      reason = 'RESTOCKED';
    }

    // Apply configured alert filters
    const meetsDiscountThreshold = item.discountPercent >= config.alertMinDiscountPercent;
    const meetsStockCondition = !config.alertInStockOnly || item.available;

    if (config.forceAlertAll) {
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

    // Update state tracking
    updatedHistory[item.id] = {
      title: item.title,
      price: item.price,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
      available: item.available,
      lastSeen: new Date().toISOString()
    };
  }

  // 4. Sort new alerts strictly by discount descending
  newAlerts.sort((a, b) => b.discountPercent - a.discountPercent || b.savings - a.savings);

  console.log(`\n[Tracker] Analysis Summary:`);
  console.log(`- Scanned Total:        ${totalProductsScanned} watches`);
  console.log(`- Total Discounted:     ${allDiscounted.length} watches`);
  console.log(`- New Alerts Triggered: ${newAlerts.length} watches`);

  // Console preview of top 5 discounts
  if (allDiscounted.length > 0) {
    console.log(`\nTop current discounts:`);
    console.table(
      allDiscounted.slice(0, 8).map((w) => ({
        Model: w.title,
        'Discount %': `${w.discountPercent}%`,
        Price: `₹${w.price.toLocaleString('en-IN')}`,
        MRP: `₹${w.originalPrice.toLocaleString('en-IN')}`,
        Stock: w.available ? 'In Stock' : 'Out of Stock',
        Series: w.series
      }))
    );
  }

  // 5. Dispatch alerts to Telegram, Discord, NTFY, and GitHub Summary
  await dispatchAlerts(newAlerts, allDiscounted);

  // 6. Save data artifacts for GitHub Pages and future runs
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

  saveJson(config.paths.discountsJson, payload);
  saveJson(config.paths.webDataJson, payload);
  saveJson(config.paths.historyJson, {
    items: updatedHistory,
    lastRun: new Date().toISOString()
  });

  console.log(`\n[Tracker] Saved current discounts to ${config.paths.discountsJson}`);
  console.log(`[Tracker] Saved web data to ${config.paths.webDataJson}`);
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

