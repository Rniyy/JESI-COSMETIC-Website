/* JESI-COSMETIC — reviews page (uses API / assetUrl from script.js) */
(function () {
  const PAGE_SIZE = 10;
  const state = { rating: '', product: '', sort: 'new', page: 1, loading: false };

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = n => '★'.repeat(n) + `<span class="off">${'★'.repeat(5 - n)}</span>`;
  const fmtDate = d => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };

  function renderSummary(s) {
    const max = Math.max(1, ...Object.values(s.distribution));
    $('rvSummary').innerHTML = `
      <div class="rv-avg"><span class="rv-avg-num">${s.count ? s.average.toFixed(1) : '–'}</span><span class="rv-avg-of">out of 5</span></div>
      <div class="rv-stars" aria-hidden="true">${stars(Math.round(s.average))}</div>
      <div class="rv-count">${s.count} review${s.count === 1 ? '' : 's'}</div>
      <div class="rv-bars">
        ${[5, 4, 3, 2, 1].map(n => `
          <button type="button" class="rv-bar ${String(state.rating) === String(n) ? 'active' : ''}" data-rating="${n}" aria-label="Show ${n}-star reviews">
            <span>${n} ★</span>
            <span class="rv-bar-track"><span class="rv-bar-fill" style="width:${(s.distribution[n] / max) * 100}%"></span></span>
            <span class="rv-bar-n">${s.distribution[n]}</span>
          </button>`).join('')}
      </div>`;
    $('rvSummary').querySelectorAll('.rv-bar').forEach(b => b.addEventListener('click', () => {
      state.rating = String(state.rating) === b.dataset.rating ? '' : b.dataset.rating;
      $('rvRating').value = state.rating;
      load(true);
    }));
  }

  function renderProducts(products) {
    const sel = $('rvProduct');
    if (sel.dataset.filled) return;
    sel.dataset.filled = '1';
    sel.innerHTML = '<option value="">All products</option>' +
      products.map(p => `<option value="${p.id}">${esc(p.name)} (${p.review_count})</option>`).join('');
  }

  function cardHtml(r) {
    const media = (r.media || []).map(m => {
      const u = assetUrl(m.url);
      return m.media_type === 'video'
        ? `<video src="${esc(u)}" controls preload="metadata"></video>`
        : `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Review photo" loading="lazy"></a>`;
    }).join('');
    const name = r.reviewer_first_name || 'Customer';
    return `
      <article class="rv-card">
        <div class="rv-card-top">
          <div class="rv-avatar">${esc(name.charAt(0))}</div>
          <div class="rv-who"><div class="rv-name">${esc(name)}</div><div class="rv-date">${esc(fmtDate(r.created_at))}</div></div>
          <div class="rv-stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</div>
        </div>
        ${r.product_name ? `<div class="rv-product">${r.product_image ? `<img src="${esc(assetUrl(r.product_image))}" alt="">` : ''}<span>${esc(r.product_name)}</span></div>` : ''}
        ${r.comment ? `<p class="rv-comment">${esc(r.comment)}</p>` : '<p class="rv-comment muted">Rated without a written comment.</p>'}
        ${media ? `<div class="rv-media">${media}</div>` : ''}
      </article>`;
  }

  async function load(reset) {
    if (state.loading) return;
    state.loading = true;
    if (reset) state.page = 1;
    const list = $('rvList');
    const more = $('rvMore');
    if (reset) list.innerHTML = '<div class="rv-empty">Loading reviews…</div>';
    more.disabled = true;

    try {
      const qs = new URLSearchParams({ page: state.page, limit: PAGE_SIZE, sort: state.sort });
      if (state.rating)  qs.set('rating', state.rating);
      if (state.product) qs.set('product_id', state.product);
      const res  = await fetch(`${API}/reviews?${qs}`, { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      renderSummary(json.summary);
      renderProducts(json.products);

      if (reset) list.innerHTML = '';
      if (json.data.length === 0 && state.page === 1) {
        list.innerHTML = `<div class="rv-empty"><i class="ti ti-message-2-star"></i>${
          state.rating || state.product ? 'No reviews match these filters.' : 'No reviews yet — be the first after your order arrives!'}</div>`;
      } else {
        list.insertAdjacentHTML('beforeend', json.data.map(cardHtml).join(''));
      }
      $('rvResultCount').textContent = '';
      more.style.display = json.hasMore ? '' : 'none';
      const filtered = state.rating || state.product;
      $('rvClear').style.display = filtered ? '' : 'none';
    } catch (err) {
      console.error(err);
      if (reset) list.innerHTML = '<div class="rv-empty">Could not load reviews — check your connection and try again.</div>';
      more.style.display = 'none';
    } finally {
      state.loading = false;
      more.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('rvList')) return;
    $('rvRating').addEventListener('change', e => { state.rating = e.target.value; load(true); });
    $('rvProduct').addEventListener('change', e => { state.product = e.target.value; load(true); });
    $('rvSort').addEventListener('change', e => { state.sort = e.target.value; load(true); });
    $('rvClear').addEventListener('click', () => {
      state.rating = ''; state.product = '';
      $('rvRating').value = ''; $('rvProduct').value = '';
      load(true);
    });
    $('rvMore').addEventListener('click', () => { state.page += 1; load(false); });
    load(true);
  });
})();
