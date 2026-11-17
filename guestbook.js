(() => {
  'use strict';

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const state = { photos: [], current: null, entries: [], traces: [], side: 'front', flipping: false, flipToken: 0, x: .5, y: .5, trigger: null, request: null, generation: 0, viewGeneration: 0, operation: 0, draftRevision: 0, locale: 'ko', busyLabel: '', busy: false, loading: false, ready: false, imageFailed: false };
  const english = {
  "닫기": "Close",
  "방명록 닫기": "Close guestbook",
  "사진기법 · Photography": "Photography · ID218",
  "글을 남길 사진. 방향키로 위치를 이동하고 Enter 키로 감상을 작성하세요.": "Photograph for your note. Use the arrow keys to choose a position, then press Enter to write.",
  "사진을 불러오는 중…": "Loading photograph…",
  "사진에서 글을 남길 자리를 눌러주세요.": "Choose a spot on the photograph for your note.",
  "현재 위치: 가로 50%, 세로 50%.": "Current position: 50% across, 50% down.",
  "뒷면 보기": "View back",
  "앞면 보기": "View front",
  "솔직한 생각을 사진의 색 속에 수놓아 보세요.\n뒷면에는 내가 쓴 글만 선명하게 나타납니다.": "Stitch an honest thought into the colours of a photograph.\nOn the back, only your own words come into view.",
  "감상": "Your note",
  "어떤 장면이 마음에 남았나요?": "What stayed with you?",
  "이름 (선택)": "Name (optional)",
  "익명": "Anonymous",
  "앞면에는 모두의 글이 사진과 어우러져 남습니다. 뒷면에는 내가 쓴 글만 보입니다.": "Everyone’s stitches remain on the front, blending with the photograph. Only your own notes appear on your back view.",
  "가운데 놓기": "Place in centre",
  "남기기": "Leave a note",
  "이 브라우저에 남기기": "Save in this browser",
  "여기에 남긴 글과 바늘 자국은 이 브라우저에만 저장됩니다. 다른 방문자와 공유되지 않으며, 브라우저 데이터를 지우면 사라집니다.": "Your notes and needle marks are saved only in this browser. They are not shared with other visitors and disappear if you clear browser data.",
  "브라우저에 저장하지 못했습니다. 사이트의 저장 권한과 여유 공간을 확인해주세요.": "Could not save in this browser. Please check this site’s storage permission and available space.",
  "이 사진에 저장할 수 있는 글이 가득 찼습니다. 이전 글의 실을 풀고 다시 남겨주세요.": "This photograph has reached its note limit. Unpick an earlier note before adding another.",
  "남겨진 기억": "Memories left here",
  "내가 남긴 기억": "My memories",
  "앞면의 글은 사진 속에서 찾아보세요. 뒷면을 돌리면 내가 남긴 글을 읽고 실을 풀 수 있습니다.": "Look closely to find the words in the photograph. Turn it over to read and unpick your own notes.",
  "아직 이 사진에 남긴 글이 없습니다.": "You have not left a note on this photograph yet.",
  "사진 위에 감상을 남겨주세요": "Leave a note on the photograph",
  "다시 불러오기": "Try again",
  "사진을 불러오지 못했습니다. 다른 사진을 선택해주세요.": "Could not load this photograph. Please choose another.",
  "나의 뒷면 · 내가 남긴 글과 실의 흔적": "My reverse · my words and their thread marks",
  "연결하지 못했습니다. 잠시 후 다시 시도해주세요.": "Could not connect. Please try again in a moment.",
  "글을 너무 빠르게 남기고 있어요. 잠시 후 다시 시도해주세요.": "You are leaving notes too quickly. Please try again in a moment.",
  "이 브라우저에서 남긴 글만 지울 수 있습니다.": "You can only remove notes left from this browser.",
  "감상과 이름의 길이를 확인해주세요.": "Please check the length of your note and name.",
  "저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.": "Could not reach the guestbook. Please try again in a moment.",
  "남겨진 기억을 불러오는 중…": "Loading memories…",
  "기억을 불러오지 못했습니다.": "Could not load the memories.",
  "남겨진 기억을 불러오지 못했습니다.": "Could not load the memories left here.",
  "남길 감상을 적어주세요.": "Please write a note first.",
  "수놓는 중…": "Stitching…",
  "저장을 확인하지 못했습니다. 다시 불러온 후 확인해주세요.": "Could not confirm that your note was saved. Please reload to check.",
  "실을 당겨 마지막 땀을 마무리하고 있어요.": "Pulling the thread through the final stitch.",
  "사진 위에 기억을 수놓았습니다.": "Your memory has been stitched onto the photograph.",
  "글을 저장하지 못했습니다. 다시 시도해주세요.": "Could not save your note. Please try again.",
  "지우기": "Unpick",
  "실 푸는 중…": "Unpicking…",
  "마지막 땀부터 실을 풀고 있어요.": "Unpicking the thread, starting with the last stitch.",
  "실을 풀었습니다. 바늘 자국은 사진에 남습니다.": "The thread has been removed. The needle marks remain.",
  "지우지 못했습니다. 다시 시도해주세요.": "Could not remove your note. Please try again.",
  "아직 등록된 사진이 없습니다.": "There are no photographs here yet."
};
  const t = text => state.locale === 'en' ? (english[text] || text) : text;
  const localMode = () => window.PortfolioGuestbookStore?.mode === 'local';
  const saveLabel = () => t(localMode() ? '이 브라우저에 남기기' : '남기기');
  const saveHelpText = () => t(localMode()
    ? '여기에 남긴 글과 바늘 자국은 이 브라우저에만 저장됩니다. 다른 방문자와 공유되지 않으며, 브라우저 데이터를 지우면 사라집니다.'
    : '앞면에는 모두의 글이 사진과 어우러져 남습니다. 뒷면에는 내가 쓴 글만 보입니다.');
  let ui;
  let renderer;
  let fontFamily = '"Univers Portfolio", "Noto Serif KR", serif';

  function photos() {
    const collection = window.PORTFOLIO?.collections?.find(item => item.id === 'id218');
    return (collection?.projects || []).flatMap(project => {
      const pages = (project.chapters || []).flatMap(chapter => chapter.pages || []);
      const imageCount = pages.filter(page => page.type === 'image').length;
      let imageIndex = 0;
      return pages.flatMap((page, index) => {
        if (page.type !== 'image') return [];
        imageIndex++;
        return [{ id: page.photoId || `${project.id}-${index + 1}`, src: page.src, alt: page.alt || `${project.title} — ${page.title || imageIndex}`, label: `${project.title}${imageCount > 1 ? ` · ${imageIndex}/${imageCount}` : ''}` }];
      });
    });
  }

  function create() {
    const dialog = el('dialog', 'gb-dialog');
    dialog.setAttribute('aria-labelledby', 'gb-title');
    const header = el('header', 'gb-header');
    const title = el('h2', 'gb-title', 'Embroidered Memory');
    title.id = 'gb-title';
    const close = el('button', 'gb-close', t('닫기'));
    close.type = 'button';
    close.setAttribute('aria-label', t('방명록 닫기'));
    close.addEventListener('click', () => dialog.close());
    header.append(title, close);
    const main = el('div', 'gb-main');
    const gallery = el('section', 'gb-gallery');
    const selectLabel = el('label', 'gb-photo-label', t('사진기법 · Photography'));
    selectLabel.htmlFor = 'gb-photo-select';
    const select = el('select', 'gb-photo-select');
    select.id = 'gb-photo-select';
    const viewport = el('div', 'gb-viewport');
    const artwork = el('div', 'gb-artwork');
    artwork.tabIndex = 0;
    artwork.setAttribute('role', 'group');
    artwork.setAttribute('aria-label', t('글을 남길 사진. 방향키로 위치를 이동하고 Enter 키로 감상을 작성하세요.'));
    artwork.setAttribute('aria-describedby', 'gb-position-help');
    const image = el('img', 'gb-photo');
    image.draggable = false;
    const canvas = el('canvas', 'gb-stitches');
    canvas.setAttribute('aria-hidden', 'true');
    artwork.append(image, canvas);
    const photoStatus = el('p', 'gb-photo-status', t('사진을 불러오는 중…'));
    viewport.append(artwork, photoStatus);
    const positionHelp = el('p', 'gb-position-help', t('사진에서 글을 남길 자리를 눌러주세요.'));
    positionHelp.id = 'gb-position-help';
    const position = el('span', 'gb-visually-hidden', t('현재 위치: 가로 50%, 세로 50%.'));
    position.setAttribute('aria-live', 'polite');
    const photoFooter = el('div', 'gb-photo-footer');
    const flip = el('button', 'gb-flip', t('뒷면 보기'));
    flip.type = 'button';
    flip.setAttribute('aria-pressed', 'false');
    photoFooter.append(positionHelp, flip);
    gallery.append(selectLabel, select, viewport, photoFooter, position);

    const aside = el('section', 'gb-aside');
    const intro = el('p', 'gb-intro', t('솔직한 생각을 사진의 색 속에 수놓아 보세요.\n뒷면에는 내가 쓴 글만 선명하게 나타납니다.'));
    const form = el('form', 'gb-form');
    const textLabel = el('label', 'gb-label', t('감상'));
    textLabel.htmlFor = 'gb-message';
    const textarea = el('textarea', 'gb-message');
    textarea.id = 'gb-message';
    textarea.name = 'text';
    textarea.maxLength = 80;
    textarea.rows = 4;
    textarea.required = true;
    textarea.placeholder = t('어떤 장면이 마음에 남았나요?');
    textarea.setAttribute('aria-describedby', 'gb-count gb-save-help');
    const count = el('span', 'gb-count', '0 / 80');
    count.id = 'gb-count';
    const nameLabel = el('label', 'gb-label', t('이름 (선택)'));
    nameLabel.htmlFor = 'gb-name';
    const name = el('input', 'gb-name');
    name.id = 'gb-name';
    name.name = 'name';
    name.type = 'text';
    name.maxLength = 24;
    name.autocomplete = 'nickname';
    name.placeholder = t('익명');
    const honeypot = el('input', 'gb-honeypot');
    honeypot.type = 'text';
    honeypot.name = 'website';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.setAttribute('aria-hidden', 'true');
    const saveHelp = el('p', 'gb-save-help', saveHelpText());
    saveHelp.id = 'gb-save-help';
    const controls = el('div', 'gb-controls');
    const center = el('button', 'gb-center', t('가운데 놓기'));
    center.type = 'button';
    const submit = el('button', 'gb-submit', saveLabel());
    submit.type = 'submit';
    controls.append(center, submit);
    const status = el('p', 'gb-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    form.append(textLabel, textarea, count, nameLabel, name, honeypot, saveHelp, controls, status);
    const notes = el('section', 'gb-notes');
    notes.setAttribute('aria-labelledby', 'gb-notes-title');
    const notesTitle = el('h3', 'gb-notes-title', t('남겨진 기억'));
    notesTitle.id = 'gb-notes-title';
    const empty = el('p', 'gb-empty', t('사진 위에 감상을 남겨주세요'));
    const list = el('ol', 'gb-entry-list');
    const retry = el('button', 'gb-retry', t('다시 불러오기'));
    retry.type = 'button';
    retry.hidden = true;
    retry.addEventListener('click', () => loadEntries(state.current.id));
    notes.append(notesTitle, empty, list, retry);
    aside.append(intro, form, notes);
    main.append(gallery, aside);
    dialog.append(header, main);
    document.body.append(dialog);
    ui = { dialog, close, selectLabel, intro, textLabel, nameLabel, saveHelp, flip, positionHelp, select, viewport, artwork, image, canvas, photoStatus, position, textarea, count, name, honeypot, submit, center, status, notesTitle, empty, list, retry };
    fontFamily = getComputedStyle(dialog).fontFamily;
    renderer = new window.PhotoThreadRenderer({ canvas, image, isOpen: () => dialog.open && state.ready, fontFamily });
    flip.addEventListener('click', turnOver);

    select.addEventListener('change', () => changePhoto(select.value));
    textarea.addEventListener('input', event => {
      state.draftRevision++;
      count.textContent = `${textarea.value.length} / 80`;
      if (!event.isComposing) updateDraft();
    });
    textarea.addEventListener('compositionend', () => { state.draftRevision++; updateDraft(); });
    name.addEventListener('input', () => { state.draftRevision++; });
    form.addEventListener('submit', save);
    center.addEventListener('click', () => setPosition(.5, .5));
    artwork.addEventListener('click', event => {
      if (!state.ready || state.busy || state.flipping) return;
      const rect = image.getBoundingClientRect();
      const screenX = (event.clientX - rect.left) / rect.width;
      setPosition(state.side === 'back' ? 1 - screenX : screenX, (event.clientY - rect.top) / rect.height);
    });
    artwork.addEventListener('keydown', event => {
      const directions = { ArrowLeft: [-.025, 0], ArrowRight: [.025, 0], ArrowUp: [0, -.025], ArrowDown: [0, .025] };
      if (directions[event.key]) {
        event.preventDefault();
        if (!state.busy && !state.flipping) {
          const [dx, dy] = directions[event.key];
          setPosition(state.x + (state.side === 'back' ? -dx : dx), state.y + dy);
        }
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        textarea.focus();
      }
    });
    // Keep the page's interactive essay shortcuts out of the writing dialog.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.addEventListener('close', () => {
      state.request?.abort();
      state.generation++;
      state.viewGeneration++;
      state.operation++;
      state.busy = false;
      state.flipToken++;
      state.flipping = false;
      artwork.getAnimations().forEach(animation => animation.cancel());
      renderer.stop();
      updateBusy();
      if (state.trigger?.isConnected) state.trigger.focus({ preventScroll: true });
    });
    image.addEventListener('load', () => {
      state.ready = true;
      state.imageFailed = false;
      photoStatus.hidden = true;
      artwork.hidden = false;
      renderer.setPhoto(state.current.id);
      renderer.setSide(state.side);
      renderer.setData(state.entries, state.traces);
      updateDraft(false);
      fitPhoto();
      updateBusy();
    });
    image.addEventListener('error', () => {
      state.ready = false;
      state.imageFailed = true;
      photoStatus.hidden = false;
      photoStatus.textContent = t('사진을 불러오지 못했습니다. 다른 사진을 선택해주세요.');
      artwork.hidden = true;
      updateBusy();
    });
    new ResizeObserver(fitPhoto).observe(viewport);
    window.addEventListener('resize', fitPhoto, { passive: true });
    document.fonts?.ready.then(() => { renderer.clearFonts(); if (state.ready) updateDraft(false); });
  }


  function applyLanguage() {
    ui.dialog.lang = state.locale;
    ui.close.textContent = t('닫기');
    ui.close.setAttribute('aria-label', t('방명록 닫기'));
    ui.selectLabel.textContent = t('사진기법 · Photography');
    ui.artwork.setAttribute('aria-label', t('글을 남길 사진. 방향키로 위치를 이동하고 Enter 키로 감상을 작성하세요.'));
    ui.intro.textContent = t('솔직한 생각을 사진의 색 속에 수놓아 보세요.\n뒷면에는 내가 쓴 글만 선명하게 나타납니다.');
    ui.textLabel.textContent = t('감상');
    ui.textarea.placeholder = t('어떤 장면이 마음에 남았나요?');
    ui.nameLabel.textContent = t('이름 (선택)');
    ui.name.placeholder = t('익명');
    ui.saveHelp.textContent = saveHelpText();
    ui.center.textContent = t('가운데 놓기');
    ui.retry.textContent = t('다시 불러오기');
    ui.submit.textContent = saveLabel();
    ui.notesTitle.textContent = t('남겨진 기억');
    ui.empty.textContent = t('사진 위에 감상을 남겨주세요');
  }

  function updateBusy() {
    for (const control of [ui.textarea, ui.name]) control.disabled = state.busy;
    for (const control of [ui.select, ui.center]) control.disabled = state.busy || state.flipping;
    ui.submit.disabled = state.busy || state.loading || !state.ready;
    ui.flip.disabled = !state.ready || state.flipping;
    ui.list.querySelectorAll('.gb-delete').forEach(button => { button.disabled = state.busy; });
    ui.submit.textContent = state.busy ? state.busyLabel : saveLabel();
    ui.artwork.setAttribute('aria-disabled', String(state.busy || !state.ready));
  }

  function updatePositionLabel() {
    const screenX = state.side === 'back' ? 1 - state.x : state.x;
    ui.position.textContent = state.locale === 'en'
      ? `Current position: ${Math.round(screenX * 100)}% across, ${Math.round(state.y * 100)}% down.`
      : `현재 위치: 가로 ${Math.round(screenX * 100)}%, 세로 ${Math.round(state.y * 100)}%.`;
  }

  function setPosition(x, y, trackDraft = true) {
    const nextX = clamp(x, .02, .98), nextY = clamp(y, .02, .98);
    if (trackDraft && (nextX !== state.x || nextY !== state.y)) state.draftRevision++;
    state.x = nextX;
    state.y = nextY;
    updatePositionLabel();
    updateDraft(false);
  }

  function updateDraft(animate = true) {
    if (!state.ready || !renderer) return;
    void renderer.updateDraft({ text: ui.textarea.value, x: state.x, y: state.y }, animate);
  }

  async function turnOver() {
    if (!state.ready || state.flipping) return;
    state.flipping = true;
    const token = ++state.flipToken;
    updateBusy();
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      if (motion) await ui.artwork.animate([{ transform: 'perspective(1400px) rotateY(0deg)' }, { transform: 'perspective(1400px) rotateY(90deg)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished;
      if (token !== state.flipToken || !ui.dialog.open) return;
      state.side = state.side === 'front' ? 'back' : 'front';
      renderer.setSide(state.side);
      updatePositionLabel();
      ui.flip.textContent = state.side === 'back' ? t('앞면 보기') : t('뒷면 보기');
      ui.flip.setAttribute('aria-pressed', String(state.side === 'back'));
      ui.artwork.dataset.side = state.side;
      renderEntries();
      ui.positionHelp.textContent = state.side === 'back' ? t('나의 뒷면 · 내가 남긴 글과 실의 흔적') : t('사진에서 글을 남길 자리를 눌러주세요.');
      ui.artwork.getAnimations().forEach(animation => animation.cancel());
      if (motion) await ui.artwork.animate([{ transform: 'perspective(1400px) rotateY(-90deg)' }, { transform: 'perspective(1400px) rotateY(0deg)' }], { duration: 260, easing: 'ease-out' }).finished;
    } catch { /* Closing the dialog cancels its physical turnover. */ }
    finally { if (token === state.flipToken) { state.flipping = false; updateBusy(); } }
  }

  function fitPhoto() {
    if (!state.ready || !ui?.dialog.open) return;
    const cap = Math.max(200, window.innerHeight * (window.innerWidth < 760 ? .52 : .68));
    const width = Math.min(ui.viewport.clientWidth, ui.image.naturalWidth, cap * ui.image.naturalWidth / ui.image.naturalHeight);
    ui.artwork.style.width = `${Math.max(1, width)}px`;
    render();
  }

  async function request(url, options = {}) {
    const response = window.PortfolioGuestbookStore
      ? await window.PortfolioGuestbookStore.request(url, options)
      : await fetch(url, { credentials: 'same-origin', ...options });
    let result;
    try { result = await response.json(); }
    catch { throw new Error(t('연결하지 못했습니다. 잠시 후 다시 시도해주세요.')); }
    if (!response.ok) {
      if (result.code === 'browser_storage_unavailable') throw new Error(t('브라우저에 저장하지 못했습니다. 사이트의 저장 권한과 여유 공간을 확인해주세요.'));
      if (result.code === 'browser_storage_full') throw new Error(t('이 사진에 저장할 수 있는 글이 가득 찼습니다. 이전 글의 실을 풀고 다시 남겨주세요.'));
      if (response.status === 429) throw new Error(t('글을 너무 빠르게 남기고 있어요. 잠시 후 다시 시도해주세요.'));
      if (response.status === 403) throw new Error(t('이 브라우저에서 남긴 글만 지울 수 있습니다.'));
      if (response.status === 400) throw new Error(t('감상과 이름의 길이를 확인해주세요.'));
      throw new Error(t('저장소에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'));
    }
    return result;
  }

  async function loadEntries(photoId) {
    state.request?.abort();
    const controller = new AbortController();
    state.request = controller;
    const generation = ++state.generation;
    state.loading = true;
    updateBusy();
    ui.retry.hidden = true;
    ui.empty.hidden = false;
    ui.empty.textContent = t('남겨진 기억을 불러오는 중…');
    ui.notesTitle.textContent = t('남겨진 기억');
    try {
      const result = await request(`/api/guestbook?photo=${encodeURIComponent(photoId)}`, { signal: controller.signal });
      if (generation !== state.generation) return;
      if (!Array.isArray(result.entries)) throw new Error(t('기억을 불러오지 못했습니다.'));
      state.entries = result.entries.filter(entry => entry && typeof entry.text === 'string' && entry.photoId === photoId);
      state.traces = (Array.isArray(result.traces) ? result.traces : []).filter(trace => trace.photoId === photoId && Array.isArray(trace.segments));
      renderer.setData(state.entries, state.traces);
      renderEntries();
      render();
    } catch (error) {
      if (error.name === 'AbortError' || generation !== state.generation) return;
      ui.empty.hidden = false;
      ui.empty.textContent = localMode() ? error.message : t('남겨진 기억을 불러오지 못했습니다.');
      ui.retry.hidden = false;
    } finally {
      if (generation === state.generation) { state.loading = false; updateBusy(); }
    }
  }

  function changePhoto(id) {
    const photo = state.photos.find(item => item.id === id);
    if (!photo) return;
    if (state.current && state.current.id !== id) state.draftRevision++;
    renderer.stop();
    state.viewGeneration++;
    state.operation++;
    state.busy = false;
    state.flipToken++;
    state.flipping = false;
    ui.artwork.getAnimations().forEach(animation => animation.cancel());
    state.current = photo;
    state.entries = [];
    state.traces = [];
    state.side = 'front';
    ui.flip.textContent = t('뒷면 보기');
    ui.flip.setAttribute('aria-pressed', 'false');
    ui.artwork.dataset.side = 'front';
    ui.positionHelp.textContent = t('사진에서 글을 남길 자리를 눌러주세요.');
    state.ready = false;
    state.imageFailed = false;
    ui.status.textContent = '';
    ui.select.value = photo.id;
    ui.artwork.hidden = true;
    ui.photoStatus.hidden = false;
    ui.photoStatus.textContent = t('사진을 불러오는 중…');
    ui.list.replaceChildren();
    ui.image.alt = photo.alt;
    ui.image.src = photo.src;
    setPosition(.5, .5, false);
    updateBusy();
    void loadEntries(photo.id);
  }

  async function save(event) {
    event.preventDefault();
    if (state.busy || state.loading || !state.ready) return;
    const text = ui.textarea.value.trim();
    if (!text) { ui.status.textContent = t('남길 감상을 적어주세요.'); ui.textarea.focus(); return; }
    const photoId = state.current.id;
    const view = state.viewGeneration, operation = ++state.operation;
    const draft = { revision: state.draftRevision, text: ui.textarea.value, name: ui.name.value };
    const payload = { photoId, text, name: ui.name.value.trim(), x: state.x, y: state.y, website: ui.honeypot.value };
    state.busy = true;
    state.busyLabel = t('수놓는 중…');
    ui.status.textContent = '';
    updateBusy();
    try {
      const result = await request('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!result.entry || typeof result.entry.text !== 'string') throw new Error(t('저장을 확인하지 못했습니다. 다시 불러온 후 확인해주세요.'));
      // Saving succeeds independently of the sewing animation. Consume only
      // this submitted draft, never a newer draft written after reopening.
      const clearSavedDraft = state.current?.id === photoId
        && state.draftRevision === draft.revision
        && ui.textarea.value === draft.text && ui.name.value === draft.name;
      if (clearSavedDraft) {
        ui.textarea.value = '';
        ui.count.textContent = '0 / 80';
        state.draftRevision++;
      }
      if (view !== state.viewGeneration) {
        if (clearSavedDraft) updateDraft(false);
        if (ui.dialog.open && state.current.id === photoId) void loadEntries(photoId);
        return;
      }
      if (state.current.id === photoId) {
        state.entries = [...state.entries.filter(entry => entry.id !== result.entry.id), result.entry];
        ui.status.textContent = t('실을 당겨 마지막 땀을 마무리하고 있어요.');
        await renderer.commit(result.entry, state.entries, state.traces);
        if (view !== state.viewGeneration) return;
        ui.status.textContent = t('사진 위에 기억을 수놓았습니다.');
        renderEntries();
        render();
      }
    } catch (error) {
      if (view === state.viewGeneration) ui.status.textContent = error.message || t('글을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      if (view === state.viewGeneration && operation === state.operation) { state.busy = false; updateBusy(); }
    }
  }

  function renderEntries() {
    ui.list.replaceChildren();
    const back = state.side === 'back';
    const ownEntries = window.PhotoThreadRenderer.visibleEntries(state.entries, 'back');
    const count = back ? ownEntries.length : state.entries.length;
    ui.notesTitle.textContent = `${t(back ? '내가 남긴 기억' : '남겨진 기억')}${count ? ` · ${count}` : ''}`;
    ui.empty.hidden = back && ownEntries.length > 0;
    ui.empty.textContent = t(back ? '아직 이 사진에 남긴 글이 없습니다.' : '앞면의 글은 사진 속에서 찾아보세요. 뒷면을 돌리면 내가 남긴 글을 읽고 실을 풀 수 있습니다.');
    ui.retry.hidden = true;
    // Other visitors' words remain in the shared photograph, never in a plain
    // transcript. The readable list belongs to this visitor's reverse only.
    if (!back) return;
    for (const entry of ownEntries) {
      const item = el('li', 'gb-entry');
      const message = el('p', 'gb-entry-text', entry.text);
      const meta = el('div', 'gb-entry-meta');
      const author = el('span', 'gb-entry-author', entry.name || t('익명'));
      meta.append(author);
      if (entry.canDelete === true) {
        const remove = el('button', 'gb-delete', t('지우기'));
        remove.type = 'button';
        remove.setAttribute('aria-label', `${entry.text.slice(0, 16)}${entry.text.length > 16 ? '…' : ''} — ${state.locale === 'en' ? 'Unpick my note' : '내가 남긴 글 지우기'}`);
        remove.addEventListener('click', async () => {
          if (state.busy || !state.ready) return;
          state.busy = true;
          state.busyLabel = t('실 푸는 중…');
          updateBusy();
          const photoId = state.current.id;
          const view = state.viewGeneration, operation = ++state.operation;
          try {
            const trace = renderer.trace(entry);
            const result = await request(`/api/guestbook/${encodeURIComponent(entry.id)}`, {
              method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trace })
            });
            if (view !== state.viewGeneration) {
              if (ui.dialog.open && state.current.id === photoId) void loadEntries(photoId);
              return;
            }
            ui.status.textContent = t('마지막 땀부터 실을 풀고 있어요.');
            await renderer.remove(entry);
            if (view !== state.viewGeneration) return;
            state.entries = state.entries.filter(value => value.id !== entry.id);
            if (result.trace) {
              renderer.rememberOwnTrace(result.trace);
              state.traces.push(result.trace);
            }
            renderer.setData(state.entries, state.traces);
            renderEntries(); render();
            ui.status.textContent = t('실을 풀었습니다. 바늘 자국은 사진에 남습니다.');
            ui.textarea.focus({ preventScroll: true });
          } catch (error) {
            if (view === state.viewGeneration) ui.status.textContent = error.message || t('지우지 못했습니다. 다시 시도해주세요.');
          } finally {
            if (view === state.viewGeneration && operation === state.operation) { state.busy = false; updateBusy(); }
          }
        });
        meta.append(remove);
      }
      item.append(message, meta);
      ui.list.append(item);
    }
  }

  function render() {
    renderer?.draw();
  }

  window.PhotoGuestbook = {
    open(trigger) {
      state.locale = (trigger?.closest('[lang]')?.lang || document.documentElement.lang).startsWith('en') ? 'en' : 'ko';
      if (!ui) create();
      applyLanguage();
      state.photos = photos();
      state.trigger = trigger || document.activeElement;
      ui.select.replaceChildren(...state.photos.map(photo => {
        const option = el('option', '', photo.label);
        option.value = photo.id;
        return option;
      }));
      if (!ui.dialog.open) ui.dialog.showModal();
      if (!state.photos.length) {
        ui.photoStatus.textContent = t('아직 등록된 사진이 없습니다.');
        ui.submit.disabled = true;
        return;
      }
      changePhoto(state.current?.id || state.photos[0].id);
      ui.select.focus({ preventScroll: true });
    }
  };
})();
