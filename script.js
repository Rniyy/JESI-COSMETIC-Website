let current = 0;
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');

    function goTo(n) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = (n + slides.length) % slides.length;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }

    // Auto-swap every 2 seconds
    let timer = setInterval(() => goTo(current + 1), 3000);

    // Click dots to jump
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        clearInterval(timer);
        goTo(i);
        timer = setInterval(() => goTo(current + 1), 3000);
      });
    });