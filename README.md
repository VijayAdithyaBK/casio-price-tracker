# ⌚ Casio Watch Discount Tracker & Alert System (v2.0)

A lightweight, high-efficiency, GitHub-hosted discount scanner and price drop notifier for **[Watches - casiostore.bhawar.com](https://casiostore.bhawar.com/collections/watches)** (Official Casio India Distributor — Bhawar).

Discounts are automatically sorted in **descending order** (e.g. 50% OFF, 40% OFF, 30% OFF) and dispatched across your choice of free notification channels (Telegram, Discord, NTFY mobile push, or GitHub Step Summaries).

---

## ⚡ Key Highlights (v2.0)

- **Ultra-Efficient Architecture**: Bypasses heavy, brittle headless browsers (Puppeteer/Playwright) and directly leverages Shopify's high-speed paginated backend (`/collections/watches/products.json?limit=250`). A full collection scan completes in **under 2 seconds** with exponential backoff & jitter for HTTP 429/5xx resilience.
- **Strict Discount Descending Order**: The biggest savings (50% OFF, 40% OFF, etc.) are always prioritized at the top of every alert and table.
- **Smart Delta & Anti-Spam Tracking**: Stores state history in `data/history.json`. It alerts when:
  1. A **new watch** is discounted (`NEW_DISCOUNT`).
  2. A watch **returns to a discount** after a previous sale ended (`RETURNED_TO_SALE`).
  3. A discounted watch experiences a **further price drop** (`PRICE_DROP`).
  4. A heavily discounted watch is **restocked** in inventory (`RESTOCKED`).
  5. An **All-Time Low** price is detected (`🌟 ALL-TIME LOW`).
- **Comprehensive Series Classification**: Automatically detects 9 major Casio series across titles and product tags:
  - **G-Shock / CasiOak** (`GA-`, `DW-`, `GM-`, `GBD-`, `GW-`, `GBX-`, `GST-`, `MTG-`, `MRG-`)
  - **Edifice** (`ECB-`, `EFV-`, `EFR-`, `EQB-`, `EFS-` Solar Sapphire)
  - **Vintage / Heritage** (`A168`, `A158`, `F-91W`, `A100`, `B640`, `CA-53`, `A1000` Metal)
  - **Baby-G** (`BA-`, `BGD-`, `BGA-`, `MSG-`)
  - **Pro Trek** (`PRG-`, `PRW-`, `PRT-`, `PAG-`)
  - **Enticer** (`MTP-`, `LTP-`)
  - **Sheen** (`SHE-`, `SHS-` Women's Luxury)
  - **Youth / Digital** (`AE-1200` Casio Royale, `W-218H`, `W-800H`, `MRW-200H`)
  - **Casio Classic** (Heritage Analog/Digital)
- **Multi-Channel Notification Dispatcher**:
  - **Telegram Bot**: HTML-sanitized push alerts with discount %, INR savings, and 1-click buy links (no crashes on special characters like `&` or `<`).
  - **Discord Webhook**: Color-coded rich embeds (Red for 50%+, Orange for 40%+, Gold for 30%+) automatically batched to Discord's 10-embed limits.
  - **NTFY.sh**: Free instant mobile push notification on Android/iOS with **zero sign-up** and action buttons.
  - **GitHub Step Summary**: Rich markdown dashboard with tier breakdown table and watch thumbnails.
- **Live CASIO.RADAR Web Dashboard (`docs/`)**:
  - Industrial minimalist catalog design system.
  - **Budget Price Filters**: `< ₹2,500`, `₹2,500–₹5,000`, `₹5,000–₹10,000`, `> ₹10,000`.
  - **Discount Cut Filters**: `50%+`, `40%+`, `30%+`.
  - **All-Time Low Filter**: 1-click toggle to view only all-time lowest prices.
  - **Progressive Chunking**: Buttery 60fps mobile scrolling with load-more pagination.
  - **Direct Variant Buy Links**: Links directly to the discounted variant (`?variant=...`).
  - **1-Click Deal Sharing**: Native Web Share API + clipboard fallback.

---

## 🚀 2-Minute Quick Setup

### 1. Push to your GitHub Repository
Initialize a git repository in this folder and push to your GitHub account:

```bash
git init
git add .
git commit -m "feat: initial casio discount tracker setup"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### 2. Configure GitHub Actions Permissions
1. Go to your repository on GitHub.
2. Navigate to **Settings** > **Actions** > **General**.
3. Under **Workflow permissions**, select **"Read and write permissions"** and check **"Allow GitHub Actions to create and approve pull requests"**.
4. Click **Save**.

### 3. (Optional) Add Alert Channel Secrets
Go to **Settings** > **Secrets and variables** > **Actions** and add any of the following repository secrets (see [`.env.example`](.env.example)):

| Secret Name | Description | Where to get it |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Message `@BotFather` on Telegram |
| `TELEGRAM_CHAT_ID` | Your Telegram Chat or Channel ID | Message `@userinfobot` on Telegram |
| `DISCORD_WEBHOOK_URL` | Discord Channel Webhook | Channel Settings > Integrations > Webhooks |
| `NTFY_TOPIC` | Instant phone push topic | Choose any unique name (e.g. `casio-deals-yourname`), install the [NTFY Android/iOS app](https://ntfy.sh) and subscribe! |

> **Note**: If no secrets are added, the tracker still works perfectly! It logs all deals in the **GitHub Actions Run Summary** and updates the live **GitHub Pages dashboard**.

### 4. Enable GitHub Pages (Live Web Dashboard)
1. Go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
3. Branch: select `main` and folder `/docs`.
4. Click **Save**. Your live dashboard will be accessible at:
   `https://<your-username>.github.io/<your-repo-name>/`

---

## 🛠️ Configuration & Workflow Customization

You can customize the schedule and behavior in [`.github/workflows/tracker.yml`](.github/workflows/tracker.yml):

- **Scan Frequency**: Default is every 1 hour (`cron: '0 * * * *'`). You can change this to every 30 minutes (`'*/30 * * * *'`).
- **Store-wide Scanning**:
  - By default, it tracks the target collection: `https://casiostore.bhawar.com/collections/watches`.
  - To track every single watch on the entire store across all collections, set `TRACK_ALL_STORE: true`.
- **Manual Trigger**:
  You can click **Run workflow** in the GitHub Actions tab anytime with customizable inputs:
  - `force_alert`: Forces alerts for all current deals immediately.
  - `min_discount`: Sets custom minimum discount threshold (e.g. `10` for 10%+).
  - `in_stock_only`: Toggle whether to only alert on items ready to ship.
  - `dry_run`: Test run without writing files or dispatching live notifications.

---

## 💻 Local Testing & Development

Run unit test suite (built-in Node test runner):
```bash
npm test
```

Run tracker in dry-run mode (safe local test without mutating files or sending alerts):
```bash
npm run test-scan
```

Run tracker locally:
```bash
npm start
```

Serve the web dashboard locally on port 3000:
```bash
npm run serve
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Repository Structure

```
├── .github/
│   └── workflows/
│       └── tracker.yml       # Scheduled GitHub Actions cron daemon with concurrency control
├── data/
│   ├── discounts.json        # Current sorted discounts dataset
│   └── history.json          # Historical prices, restocks & all-time low tracking
├── docs/                     # GitHub Pages live dashboard
│   ├── index.html            # CASIO.RADAR responsive catalog UI with budget & series filters
│   ├── app.js                # Instant search, budget filtering & progressive chunking
│   ├── data.json             # Live dataset synced by GitHub Action
│   └── DESIGN.md             # Archival design system tokens & specification
├── src/
│   ├── config.mjs            # Settings, threshold defaults & CLI flags
│   ├── fetcher.mjs           # Fast Shopify API pagination, retry logic & series classifier
│   ├── alerter.mjs           # Multi-channel notification engine (HTML sanitization & batching)
│   └── tracker.mjs           # Orchestrator (scan -> diff -> alert -> persist)
├── test/
│   └── tracker.test.mjs      # Comprehensive zero-dependency unit tests
├── .env.example              # Documented environment variables template
├── serve.mjs                 # Local static dashboard server
└── package.json
```

---

## ⚖️ License
MIT License. Open source and free to use.
