(() => {
  'use strict';
  // Adapted from this portfolio's Embroidered Memory v2. All geometry is in
  // photograph coordinates; front stitches, reverse threads and scars agree.
  const W = 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgb = (c, a = 1) => `rgba(${c.r},${c.g},${c.b},${a})`;
  const shade = (c, d) => ({ r: clamp(c.r + d, 0, 255), g: clamp(c.g + d, 0, 255), b: clamp(c.b + d, 0, 255) });
  const mix = (a, b, t) => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) });
  const hash = text => { let h = 2166136261; for (const c of text) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const randomFrom = seed => () => { let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const graphemes = text => Intl.Segmenter ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => item.segment) : Array.from(text);
  const canvas = () => document.createElement('canvas');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const linear = v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  const srgb = v => v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055;

  function colorForStitch(c, jitter) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo;
    let h = 0, s = 0, l = (hi + lo) / 2;
    if (d) {
      s = l > .5 ? d / (2 - hi - lo) : d / (hi + lo);
      h = hi === r ? (g - b) / d + (g < b ? 6 : 0) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    s = clamp(s * .96 + .008, 0, 1);
    l = clamp(l + (l > .54 ? -1 : 1) * .052 + .065 + jitter, .025, .985);
    const hue = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return { r: Math.round(hue(p, q, h + 1 / 3) * 255), g: Math.round(hue(p, q, h) * 255), b: Math.round(hue(p, q, h - 1 / 3) * 255) };
  }

  function drawStitch(ctx, s) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgb(shade(s.color, -42), .4); ctx.lineWidth = s.width * 1.7;
    ctx.beginPath(); ctx.moveTo(s.x1 + .58, s.y1 + .63); ctx.lineTo(s.x2 + .58, s.y2 + .63); ctx.stroke();
    ctx.strokeStyle = rgb(s.color, .99); ctx.lineWidth = s.width;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    ctx.strokeStyle = rgb(shade(s.color, 48), .66); ctx.lineWidth = Math.max(.34, s.width * .26);
    ctx.beginPath(); ctx.moveTo(s.x1 - .24, s.y1 - .29); ctx.lineTo(s.x2 - .24, s.y2 - .29); ctx.stroke();
  }

  function drawHole(ctx, segment, back = false) {
    const [x1, y1, x2, y2] = segment;
    const angle = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(angle);
    const a = back ? .62 : .46;
    ctx.lineWidth = .65; ctx.strokeStyle = `rgba(20,17,13,${a * .53})`;
    ctx.beginPath(); ctx.moveTo(.3, .15); ctx.quadraticCurveTo(len * .46, .48, len - .3, .15); ctx.stroke();
    ctx.strokeStyle = `rgba(255,253,242,${a * .52})`; ctx.lineWidth = .43;
    ctx.beginPath(); ctx.moveTo(.3, -.45); ctx.lineTo(len - .3, -.45); ctx.stroke();
    for (const x of [0, len]) {
      ctx.fillStyle = `rgba(12,11,9,${a * .28})`; ctx.beginPath(); ctx.ellipse(x + .18, .23, 1.8, 1.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(9,8,7,${a * .9})`; ctx.beginPath(); ctx.ellipse(x, 0, .72, .5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,248,${a * .95})`; ctx.lineWidth = .48;
      ctx.beginPath(); ctx.ellipse(x - .12, -.2, 1.15, .8, 0, Math.PI * 1.1, Math.PI * 1.96); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBackStitch(ctx, s, previous, index) {
    // The reverse reveals the words: retain a little of the photograph's hue,
    // but use dark, full stitches against the pale fabric.
    const c = mix(s.color, { r: 38, g: 34, b: 29 }, .88);
    ctx.lineCap = 'round';
    {
      ctx.strokeStyle = rgb(shade(c, -26), .24); ctx.lineWidth = s.width;
      ctx.beginPath(); ctx.moveTo(s.x1 + .35, s.y1 + .5); ctx.lineTo(s.x2 + .35, s.y2 + .5); ctx.stroke();
      ctx.strokeStyle = rgb(c, .97); ctx.lineWidth = Math.max(.85, s.width * 1.02);
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    if (previous && !(index % 3) && Math.hypot(s.x1 - previous.x2, s.y1 - previous.y2) < 24) {
      ctx.strokeStyle = rgb(c, .72); ctx.lineWidth = Math.max(.5, s.width * .5);
      ctx.beginPath(); ctx.moveTo(previous.x2, previous.y2);
      ctx.quadraticCurveTo((previous.x2 + s.x1) / 2, (previous.y2 + s.y1) / 2 + (index % 2 ? 2.2 : -2.2), s.x1, s.y1); ctx.stroke();
    }
    if (!(index % 13)) drawHole(ctx, [s.x1, s.y1, s.x2, s.y2], true);
    if (!(index % 29)) {
      ctx.strokeStyle = rgb(shade(c, -24), .84); ctx.lineWidth = Math.max(.6, s.width * .6);
      ctx.beginPath(); ctx.arc(s.x2, s.y2, Math.max(1.1, s.width * 1.4), .2, Math.PI * 1.94); ctx.stroke();
    }
  }

  function drawConnection(ctx, a, b, back, fraction = 1) {
    if (!a || !b || fraction <= 0) return;
    const dx = b.x1 - a.x2, dy = b.y1 - a.y2;
    // Travel thread joins only letters on the same written line.
    if (Math.abs(dy) > 60 || Math.abs(dx) > 100) return;
    const sag = clamp(Math.abs(dx) * .09 + Math.abs(dy) * .025, 2, back ? 13 : 7);
    ctx.lineCap = 'round'; ctx.lineWidth = back ? .9 : 1.05;
    ctx.strokeStyle = rgb(back ? shade(a.color, -15) : a.color, back ? .77 : .82);
    ctx.beginPath(); ctx.moveTo(a.x2, a.y2);
    ctx.quadraticCurveTo((a.x2 + b.x1) / 2, (a.y2 + b.y1) / 2 + sag, lerp(a.x2, b.x1, fraction), lerp(a.y2, b.y1, fraction)); ctx.stroke();
  }

  function movingThread(ctx, s, progress, removing) {
    if (!s) return;
    const travel = clamp(progress / .78, 0, 1), ease = travel * travel * (3 - 2 * travel);
    const x = lerp(s.x1, s.x2, ease), y = lerp(s.y1, s.y2, ease);
    const normal = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) - Math.PI / 2;
    const lift = removing ? 12 + 7 * progress : Math.sin(Math.PI * ease) * 10 * (1 - clamp((progress - .78) / .22, 0, 1));
    const endX = removing ? x + 14 : x, endY = removing ? y - lift * .6 : y;
    const midX = removing ? x + 4 : (s.x1 + x) / 2 + Math.cos(normal) * lift;
    const midY = removing ? y - lift : (s.y1 + y) / 2 + Math.sin(normal) * lift;
    ctx.lineCap = 'round';
    for (const [color, width, shift] of [[rgb(shade(s.color, -44), .4), s.width * 1.6, .6], [rgb(shade(s.color, removing ? 20 : 0), 1), s.width, 0], [rgb(shade(s.color, 55), .76), .36, -.2]]) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(s.x1 + shift, s.y1 + shift); ctx.quadraticCurveTo(midX + shift, midY + shift, endX + shift, endY + shift); ctx.stroke();
    }
    if (!removing && progress < .98) {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) + .55, len = 12;
      const tx = x + Math.cos(normal) * (1 - travel) * 3.5, ty = y + Math.sin(normal) * (1 - travel) * 3.5;
      ctx.strokeStyle = 'rgba(14,21,23,.6)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(tx - Math.cos(angle) * len * .7 + .5, ty - Math.sin(angle) * len * .7 + .5); ctx.lineTo(tx + Math.cos(angle) * len * .3, ty + Math.sin(angle) * len * .3); ctx.stroke();
      ctx.strokeStyle = '#f4f9f6'; ctx.lineWidth = 1.05; ctx.beginPath(); ctx.moveTo(tx - Math.cos(angle) * len * .7, ty - Math.sin(angle) * len * .7); ctx.lineTo(tx + Math.cos(angle) * len * .3, ty + Math.sin(angle) * len * .3); ctx.stroke();
      ctx.strokeStyle = '#525d60'; ctx.lineWidth = .45; ctx.beginPath(); ctx.moveTo(tx - Math.cos(angle) * len * .61, ty - Math.sin(angle) * len * .61); ctx.lineTo(tx - Math.cos(angle) * len * .42, ty - Math.sin(angle) * len * .42); ctx.stroke();
    }
  }

  class PhotoThreadRenderer {
    // Ownership is a strict server-derived flag, never a name or a truthy value.
    static owns(entry) { return entry?.canDelete === true; }
    static visibleEntries(entries, side) {
      return side === 'back' ? entries.filter(PhotoThreadRenderer.owns) : entries;
    }
    constructor({ canvas: target, image, isOpen, fontFamily }) {
      this.canvas = target; this.image = image; this.isOpen = isOpen; this.fontFamily = fontFamily;
      this.ctx = target.getContext('2d'); this.sample = canvas(); this.sampleCtx = this.sample.getContext('2d', { willReadFrequently: true });
      this.mask = canvas(); this.maskCtx = this.mask.getContext('2d', { willReadFrequently: true });
      this.scene = canvas(); this.sceneCtx = this.scene.getContext('2d');
      this.side = 'front'; this.photoId = ''; this.height = 1250; this.entries = []; this.traces = []; this.sessionTraces = [];
      this.ownTraceIds = new Set();
      this.models = new Map(); this.stitchBudget = 0; this.draft = null; this.active = null; this.frame = 0; this.token = 0; this.dirty = true;
      this.fabric = this.fabricTile();
    }
    fabricTile() {
      const tile = canvas(); tile.width = tile.height = 128; const c = tile.getContext('2d'), random = randomFrom(15032026);
      c.fillStyle = '#f4f2eb'; c.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 128; y += 3) { c.strokeStyle = `rgba(119,110,94,${.06 + random() * .045})`; c.lineWidth = .55; c.beginPath(); c.moveTo(0, y + .5); c.lineTo(128, y + .5); c.stroke(); }
      for (let x = 0; x < 128; x += 3) { c.strokeStyle = `rgba(255,255,255,${.22 + random() * .1})`; c.lineWidth = .8; c.beginPath(); c.moveTo(x + .5, 0); c.lineTo(x + .5, 128); c.stroke(); }
      for (let i = 0; i < 500; i++) { c.fillStyle = random() < .5 ? 'rgba(101,92,78,.07)' : 'rgba(255,255,255,.3)'; c.fillRect(random() * 128, random() * 128, .6 + random(), .5); }
      return tile;
    }
    setPhoto(id) {
      this.stop(); this.photoId = id; this.height = W * this.image.naturalHeight / this.image.naturalWidth;
      this.sample.width = W; this.sample.height = Math.ceil(this.height);
      this.sampleCtx.drawImage(this.image, 0, 0, W, this.height);
      this.pixels = this.sampleCtx.getImageData(0, 0, W, Math.ceil(this.height)).data;
      this.models.clear(); this.stitchBudget = 0; this.entries = []; this.traces = []; this.sessionTraces = []; this.ownTraceIds.clear(); this.draft = null; this.active = null;
      this.dirty = true;
    }
    pixelAt(x, y) {
      const i = (clamp(Math.round(y), 0, this.sample.height - 1) * W + clamp(Math.round(x), 0, W - 1)) * 4;
      return { r: this.pixels[i], g: this.pixels[i + 1], b: this.pixels[i + 2] };
    }
    sampleLocal(x, y) {
      const center = this.pixelAt(x, y); let r = 0, g = 0, b = 0, total = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const c = this.pixelAt(x + dx * .9, y + dy * .9), difference = (c.r - center.r) ** 2 + (c.g - center.g) ** 2 + (c.b - center.b) ** 2;
        const weight = Math.exp(-(dx * dx + dy * dy) / 4.5) * Math.exp(-difference / (105 * 105));
        r += linear(c.r / 255) * weight; g += linear(c.g / 255) * weight; b += linear(c.b / 255) * weight; total += weight;
      }
      return { r: Math.round(srgb(r / total) * 255), g: Math.round(srgb(g / total) * 255), b: Math.round(srgb(b / total) * 255) };
    }
    model(entry) {
      const text = graphemes(entry.text || '').slice(0, 80).join('').replace(/\s+/g, ' ');
      const key = `${entry.x}:${entry.y}:${text}`;
      if (this.models.has(key)) return this.models.get(key);
      let size = clamp(this.height * .046, 30, 58), lineHeight = size * 1.48;
      const x = Number.isFinite(entry.x) ? entry.x : .5, y = Number.isFinite(entry.y) ? entry.y : .5;
      // The chosen point is the beginning of the first glyph. Reserve enough
      // line width near the edge to keep an 80-character note on the photo.
      const left = clamp(x * W, 12, W - 260 - 12);
      const maxWidth = Math.min(560, W - left - 12);
      let font;
      const letters = graphemes(text), positions = []; let cy = 0;
      // Keep the original writing scale and prefix geometry until a long note
      // genuinely needs less height; remeasure each smaller font for wrapping.
      for (;;) {
        font = `400 ${size}px ${this.fontFamily}`; this.maskCtx.font = font;
        lineHeight = size * 1.48;
        positions.length = 0;
        let cx = 0; cy = 0;
        for (const letter of letters) {
          const metrics = this.maskCtx.measureText(letter), advance = metrics.width + size * .035;
          if (cx + advance > maxWidth && cx > 0) { cx = 0; cy += lineHeight; }
          positions.push({ letter, cx, cy, advance, metrics }); cx += advance;
        }
        if (cy + lineHeight <= this.height - 24 || size <= 14) break;
        size = Math.max(14, size * .94);
      }
      const top = clamp(y * this.height - size * .55, 12, Math.max(12, this.height - cy - lineHeight - 12));
      const model = { key, text, glyphs: [], stitches: [], size, total: 0, anchor: { x: left, y: top + size * .55 } };
      for (let index = 0; index < positions.length; index++) {
        const p = positions[index], pad = Math.ceil(size * .25 + 4), ascent = Math.max(size, p.metrics.actualBoundingBoxAscent || size);
        const width = Math.ceil(Math.max(p.advance, p.metrics.actualBoundingBoxRight || 0) + pad * 2), height = Math.ceil(ascent + Math.max(size * .25, p.metrics.actualBoundingBoxDescent || 0) + pad * 2);
        this.mask.width = width; this.mask.height = height; this.maskCtx.font = font; this.maskCtx.textBaseline = 'alphabetic'; this.maskCtx.fillStyle = '#fff';
        this.maskCtx.fillText(p.letter, pad, pad + ascent);
        const alpha = this.maskCtx.getImageData(0, 0, width, height).data;
        const inside = (x, y) => x >= 0 && x < width && y >= 0 && y < height && alpha[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] > 64;
        const glyph = { text: p.letter, x: left + p.cx - pad, y: top + p.cy - pad, width, height, stitches: [], start: model.total, tiles: {} };
        const random = randomFrom(hash(`${this.photoId}:${index}:${p.letter}`));
        const gap = clamp(size * .046, 1.5, 2.3), column = clamp(size * .068, 2.2, 3.4), half = column * .62;
        let row = 0;
        for (let py = 0; py < height; py += gap) {
          const runs = []; let begin = -1;
          for (let px = 0; px <= width; px++) { const on = inside(px, py); if (on && begin < 0) begin = px; if (!on && begin >= 0) { runs.push([begin, px - 1]); begin = -1; } }
          if (row % 2) runs.reverse();
          for (const [lo, hi] of runs) {
            const direction = row % 2 ? -1 : 1;
            for (let px = direction > 0 ? lo : hi; direction > 0 ? px <= hi : px >= lo; px += direction * column) {
              if (!inside(px, py)) continue;
              const h = Math.min(half * (.8 + random() * .37), Math.max(.6, (hi - lo) * .45));
              const tilt = 1.15 * (.8 + random() * .3) * (row % 3 === 0 ? -1 : 1), dx = (random() - .5) * .7, dy = (random() - .5) * .7;
              const mx = glyph.x + px, my = glyph.y + py;
              const stitch = { x1: mx - h + dx, y1: my - tilt + dy, x2: mx + h + dx, y2: my + tilt + dy, color: colorForStitch(this.sampleLocal(mx, my), (random() - .5) * .007), width: clamp(size * .023, .85, 1.2) };
              glyph.stitches.push(stitch);
            }
          }
          row++;
        }
        model.stitches.push(...glyph.stitches); model.total += glyph.stitches.length; model.glyphs.push(glyph);
      }
      while (this.models.size && (this.models.size >= 24 || this.stitchBudget + model.total > 65000)) {
        const oldest = this.models.keys().next().value; this.stitchBudget -= this.models.get(oldest).total; this.models.delete(oldest);
      }
      this.models.set(key, model); this.stitchBudget += model.total; return model;
    }
    tile(glyph, back) {
      const side = back ? 'back' : 'front'; if (glyph.tiles[side]) return glyph.tiles[side];
      const tile = canvas(); tile.width = Math.ceil(glyph.width + 8); tile.height = Math.ceil(glyph.height + 8); const ctx = tile.getContext('2d');
      ctx.translate(-glyph.x + 4, -glyph.y + 4);
      glyph.stitches.forEach((stitch, i) => back ? drawBackStitch(ctx, stitch, glyph.stitches[i - 1], i) : drawStitch(ctx, stitch));
      glyph.tiles[side] = tile; return tile;
    }
    paintModel(ctx, model, count = model.total) {
      const back = this.side === 'back'; let previous = null;
      for (const glyph of model.glyphs) {
        const n = clamp(count - glyph.start, 0, glyph.stitches.length);
        if (n && previous) drawConnection(ctx, previous, glyph.stitches[0], back);
        if (n === glyph.stitches.length && n) ctx.drawImage(this.tile(glyph, back), glyph.x - 4, glyph.y - 4);
        else for (let i = 0; i < n; i++) back ? drawBackStitch(ctx, glyph.stitches[i], glyph.stitches[i - 1], i) : drawStitch(ctx, glyph.stitches[i]);
        if (n) previous = glyph.stitches[Math.min(n, glyph.stitches.length) - 1];
        if (count < glyph.start + glyph.stitches.length) break;
      }
    }
    traceModel(model, from = 0, to = model.total) {
      const segments = [], indexes = [], step = Math.max(1, Math.ceil((to - from) / 600));
      for (let i = Math.ceil(from); i < to; i += step) {
        const s = model.stitches[i]; if (!s) continue;
        segments.push([s.x1 / W, s.y1 / this.height, s.x2 / W, s.y2 / this.height].map(value => Math.round(clamp(value, 0, 1) * 1e6) / 1e6)); indexes.push(i);
      }
      return { segments, indexes };
    }
    trace(entry) { return { version: 1, segments: this.traceModel(this.model(entry)).segments }; }
    paintTrace(ctx, trace, minimumIndex = -1) {
      trace.segments.forEach((s, i) => { if (trace.indexes && trace.indexes[i] < minimumIndex) return; drawHole(ctx, [s[0] * W, s[1] * this.height, s[2] * W, s[3] * this.height], this.side === 'back'); });
    }
    visibleTraces() {
      // Public puncture geometry intentionally has no persisted author identity.
      // Only this visitor's local draft traces and confirmed removals belong on
      // their reverse; all shared traces remain on the photograph's front.
      return this.side === 'back'
        ? [...this.traces.filter(trace => this.ownTraceIds.has(trace.id)), ...this.sessionTraces]
        : [...this.traces, ...this.sessionTraces];
    }
    visibleSubject() {
      const subject = this.active || this.draft;
      return this.side === 'back' && subject?.owned !== true ? null : subject;
    }
    rememberOwnTrace(trace) {
      if (trace?.id) this.ownTraceIds.add(trace.id);
      this.dirty = true;
    }
    prepareScene() {
      if (!this.dirty) return;
      this.scene.width = W; this.scene.height = Math.ceil(this.height); const ctx = this.sceneCtx;
      if (this.side === 'back') { ctx.fillStyle = ctx.createPattern(this.fabric, 'repeat'); ctx.fillRect(0, 0, W, this.height); }
      for (const trace of this.visibleTraces()) this.paintTrace(ctx, trace);
      this.sceneStitchCount = 0;
      const visibleEntries = PhotoThreadRenderer.visibleEntries(this.entries, this.side);
      const subject = this.visibleSubject();
      this.sceneEntryIds = [];
      for (const entry of visibleEntries) if (entry.id !== subject?.entryId) {
        const model = this.model(entry); this.paintModel(ctx, model);
        this.sceneStitchCount += model.total; this.sceneEntryIds.push(entry.id);
      }
      this.dirty = false;
    }
    draw() {
      if (!this.pixels || !this.isOpen()) return;
      const width = this.image.clientWidth, height = this.image.clientHeight; if (!width || !height) return;
      const dpr = Math.min(devicePixelRatio || 1, 2), cw = Math.round(width * dpr), ch = Math.round(height * dpr);
      if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
      this.prepareScene(); const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
      // Reflect the whole reverse once, including cached stitches, draft,
      // traveling thread and punctures. Stored geometry stays front-relative.
      const back = this.side === 'back';
      ctx.setTransform((back ? -1 : 1) * cw / W, 0, 0, ch / this.height, back ? cw : 0, 0);
      ctx.drawImage(this.scene, 0, 0);
      const subject = this.visibleSubject();
      if (subject && !subject.model.total) {
        const { x, y } = subject.model.anchor;
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
        ctx.lineWidth = 2.8; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
      }
      if (subject) {
        const keep = clamp(Math.floor(subject.count ?? subject.model.total), 0, subject.model.total);
        if (subject.kind === 'unsew') this.paintTrace(ctx, subject.trace, keep);
        this.paintModel(ctx, subject.model, keep);
        if (subject.kind && keep < subject.model.total && !reduced()) movingThread(ctx, subject.model.stitches[keep], (subject.count || 0) % 1, subject.kind === 'unsew');
      }
      this.canvas.dataset.side = this.side; this.canvas.dataset.animation = subject?.kind || 'idle';
      this.canvas.dataset.stitchCount = String((this.sceneStitchCount || 0) + (subject ? Math.floor(subject.count ?? subject.model.total) : 0));
      this.canvas.dataset.visibleEntryIds = [...(this.sceneEntryIds || []), ...(subject?.entryId ? [subject.entryId] : [])].join(',');
      this.canvas.dataset.ownOnly = String(this.side === 'back');
      this.canvas.dataset.traceCount = String(this.visibleTraces().reduce((n, trace) => n + trace.segments.length, 0) + (subject?.kind === 'unsew' ? subject.trace.indexes.filter(i => i >= subject.count).length : 0));
    }
    setData(entries, traces = []) { this.entries = entries; this.traces = traces.filter(trace => Array.isArray(trace.segments)); this.dirty = true; this.draw(); }
    setSide(side) { this.side = side; this.dirty = true; this.draw(); }
    clearFonts() { this.models.clear(); this.stitchBudget = 0; this.dirty = true; this.draw(); }
    stop() {
      if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.token++;
      if (this.resolveAnimation) { this.resolveAnimation(false); this.resolveAnimation = null; }
      if (this.draft) { this.draft.count = this.draft.model.total; this.draft.kind = ''; }
      if (this.active) this.dirty = true;
      this.active = null;
    }
    animate(subject, from, to, duration, token) {
      subject.count = from;
      if (reduced() || !this.isOpen()) { subject.count = to; this.draw(); return Promise.resolve(true); }
      return new Promise(resolve => {
        this.resolveAnimation = resolve; const start = performance.now();
        const tick = now => {
          if (token !== this.token || !this.isOpen()) { this.frame = 0; this.resolveAnimation = null; resolve(false); return; }
          const progress = clamp((now - start) / duration, 0, 1);
          subject.count = lerp(from, to, progress); this.draw();
          if (progress < 1) this.frame = requestAnimationFrame(tick);
          else { this.frame = 0; this.resolveAnimation = null; resolve(true); }
        };
        this.frame = requestAnimationFrame(tick);
      });
    }
    async updateDraft(entry, animate = true) {
      if (!this.pixels) return;
      const previous = this.draft, oldCount = previous ? (previous.count ?? previous.model.total) : 0;
      this.stop(); const token = this.token; const next = this.model(entry);
      let common = 0;
      if (previous) for (let i = 0; i < Math.min(previous.model.glyphs.length, next.glyphs.length); i++) {
        const a = previous.model.glyphs[i], b = next.glyphs[i];
        if (a.text !== b.text || Math.abs(a.x - b.x) > .1 || Math.abs(a.y - b.y) > .1) break;
        common += Math.min(a.stitches.length, b.stitches.length);
      }
      common = Math.min(common, oldCount);
      if (previous && oldCount > common && animate) {
        const trace = this.traceModel(previous.model, common, oldCount);
        this.draft = { owned: true, model: previous.model, count: oldCount, kind: 'unsew', trace };
        if (!await this.animate(this.draft, oldCount, common, clamp(350 + (oldCount - common) * .65, 450, 1500), token)) return;
        this.sessionTraces.push(trace); while (this.sessionTraces.reduce((n, t) => n + t.segments.length, 0) > 3000) this.sessionTraces.shift(); this.dirty = true;
      }
      if (token !== this.token) return;
      this.draft = { owned: true, model: next, count: animate ? common : next.total, kind: animate && next.total > common ? 'sew' : '' };
      if (animate && next.total > common && !await this.animate(this.draft, common, next.total, clamp(550 + (next.total - common) * 1.9, 750, 5200), token)) return;
      if (this.draft) { this.draft.kind = ''; this.draft.count = next.total; } this.draw();
    }
    async commit(entry, entries, traces) {
      const model = this.model(entry), visible = this.draft?.model.key === model.key ? this.draft.count : 0;
      this.stop(); const token = this.token; this.draft = null; this.entries = entries; this.traces = traces;
      this.active = { owned: PhotoThreadRenderer.owns(entry), entryId: entry.id, model, count: Math.min(visible || 0, model.total * .92), kind: 'sew' }; this.dirty = true;
      await this.animate(this.active, this.active.count, model.total, clamp(700 + (model.total - this.active.count) * 1.5, 900, 4300), token);
      if (token === this.token) { this.active = null; this.dirty = true; this.draw(); }
    }
    async remove(entry) {
      this.stop(); const token = this.token; const model = this.model(entry);
      this.active = { owned: PhotoThreadRenderer.owns(entry), entryId: entry.id, model, count: model.total, kind: 'unsew', trace: this.traceModel(model) }; this.dirty = true;
      await this.animate(this.active, model.total, 0, clamp(1000 + model.total * 1.55, 1600, 5000), token);
      if (token === this.token) { this.active = null; this.dirty = true; }
    }
  }
  window.PhotoThreadRenderer = PhotoThreadRenderer;
})();
