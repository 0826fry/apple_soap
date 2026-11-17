(() => {
  'use strict';

  // GitHub Pages has no server. Its export explicitly chooses local storage or
  // a separately deployed API; a failed remote request never becomes local.
  const config = window.PORTFOLIO_HOSTING?.guestbook;
  const mode = config?.mode || 'same-origin';
  const basePath = '/api/guestbook';
  const project = new URL('.', document.baseURI).href;
  const localKey = `portfolio-guestbook:v1:${project}`;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const response = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
  const problem = (code, status = 400) => response({ code }, status);
  const validSegments = segments => Array.isArray(segments) && segments.length <= 600
    && segments.every(segment => Array.isArray(segment) && segment.length === 4
      && segment.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1));
  const photoIds = () => new Set((window.PORTFOLIO?.collections?.find(item => item.id === 'id218')?.projects || [])
    .flatMap(project => (project.chapters || []).flatMap(chapter => chapter.pages || [])
      .flatMap((page, index) => page.type === 'image' ? [page.photoId || `${project.id}-${index + 1}`] : [])));

  function validEntry(entry) {
    return entry && photoIds().has(entry.photoId) && typeof entry.text === 'string'
      && entry.text.trim() && Array.from(entry.text).length <= 80
      && typeof entry.name === 'string' && Array.from(entry.name).length <= 24
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(entry.text + entry.name)
      && [entry.x, entry.y].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
  }

  function readLocal() {
    const raw = localStorage.getItem(localKey);
    if (raw === null) return { version: 1, entries: [], traces: [] };
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.entries) || !Array.isArray(data.traces)
      || data.entries.length > photoIds().size * 200 || data.traces.length > photoIds().size * 80
      || !data.entries.every(entry => validEntry(entry) && uuid.test(entry.id) && typeof entry.createdAt === 'string')
      || !data.traces.every(trace => photoIds().has(trace.photoId) && uuid.test(trace.id) && validSegments(trace.segments))) {
      throw new Error('Invalid guestbook storage');
    }
    return data;
  }

  function localRequest(url, options) {
    const method = (options.method || 'GET').toUpperCase();
    const isCollection = url.pathname === basePath;
    const id = isCollection ? null : url.pathname.slice(basePath.length + 1);
    if (!isCollection && !uuid.test(id)) return problem('not_found', 404);
    if (!(isCollection ? ['GET', 'POST'] : ['DELETE']).includes(method)) return problem('method_not_allowed', 405);
    let data;
    try { data = readLocal(); }
    catch { return problem('browser_storage_unavailable', 503); }
    if (method === 'GET') {
      const photoId = url.searchParams.get('photo');
      if (!photoIds().has(photoId)) return problem('invalid_photo');
      return response({
        entries: data.entries.filter(entry => entry.photoId === photoId).map(entry => ({ ...entry, canDelete: true })),
        traces: data.traces.filter(trace => trace.photoId === photoId), hasMore: false, hasMoreTraces: false
      });
    }
    let body;
    try { body = JSON.parse(options.body || '{}'); }
    catch { return problem('invalid_input'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return problem('invalid_input');
    let result;
    if (method === 'POST') {
      const entry = {
        photoId: body.photoId,
        text: typeof body.text === 'string' ? body.text.normalize('NFC').trim() : body.text,
        name: typeof (body.name ?? '') === 'string' ? (body.name || '').normalize('NFC').trim().replace(/\s+/gu, ' ') : body.name,
        x: body.x, y: body.y
      };
      if (!validEntry(entry) || (body.website !== undefined && body.website !== '')) return problem('invalid_input');
      if (data.entries.filter(note => note.photoId === entry.photoId).length >= 200) return problem('browser_storage_full', 409);
      Object.assign(entry, { id: crypto.randomUUID(), createdAt: new Date().toISOString() });
      data.entries.push(entry);
      result = { entry: { ...entry, canDelete: true } };
    } else {
      const entry = data.entries.find(entry => entry.id === id);
      if (!entry) return problem('not_found', 404);
      if (body.trace !== undefined && (!body.trace || body.trace.version !== 1 || !validSegments(body.trace.segments))) return problem('invalid_trace');
      data.entries = data.entries.filter(entry => entry.id !== id);
      result = { ok: true };
      if (body.trace?.segments.length) {
        const trace = { id: crypto.randomUUID(), photoId: entry.photoId, segments: body.trace.segments, createdAt: new Date().toISOString() };
        data.traces.push(trace);
        const keep = new Set(data.traces.filter(item => item.photoId === entry.photoId).slice(-80).map(item => item.id));
        data.traces = data.traces.filter(item => item.photoId !== entry.photoId || keep.has(item.id));
        result.trace = trace;
      }
    }
    try { localStorage.setItem(localKey, JSON.stringify(data)); }
    catch { return problem('browser_storage_unavailable', 503); }
    return response(result, method === 'POST' ? 201 : 200);
  }

  async function request(path, options = {}) {
    options.signal?.throwIfAborted();
    if (mode === 'same-origin') return fetch(path, { credentials: 'same-origin', ...options });
    const url = new URL(path, document.baseURI);
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) return problem('not_found', 404);
    if (mode === 'local') return localRequest(url, options);
    if (mode !== 'remote') return problem('hosting_configuration', 503);
    let endpoint;
    try {
      endpoint = new URL(config.endpoint);
      if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash
        || endpoint.pathname.replace(/\/$/, '') !== basePath
        || !(endpoint.protocol === 'https:' || (endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)))) throw new Error();
    } catch { return problem('hosting_configuration', 503); }
    let token;
    try {
      const tokenKey = `portfolio-guestbook-owner:v1:${project}:${endpoint.origin}`;
      token = localStorage.getItem(tokenKey);
      if (!/^[a-f0-9]{64}$/.test(token || '')) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(tokenKey, token);
      }
    } catch { return problem('browser_storage_unavailable', 503); }
    endpoint.pathname = url.pathname;
    endpoint.search = url.search;
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(endpoint.href, { ...options, credentials: 'omit', headers });
  }

  window.PortfolioGuestbookStore = Object.freeze({ mode, request });
})();
