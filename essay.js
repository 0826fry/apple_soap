(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const essay = document.querySelector('.site-sheet');
  const effects = window.createEssayEffects(essay);
  const wear = window.createEssayWear({ root: essay });
  const active = { banana: false, abracadabra: false, wear: false };
  const effectNames = { banana: 'BANANA 인력', abracadabra: 'ABRACADABRA 사라짐', wear: 'DIGITAL FADING 흔적' };
  const englishEffectNames = { banana: 'BANANA attraction', abracadabra: 'ABRACADABRA fading', wear: 'DIGITAL FADING wear' };
  const languageOf = node => (node?.closest('[lang]')?.lang || document.documentElement.lang).startsWith('en') ? 'en' : 'ko';
  let lastEffectButton = null;

  function updateEffectsUI(message) {
    document.querySelectorAll('[data-effect]').forEach(button => {
      const name = button.dataset.effect;
      button.setAttribute('aria-pressed', String(active[name]));
      button.setAttribute('aria-label', languageOf(button) === 'en'
        ? `${active[name] ? 'Turn off' : 'Turn on'} ${englishEffectNames[name]}`
        : `${effectNames[name]} 효과 ${active[name] ? '해제' : '적용'}`);
    });
    $('reset-effects').hidden = !Object.values(active).some(Boolean);
    $('effect-status').textContent = message;
  }
  document.querySelectorAll('[data-effect]').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.effect;
      active[name] = !active[name];
      if (name === 'wear') wear.setActive(active[name]);
      else effects.set(name, active[name]);
      lastEffectButton = button;
      const language = languageOf(button);
      $('effect-status').lang = language;
      updateEffectsUI(language === 'en'
        ? `${englishEffectNames[name]} ${active[name] ? 'is on. Press again to turn it off.' : 'is off.'}`
        : `${effectNames[name]} 효과를 ${active[name] ? '적용합니다. 다시 누르면 원래대로 돌아옵니다.' : '해제했습니다.'}`);
    });
  });
  function resetEffects() {
    const restoreFocus = document.activeElement === $('reset-effects');
    effects.reset();
    wear.reset();
    wear.setActive(false);
    active.banana = active.abracadabra = active.wear = false;
    const language = languageOf(lastEffectButton);
    $('effect-status').lang = language;
    updateEffectsUI(language === 'en' ? 'The text and page have been restored.' : '글자와 화면의 흔적이 원래 모습으로 돌아옵니다.');
    if (restoreFocus) lastEffectButton?.focus({ preventScroll: true });
  }
  $('reset-effects').addEventListener('click', resetEffects);
  document.addEventListener('portfolio:before-vv-open', resetEffects);
  document.querySelectorAll('[data-guestbook],#open-guestbook').forEach(button => {
    button.addEventListener('click', event => window.PhotoGuestbook.open(event.currentTarget));
  });

  const collections = window.PORTFOLIO.collections;
  const projects = new Map(collections.flatMap(collection => collection.projects.map(project => [project.id, { project, collection }])));
  const collectionNames = { id212: 'Design Studio I', id218: '사진기법', personal: '개인 작업' };
  const englishCollectionNames = { id212: 'Design Studio I', id218: 'Photography', personal: 'Independent work' };
  const dialog = $('archive');
  let filter = null, selected = null, pages = [], pageIndex = 0, trigger = null;
  let archiveLanguage = 'ko';
  let restoringRoute = false;
  let returnHash = '';
  let lastRouteURL = '';
  let copyTimer = 0;
  const archiveText = (ko, en) => archiveLanguage === 'en' ? en : ko;
  const collectionName = id => (archiveLanguage === 'en' ? englishCollectionNames : collectionNames)[id];
  const localized = value => typeof value === 'string' ? value : value?.[archiveLanguage] || value?.en || value?.ko || '';
  const archiveActions = document.createElement('div');
  archiveActions.className = 'archive-actions';
  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'archive-share inline-action';
  shareButton.id = 'archive-share';
  $('archive-close').before(archiveActions);
  archiveActions.append(shareButton, $('archive-close'));
  const storyReturn = document.createElement('button');
  storyReturn.id = 'archive-story-return';
  storyReturn.type = 'button';
  storyReturn.className = 'inline-action';
  storyReturn.hidden = true;
  $('archive-back').after(storyReturn);
  const story = window.createProjectStory?.({
    dialog,
    onOpenImage(index) {
      pageIndex = index;
      renderPage();
      writeArchiveRoute();
      storyReturn.focus({ preventScroll: true });
    },
    onTitleChange(title, phase) {
      $('archive-title').textContent = title;
      $('archive-title').dataset.storyPhase = phase;
      dialog.setAttribute('aria-label', `${title} — ${archiveText('작업 이야기', 'Project story')}`);
    },
  });
  storyReturn.addEventListener('click', () => { showStory(true); writeArchiveRoute('replace'); });

  function setArchiveLanguage(button) {
    archiveLanguage = typeof button === 'string' ? button : languageOf(button);
    dialog.lang = archiveLanguage;
    $('archive-back').textContent = archiveText('목록으로', 'Back to list');
    storyReturn.textContent = archiveText('작업 이야기로', 'Back to the story');
    const close = $('archive-close');
    close.textContent = archiveText('닫기 ', 'Close ');
    close.setAttribute('aria-label', archiveText('작업 기록 닫기', 'Close work archive'));
    const cross = document.createElement('span');
    cross.textContent = '×';
    cross.setAttribute('aria-hidden', 'true');
    close.append(cross);
    $('work-prev').setAttribute('aria-label', archiveText('이전 페이지', 'Previous page'));
    $('work-next').setAttribute('aria-label', archiveText('다음 페이지', 'Next page'));
    $('work-view').setAttribute('aria-label', archiveText('선택한 작업', 'Selected work'));
    dialog.querySelector('.page-nav')?.setAttribute('aria-label', archiveText('작업 페이지', 'Project pages'));
    $('work-error').textContent = archiveText('파일을 불러오지 못했습니다. 다른 페이지를 선택해 주세요.', 'Could not load this file. Please choose another page.');
    resetShareLabel();
  }

  function resetShareLabel() {
    clearTimeout(copyTimer);
    shareButton.textContent = archiveText('링크 복사', 'Copy link');
    shareButton.setAttribute('aria-label', archiveText('현재 작업 화면의 링크 복사', 'Copy a link to this archive view'));
  }

  // Hash routes work under any GitHub Pages subfolder without a server rewrite.
  function readArchiveRoute(hash = location.hash) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const language = ['ko', 'en'].includes(params.get('lang')) ? params.get('lang')
      : document.body.dataset.readingLanguage === 'en' ? 'en' : 'ko';
    const project = params.get('project');
    if (project && projects.has(project)) {
      const positive = value => /^\d+$/.test(value || '') && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
      return { project, language, photo: positive(params.get('photo')), page: positive(params.get('page')) };
    }
    const collection = params.get('collection');
    if (collection === 'all' || collections.some(item => item.id === collection)) return { collection, language };
    return null;
  }

  function writeArchiveRoute(mode = 'push') {
    if (restoringRoute || !dialog.open) return;
    const params = new URLSearchParams();
    if (selected) {
      params.set('project', selected.project.id);
      if (!story?.visible) {
        if (pages[pageIndex]?.type === 'image') {
          params.set('photo', String(pages.slice(0, pageIndex + 1).filter(page => page.type === 'image').length));
        } else params.set('page', String(pageIndex + 1));
      }
    } else params.set('collection', filter || 'all');
    params.set('lang', archiveLanguage);
    const url = new URL(location.href);
    url.hash = params.toString();
    if (url.href !== location.href) {
      history[mode === 'replace' ? 'replaceState' : 'pushState']({ ...history.state, portfolioArchiveReturn: returnHash }, '', url);
    }
    lastRouteURL = location.href;
    resetShareLabel();
  }

  shareButton.addEventListener('click', async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      if (!dialog.open || location.href !== url) return;
      shareButton.textContent = archiveText('복사했습니다', 'Copied');
      copyTimer = setTimeout(resetShareLabel, 1800);
    } catch {
      window.prompt(archiveText('아래 주소를 복사해 주세요.', 'Copy the address below.'), url);
    }
  });

  function clearMedia() {
    resetSwipe();
    stopImageMotion();
    const video = $('work-video');
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
    $('work-web').removeAttribute('src');
    $('work-image').removeAttribute('src');
    ['work-image', 'work-video', 'work-web'].forEach(id => $(id).hidden = true);
    $('work-error').hidden = true;
  }
  function openDialog(button, language) {
    if (!dialog.open && !readArchiveRoute()) returnHash = location.hash;
    if (button) trigger = button;
    setArchiveLanguage(language || button || (document.body.dataset.readingLanguage === 'en' ? 'en' : 'ko'));
    if (!dialog.open) dialog.showModal();
    $('archive-close').focus({ preventScroll: true });
  }
  function renderIndex() {
    clearMedia();
    story?.clear();
    delete $('archive-title').dataset.storyPhase;
    storyReturn.hidden = true;
    selected = null;
    $('archive-title').textContent = filter ? collectionName(filter) : archiveText('작업 기록', 'Work archive');
    $('archive-meta').textContent = filter ? (collections.find(c => c.id === filter)?.term || 'Independent work') : 'Selected work & experiments';
    $('archive-back').hidden = true;
    $('archive-index').hidden = false;
    $('work-view').hidden = true;
    $('archive-index').replaceChildren();
    collections.filter(c => !filter || c.id === filter).forEach(collection => {
      if (!filter) {
        const heading = document.createElement('h3');
        heading.textContent = `${collectionName(collection.id)} · ${collection.projects.length}`;
        $('archive-index').append(heading);
      }
      collection.projects.forEach(project => {
        const button = document.createElement('button');
        button.className = 'work-row';
        const title = document.createElement('span');
        title.className = 'work-name';
        title.textContent = project.title;
        const meta = document.createElement('small');
        meta.textContent = `${project.year} ↗`;
        button.append(title, meta);
        button.addEventListener('click', () => { showProject(project.id); writeArchiveRoute(); });
        $('archive-index').append(button);
      });
    });
  }
  function showProject(id) {
    selected = projects.get(id);
    if (!selected) return;
    pages = selected.project.chapters.flatMap(chapter => chapter.pages.map(page => ({ ...page, chapter: chapter.title })));
    if (selected.project.editorial) pages.sort((a, b) => (a.storyOrder ?? 0) - (b.storyOrder ?? 0));
    pageIndex = 0;
    $('archive-index').hidden = true;
    $('archive-back').hidden = false;
    if (selected.project.editorial && story) {
      story.render(selected.project, pages, archiveLanguage);
      showStory();
    } else renderPage();
    $('archive-close').focus({ preventScroll: true });
  }
  function showStory(restore = false) {
    if (!selected?.project.editorial || !story) return;
    clearMedia();
    $('work-view').hidden = true;
    storyReturn.hidden = true;
    const { project, collection } = selected;
    $('archive-title').textContent = project.title;
    $('archive-meta').textContent = `${collectionName(collection.id)} · ${project.year}`;
    dialog.setAttribute('aria-label', `${project.title} — ${archiveText('작업 이야기', 'Project story')}`);
    story.show({ restore });
  }
  function addLink(text, url) {
    const link = document.createElement('a');
    link.textContent = text;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    $('work-links').append(link);
  }
  function renderPage() {
    clearMedia();
    story?.hide();
    $('work-view').hidden = false;
    storyReturn.hidden = !selected?.project.editorial || !story;
    const { project, collection } = selected;
    const page = pages[pageIndex];
    const titlePhase = page.titlePhase === 'my' ? 'my' : 'your';
    const displayTitle = project.editorial?.titleSequence?.[titlePhase] || project.title;
    $('archive-title').textContent = displayTitle;
    if (project.editorial?.titleSequence) $('archive-title').dataset.storyPhase = titlePhase;
    else delete $('archive-title').dataset.storyPhase;
    const pageTitle = localized(page.storyTitle) || page.title;
    const redundantTitle = pageTitle === project.title || pageTitle === page.chapter;
    $('archive-meta').textContent = `${collectionName(collection.id)} · ${page.chapter}${redundantTitle ? '' : ' · ' + pageTitle}`;
    const description = localized(page.memory) || (archiveLanguage === 'ko' && project.descriptionKo) || localized(project.description) || '';
    $('work-description').textContent = description;
    $('work-description').lang = /[가-힣]/.test(description) ? 'ko' : 'en';
    $('work-description').hidden = !description;
    const element = $(page.type === 'image' ? 'work-image' : page.type === 'video' ? 'work-video' : 'work-web');
    element.hidden = false;
    if (page.type === 'image') element.alt = page.alt || page.title;
    if (page.type === 'video') {
      element.poster = page.poster || '';
      element.setAttribute('aria-label', page.alt || page.title);
    }
    if (page.type === 'web') element.title = `${project.title} — interactive work`;
    element.src = page.src;
    $('work-counter').textContent = `${pageIndex + 1} / ${pages.length}`;
    $('work-counter').setAttribute('aria-label', archiveText(`${pages.length}쪽 중 ${pageIndex + 1}쪽`, `Page ${pageIndex + 1} of ${pages.length}`));
    $('work-prev').disabled = $('work-next').disabled = pages.length < 2;
    $('work-links').replaceChildren();
    if (page.type === 'web') addLink(archiveText('새 창에서 보기 ↗', 'Open in a new tab ↗'), page.src);
    (project.links || []).filter(link => /^https:\/\//.test(link.url)).forEach(link => addLink(`${link.label} ↗`, link.url));
    dialog.setAttribute('aria-label', `${displayTitle} — ${pageTitle}`);
  }
  function navigatePage(step) {
    if (!selected || story?.visible || pages.length < 2) return;
    pageIndex = (pageIndex + step + pages.length) % pages.length;
    renderPage();
    writeArchiveRoute('replace');
  }
  document.querySelectorAll('[data-project]').forEach(button => button.addEventListener('click', () => {
    filter = projects.get(button.dataset.project)?.collection.id || null;
    openDialog(button);
    showProject(button.dataset.project);
    writeArchiveRoute();
  }));
  document.querySelectorAll('[data-collection]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.collection;
    openDialog(button);
    renderIndex();
    dialog.setAttribute('aria-label', `${collectionName(filter)} — ${archiveText('작업 기록', 'Work archive')}`);
    writeArchiveRoute();
  }));
  $('archive-back').addEventListener('click', () => {
    const previousId = selected?.project.id;
    renderIndex();
    dialog.setAttribute('aria-label', `${collectionName(filter) || archiveText('전체', 'All work')} — ${archiveText('작업 기록', 'Work archive')}`);
    const title = projects.get(previousId)?.project.title;
    [...document.querySelectorAll('.work-row')].find(button => button.querySelector('.work-name').textContent === title)?.focus({ preventScroll: true });
    writeArchiveRoute();
  });
  function closeArchive(fromRoute = false) {
    if (!dialog.open) return;
    dialog.close();
    if (!fromRoute) {
      const url = new URL(location.href);
      url.hash = returnHash;
      history.replaceState({ ...history.state, portfolioArchiveReturn: null }, '', url);
      lastRouteURL = location.href;
    }
  }
  $('archive-close').addEventListener('click', () => closeArchive());
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeArchive(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    clearMedia();
    story?.clear();
    storyReturn.hidden = true;
    trigger?.focus({ preventScroll: true });
    resetShareLabel();
  });
  $('work-prev').addEventListener('click', () => navigatePage(-1));
  $('work-next').addEventListener('click', () => navigatePage(1));
  ['work-image', 'work-video'].forEach(id => $(id).addEventListener('error', () => {
    if (dialog.open && !$(id).hidden && $(id).hasAttribute('src')) $('work-error').hidden = false;
  }));
  document.addEventListener('keydown', event => {
    if (dialog.open) {
      if (story?.visible) return;
      if (event.target.closest('video,iframe,input,textarea,select')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        navigatePage(event.key === 'ArrowRight' ? 1 : -1);
      }
    } else if (!document.querySelector('dialog[open]') && event.key === 'Escape' && Object.values(active).some(Boolean)) resetEffects();
  });

  function restoreArchiveRoute() {
    if (lastRouteURL === location.href) return;
    lastRouteURL = location.href;
    const route = readArchiveRoute();
    if (!route) { closeArchive(true); return; }
    restoringRoute = true;
    try {
      const savedReturn = history.state?.portfolioArchiveReturn;
      returnHash = typeof savedReturn === 'string' && !readArchiveRoute(savedReturn) ? savedReturn : '';
      const reuseStory = dialog.open && selected?.project.id === route.project && archiveLanguage === route.language;
      openDialog(null, route.language);
      if (route.project) {
        filter = projects.get(route.project).collection.id;
        if (!reuseStory) showProject(route.project);
        const imagePages = pages.map((page, index) => ({ page, index })).filter(item => item.page.type === 'image');
        const requested = route.photo ? imagePages[route.photo - 1]?.index : route.page ? route.page - 1 : null;
        if (Number.isInteger(requested) && requested >= 0 && requested < pages.length) {
          pageIndex = requested;
          renderPage();
        } else if (selected.project.editorial && story) showStory(reuseStory);
        else { pageIndex = 0; renderPage(); }
      } else {
        filter = route.collection === 'all' ? null : route.collection;
        renderIndex();
        dialog.setAttribute('aria-label', archiveText('작업 기록', 'Work archive'));
      }
    } finally { restoringRoute = false; }
    writeArchiveRoute('replace');
  }
  window.addEventListener('popstate', restoreArchiveRoute);
  window.addEventListener('hashchange', restoreArchiveRoute);

  // The image viewer supports touch/pen swipes and mouse drags. Native vertical
  // scrolling and pinch zoom stay available; the story, video and web are untouched.
  const swipeImage = $('work-image');
  const swipeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  swipeImage.style.touchAction = 'pan-y pinch-zoom';
  swipeImage.style.cursor = 'grab';
  swipeImage.draggable = false;
  let swipe = null;
  let imageMotion = null;
  function resetSwipe() {
    if (swipe && swipeImage.hasPointerCapture?.(swipe.id)) swipeImage.releasePointerCapture(swipe.id);
    swipe = null;
    swipeImage.style.removeProperty('transform');
    swipeImage.style.cursor = 'grab';
  }
  function stopImageMotion() { imageMotion?.cancel(); imageMotion = null; }
  function swipeAvailable() {
    return dialog.open && !story?.visible && !swipeImage.hidden && pages.length > 1 && pages[pageIndex]?.type === 'image';
  }
  swipeImage.addEventListener('pointerdown', event => {
    if (!event.isPrimary) { resetSwipe(); return; }
    if (event.button !== 0 || !swipeAvailable()) return;
    stopImageMotion();
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), horizontal: false };
    swipeImage.setPointerCapture?.(event.pointerId);
    swipeImage.style.cursor = 'grabbing';
  });
  swipeImage.addEventListener('pointermove', event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (!swipe.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { resetSwipe(); return; }
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) swipe.horizontal = true;
    if (swipe.horizontal && !swipeMotion.matches) {
      swipeImage.style.transform = `translateX(${Math.max(-100, Math.min(100, dx * .3))}px)`;
    }
  });
  swipeImage.addEventListener('pointerup', event => {
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    const elapsed = performance.now() - swipe.started;
    const threshold = Math.max(40, Math.min(90, swipeImage.clientWidth * .15));
    const moved = Math.max(-100, Math.min(100, dx * .3));
    const turn = swipe.horizontal && Math.abs(dx) > Math.abs(dy) * 1.4
      && (Math.abs(dx) >= threshold || Math.abs(dx) >= 32 && elapsed < 280);
    resetSwipe();
    if (turn && swipeAvailable()) navigatePage(dx < 0 ? 1 : -1);
    if (!swipeMotion.matches && !swipeImage.hidden && typeof swipeImage.animate === 'function') {
      imageMotion = swipeImage.animate([{ transform: `translateX(${turn ? (dx < 0 ? 22 : -22) : moved}px)`, opacity: turn ? .65 : 1 },
        { transform: 'translateX(0)', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
  });
  swipeImage.addEventListener('pointercancel', resetSwipe);
  swipeImage.addEventListener('lostpointercapture', () => { if (swipe) resetSwipe(); });
  dialog.addEventListener('close', () => { resetSwipe(); stopImageMotion(); });
  window.addEventListener('blur', () => { resetSwipe(); stopImageMotion(); });
  window.addEventListener('resize', () => { resetSwipe(); stopImageMotion(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { resetSwipe(); stopImageMotion(); } });
  // Initial deep links render only after gesture state has been initialized.
  restoreArchiveRoute();
})();
