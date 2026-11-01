export const config = {
  // Target website
  baseUrl: process.env.BASE_URL || 'https://casiostore.bhawar.com',
  
  // Endpoints to scan.
  // /collections/watches is the primary collection requested.
  // We also support scanning the full catalog (/products.json) if TRACK_ALL_STORE is 'true'
  scanEndpoints: process.env.TRACK_ALL_STORE === 'true'
    ? ['/products.json']
    : ['/collections/watches/products.json'],

  // Scan limits and rate-limiting
  pageSize: 250,
  maxPages: 25,
  requestDelayMs: 250,

  // Discount thresholds
  minDiscountPercent: parseInt(process.env.MIN_DISCOUNT_PERCENT || '1', 10),
  alertMinDiscountPercent: parseInt(process.env.ALERT_MIN_DISCOUNT_PERCENT || '5', 10),

  // Stock filtering
  alertInStockOnly: process.env.ALERT_IN_STOCK_ONLY !== 'false', // default true

  // Force alert all items on test run
  forceAlertAll: process.env.FORCE_ALERT_ALL === 'true',

  // Dry-run mode (skips mutating data files and sending live notifications)
  dryRun: process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true',

  // Network retry settings
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
  retryBaseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || '1000', 10),
  maxAlertItems: parseInt(process.env.MAX_ALERT_ITEMS || '50', 10),

  // Dashboard URL for web links and alerts
  dashboardUrl: process.env.DASHBOARD_URL || 'https://vijayadithyabk.github.io/casio-price-tracker',

  // Alert services
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || ''
  },
  ntfy: {
    topic: process.env.NTFY_TOPIC || '', // e.g. "casio-deals-alerts"
    server: process.env.NTFY_SERVER || 'https://ntfy.sh'
  },

  // File paths
  paths: {
    dataDir: './data',
    discountsJson: './data/discounts.json',
    historyJson: './data/history.json',
    webDataJson: './docs/data.json'
  }
};
