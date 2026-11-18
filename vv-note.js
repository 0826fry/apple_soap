/* Local, unlisted research note. No storage, navigation, or network requests. */
(() => {
  'use strict';
  const note = document.getElementById('vv-note');
  const essay = document.getElementById('essay');
  const nameplate = document.querySelector('.nameplate');
  const index = document.querySelector('.section-index');
  const prompt = document.getElementById('vv-code-dialog');
  const form = document.getElementById('vv-code-form');
  const input = document.getElementById('vv-code-input');
  const feedback = document.getElementById('vv-code-status');
  const status = document.getElementById('vv-status');
  const heading = document.getElementById('vv-masthead');
  const sheet = document.querySelector('.site-sheet');
  const skipLink = document.querySelector('.skip-link');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!note || !essay || !nameplate || !prompt || !form || !input || !heading || !sheet) return;

  let isOpen = false;
  let switching = false;
  let lastV = -Infinity;
  let origin = null;
  let promptOrigin = null;
  let holdTimer = 0;
  let holdPoint = null;
  let held = false;
  let dragged = false;
  let closeAfterEntry = false;
  const language = () => document.body.dataset.readingLanguage === 'en' ? 'en' : 'ko';
  const say = (ko, en) => { status.lang = language(); status.textContent = language() === 'en' ? en : ko; };
  const capture = () => ({ y: window.scrollY, x: window.scrollX, focus: document.activeElement });
  const ignoredTarget = target => target instanceof Element && Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));

  // The existing name remains the heading; a visually unchanged button supplies
  // keyboard and touch access to the code field without adding a visible control.
  const nameButton = document.createElement('button');
  nameButton.type = 'button';
  nameButton.className = 'vv-name-entry';
  nameButton.setAttribute('aria-label', '정현준 Hyunjoon Jeong — 코드 입력 / Enter a code');
  nameButton.setAttribute('aria-haspopup', 'dialog');
  nameButton.setAttribute('aria-controls', 'vv-code-dialog');
  while (nameplate.firstChild) nameButton.append(nameplate.firstChild);
  nameplate.append(nameButton);

  function setSwitching(value) {
    switching = value;
    sheet.inert = value;
    document.body.classList.toggle('vv-switching', value);
    sheet.setAttribute('aria-busy', String(value));
  }

  // Fade the whole composition so the masthead, text and clock change together.
  // Keep the last opacity until the layout swap is complete, avoiding a flash.
  async function fadePage(opening, duration) {
    const opacity = opening ? '1' : '0';
    if (reducedMotion.matches || typeof sheet.animate !== 'function') {
      sheet.style.opacity = opacity;
      return;
    }
    const animation = sheet.animate(
      [{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }],
      { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' }
    );
    try { await animation.finished; } catch { /* Still settle into the new page. */ }
    sheet.style.opacity = opacity;
    animation.cancel();
  }

  async function openNote(from = capture()) {
    if (isOpen || switching || document.querySelector('dialog[open]')) return;
    origin = from;
    setSwitching(true);
    closeAfterEntry = false;
    document.dispatchEvent(new CustomEvent('portfolio:before-vv-open'));
    essay.inert = true;
    if (index) index.inert = true;
    await fadePage(false, 300);
    essay.hidden = true;
    if (index) index.hidden = true;
    nameplate.hidden = true;
    heading.hidden = false;
    if (skipLink) skipLink.setAttribute('href', '#vv-masthead');
    note.hidden = false;
    note.inert = false;
    isOpen = true;
    document.body.classList.add('vv-open');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    say('시각도구연구실에 전하는 연구 노트를 열었습니다.', 'The note for Visual Instruments Lab is open.');
    await fadePage(true, 650);
    sheet.style.removeProperty('opacity');
    setSwitching(false);
    heading.focus({ preventScroll: true });
    if (closeAfterEntry) closeNote();
  }

  async function closeNote() {
    if (!isOpen || switching) return;
    setSwitching(true);
    note.inert = true;
    await fadePage(false, 250);
    note.hidden = true;
    heading.hidden = true;
    nameplate.hidden = false;
    if (skipLink) skipLink.setAttribute('href', '#essay');
    essay.hidden = false;
    essay.inert = false;
    if (index) { index.hidden = false; index.inert = false; }
    document.body.classList.remove('vv-open');
    isOpen = false;
    window.scrollTo({ top: origin?.y || 0, left: origin?.x || 0, behavior: 'instant' });
    say('포트폴리오로 돌아왔습니다.', 'Back to the portfolio.');
    await fadePage(true, 550);
    sheet.style.removeProperty('opacity');
    setSwitching(false);
    const focus = origin?.focus;
    if (focus instanceof HTMLElement && focus.isConnected && focus !== document.body) focus.focus({ preventScroll: true });
    else nameButton.focus({ preventScroll: true });
    lastV = -Infinity;
  }

  function openPrompt() {
    if (isOpen || switching || document.querySelector('dialog[open]')) return;
    lastV = -Infinity;
    promptOrigin = capture();
    input.value = '';
    input.removeAttribute('aria-invalid');
    feedback.textContent = '';
    prompt.showModal();
    input.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', event => {
    if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || ignoredTarget(event.target)) { lastV = -Infinity; return; }
    if (document.querySelector('dialog[open]')) { lastV = -Infinity; return; }
    if (event.key === 'Escape' && switching) { event.preventDefault(); closeAfterEntry = true; return; }
    if (event.key === 'Escape' && isOpen) { event.preventDefault(); closeNote(); return; }
    if (switching || isOpen) return;
    if (event.code !== 'KeyV' && event.key.toLowerCase() !== 'v') { lastV = -Infinity; return; }
    const now = performance.now();
    if (now - lastV <= 1600) { lastV = -Infinity; event.preventDefault(); openNote(); }
    else lastV = now;
  });

  function cancelHold() { clearTimeout(holdTimer); holdTimer = 0; holdPoint = null; }
  nameButton.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    held = false;
    dragged = false;
    holdPoint = { x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => { held = true; cancelHold(); openPrompt(); }, 650);
  });
  nameButton.addEventListener('pointermove', event => {
    if (holdPoint && Math.hypot(event.clientX - holdPoint.x, event.clientY - holdPoint.y) > 12) { dragged = true; cancelHold(); }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => nameButton.addEventListener(type, cancelHold));
  nameButton.addEventListener('contextmenu', event => event.preventDefault());
  nameButton.addEventListener('click', event => {
    if (dragged) { dragged = false; event.preventDefault(); return; }
    if (held) { held = false; event.preventDefault(); return; }
    openPrompt();
  });
  prompt.querySelector('.vv-code-cancel').addEventListener('click', () => prompt.close());
  prompt.addEventListener('click', event => {
    if (event.target !== prompt) return;
    const rect = prompt.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) prompt.close();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (input.value.trim().toLowerCase() !== 'vv') {
      input.setAttribute('aria-invalid', 'true');
      feedback.textContent = language() === 'en' ? 'Please check the code.' : '코드를 확인해 주세요.';
      input.select();
      return;
    }
    const from = promptOrigin || capture();
    prompt.close();
    openNote(from);
  });
  input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); feedback.textContent = ''; });
  note.querySelectorAll('[data-vv-close]').forEach(button => button.addEventListener('click', closeNote));
  window.addEventListener('blur', () => { lastV = -Infinity; cancelHold(); });
})();
