/* One clock for the page's letter experiments. Layout, title motion and paper wear
   each keep their own nested layer; an effect never restarts another animation. */
(() => {
  'use strict';

  const EFFECT_NAMES = new Set(['banana', 'abracadabra']);
  const LETTER = /[\p{L}\p{N}]/u;
  const EXCLUDED = '.reading-toolbar,.sr-only,.fx-readable,.fx-run,.wordplay-still,[data-wordplay-fallback],[data-static],script,style,textarea,input,select,[contenteditable],dialog,.archive,.guestbook';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const srStyle = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;user-select:none;-webkit-user-select:none;';
  // Exact critically damped solution: stable at any frame rate and continuous
  // through a direction change, without restarting thousands of CSS transitions.
  function spring(position, velocity, target, frequency, dt) {
    const offset = position - target;
    const impulse = velocity + frequency * offset;
    const decay = Math.exp(-frequency * dt);
    return [target + (offset + impulse * dt) * decay, (velocity - frequency * impulse * dt) * decay];
  }

  window.createEssayEffects = function createEssayEffects(root) {
    if (!(root instanceof Element)) throw new TypeError('A page surface is required.');

    const glyphs = [];
    const replacements = [];
    const state = { banana: false, abracadabra: false };
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const segmenter = typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const occurrences = new Map();
    let destroyed = false;
    let frame = 0;
    let dirty = true;
    let advanceDirty = false;
    let viewportDirty = true;
    let layoutMoving = false;
    let completionTimer = 0;
    let visibleGlyphs = [];
    let restoring = false;
    let animating = false;
    let paintFrames = 0;
    const activeGlyphs = new Set();
    const springSamples = [0, .035, .075, .13, .21, .32, .46, .64, .86, 1.12, 1.44, 1.8, 2.2, 2.65, 3.1, 3.5];

    const characters = text => {
      if (segmenter) return [...segmenter.segment(text)].map(part => ({ text: part.segment, index: part.index }));
      let index = 0;
      return Array.from(text).map(character => { const result = { text: character, index }; index += character.length; return result; });
    };

    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!node.nodeValue?.trim() || !parent || parent.closest(EXCLUDED)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // Keep the original advances, including large-name kerning and tracking.
    // All native geometry reads happen before any of the source nodes are replaced.
    textNodes.forEach(textNode => {
      const parent = textNode.parentElement;
      const text = textNode.nodeValue;
      const language = parent.closest('[lang]')?.lang || document.documentElement.lang || 'ko';
      const run = document.createElement('span');
      run.className = 'fx-run';
      const accessible = document.createElement('span');
      accessible.className = 'fx-readable';
      accessible.style.cssText = srStyle;
      accessible.textContent = text;
      const visual = document.createElement('span');
      visual.className = 'fx-visual';
      visual.setAttribute('aria-hidden', 'true');
      run.append(accessible, visual);
      const parts = characters(text);
      const range = document.createRange();
      const fontSize = parseFloat(getComputedStyle(parent).fontSize) || 16;
      const entries = [];
      let word = null;
      parts.forEach(part => {
        if (/^\s+$/u.test(part.text)) {
          visual.append(document.createTextNode(part.text));
          word = null;
          return;
        }
        if (!word) {
          word = document.createElement('span');
          word.className = 'fx-word';
          word.style.cssText = 'display:inline-block;white-space:nowrap;max-width:100%';
          visual.append(word);
        }
        const element = document.createElement('span');
        element.className = 'fx-glyph';
        element.style.display = 'inline-block';
        const ink = document.createElement('span');
        ink.className = 'fx-dent-glyph';
        ink.textContent = part.text;
        element.append(ink);
        word.append(element);
        range.setStart(textNode, part.index);
        range.setEnd(textNode, part.index + part.text.length);
        const advance = range.getBoundingClientRect().width / fontSize;
        if (advance > 0) element.style.width = `${advance}em`;
        const isLetter = LETTER.test(part.text);
        const key = `${language}:${part.text}`;
        const occurrence = occurrences.get(key) || 0;
        if (isLetter) occurrences.set(key, occurrence + 1);
        const glyph = {
          element, character: part.text, language, occurrence, isLetter, index: part.index,
          x: 0, y: 0, width: 0, height: 0, dx: 0, dy: 0,
          currentX: 0, currentY: 0, currentOpacity: 1, velocityX: 0, velocityY: 0, velocityOpacity: 0,
          targetX: 0, targetY: 0, targetOpacity: 1, paintedX: 0, paintedY: 0, paintedOpacity: 1,
          visible: false, present: false
        };
        glyphs.push(glyph);
        entries.push(glyph);
      });
      replacements.push({ run, textNode, text, entries });
    });
    replacements.forEach(({ textNode, run }) => textNode.replaceWith(run));

    function refreshAdvances() {
      // Font swapping must not freeze a fallback typeface's widths. A temporary
      // original-text probe measures the native run without replacing live glyphs.
      const probes = replacements.filter(record => record.run.isConnected).map(record => {
        const node = document.createElement('span');
        node.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;pointer-events:none;letter-spacing:inherit;font:inherit';
        node.textContent = record.text;
        record.run.append(node);
        return { ...record, probe: node, sizes: [] };
      });
      probes.forEach(record => {
        const fontSize = parseFloat(getComputedStyle(record.probe).fontSize) || 16;
        const range = document.createRange();
        record.entries.forEach(glyph => {
          range.setStart(record.probe.firstChild, glyph.index);
          range.setEnd(record.probe.firstChild, glyph.index + glyph.character.length);
          record.sizes.push(range.getBoundingClientRect().width / fontSize);
        });
      });
      probes.forEach(record => {
        record.probe.remove();
        record.entries.forEach((glyph, index) => {
          if (record.sizes[index] > 0) glyph.element.style.width = `${record.sizes[index]}em`;
        });
      });
      advanceDirty = false;
    }

    function measure() {
      if (destroyed || layoutMoving) return;
      if (advanceDirty) refreshAdvances();
      const started = performance.now();
      const groups = new Map();
      const now = started;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      // Geometry is read only on reflow, never for a native animation frame.
      // Subtract this layer's analytic pose; title and wear stay independent.
      glyphs.forEach(glyph => {
        syncGlyph(glyph, now);
        const rect = glyph.element.getBoundingClientRect();
        glyph.x = rect.left + rect.width / 2 + scrollX - (glyph.motion ? glyph.currentX : glyph.paintedX);
        glyph.y = rect.top + rect.height / 2 + scrollY - (glyph.motion ? glyph.currentY : glyph.paintedY);
        glyph.width = rect.width;
        glyph.height = rect.height;
        glyph.present = rect.width > 0 && rect.height > 0;
        glyph.dx = glyph.dy = 0;
        if (!glyph.isLetter || !glyph.present) return;
        const key = `${glyph.language}:${glyph.character}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(glyph);
      });
      groups.forEach(group => {
        if (group.length < 2) return;
        group.sort((a, b) => a.y - b.y);
        group.forEach((glyph, index) => {
          // A heading can find a matching letter in nearby prose, rather than
          // being inert merely because its own short line has no repetition.
          const neighbours = [];
          for (let offset = 1; offset < group.length; offset++) {
            let beyond = 0;
            for (const direction of [-1, 1]) {
              const other = group[index + offset * direction];
              if (!other) { beyond++; continue; }
              const dy = Math.abs(other.y - glyph.y);
              if (dy > 850 && neighbours.length) { beyond++; continue; }
              const distance = Math.hypot(other.x - glyph.x, other.y - glyph.y);
              neighbours.push({ other, distance });
            }
            if (beyond === 2 || offset >= 22) break;
          }
          neighbours.sort((a, b) => a.distance - b.distance);
          let x = 0, y = 0, weights = 0;
          neighbours.slice(0, 6).forEach(({ other, distance }) => {
            const weight = 1 / (60 + distance);
            x += other.x * weight;
            y += other.y * weight;
            weights += weight;
          });
          if (!weights) return;
          const size = glyph.height || 24;
          const maxX = Math.min(36, size * .8);
          const maxY = Math.min(23, size * .52);
          glyph.dx = maxX * Math.tanh((x / weights - glyph.x) * .24 / maxX);
          glyph.dy = maxY * Math.tanh((y / weights - glyph.y) * .18 / maxY);
        });
      });
      dirty = false;
      viewportDirty = true;
      updateTargets();
      root.dataset.effectMeasureMs = (performance.now() - started).toFixed(2);
      root.dataset.effectMeasures = String((Number(root.dataset.effectMeasures) || 0) + 1);
    }

    function updateViewport() {
      const top = window.scrollY - 260;
      const bottom = window.scrollY + window.innerHeight + 260;
      const left = window.scrollX - 100;
      const right = window.scrollX + window.innerWidth + 100;
      visibleGlyphs = [];
      glyphs.forEach(glyph => {
        glyph.visible = glyph.present && glyph.y + glyph.height >= top && glyph.y - glyph.height <= bottom && glyph.x + glyph.width >= left && glyph.x - glyph.width <= right;
        if (glyph.visible) visibleGlyphs.push(glyph);
      });
      root.dataset.effectVisibleGlyphs = String(visibleGlyphs.length);
      viewportDirty = false;
    }

    function updateTargets() {
      glyphs.forEach(glyph => {
        glyph.targetX = state.banana ? glyph.dx : 0;
        glyph.targetY = state.banana ? glyph.dy : 0;
        glyph.targetOpacity = state.abracadabra && glyph.isLetter ? Math.max(0, 1 - glyph.occurrence * .22) : 1;
      });
    }

    function paintGlyph(glyph) {
      const x = Math.round(glyph.currentX * 1000) / 1000;
      const y = Math.round(glyph.currentY * 1000) / 1000;
      const opacity = Math.round(glyph.currentOpacity * 10000) / 10000;
      if (x !== glyph.paintedX || y !== glyph.paintedY) {
        glyph.element.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
        glyph.paintedX = x;
        glyph.paintedY = y;
      }
      if (opacity !== glyph.paintedOpacity) {
        glyph.element.style.opacity = opacity === 1 ? '' : String(opacity);
        glyph.paintedOpacity = opacity;
      }
    }

    function settleGlyph(glyph, paint = true) {
      glyph.currentX = glyph.targetX;
      glyph.currentY = glyph.targetY;
      glyph.currentOpacity = glyph.targetOpacity;
      glyph.velocityX = glyph.velocityY = glyph.velocityOpacity = 0;
      if (paint) paintGlyph(glyph);
    }

    function syncGlyph(glyph, now) {
      const motion = glyph.motion;
      if (!motion) return;
      const elapsed = clamp((now - motion.started) / 1000, 0, motion.duration / 1000);
      [glyph.currentX, glyph.velocityX] = spring(motion.x, motion.vx, motion.toX, motion.positionFrequency, elapsed);
      [glyph.currentY, glyph.velocityY] = spring(motion.y, motion.vy, motion.toY, motion.positionFrequency, elapsed);
      [glyph.currentOpacity, glyph.velocityOpacity] = spring(motion.opacity, motion.vo, motion.toOpacity, motion.opacityFrequency, elapsed);
      glyph.currentOpacity = clamp(glyph.currentOpacity, 0, 1);
    }

    function stopGlyph(glyph, paint = true) {
      glyph.animation?.cancel();
      glyph.animation = null;
      glyph.motion = null;
      activeGlyphs.delete(glyph);
      settleGlyph(glyph, paint);
    }

    function startGlyph(glyph, now) {
      if (glyph.motion && glyph.motion.toX === glyph.targetX && glyph.motion.toY === glyph.targetY && glyph.motion.toOpacity === glyph.targetOpacity) return;
      syncGlyph(glyph, now);
      glyph.animation?.cancel();
      glyph.animation = null;
      glyph.motion = null;
      activeGlyphs.delete(glyph);
      const delta = Math.abs(glyph.currentX - glyph.targetX) + Math.abs(glyph.currentY - glyph.targetY);
      const opacityDelta = Math.abs(glyph.currentOpacity - glyph.targetOpacity);
      if (motionPreference.matches || typeof glyph.element.animate !== 'function' || (delta < .01 && opacityDelta < .0005 && Math.abs(glyph.velocityX) + Math.abs(glyph.velocityY) < .035 && Math.abs(glyph.velocityOpacity) < .0015)) {
        settleGlyph(glyph);
        return;
      }
      const duration = restoring ? 2000 : 3500;
      const motion = {
        started: now, duration,
        x: glyph.currentX, y: glyph.currentY, opacity: glyph.currentOpacity,
        vx: glyph.velocityX, vy: glyph.velocityY, vo: glyph.velocityOpacity,
        toX: glyph.targetX, toY: glyph.targetY, toOpacity: glyph.targetOpacity,
        positionFrequency: restoring ? 5 : 3.5,
        opacityFrequency: restoring ? 5 : 3
      };
      const times = springSamples.filter(time => time < duration / 1000);
      times.push(duration / 1000);
      const keyframes = times.map((time, index) => {
        const last = index === times.length - 1;
        const x = last ? motion.toX : spring(motion.x, motion.vx, motion.toX, motion.positionFrequency, time)[0];
        const y = last ? motion.toY : spring(motion.y, motion.vy, motion.toY, motion.positionFrequency, time)[0];
        const opacity = last ? motion.toOpacity : spring(motion.opacity, motion.vo, motion.toOpacity, motion.opacityFrequency, time)[0];
        return { offset: time * 1000 / duration, transform: `translate(${x.toFixed(4)}px, ${y.toFixed(4)}px)`, opacity: clamp(opacity, 0, 1) };
      });
      // Install the final inline value once; the owned animation presents the
      // spring over it. No per-frame JS styles, layout reads, or permanent layers.
      glyph.element.style.transform = motion.toX || motion.toY ? `translate(${motion.toX.toFixed(4)}px, ${motion.toY.toFixed(4)}px)` : '';
      glyph.element.style.opacity = motion.toOpacity === 1 ? '' : String(motion.toOpacity);
      glyph.paintedX = motion.toX;
      glyph.paintedY = motion.toY;
      glyph.paintedOpacity = motion.toOpacity;
      glyph.motion = motion;
      glyph.animation = glyph.element.animate(keyframes, { duration, easing: 'linear', fill: 'both' });
      activeGlyphs.add(glyph);
    }

    function armCompletion(now) {
      clearTimeout(completionTimer);
      if (!activeGlyphs.size) return;
      let end = Infinity;
      activeGlyphs.forEach(glyph => { end = Math.min(end, glyph.motion.started + glyph.motion.duration); });
      completionTimer = setTimeout(schedule, Math.max(16, end - now + 24));
    }

    function reconcile() {
      const now = performance.now();
      activeGlyphs.forEach(glyph => {
        if (!glyph.visible || now >= glyph.motion.started + glyph.motion.duration) stopGlyph(glyph, glyph.visible);
      });
      visibleGlyphs.forEach(glyph => startGlyph(glyph, now));
      const moving = activeGlyphs.size > 0;
      if (animating !== moving) {
        animating = moving;
        root.dataset.effectsAnimating = String(moving);
        if (!moving) root.dispatchEvent(new CustomEvent('essay:effectschange', { detail: { phase: 'settled', duration: 0 } }));
      }
      root.dataset.effectAnimatedGlyphs = String(activeGlyphs.size);
      armCompletion(now);
    }

    function tick() {
      frame = 0;
      if (destroyed || document.hidden) return;
      const started = performance.now();
      if (dirty && !layoutMoving) measure();
      if (viewportDirty) updateViewport();
      reconcile();
      root.dataset.effectUpdateMs = (performance.now() - started).toFixed(2);
      root.dataset.effectFrames = String(++paintFrames);
    }

    function schedule() {
      if (!frame && !destroyed && !document.hidden) frame = requestAnimationFrame(tick);
    }

    function retarget({ restoring: restoringNow = false, notify = true } = {}) {
      restoring = restoringNow;
      updateTargets();
      if (viewportDirty) updateViewport();
      glyphs.forEach(glyph => {
        if (!glyph.visible) stopGlyph(glyph, false);
        else if (motionPreference.matches) stopGlyph(glyph);
      });
      root.dataset.banana = state.banana ? 'on' : 'off';
      root.dataset.abracadabra = state.abracadabra ? 'on' : 'off';
      if (notify) root.dispatchEvent(new CustomEvent('essay:effectschange', {
        detail: { phase: 'moving', duration: motionPreference.matches ? 0 : restoring ? 2000 : 3500 }
      }));
      schedule();
    }

    function scheduleMeasure(refresh = false) {
      dirty = true;
      advanceDirty = advanceDirty || refresh === true;
      if (!layoutMoving) schedule();
    }
    function onResize() { scheduleMeasure(true); }
    function onFonts() { scheduleMeasure(true); }
    function onScroll() {
      viewportDirty = true;
      // A numeric viewport scan is sufficient; scrolling does not change the
      // document positions cached by measure(). No forced geometry is needed.
      schedule();
    }
    function onVisibility() {
      if (document.hidden) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        clearTimeout(completionTimer);
        activeGlyphs.forEach(glyph => stopGlyph(glyph));
        animating = false;
        root.dataset.effectsAnimating = 'false';
      } else { viewportDirty = true; schedule(); }
    }
    function onLayoutChange(event) {
      const phase = event.detail?.phase;
      layoutMoving = phase === 'before' || phase === 'layout';
      dirty = true;
      viewportDirty = true;
      if (!layoutMoving) schedule();
    }
    function onMotionChange() { retarget({ restoring }); }

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => scheduleMeasure()) : null;
    observer?.observe(root);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('essay:layoutchange', onLayoutChange);
    motionPreference.addEventListener('change', onMotionChange);
    document.addEventListener('visibilitychange', onVisibility);
    document.fonts?.addEventListener('loadingdone', onFonts);
    document.fonts?.ready.then(() => { if (!destroyed) onFonts(); });
    root.dataset.banana = 'off';
    root.dataset.abracadabra = 'off';
    root.dataset.effectGlyphs = String(glyphs.length);
    root.dataset.effectsAnimating = 'false';
    schedule();

    return {
      set(name, active) {
        if (destroyed || !EFFECT_NAMES.has(name)) return;
        const next = Boolean(active);
        if (state[name] === next) return;
        if (dirty && !layoutMoving) measure();
        state[name] = next;
        retarget({ restoring: !next });
      },
      reset() {
        if (destroyed) return;
        state.banana = state.abracadabra = false;
        retarget({ restoring: true });
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        if (frame) cancelAnimationFrame(frame);
        clearTimeout(completionTimer);
        activeGlyphs.forEach(glyph => stopGlyph(glyph));
        observer?.disconnect();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
        root.removeEventListener('essay:layoutchange', onLayoutChange);
        motionPreference.removeEventListener('change', onMotionChange);
        document.removeEventListener('visibilitychange', onVisibility);
        document.fonts?.removeEventListener('loadingdone', onFonts);
        replacements.forEach(({ run, textNode }) => { if (run.parentNode) run.replaceWith(textNode); });
        ['banana','abracadabra','effectGlyphs','effectVisibleGlyphs','effectsAnimating','effectFrames','effectAnimatedGlyphs','effectMeasureMs','effectMeasures','effectUpdateMs'].forEach(key => delete root.dataset[key]);
      }
    };
  };
})();
