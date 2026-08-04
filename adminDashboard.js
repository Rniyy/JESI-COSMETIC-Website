const API = 'http://localhost:3000/api';

let allProducts = [];
let allOrders    = [];
let allUsers     = [];
let currentAdminId = null;
let revenueChartInstance = null;
let unitsChartInstance   = null;

/* ─────────────────────────────────────────────────────────
   ACCESS GATE — redirect anyone who isn't an admin
───────────────────────────────────────────────────────── */
async function checkAdminAccess() {
  try {
    const res  = await fetch(`${API}/auth/me`, { credentials: 'include' });
    const json = await res.json();

    if (!json.success || !json.data) {
      window.location.href = 'shop.html';
      return false;
    }
    if (json.data.role !== 'admin') {
      window.location.href = 'shop.html';
      return false;
    }
    currentAdminId = json.data.id;
    return true;
  } catch (err) {
    console.error('Admin access check failed:', err);
    window.location.href = 'shop.html';
    return false;
  }
}

/* ─────────────────────────────────────────────────────────
   NAV — switch between Products / Users views
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   ANALYTICS
───────────────────────────────────────────────────────── */
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

function deltaHTML(current, previous, formatter = (n) => n) {
  if (previous === 0 && current === 0) {
    return `<div class="analytics-summary-delta flat">No data last year</div>`;
  }
  if (previous === 0) {
    return `<div class="analytics-summary-delta up">▲ New this year</div>`;
  }
  const pct = ((current - previous) / previous) * 100;
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '—';
  return `<div class="analytics-summary-delta ${cls}">${arrow} ${Math.abs(pct).toFixed(0)}% vs ${formatter}</div>`;
}

async function loadAnalyticsYears() {
  const select = document.getElementById('analyticsYearSelect');
  try {
    const res  = await fetch(`${API}/admin/analytics/years`, { credentials: 'include' });
    const json = await res.json();
    const years = json.success ? json.data : [new Date().getFullYear()];

    select.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
    select.value = years[0];
  } catch (err) {
    console.error('Failed to load years:', err);
  }
}

async function loadAnalyticsData(year) {
  try {
    const [summaryRes, monthlyRes, topRes] = await Promise.all([
      fetch(`${API}/admin/analytics/summary?year=${year}`, { credentials: 'include' }),
      fetch(`${API}/admin/analytics/monthly?year=${year}`, { credentials: 'include' }),
      fetch(`${API}/admin/analytics/top-products?year=${year}&limit=5`, { credentials: 'include' }),
    ]);
    const summary  = await summaryRes.json();
    const monthly  = await monthlyRes.json();
    const topItems = await topRes.json();

    if (summary.success)  renderSummaryCards(summary.data);
    if (monthly.success)  renderCharts(monthly.data);
    if (topItems.success) renderTopProducts(topItems.data);
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

function renderSummaryCards(data) {
  const { current, previous } = data;
  const row = document.getElementById('analyticsSummaryRow');
  const avgOrder = current.order_count > 0 ? current.revenue / current.order_count : 0;
  const avgOrderPrev = previous.order_count > 0 ? previous.revenue / previous.order_count : 0;

  row.innerHTML = `
    <div class="analytics-summary-card">
      <div class="analytics-summary-label">Revenue</div>
      <div class="analytics-summary-value">${formatMoney(current.revenue)}</div>
      ${deltaHTML(Number(current.revenue), Number(previous.revenue), 'last year')}
    </div>
    <div class="analytics-summary-card">
      <div class="analytics-summary-label">Units Sold</div>
      <div class="analytics-summary-value">${current.items_sold}</div>
      ${deltaHTML(Number(current.items_sold), Number(previous.items_sold), 'last year')}
    </div>
    <div class="analytics-summary-card">
      <div class="analytics-summary-label">Orders</div>
      <div class="analytics-summary-value">${current.order_count}</div>
      ${deltaHTML(Number(current.order_count), Number(previous.order_count), 'last year')}
    </div>
    <div class="analytics-summary-card">
      <div class="analytics-summary-label">Avg. Order Value</div>
      <div class="analytics-summary-value">${formatMoney(avgOrder)}</div>
      ${deltaHTML(avgOrder, avgOrderPrev, 'last year')}
    </div>
  `;
}

function renderCharts(monthlyData) {
  const revenueCtx = document.getElementById('revenueChart');
  const unitsCtx    = document.getElementById('unitsChart');

  if (revenueChartInstance) revenueChartInstance.destroy();
  if (unitsChartInstance)   unitsChartInstance.destroy();

  const labels  = monthlyData.map(m => MONTH_LABELS[m.month - 1]);
  const revenue = monthlyData.map(m => Number(m.revenue));
  const units   = monthlyData.map(m => Number(m.items_sold));

  revenueChartInstance = new Chart(revenueCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Revenue ($)', data: revenue, backgroundColor: '#dda297', borderRadius: 5 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } } },
    },
  });

  unitsChartInstance = new Chart(unitsCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Units Sold', data: units, backgroundColor: '#7fa8c9', borderRadius: 5 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

function renderTopProducts(products) {
  const tbody = document.getElementById('topProductsTableBody');
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#a08e88; padding:24px;">No sales yet this year.</td></tr>';
    return;
  }
  tbody.innerHTML = products.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.name}</td>
      <td>${p.units_sold}</td>
      <td>${formatMoney(p.revenue)}</td>
    </tr>
  `).join('');
}

async function initAnalytics() {
  await loadAnalyticsYears();
  const select = document.getElementById('analyticsYearSelect');
  loadAnalyticsData(select.value);
  select.addEventListener('change', () => loadAnalyticsData(select.value));
}

function initNav() {
  const navBtns = document.querySelectorAll('.admin-nav-btn');
  let analyticsLoaded = false;
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      document.getElementById(`view-${btn.dataset.view}`).style.display = 'block';

      if (btn.dataset.view === 'analytics' && !analyticsLoaded) {
        analyticsLoaded = true;
        initAnalytics();
      }
    });
  });

  document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = 'shop.html';
  });
}

/* ─────────────────────────────────────────────────────────
   PRODUCTS
───────────────────────────────────────────────────────── */
async function loadProducts() {
  try {
    const res  = await fetch(`${API}/admin/products`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    allProducts = json.data;
    renderProductsTable();
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = '';

  allProducts.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.image_url ? `<img class="admin-table-thumb" src="${p.image_url}" alt="${p.name}">` : '<div class="admin-table-thumb"></div>'}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>$${Number(p.price).toFixed(2)}</td>
      <td>${p.in_stock ? `<span class="admin-badge-pill">${p.stock_quantity} in stock</span>` : '<span class="admin-badge-pill out-of-stock">Out of stock</span>'}</td>
      <td>${p.badge ? `<span class="admin-badge-pill">${p.badge}</span>` : ''}</td>
      <td>
        <div class="admin-row-actions">
          <button class="admin-icon-btn edit" data-id="${p.id}">Edit</button>
          <button class="admin-icon-btn delete" data-id="${p.id}">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteProduct(Number(btn.dataset.id)));
  });
}

function openProductModal(productId = null) {
  const overlay = document.getElementById('productModalOverlay');
  const title    = document.getElementById('productModalTitle');
  const form     = document.getElementById('productForm');
  const errorEl  = document.getElementById('productFormError');
  errorEl.style.display = 'none';
  form.reset();

  if (productId) {
    const p = allProducts.find(x => x.id === productId);
    if (!p) return;
    title.textContent = 'Edit product';
    document.getElementById('productId').value          = p.id;
    document.getElementById('productName').value         = p.name;
    document.getElementById('productCategory').value     = p.category;
    document.getElementById('productBrand').value        = p.brand || 'Medicube';
    document.getElementById('productPrice').value        = p.price;
    document.getElementById('productOldPrice').value     = p.old_price || '';
    document.getElementById('productImageUrl').value     = p.image_url || '';
    document.getElementById('productImageClass').value   = p.image_class || 'pi1';
    document.getElementById('productRating').value       = p.rating || '';
    document.getElementById('productReviewCount').value  = p.review_count || '';
    document.getElementById('productBadge').value        = p.badge || '';
    document.getElementById('productStockQuantity').value = p.stock_quantity != null ? p.stock_quantity : 0;
    document.getElementById('productDescription').value  = p.description || '';
  } else {
    title.textContent = 'Add product';
    document.getElementById('productId').value = '';
  }

  overlay.classList.add('open');
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('open');
}

async function saveProduct(e) {
  e.preventDefault();
  const errorEl = document.getElementById('productFormError');
  errorEl.style.display = 'none';

  const id = document.getElementById('productId').value;
  const payload = {
    name:          document.getElementById('productName').value.trim(),
    category:      document.getElementById('productCategory').value,
    brand:         document.getElementById('productBrand').value.trim(),
    price:         parseFloat(document.getElementById('productPrice').value),
    old_price:     document.getElementById('productOldPrice').value ? parseFloat(document.getElementById('productOldPrice').value) : null,
    image_url:     document.getElementById('productImageUrl').value.trim(),
    image_class:   document.getElementById('productImageClass').value,
    rating:        document.getElementById('productRating').value ? parseFloat(document.getElementById('productRating').value) : null,
    review_count:  document.getElementById('productReviewCount').value.trim(),
    badge:         document.getElementById('productBadge').value || null,
    description:   document.getElementById('productDescription').value.trim(),
    stock_quantity: parseInt(document.getElementById('productStockQuantity').value, 10) || 0,
  };

  try {
    const res = id
      ? await fetch(`${API}/admin/products/${id}`, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch(`${API}/admin/products`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    const json = await res.json();
    if (!json.success) {
      errorEl.textContent   = json.message || 'Could not save product';
      errorEl.style.display = 'block';
      return;
    }

    closeProductModal();
    loadProducts();
  } catch (err) {
    errorEl.textContent   = 'Something went wrong — try again';
    errorEl.style.display = 'block';
    console.error(err);
  }
}

async function deleteProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!confirm(`Delete "${product ? product.name : 'this product'}"? This can't be undone.`)) return;

  try {
    const res  = await fetch(`${API}/admin/products/${id}`, { method: 'DELETE', credentials: 'include' });
    const json = await res.json();
    if (!json.success) {
      alert(json.message || 'Could not delete product');
      return;
    }
    loadProducts();
  } catch (err) {
    console.error(err);
    alert('Something went wrong deleting this product');
  }
}

function initProductModal() {
  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
  document.getElementById('productModalClose').addEventListener('click', closeProductModal);
  document.getElementById('productCancelBtn').addEventListener('click', closeProductModal);
  document.getElementById('productModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'productModalOverlay') closeProductModal();
  });
  document.getElementById('productForm').addEventListener('submit', saveProduct);
}

/* ─────────────────────────────────────────────────────────
   USERS
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   ORDERS
───────────────────────────────────────────────────────── */
async function loadOrders() {
  try {
    const q         = document.getElementById('orderSearchInput')?.value.trim();
    const dateFrom  = document.getElementById('orderDateFrom')?.value;
    const dateTo    = document.getElementById('orderDateTo')?.value;
    const status    = document.getElementById('orderStatusFilter')?.value;

    const params = new URLSearchParams();
    if (q)        params.set('q', q);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to', dateTo);
    if (status)   params.set('status', status);

    const res  = await fetch(`${API}/admin/orders?${params.toString()}`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    allOrders = json.data;
    renderOrdersTable();
  } catch (err) {
    console.error('Failed to load orders:', err);
  }
}

function initOrderFilters() {
  const searchInput = document.getElementById('orderSearchInput');
  const dateFrom     = document.getElementById('orderDateFrom');
  const dateTo       = document.getElementById('orderDateTo');
  const statusFilter = document.getElementById('orderStatusFilter');
  const clearBtn      = document.getElementById('orderFiltersClearBtn');

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadOrders, 300);
  });
  [dateFrom, dateTo, statusFilter].forEach(el => {
    el.addEventListener('change', loadOrders);
  });
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    dateFrom.value = '';
    dateTo.value = '';
    statusFilter.value = '';
    loadOrders();
  });
}

const STATUS_LABELS = {
  to_pay:     'To Pay',
  to_receive: 'To Receive',
  to_review:  'To Review',
  completed:  'Completed',
  cancelled:  'Cancelled',
};

function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = '';

  if (allOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#a08e88; padding:24px;">No orders placed yet.</td></tr>';
    return;
  }

  allOrders.forEach(o => {
    const tr = document.createElement('tr');
    const placedDate = new Date(o.placed_at).toLocaleDateString();
    tr.innerHTML = `
      <td>#${o.id}</td>
      <td>${o.customer_name}<br><span style="color:#a08e88; font-size:12px;">${o.customer_email}</span></td>
      <td>${o.item_count}</td>
      <td>$${Number(o.total).toFixed(2)}</td>
      <td><span class="admin-badge-pill">${STATUS_LABELS[o.status] || o.status}</span></td>
      <td>${placedDate}</td>
      <td><button class="admin-icon-btn edit" data-id="${o.id}">View</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', () => openOrderModal(Number(btn.dataset.id)));
  });
}

async function openOrderModal(orderId) {
  const overlay = document.getElementById('orderModalOverlay');
  const bodyEl  = document.getElementById('orderModalBody');
  const idEl    = document.getElementById('orderModalId');
  const statusSelect = document.getElementById('orderStatusSelect');

  idEl.textContent = orderId;
  bodyEl.innerHTML = '<p>Loading…</p>';
  overlay.classList.add('open');

  try {
    const res  = await fetch(`${API}/admin/orders/${orderId}`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const o = json.data;
    statusSelect.value = o.status;

    const itemsHTML = o.items.map(i => `
      <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;">
        <span>${i.product_name} × ${i.quantity}</span>
        <span>$${(Number(i.product_price) * i.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    bodyEl.innerHTML = `
      <p style="font-size:13px; color:#6b5b56; margin:0 0 12px;">
        <strong>${o.customer_name}</strong> (${o.customer_email})<br>
        ${o.full_name ? `${o.full_name}, ${o.line1}${o.line2 ? ', ' + o.line2 : ''}, ${o.city}${o.state_province ? ', ' + o.state_province : ''} ${o.postal_code || ''}, ${o.country}` : 'No address on file'}
      </p>
      <div style="border-top:1px solid #f0e4de; border-bottom:1px solid #f0e4de; padding:8px 0; margin-bottom:12px;">
        ${itemsHTML}
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; color:#6b5b56;">
        <span>Subtotal</span><span>$${Number(o.subtotal).toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; color:#6b5b56; margin-bottom:8px;">
        <span>Shipping</span><span>$${Number(o.shipping_fee).toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-weight:700; color:#3a2e2b;">
        <span>Total</span><span>$${Number(o.total).toFixed(2)}</span>
      </div>
    `;

    document.getElementById('orderStatusSaveBtn').onclick = () => updateOrderStatus(orderId, statusSelect.value);
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = '<p>Could not load this order.</p>';
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    const res  = await fetch(`${API}/admin/orders/${orderId}/status`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.success) {
      alert(json.message || 'Could not update status');
      return;
    }
    document.getElementById('orderModalOverlay').classList.remove('open');
    loadOrders();
  } catch (err) {
    console.error(err);
    alert('Something went wrong updating this order');
  }
}

function initOrderModal() {
  document.getElementById('orderModalClose').addEventListener('click', () => {
    document.getElementById('orderModalOverlay').classList.remove('open');
  });
  document.getElementById('orderModalCancelBtn').addEventListener('click', () => {
    document.getElementById('orderModalOverlay').classList.remove('open');
  });
  document.getElementById('orderModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'orderModalOverlay') e.target.classList.remove('open');
  });
}

/* ─────────────────────────────────────────────────────────
   USERS
───────────────────────────────────────────────────────── */
async function loadUsers() {
  try {
    const res  = await fetch(`${API}/admin/users`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    allUsers = json.data;
    renderUsersTable();
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  allUsers.forEach(u => {
    const isSelf   = u.id === currentAdminId;
    const joinedAt = new Date(u.created_at).toLocaleDateString();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.name}${isSelf ? ' <span style="color:#a08e88;font-size:12px;">(you)</span>' : ''}</td>
      <td>${u.email}</td>
      <td>${u.role === 'admin' ? '<span class="admin-badge-pill role-admin">Admin</span>' : '<span class="admin-badge-pill">User</span>'}</td>
      <td>${joinedAt}</td>
      <td>
        <div class="admin-row-actions">
          ${!isSelf ? `<button class="admin-icon-btn promote" data-id="${u.id}" data-role="${u.role === 'admin' ? 'user' : 'admin'}">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>` : ''}
          ${!isSelf ? `<button class="admin-icon-btn delete" data-id="${u.id}">Delete</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.promote').forEach(btn => {
    btn.addEventListener('click', () => changeUserRole(Number(btn.dataset.id), btn.dataset.role));
  });
  tbody.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteUser(Number(btn.dataset.id)));
  });
}

async function changeUserRole(id, role) {
  try {
    const res  = await fetch(`${API}/admin/users/${id}/role`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!json.success) {
      alert(json.message || 'Could not update role');
      return;
    }
    loadUsers();
  } catch (err) {
    console.error(err);
    alert('Something went wrong updating this user');
  }
}

async function deleteUser(id) {
  const user = allUsers.find(u => u.id === id);
  if (!confirm(`Delete the account for "${user ? user.email : 'this user'}"? This can't be undone.`)) return;

  try {
    const res  = await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
    const json = await res.json();
    if (!json.success) {
      alert(json.message || 'Could not delete user');
      return;
    }
    loadUsers();
  } catch (err) {
    console.error(err);
    alert('Something went wrong deleting this user');
  }
}

/* ─────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAdminAccess();
  if (!ok) return;

  document.getElementById('adminGate').style.display   = 'none';
  document.getElementById('adminContent').style.display = 'block';

  initNav();
  initProductModal();
  initOrderModal();
  initOrderFilters();
  loadProducts();
  loadOrders();
  loadUsers();
});