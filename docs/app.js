// Casio Tracker Client Logic
let allWatches = [];
let metadata = {};

const state = {
  search: '',
  series: 'all',
  inStockOnly: false,
  minDiscount: 0,
  sortBy: 'discount_desc'
};

function formatInr(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function timeAgo(dateString) {
  if (!dateString) return 'recently';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// Fetch live data
async function loadData() {
  try {
    const res = await fetch('data.json?v=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allWatches = data.items || [];
    metadata = data;
    updateStats();
    renderWatches();
  } catch (err) {
    console.warn('Could not load data.json, looking for local fallback or sample:', err);
    // If running in development or before first run
    renderEmpty();
  }
}

function updateStats() {
  const maxDiscountElem = document.getElementById('stat-max-discount');
  const totalDealsElem = document.getElementById('stat-total-deals');
  const inStockSubElem = document.getElementById('stat-in-stock-sub');
  const totalScannedElem = document.getElementById('stat-total-scanned');
  const lastCheckedElem = document.getElementById('stat-last-checked');
  const syncRelativeElem = document.getElementById('stat-sync-relative');

  if (allWatches.length > 0) {
    const maxDiscount = Math.max(...allWatches.map((w) => w.discountPercent || 0));
    maxDiscountElem.textContent = `${maxDiscount}%`;

    const inStockCount = allWatches.filter((w) => w.available).length;
    totalDealsElem.textContent = allWatches.length;
    inStockSubElem.textContent = `${inStockCount} in stock now`;
  } else {
    maxDiscountElem.textContent = '0%';
    totalDealsElem.textContent = '0';
    inStockSubElem.textContent = '0 in stock';
  }

  if (metadata.stats) {
    totalScannedElem.textContent = metadata.stats.totalScanned || '371+';
  } else {
    totalScannedElem.textContent = '371+';
  }

  if (metadata.updatedAt) {
    const date = new Date(metadata.updatedAt);
    lastCheckedElem.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    syncRelativeElem.textContent = timeAgo(metadata.updatedAt);
  } else {
    lastCheckedElem.textContent = 'Live';
    syncRelativeElem.textContent = 'Auto-sync';
  }
}

function getFilteredWatches() {
  let list = allWatches.filter((item) => {
    // Search filter
    if (state.search) {
      const q = state.search.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSku = item.sku && item.sku.toLowerCase().includes(q);
      const matchSeries = item.series && item.series.toLowerCase().includes(q);
      if (!matchTitle && !matchSku && !matchSeries) return false;
    }

    // Series filter
    if (state.series !== 'all') {
      if (item.series !== state.series) return false;
    }

    // Stock toggle
    if (state.inStockOnly && !item.available) {
      return false;
    }

    // Min discount filter
    if (item.discountPercent < state.minDiscount) {
      return false;
    }

    return true;
  });

  // Sorting
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

function renderWatches() {
  const grid = document.getElementById('watch-grid');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('deals-count-badge');

  const filtered = getFilteredWatches();
  countBadge.textContent = `${filtered.length} Watch${filtered.length === 1 ? '' : 'es'}`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  grid.innerHTML = filtered
    .map((item) => {
      const stockBadge = item.available
        ? `<span class="stock-badge stock-in">🟢 In Stock</span>`
        : `<span class="stock-badge stock-out">⚪ Out of Stock</span>`;

      const imageSrc = item.image
        ? item.image
        : 'https://cdn.shopify.com/s/files/1/0910/0073/3977/files/GA-2100RL-1A.png?v=1751277644';

      return `
        <article class="watch-card">
          <div class="card-media">
            <div class="card-badges">
              <span class="discount-badge">🔥 ${item.discountPercent}% OFF</span>
              ${stockBadge}
            </div>
            <img src="${imageSrc}" alt="${item.title}" loading="lazy" />
          </div>

          <div class="card-body">
            <div class="card-meta">
              <span class="series-tag">${item.series || 'Casio'}</span>
              <span class="sku-tag">${item.sku || ''}</span>
            </div>

            <h3 class="card-title">${item.title}</h3>

            <div class="price-block">
              <div>
                <span class="current-price">${formatInr(item.price)}</span>
                <span class="original-price">${formatInr(item.originalPrice)}</span>
              </div>
              <span class="savings-tag">Save ${formatInr(item.savings)}</span>
            </div>

            <div class="card-action">
              <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-buy">
                <span>View on Casio Store</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderEmpty() {
  document.getElementById('watch-grid').innerHTML = '';
  document.getElementById('empty-state').classList.remove('hidden');
}

// Event Listeners setup
function setupEvents() {
  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    renderWatches();
  });

  // Shortcut key '/' to focus search
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Series buttons
  const seriesContainer = document.getElementById('series-filters');
  seriesContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-pill')) {
      seriesContainer.querySelectorAll('.filter-pill').forEach((btn) => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.series = e.target.dataset.series;
      renderWatches();
    }
  });

  // Stock toggle
  const stockToggle = document.getElementById('stock-toggle');
  stockToggle.addEventListener('change', (e) => {
    state.inStockOnly = e.target.checked;
    renderWatches();
  });

  // Min discount select
  const discountSelect = document.getElementById('discount-select');
  discountSelect.addEventListener('change', (e) => {
    state.minDiscount = parseInt(e.target.value, 10);
    renderWatches();
  });

  // Sort select
  const sortSelect = document.getElementById('sort-select');
  sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderWatches();
  });

  // Reset button
  const resetBtn = document.getElementById('btn-reset-filters');
  resetBtn.addEventListener('click', () => {
    state.search = '';
    state.series = 'all';
    state.inStockOnly = false;
    state.minDiscount = 0;
    state.sortBy = 'discount_desc';

    searchInput.value = '';
    stockToggle.checked = false;
    discountSelect.value = '0';
    sortSelect.value = 'discount_desc';
    seriesContainer.querySelectorAll('.filter-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.series === 'all');
    });

    renderWatches();
  });

  // Alert modal
  const alertModal = document.getElementById('alert-modal');
  const openModalBtn = document.getElementById('btn-open-alert-modal');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const closeModalFooterBtn = document.getElementById('btn-close-modal-footer');

  openModalBtn.addEventListener('click', () => alertModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => alertModal.classList.add('hidden'));
  closeModalFooterBtn.addEventListener('click', () => alertModal.classList.add('hidden'));
  alertModal.addEventListener('click', (e) => {
    if (e.target === alertModal) alertModal.classList.add('hidden');
  });
}

// Initial bootstrap
document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  loadData();
});
