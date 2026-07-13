/* ═══════════════════════════════════════════════════════════
   JESI-COSMETIC — script.js
   Connects frontend to Node.js + MySQL backend API.
   API base: http://localhost:3000/api
═══════════════════════════════════════════════════════════ */

const API = 'http://localhost:3000/api';

/* ─────────────────────────────────────────────────────────
   HERO SLIDER
───────────────────────────────────────────────────────── */
function initSlider() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  let current = 0;
  let timer;
  const slides   = document.querySelectorAll('.slide');
  const dots     = document.querySelectorAll('.dot');
  const counter  = document.getElementById('counter');
  const prog     = document.getElementById('prog');
  const prevBtn  = document.getElementById('prev');
  const nextBtn  = document.getElementById('next');
  const total    = slides.length;
  const dotColors  = ['#e8d0c4', '#dda297', '#eab9d2', '#beebf6'];
  const progColors = ['#e8d0c4', '#dda297', '#eab9d2', '#beebf6'];

  function goTo(n) {
    slides[current].classList.remove('active');
    if (dots[current]) { dots[current].classList.remove('active'); dots[current].style.background = ''; }
    current = (n + total) % total;
    slides[current].classList.add('active');
    if (dots[current]) { dots[current].classList.add('active'); dots[current].style.background = dotColors[current]; }
    if (counter) counter.textContent = String(current + 1).padStart(2,'0') + ' — ' + String(total).padStart(2,'0');
    if (prog) {
      prog.style.background = progColors[current];
      prog.classList.remove('go');
      void prog.offsetWidth;
      prog.classList.add('go');
    }
  }

  function start() { timer = setInterval(() => goTo(current + 1), 2000); }
  function reset() { clearInterval(timer); start(); }

  dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); reset(); }));
  if (prevBtn) prevBtn.addEventListener('click', () => { goTo(current - 1); reset(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { goTo(current + 1); reset(); });
  start();
}

/* ─────────────────────────────────────────────────────────
   CART — slide-out panel
───────────────────────────────────────────────────────── */
function initCart() {
  const cartBtn     = document.getElementById('cartBtn');
  const cartPanel   = document.getElementById('cartPanel');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartClose   = document.getElementById('cartClose');
  const cartItems   = document.getElementById('cartItems');
  const cartEmpty   = document.getElementById('cartEmpty');
  const cartFoot    = document.getElementById('cartFoot');
  const cartBadge   = document.getElementById('cartBadge');
  const cartSubtotal = document.getElementById('cartSubtotal');
  if (!cartBtn || !cartPanel) return;

  // Open / close panel
  function openCart() {
    cartPanel.classList.add('open');
    cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    loadCart();
  }
  function closeCart() {
    cartPanel.classList.remove('open');
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  cartBtn.addEventListener('click', openCart);
  cartClose.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  // Load cart from API
  async function loadCart() {
    try {
      const res  = await fetch(`${API}/cart`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const items = json.data;
      updateBadge(json.item_count);

      // Clear previous items (keep empty message)
      document.querySelectorAll('.cart-item').forEach(el => el.remove());

      if (items.length === 0) {
        cartEmpty.style.display = '';
        cartFoot.style.display  = 'none';
        return;
      }

      cartEmpty.style.display = 'none';
      cartFoot.style.display  = '';
      cartSubtotal.textContent = '$' + parseFloat(json.subtotal).toFixed(2);

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
          <div class="cart-item-img ${item.image_class}">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : '<i class="ti ti-photo" aria-hidden="true"></i>'}
          </div>
          <div class="cart-item-info">
            <span class="cart-item-brand">Medicube</span>
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-price">$${parseFloat(item.price).toFixed(2)}</span>
          </div>
          <div class="cart-item-actions">
            <div class="qty-wrap">
              <button class="qty-btn" data-id="${item.product_id}" data-action="dec">−</button>
              <span class="qty-num">${item.quantity}</span>
              <button class="qty-btn" data-id="${item.product_id}" data-action="inc">+</button>
            </div>
            <button class="cart-remove" data-id="${item.product_id}" aria-label="Remove item">
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
          </div>
        `;
        cartItems.appendChild(row);
      });

      // Qty +/- buttons
      cartItems.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id  = btn.dataset.id;
          const act = btn.dataset.action;
          const span = btn.closest('.qty-wrap').querySelector('.qty-num');
          let qty = parseInt(span.textContent);
          qty = act === 'inc' ? qty + 1 : Math.max(1, qty - 1);
          await fetch(`${API}/cart/${id}`, {
            method:      'PATCH',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ quantity: qty }),
          });
          loadCart();
        });
      });

      // Remove buttons
      cartItems.querySelectorAll('.cart-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          await fetch(`${API}/cart/${btn.dataset.id}`, {
            method: 'DELETE', credentials: 'include'
          });
          loadCart();
        });
      });

    } catch (err) {
      console.error('Cart load error:', err);
    }
  }

  // Update the badge number in navbar
  function updateBadge(count) {
    if (!cartBadge) return;
    cartBadge.textContent = count;
    cartBadge.style.display = count > 0 ? '' : 'none';
  }

  // Add-to-cart buttons on product cards
  document.querySelectorAll('.add-cart, .add-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('[data-name]');
      if (!card) return;

      const productName = card.dataset.name;

      // Look up product_id from API using name
      try {
        const res  = await fetch(`${API}/products?q=${encodeURIComponent(productName)}`, { credentials: 'include' });
        const json = await res.json();
        if (!json.success || json.data.length === 0) {
          showToast('Product not found in database', 'error');
          return;
        }
        const product_id = json.data[0].id;

        const addRes  = await fetch(`${API}/cart`, {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify({ product_id, quantity: 1 }),
        });
        const addJson = await addRes.json();
        if (addJson.success) {
          showToast(`${productName} added to cart`);
          // Reload badge count
          const cartRes  = await fetch(`${API}/cart`, { credentials: 'include' });
          const cartJson = await cartRes.json();
          updateBadge(cartJson.item_count);
        }
      } catch (err) {
        showToast('Could not add to cart', 'error');
        console.error(err);
      }
    });
  });

  // Load badge count on page load
  (async () => {
    try {
      const res  = await fetch(`${API}/cart`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) updateBadge(json.item_count);
    } catch (_) {}
  })();
}

/* ─────────────────────────────────────────────────────────
   WISHLIST — heart button toggle
───────────────────────────────────────────────────────── */
function initWishlist() {
  const wishlistBadge = document.getElementById('wishlistBadge');

  async function updateWishlistBadge() {
    try {
      const res  = await fetch(`${API}/wishlist`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success || !wishlistBadge) return;
      wishlistBadge.textContent    = json.count;
      wishlistBadge.style.display  = json.count > 0 ? '' : 'none';
    } catch (_) {}
  }

  // Load saved wishlist IDs to mark hearts as active
  async function markSavedWishlists() {
    try {
      const res  = await fetch(`${API}/wishlist`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success) return;
      const savedIds = json.data.map(i => String(i.product_id));

      document.querySelectorAll('.wish-btn').forEach(btn => {
        const card = btn.closest('[data-name]');
        if (!card) return;
        // We'll match by stored attribute after we resolve IDs — for now mark on product_id in dataset
        if (card.dataset.productId && savedIds.includes(card.dataset.productId)) {
          btn.classList.add('wished');
        }
      });
    } catch (_) {}
  }

  document.querySelectorAll('.wish-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card        = btn.closest('[data-name]');
      const productName = card && card.dataset.name;
      if (!productName) return;

      const isWished = btn.classList.contains('wished');

      try {
        // Resolve product_id
        const res  = await fetch(`${API}/products?q=${encodeURIComponent(productName)}`, { credentials: 'include' });
        const json = await res.json();
        if (!json.success || json.data.length === 0) return;
        const product_id = json.data[0].id;

        if (isWished) {
          // Remove from wishlist
          await fetch(`${API}/wishlist/${product_id}`, { method: 'DELETE', credentials: 'include' });
          btn.classList.remove('wished');
          showToast(`${productName} removed from wishlist`);
        } else {
          // Add to wishlist
          await fetch(`${API}/wishlist`, {
            method:      'POST',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ product_id }),
          });
          btn.classList.add('wished');
          showToast(`${productName} saved to wishlist`);
        }
        updateWishlistBadge();
      } catch (err) {
        console.error('Wishlist error:', err);
      }
    });
  });

  updateWishlistBadge();
  markSavedWishlists();
}

/* ─────────────────────────────────────────────────────────
   SEARCH — live filter as you type
───────────────────────────────────────────────────────── */
function initSearch() {
  const input   = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();

    if (q.length < 2) {
      results.classList.remove('open');
      results.innerHTML = '';
      // If on a product page, show all cards again
      filterPageCards('');
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/products?q=${encodeURIComponent(q)}&limit=6`, { credentials: 'include' });
        const json = await res.json();

        results.innerHTML = '';
        if (!json.success || json.data.length === 0) {
          results.innerHTML = '<div class="search-no-results">No products found for "<strong>' + q + '</strong>"</div>';
          results.classList.add('open');
          return;
        }

        json.data.forEach(prod => {
          const item = document.createElement('a');
          item.className = 'search-result-item';
          item.href      = `shop.html?q=${encodeURIComponent(prod.name)}`;
          item.innerHTML = `
            <div class="sri-img ${prod.image_class}">
              ${prod.image_url ? `<img src="${prod.image_url}" alt="${prod.name}">` : '<i class="ti ti-photo" aria-hidden="true"></i>'}
            </div>
            <div class="sri-info">
              <span class="sri-name">${highlight(prod.name, q)}</span>
              <span class="sri-price">$${parseFloat(prod.price).toFixed(2)}${prod.old_price ? ' <s>$' + parseFloat(prod.old_price).toFixed(2) + '</s>' : ''}</span>
            </div>
          `;
          results.appendChild(item);
        });

        // Footer link
        const all = document.createElement('a');
        all.className = 'search-result-all';
        all.href      = `shop.html?q=${encodeURIComponent(q)}`;
        all.innerHTML = `See all results for "<strong>${q}</strong>" <i class="ti ti-arrow-right" aria-hidden="true"></i>`;
        results.appendChild(all);
        results.classList.add('open');

        // Also filter product cards live on this page if there are any
        filterPageCards(q);

      } catch (err) {
        console.error('Search error:', err);
      }
    }, 280);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.remove('open');
    }
  });

  // Close on Escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { results.classList.remove('open'); input.blur(); }
  });
}

// Highlight matching text in search results
function highlight(text, q) {
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

// Live-filter product cards already on the page
function filterPageCards(q) {
  const lower = q.toLowerCase();
  document.querySelectorAll('[data-name]').forEach(card => {
    const name = (card.dataset.name || '').toLowerCase();
    card.style.display = (!lower || name.includes(lower)) ? '' : 'none';
  });
}

/* ─────────────────────────────────────────────────────────
   FILTER TABS (shop / category pages)
───────────────────────────────────────────────────────── */
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards      = document.querySelectorAll('[data-category]');
  if (!filterBtns.length) return;

  function applyFilter(filter) {
    filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    cards.forEach(card => {
      card.style.display = (filter === 'all' || card.dataset.category === filter) ? '' : 'none';
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });

  // Support linking straight into a filtered view, e.g. shop.html?filter=serums
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('filter');
  if (requested && [...filterBtns].some(b => b.dataset.filter === requested)) {
    applyFilter(requested);
  }
}

/* ─────────────────────────────────────────────────────────
   MOBILE NAV TOGGLE
───────────────────────────────────────────────────────── */
function initNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
}

/* ─────────────────────────────────────────────────────────
   TOAST NOTIFICATION
───────────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.jesi-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `jesi-toast ${type}`;
  toast.innerHTML = `
    <i class="ti ti-${type === 'success' ? 'check' : 'alert-circle'}" aria-hidden="true"></i>
    <span>${msg}</span>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2800);
}

/* ─────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSlider();
  initCart();
  initWishlist();
  initSearch();
  initFilters();
  initNavToggle();
});