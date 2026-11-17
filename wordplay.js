/* Title letters never get replaced; other text experiments keep their layers. */
(() => {
  'use strict';
  const titles = [...document.querySelectorAll('[data-wordplay]')];
  if (!titles.length) return;
  // Observe each bilingual pair together so Korean and English keep one clock.
  const groups = [...new Set(titles.map(title => title.closest('.section-heading') || title))];
  const inView = new Set();
  const updatePaused = group => {
    const paused = String(document.hidden || !inView.has(group));
    const members = group.matches('[data-wordplay]') ? [group] : group.querySelectorAll('[data-wordplay]');
    members.forEach(title => { title.dataset.wordplayPaused = paused; });
  };
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) inView.add(entry.target);
      else inView.delete(entry.target);
      updatePaused(entry.target);
    });
  }, { rootMargin: '120px' }) : null;
  groups.forEach(group => {
    if (observer) observer.observe(group);
    else inView.add(group);
  });
  document.addEventListener('visibilitychange', () => groups.forEach(updatePaused));

  titles.forEach(title => {
    const button = title.querySelector('.wordplay-reveal');
    if (!button) return;
    let pinned = false;
    const reveal = value => {
      button.dataset.selfOpen = String(value);
      button.setAttribute('aria-expanded', String(value));
    };
    button.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') reveal(true);
    });
    button.addEventListener('pointerleave', () => { if (!pinned) reveal(false); });
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) reveal(true); });
    button.addEventListener('blur', () => { if (!pinned) reveal(false); });
    button.addEventListener('click', () => { pinned = !pinned; reveal(pinned); });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      pinned = false;
      reveal(false);
      event.stopPropagation();
    });
  });
})();
