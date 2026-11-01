import { config } from './config.mjs';
import fs from 'fs';

export function formatInr(num) {
  return '₹' + Math.round(Number(num)).toLocaleString('en-IN');
}

/**
 * Escapes characters that break Telegram HTML parsing (<, >, &, ")
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates an archival styled caption for a single watch photo message
 */
export function formatTelegramCard(item) {
  const reasonLabel = {
    'NEW_DISCOUNT': '🔥 New Discount Listed',
    'RETURNED_TO_SALE': '⚡ Back on Sale',
    'PRICE_DROP': '📉 Further Price Drop',
    'RESTOCKED': '📦 Back in Stock',
    'FORCED_TEST': '🧪 Test Alert'
  }[item.alertReason] || '🔥 Discount Detected';

  const atlBadge = item.isAllTimeLow ? ' 🌟 <b>ALL-TIME LOW</b>' : '';
  const stockText = item.available ? '🟢 In Stock (Ready to Ship)' : '🔴 Out of Stock';
  const seriesUpper = (item.series || 'Casio').toUpperCase();
  const hashtagSeries = (item.series || 'Watch').replace(/\s+/g, '');

  return [
    `🔥 <b>${item.discountPercent}% OFF</b> | <b>CASIO ${seriesUpper}</b>${atlBadge}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⌚ <b>Model:</b> <code>${escapeHtml(item.title)}</code>`,
    `🏷 <b>SKU:</b> <code>${escapeHtml(item.sku)}</code> • <i>${escapeHtml(item.series || 'Casio')} Series</i>\n`,
    `💰 <b>Deal Price:</b> <b>${formatInr(item.price)}</b>  <s>${formatInr(item.originalPrice)}</s>`,
    `💵 <b>You Save:</b> <b>${formatInr(item.savings)}</b> (${item.discountPercent}% OFF)`,
    `📦 <b>Status:</b> ${stockText}`,
    `🔔 <b>Trigger:</b> ${reasonLabel}\n`,
    `#Casio #${hashtagSeries} #CasioRadar`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⏱ <i>casiostore.bhawar.com • CASIO.RADAR</i>`
  ].join('\n');
}

/**
 * Builds native inline keyboard buttons for Telegram
 */
export function getTelegramInlineKeyboard(item, dashboardUrl) {
  const buttons = [
    [{ text: `🛒 BUY NOW (${formatInr(item.price)}) ↗`, url: item.url }]
  ];
  if (dashboardUrl) {
    buttons.push([{ text: `🌐 OPEN CASIO.RADAR CATALOG ↗`, url: dashboardUrl }]);
  }
  return { inline_keyboard: buttons };
}

/**
 * Send an individual watch as a rich Photo message with inline buttons
 */
async function sendTelegramSinglePhoto(botToken, chatId, item, dashboardUrl) {
  const caption = formatTelegramCard(item);
  const replyMarkup = getTelegramInlineKeyboard(item, dashboardUrl);

  if (item.image) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: item.image,
          caption,
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });
      const data = await res.json();
      if (data.ok) {
        console.log(`[Alerter] ✅ Telegram photo alert delivered for ${item.title}! (Message ID: ${data.result?.message_id})`);
        return true;
      }
      console.warn(`[Alerter] Telegram sendPhoto returned error (${data.error_code}): ${data.description}. Falling back to text...`);
    } catch (err) {
      console.warn(`[Alerter] Telegram sendPhoto network error: ${err.message}. Falling back to text...`);
    }
  }

  // Fallback to text message with link previews disabled
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup
      })
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`[Alerter] ✅ Telegram text alert delivered for ${item.title}! (Message ID: ${data.result?.message_id})`);
      return true;
    }
    console.error(`[Alerter] ❌ Telegram sendMessage error (${data.error_code}): ${data.description}`);
  } catch (err) {
    console.error(`[Alerter] ❌ Telegram network error: ${err.message}`);
  }
  return false;
}

/**
 * Send alert to Telegram Bot (Smart Dispatch: Individual Photo Cards for 1-3 items, Photo + Digest for 4+)
 */
export async function sendTelegramAlert(items) {
  const { botToken, chatId } = config.telegram;
  const dashboardUrl = config.dashboardUrl;

  if (!botToken || !chatId) {
    console.log('[Alerter] Telegram: No credentials configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). Skipping.');
    return false;
  }

  if (config.dryRun) {
    console.log(`[Alerter] [DRY RUN] Would send formatted Telegram alert for ${items.length} watch(es) to chat ID: ${chatId.slice(0, 4)}****`);
    return true;
  }

  console.log(`[Alerter] Sending Telegram alert for ${items.length} watch(es) to chat ID: ${chatId.slice(0, 4)}****...`);

  // Case 1: 1 to 3 items -> Send individual photo cards with inline buttons
  if (items.length <= 3) {
    for (let i = 0; i < items.length; i++) {
      await sendTelegramSinglePhoto(botToken, chatId, items[i], dashboardUrl);
      if (i < items.length - 1) {
        await sleep(400);
      }
    }
    return true;
  }

  // Case 2: 4+ items -> Send Top Deal as Photo Card, then Batch Digest for remaining
  // Send Top Deal photo card first
  await sendTelegramSinglePhoto(botToken, chatId, items[0], dashboardUrl);
  await sleep(400);

  // Build remaining deals digest
  const remaining = items.slice(1);
  const lines = [
    `🚨 <b>CASIO DISCOUNT RADAR</b> (<b>+${remaining.length} More Deals Active</b>)`,
    `<i>Ranked by highest discount percentage:</i>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━\n`
  ];

  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i];
    const stockEmoji = item.available ? '🟢' : '🔴';
    const atlBadge = item.isAllTimeLow ? ' 🌟 <b>ALL-TIME LOW</b>' : '';
    lines.push(
      `<b>${i + 2}. 🔥 ${item.discountPercent}% OFF</b> • <b>${escapeHtml(item.title)}</b> (${escapeHtml(item.series || 'Casio')})${atlBadge}`,
      `   💰 <b>${formatInr(item.price)}</b>  <s>${formatInr(item.originalPrice)}</s> • Save <b>${formatInr(item.savings)}</b>`,
      `   📦 ${stockEmoji} ${item.available ? 'In Stock' : 'Out of Stock'} • <a href="${escapeHtml(item.url)}">Secure at Bhawar ↗</a>\n`
    );
  }

  lines.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `#CasioDeals #CasioRadar`,
    `⏱ <i>casiostore.bhawar.com • Tracked via GitHub Actions</i>`
  );

  // Chunk digest if it exceeds Telegram's 4096 char limit
  const chunks = [];
  let currentChunk = '';
  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > 3800) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + line : line;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  const digestKeyboard = {
    inline_keyboard: [
      [{ text: `🛒 TOP DEAL: ${items[0].title} (-${items[0].discountPercent}%) ↗`, url: items[0].url }],
      dashboardUrl ? [{ text: `🌐 VIEW ALL ${items.length} DEALS ON CASIO.RADAR ↗`, url: dashboardUrl }] : []
    ].filter((row) => row.length > 0)
  };

  for (let i = 0; i < chunks.length; i++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunks[i],
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          link_preview_options: { is_disabled: true },
          reply_markup: i === chunks.length - 1 ? digestKeyboard : undefined
        })
      });
      const data = await res.json();
      if (data.ok) {
        console.log(`[Alerter] ✅ Telegram digest part ${i + 1}/${chunks.length} delivered! (Message ID: ${data.result?.message_id})`);
      } else {
        console.error(`[Alerter] ❌ Telegram API error (${data.error_code}): ${data.description}`);
      }
      if (i < chunks.length - 1) {
        await sleep(350);
      }
    } catch (err) {
      console.error('[Alerter] ❌ Telegram network error:', err.message);
    }
  }

  return true;
}

/**
 * Send alert to Discord Webhook (Batched to Discord's 10-embed limit per message)
 */
export async function sendDiscordAlert(items) {
  const { webhookUrl } = config.discord;
  if (!webhookUrl) {
    console.log('[Alerter] Discord: No DISCORD_WEBHOOK_URL configured. Skipping.');
    return false;
  }

  if (config.dryRun) {
    console.log(`[Alerter] [DRY RUN] Would send Discord webhook alert for ${items.length} watch(es)`);
    return true;
  }

  console.log(`[Alerter] Sending Discord alert for ${items.length} watch(es)...`);

  // Discord allows up to 10 embeds per webhook message
  const maxEmbedsPerBatch = 10;
  const batches = [];
  for (let i = 0; i < items.length; i += maxEmbedsPerBatch) {
    batches.push(items.slice(i, i + maxEmbedsPerBatch));
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const currentBatch = batches[batchIdx];
    const embeds = currentBatch.map((item) => {
      let color = 0x00FF88;
      if (item.discountPercent >= 50) color = 0xFF2A55;
      else if (item.discountPercent >= 40) color = 0xFF7A00;
      else if (item.discountPercent >= 30) color = 0xFFD700;

      const titlePrefix = item.isAllTimeLow ? `[🌟 ALL-TIME LOW | -${item.discountPercent}%]` : `[-${item.discountPercent}%]`;

      return {
        title: `${titlePrefix} ${item.title}`,
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
          text: `casiostore.bhawar.com • Deal ${batchIdx * 10 + currentBatch.indexOf(item) + 1} of ${items.length}`
        },
        timestamp: new Date().toISOString()
      };
    });

    const header = batches.length > 1
      ? `🚨 **Casio Price Drop Alert! (Part ${batchIdx + 1} of ${batches.length})** Showing **${currentBatch.length}** of **${items.length}** watches:`
      : `🚨 **Casio Price Drop Alert!** Found **${items.length}** discounted watch(es) ordered by discount descending:`;

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: header,
          embeds
        })
      });
      if (res.ok) {
        console.log(`[Alerter] ✅ Discord batch ${batchIdx + 1}/${batches.length} delivered successfully!`);
      } else {
        const errText = await res.text();
        console.error(`[Alerter] ❌ Discord returned status ${res.status}: ${errText}`);
      }
    } catch (err) {
      console.error('[Alerter] ❌ Discord network error:', err.message);
    }

    if (batchIdx < batches.length - 1) {
      await sleep(650); // Respect Discord's 5 req/2s rate limit
    }
  }

  return true;
}

/**
 * Send alert to NTFY.sh (Free instant mobile/browser push notifications)
 */
export async function sendNtfyAlert(items) {
  const { topic, server } = config.ntfy;
  if (!topic) {
    console.log('[Alerter] NTFY: No NTFY_TOPIC configured. Skipping.');
    return false;
  }

  if (config.dryRun) {
    console.log(`[Alerter] [DRY RUN] Would send NTFY push alert for ${items.length} watch(es) to topic: ${topic}`);
    return true;
  }

  console.log(`[Alerter] Sending NTFY push notification to topic '${topic}'...`);

  const topDeal = items[0];
  const title = `🚨 Casio Sale: ${topDeal.discountPercent}% OFF on ${topDeal.title}${items.length > 1 ? ` & ${items.length - 1} more` : ''}`;
  const message = items
    .slice(0, 6)
    .map(
      (item) =>
        `• ${item.discountPercent}% OFF: ${item.title} at ${formatInr(item.price)} (Save ${formatInr(item.savings)}) ${item.available ? '🟢 In Stock' : '🔴 Out of Stock'}`
    )
    .join('\n');

  try {
    const res = await fetch(`${server.replace(/\/$/, '')}/${topic}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': 'high',
        'Tags': 'watch,shopping_bags,fire',
        'Click': topDeal.url,
        'Actions': `view, View Deal, ${topDeal.url}`
      },
      body: message
    });
    if (res.ok) {
      console.log(`[Alerter] ✅ NTFY push delivered to topic '${topic}'!`);
    } else {
      console.error(`[Alerter] ❌ NTFY returned status ${res.status}`);
    }
  } catch (err) {
    console.error('[Alerter] ❌ NTFY network error:', err.message);
  }

  return true;
}

/**
 * Write a GitHub Actions Step Summary markdown table
 */
export function writeGitHubStepSummary(allDiscounted, newAlertItems) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const fiftyPlus = allDiscounted.filter((w) => w.discountPercent >= 50).length;
  const fortyPlus = allDiscounted.filter((w) => w.discountPercent >= 40 && w.discountPercent < 50).length;
  const thirtyPlus = allDiscounted.filter((w) => w.discountPercent >= 30 && w.discountPercent < 40).length;
  const inStock = allDiscounted.filter((w) => w.available).length;

  const lines = [
    `# ⌚ Casio Watch Discount Tracker Report`,
    ``,
    `> **Tracked Site:** [Watches - casiostore.bhawar.com](${config.baseUrl}/collections/watches)  `,
    `> **Scan Completed:** \`${new Date().toUTCString()}\`  `,
    `> **Total Discounted Found:** \`${allDiscounted.length}\` (${inStock} In Stock) | **New Alerts:** \`${newAlertItems.length}\``,
    ``,
    `### 📊 Discount Tier Breakdown`,
    `| 🔥 50%+ OFF | ⚡ 40% - 49% OFF | ✨ 30% - 39% OFF | 🟢 In-Stock Deals |`,
    `|:---:|:---:|:---:|:---:|`,
    `| **${fiftyPlus}** | **${fortyPlus}** | **${thirtyPlus}** | **${inStock}** |`,
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
      const atlTag = item.isAllTimeLow ? '<br><sub>🌟 ALL-TIME LOW</sub>' : '';
      lines.push(
        `| ${img} | **${escapeHtml(item.title)}**<br><sub>SKU: ${escapeHtml(item.sku)}</sub>${atlTag} | **🔥 ${item.discountPercent}% OFF** | **${formatInr(item.price)}** | ~~${formatInr(item.originalPrice)}~~ | **${formatInr(item.savings)}** | ${stockBadge} | [Buy Now ↗](${item.url}) |`
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
      `| ${img} | **${escapeHtml(item.title)}** (${escapeHtml(item.series)}) | **${item.discountPercent}% OFF** | ${formatInr(item.price)} | ~~${formatInr(item.originalPrice)}~~ | ${stockBadge} | [View ↗](${item.url}) |`
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
