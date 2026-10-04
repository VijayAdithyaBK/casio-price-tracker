import { config } from './config.mjs';
import fs from 'fs';

function formatInr(num) {
  return '₹' + Number(num).toLocaleString('en-IN');
}

/**
 * Send alert to Telegram Bot
 */
async function sendTelegramAlert(items) {
  const { botToken, chatId } = config.telegram;
  if (!botToken || !chatId) return false;

  console.log(`[Alerter] Sending Telegram alert for ${items.length} watch(es)...`);

  const lines = [
    `<b>🚨 CASIO DISCOUNT ALERT (${items.length} Watch${items.length > 1 ? 'es' : ''})</b>`,
    `<i>Sorted by Discount Descending:</i>\n`
  ];

  for (const item of items) {
    const stockEmoji = item.available ? '🟢 In Stock' : '🔴 Out of Stock';
    lines.push(
      `🔥 <b>${item.discountPercent}% OFF</b> | <b>${item.title}</b>`,
      `🏷️ Price: <b>${formatInr(item.price)}</b> (M.R.P: <s>${formatInr(item.originalPrice)}</s>)`,
      `💰 You Save: <b>${formatInr(item.savings)}</b> | ${stockEmoji}`,
      `🔗 <a href="${item.url}">View & Buy on Casio Store</a>\n`
    );
  }

  lines.push(`⏱ <i>Tracked via GitHub Actions • casiostore.bhawar.com</i>`);

  const messageText = lines.join('\n');

  // Telegram limit is 4096 chars per message
  const chunks = [];
  if (messageText.length <= 4000) {
    chunks.push(messageText);
  } else {
    // Split into chunks if large
    let currentChunk = '';
    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > 3900) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    if (currentChunk) chunks.push(currentChunk);
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      });
      const data = await res.json();
      if (!data.ok) {
        console.error('[Alerter] Telegram error:', data.description);
      }
    } catch (err) {
      console.error('[Alerter] Telegram network error:', err.message);
    }
  }

  return true;
}

/**
 * Send alert to Discord Webhook
 */
async function sendDiscordAlert(items) {
  const { webhookUrl } = config.discord;
  if (!webhookUrl) return false;

  console.log(`[Alerter] Sending Discord alert for ${items.length} watch(es)...`);

  // Discord allows up to 10 embeds per webhook message
  const maxEmbeds = 10;
  const topItems = items.slice(0, maxEmbeds);

  const embeds = topItems.map((item) => {
    // Color code based on discount depth:
    // >= 50% => Red (0xFF0000)
    // >= 40% => Orange (0xFFA500)
    // >= 30% => Gold (0xFFD700)
    // else => Emerald (0x00FF88)
    let color = 0x00FF88;
    if (item.discountPercent >= 50) color = 0xFF2A55;
    else if (item.discountPercent >= 40) color = 0xFF7A00;
    else if (item.discountPercent >= 30) color = 0xFFD700;

    return {
      title: `[${item.discountPercent}% OFF] ${item.title}`,
      url: item.url,
      color,
      thumbnail: item.image ? { url: item.image } : undefined,
      fields: [
        { name: '💰 Current Price', value: formatInr(item.price), inline: true },
        { name: '🏷️ Original M.R.P', value: `~~${formatInr(item.originalPrice)}~~`, inline: true },
        { name: '💵 You Save', value: `${formatInr(item.savings)} (${item.discountPercent}%)`, inline: true },
        { name: '📦 Status', value: item.available ? '🟢 In Stock' : '🔴 Out of Stock', inline: true },
        { name: '⌚ Series', value: item.series || 'Casio', inline: true },
        { name: '🔖 SKU', value: item.sku || 'N/A', inline: true }
      ],
      footer: {
        text: 'casiostore.bhawar.com • GitHub Hosted Tracker'
      },
      timestamp: new Date().toISOString()
    };
  });

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚨 **Casio Price Drop Alert!** Found **${items.length}** discounted watch(es) ordered by discount descending:`,
        embeds
      })
    });
    if (!res.ok) {
      console.error(`[Alerter] Discord returned status ${res.status}`);
    }
  } catch (err) {
    console.error('[Alerter] Discord network error:', err.message);
  }

  return true;
}

/**
 * Send alert to NTFY.sh (Free instant mobile/browser push notifications)
 */
async function sendNtfyAlert(items) {
  const { topic, server } = config.ntfy;
  if (!topic) return false;

  console.log(`[Alerter] Sending NTFY push notification to topic '${topic}'...`);

  // Send top deal summary
  const topDeal = items[0];
  const title = `🚨 Casio Sale: ${topDeal.discountPercent}% OFF on ${topDeal.title}${items.length > 1 ? ` & ${items.length - 1} more` : ''}`;
  const message = items
    .slice(0, 5)
    .map(
      (item) =>
        `• ${item.discountPercent}% OFF: ${item.title} at ${formatInr(item.price)} (Save ${formatInr(item.savings)}) ${item.available ? '🟢 In Stock' : '🔴 Out of Stock'}`
    )
    .join('\n');

  try {
    await fetch(`${server.replace(/\/$/, '')}/${topic}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': 'high',
        'Tags': 'watch,shopping_bags,fire',
        'Click': topDeal.url
      },
      body: message
    });
  } catch (err) {
    console.error('[Alerter] NTFY network error:', err.message);
  }

  return true;
}

/**
 * Write a GitHub Actions Step Summary markdown table
 */
export function writeGitHubStepSummary(allDiscounted, newAlertItems) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const lines = [
    `# ⌚ Casio Watch Discount Tracker Report`,
    ``,
    `> **Tracked Site:** [Watches - casiostore.bhawar.com](${config.baseUrl}/collections/watches)  `,
    `> **Scan Completed:** \`${new Date().toUTCString()}\`  `,
    `> **Total Discounted Found:** \`${allDiscounted.length}\` | **New Alerts:** \`${newAlertItems.length}\``,
    ``
  ];

  if (newAlertItems.length > 0) {
    lines.push(`## 🚨 New Discount Alerts (Sorted Descending)`);
    lines.push(
      `| Image | Model / Title | Discount | Price | M.R.P | Savings | Stock | Link |`,
      `|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|`
    );
    for (const item of newAlertItems) {
      const img = item.image ? `<img src="${item.image}" width="60" height="60" style="object-fit:cover;border-radius:6px;"/>` : '⌚';
      const stockBadge = item.available ? '🟢 **In Stock**' : '🔴 Out of Stock';
      lines.push(
        `| ${img} | **${item.title}**<br><sub>SKU: ${item.sku}</sub> | **🔥 ${item.discountPercent}% OFF** | **${formatInr(item.price)}** | ~~${formatInr(item.originalPrice)}~~ | **${formatInr(item.savings)}** | ${stockBadge} | [Buy Now ↗](${item.url}) |`
      );
    }
    lines.push(``);
  }

  lines.push(`## 📋 All Current Discounts (Top 25 by Discount %)`);
  lines.push(
    `| Image | Model / Title | Discount | Price | M.R.P | Stock | Buy Link |`,
    `|:---:|:---|:---:|:---:|:---:|:---:|:---:|`
  );
  for (const item of allDiscounted.slice(0, 25)) {
    const img = item.image ? `<img src="${item.image}" width="50" height="50" style="object-fit:cover;border-radius:4px;"/>` : '⌚';
    const stockBadge = item.available ? '🟢 In Stock' : '🔴 Out of Stock';
    lines.push(
      `| ${img} | **${item.title}** (${item.series}) | **${item.discountPercent}% OFF** | ${formatInr(item.price)} | ~~${formatInr(item.originalPrice)}~~ | ${stockBadge} | [View ↗](${item.url}) |`
    );
  }

  try {
    fs.appendFileSync(summaryFile, lines.join('\n') + '\n', 'utf-8');
    console.log('[Alerter] Successfully appended GitHub Actions Step Summary');
  } catch (err) {
    console.error('[Alerter] Failed writing GITHUB_STEP_SUMMARY:', err.message);
  }
}

/**
 * Dispatch alerts across all configured channels
 */
export async function dispatchAlerts(newAlertItems, allDiscounted) {
  // Always write GitHub Actions step summary if available
  writeGitHubStepSummary(allDiscounted, newAlertItems);

  if (!newAlertItems || newAlertItems.length === 0) {
    console.log('[Alerter] No new discount alerts to dispatch.');
    return;
  }

  console.log(`[Alerter] Dispatching alerts for ${newAlertItems.length} watches (Highest discount: ${newAlertItems[0].discountPercent}%)...`);

  await Promise.allSettled([
    sendTelegramAlert(newAlertItems),
    sendDiscordAlert(newAlertItems),
    sendNtfyAlert(newAlertItems)
  ]);

  console.log('[Alerter] Dispatch complete.');
}
