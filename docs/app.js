// Casio Radar Editorial Application Logic (Minimalist Mobile & Desktop Integration)
let allWatches = [];
let metadata = {};

const state = {
  search: '',
  series: 'all',
  budget: 'all', // 'all' | 'under_2500' | '2500_5000' | '5000_10000' | 'above_10000'
  minDiscount: 0, // 0 | 30 | 40 | 50
  allTimeLowOnly: false,
  inStockOnly: false,
  savedOnly: false,
  sortBy: 'discount_desc',
  viewMode: 'editorial', // editorial view default (screen-adaptive)
  visibleCount: 24,
  pageSize: 24
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
    showToast('REMOVED FROM SAVED');
  } else {
    bookmarks.push(id);
    showToast('SAVED TO WATCHLIST');
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

// Share Deal Helper
async function shareDeal(item) {
  const shareData = {
    title: `Casio Deal: ${item.discountPercent}% OFF on ${item.title}`,
    text: `🔥 Grab ${item.title} for ${formatInr(item.price)} (M.R.P: ${formatInr(item.originalPrice)}) on Casio India!`,
    url: item.url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
      }
    }
  }

  // Fallback: Copy link to clipboard
  try {
    await navigator.clipboard.writeText(item.url);
    showToast('COPIED DIRECT LINK TO CLIPBOARD');
  } catch (err) {
    showToast('LINK: ' + item.url.slice(0, 30) + '...');
  }
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
  // Live Telemetry Stats Runner in Hero Section
  const statScanned = document.getElementById('stat-scanned');
  const statDeals = document.getElementById('stat-deals');
  const statMaxCut = document.getElementById('stat-max-cut');
  const statInStock = document.getElementById('stat-in-stock');
  const statAvgSavings = document.getElementById('stat-avg-savings');

  const totalScanned = metadata.totalWatchesScanned || (allWatches.length > 0 ? Math.max(538, allWatches.length) : 538);
  const activeDeals = allWatches.length;
  const cuts = allWatches.map((w) => w.discountPercent || 0).filter((c) => c > 0);
  const maxCut = cuts.length > 0 ? Math.max(...cuts) : 50;
  const inStock = allWatches.filter((w) => w.available).length;
  const totalSavings = allWatches.reduce((acc, w) => acc + (w.savings || 0), 0);
  const avgSavings = activeDeals > 0 ? Math.round(totalSavings / activeDeals) : 0;

  if (statScanned) statScanned.textContent = Number(totalScanned).toLocaleString('en-IN');
  if (statDeals) statDeals.textContent = String(activeDeals);
  if (statMaxCut) statMaxCut.textContent = `-${maxCut}%`;
  if (statInStock) statInStock.textContent = String(inStock);
  if (statAvgSavings) statAvgSavings.textContent = formatInr(avgSavings);
}

function updateSavedFilterCount() {
  const savedCount = getBookmarks().length;
  const countSpan = document.getElementById('bookmark-filter-text');
  const headerCount = document.getElementById('header-saved-count');
  const drawerCount = document.getElementById('drawer-count-badge');

  if (countSpan) {
    countSpan.textContent = savedCount > 0 ? `SAVED [${savedCount}]` : 'SAVED';
  }
  if (headerCount) {
    headerCount.textContent = String(savedCount);
  }
  if (drawerCount) {
    drawerCount.textContent = String(savedCount);
  }
}

// Watch Technical Spec Modal
function openSpecModal(watchId) {
  const watch = allWatches.find((w) => w.id === watchId);
  if (!watch) return;

  const modal = document.getElementById('watch-spec-modal');
  if (!modal) return;

  const seriesText = (watch.series || 'CASIO').toUpperCase();
  const seriesEl = document.getElementById('modal-spec-series');
  const cutEl = document.getElementById('modal-spec-cut');
  const atlBadge = document.getElementById('modal-spec-atl');
  const img = document.getElementById('modal-spec-image');
  const skuEl = document.getElementById('modal-spec-sku');
  const titleEl = document.getElementById('modal-spec-title');
  const statusEl = document.getElementById('modal-spec-status');
  const mrpEl = document.getElementById('modal-spec-mrp');
  const priceEl = document.getElementById('modal-spec-price');
  const savingsEl = document.getElementById('modal-spec-savings');
  const familyEl = document.getElementById('modal-spec-family');
  const buyLink = document.getElementById('modal-spec-buy-link');

  if (seriesEl) seriesEl.textContent = `${seriesText} // SPEC PROTOCOL`;
  if (cutEl) cutEl.textContent = `-${watch.discountPercent}% CUT`;
  if (atlBadge) atlBadge.classList.toggle('hidden', !watch.isAllTimeLow);

  if (img) {
    img.src = watch.image || 'https://cdn.shopify.com/s/files/1/0910/0073/3977/files/GA-2100RL-1A.png?v=1751277644';
    img.alt = watch.title;
  }

  if (skuEl) skuEl.textContent = `RAW SKU: ${watch.sku || 'N/A'}`;
  if (titleEl) titleEl.textContent = watch.title;

  if (statusEl) {
    statusEl.innerHTML = watch.available
      ? '<span class="text-accent-green font-semibold">🟢 IN STOCK</span> • OFFICIAL BHAWAR DISTRIBUTOR'
      : '<span class="text-ink-muted">🔴 OUT OF STOCK</span> • MONITORING RESTOCK';
  }

  if (mrpEl) mrpEl.textContent = formatInr(watch.originalPrice);
  if (priceEl) priceEl.textContent = formatInr(watch.price);
  if (savingsEl) savingsEl.textContent = `+${formatInr(watch.savings)} (-${watch.discountPercent}%)`;
  if (familyEl) familyEl.textContent = seriesText;
  if (buyLink) buyLink.href = watch.url;

  // Setup Bookmark Button inside Modal
  const bookmarkBtn = document.getElementById('modal-spec-bookmark-btn');
  const bookmarkLabel = document.getElementById('modal-bookmark-label');
  const bookmarkIcon = bookmarkBtn?.querySelector('.material-symbols-outlined');

  const updateModalBookmarkUI = () => {
    const isBookmarked = getBookmarks().includes(watch.id);
    if (bookmarkIcon) bookmarkIcon.textContent = isBookmarked ? 'bookmark' : 'bookmark_border';
    if (bookmarkLabel) bookmarkLabel.textContent = isBookmarked ? 'SAVED IN LOCKER' : 'SAVE TO WATCHLIST';
    if (bookmarkBtn) {
      bookmarkBtn.classList.toggle('border-ink', isBookmarked);
      bookmarkBtn.classList.toggle('bg-surface-pure', isBookmarked);
    }
  };
  updateModalBookmarkUI();

  if (bookmarkBtn) {
    bookmarkBtn.onclick = (e) => {
      e.preventDefault();
      toggleBookmark(watch.id);
      updateModalBookmarkUI();
      renderGrid();
    };
  }

  // Setup Share Button inside Modal
  const shareBtn = document.getElementById('modal-spec-share-btn');
  if (shareBtn) {
    shareBtn.onclick = (e) => {
      e.preventDefault();
      shareDeal(watch);
    };
  }

  modal.classList.remove('hidden');
}

function closeSpecModal() {
  const modal = document.getElementById('watch-spec-modal');
  if (modal) modal.classList.add('hidden');
}

// Saved Watchlist Drawer (Deal Locker)
function openSavedDrawer() {
  const drawer = document.getElementById('saved-drawer');
  const backdrop = document.getElementById('saved-drawer-backdrop');
  if (!drawer || !backdrop) return;

  renderSavedDrawer();

  backdrop.classList.remove('pointer-events-none', 'opacity-0');
  backdrop.classList.add('opacity-100');
  drawer.classList.remove('translate-x-full');
}

function closeSavedDrawer() {
  const drawer = document.getElementById('saved-drawer');
  const backdrop = document.getElementById('saved-drawer-backdrop');
  if (!drawer || !backdrop) return;

  drawer.classList.add('translate-x-full');
  backdrop.classList.remove('opacity-100');
  backdrop.classList.add('opacity-0', 'pointer-events-none');
}

function renderSavedDrawer() {
  const bookmarks = getBookmarks();
  const savedItems = allWatches.filter((w) => bookmarks.includes(w.id));

  const listContainer = document.getElementById('saved-drawer-list');
  const emptyState = document.getElementById('saved-drawer-empty');
  const totalMrpEl = document.getElementById('drawer-total-mrp');
  const totalSavingsEl = document.getElementById('drawer-total-savings');
  const drawerCount = document.getElementById('drawer-count-badge');
  const headerCount = document.getElementById('header-saved-count');

  if (drawerCount) drawerCount.textContent = String(savedItems.length);
  if (headerCount) headerCount.textContent = String(savedItems.length);

  if (savedItems.length === 0) {
    if (listContainer) listContainer.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (totalMrpEl) totalMrpEl.textContent = '₹0';
    if (totalSavingsEl) totalSavingsEl.textContent = '₹0';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  if (listContainer) listContainer.classList.remove('hidden');

  const totalMrp = savedItems.reduce((acc, w) => acc + (w.originalPrice || 0), 0);
  const totalSavings = savedItems.reduce((acc, w) => acc + (w.savings || 0), 0);

  if (totalMrpEl) totalMrpEl.textContent = formatInr(totalMrp);
  if (totalSavingsEl) totalSavingsEl.textContent = '+' + formatInr(totalSavings);

  if (listContainer) {
    listContainer.innerHTML = savedItems.map((item) => {
      const imageSrc = item.image || 'https://cdn.shopify.com/s/files/1/0910/0073/3977/files/GA-2100RL-1A.png?v=1751277644';
      return `
        <div class="flex items-center justify-between gap-3 p-2.5 bg-surface border border-border-hairline group">
          <div class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer drawer-item-click" data-id="${item.id}">
            <img src="${imageSrc}" alt="${item.title}" class="w-12 h-12 object-contain bg-surface-muted/30 p-1 flex-shrink-0" />
            <div class="flex flex-col min-w-0">
              <span class="text-[8px] text-ink-muted uppercase tracking-wider">${item.series || 'CASIO'} • ${item.sku || ''}</span>
              <h4 class="font-grotesk font-bold text-xs truncate text-ink">${item.title}</h4>
              <div class="flex items-baseline gap-1.5 text-[10px]">
                <span class="font-bold text-ink">${formatInr(item.price)}</span>
                <span class="line-through text-ink-muted text-[8px]">${formatInr(item.originalPrice)}</span>
                <span class="text-accent-red font-bold text-[8px]">-${item.discountPercent}%</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <a href="${item.url}" target="_blank" rel="noopener" class="px-2.5 py-1.5 bg-ink text-surface-pure text-[8px] uppercase tracking-wider font-bold hover:bg-accent-red transition-colors">
              BUY ↗
            </a>
            <button class="remove-saved-item-btn p-1 text-ink-muted hover:text-accent-red transition-colors cursor-pointer" data-id="${item.id}" title="Remove from Locker">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to drawer item rows to open modal
    listContainer.querySelectorAll('.drawer-item-click').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        closeSavedDrawer();
        openSpecModal(id);
      });
    });

    // Attach click listeners to remove buttons
    listContainer.querySelectorAll('.remove-saved-item-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        toggleBookmark(id);
        renderSavedDrawer();
        renderGrid();
      });
    });
  }
}

function renderSeriesCounts() {
  // Update ALL badge
  const pillAll = document.getElementById('pill-all-count');
  if (pillAll) {
    pillAll.textContent = `[${allWatches.length}]`;
  }

  // Update discount cuts for every series pill dynamically
  document.querySelectorAll('.series-pill[data-series]').forEach((pill) => {
    const series = pill.dataset.series;
    if (series === 'all') return;

    const matching = allWatches.filter((w) => {
      if (!w.series) return false;
      return w.series.toLowerCase() === series.toLowerCase();
    });

    const badge = pill.querySelector('.series-cut-badge');
    if (badge) {
      if (matching.length > 0) {
        const cuts = matching.map((w) => w.discountPercent || 0).filter((c) => c > 0);
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

function getFilteredWatches() {
  const bookmarks = getBookmarks();

  let list = allWatches.filter((item) => {
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

    // Budget range
    if (state.budget === 'under_2500' && item.price >= 2500) return false;
    if (state.budget === '2500_5000' && (item.price < 2500 || item.price > 5000)) return false;
    if (state.budget === '5000_10000' && (item.price < 5000 || item.price > 10000)) return false;
    if (state.budget === 'above_10000' && item.price <= 10000) return false;

    // Minimum discount threshold
    if (state.minDiscount > 0 && item.discountPercent < state.minDiscount) return false;

    // All-time low only
    if (state.allTimeLowOnly && !item.isAllTimeLow) return false;

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
  const paginationControls = document.getElementById('pagination-controls');
  const btnLoadMore = document.getElementById('btn-load-more');
  const resultsCountText = document.getElementById('results-count-text');
  const bookmarks = getBookmarks();

  const filtered = getFilteredWatches();

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

  const searchMatchText = document.getElementById('search-match-text');
  if (searchMatchText) {
    if (state.search) {
      searchMatchText.textContent = `LOCATED ${filtered.length} WATCHES MATCHING "${state.search.toUpperCase()}"`;
      searchMatchText.classList.remove('hidden');
    } else {
      searchMatchText.classList.add('hidden');
    }
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState?.classList.remove('hidden');
    if (paginationControls) paginationControls.style.display = 'none';
    return;
  }

  emptyState?.classList.add('hidden');

  // Progressive rendering slice
  const visible = filtered.slice(0, state.visibleCount);

  if (paginationControls) {
    paginationControls.style.display = 'flex';
    if (resultsCountText) {
      resultsCountText.textContent = `SHOWING ${visible.length} OF ${filtered.length} WATCHES`;
    }
    if (btnLoadMore) {
      if (visible.length < filtered.length) {
        btnLoadMore.style.display = 'inline-block';
        btnLoadMore.textContent = `LOAD MORE WATCHES (+${Math.min(state.pageSize, filtered.length - visible.length)})`;
      } else {
        btnLoadMore.style.display = 'none';
      }
    }
  }

  container.innerHTML = visible.map((item, index) => {
    const padIndex = String(index + 1).padStart(2, '0');
    const imageSrc = item.image || 'https://cdn.shopify.com/s/files/1/0910/0073/3977/files/GA-2100RL-1A.png?v=1751277644';
    const seriesTitle = (item.series || 'CASIO').toUpperCase();
    const isSaved = bookmarks.includes(item.id);
    const stockStatus = item.available
      ? '<span class="text-accent-green font-semibold">🟢 IN STOCK</span>'
      : '<span class="text-ink-muted">🔴 OUT OF STOCK</span>';

    const atlBadge = item.isAllTimeLow
      ? `<span class="bg-amber-100 border border-amber-400 text-amber-900 px-1 py-0.5 text-[8px] sm:text-[9px] font-bold tracking-tight" title="Lowest price recorded across all tracker runs">🌟 ALL-TIME LOW</span>`
      : '';

    return `
      <article class="border-r border-b border-border-hairline p-4 sm:p-7 flex flex-col justify-between group bg-surface-pure hover:bg-surface-muted/30 transition-colors duration-200 cursor-pointer" data-watch-id="${item.id}">
        <!-- Top spec label & deal index -->
        <div class="flex items-center justify-between text-[9px] sm:text-[10px] font-mono tracking-widest text-ink-muted pb-2">
          <span class="truncate max-w-[120px] sm:max-w-none">PLATE ${padIndex} • ${seriesTitle}</span>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            ${atlBadge}
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
            <h2 class="font-grotesk font-bold text-[12px] sm:text-[14px] uppercase tracking-[-0.01em] line-clamp-1" title="${item.title}">
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
              class="card-btn flex-1 py-2 sm:py-2.5 hairline-all text-center block text-[9px] sm:text-[10px] font-mono tracking-[0.14em] uppercase bg-surface-pure text-ink hover:bg-ink hover:text-surface-pure transition-colors duration-150 font-semibold" 
              href="${item.url}" 
              rel="noopener noreferrer" 
              target="_blank"
            >
              SECURE AT BHAWAR ↗
            </a>
            <button 
              class="share-deal-btn px-2.5 py-2 sm:py-2.5 hairline-all text-center font-mono text-[9px] sm:text-[10px] tracking-wider text-ink-muted hover:text-ink hover:border-ink transition-colors bg-surface-pure"
              title="Share Deal or Copy Direct Link"
              data-id="${item.id}"
            >
              <span class="material-symbols-outlined text-[13px]">share</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach card click listener to open spec modal
  container.querySelectorAll('article[data-watch-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-btn') || e.target.closest('.share-deal-btn') || e.target.closest('.card-btn')) {
        return;
      }
      const id = card.dataset.watchId;
      openSpecModal(id);
    });
  });

  // Attach bookmark toggle listeners
  container.querySelectorAll('.bookmark-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      toggleBookmark(id);
      renderGrid();
    });
  });

  // Attach share deal listeners
  container.querySelectorAll('.share-deal-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.id;
      const watch = allWatches.find((w) => w.id === id);
      if (watch) shareDeal(watch);
    });
  });
}

// Refresh Feeds (Title Click & Pull-to-refresh)
let isRefreshingGlobal = false;
async function triggerFeedRefresh() {
  if (isRefreshingGlobal) return;
  isRefreshingGlobal = true;

  const radarIcons = document.querySelectorAll('header img[alt="Radar Icon"], nav img[alt="Radar"]');
  radarIcons.forEach((icon) => icon.classList.add('animate-spin'));
  showToast('SYNCING BHAWAR RADAR FEEDS...');

  await loadData(true);

  radarIcons.forEach((icon) => icon.classList.remove('animate-spin'));
  setTimeout(() => {
    isRefreshingGlobal = false;
  }, 400);
}

function setupEvents() {
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

  // Search & Clear Button
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', state.search.length === 0);
      }
      state.visibleCount = state.pageSize;
      renderGrid();
    });

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.search = '';
        clearSearchBtn.classList.add('hidden');
        state.visibleCount = state.pageSize;
        renderGrid();
        searchInput.focus();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  // Load More Button
  const btnLoadMore = document.getElementById('btn-load-more');
  if (btnLoadMore) {
    btnLoadMore.addEventListener('click', () => {
      state.visibleCount += state.pageSize;
      renderGrid();
    });
  }

  // Series Pills
  const pillBar = document.getElementById('series-pill-bar');
  if (pillBar) {
    pillBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.series-pill');
      if (btn) {
        pillBar.querySelectorAll('.series-pill').forEach((p) => {
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
        state.visibleCount = state.pageSize;
        renderGrid();
      }
    });
  }

  // Budget Filter Buttons
  const budgetButtons = document.querySelectorAll('.budget-btn');
  budgetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      budgetButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.budget = btn.dataset.budget;
      state.visibleCount = state.pageSize;
      renderGrid();
    });
  });

  // Min Discount Cut Buttons
  const cutButtons = document.querySelectorAll('.cut-btn');
  cutButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      cutButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.minDiscount = parseInt(btn.dataset.minDiscount || '0', 10);
      state.visibleCount = state.pageSize;
      renderGrid();
    });
  });

  // All-Time Low Filter Toggle
  const atlToggleBtn = document.getElementById('toggle-atl-filter');
  if (atlToggleBtn) {
    atlToggleBtn.addEventListener('click', () => {
      state.allTimeLowOnly = !state.allTimeLowOnly;
      atlToggleBtn.classList.toggle('is-active', state.allTimeLowOnly);
      state.visibleCount = state.pageSize;
      renderGrid();
    });
  }

  // Sort buttons
  const sortButtons = document.querySelectorAll('.sort-btn');
  sortButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      sortButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      state.sortBy = btn.dataset.sort;
      state.visibleCount = state.pageSize;
      renderGrid();
    });
  });

  // Stock Filter Toggle
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
      state.visibleCount = state.pageSize;
      renderGrid();
    });
  }

  // Saved / Bookmark Filter Toggle
  const bookmarkToggleBtn = document.getElementById('toggle-bookmark-filter');
  if (bookmarkToggleBtn) {
    bookmarkToggleBtn.addEventListener('click', () => {
      state.savedOnly = !state.savedOnly;
      bookmarkToggleBtn.classList.toggle('is-active', state.savedOnly);
      state.visibleCount = state.pageSize;
      renderGrid();
    });
  }

  // Layout View Switcher: Icon-Only (Single, Dual Default, Editorial Adaptive)
  const viewToggle = document.getElementById('layout-view-toggle');
  const matrix = document.getElementById('catalog-product-matrix');
  if (viewToggle && matrix) {
    const buttons = viewToggle.querySelectorAll('button[data-layout-mode]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const mode = this.dataset.layoutMode;
        buttons.forEach((b) => b.classList.remove('is-active'));
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

  // Reset filters
  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.search = '';
      state.series = 'all';
      state.budget = 'all';
      state.minDiscount = 0;
      state.allTimeLowOnly = false;
      state.inStockOnly = false;
      state.savedOnly = false;
      state.sortBy = 'discount_desc';
      state.visibleCount = state.pageSize;

      if (searchInput) searchInput.value = '';
      if (stockToggleBtn) stockToggleBtn.classList.remove('is-active');
      if (stockDot) stockDot.className = 'w-1.5 h-1.5 rounded-full bg-ink-muted';
      if (bookmarkToggleBtn) bookmarkToggleBtn.classList.remove('is-active');
      if (atlToggleBtn) atlToggleBtn.classList.remove('is-active');

      budgetButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.budget === 'all'));
      cutButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.minDiscount === '0'));

      sortButtons.forEach((b) => {
        b.classList.toggle('is-active', b.dataset.sort === 'discount_desc');
      });

      if (pillBar) {
        pillBar.querySelectorAll('.series-pill').forEach((p) => {
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

  // Alerts Modal
  const modal = document.getElementById('alert-modal');
  const openBtn = document.getElementById('btn-open-alert-modal');
  const footerAlertsBtn = document.getElementById('footer-alerts-btn');
  const closeBtn = document.getElementById('btn-close-modal');
  const closeFooterBtn = document.getElementById('btn-close-modal-footer');

  const openModal = () => modal?.classList.remove('hidden');
  const closeModal = () => modal?.classList.add('hidden');

  if (openBtn) openBtn.addEventListener('click', openModal);
  if (footerAlertsBtn) footerAlertsBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Watch Spec Modal
  const specModal = document.getElementById('watch-spec-modal');
  const closeSpecModalBtn = document.getElementById('btn-close-spec-modal');
  if (closeSpecModalBtn) closeSpecModalBtn.addEventListener('click', closeSpecModal);
  if (specModal) {
    specModal.addEventListener('click', (e) => {
      if (e.target === specModal) closeSpecModal();
    });
  }

  // Saved Watchlist Drawer (Deal Locker)
  const openSavedDrawerBtn = document.getElementById('btn-open-saved-drawer');
  const closeSavedDrawerBtn = document.getElementById('btn-close-saved-drawer');
  const closeSavedDrawerFooter = document.getElementById('btn-close-saved-drawer-footer');
  const savedDrawerBackdrop = document.getElementById('saved-drawer-backdrop');
  const clearSavedAllBtn = document.getElementById('btn-clear-saved-all');

  if (openSavedDrawerBtn) openSavedDrawerBtn.addEventListener('click', openSavedDrawer);
  if (closeSavedDrawerBtn) closeSavedDrawerBtn.addEventListener('click', closeSavedDrawer);
  if (closeSavedDrawerFooter) closeSavedDrawerFooter.addEventListener('click', closeSavedDrawer);
  if (savedDrawerBackdrop) savedDrawerBackdrop.addEventListener('click', closeSavedDrawer);

  if (clearSavedAllBtn) {
    clearSavedAllBtn.addEventListener('click', () => {
      localStorage.removeItem('casio_bookmarks');
      updateSavedFilterCount();
      renderSavedDrawer();
      renderGrid();
      showToast('SAVED WATCHLIST CLEARED');
    });
  }

  // Global ESC Key Listener to Dismiss Any Active Modal or Drawer
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSpecModal();
      closeSavedDrawer();
      closeModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('casio_theme');
  document.documentElement.classList.remove('dark');
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
