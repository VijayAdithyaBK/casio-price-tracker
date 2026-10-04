// Casio Radar Editorial Application Logic (Stitch Minimalist Mobile & Desktop Integration)
let allWatches = [];
let metadata = {};

const state = {
  search: '',
  series: 'all',
  inStockOnly: false,
  savedOnly: false,
  sortBy: 'discount_desc',
  viewMode: 'editorial'
};

// Bookmarks in LocalStorage
function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem('casio_bookmarks') || '[]');
  } catch (e) {
    return [];
  }
}

function toggleBookmark(id) {
  const bookmarks = getBookmarks();
  const index = bookmarks.indexOf(id);
  if (index >= 0) {
    bookmarks.splice(index, 1);
  } else {
    bookmarks.push(id);
  }
  localStorage.setItem('casio_bookmarks', JSON.stringify(bookmarks));
  updateSavedFilterCount();
}

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
    updateSavedFilterCount();
    renderGrid();
  } catch (err) {
    console.warn('Could not load data.json:', err);
  }
}

function updateTelemetry() {
  const telemetryTime = document.getElementById('telemetry-time');
  const telemetryDeals = document.getElementById('telemetry-deals');

  if (telemetryTime && metadata.updatedAt) {
    telemetryTime.textContent = `API: BHAWAR ${timeAgo(metadata.updatedAt)}`;
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

function updateSavedFilterCount() {
  const savedCount = getBookmarks().length;
  const countSpan = document.getElementById('bookmark-filter-text');
  if (countSpan) {
    countSpan.textContent = savedCount > 0 ? `SAVED [${savedCount}]` : 'SAVED';
  }
}

function getFilteredWatches() {
  const bookmarks = getBookmarks();

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

    // Saved only
    if (state.savedOnly && !bookmarks.includes(item.id)) {
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
  const bookmarks = getBookmarks();

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
    const isSaved = bookmarks.includes(item.id);
    const stockStatus = item.available 
      ? '<span class="text-accent-green font-semibold">🟢 IN STOCK</span>'
      : '<span class="text-ink-muted">🔴 OUT OF STOCK</span>';

    return `
      <article class="border-r border-b border-border-hairline p-6 sm:p-8 flex flex-col justify-between group hover:bg-white transition-colors duration-200" data-watch-id="${item.id}">
        <!-- Top spec label & deal index -->
        <div class="flex items-center justify-between text-[10px] font-mono tracking-widest text-ink-muted pb-2">
          <span>PLATE ${padIndex} • ${seriesTitle}</span>
          <div class="flex items-center gap-1.5">
            <span class="text-accent-red font-bold tracking-normal border border-accent-red/30 px-1.5 py-0.5 bg-accent-red-faint text-[9px]">
              -${item.discountPercent}% CUT
            </span>
            <button 
              class="bookmark-btn p-1 text-ink-muted hover:text-ink transition-colors" 
              title="Bookmark Watch" 
              data-id="${item.id}"
            >
              <span class="material-symbols-outlined text-[16px]">
                ${isSaved ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>
          </div>
        </div>

        <!-- Archival Studio Isolation Plate -->
        <div class="img-plate py-8 sm:py-12 flex items-center justify-center min-h-[200px] relative bg-surface-muted/30">
          <div class="absolute top-2 left-2 font-mono text-[8px] text-ink-muted uppercase tracking-widest opacity-60">
            RAW SPEC // ${item.sku || 'CATALOG'}
          </div>
          <img 
            alt="${item.title}" 
            class="max-h-48 max-w-full object-contain filter contrast-105 group-hover:scale-[1.04] transition-transform duration-300" 
            src="${imageSrc}"
            loading="lazy"
          />
          <div class="absolute bottom-2 right-2 font-mono text-[8px] text-ink-muted tracking-widest uppercase">
            GAP: +${formatInr(item.savings)}
          </div>
        </div>

        <!-- Product Details, Pricing, Direct Link -->
        <div class="pt-4">
          <div class="flex items-baseline justify-between pt-2 border-t border-border-hairline text-ink">
            <h2 class="font-grotesk font-bold text-[14px] uppercase tracking-[-0.01em] line-clamp-1">
              ${item.title}
            </h2>
            <div class="flex items-baseline gap-2 font-mono flex-shrink-0 ml-2">
              <span class="text-[11px] line-through text-ink-muted">${formatInr(item.originalPrice)}</span>
              <span class="font-bold text-[15px] sm:text-[16px] text-ink">${formatInr(item.price)}</span>
            </div>
          </div>

          <div class="card-specs mt-2.5 flex items-center justify-between text-[10px] font-mono text-ink-muted uppercase">
            <span>ARBITRAGE: +${formatInr(item.savings)} GAP</span>
            ${stockStatus}
          </div>

          <div class="mt-3 flex items-center gap-2">
            <a 
              class="card-btn flex-1 py-2.5 hairline-all text-center block text-[10px] font-mono tracking-[0.16em] uppercase hover:bg-ink hover:text-white transition-colors duration-150 font-semibold" 
              href="${item.url}" 
              rel="noopener noreferrer" 
              target="_blank"
            >
              SECURE AT BHAWAR ↗
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach bookmark toggle listeners
  container.querySelectorAll('.bookmark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      toggleBookmark(id);
      renderGrid();
    });
  });
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

  // Saved / Bookmark Filter Toggle
  const bookmarkToggleBtn = document.getElementById('toggle-bookmark-filter');
  if (bookmarkToggleBtn) {
    bookmarkToggleBtn.addEventListener('click', () => {
      state.savedOnly = !state.savedOnly;
      if (state.savedOnly) {
        bookmarkToggleBtn.classList.add('bg-ink', 'text-white', 'border-ink');
        bookmarkToggleBtn.classList.remove('bg-white', 'text-ink-muted', 'border-border-hairline');
      } else {
        bookmarkToggleBtn.classList.remove('bg-ink', 'text-white', 'border-ink');
        bookmarkToggleBtn.classList.add('bg-white', 'text-ink-muted', 'border-border-hairline');
      }
      renderGrid();
    });
  }

  // Layout View Switcher (EDITORIAL / 1 CARD / 2 CARD)
  const viewToggle = document.getElementById('layout-view-toggle');
  const matrix = document.getElementById('catalog-product-matrix');
  if (viewToggle && matrix) {
    const buttons = viewToggle.querySelectorAll('button[data-layout-mode]');
    buttons.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const mode = this.dataset.layoutMode;
        buttons.forEach(b => {
          b.classList.remove('bg-ink', 'text-white', 'font-semibold');
          b.classList.add('bg-transparent', 'text-ink-muted');
        });
        this.classList.remove('bg-transparent', 'text-ink-muted');
        this.classList.add('bg-ink', 'text-white', 'font-semibold');

        matrix.classList.remove('view-dual', 'view-single', 'view-editorial');
        if (mode === 'dual') {
          matrix.classList.add('view-dual');
        } else if (mode === 'single') {
          matrix.classList.add('view-single');
        } else {
          matrix.classList.add('view-editorial');
        }
      });
    });
  }

  // Mobile Bottom Navigation Buttons
  const navRadar = document.getElementById('nav-btn-radar');
  const navSeries = document.getElementById('nav-btn-series');
  const navDrops = document.getElementById('nav-btn-drops');
  const navAlerts = document.getElementById('nav-btn-alerts');

  if (navRadar) {
    navRadar.addEventListener('click', () => {
      state.search = '';
      state.series = 'all';
      state.inStockOnly = false;
      state.savedOnly = false;
      renderGrid();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (navSeries) {
    navSeries.addEventListener('click', () => {
      document.getElementById('series')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (navDrops) {
    navDrops.addEventListener('click', () => {
      state.sortBy = 'discount_desc';
      renderGrid();
      document.getElementById('catalog-product-matrix')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (navAlerts) {
    navAlerts.addEventListener('click', () => {
      document.getElementById('alert-modal')?.classList.remove('hidden');
    });
  }

  // Reset filters
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.search = '';
      state.series = 'all';
      state.inStockOnly = false;
      state.savedOnly = false;
      state.sortBy = 'discount_desc';

      if (searchInput) searchInput.value = '';
      renderGrid();
    });
  }

  // Modal
  const modal = document.getElementById('alert-modal');
  const openBtn = document.getElementById('btn-open-alert-modal');
  const openBtn2 = document.getElementById('btn-open-alert-modal-2');
  const footerAlertsBtn = document.getElementById('footer-alerts-btn');
  const closeBtn = document.getElementById('btn-close-modal');
  const closeFooterBtn = document.getElementById('btn-close-modal-footer');

  const openModal = () => modal?.classList.remove('hidden');
  const closeModal = () => modal?.classList.add('hidden');

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (openBtn2) openBtn2.addEventListener('click', openModal);
  if (footerAlertsBtn) footerAlertsBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadData();
});
