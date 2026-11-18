/* Thirty-second sweeps divide a masthead-to-note clock into gapless tracks. */
(() => {
  'use strict';
  const note = document.getElementById('vv-note');
  const layer = note?.querySelector('.vv-clock-layer');
  const sheet = note?.closest('.site-sheet');
  if (!note || !layer || !sheet) return;
  const masthead = document.querySelector('.masthead');
  const toolbar = sheet.querySelector('.reading-toolbar');

  // Keep the entire drawing inside a shared containing block. A note child with
  // a negative top can be clipped by an ancestor's overflow/transition in Safari.
  layer.hidden = true;
  sheet.classList.add('vv-clock-host');
  sheet.append(layer);

  const sequence = [1, 2, 4];
  const cycleMs = 30000;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const namespace = 'http://www.w3.org/2000/svg';
  let frame = 0;
  let elapsed = 0;
  let previousTime = null;
  let count = 1;
  let hands = [];
  let clocks = [];

  function tracksFor(totalWidth, totalHeight, number) {
    if (number === 1) return [{ x: 0, y: 0, width: totalWidth, height: totalHeight }];
    if (number === 2) return [
      { x: 0, y: 0, width: totalWidth * .75, height: totalHeight },
      { x: totalWidth * .75, y: 0, width: totalWidth * .25, height: totalHeight }
    ];
    return Array.from({ length: 4 }, (_, i) => ({
      x: i * totalWidth / 4, y: 0, width: totalWidth / 4, height: totalHeight
    }));
  }

  function clockBounds(width, contentLeft, headingTop, toolbarBottom, contentBottom) {
    const top = Math.max(headingTop, toolbarBottom + 16);
    return { left: contentLeft, top, width, height: Math.max(1, contentBottom - top) };
  }

  function svgElement(tag, attributes) {
    const element = document.createElementNS(namespace, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  function build() {
    layer.replaceChildren();
    clocks = [];
    hands = [];
    for (let i = 0; i < count; i += 1) {
      const clock = svgElement('svg', {
        // A small vertical inset keeps the top/bottom strokes inside the SVG
        // viewport. The horizontal span remains 0–1000 so neighboring arcs touch.
        class: 'vv-clock', viewBox: '0 -1 1000 1002', preserveAspectRatio: 'none',
        'aria-hidden': 'true', focusable: 'false'
      });
      clock.append(svgElement('ellipse', { cx: 500, cy: 500, rx: 500, ry: 500 }));
      clock.append(svgElement('line', { x1: 500, y1: 500, x2: 500, y2: 0 }));
      const hand = svgElement('line', {
        class: 'vv-clock-hand', x1: 500, y1: 500, x2: 500, y2: 0
      });
      clock.append(hand);
      layer.append(clock);
      clocks.push(clock);
      hands.push(hand);
    }
    layer.dataset.clockCount = String(count);
    layout();
  }

  function layout() {
    if (note.hidden) return;
    const noteRect = note.getBoundingClientRect();
    if (!noteRect.width || clocks.length !== count) return;
    const sheetRect = sheet.getBoundingClientRect();
    const headerTop = (masthead ? masthead.getBoundingClientRect().top : noteRect.top) - sheetRect.top;
    // A sticky toolbar's screen position changes with scroll. Use its natural
    // flow height at the top of the sheet, not its current viewport bottom.
    const sheetStyle = getComputedStyle(sheet);
    const toolbarStyle = toolbar ? getComputedStyle(toolbar) : null;
    const toolbarBottom = (parseFloat(sheetStyle.paddingTop) || 0) + (toolbar
      ? toolbar.getBoundingClientRect().height + (parseFloat(toolbarStyle.marginTop) || 0) + (parseFloat(toolbarStyle.marginBottom) || 0)
      : 0);
    const bounds = clockBounds(noteRect.width, noteRect.left - sheetRect.left,
      headerTop, toolbarBottom, noteRect.bottom - sheetRect.top);
    Object.assign(layer.style, {
      left: bounds.left + 'px', top: bounds.top + 'px',
      width: bounds.width + 'px', height: bounds.height + 'px'
    });
    const tracks = tracksFor(bounds.width, bounds.height, count);
    layer.dataset.clockLayout = 'gapless-columns';
    tracks.forEach((track, i) => {
      Object.assign(clocks[i].style, {
        left: track.x + 'px', top: track.y + 'px', width: track.width + 'px', height: track.height + 'px'
      });
    });
  }

  function draw() {
    const nextCount = sequence[Math.floor(elapsed / cycleMs) % sequence.length];
    if (nextCount !== count || clocks.length !== count) { count = nextCount; build(); }
    const angle = (elapsed % cycleMs) / cycleMs * Math.PI * 2;
    const x = (500 + 500 * Math.sin(angle)).toFixed(3);
    const y = (500 - 500 * Math.cos(angle)).toFixed(3);
    hands.forEach(hand => { hand.setAttribute('x2', x); hand.setAttribute('y2', y); });
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || note.hidden || motion.matches) { previousTime = null; return; }
    if (previousTime !== null) elapsed += now - previousTime;
    previousTime = now;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    layer.hidden = note.hidden;
    if (document.hidden || note.hidden) return;
    draw();
    layout();
    if (!motion.matches) frame = requestAnimationFrame(tick);
  }

  new MutationObserver(sync).observe(note, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(layout).observe(document.body, { attributes: true, attributeFilter: ['data-reading-language', 'class'] });
  if ('ResizeObserver' in window) {
    const sizeObserver = new ResizeObserver(layout);
    sizeObserver.observe(sheet);
    sizeObserver.observe(note);
    if (masthead) sizeObserver.observe(masthead);
    if (toolbar) sizeObserver.observe(toolbar);
  }
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  if (document.fonts) document.fonts.ready.then(layout);
  sync();
})();
