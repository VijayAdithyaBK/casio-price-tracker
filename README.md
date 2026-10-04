# ⌚ Casio Watch Discount Tracker & Alert System

A lightweight, high-efficiency, GitHub-hosted discount scanner and price drop notifier for **[Watches - casiostore.bhawar.com](https://casiostore.bhawar.com/collections/watches)** (Official Casio India Distributor — Bhawar).

Discounts are automatically sorted in **descending order** (e.g. 50% OFF, 40% OFF, 30% OFF) and dispatched across your choice of free notification channels (Telegram, Discord, NTFY mobile push, or GitHub summaries).

---

## ⚡ Key Highlights

- **Ultra-Efficient Architecture**: Bypasses heavy, brittle headless browsers (Puppeteer/Playwright) and directly leverages Shopify's high-speed paginated backend (`/collections/watches/products.json?limit=250`). A full collection scan completes in **under 2 seconds** with 0 risk of IP blocks.
- **Strict Discount Descending Order**: The biggest savings (50% OFF, 40% OFF, etc.) are always prioritized at the top of every alert and table.
- **Smart Delta & Anti-Spam Tracking**: Stores state history in `data/history.json`. It only alerts when:
  1. A **new watch** gets discounted.
  2. A discounted watch experiences a **further price drop**.
  3. A heavily discounted watch is **restocked** in inventory.
- **Multi-Channel Notification Dispatcher**:
  - **Telegram Bot**: Formatted push notification with thumbnail, discount %, INR savings, and 1-click buy link.
  - **Discord Webhook**: Color-coded rich embeds (Red for 50%+, Orange for 40%+, Gold for 30%+).
  - **NTFY.sh**: Free instant mobile push notification on Android/iOS with **zero sign-up**.
  - **GitHub Step Summary**: Rich markdown table with watch images and prices built directly into your GitHub Actions runs.
- **Live GitHub Pages Web Dashboard**: Modern, luxury dark-mode web application in `docs/` with live search, series filters (G-Shock, Edifice, Vintage, Pro Trek, Enticer), stock toggles, and direct store links.

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
Go to **Settings** > **Secrets and variables** > **Actions** and add any of the following repository secrets:

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

---

## 💻 Local Testing & Development

Run tracker locally:
```bash
npm start
```

Run store-wide scan locally:
```bash
TRACK_ALL_STORE=true node src/tracker.mjs
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
│       └── tracker.yml       # Scheduled GitHub Actions cron daemon
├── data/
│   ├── discounts.json        # Current sorted discounts dataset
│   └── history.json          # Historical prices & restock tracker state
├── docs/                     # GitHub Pages live dashboard
│   ├── index.html            # Responsive UI with filters & stats
│   ├── style.css             # Obsidian dark-mode styling
│   ├── app.js                # Instant client-side search & filtering
│   └── data.json             # Live dataset synced by GitHub Action
├── src/
│   ├── config.mjs            # Settings and threshold defaults
│   ├── fetcher.mjs           # Fast Shopify API pagination & discount extractor
│   ├── alerter.mjs           # Multi-channel notification engine
│   └── tracker.mjs           # Orchestrator (scan -> diff -> alert -> persist)
└── package.json
```

---

## ⚖️ License
MIT License. Open source and free to use.
