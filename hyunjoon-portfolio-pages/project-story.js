(() => {
  'use strict';
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const local = (value, language) => typeof value === 'string' ? value : value?.[language] || value?.en || value?.ko || '';

  // Editorial stories use the same image entries as the existing gallery.
  // Explicit photoId values keep guestbook notes attached when pages move.
  window.createProjectStory = ({ dialog, onOpenImage, onTitleChange }) => {
    const article = node('article', 'project-story');
    article.id = 'work-story';
    article.hidden = true;
    article.tabIndex = -1;
    dialog.querySelector('.archive-heading').after(article);
    let scrollPosition = 0;
    let lastImage = null;
    let titleSequence = null;
    let personalScene = null;
    let ending = null;
    let phase = null;
    let frame = 0;

    function updateTitle(force = false) {
      if (article.hidden || !titleSequence) return;
      const viewport = article.getBoundingClientRect();
      const readingLine = viewport.top + Math.min(article.clientHeight * .32, 220);
      // The ending follows the whole final figure, including its caption. It
      // cannot reveal OUR while the visitor is still reading that photograph.
      const next = ending && ending.getBoundingClientRect().top <= readingLine ? 'our'
        : personalScene && personalScene.getBoundingClientRect().top <= readingLine ? 'my' : 'your';
      if (!force && phase === next) return;
      phase = next;
      article.dataset.titlePhase = next;
      onTitleChange?.(titleSequence[next], next);
    }
    function queueTitle() {
      if (frame || article.hidden) return;
      frame = requestAnimationFrame(() => { frame = 0; updateTitle(); });
    }
    article.addEventListener('scroll', queueTitle, { passive: true });
    new ResizeObserver(queueTitle).observe(article);

    function playlistLinks(playlists, language, note) {
      const links = node('nav', 'story-playlists');
      links.setAttribute('aria-label', language === 'en' ? 'Project playlists' : '작업 플레이리스트');
      for (const playlist of playlists || []) {
        if (!/^https:\/\//.test(playlist.url || '')) continue;
        const link = node('a', '', `${local(playlist.label, language)} ↗`);
        link.href = playlist.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.append(link);
      }
      if (!links.childElementCount) return null;
      if (note) links.append(node('span', 'story-playlist-note', local(note, language)));
      return links;
    }

    function render(project, pages, language) {
      article.replaceChildren();
      article.lang = language;
      article.setAttribute('aria-label', `${project.title} — ${language === 'en' ? 'Project story' : '작업 이야기'}`);
      scrollPosition = 0;
      lastImage = null;
      phase = null;
      personalScene = null;
      ending = null;
      const editorial = project.editorial;
      titleSequence = editorial.titleSequence || null;
      const intro = node('section', 'story-intro');
      const overview = node('div', 'story-overview');
      const kicker = local(editorial.kicker, language);
      if (kicker) overview.append(node('p', 'story-kicker', kicker));
      const paragraphs = local(editorial.intro, language);
      for (const text of Array.isArray(paragraphs) ? paragraphs : [paragraphs]) {
        if (text) overview.append(node('p', 'story-intro-copy', text));
      }
      const introLinks = playlistLinks(editorial.playlists, language, editorial.playlistNote);
      if (introLinks) overview.append(introLinks);
      intro.append(overview);
      const questions = local(editorial.questions, language);
      if (questions?.length) {
        const aside = node('aside', 'story-questions');
        aside.append(node('h3', 'story-small-title', language === 'en' ? 'Two questions' : '두 가지 질문'));
        const list = node('ol');
        for (const question of Array.isArray(questions) ? questions : [questions]) list.append(node('li', '', question));
        aside.append(list);
        intro.append(aside);
      }
      article.append(intro);

      const sequence = pages.map((page, index) => ({ page, index }))
        .filter(({ page }) => page.type === 'image')
        .sort((a, b) => (a.page.storyOrder ?? a.index) - (b.page.storyOrder ?? b.index));
      sequence.forEach(({ page, index }, sceneIndex) => {
        const figure = node('figure', 'story-scene');
        if (page.height > page.width) figure.classList.add('story-scene--portrait');
        if (page.titlePhase === 'my') {
          personalScene = figure;
          figure.dataset.titlePhase = 'my';
        }
        const title = local(page.storyTitle, language) || page.title;
        const imageButton = node('button', 'story-photo');
        imageButton.type = 'button';
        imageButton.setAttribute('aria-label', language === 'en' ? `View photograph: ${title}` : `${title} 사진 크게 보기`);
        const image = node('img');
        image.src = page.src;
        image.alt = page.alt || title;
        image.loading = sceneIndex === 0 ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.addEventListener('load', queueTitle);
        if (page.width) image.width = page.width;
        if (page.height) image.height = page.height;
        image.addEventListener('error', () => {
          if (figure.querySelector('.story-image-error')) return;
          figure.append(node('p', 'story-image-error', language === 'en' ? 'Could not load this photograph.' : '사진을 불러오지 못했습니다.'));
        });
        imageButton.append(image);
        imageButton.addEventListener('click', () => {
          scrollPosition = article.scrollTop;
          lastImage = imageButton;
          onOpenImage(index);
        });
        const caption = node('figcaption', 'story-caption');
        const number = node('span', 'story-number', String(sceneIndex + 1).padStart(2, '0'));
        number.setAttribute('aria-hidden', 'true');
        caption.append(number, node('h3', 'story-scene-title', title));
        const memory = local(page.memory, language);
        if (memory) caption.append(node('p', 'story-memory', memory));
        if (page.song) {
          const song = node('p', 'story-song');
          song.append(node('span', 'story-detail-label', language === 'en' ? 'Chosen song' : '함께 고른 노래'), document.createTextNode(page.song));
          caption.append(song);
        }
        const approach = local(page.approach, language);
        if (approach) caption.append(node('p', 'story-approach', approach));
        const capture = local(page.capture, language);
        if (capture || page.camera) {
          const details = node('p', 'story-capture');
          if (capture) details.append(node('span', '', `${language === 'en' ? 'Photographed at' : '촬영'} · ${capture}`));
          if (page.camera) details.append(node('span', '', page.camera));
          caption.append(details);
        }
        const media = node('div', 'story-media');
        media.append(imageButton);
        if (page.companion?.src) {
          const detail = node('details', 'story-companion');
          detail.append(node('summary', '', language === 'en' ? 'Another frame from the presentation' : '함께 제시한 사진'));
          const companionImage = node('img');
          companionImage.src = page.companion.src;
          companionImage.alt = page.companion.alt || title;
          companionImage.loading = 'lazy';
          companionImage.decoding = 'async';
          if (page.companion.width) companionImage.width = page.companion.width;
          if (page.companion.height) companionImage.height = page.companion.height;
          detail.append(companionImage);
          const companionCaption = local(page.companion.caption, language);
          if (companionCaption) detail.append(node('p', '', companionCaption));
          media.append(detail);
        }
        figure.append(media, caption);
        article.append(figure);
      });
      if (titleSequence) {
        ending = node('section', 'story-ending');
        ending.dataset.titlePhase = 'our';
        ending.append(node('h3', 'story-ending-title', titleSequence.our));
        ending.append(node('p', 'story-end', language === 'en' ? 'Seven summers, together.' : '일곱 사람의 여름'));
        const endLinks = playlistLinks(editorial.playlists, language, editorial.playlistNote);
        if (endLinks) ending.append(endLinks);
        article.append(ending);
      } else article.append(node('p', 'story-end', `${project.title} · ${project.year}`));
    }

    return {
      render,
      show({ restore = false } = {}) {
        article.hidden = false;
        article.scrollTop = restore ? scrollPosition : 0;
        if (restore) lastImage?.focus({ preventScroll: true });
        updateTitle(true);
      },
      hide() { article.hidden = true; },
      clear() {
        article.hidden = true; article.replaceChildren(); scrollPosition = 0; lastImage = null;
        titleSequence = personalScene = ending = phase = null;
        delete article.dataset.titlePhase;
        cancelAnimationFrame(frame); frame = 0;
      },
      get visible() { return !article.hidden; },
    };
  };
})();
