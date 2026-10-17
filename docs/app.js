// Casio Radar Editorial Application Logic (Minimalist Mobile & Desktop Integration)
let allWatches = [];
let metadata = {};

const state = {
  search: '',
  series: 'all',
  inStockOnly: false,
  savedOnly: false,
  sortBy: 'discount_desc',
  viewMode: 'dual' // 2-card view default
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
  return '₹' + Math.round(Number(num)).toLocaleString('en-IN');
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

// Toast Feedback Helper
let toastTimer = null;
function showToast(msg, duration = 2400) {
  const toast = document.getElementById('radar-toast');
  const toastMsg = document.getElementById('radar-toast-msg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

async function loadData(showFeedback = false) {
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
    if (showFeedback) {
      showToast(`RADAR SYNCED • ${allWatches.length} ACTIVE DEALS`);
    }
    return true;
  } catch (err) {
    console.warn('Could not load data.json:', err);
    if (showFeedback) {
      showToast('OFFLINE CACHE LOADED');
    }
    return false;
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
  // Update ALL badge
  const pillAll = document.getElementById('pill-all-count');
  if (pillAll) {
    pillAll.textContent = `[${allWatches.length}]`;
  }

  // Update discount cuts for every series pill dynamically
  document.querySelectorAll('.series-pill[data-series]').forEach(pill => {
    const series = pill.dataset.series;
    if (series === 'all') return;

    const matching = allWatches.filter(w => {
      if (!w.series) return false;
      return w.series.toLowerCase() === series.toLowerCase();
    });

    const badge = pill.querySelector('.series-cut-badge');
    if (badge) {
      if (matching.length > 0) {
        const cuts = matching.map(w => w.discountPercent || 0).filter(c => c > 0);
        if (cuts.length > 0) {
          const maxCut = Math.max(...cuts);
          badge.textContent = `-${maxCut}%`;
          badge.className = 'series-cut-badge text-[8px] font-mono text-accent-red font-medium';
        } else {
          badge.textContent = `[${matching.length}]`;
          badge.className = 'series-cut-badge text-[8px] font-mono text-ink-muted group-hover:text-ink';
        }
      } else {
        badge.textContent = '--';
        badge.className = 'series-cut-badge text-[8px] font-mono text-ink-muted group-hover:text-ink';
      }
    }
  });
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
      if ((item.series || '').toLowerCase() !== state.series.toLowerCase()) return false;
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
      'Enticer': '06 / 07',
      'Casio Classic': '07 / 07'
    };
    seriesIndexLabel.textContent = activeIndexMap[state.series] || '01 / 07';
  }

  // Ensure matrix has proper view class
  if (container) {
    container.classList.remove('view-dual', 'view-single', 'view-editorial');
    if (state.viewMode === 'editorial') {
      container.classList.add('view-editorial');
    } else if (state.viewMode === 'single') {
      container.classList.add('view-single');
    } else {
      container.classList.add('view-dual');
    }
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
      <article class="border-r border-b border-border-hairline p-4 sm:p-7 flex flex-col justify-between group hover:bg-white transition-colors duration-200" data-watch-id="${item.id}">
        <!-- Top spec label & deal index -->
        <div class="flex items-center justify-between text-[9px] sm:text-[10px] font-mono tracking-widest text-ink-muted pb-2">
          <span class="truncate max-w-[120px] sm:max-w-none">PLATE ${padIndex} • ${seriesTitle}</span>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="text-accent-red font-bold tracking-normal border border-accent-red/30 px-1 py-0.5 bg-accent-red-faint text-[8px] sm:text-[9px]">
              -${item.discountPercent}% CUT
            </span>
            <button 
              class="bookmark-btn p-1 text-ink-muted hover:text-accent-red transition-colors" 
              title="Bookmark Watch" 
              data-id="${item.id}"
            >
              <span class="material-symbols-outlined text-[15px] sm:text-[16px]">
                ${isSaved ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>
          </div>
        </div>

        <!-- Archival Studio Isolation Plate -->
        <div class="img-plate py-4 sm:py-8 flex items-center justify-center min-h-[140px] sm:min-h-[190px] relative bg-surface-muted/30">
          <div class="absolute top-1.5 left-2 font-mono text-[7px] sm:text-[8px] text-ink-muted uppercase tracking-widest opacity-60">
            RAW SPEC // ${item.sku || 'CATALOG'}
          </div>
          <img 
            alt="${item.title}" 
            class="max-h-28 sm:max-h-44 max-w-full object-contain filter contrast-105 group-hover:scale-[1.04] transition-transform duration-300" 
            src="${imageSrc}"
            loading="lazy"
          />
          <div class="absolute bottom-1.5 right-2 font-mono text-[7px] sm:text-[8px] text-ink-muted tracking-widest uppercase">
            GAP: +${formatInr(item.savings)}
          </div>
        </div>

        <!-- Product Details, Pricing, Direct Link -->
        <div class="pt-3">
          <div class="flex items-baseline justify-between pt-2 border-t border-border-hairline text-ink">
            <h2 class="font-grotesk font-bold text-[12px] sm:text-[14px] uppercase tracking-[-0.01em] line-clamp-1">
              ${item.title}
            </h2>
            <div class="flex items-baseline gap-1.5 sm:gap-2 font-mono flex-shrink-0 ml-1.5">
              <span class="text-[10px] sm:text-[11px] line-through text-ink-muted">${formatInr(item.originalPrice)}</span>
              <span class="font-bold text-[13px] sm:text-[15px] text-ink">${formatInr(item.price)}</span>
            </div>
          </div>

          <div class="card-specs mt-2 flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-ink-muted uppercase">
            <span>ARBITRAGE: +${formatInr(item.savings)}</span>
            ${stockStatus}
          </div>

          <div class="mt-2.5 flex items-center gap-2">
            <a 
              class="card-btn flex-1 py-2 sm:py-2.5 hairline-all text-center block text-[9px] sm:text-[10px] font-mono tracking-[0.14em] uppercase hover:bg-ink hover:text-white transition-colors duration-150 font-semibold" 
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

// Refresh Feeds (Title Click & Pull-to-refresh)
let isRefreshingGlobal = false;
async function triggerFeedRefresh() {
  if (isRefreshingGlobal) return;
  isRefreshingGlobal = true;

  const radarIcons = document.querySelectorAll('header img[alt="Radar Icon"], nav img[alt="Radar"]');
  radarIcons.forEach(icon => icon.classList.add('animate-spin'));
  showToast('SYNCING BHAWAR RADAR FEEDS...');

  await loadData(true);

  radarIcons.forEach(icon => icon.classList.remove('animate-spin'));
  setTimeout(() => {
    isRefreshingGlobal = false;
  }, 400);
}

// Mobile Pull-to-refresh implementation
function setupPullToRefresh() {
  const ptr = document.getElementById('pull-to-refresh');
  const ptrIcon = document.getElementById('ptr-icon');
  const ptrLabel = document.getElementById('ptr-label');
  if (!ptr || !ptrIcon || !ptrLabel) return;

  let touchStartY = 0;
  let isPulling = false;
  const PTR_TRIGGER_DIST = 55;
  const MAX_PULL = 100;

  window.addEventListener('touchstart', (e) => {
    if (window.scrollY <= 1 && !isRefreshingGlobal && e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      isPulling = true;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isPulling || isRefreshingGlobal) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY;

    if (diff > 0 && window.scrollY <= 1) {
      const pullDistance = Math.min(MAX_PULL, diff * 0.42);
      ptr.style.transform = `translateY(${pullDistance}px)`;
      if (pullDistance >= PTR_TRIGGER_DIST) {
        ptrLabel.textContent = 'RELEASE TO REFRESH';
        ptrIcon.style.transform = 'rotate(180deg)';
      } else {
        ptrLabel.textContent = 'PULL DOWN TO REFRESH';
        ptrIcon.style.transform = `rotate(${pullDistance * 3}deg)`;
      }
    } else if (diff < 0) {
      isPulling = false;
      ptr.style.transform = 'translateY(-100%)';
    }
  }, { passive: true });

  window.addEventListener('touchend', async (e) => {
    if (!isPulling || isRefreshingGlobal) return;
    isPulling = false;
    const currentY = e.changedTouches[0].clientY;
    const diff = currentY - touchStartY;
    const pullDistance = Math.min(MAX_PULL, diff * 0.42);

    if (pullDistance >= PTR_TRIGGER_DIST && window.scrollY <= 2) {
      isRefreshingGlobal = true;
      ptr.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      ptr.style.transform = 'translateY(55px)';
      ptrLabel.textContent = 'SYNCING BHAWAR RADAR...';
      ptrIcon.classList.add('animate-spin');

      await loadData(false);

      ptrLabel.textContent = 'FEED UPDATED';
      ptrIcon.classList.remove('animate-spin');
      ptrIcon.style.transform = 'rotate(0deg)';
      showToast(`RADAR UPDATED: ${allWatches.length} LIVE DEALS`);

      setTimeout(() => {
        ptr.style.transform = 'translateY(-100%)';
        setTimeout(() => {
          ptr.style.transition = '';
          isRefreshingGlobal = false;
        }, 260);
      }, 500);
    } else {
      ptr.style.transition = 'transform 0.2s ease';
      ptr.style.transform = 'translateY(-100%)';
      setTimeout(() => {
        ptr.style.transition = '';
        ptrIcon.style.transform = 'rotate(0deg)';
      }, 200);
    }
  }, { passive: true });
}

function setupEvents() {
  // Mobile Pull-to-refresh
  setupPullToRefresh();

  // Click on Title to Refresh (Header Brand & Hero Title)
  const headerBrand = document.getElementById('header-brand');
  if (headerBrand) {
    headerBrand.addEventListener('click', (e) => {
      e.preventDefault();
      triggerFeedRefresh();
    });
  }

  const heroTitle = document.getElementById('catalog-hero-title');
  if (heroTitle) {
    heroTitle.addEventListener('click', () => {
      triggerFeedRefresh();
    });
  }

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
          p.querySelector('.series-label')?.classList.remove('font-bold', 'text-ink');
          p.querySelector('.series-label')?.classList.add('text-ink-muted');
        });

        btn.classList.add('border-ink', 'shadow-sm');
        btn.classList.remove('border-border-hairline');
        btn.querySelector('.series-label')?.classList.add('font-bold', 'text-ink');
        btn.querySelector('.series-label')?.classList.remove('text-ink-muted');

        state.series = btn.dataset.series;
        renderGrid();
      }
    });
  }

  // Sort buttons
  const sortButtons = document.querySelectorAll('.sort-btn');
  sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sortButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      state.sortBy = btn.dataset.sort;
      renderGrid();
    });
  });

  // Stock Filter Toggle (Clean Scoped .is-active Class)
  const stockToggleBtn = document.getElementById('toggle-stock-filter');
  const stockDot = document.getElementById('stock-indicator-dot');
  if (stockToggleBtn) {
    stockToggleBtn.addEventListener('click', () => {
      state.inStockOnly = !state.inStockOnly;
      stockToggleBtn.classList.toggle('is-active', state.inStockOnly);
      if (stockDot) {
        stockDot.className = state.inStockOnly
          ? 'w-1.5 h-1.5 rounded-full bg-accent-green'
          : 'w-1.5 h-1.5 rounded-full bg-ink-muted';
      }
      renderGrid();
    });
  }

  // Saved / Bookmark Filter Toggle (Clean Scoped .is-active Class)
  const bookmarkToggleBtn = document.getElementById('toggle-bookmark-filter');
  if (bookmarkToggleBtn) {
    bookmarkToggleBtn.addEventListener('click', () => {
      state.savedOnly = !state.savedOnly;
      bookmarkToggleBtn.classList.toggle('is-active', state.savedOnly);
      renderGrid();
    });
  }

  // Layout View Switcher: Icon-Only (Single, Dual Default, Editorial Adaptive)
  const viewToggle = document.getElementById('layout-view-toggle');
  const matrix = document.getElementById('catalog-product-matrix');
  if (viewToggle && matrix) {
    const buttons = viewToggle.querySelectorAll('button[data-layout-mode]');
    buttons.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const mode = this.dataset.layoutMode;
        buttons.forEach(b => b.classList.remove('is-active'));
        this.classList.add('is-active');

        state.viewMode = mode;
        matrix.classList.remove('view-dual', 'view-single', 'view-editorial');
        if (mode === 'editorial') {
          matrix.classList.add('view-editorial');
        } else if (mode === 'single') {
          matrix.classList.add('view-single');
        } else {
          matrix.classList.add('view-dual');
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
      sortButtons.forEach(b => {
        b.classList.toggle('is-active', b.dataset.sort === 'discount_desc');
      });
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
      if (stockToggleBtn) stockToggleBtn.classList.remove('is-active');
      if (stockDot) stockDot.className = 'w-1.5 h-1.5 rounded-full bg-ink-muted';
      if (bookmarkToggleBtn) bookmarkToggleBtn.classList.remove('is-active');

      sortButtons.forEach(b => {
        b.classList.toggle('is-active', b.dataset.sort === 'discount_desc');
      });

      if (pillBar) {
        pillBar.querySelectorAll('.series-pill').forEach(p => {
          const isAll = p.dataset.series === 'all';
          p.classList.toggle('border-ink', isAll);
          p.classList.toggle('shadow-sm', isAll);
          p.classList.toggle('border-border-hairline', !isAll);
          p.querySelector('.series-label')?.classList.toggle('font-bold', isAll);
          p.querySelector('.series-label')?.classList.toggle('text-ink', isAll);
          p.querySelector('.series-label')?.classList.toggle('text-ink-muted', !isAll);
        });
      }

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

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('CASIO.RADAR PWA registered:', reg.scope))
      .catch((err) => console.warn('CASIO.RADAR PWA registration error:', err));
  });
}
