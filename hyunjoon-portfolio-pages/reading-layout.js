/* Each letter travels between the two reading compositions; text and wear stay live. */
(() => {
  'use strict';

  const body = document.body;
  const essay = document.getElementById('essay');
  const controls = [...document.querySelectorAll('[data-reading-language-button]')];
  const status = document.getElementById('reading-status');
  const storageKey = 'portfolio-reading-language';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const valid = value => value === 'ko' || value === 'en';
  const transitionDuration = 3000;
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const running = new Map();
  let endTimer = 0;
  let previousOverflowAnchor = null;
  let moving = false;

  if (!essay || !controls.length) return;

  function notify(phase, duration = 0) {
    essay.dispatchEvent(new CustomEvent('essay:layoutchange', {
      bubbles: true, detail: { language: body.dataset.readingLanguage, phase, duration }
    }));
  }

  function updateControls(language) {
    controls.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.readingLanguageButton === language)));
  }

  function graphemes(text) {
    if (segmenter) return [...segmenter.segment(text)].map(part => ({ text: part.segment, index: part.index }));
    let index = 0;
    return Array.from(text).map(character => { const part = { text: character, index }; index += character.length; return part; });
  }

  function prepareStaticLetters() {
    // Body letters already belong to BANANA. Only split the remaining name,
    // heading and link text, preserving each word's native wrapping and kerning.
    const roots = [...document.querySelectorAll('.name-ko, .name-en, .copy-cell')];
    roots.forEach(root => {
      const nodes = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue?.trim() || node.parentElement.closest('.fx-run,.reading-run,.reading-glyph,.sr-only,script,style')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const text = node.nodeValue;
        const fontSize = parseFloat(getComputedStyle(node.parentElement).fontSize) || 16;
        const parts = graphemes(text);
        const range = document.createRange();
        // Measure before replacing any character. Fixed em advances retain the
        // font's original pair spacing, including the large English name.
        parts.forEach(part => {
          range.setStart(node, part.index);
          range.setEnd(node, part.index + part.text.length);
          part.advance = range.getBoundingClientRect().width / fontSize;
        });
        const run = document.createElement('span');
        run.className = 'reading-run';
        const readable = document.createElement('span');
        readable.className = 'sr-only';
        readable.textContent = text;
        const visual = document.createElement('span');
        visual.setAttribute('aria-hidden', 'true');
        run.append(readable, visual);
        let word = null;
        parts.forEach(part => {
          if (/^\s+$/u.test(part.text)) {
            visual.append(document.createTextNode(part.text));
            word = null;
            return;
          }
          if (!word) {
            word = document.createElement('span');
            word.style.cssText = 'display:inline-block;white-space:nowrap;max-width:100%';
            visual.append(word);
          }
          const glyph = document.createElement('span');
          glyph.className = 'reading-glyph';
          glyph.textContent = part.text;
          glyph.style.display = 'inline-block';
          if (part.advance > 0) glyph.style.width = `${part.advance}em`;
          word.append(glyph);
        });
        node.replaceWith(run);
      });
    });
  }

  function readingAnchor() {
    if (window.scrollY < 40) return null;
    const line = window.innerHeight * .48;
    let best = null;
    let distance = Infinity;
    essay.querySelectorAll('.copy-row, .section-heading').forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight || !rect.height) return;
      const gap = rect.top > line ? rect.top - line : rect.bottom < line ? line - rect.bottom : 0;
      if (gap >= distance) return;
      distance = gap;
      const viewportY = Math.max(rect.top, Math.min(line, rect.bottom));
      best = { element, viewportY, progress: (viewportY - rect.top) / rect.height };
    });
    return best;
  }

  function restoreAnchor(anchor) {
    if (!anchor?.element.isConnected) return;
    const rect = anchor.element.getBoundingClientRect();
    const y = window.scrollY + rect.top + rect.height * anchor.progress - anchor.viewportY;
    window.scrollTo({ left: window.scrollX, top: Math.max(0, y), behavior: 'instant' });
  }

  function nearViewport(rect) {
    const margin = 100;
    return rect.width > 0 && rect.height > 0 && rect.bottom > -margin && rect.top < window.innerHeight + margin;
  }

  function cancelLetters() {
    running.forEach(({ animation, origin }, element) => {
      animation.cancel();
      element.style.transformOrigin = origin;
    });
    running.clear();
  }

  function finish() {
    clearTimeout(endTimer);
    cancelLetters();
    if (!moving) return;
    moving = false;
    body.classList.remove('is-language-switching');
    body.dataset.movingLetters = '0';
    document.documentElement.style.overflowAnchor = previousOverflowAnchor || '';
    previousOverflowAnchor = null;
    notify('settled');
  }

  function choose(language) {
    if (!valid(language) || body.dataset.readingLanguage === language) return;
    prepareStaticLetters();
    const anchor = readingAnchor();
    const duration = motionPreference.matches ? 0 : transitionDuration;
    const glyphs = [...document.querySelectorAll('.site-sheet .reading-glyph,.site-sheet .fx-glyph')]
      .filter(element => !element.classList.contains('fx-glyph') || !element.parentElement.closest('.reading-glyph'));
    // Snapshot an interrupted animation before cancelling, so another choice
    // sends the letters from their current painted positions without a jump.
    const before = duration ? glyphs.map(element => ({ element, rect: element.getBoundingClientRect() })) : [];
    clearTimeout(endTimer);
    cancelLetters();
    if (previousOverflowAnchor === null) previousOverflowAnchor = document.documentElement.style.overflowAnchor;
    document.documentElement.style.overflowAnchor = 'none';
    moving = true;
    notify('before', duration);
    body.classList.toggle('is-language-switching', duration > 0);
    body.dataset.readingLanguage = language;
    updateControls(language);
    try { window.localStorage.setItem(storageKey, language); } catch { /* Storage is optional. */ }
    if (status) {
      status.lang = language;
      status.textContent = language === 'en' ? 'English is now the main reading column.' : '한국어를 중심으로 읽습니다.';
    }
    restoreAnchor(anchor);
    // Complete every layout read before starting animations. The independent
    // translate/scale properties leave BANANA's transform and dent ink intact.
    const destinations = before.map(item => ({ ...item, to: item.element.getBoundingClientRect() }));
    destinations.forEach(({ element, rect: from, to }, index) => {
      if ((!nearViewport(from) && !nearViewport(to)) || !to.width || !to.height || typeof element.animate !== 'function') return;
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      if (Math.abs(dx) + Math.abs(dy) < .1 && Math.abs(sx - 1) < .001 && Math.abs(sy - 1) < .001) return;
      const origin = element.style.transformOrigin;
      element.style.transformOrigin = '0 0';
      const delay = (index % 19) * 18;
      const animation = element.animate([
        { translate: `${dx}px ${dy}px`, scale: `${sx} ${sy}` },
        { translate: '0px 0px', scale: '1 1' }
      ], { duration: duration - delay, delay, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
      running.set(element, { animation, origin });
    });
    body.dataset.movingLetters = String(running.size);
    notify('layout', duration);
    if (!duration || !running.size) finish();
    else endTimer = setTimeout(finish, duration);
  }

  let initialLanguage = valid(body.dataset.readingLanguage) ? body.dataset.readingLanguage : 'ko';
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (valid(stored)) initialLanguage = stored;
  } catch { /* The default remains usable in restricted browsing contexts. */ }
  body.dataset.readingLanguage = initialLanguage;
  updateControls(initialLanguage);
  controls.forEach(button => button.addEventListener('click', () => choose(button.dataset.readingLanguageButton)));
  // Font/viewport changes invalidate the FLIP destinations. Settle cleanly;
  // ordinary scrolling can continue because the animation uses live DOM text.
  window.addEventListener('resize', finish, { passive: true });
  document.fonts?.addEventListener('loadingdone', finish);
  motionPreference.addEventListener('change', () => { if (motionPreference.matches) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  requestAnimationFrame(() => notify('initial'));
})();
