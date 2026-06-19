

document.addEventListener('DOMContentLoaded', () => {
  const hero = document.getElementById('hero');
  if (!hero) return;

  let current = 0;
  let timer;

  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const counter = document.getElementById('counter');
  const prog = document.getElementById('prog');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');

  const total = slides.length;
  const counts = [];
  for (let i = 1; i <= total; i++) {
    counts.push(String(i).padStart(2, '0') + ' — ' + String(total).padStart(2, '0'));
  }


  const dotColors = ['#c09080', '#5a8a64', '#5860a0', '#a09060'];
  const progColors = ['#c09080', '#5a8a64', '#5860a0', '#a09060'];

  function goTo(n) {
    slides[current].classList.remove('active');
    if (dots[current]) {
      dots[current].classList.remove('active');
      dots[current].style.background = '';
    }
    current = (n + total) % total;
    slides[current].classList.add('active');
    if (dots[current]) {
      dots[current].classList.add('active');
      dots[current].style.background = dotColors[current % dotColors.length];
    }
    if (counter) counter.textContent = counts[current];
    if (prog) {
      prog.style.background = progColors[current % progColors.length];
      prog.classList.remove('go');
      void prog.offsetWidth; 
      prog.classList.add('go');
    }
  }

  function start() {
    timer = setInterval(() => goTo(current + 1), 2000);
  }
  function reset() {
    clearInterval(timer);
    start();
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goTo(i);
      reset();
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', () => { goTo(current - 1); reset(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { goTo(current + 1); reset(); });

  start();
});


document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.add-cart, .add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 300);
    });
  });

  document.querySelectorAll('.wish-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('[data-category]');

  if (filterBtns.length && cards.length) {
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        cards.forEach((card) => {
          if (filter === 'all' || card.dataset.category === filter) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }
});