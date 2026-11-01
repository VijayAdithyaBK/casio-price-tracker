import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSeries } from '../src/fetcher.mjs';
import { escapeHtml, formatInr, formatTelegramCard, getTelegramInlineKeyboard } from '../src/alerter.mjs';
import { detectAlerts } from '../src/tracker.mjs';

describe('Series Detection (detectSeries)', () => {
  it('identifies G-Shock models across prefixes and tags', () => {
    assert.equal(detectSeries('GA-2100-1A1DR'), 'G-Shock');
    assert.equal(detectSeries('DW-5600E-1VDF'), 'G-Shock');
    assert.equal(detectSeries('GM-2100-1ADR'), 'G-Shock');
    assert.equal(detectSeries('GBD-200-1DR'), 'G-Shock'); // G-Squad
    assert.equal(detectSeries('GW-M5610U-1ER'), 'G-Shock'); // Solar Atomic
    assert.equal(detectSeries('GBX-100-1DR'), 'G-Shock'); // G-Lide
    assert.equal(detectSeries('GST-B400D-1A'), 'G-Shock'); // G-Steel
    assert.equal(detectSeries('Custom Collab', ['G-SHOCK', 'Collab']), 'G-Shock');
  });

  it('identifies Baby-G without misclassifying as G-Shock', () => {
    assert.equal(detectSeries('BA-110X-7A1DR'), 'Baby-G');
    assert.equal(detectSeries('BGD-565-1DR'), 'Baby-G');
    assert.equal(detectSeries('Baby-G Summer Special'), 'Baby-G');
  });

  it('identifies Edifice models across standard and solar sapphire lines', () => {
    assert.equal(detectSeries('ECB-2000DC-1ADF'), 'Edifice');
    assert.equal(detectSeries('EFS-S570DB-2AUDF'), 'Edifice'); // Solar Sapphire
    assert.equal(detectSeries('EFV-100D-1AVUDF'), 'Edifice');
    assert.equal(detectSeries('EQB-1100D-1ADR'), 'Edifice');
    assert.equal(detectSeries('Chronograph Watch', ['EDIFICE']), 'Edifice');
  });

  it('identifies Vintage / Heritage models', () => {
    assert.equal(detectSeries('A168WA-1WDF'), 'Vintage');
    assert.equal(detectSeries('F-91W-1DG'), 'Vintage');
    assert.equal(detectSeries('A100WE-1ADF'), 'Vintage');
    assert.equal(detectSeries('B640WD-1AVDF'), 'Vintage');
    assert.equal(detectSeries('CA-53W-1Z'), 'Vintage');
    assert.equal(detectSeries('AQ-230A-7BMQ'), 'Vintage');
    assert.equal(detectSeries('A1000M-1BEF'), 'Vintage'); // Full Metal Vintage
  });

  it('identifies Sheen women luxury watches', () => {
    assert.equal(detectSeries('SHE-4543CGL-4AUDF'), 'Sheen');
    assert.equal(detectSeries('SHS-4528D-7AUDF'), 'Sheen');
    assert.equal(detectSeries('Diamond Bezel Watch', ['SHEEN']), 'Sheen');
  });

  it('identifies Youth and Casio Royale digital watches', () => {
    assert.equal(detectSeries('AE-1200WHD-1AVDF'), 'Youth'); // Casio Royale
    assert.equal(detectSeries('W-218H-1AVDF'), 'Youth');
    assert.equal(detectSeries('W-800H-1AVDF'), 'Youth');
    assert.equal(detectSeries('MRW-200H-1BV'), 'Youth');
  });

  it('identifies Pro Trek models', () => {
    assert.equal(detectSeries('PRG-340-1DR'), 'Pro Trek');
    assert.equal(detectSeries('PRT-B50-1DR'), 'Pro Trek');
    assert.equal(detectSeries('Altimeter Tough Watch', ['PROTREK']), 'Pro Trek');
  });

  it('identifies Enticer models', () => {
    assert.equal(detectSeries('MTP-1302D-2A2VDF'), 'Enticer');
    assert.equal(detectSeries('LTP-V007L-7E1'), 'Enticer');
  });

  it('falls back to Casio Classic when unrecognized', () => {
    assert.equal(detectSeries('Casio Wall Clock Cl-100'), 'Casio Classic');
  });
});

describe('HTML Sanitizer for Telegram (escapeHtml)', () => {
  it('escapes reserved HTML entities', () => {
    assert.equal(escapeHtml('Black & Gold Series'), 'Black &amp; Gold Series');
    assert.equal(escapeHtml('<GA-2100> "CasiOak"'), '&lt;GA-2100&gt; &quot;CasiOak&quot;');
  });

  it('handles empty or non-string inputs safely', () => {
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });
});

describe('Currency Formatter (formatInr)', () => {
  it('formats numbers into Indian Rupees currency string', () => {
    assert.equal(formatInr(2497.5), '₹2,498');
    assert.equal(formatInr(14995), '₹14,995');
    assert.equal(formatInr(995), '₹995');
  });
});

describe('Telegram Formatting & Buttons (formatTelegramCard & getTelegramInlineKeyboard)', () => {
  const watch = {
    title: 'LTP-V300L-7A2',
    series: 'Enticer',
    sku: 'A1780',
    price: 3036,
    originalPrice: 3795,
    savings: 759,
    discountPercent: 20,
    available: true,
    isAllTimeLow: true,
    alertReason: 'PRICE_DROP',
    url: 'https://casiostore.bhawar.com/products/test?variant=123'
  };

  it('formats structured caption with badges, specs and dividers', () => {
    const card = formatTelegramCard(watch);
    assert.ok(card.includes('20% OFF'));
    assert.ok(card.includes('CASIO ENTICER'));
    assert.ok(card.includes('ALL-TIME LOW'));
    assert.ok(card.includes('<code>LTP-V300L-7A2</code>'));
    assert.ok(card.includes('<b>₹3,036</b>'));
    assert.ok(card.includes('<s>₹3,795</s>'));
    assert.ok(card.includes('<b>You Save:</b> <b>₹759</b>'));
    assert.ok(card.includes('🟢 In Stock'));
    assert.ok(card.includes('#Casio #Enticer #CasioRadar'));
  });

  it('constructs native inline buttons with direct buy and dashboard links', () => {
    const keyboard = getTelegramInlineKeyboard(watch, 'https://test.dashboard');
    assert.equal(keyboard.inline_keyboard.length, 2);
    assert.equal(keyboard.inline_keyboard[0][0].text, '🛒 BUY NOW (₹3,036) ↗');
    assert.equal(keyboard.inline_keyboard[0][0].url, watch.url);
    assert.equal(keyboard.inline_keyboard[1][0].text, '🌐 OPEN CASIO.RADAR CATALOG ↗');
    assert.equal(keyboard.inline_keyboard[1][0].url, 'https://test.dashboard');
  });
});

describe('Delta & Change Detection (detectAlerts)', () => {
  const sampleWatch = {
    id: 'prod1_var1',
    productId: 1,
    variantId: 1,
    title: 'GA-2100-1A',
    series: 'G-Shock',
    price: 4995,
    originalPrice: 9995,
    savings: 5000,
    discountPercent: 50,
    available: true,
    url: 'https://casiostore.bhawar.com/products/ga-2100?variant=1'
  };

  it('alerts on NEW_DISCOUNT when watch is seen for the first time', () => {
    const { newAlerts, updatedHistory } = detectAlerts([sampleWatch], {});
    assert.equal(newAlerts.length, 1);
    assert.equal(newAlerts[0].alertReason, 'NEW_DISCOUNT');
    assert.equal(newAlerts[0].isAllTimeLow, true);
    assert.equal(updatedHistory['prod1_var1'].isDiscounted, true);
  });

  it('solves the re-discount bug: alerts on RETURNED_TO_SALE after sale ended', () => {
    // Previous run recorded watch as no longer discounted
    const previousItems = {
      'prod1_var1': {
        title: 'GA-2100-1A',
        price: 4995,
        originalPrice: 9995,
        discountPercent: 0,
        isDiscounted: false, // sale had ended previously
        lowestPriceEver: 4995
      }
    };

    const { newAlerts } = detectAlerts([sampleWatch], previousItems);
    assert.equal(newAlerts.length, 1);
    assert.equal(newAlerts[0].alertReason, 'RETURNED_TO_SALE');
  });

  it('alerts on PRICE_DROP when discounted watch drops further', () => {
    const previousItems = {
      'prod1_var1': {
        title: 'GA-2100-1A',
        price: 5995,
        originalPrice: 9995,
        discountPercent: 40,
        available: true,
        isDiscounted: true,
        lowestPriceEver: 5995
      }
    };

    const cheaperWatch = { ...sampleWatch, price: 4495, discountPercent: 55 };
    const { newAlerts } = detectAlerts([cheaperWatch], previousItems);
    assert.equal(newAlerts.length, 1);
    assert.equal(newAlerts[0].alertReason, 'PRICE_DROP');
    assert.equal(newAlerts[0].isAllTimeLow, true);
    assert.equal(newAlerts[0].previousPrice, 5995);
  });

  it('alerts on RESTOCKED when out-of-stock deal becomes available', () => {
    const previousItems = {
      'prod1_var1': {
        title: 'GA-2100-1A',
        price: 4995,
        originalPrice: 9995,
        discountPercent: 50,
        available: false, // was out of stock
        isDiscounted: true,
        lowestPriceEver: 4995
      }
    };

    const inStockWatch = { ...sampleWatch, available: true };
    const { newAlerts } = detectAlerts([inStockWatch], previousItems);
    assert.equal(newAlerts.length, 1);
    assert.equal(newAlerts[0].alertReason, 'RESTOCKED');
  });

  it('marks saleEnded when discounted watch leaves the discount pool', () => {
    const previousItems = {
      'prod1_var1': {
        title: 'GA-2100-1A',
        price: 4995,
        originalPrice: 9995,
        discountPercent: 50,
        isDiscounted: true
      }
    };

    // Current scan has zero discounted watches
    const { updatedHistory } = detectAlerts([], previousItems);
    assert.equal(updatedHistory['prod1_var1'].isDiscounted, false);
    assert.ok(updatedHistory['prod1_var1'].saleEndedAt);
  });

  it('filters out corrupt history entries where price <= 0', () => {
    const corruptedItems = {
      'bad_entry_1': { title: 'Corrupted Watch', price: 0, discountPercent: 100 },
      'bad_entry_2': { title: 'Negative Price', price: -50 }
    };

    const { updatedHistory } = detectAlerts([sampleWatch], corruptedItems);
    assert.equal(updatedHistory['bad_entry_1'], undefined);
    assert.equal(updatedHistory['bad_entry_2'], undefined);
    assert.ok(updatedHistory['prod1_var1']);
  });

  it('respects minimum discount threshold filter', () => {
    const lowDiscountWatch = { ...sampleWatch, discountPercent: 4 };
    const { newAlerts } = detectAlerts([lowDiscountWatch], {}, { alertMinDiscountPercent: 5 });
    assert.equal(newAlerts.length, 0);
  });
});

