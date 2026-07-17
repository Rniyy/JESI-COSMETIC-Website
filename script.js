/* ═══════════════════════════════════════════════════════════
   JESI-COSMETIC — script.js
   Connects frontend to Node.js + MySQL backend API.
   API base: http://localhost:3000/api
═══════════════════════════════════════════════════════════ */

const API = 'http://localhost:3000/api';

/* ─────────────────────────────────────────────────────────
   HERO SLIDER
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   PRODUCT GRID — rendered dynamically from the database,
   so admin edits/adds/deletes show up without touching HTML.
───────────────────────────────────────────────────────── */
function buildProductCardHTML(p) {
  const badgeClass = p.badge === 'Sale' ? 'prod-badge prod-badge-sale' : 'prod-badge';
  const badgeHTML  = p.badge ? `<span class="${badgeClass}">${p.badge}</span>` : '';
  const oldPriceHTML = p.old_price
    ? ` <s class="prod-old">$${parseFloat(p.old_price).toFixed(0)}</s>`
    : '';
  const ratingText = p.rating ? `${parseFloat(p.rating).toFixed(1)} (${p.review_count || 0})` : '';

  return `
    <div class="product-card" data-category="${p.category}" data-name="${p.name}" data-price="${p.price}" data-product-id="${p.id}">
      <div class="product-img ${p.image_class || ''}">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : ''}
        <button class="wish-btn" aria-label="Add to wishlist"><i class="ti ti-heart"></i></button>
        ${badgeHTML}
      </div>
      <div class="product-info">
        <span class="prod-brand">${p.brand || 'Medicube'}</span>
        <h3 class="prod-name">${p.name}</h3>
        <div class="prod-stars">
          <i class="ti ti-star-filled"></i><i class="ti ti-star-filled"></i><i class="ti ti-star-filled"></i><i class="ti ti-star-filled"></i><i class="ti ti-star-filled"></i>
          <span>${ratingText}</span>
        </div>
        <div class="prod-bottom">
          <span class="prod-price">$${parseFloat(p.price).toFixed(0)}${oldPriceHTML}</span>
          <button class="add-cart" aria-label="Add to cart"><i class="ti ti-shopping-bag-plus"></i></button>
        </div>
      </div>
    </div>
  `;
}

async function renderShopProducts() {
  const grid = document.querySelector('.products-grid');
  if (!grid) return; // this page has no product grid (e.g. account/admin pages)

  try {
    const res  = await fetch(`${API}/products?limit=200`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    grid.innerHTML = json.data.map(buildProductCardHTML).join('');
  } catch (err) {
    console.error('Failed to load products:', err);
    grid.innerHTML = '<p class="products-loading">Could not load products — check your connection and try refreshing.</p>';
  }
}

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

      if (!window.currentUser) {
        document.dispatchEvent(new CustomEvent('auth:required'));
        return;
      }

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
          // Refresh badge AND the panel's item list (in case it's already open)
          loadCart();
        } else {
          showToast(addJson.message || 'Could not add to cart', 'error');
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

  // Refresh when another part of the page (e.g. Quick View) adds an item
  document.addEventListener('cart:changed', loadCart);
}

/* ─────────────────────────────────────────────────────────
   ACCOUNT — login / register / logout slide-out panel
───────────────────────────────────────────────────────── */
function initAuth() {
  const accountBtn   = document.getElementById('accountBtn');
  const authPanel    = document.getElementById('authPanel');
  const authOverlay  = document.getElementById('authOverlay');
  const authClose    = document.getElementById('authClose');
  const authTitle    = document.getElementById('authPanelTitle');
  if (!accountBtn || !authPanel) return;

  const loginForm    = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm   = document.getElementById('forgotForm');
  const accountView  = document.getElementById('authAccountView');

  const loginError    = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');
  const forgotSuccess  = document.getElementById('forgotSuccess');

  const accountName  = document.getElementById('accountName');
  const accountEmail = document.getElementById('accountEmail');
  const logoutBtn    = document.getElementById('logoutBtn');
  const adminDashboardLink = document.getElementById('adminDashboardLink');

  function renderAccountInfo(user) {
    accountName.textContent  = user.name;
    accountEmail.textContent = user.email;
    adminDashboardLink.style.display = user.role === 'admin' ? 'block' : 'none';
  }

  let currentUser = null;
  function setCurrentUser(user) {
    currentUser = user;
    window.currentUser = user; // exposed so initCart/initQuickView can gate add-to-cart
  }

  // Other code (e.g. add-to-cart when logged out) can request the panel open
  document.addEventListener('auth:required', () => {
    openAuth();
    showToast('Please log in to add items to your cart', 'error');
  });

  function openAuth() {
    authPanel.classList.add('open');
    authOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    refreshCurrentUser();
  }
  function closeAuth() {
    authPanel.classList.remove('open');
    authOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  accountBtn.addEventListener('click', openAuth);
  authClose.addEventListener('click', closeAuth);
  authOverlay.addEventListener('click', closeAuth);

  const editAccountView = document.getElementById('editAccountView');

  function showView(view) {
    [loginForm, registerForm, forgotForm, accountView, editAccountView].forEach(el => el.style.display = 'none');
    loginError.style.display    = 'none';
    registerError.style.display = 'none';
    forgotSuccess.style.display = 'none';

    const titles = {
      login:       'Log in',
      register:    'Create account',
      forgot:      'Reset password',
      account:     'Your account',
      editAccount: 'Edit account',
    };
    authTitle.textContent = titles[view];

    if (view === 'login')       loginForm.style.display       = 'flex';
    if (view === 'register')    registerForm.style.display    = 'flex';
    if (view === 'forgot')      forgotForm.style.display      = 'flex';
    if (view === 'account')     accountView.style.display     = 'flex';
    if (view === 'editAccount') editAccountView.style.display = 'flex';
  }

  document.getElementById('showRegisterForm').addEventListener('click', () => showView('register'));
  document.getElementById('showLoginFormFromRegister').addEventListener('click', () => showView('login'));
  document.getElementById('showForgotForm').addEventListener('click', () => showView('forgot'));
  document.getElementById('showLoginFormFromForgot').addEventListener('click', () => showView('login'));

  document.getElementById('showEditAccountForm').addEventListener('click', () => {
    if (!currentUser) return;
    document.getElementById('editName').value  = currentUser.name;
    document.getElementById('editEmail').value = currentUser.email;
    document.getElementById('editProfileError').style.display   = 'none';
    document.getElementById('editProfileSuccess').style.display = 'none';
    document.getElementById('editPasswordError').style.display   = 'none';
    document.getElementById('editPasswordSuccess').style.display = 'none';
    document.getElementById('editPasswordForm').reset();
    showView('editAccount');
  });
  document.getElementById('backToAccountView').addEventListener('click', () => showView('account'));

  document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl   = document.getElementById('editProfileError');
    const successEl = document.getElementById('editProfileSuccess');
    errorEl.style.display   = 'none';
    successEl.style.display = 'none';

    const name  = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();

    try {
      const res  = await fetch(`${API}/auth/me`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ name, email }),
      });
      const json = await res.json();
      if (!json.success) {
        errorEl.textContent   = json.message || 'Could not update profile';
        errorEl.style.display = 'block';
        return;
      }
      setCurrentUser(json.data);
      renderAccountInfo(currentUser);
      successEl.textContent   = 'Profile updated';
      successEl.style.display = 'block';
      showToast('Profile updated');
    } catch (err) {
      errorEl.textContent   = 'Something went wrong — try again';
      errorEl.style.display = 'block';
      console.error(err);
    }
  });

  document.getElementById('editPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl   = document.getElementById('editPasswordError');
    const successEl = document.getElementById('editPasswordSuccess');
    errorEl.style.display   = 'none';
    successEl.style.display = 'none';

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword     = document.getElementById('newPassword').value;

    try {
      const res  = await fetch(`${API}/auth/password`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        errorEl.textContent   = json.message || 'Could not update password';
        errorEl.style.display = 'block';
        return;
      }
      successEl.textContent   = 'Password updated';
      successEl.style.display = 'block';
      document.getElementById('editPasswordForm').reset();
      showToast('Password updated');
    } catch (err) {
      errorEl.textContent   = 'Something went wrong — try again';
      errorEl.style.display = 'block';
      console.error(err);
    }
  });

  // Check /me on load to decide which view to show, and to update the icon
  async function refreshCurrentUser() {
    try {
      const res  = await fetch(`${API}/auth/me`, { credentials: 'include' });
      const json = await res.json();
      setCurrentUser(json.success ? json.data : null);

      if (currentUser) {
        renderAccountInfo(currentUser);
        showView('account');
      } else {
        showView('login');
      }
    } catch (err) {
      console.error('Auth check error:', err);
      showView('login');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res  = await fetch(`${API}/auth/login`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) {
        loginError.textContent   = json.message || 'Could not log in';
        loginError.style.display = 'block';
        return;
      }
      setCurrentUser(json.data);
      renderAccountInfo(currentUser);
      showView('account');
      showToast(`Welcome back, ${currentUser.name}`);
      // Cart/wishlist may have merged guest data in — refresh both panels/badges
      document.dispatchEvent(new CustomEvent('cart:changed'));
      document.dispatchEvent(new CustomEvent('wishlist:changed'));
    } catch (err) {
      loginError.textContent   = 'Something went wrong — try again';
      loginError.style.display = 'block';
      console.error(err);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.style.display = 'none';
    const name     = document.getElementById('registerName').value.trim();
    const email    = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;

    try {
      const res  = await fetch(`${API}/auth/register`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!json.success) {
        registerError.textContent   = json.message || 'Could not create account';
        registerError.style.display = 'block';
        return;
      }
      currentUser = json.data; window.currentUser = json.data;
      renderAccountInfo(currentUser);
      showView('account');
      showToast(`Welcome, ${currentUser.name}`);
      document.dispatchEvent(new CustomEvent('cart:changed'));
      document.dispatchEvent(new CustomEvent('wishlist:changed'));
    } catch (err) {
      registerError.textContent   = 'Something went wrong — try again';
      registerError.style.display = 'block';
      console.error(err);
    }
  });

  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();

    try {
      const res  = await fetch(`${API}/auth/forgot-password`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email }),
      });
      const json = await res.json();
      forgotSuccess.textContent   = json.message || 'If that email is registered, a reset link has been generated.';
      forgotSuccess.style.display = 'block';
    } catch (err) {
      console.error(err);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
      currentUser = null; window.currentUser = null;
      showToast('Logged out');
      showView('login');
      // Switch back to guest-scoped cart/wishlist views
      document.dispatchEvent(new CustomEvent('cart:changed'));
      document.dispatchEvent(new CustomEvent('wishlist:changed'));
    } catch (err) {
      console.error(err);
    }
  });

  // Check login state quietly on page load (doesn't open the panel)
  refreshCurrentUser();
}

/* ─────────────────────────────────────────────────────────
   WISHLIST — heart button toggle
───────────────────────────────────────────────────────── */
function initWishlist() {
  const wishlistBadge   = document.getElementById('wishlistBadge');
  const wishlistBtn     = document.getElementById('wishlistBtn');
  const wishlistPanel   = document.getElementById('wishlistPanel');
  const wishlistOverlay = document.getElementById('wishlistOverlay');
  const wishlistClose   = document.getElementById('wishlistClose');
  const wishlistItems   = document.getElementById('wishlistItems');
  const wishlistEmpty   = document.getElementById('wishlistEmpty');

  // Open / close panel
  function openWishlist() {
    if (!wishlistPanel) return;
    wishlistPanel.classList.add('open');
    wishlistOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    loadWishlist();
  }
  function closeWishlist() {
    if (!wishlistPanel) return;
    wishlistPanel.classList.remove('open');
    wishlistOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (wishlistBtn)     wishlistBtn.addEventListener('click', openWishlist);
  if (wishlistClose)   wishlistClose.addEventListener('click', closeWishlist);
  if (wishlistOverlay) wishlistOverlay.addEventListener('click', closeWishlist);

  async function updateWishlistBadge() {
    try {
      const res  = await fetch(`${API}/wishlist`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success || !wishlistBadge) return;
      wishlistBadge.textContent    = json.count;
      wishlistBadge.style.display  = json.count > 0 ? '' : 'none';
    } catch (_) {}
  }

  // Load wishlist items into the slide-out panel, and mark matching hearts as active
  async function loadWishlist() {
    try {
      const res  = await fetch(`${API}/wishlist`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const items = json.data;
      if (wishlistBadge) {
        wishlistBadge.textContent   = json.count;
        wishlistBadge.style.display = json.count > 0 ? '' : 'none';
      }

      // Mark hearts on product cards as active for saved items
      const savedIds = items.map(i => String(i.product_id));
      document.querySelectorAll('.wish-btn').forEach(btn => {
        const card = btn.closest('[data-name]');
        if (card && card.dataset.productId) {
          btn.classList.toggle('wished', savedIds.includes(card.dataset.productId));
        }
      });

      if (!wishlistItems) return;

      // Clear previous rows (keep empty message)
      wishlistItems.querySelectorAll('.cart-item').forEach(el => el.remove());

      if (items.length === 0) {
        if (wishlistEmpty) wishlistEmpty.style.display = '';
        return;
      }
      if (wishlistEmpty) wishlistEmpty.style.display = 'none';

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
            <span class="cart-item-price">$${parseFloat(item.price).toFixed(2)}${item.old_price ? ` <s>$${parseFloat(item.old_price).toFixed(2)}</s>` : ''}</span>
          </div>
          <div class="cart-item-actions">
            <button class="cart-remove" data-id="${item.product_id}" aria-label="Remove from wishlist">
              <i class="ti ti-trash" aria-hidden="true"></i>
            </button>
          </div>
        `;
        wishlistItems.appendChild(row);
      });

      wishlistItems.querySelectorAll('.cart-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
          await fetch(`${API}/wishlist/${btn.dataset.id}`, { method: 'DELETE', credentials: 'include' });
          loadWishlist();
        });
      });
    } catch (err) {
      console.error('Wishlist load error:', err);
    }
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
        // Refresh badge, and the panel's rows if it's open
        loadWishlist();
      } catch (err) {
        console.error('Wishlist error:', err);
      }
    });
  });

  updateWishlistBadge();
  document.addEventListener('wishlist:changed', loadWishlist);
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

  // Support linking straight into a search result, e.g. shop.html?q=Red%20Erasing%20Serum
  const params = new URLSearchParams(window.location.search);
  const requestedQ = params.get('q');
  if (requestedQ) {
    input.value = requestedQ;
    filterPageCards(requestedQ);
  }
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
   QUICK VIEW — product details modal
───────────────────────────────────────────────────────── */
function initQuickView() {
  const overlay   = document.getElementById('qvOverlay');
  const modal     = document.getElementById('qvModal');
  const closeBtn  = document.getElementById('qvClose');
  if (!overlay || !modal) return;

  const qvImg     = document.getElementById('qvImg');
  const qvName    = document.getElementById('qvName');
  const qvStars   = document.getElementById('qvStars');
  const qvPrice   = document.getElementById('qvPrice');
  const qvDesc    = document.getElementById('qvDesc');
  const qvQtyNum  = document.getElementById('qvQtyNum');
  const qvDec     = document.getElementById('qvDec');
  const qvInc     = document.getElementById('qvInc');
  const qvAddCart = document.getElementById('qvAddCart');
  const qvWish    = document.getElementById('qvWish');

  const descByCategory = {
    serums:       'A lightweight, fast-absorbing serum formulated to target visible concerns with consistent daily use — layer it under your moisturizer morning or night.',
    moisturizers: 'A nourishing daily moisturizer that locks in hydration and strengthens your skin barrier, leaving skin soft, plump and comfortable.',
    devices:      'A dermatologist-tested at-home device designed to deliver clinic-level results with just a few minutes of use per day.',
    cleansers:    'A gentle, low-pH cleanser that lifts away impurities and makeup without stripping the skin, leaving it clean and balanced.',
    pads:         'Pre-soaked pads that make toning, exfoliating or hydrating as easy as one swipe — a simple addition to any routine.',
    sets:         'A curated Medicube bundle designed to work together for a complete routine — better value, better results.',
  };

  let activeCard = null;
  let qty = 1;

  function openModal(card) {
    activeCard = card;
    qty = 1;
    qvQtyNum.textContent = qty;

    const name     = card.dataset.name || card.querySelector('.prod-name')?.textContent.trim() || '';
    const category = card.dataset.category;
    const imgEl    = card.querySelector('.product-img img');
    const imgWrap  = card.querySelector('.product-img');
    const starsHTML = card.querySelector('.prod-stars')?.innerHTML || '';
    const priceHTML = card.querySelector('.prod-price')?.innerHTML || (card.dataset.price ? `$${card.dataset.price}` : '');
    const badgeEl  = card.querySelector('.prod-badge');
    const wished   = card.querySelector('.wish-btn')?.classList.contains('wished');

    qvName.textContent = name;
    qvStars.innerHTML  = starsHTML;
    qvPrice.innerHTML  = priceHTML;
    qvDesc.textContent = descByCategory[category] || 'A Medicube favorite, formulated for visible results with regular use.';

    // image + background swatch to match the card
    qvImg.className = 'qv-img';
    if (imgWrap) {
      const swatch = [...imgWrap.classList].find(c => c.startsWith('pi'));
      if (swatch) qvImg.classList.add(swatch);
    }
    qvImg.innerHTML = '';
    if (imgEl) {
      const img = document.createElement('img');
      img.src = imgEl.getAttribute('src');
      img.alt = name;
      qvImg.appendChild(img);
    } else {
      qvImg.innerHTML = '<i class="ti ti-photo" aria-hidden="true"></i>';
    }
    if (badgeEl) {
      const badge = badgeEl.cloneNode(true);
      badge.classList.add('qv-badge');
      qvImg.appendChild(badge);
    }

    qvWish.classList.toggle('wished', !!wished);

    overlay.classList.add('open');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    overlay.classList.remove('open');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    activeCard = null;
  }

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.wish-btn') || e.target.closest('.add-cart')) return;
      openModal(card);
    });
  });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  qvDec.addEventListener('click', () => { qty = Math.max(1, qty - 1); qvQtyNum.textContent = qty; });
  qvInc.addEventListener('click', () => { qty = qty + 1; qvQtyNum.textContent = qty; });

  qvAddCart.addEventListener('click', async () => {
    if (!window.currentUser) {
      document.dispatchEvent(new CustomEvent('auth:required'));
      return;
    }
    if (!activeCard) return;
    const productName = activeCard.dataset.name || activeCard.querySelector('.prod-name')?.textContent.trim();
    if (!productName) return;

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
        body:        JSON.stringify({ product_id, quantity: qty }),
      });
      const addJson = await addRes.json();
      if (addJson.success) {
        showToast(`${productName} added to cart`);
        // Dispatch a custom event so initCart's loadCart() (in closure scope) can refresh
        document.dispatchEvent(new CustomEvent('cart:changed'));
        closeModal();
      } else {
        showToast(addJson.message || 'Could not add to cart', 'error');
      }
    } catch (err) {
      showToast('Could not add to cart', 'error');
      console.error(err);
    }
  });

  // Delegate to the underlying card's own wishlist button so state stays in sync
  qvWish.addEventListener('click', () => {
    if (!activeCard) return;
    const cardWishBtn = activeCard.querySelector('.wish-btn');
    if (cardWishBtn) {
      cardWishBtn.click();
      qvWish.classList.toggle('wished', cardWishBtn.classList.contains('wished'));
    }
  });
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
document.addEventListener('DOMContentLoaded', async () => {
  initSlider();
  initAuth();
  await renderShopProducts(); // cards must exist in the DOM before the lines below attach listeners to them
  initCart();
  initWishlist();
  initSearch();
  initFilters();
  initNavToggle();
  initQuickView();
});