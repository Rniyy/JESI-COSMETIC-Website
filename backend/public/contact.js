/* JESI-COSMETIC — contact page (uses API from script.js) */
(function () {
  const $ = id => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('contactForm');
    if (!form) return;

    const msg = $('ctMessage');
    const counter = $('ctCount');
    const errBox = $('ctError');
    const btn = $('ctSubmit');
    const MAX = 2000;

    msg.addEventListener('input', () => { counter.textContent = `${msg.value.length} / ${MAX}`; });

    // Pre-fill name/email for logged-in customers (script.js sets window.currentUser a moment after load)
    setTimeout(() => {
      const u = window.currentUser;
      if (u && !$('ctName').value && !$('ctEmail').value) {
        $('ctName').value = u.name || '';
        $('ctEmail').value = u.email || '';
      }
    }, 900);

    function showError(text) { errBox.textContent = text; errBox.style.display = 'block'; }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';

      const body = {
        name:    $('ctName').value.trim(),
        email:   $('ctEmail').value.trim(),
        subject: $('ctSubject').value,
        message: msg.value.trim(),
        website: $('ctWebsite').value,   // honeypot — stays empty for real visitors
      };
      if (body.name.length < 2)  return showError('Please enter your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) return showError('Please enter a valid email address.');
      if (!body.subject)         return showError('Please choose a subject.');
      if (body.message.length < 10) return showError('Please write a little more (at least 10 characters).');

      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = 'Sending…';
      try {
        const res  = await fetch(`${API}/contact`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!json.success) { showError(json.message || 'Could not send your message.'); return; }

        form.style.display = 'none';
        $('ctSuccessText').textContent = json.message;
        $('ctSuccess').style.display = 'block';
      } catch (err) {
        console.error(err);
        showError('Could not reach the server — please try again.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = label;
      }
    });

    $('ctAgain').addEventListener('click', () => {
      form.reset();
      counter.textContent = `0 / ${MAX}`;
      $('ctSuccess').style.display = 'none';
      form.style.display = 'flex';
    });
  });
})();
