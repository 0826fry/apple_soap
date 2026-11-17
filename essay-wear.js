/* Paper keeps a little of every pull. Geometry is read once, then animated numerically. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const EXCLUDED = 'a,button,input,textarea,select,form,label,summary,dialog,[role="button"],[contenteditable],[data-no-wear],.reading-toolbar,.archive,.guestbook';
  const ANCHOR = '[data-effect-text],.wordplay,h1,h2,h3,.section-title-en,p,.colophon';
  const MAX_MARKS = 240;
  const MAX_DENTS = 28;
  const MAX_PULLS = 12;
  const MAX_BENT_GLYPHS = 720;
  const RESIDUAL = .12;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const neutral = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, pressure: 0 });
  let instance = 0;

  function svg(tag, attributes = {}) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    return node;
  }

  function pullAt(x, y, pulls) {
    let dx = 0, dy = 0, rotation = 0, pressure = 0;
    pulls.forEach(pull => {
      const vx = x - pull.x, vy = y - pull.y;
      const distance = Math.hypot(vx, vy);
      if (distance >= pull.radius) return;
      const t = distance / pull.radius;
      const weight = (1 - t * t) ** 2;
      dx += pull.dx * weight;
      dy += pull.dy * weight;
      rotation += (vx * pull.dy - vy * pull.dx) / (pull.radius * pull.radius) * weight * 10;
      pressure = Math.max(pressure, Math.hypot(pull.dx, pull.dy) / 120 * weight);
    });
    const distance = Math.hypot(dx, dy);
    const bound = distance > 125 ? 125 / distance : 1;
    return { x: dx * bound, y: dy * bound, rotation: clamp(rotation, -5, 5), pressure };
  }

  function deformationAt(x, y, dents, pulls, fontSize) {
    let dx = 0, dy = 0, pressure = 0, rotation = 0;
    dents.forEach(dent => {
      const vx = dent.x - x, vy = dent.y - y;
      const distance = Math.hypot(vx, vy);
      if (distance >= dent.radius) return;
      const t = distance / dent.radius;
      const weight = (1 - t * t) ** 2 * dent.strength;
      dx += vx * .76 * weight;
      dy += vy * .76 * weight + 4.5 * weight;
      rotation += Math.sin(Math.atan2(vy, vx) * 2) * 9 * weight;
      pressure = Math.max(pressure, weight);
    });
    const dentLimit = clamp(fontSize * 1.9, 34, 62);
    const distance = Math.hypot(dx, dy);
    const bound = distance > dentLimit ? dentLimit / distance : 1;
    const pull = pullAt(x, y, pulls);
    return {
      x: dx * bound + pull.x,
      y: dy * bound + pull.y,
      scaleX: Math.max(.68, 1 - pressure * .34),
      scaleY: Math.max(.76, 1 - pressure * .23),
      rotation: clamp(rotation + pull.rotation, -11, 11),
      pressure: Math.max(pressure, pull.pressure)
    };
  }

  function transform(value) {
    return `translate3d(${value.x.toFixed(2)}px, ${value.y.toFixed(2)}px, 0) rotate(${value.rotation.toFixed(2)}deg) scale(${value.scaleX.toFixed(4)}, ${value.scaleY.toFixed(4)})`;
  }

  function spring(pull, dt, reduced = false) {
    if (pull.phase === 'still') return false;
    if (reduced) {
      pull.dx = pull.targetX; pull.dy = pull.targetY; pull.vx = pull.vy = 0;
    } else {
      // Solve the damped spring for the actual elapsed time. A dropped frame
      // must not slow the paper's clock, and no long substep loop is needed.
      const stiffness = pull.phase === 'held' ? 310 : 110;
      const damping = pull.phase === 'held' ? 31 : 20;
      const decayRate = damping / 2;
      const frequency = Math.sqrt(stiffness - decayRate * decayRate);
      const decay = Math.exp(-decayRate * dt);
      const cosine = Math.cos(frequency * dt);
      const sine = Math.sin(frequency * dt);
      [['dx', 'vx', 'targetX'], ['dy', 'vy', 'targetY']].forEach(([position, velocity, target]) => {
        const displacement = pull[position] - pull[target];
        const speed = pull[velocity];
        pull[position] = pull[target] + decay * (displacement * cosine + (speed + decayRate * displacement) / frequency * sine);
        pull[velocity] = decay * (speed * cosine - (decayRate * speed + stiffness * displacement) / frequency * sine);
      });
    }
    const moving = Math.hypot(pull.dx - pull.targetX, pull.dy - pull.targetY) > .025 || Math.hypot(pull.vx, pull.vy) > .08;
    if (!moving) {
      pull.dx = pull.targetX; pull.dy = pull.targetY; pull.vx = pull.vy = 0;
      if (pull.phase === 'returning') pull.phase = 'still';
    }
    return moving;
  }

  window.createEssayWear = function createEssayWear({ root } = {}) {
    if (!(root instanceof Element)) throw new TypeError('An essay element is required.');
    const id = `essay-wear-${++instance}`;
    const surface = svg('svg', { class: 'essay-wear-surface', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none', 'data-wear-surface': '' });
    const defs = svg('defs');
    const gradient = svg('radialGradient', { id: `${id}-wash` });
    gradient.append(
      svg('stop', { offset: '0', 'stop-color': 'var(--paper, #fff)', 'stop-opacity': '.96' }),
      svg('stop', { offset: '.58', 'stop-color': 'var(--paper, #fff)', 'stop-opacity': '.5' }),
      svg('stop', { offset: '1', 'stop-color': 'var(--paper, #fff)', 'stop-opacity': '0' })
    );
    defs.append(gradient);
    const marksLayer = svg('g', { class: 'essay-wear-marks' });
    const dentsLayer = svg('g', { class: 'essay-wear-dents' });
    surface.append(defs, marksLayer, dentsLayer);
    root.append(surface);
    root.dataset.wearEnabled = 'false';

    const marks = [], dents = [], pulls = [], listeners = [];
    const dirty = new Set();
    const painted = new Map();
    const glyphs = [...root.querySelectorAll('.fx-dent-glyph')]
      .filter(node => !node.closest(EXCLUDED))
      .map(node => ({ node, box: node.parentElement, anchor: node.closest(ANCHOR) || root }));
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = false, destroyed = false, frame = 0;
    let geometryDirty = true, glyphGeometryDirty = true, deformationDirty = false;
    let glyphCache = [], grip = null, lastGesture = null, lastFrameTime = 0;
    let effectsTimer = 0, width = 1, height = 1, serial = 0;
    let previousPoint = null, pointer = null, lastInputTime = 0;
    let lastScrollY = window.scrollY, touchStart = null, touchDistance = 0;
    let lastTouchEnd = -Infinity, suppressClickUntil = 0;
    let layoutSuppressedUntil = 0, ignoreLayoutScroll = false, layoutMoving = false;

    function setData(name, value) {
      const next = String(value);
      if (root.dataset[name] !== next) root.dataset[name] = next;
    }
    function counters() {
      setData('wearMarks', marks.length);
      setData('wearDents', dents.length);
      setData('wearGlyphs', painted.size);
      setData('wearDrag', grip ? 'dragging' : pulls.some(p => p.phase === 'returning') ? 'returning' : 'idle');
      setData('wearResiduals', pulls.filter(p => p.phase === 'still' && Math.hypot(p.dx, p.dy) > .1).length);
      setData('wearPull', Math.max(0, ...pulls.map(p => Math.hypot(p.dx, p.dy))).toFixed(2));
      setData('wearDragPeak', (lastGesture?.peak || 0).toFixed(2));
      setData('wearDragTarget', (lastGesture?.targetPeak || 0).toFixed(2));
    }
    function blocked() {
      return !active || destroyed || document.hidden || performance.now() < layoutSuppressedUntil || Boolean(document.querySelector('dialog[open]'));
    }
    function eligible(target) {
      return target instanceof Element && root.contains(target) && !target.closest(EXCLUDED);
    }
    function at(clientX, clientY, target) {
      if (blocked() || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      const hit = target || document.elementFromPoint(clientX, clientY);
      if (!eligible(hit)) return null;
      const rect = root.getBoundingClientRect();
      const x = clientX - rect.left, y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      const anchor = hit.closest(ANCHOR) || root;
      const box = anchor.getBoundingClientRect();
      return { x, y, anchor, radius: clamp(rect.width * .25, 112, 185),
        nx: clamp((clientX - box.left) / Math.max(1, box.width), 0, 1),
        ny: clamp((clientY - box.top) / Math.max(1, box.height), 0, 1) };
    }
    function schedule() {
      if (!frame && !destroyed) frame = requestAnimationFrame(render);
    }
    function cacheGeometry() {
      const rect = root.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      if (geometryDirty) {
        surface.setAttribute('viewBox', `0 0 ${width} ${height}`);
        const anchors = new Map();
        [...marks, ...dents, ...pulls].forEach(mark => {
          if (!mark.anchor.isConnected) mark.anchor = root;
          if (!anchors.has(mark.anchor)) anchors.set(mark.anchor, mark.anchor.getBoundingClientRect());
          const box = anchors.get(mark.anchor);
          mark.x = clamp(box.left - rect.left + mark.nx * box.width, 0, width);
          mark.y = clamp(box.top - rect.top + mark.ny * box.height, 0, height);
          mark.radius = mark.kind === 'pull' ? clamp(width * .34, 220, 360) : clamp(width * .25, 112, 185);
          if (mark.node) dirty.add(mark);
        });
        geometryDirty = false;
      }
      const fields = [...dents, ...pulls];
      const anchors = new Map();
      const candidates = [];
      glyphs.forEach(glyph => {
        if (!glyph.node.isConnected) return;
        if (!anchors.has(glyph.anchor)) {
          const box = glyph.anchor.getBoundingClientRect();
          anchors.set(glyph.anchor, fields.some(field =>
            field.x + field.radius >= box.left - rect.left && field.x - field.radius <= box.right - rect.left &&
            field.y + field.radius >= box.top - rect.top && field.y - field.radius <= box.bottom - rect.top));
        }
        if (!anchors.get(glyph.anchor)) return;
        // The outer box includes BANANA but never this module's inner deformation.
        const box = glyph.box.getBoundingClientRect();
        if (!box.width || !box.height) return;
        const x = box.left + box.width / 2 - rect.left, y = box.top + box.height / 2 - rect.top;
        const proximity = Math.max(0, ...fields.map(field => 1 - Math.hypot(x - field.x, y - field.y) / field.radius));
        if (proximity <= 0) return;
        candidates.push({ ...glyph, x, y, proximity, fontSize: parseFloat(getComputedStyle(glyph.node).fontSize) || 24 });
      });
      candidates.sort((a, b) => b.proximity - a.proximity);
      glyphCache = candidates.slice(0, MAX_BENT_GLYPHS);
      glyphGeometryDirty = false;
      deformationDirty = true;
    }
    function paintMark(mark) {
      const pull = active ? pullAt(mark.x, mark.y, pulls) : { x: 0, y: 0, rotation: 0 };
      const next = `translate(${(mark.x + pull.x).toFixed(1)} ${(mark.y + pull.y).toFixed(1)}) rotate(${(mark.angle + pull.rotation).toFixed(1)})`;
      if (mark.paintedTransform !== next) { mark.node.setAttribute('transform', next); mark.paintedTransform = next; }
      if (mark.paintedStrength !== mark.strength) {
        mark.node.style.setProperty('--wear-strength', mark.strength.toFixed(3));
        if (mark.wash) mark.wash.setAttribute('opacity', String(.12 + mark.strength * .68));
        mark.paintedStrength = mark.strength;
      }
    }
    function paintGlyphs(dt) {
      const targets = new Map();
      if (active) glyphCache.forEach(glyph => {
        const value = deformationAt(glyph.x, glyph.y, dents, pulls, glyph.fontSize);
        if (value.pressure > .003 || Math.hypot(value.x, value.y) > .015) targets.set(glyph.node, value);
      });
      const amount = motionPreference.matches ? 1 : 1 - Math.exp(-dt / .06);
      let moving = false;
      const nodes = new Set([...painted.keys(), ...targets.keys()]);
      nodes.forEach(node => {
        const to = targets.get(node) || neutral();
        const current = painted.get(node) || neutral();
        let delta = 0;
        ['x', 'y', 'rotation', 'scaleX', 'scaleY'].forEach(key => {
          current[key] += (to[key] - current[key]) * amount;
          delta = Math.max(delta, Math.abs(to[key] - current[key]) * (key.startsWith('scale') ? 30 : 1));
        });
        current.pressure = to.pressure;
        if (delta < .018) {
          Object.assign(current, to);
          if (!targets.has(node)) { node.style.removeProperty('transform'); painted.delete(node); return; }
        } else moving = true;
        const next = transform(current);
        if (node.style.transform !== next) node.style.transform = next;
        painted.set(node, current);
      });
      return moving;
    }
    function render(now) {
      frame = 0;
      if (destroyed || layoutMoving) { lastFrameTime = 0; return; }
      const dt = lastFrameTime ? Math.max(.001, (now - lastFrameTime) / 1000) : 1 / 60;
      lastFrameTime = now;
      if (geometryDirty || glyphGeometryDirty) cacheGeometry();
      let pulling = false;
      if (active) pulls.forEach(pull => {
        pulling = spring(pull, dt, motionPreference.matches) || pulling;
        pull.peak = Math.max(pull.peak || 0, Math.hypot(pull.dx, pull.dy));
      });
      if (pulling || deformationDirty) [...marks, ...dents].forEach(mark => dirty.add(mark));
      dirty.forEach(paintMark); dirty.clear();
      const moving = paintGlyphs(dt);
      deformationDirty = false;
      counters();
      if (pulling || moving) schedule();
      else lastFrameTime = 0;
    }
    function clearGlyphs() {
      painted.forEach((value, node) => node.style.removeProperty('transform'));
      painted.clear(); glyphCache = [];
    }
    function retain(list, mark, limit) {
      if (list.length >= limit) {
        const oldest = list.shift();
        dirty.delete(oldest); oldest.node?.remove();
      }
      list.push(mark);
      if (mark.node) dirty.add(mark);
      counters(); schedule();
    }
    function abrade(point, amount = .085) {
      if (!point) return;
      const nearby = marks.find(mark => Math.hypot(mark.x - point.x, mark.y - point.y) < 25);
      if (nearby) { nearby.strength = Math.min(1, nearby.strength + amount); dirty.add(nearby); schedule(); return; }
      const n = ++serial;
      const group = svg('g', { class: 'essay-wear-mark' });
      const wash = svg('ellipse', { cx: '0', cy: '0', rx: 52 + n % 17, ry: 25 + n % 11, fill: `url(#${id}-wash)` });
      const fibers = svg('path', { class: 'essay-wear-fibers', d: 'M-37 -8q18 -3 34 1m-23 9q22 -5 51 -1M-26 13q12 -3 22 -2M9 -14l14 -1M-10 -4l19 -2M29 7l8 -1' });
      const grazes = svg('path', { class: 'essay-wear-grazes', d: 'M-29 -5l9 -1m11 0l16 -2M-16 8l21 -2M17 3l10 -1' });
      group.append(wash, fibers, grazes); marksLayer.append(group);
      retain(marks, { ...point, kind: 'mark', node: group, wash, strength: amount, angle: (n * 29 % 24) - 12 }, MAX_MARKS);
    }
    function indent(point, strength = .48) {
      if (!point) return;
      abrade(point, .12);
      const nearby = dents.find(mark => Math.hypot(mark.x - point.x, mark.y - point.y) < 24);
      deformationDirty = glyphGeometryDirty = true;
      if (nearby) { nearby.strength = Math.min(.9, nearby.strength + .12); dirty.add(nearby); schedule(); return; }
      const n = ++serial;
      const group = svg('g', { class: 'essay-wear-dent' });
      group.append(svg('ellipse', { class: 'essay-wear-dent-shadow', cx: '0', cy: '1', rx: '14', ry: '5' }));
      const folds = ['M-51 -9Q-22 -2 -7 0Q-2 1 0 3', 'M-3 2Q11 10 38 6L51 8', 'M-5 2Q-13 15 -29 28', 'M1 1Q9 -9 18 -26', 'M7 4Q24 21 34 24'];
      folds.forEach((d, index) => {
        group.append(svg('path', { class: 'essay-wear-fold-light', d, transform: 'translate(0 1.1)', opacity: index < 2 ? '1' : '.65' }));
        group.append(svg('path', { class: 'essay-wear-fold', d, opacity: index < 2 ? '1' : '.65' }));
      });
      dentsLayer.append(group);
      retain(dents, { ...point, kind: 'dent', radius: clamp(width * .25, 112, 185), node: group, strength, angle: (n * 47 % 90) - 45 }, MAX_DENTS);
    }
    function move(clientX, clientY, target, amount) {
      pointer = { clientX, clientY };
      if (blocked()) return;
      const point = at(clientX, clientY, target);
      if (!point) { previousPoint = null; return; }
      const now = performance.now();
      if (now - lastInputTime < 24) return;
      if (previousPoint) {
        const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
        if (distance < 9) return;
        if (distance < 160) {
          const steps = Math.min(4, Math.floor(distance / 24));
          for (let step = 1; step < steps; step++) {
            const t = step / steps;
            abrade(at(clientX - (point.x - previousPoint.x) * (1 - t), clientY - (point.y - previousPoint.y) * (1 - t)), amount);
          }
        }
      }
      abrade(point, amount); previousPoint = point; lastInputTime = now;
    }
    function releaseCapture(pull) {
      try { if (root.hasPointerCapture?.(pull.pointerId)) root.releasePointerCapture(pull.pointerId); } catch { /* A cancelled pointer may already be gone. */ }
    }
    function releaseGrip(leaveTrace = true) {
      if (!grip) return;
      const pull = grip; grip = null;
      root.classList.remove('is-wear-grabbing');
      releaseCapture(pull);
      const moved = pull.moved && Math.hypot(pull.targetX, pull.targetY) > 2;
      if (leaveTrace && moved) {
        pull.targetX *= RESIDUAL; pull.targetY *= RESIDUAL;
        indent(pull, .3);
        abrade(pull, .1);
      } else {
        pull.targetX = pull.targetY = 0;
        if (leaveTrace && !pull.moved) indent(pull);
      }
      pull.phase = 'returning';
      suppressClickUntil = performance.now() + 450;
      deformationDirty = true;
      counters(); schedule();
    }
    function onPointerDown(event) {
      onScrollIntent(event);
      if (event.pointerType === 'touch' || event.isPrimary === false || event.button !== 0 || blocked() || !eligible(event.target)) return;
      if (window.getSelection()?.toString()) return;
      const point = at(event.clientX, event.clientY, event.target);
      if (!point) return;
      releaseGrip(false);
      // Only an active paper gesture suppresses selection; controls and touch stay native.
      if (event.cancelable) event.preventDefault();
      const pull = { ...point, kind: 'pull', radius: clamp(root.clientWidth * .34, 220, 360),
        pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
        dx: 0, dy: 0, vx: 0, vy: 0, targetX: 0, targetY: 0, phase: 'held', moved: false };
      retain(pulls, pull, MAX_PULLS); grip = lastGesture = pull;
      root.classList.add('is-wear-grabbing');
      try { root.setPointerCapture?.(event.pointerId); } catch { /* Document listeners cover old browsers. */ }
      glyphGeometryDirty = deformationDirty = true;
      pointer = { clientX: event.clientX, clientY: event.clientY };
      counters(); schedule();
    }
    function onPointerMove(event) {
      if (event.isPrimary === false || event.pointerType === 'touch') return;
      if (grip && event.pointerId === grip.pointerId) {
        if (event.buttons === 0) { releaseGrip(); return; }
        if (blocked()) { releaseGrip(false); return; }
        const dx = event.clientX - grip.startX, dy = event.clientY - grip.startY;
        const distance = Math.hypot(dx, dy);
        grip.moved = grip.moved || distance > 4;
        const response = distance ? 125 * Math.tanh(distance * .72 / 125) / distance : 0;
        grip.targetX = dx * response; grip.targetY = dy * response;
        grip.targetPeak = Math.max(grip.targetPeak || 0, Math.hypot(grip.targetX, grip.targetY));
        pointer = { clientX: event.clientX, clientY: event.clientY };
        deformationDirty = true; schedule();
        return;
      }
      move(event.clientX, event.clientY, event.target, .085);
    }
    function onPointerUp(event) { if (grip && event.pointerId === grip.pointerId) releaseGrip(); }
    function onPointerCancel(event) { if (grip && event.pointerId === grip.pointerId) releaseGrip(false); }
    function onTouchStart(event) {
      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1) return;
      touchStart = { x: touch.clientX, y: touch.clientY }; touchDistance = 0; previousPoint = null;
      pointer = { clientX: touch.clientX, clientY: touch.clientY };
    }
    function onTouchMove(event) {
      onScrollIntent();
      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1) return;
      if (touchStart) touchDistance = Math.max(touchDistance, Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y));
      move(touch.clientX, touch.clientY, null, .1);
    }
    function onTouchEnd() { lastTouchEnd = performance.now(); touchStart = null; previousPoint = null; }
    function onScroll() {
      const delta = Math.abs(window.scrollY - lastScrollY); lastScrollY = window.scrollY;
      if (delta > 1 && grip) releaseGrip(false);
      if (ignoreLayoutScroll || blocked() || delta < 1) return;
      previousPoint = null;
      const rect = root.getBoundingClientRect();
      const clientX = pointer ? pointer.clientX : rect.left + rect.width * .5;
      const clientY = pointer ? pointer.clientY : window.innerHeight * .56;
      abrade(at(clientX, clientY), clamp(delta / 260, .035, .15));
    }
    function onClick(event) {
      if (performance.now() < suppressClickUntil || event.button !== 0 || event.detail === 0 || blocked() || !eligible(event.target)) return;
      if (performance.now() - lastTouchEnd < 500 && touchDistance > 12) return;
      if (window.getSelection()?.toString()) return;
      indent(at(event.clientX, event.clientY, event.target));
    }
    function invalidate() { releaseGrip(false); geometryDirty = glyphGeometryDirty = true; schedule(); }
    function onScrollIntent(event) {
      if (event?.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
      if (event?.type === 'pointerdown' && performance.now() < layoutSuppressedUntil) return;
      ignoreLayoutScroll = false; lastScrollY = window.scrollY;
    }
    function onLayoutChange(event) {
      releaseGrip(false);
      const phase = event.detail?.phase;
      layoutMoving = phase === 'before' || phase === 'layout';
      layoutSuppressedUntil = Math.max(layoutSuppressedUntil, performance.now() + Math.max(500, (Number(event.detail?.duration) || 0) + 150));
      if (phase !== 'initial') ignoreLayoutScroll = true;
      previousPoint = null; lastScrollY = window.scrollY;
      geometryDirty = glyphGeometryDirty = true; schedule();
    }
    function onEffectsChange(event) {
      if (!active || (!dents.length && !pulls.length)) return;
      glyphGeometryDirty = true; schedule(); clearTimeout(effectsTimer);
      effectsTimer = setTimeout(() => { if (!destroyed && active) { glyphGeometryDirty = true; schedule(); } }, Math.max(0, Number(event.detail?.duration) || 0) + 40);
    }
    function finishTransient() {
      releaseGrip(false);
      pulls.forEach(pull => {
        if (pull.phase !== 'still') { pull.dx = pull.targetX; pull.dy = pull.targetY; pull.vx = pull.vy = 0; pull.phase = 'still'; }
      });
      deformationDirty = true; schedule();
    }
    function onVisibility() { if (document.hidden) finishTransient(); else invalidate(); }
    function listen(target, type, handler, options = { passive: true }) {
      target.addEventListener(type, handler, options); listeners.push(() => target.removeEventListener(type, handler, options));
    }
    listen(document, 'pointerdown', onPointerDown, { passive: false });
    listen(document, 'pointermove', onPointerMove);
    listen(document, 'pointerup', onPointerUp);
    listen(document, 'pointercancel', onPointerCancel);
    listen(root, 'lostpointercapture', onPointerCancel);
    listen(window, 'blur', finishTransient);
    listen(document, 'visibilitychange', onVisibility);
    listen(document, 'wheel', onScrollIntent);
    listen(document, 'keydown', onScrollIntent);
    listen(document, 'touchstart', onTouchStart);
    listen(document, 'touchmove', onTouchMove);
    listen(document, 'touchend', onTouchEnd);
    listen(document, 'touchcancel', onTouchEnd);
    listen(document, 'click', onClick);
    listen(window, 'scroll', onScroll);
    listen(window, 'resize', invalidate);
    listen(root, 'essay:effectschange', onEffectsChange);
    listen(root, 'essay:layoutchange', onLayoutChange);
    listen(motionPreference, 'change', finishTransient);
    if (document.fonts) listen(document.fonts, 'loadingdone', invalidate);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidate) : null;
    observer?.observe(root);
    document.fonts?.ready.then(() => { if (!destroyed) invalidate(); });
    counters(); schedule();

    return {
      setActive(value) {
        if (destroyed) return;
        releaseGrip(false);
        active = Boolean(value); root.dataset.wearEnabled = String(active);
        previousPoint = null; lastScrollY = window.scrollY;
        if (active) invalidate();
        else { clearTimeout(effectsTimer); finishTransient(); deformationDirty = true; schedule(); }
      },
      reset() {
        if (destroyed) return;
        releaseGrip(false);
        marks.splice(0).forEach(mark => mark.node.remove()); dents.splice(0).forEach(mark => mark.node.remove()); pulls.splice(0);
        dirty.clear(); clearTimeout(effectsTimer); clearGlyphs(); lastGesture = null;
        previousPoint = null; touchDistance = 0; glyphGeometryDirty = deformationDirty = true;
        counters(); schedule();
      },
      destroy() {
        if (destroyed) return;
        releaseGrip(false); destroyed = true; active = false;
        cancelAnimationFrame(frame); clearTimeout(effectsTimer); clearGlyphs();
        observer?.disconnect(); listeners.forEach(remove => remove());
        marks.length = dents.length = pulls.length = 0; dirty.clear(); surface.remove();
        root.classList.remove('is-wear-grabbing');
        ['wearEnabled', 'wearMarks', 'wearDents', 'wearGlyphs', 'wearDrag', 'wearResiduals', 'wearPull', 'wearDragPeak', 'wearDragTarget'].forEach(name => delete root.dataset[name]);
      }
    };
  };
})();
