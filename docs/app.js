// Casio Radar Editorial Application Logic (Stitch Design Integration)
let allWatches = [];
let metadata = {};

const state = {
  search: '',
  series: 'all',
  inStockOnly: false,
  sortBy: 'discount_desc'
};

function formatInr(num) {
  return '₹' + Number(num).toLocaleString('en-IN');
}

function timeAgo(dateString) {
  if (!dateString) return '12s AGO';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'JUST NOW';
  if (diffMins < 60) return `${diffMins}m AGO`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h AGO`;
  return `${Math.floor(diffHours / 24)}d AGO`;
}

async function loadData() {
  try {
    const res = await fetch('data.json?v=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allWatches = data.items || [];
    metadata = data;
    updateTelemetry();
    renderSeriesCounts();
    renderGrid();
  } catch (err) {
    console.warn('Could not load data.json:', err);
  }
}

function updateTelemetry() {
  const telemetryTime = document.getElementById('telemetry-time');
  const telemetryScanned = document.getElementById('telemetry-scanned');
  const telemetryDeals = document.getElementById('telemetry-deals');

  if (telemetryTime && metadata.updatedAt) {
    telemetryTime.textContent = `API: BHAWAR ${timeAgo(metadata.updatedAt)}`;
  }
  if (telemetryScanned && metadata.stats) {
    telemetryScanned.textContent = `${metadata.stats.totalScanned || '1,361'} SKUS SCANNED`;
  }
  if (telemetryDeals) {
    telemetryDeals.textContent = `${allWatches.length} DEALS ACTIVE`;
  }
}

function renderSeriesCounts() {
  const pillAll = document.getElementById('pill-all-count');
  if (pillAll) {
    pillAll.textContent = `[${allWatches.length}]`;
  }

  const edfCount = allWatches.filter(w => w.series === 'Edifice').length;
  const pillEdf = document.getElementById('pill-edf-cut');
  if (pillEdf && edfCount > 0) {
    const maxEdfCut = Math.max(...allWatches.filter(w => w.series === 'Edifice').map(w => w.discountPercent));
    pillEdf.textContent = `-${maxEdfCut}%`;
  }
}

function getFilteredWatches() {
  let list = allWatches.filter(item => {
    // Search
    if (state.search) {
      const q = state.search.toLowerCase();
      const matchTitle = item.title && item.title.toLowerCase().includes(q);
      const matchSku = item.sku && item.sku.toLowerCase().includes(q);
      const matchSeries = item.series && item.series.toLowerCase().includes(q);
      if (!matchTitle && !matchSku && !matchSeries) return false;
    }

    // Series
    if (state.series !== 'all') {
      if (item.series !== state.series) return false;
    }

    // In Stock
    if (state.inStockOnly && !item.available) {
      return false;
    }

    return true;
  });

  // Sort
  list.sort((a, b) => {
    switch (state.sortBy) {
      case 'discount_desc':
        return b.discountPercent - a.discountPercent || b.savings - a.savings;
      case 'savings_desc':
        return b.savings - a.savings || b.discountPercent - a.discountPercent;
      case 'price_asc':
        return a.price - b.price;
      case 'price_desc':
        return b.price - a.price;
      default:
        return b.discountPercent - a.discountPercent;
    }
  });

  return list;
}

function renderGrid() {
  const container = document.getElementById('catalog-product-matrix');
  const emptyState = document.getElementById('empty-state');
  const seriesIndexLabel = document.getElementById('series-index-label');

  const filtered = getFilteredWatches();

  if (seriesIndexLabel) {
    const activeIndexMap = {
      'all': '01 / 07',
      'Edifice': '02 / 07',
      'G-Shock': '03 / 07',
      'Vintage': '04 / 07',
      'Pro Trek': '05 / 07',
      'Enticer': '06 / 07'
    };
    seriesIndexLabel.textContent = activeIndexMap[state.series] || '01 / 07';
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  container.innerHTML = filtered.map((item, index) => {
    const padIndex = String(index + 1).padStart(2, '0');
    const imageSrc = item.image || 'https://cdn.shopify.com/s/files/1/0910/0073/3977/files/GA-2100RL-1A.png?v=1751277644';
    const seriesTitle = (item.series || 'CASIO').toUpperCase();
    const stockStatus = item.available 
      ? '<span class="text-accent-green font-semibold">🟢 IN STOCK</span>'
      : '<span class="text-ink-muted">🔴 OUT OF STOCK</span>';

    return `
      <article class="border-r border-b border-border-hairline p-8 sm:p-10 flex flex-col justify-between group hover:bg-white transition-colors duration-200">
        <!-- Top spec label & deal index -->
        <div class="flex items-center justify-between text-[10px] font-mono tracking-widest text-ink-muted">
          <span>${padIndex} / ${seriesTitle}</span>
          <span class="text-accent-red font-bold tracking-normal border border-accent-red/30 px-1.5 py-0.5 bg-accent-red-faint">-${item.discountPercent}% CUT</span>
        </div>

        <!-- High-res product studio presentation -->
        <div class="py-10 sm:py-14 flex items-center justify-center min-h-[220px]">
          <img 
            alt="${item.title}" 
            class="max-h-52 max-w-full object-contain filter contrast-105 group-hover:scale-[1.04] transition-transform duration-300" 
            src="${imageSrc}"
            loading="lazy"
          />
        </div>

        <!-- Product Details, Pricing, Direct Link -->
        <div>
          <div class="flex items-baseline justify-between pt-4 border-t border-border-hairline text-ink">
            <h2 class="font-grotesk font-bold text-[14px] uppercase tracking-[-0.01em]">
              ${item.title}
            </h2>
            <div class="flex items-baseline gap-2 font-mono">
              <span class="text-[11px] line-through text-ink-muted">${formatInr(item.originalPrice)}</span>
              <span class="font-bold text-[16px] text-ink">${formatInr(item.price)}</span>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between text-[10px] font-mono text-ink-muted uppercase">
            <span>SKU: ${item.sku || 'N/A'} • SAVE ${formatInr(item.savings)}</span>
            ${stockStatus}
          </div>

          <a 
            class="mt-4 w-full py-2.5 hairline-all text-center block text-[10px] font-mono tracking-[0.16em] uppercase hover:bg-ink hover:text-white transition-colors duration-150 font-semibold" 
            href="${item.url}" 
            rel="noopener noreferrer" 
            target="_blank"
          >
            SECURE AT BHAWAR ↗
          </a>
        </div>
      </article>
    `;
  }).join('');
}

function setupEvents() {
  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      renderGrid();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  // Series Pills
  const pillBar = document.getElementById('series-pill-bar');
  if (pillBar) {
    pillBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.series-pill');
      if (btn) {
        pillBar.querySelectorAll('.series-pill').forEach(p => {
          p.classList.remove('border-ink', 'shadow-sm');
          p.classList.add('border-border-hairline');
          p.querySelector('span:first-child')?.classList.remove('font-bold', 'text-ink');
          p.querySelector('span:first-child')?.classList.add('text-ink-muted');
        });

        btn.classList.add('border-ink', 'shadow-sm');
        btn.classList.remove('border-border-hairline');
        btn.querySelector('span:first-child')?.classList.add('font-bold', 'text-ink');
        btn.querySelector('span:first-child')?.classList.remove('text-ink-muted');

        state.series = btn.dataset.series;
        renderGrid();
      }
    });
  }

  // Sort buttons
  const sortButtons = document.querySelectorAll('.sort-btn');
  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sortButtons.forEach(b => {
        b.classList.remove('text-ink', 'font-bold', 'border-b', 'border-ink');
        b.classList.add('text-ink-muted');
      });
      btn.classList.add('text-ink', 'font-bold', 'border-b', 'border-ink');
      btn.classList.remove('text-ink-muted');

      state.sortBy = btn.dataset.sort;
      renderGrid();
    });
  });

  // Stock Filter Toggle
  const stockToggleBtn = document.getElementById('toggle-stock-filter');
  const stockDot = document.getElementById('stock-indicator-dot');
  if (stockToggleBtn) {
    stockToggleBtn.addEventListener('click', () => {
      state.inStockOnly = !state.inStockOnly;
      if (state.inStockOnly) {
        stockToggleBtn.classList.add('bg-ink', 'text-white', 'border-ink');
        stockToggleBtn.classList.remove('bg-white', 'text-ink-muted', 'border-border-hairline');
        stockDot.classList.remove('bg-ink-muted');
        stockDot.classList.add('bg-accent-green');
      } else {
        stockToggleBtn.classList.remove('bg-ink', 'text-white', 'border-ink');
        stockToggleBtn.classList.add('bg-white', 'text-ink-muted', 'border-border-hairline');
        stockDot.classList.add('bg-ink-muted');
        stockDot.classList.remove('bg-accent-green');
      }
      renderGrid();
    });
  }

  // Reset filters
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.search = '';
      state.series = 'all';
      state.inStockOnly = false;
      state.sortBy = 'discount_desc';

      if (searchInput) searchInput.value = '';
      if (stockToggleBtn) {
        stockToggleBtn.classList.remove('bg-ink', 'text-white', 'border-ink');
        stockToggleBtn.classList.add('bg-white', 'text-ink-muted', 'border-border-hairline');
        stockDot.classList.add('bg-ink-muted');
        stockDot.classList.remove('bg-accent-green');
      }

      renderGrid();
    });
  }

  // Modal
  const modal = document.getElementById('alert-modal');
  const openBtn = document.getElementById('btn-open-alert-modal');
  const closeBtn = document.getElementById('btn-close-modal');
  const closeFooterBtn = document.getElementById('btn-close-modal-footer');

  if (modal && openBtn) {
    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadData();
});
