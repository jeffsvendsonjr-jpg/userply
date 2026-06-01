(function () {
  'use strict';

  const SUPABASE_URL = 'https://nihquqccvnfuaqsxyymj.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHF1cWNjdm5mdWFxc3h5eW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1ODIsImV4cCI6MjA5NDY0MDU4Mn0.Q0ea1N8iWDoy0KzbFvL4rFYg0liZevnC3AFUDiJY1yE';
  const VERIFY_URL = `${SUPABASE_URL}/functions/v1/verify-date`;

  const PROCESSING = new Set();
  const PROCESSED_URLS = new Set();
  const RESULT_CACHE_KEY = 'userply_cache_v6_complete_ddg';
  const ANON_ID_KEY = 'userply_anon_id';
  const CACHE_TTL = 86400000;

  const SETTINGS_KEY = 'userply_settings';
  const DEFAULT_SETTINGS = { enabled: true, pillPosition: 'below', showDiagnosticNoDate: false, disabledSites: [] };

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { return { ...DEFAULT_SETTINGS }; }
  }

  function isDisabledSite() {
    const settings = getSettings();
    if (!settings.enabled) return true;
    const hostname = window.location.hostname.replace(/^www\./, '');
    return settings.disabledSites.some(s => hostname === s || hostname.endsWith('.' + s));
  }

  let REMOTE_CONFIG = null;
  let CONFIG_VERSION = 0;

  const FALLBACK_CONFIG = {
    google: {
      strategies: [
        // Google only: use true result headings. Do not use cite/breadcrumb nodes;
        // those can live inside transformed internal wrappers and create mirrored badges.
        { name: 'google-heading-only', titleSelector: '#rso a[href] h3, #search a[href] h3', linkResolver: 'closest_anchor', containerSelector: '.MjjYud, .g, div[data-sokoban-container], div' },
      ],
      snippetSelectors: ['.VwiC3b', '.s3v9rd', '.IsZvec', '.yDYNvb', '.MUxGbd', '.r025kc'],
      searchContainer: '#rso, #search > div > div',
    },
    bing: {
      strategies: [
        { name: 'algo-h2', titleSelector: '.b_algo h2', linkSelector: 'a[href^="http"]', containerSelector: '.b_algo' },
      ],
      snippetSelectors: ['.b_caption p'],
      searchContainer: '#b_results',
    },
    duckduckgo: {
      strategies: [
        // DuckDuckGo has multiple live layouts. Prefer explicit result title
        // anchors first, then fall back to classic result headings.
        { name: 'ddg-testid-title', titleSelector: 'a[data-testid="result-title-a"], [data-testid="result-title-a"] a[href]', linkResolver: 'self_or_closest_anchor', containerSelector: 'article[data-testid="result"], div[data-testid="result"], li[data-layout], article, li, .result, .web-result' },
        { name: 'ddg-result-title', titleSelector: '.result__title a[href], a.result__a[href], h2 a[href], h3 a[href]', linkResolver: 'self_or_closest_anchor', containerSelector: 'article[data-testid="result"], div[data-testid="result"], li[data-layout], article, li, .result, .web-result' },
        { name: 'ddg-heading-fallback', titleSelector: 'article h2, article h3, li h2, li h3, .result h2, .result h3', linkSelector: 'a[href]', containerSelector: 'article[data-testid="result"], div[data-testid="result"], li[data-layout], article, li, .result, .web-result' },
      ],
      snippetSelectors: ['[data-testid="result-snippet"]', '[data-testid*="snippet"]', '.result__snippet', '.result__snippet.js-result-snippet', '[data-result="snippet"]', 'article span', 'article p'],
      searchContainer: '#links, .results, [data-testid="mainline"], main',
    },
  };

  function trackEvent(eventType, metadata = {}) { }

  function getAnonId() {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) { id = 'anon_' + crypto.randomUUID(); localStorage.setItem(ANON_ID_KEY, id); }
    return id;
  }

  function today() { return new Date().toISOString().split('T')[0]; }

  function cacheGet(url) {
    try {
      const store = JSON.parse(localStorage.getItem(RESULT_CACHE_KEY) || '{}');
      const entry = store[url];
      if (!entry || Date.now() - entry.ts > CACHE_TTL) return undefined;
      return entry.data;
    } catch { return undefined; }
  }

  function cacheSet(url, data) {
    try {
      const store = JSON.parse(localStorage.getItem(RESULT_CACHE_KEY) || '{}');
      store[url] = { data, ts: Date.now() };
      const keys = Object.keys(store);
      if (keys.length > 500) { keys.sort((a, b) => store[a].ts - store[b].ts).slice(0, 100).forEach(k => delete store[k]); }
      localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(store));
    } catch { }
  }

  function getCachedConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Date.now() - data.ts > CONFIG_CACHE_TTL) return null;
      return data.configs;
    } catch { return null; }
  }

  function setCachedConfig(configs) {
    try { localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ configs, ts: Date.now() })); } catch { }
  }

  async function fetchRemoteConfig() { }

  function applyRemoteConfig(configs) { }

  function getEngineConfig(engine) {
    if (REMOTE_CONFIG && REMOTE_CONFIG[engine]) return REMOTE_CONFIG[engine];
    return FALLBACK_CONFIG[engine] || null;
  }

  function reportBreakage(engine, resultsFound) { }

  function getPillColors(status) {
    switch (status) {
      case 'verified':   return { bg: 'rgba(34,197,94,0.12)', color: '#16a34a', border: 'rgba(34,197,94,0.25)' };
      case 'first_seen': return { bg: 'rgba(14,165,233,0.12)', color: '#0284c7', border: 'rgba(14,165,233,0.25)' };
      case 'corrected':  return { bg: 'rgba(245,158,11,0.12)', color: '#d97706', border: 'rgba(245,158,11,0.25)' };
      case 'no_archive': return { bg: 'rgba(249,115,22,0.12)', color: '#ea580c', border: 'rgba(249,115,22,0.25)' };
      case 'no_date':    return { bg: 'rgba(148,163,184,0.08)', color: '#64748b', border: 'rgba(148,163,184,0.2)' };
      case 'locked':     return { bg: 'rgba(148,163,184,0.06)', color: '#94a3b8', border: 'rgba(148,163,184,0.15)' };
      default:           return { bg: 'rgba(148,163,184,0.08)', color: '#64748b', border: 'rgba(148,163,184,0.2)' };
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'verified':   return 'Date verified by archive';
      case 'first_seen': return 'First seen date from archive';
      case 'corrected':  return 'Date conflict';
      case 'no_archive': return 'No archive record found';
      case 'locked':     return 'Upgrade required for verification';
      default:           return 'Date information';
    }
  }

  function createIsolatedPill(text, status, clickUrl, debugText) {
    const host = document.createElement('span');
    host.setAttribute('data-userply', '1');
    host.dataset.userplyStatus = status;
    host.setAttribute('role', clickUrl ? 'button' : 'status');
    host.setAttribute('aria-label', `${getStatusLabel(status)}: ${text}`);
    if (debugText) host.title = debugText;
    if (clickUrl) host.setAttribute('tabindex', '0');
    host.style.cssText = 'display:inline-block;vertical-align:middle;line-height:0;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const { bg, color, border } = getPillColors(status);
    const style = document.createElement('style');
    style.textContent = `:host{all:initial;display:inline-block!important;vertical-align:middle!important;transform:none!important;direction:ltr!important;writing-mode:horizontal-tb!important;unicode-bidi:isolate!important;text-orientation:mixed!important;rotate:none!important;scale:none!important;}.pill{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;background:${bg};color:${color};border:1px solid ${border};font-size:10.5px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;white-space:nowrap;line-height:1.7;letter-spacing:0.01em;direction:ltr;writing-mode:horizontal-tb;${clickUrl?'cursor:pointer;':''}transition:outline 0.1s ease;}.pill:focus-visible{outline:2px solid ${color};outline-offset:2px;}.dot{width:5px;height:5px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;}`;
    shadow.appendChild(style);
    const pill = document.createElement('span');
    pill.className = 'pill';
    if (clickUrl) pill.setAttribute('tabindex', '0');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    pill.appendChild(dot);
    pill.appendChild(document.createTextNode(text));
    if (clickUrl) {
      const activate = (e) => { e.preventDefault(); e.stopPropagation(); trackEvent('upgrade_click', { source: 'pill' }); window.open(clickUrl, '_blank'); };
      pill.addEventListener('click', activate);
      pill.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') activate(e); });
    }
    shadow.appendChild(pill);
    requestAnimationFrame(() => { host.style.setProperty('transform', 'none', 'important'); host.style.setProperty('rotate', 'none', 'important'); host.style.setProperty('scale', 'none', 'important'); });
    return host;
  }

  function createPill(text, status, debugText) { return createIsolatedPill(text, status, null, debugText); }
  function createUnverifiedPill(dateStr, source) { return createIsolatedPill(dateStr, 'first_seen', null, source ? `userp.ly date source: ${source}` : null); }

  function formatDate(iso, precision) {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      if (precision === 'year') return d.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });
      if (precision === 'month') return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    } catch { return null; }
  }

  const DATE_QUERY_KEYS = ['date', 'published', 'updated', 'modified'];

  function toIsoDate(y, mo, d) {
    y = Number(y); mo = Number(mo); d = Number(d);
    if (y < 1995 || y > new Date().getFullYear() + 1) return null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T12:00:00Z`);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  function createDateSignal(iso, source, precision = 'day', kind = 'claimed') {
    return iso ? { iso, source, precision, kind, useful: true } : null;
  }

  function toMonthIsoDate(y, mo) {
    return toIsoDate(y, mo, 1);
  }

  function toYearIsoDate(y) {
    return toIsoDate(y, 1, 1);
  }

  function parseDateValue(text, precision) {
    if (!text) return null;
    if (precision === 'year') return toYearIsoDate(text);
    if (precision === 'month') {
      const monthMatch = /^(\d{4})-(\d{2})$/.exec(text);
      if (!monthMatch) return null;
      return toMonthIsoDate(monthMatch[1], monthMatch[2]);
    }
    const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return dayMatch ? toIsoDate(dayMatch[1], dayMatch[2], dayMatch[3]) : null;
  }

  function extractUrlPathDate(url) {
    try {
      const pathname = new URL(url).pathname;
      let match = pathname.match(/(?:^|\/)(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/);
      if (match) return createDateSignal(toIsoDate(match[1], match[2], match[3]), 'URL path date', 'day');
      match = pathname.match(/(?:^|\/)(20\d{2})-(\d{2})-(\d{2})(?:\/|$)/);
      if (match) return createDateSignal(toIsoDate(match[1], match[2], match[3]), 'URL path date', 'day');
      match = pathname.match(/(?:^|\/)(20\d{2})(\d{2})(\d{2})(?:\/|$)/);
      if (match) return createDateSignal(toIsoDate(match[1], match[2], match[3]), 'URL path date', 'day');
      match = pathname.match(/(?:^|\/)(20\d{2})\/(\d{2})(?:\/|$)/);
      if (match) return createDateSignal(toMonthIsoDate(match[1], match[2]), 'URL path date', 'month');
      match = pathname.match(/(?:^|\/)(20\d{2})(?:\/|$)/);
      if (match) return createDateSignal(toYearIsoDate(match[1]), 'URL path date', 'year');
    } catch { }
    return null;
  }

  function extractUrlQueryDate(url) {
    try {
      const parsed = new URL(url);
      for (const key of DATE_QUERY_KEYS) {
        const value = parsed.searchParams.get(key);
        if (!value) continue;
        const iso = parseDateValue(value.trim(), 'day');
        if (iso) return createDateSignal(iso, `URL ${key} query`, 'day');
      }
    } catch { }
    return null;
  }

  function extractUrlDate(url) {
    return extractUrlPathDate(url) || extractUrlQueryDate(url);
  }

  const MONTHS_PAT = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December';
  const LABELED_ABS_DATE_RE = new RegExp(`\\b(?:Updated|Published)\\s+(${MONTHS_PAT})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i');
  const ABS_DATE_RE = new RegExp(`\\b(${MONTHS_PAT})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i');
  const ABS_DATE_RE_2 = new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS_PAT})\\s+(\\d{4})`, 'i');
  const MONTH_YEAR_RE = new RegExp(`\\b(?:(?:Updated|Published)\\s+)?(${MONTHS_PAT})\\s+(\\d{4})\\b`, 'i');
  const ISO_DATE_RE = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
  const US_DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/;
  const REL_DATE_RE = /\b(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago\b/i;
  const TODAY_RE = /\b(today|yesterday)\b/i;
  const MS_PER_DAY = 86400000;

  function extractTextDate(text, source) {
    if (!text) return null;
    const labeled = LABELED_ABS_DATE_RE.exec(text);
    if (labeled) return createDateSignal(toIsoDate(labeled[3], new Date(`${labeled[1]} 1, 2000`).getMonth() + 1, labeled[2]), source || 'Visible date', 'day');
    const abs = ABS_DATE_RE.exec(text);
    if (abs) return createDateSignal(toIsoDate(abs[3], new Date(`${abs[1]} 1, 2000`).getMonth() + 1, abs[2]), source || 'Visible date', 'day');
    const abs2 = ABS_DATE_RE_2.exec(text);
    if (abs2) return createDateSignal(toIsoDate(abs2[3], new Date(`${abs2[2]} 1, 2000`).getMonth() + 1, abs2[1]), source || 'Visible date', 'day');
    const monthYear = MONTH_YEAR_RE.exec(text);
    if (monthYear) return createDateSignal(toMonthIsoDate(monthYear[2], new Date(`${monthYear[1]} 1, 2000`).getMonth() + 1), source || 'Visible date', 'month');
    const iso = ISO_DATE_RE.exec(text);
    if (iso) return createDateSignal(toIsoDate(iso[1], iso[2], iso[3]), source || 'Visible date', 'day');
    const us = US_DATE_RE.exec(text);
    if (us) return createDateSignal(toIsoDate(us[3], us[1], us[2]), source || 'Visible date', 'day');
    const todayish = TODAY_RE.exec(text);
    if (todayish) {
      const d = new Date();
      d.setUTCHours(12, 0, 0, 0);
      const offsetDays = todayish[1].toLowerCase() === 'yesterday' ? 1 : 0;
      return createDateSignal(new Date(d.getTime() - offsetDays * MS_PER_DAY).toISOString(), source || 'Visible date', 'day');
    }
    const rel = REL_DATE_RE.exec(text);
    if (rel) {
      const d = new Date();
      const amount = parseInt(rel[1], 10);
      const unit = rel[2].toLowerCase();
      if (unit === 'second') d.setUTCSeconds(d.getUTCSeconds() - amount);
      else if (unit === 'minute') d.setUTCMinutes(d.getUTCMinutes() - amount);
      else if (unit === 'hour') d.setUTCHours(d.getUTCHours() - amount);
      else if (unit === 'day' || unit === 'week') {
        const dayCount = unit === 'week' ? amount * 7 : amount;
        d.setTime(d.getTime() - dayCount * MS_PER_DAY);
      }
      else if (unit === 'month') d.setUTCMonth(d.getUTCMonth() - amount);
      else if (unit === 'year') d.setUTCFullYear(d.getUTCFullYear() - amount);
      d.setUTCHours(12, 0, 0, 0);
      return createDateSignal(d.toISOString(), source || 'Visible date', 'day');
    }
    return null;
  }

  function extractSnippetDate(container, engine) {
    const config = getEngineConfig(engine);
    const selectors = config ? config.snippetSelectors : ['.VwiC3b', '.s3v9rd', '.IsZvec', '.yDYNvb', '.MUxGbd', '.r025kc'];
    for (const sel of selectors) {
      try {
        const el = container.querySelector(sel);
        if (!el) continue;
        const signal = extractTextDate(el.textContent, 'SERP snippet date');
        if (signal) return signal;
      } catch { }
    }
    return null;
  }

  function extractBreadcrumbDate(container) {
    const selectors = ['cite', '[role="link"] cite', '.iUh30', '.tjvcx', '.TbwUpd', '[data-dtld]', '[data-testid*="breadcrumb"]'];
    for (const sel of selectors) {
      try {
        const el = container.querySelector(sel);
        if (!el) continue;
        const signal = extractTextDate(el.textContent, 'Breadcrumb date');
        if (signal) return signal;
      } catch { }
    }
    return null;
  }

  function extractVerificationDateSignal(result) {
    if (!result) return null;
    if (result.actual_date) {
      const actual = new Date(result.actual_date);
      if (!isNaN(actual.getTime())) return createDateSignal(actual.toISOString(), 'Verified date', 'day', 'verified');
    }
    if (result.first_seen) {
      const firstSeen = new Date(result.first_seen);
      if (!isNaN(firstSeen.getTime())) return createDateSignal(firstSeen.toISOString(), 'Archive first seen', 'day', 'first_seen');
    }
    return null;
  }

  function findVisibleSerpDateSignal(container, titleEl) {
    return extractSnippetDate(container, detectEngine())
      || extractBreadcrumbDate(container)
      || extractTextDate(titleEl && titleEl.textContent, 'Title text date')
      || null;
  }

  function findIndependentDateSignal(url, verificationResult) {
    return extractVerificationDateSignal(verificationResult)
      || extractUrlPathDate(url)
      || extractUrlQueryDate(url)
      || null;
  }

  function chooseDisplayDateSignal(visibleSignal, independentSignal) {
    return independentSignal || visibleSignal || null;
  }

  function normalizeApiResult(result) {
    if (!result || typeof result !== 'object') return null;
    const out = { ...result };
    out.actual_date = out.actual_date || out.actualDate || out.verified_date || out.verifiedDate || out.published_date || out.publishedDate || null;
    out.first_seen = out.first_seen || out.firstSeen || out.archive_date || out.archiveDate || null;
    out.claimed_date = out.claimed_date || out.claimedDate || out.claimed || null;
    if (!out.status) {
      if (out.actual_date) out.status = 'verified';
      else if (out.first_seen) out.status = 'first_seen';
      else out.status = 'no_date';
    }
    if ((out.status === 'no_date' || out.status === 'no_archive') && (out.actual_date || out.first_seen)) {
      out.status = out.actual_date ? 'verified' : 'first_seen';
    }
    return out;
  }

  function getDebugText(url, result, source) {
    const status = result && result.status ? result.status : 'no_result';
    return `userp.ly debug: status=${status}; source=${source || 'api'}; url=${url}`;
  }

  const QUEUE = [];
  let ACTIVE = 0;
  let VERIFY_BACKOFF_UNTIL = 0;
  const VERIFY_RATE_LIMIT_BACKOFF_MS = 60000;
  const VERIFY_TRANSIENT_BACKOFF_MS = 15000;
  function enqueue(fn) { return new Promise((resolve, reject) => { QUEUE.push(() => fn().then(resolve).catch(reject)); drain(); }); }
  function drain() { while (ACTIVE < 3 && QUEUE.length > 0) { const task = QUEUE.shift(); ACTIVE++; task().finally(() => { ACTIVE--; drain(); }); } }

  function getRetryAfterMs(value) {
    if (!value) return 0;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const retryAt = Date.parse(value);
    return Number.isNaN(retryAt) ? 0 : Math.max(0, retryAt - Date.now());
  }

  function getVerifyBackoffRemaining() {
    const remaining = VERIFY_BACKOFF_UNTIL - Date.now();
    if (remaining <= 0) {
      VERIFY_BACKOFF_UNTIL = 0;
      return 0;
    }
    return remaining;
  }

  function applyVerifyBackoff(ms = VERIFY_TRANSIENT_BACKOFF_MS) {
    VERIFY_BACKOFF_UNTIL = Math.max(VERIFY_BACKOFF_UNTIL, Date.now() + ms);
  }

  function verifyDateViaBackground(url, claimedDate) {
    return new Promise((resolve) => {
      try {
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return resolve({ ok: false, transportError: true, error: 'Chrome runtime API unavailable' });
        chrome.runtime.sendMessage(
          { type: 'USERPLY_VERIFY_DATE', url, claimedDate: claimedDate || null, anonymousId: getAnonId() },
          (response) => {
            if (chrome.runtime.lastError) return resolve({ ok: false, transportError: true, error: chrome.runtime.lastError.message });
            resolve(response || { ok: false });
          }
        );
      } catch (error) { resolve({ ok: false, transportError: true, error: error?.message || 'Date verification message failed' }); }
    });
  }

  async function verifyDateDirect(url, claimedDate) {
    try {
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ url, claimed_date: claimedDate || undefined, anonymous_id: getAnonId() }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { ok: false, status: res.status, retryAfterMs: res.status === 429 ? getRetryAfterMs(res.headers.get('retry-after')) : (res.status >= 500 ? VERIFY_TRANSIENT_BACKOFF_MS : 0) };
      return { ok: true, data: await res.json() };
    } catch (error) { return { ok: false, transportError: true, error: error?.message || 'Date verification request failed' }; }
  }

  async function verifyDate(url, claimedDate) {
    const cached = cacheGet(url);
    if (cached !== undefined) return cached;
    if (getVerifyBackoffRemaining() > 0) return null;
    return enqueue(async () => {
      const c2 = cacheGet(url);
      if (c2 !== undefined) return c2;
      if (getVerifyBackoffRemaining() > 0) return null;
      let response = await verifyDateViaBackground(url, claimedDate);
      if (response && response.transportError) {
        const directResponse = await verifyDateDirect(url, claimedDate);
        response = directResponse;
      }
      if (response && response.ok && response.data) {
        cacheSet(url, response.data);
        return response.data;
      }
      if (response && (response.status === 429 || response.retryAfterMs)) {
        applyVerifyBackoff(response.retryAfterMs || VERIFY_RATE_LIMIT_BACKOFF_MS);
      } else if (response && response.transportError) {
        applyVerifyBackoff();
      }
      return null;
    });
  }

  function neutralizeAncestorTransforms(el) {
    // Intentionally no-op. The extension must never alter Google/Bing/DDG
    // result ancestors, because search pages sometimes use transforms for
    // layout. Touch only userp.ly's own injected nodes.
  }

  function placeBadgeWrapper(container, titleEl, wrapper) {
    const engine = detectEngine();

    // Google's title/URL crumbs can sit inside internal transformed wrappers.
    // Putting our badge next to the anchor can inherit those transforms and mirror the badge.
    // For Google, anchor the badge only at the safe top-level result block.
    if (engine === 'google' && container) {
      const rso = document.querySelector('#rso') || document.querySelector('#search');
      const safeContainer = container.closest('.MjjYud, .g, div[data-sokoban-container]') || container;
      if (!rso || rso.contains(safeContainer)) {
        safeContainer.querySelectorAll(':scope > [data-userply-wrapper]').forEach(el => el.remove());
        wrapper.style.display = 'block';
        wrapper.style.width = 'max-content';
        wrapper.style.margin = '0 0 4px 0';
        safeContainer.insertBefore(wrapper, safeContainer.firstChild || null);
        return;
      }
    }

    if ((engine === 'duckduckgo' || engine === 'bing') && container) {
      const existing = container.querySelector(':scope > [data-userply-wrapper]');
      if (existing) existing.remove();
      wrapper.style.display = 'block';
      wrapper.style.width = 'max-content';
      wrapper.style.margin = '0 0 4px 0';
      const heading = container.querySelector('h2, h3, [data-testid="result-title-a"], .result__title') || titleEl;
      const headingRow = heading && heading.parentElement ? heading.parentElement : null;
      if (headingRow && container.contains(headingRow)) {
        headingRow.insertBefore(wrapper, heading.nextSibling || null);
      } else {
        container.insertBefore(wrapper, container.firstChild || null);
      }
      return;
    }

    const h3 = container ? (container.querySelector('h3, [role="heading"]') || titleEl) : titleEl;
    const link = h3 ? h3.closest('a[href]') : null;
    const anchor = link || h3 || titleEl;
    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(wrapper, anchor.nextSibling);
      return;
    }
    if (container) container.insertBefore(wrapper, container.firstChild || null);
  }

  function getDebugModeEnabled() {
    return Boolean(getSettings().showDiagnosticNoDate);
  }

  function removeInjectedPill(container, titleEl) {
    if (container) {
      const existing = container.querySelector('[data-userply-wrapper]');
      if (existing) existing.remove();
    }
    const existingInTitle = titleEl && titleEl.querySelector ? titleEl.querySelector('[data-userply]') : null;
    if (existingInTitle) existingInTitle.remove();
  }

  function injectVerificationPill(titleEl, result, container, bestSignal) {
    removeInjectedPill(container, titleEl);
    const settings = getSettings();
    if (bestSignal && bestSignal.iso) setSortDate(container || titleEl, bestSignal.iso);
    let pill;
    if (!result) {
      if (!getDebugModeEnabled()) return;
      pill = createPill('No date', 'no_date');
    } else {
      let text = ''; let status = result.status;
      switch (result.status) {
        case 'verified':
          text = formatDate(result.actual_date || result.first_seen);
          break;
        case 'first_seen':
          text = `First seen: ${formatDate(result.first_seen)}`;
          break;
        case 'corrected': {
          const archiveDate = formatDate(result.actual_date || result.first_seen);
          const claimedDate = formatDate(result.claimed_date);
          text = archiveDate && claimedDate ? `Date conflict: ${archiveDate} vs ${claimedDate}` : 'Date conflict';
          break;
        }
        case 'no_archive':
          if (!getDebugModeEnabled()) return;
          text = 'No archive record';
          break;
        default:
          if (!getDebugModeEnabled()) return;
          text = 'No date';
          status = 'no_date';
      }
      pill = createPill(text, status, result && result._debugUrl ? getDebugText(result._debugUrl, result, result._debugSource) : null);
      if (result.confidence && result.confidence < 0.5) pill.style.opacity = '0.7';
    }
    const isInline = settings.pillPosition === 'inline';
    const wrapper = document.createElement(isInline ? 'span' : 'div');
    wrapper.setAttribute('data-userply-wrapper', '1');
    wrapper.style.cssText = [isInline ? 'display:inline;margin-left:6px' : 'display:block;margin:4px 0 0 0', 'padding:0', 'transform:none !important', 'direction:ltr !important', 'unicode-bidi:isolate !important', 'writing-mode:horizontal-tb !important', 'position:relative', 'z-index:1', 'rotate:none !important', 'scale:none !important', 'contain:layout style', 'isolation:isolate', 'text-align:left'].join(';');
    wrapper.appendChild(pill);
    placeBadgeWrapper(container, titleEl, wrapper);
  }

  function injectLocalDatePill(titleEl, signal, container) {
    if (!signal || !signal.iso) return;
    removeInjectedPill(container, titleEl);
    const settings = getSettings();
    setSortDate(container || titleEl, signal.iso);
    const pill = createUnverifiedPill(formatDate(signal.iso, signal.precision) || signal.iso, signal.source || 'Visible date');
    const isInline = settings.pillPosition === 'inline';
    const wrapper = document.createElement(isInline ? 'span' : 'div');
    wrapper.setAttribute('data-userply-wrapper', '1');
    wrapper.style.cssText = [isInline ? 'display:inline;margin-left:6px' : 'display:block;margin:4px 0 0 0', 'padding:0', 'transform:none !important', 'direction:ltr !important', 'unicode-bidi:isolate !important', 'writing-mode:horizontal-tb !important', 'position:relative', 'z-index:1', 'rotate:none !important', 'scale:none !important', 'contain:layout style', 'isolation:isolate', 'text-align:left'].join(';');
    wrapper.appendChild(pill);
    placeBadgeWrapper(container, titleEl, wrapper);
  }

  async function processResult(container, titleEl, url, engine) {
    if (!container || !titleEl || !url) return;
    if (PROCESSING.has(url) || PROCESSED_URLS.has(url) || container.hasAttribute('data-userply-processed')) return;
    PROCESSING.add(url);
    PROCESSED_URLS.add(url);
    container.setAttribute('data-userply-processed', '1');
    try {
      const visibleSignal = findVisibleSerpDateSignal(container, titleEl);
      const claimedDate = visibleSignal && visibleSignal.iso;
      const placeholderWrapper = document.createElement('div');
      placeholderWrapper.setAttribute('data-userply-wrapper', '1');
      placeholderWrapper.style.cssText = 'display:block;width:max-content;margin:4px 0 0 0;transform:none!important;rotate:0deg!important;scale:1!important;direction:ltr!important;unicode-bidi:isolate!important;writing-mode:horizontal-tb!important;text-align:left!important;isolation:isolate!important;';
      const placeholder = document.createElement('span');
      placeholder.setAttribute('data-userply', '1');
      placeholder.style.cssText = 'display:inline-block;width:80px;height:14px;border-radius:10px;background:rgba(148,163,184,0.15);animation:userply-pulse 1.4s ease-in-out infinite;';
      placeholderWrapper.appendChild(placeholder);
      if (!container.querySelector('[data-userply-wrapper]')) {
        placeBadgeWrapper(container, titleEl, placeholderWrapper);
      }
      const result = normalizeApiResult(await verifyDate(url, claimedDate));
      const independentSignal = findIndependentDateSignal(url, result);
      const bestSignal = chooseDisplayDateSignal(visibleSignal, independentSignal);
      if (placeholderWrapper.parentElement) placeholderWrapper.remove();
      if (!result) {
        if (bestSignal) { injectLocalDatePill(titleEl, bestSignal, container); }
        else { injectVerificationPill(titleEl, { status: 'no_date' }, container, null); }
      } else if (result.actual_date || result.first_seen) {
        result._debugUrl = url;
        result._debugSource = 'verification API';
        injectVerificationPill(titleEl, result, container, bestSignal);
      } else if (result.status === 'corrected') {
        result._debugUrl = url;
        result._debugSource = 'verification API';
        injectVerificationPill(titleEl, result, container, bestSignal);
      } else if (bestSignal) {
        injectLocalDatePill(titleEl, bestSignal, container);
      } else if (!bestSignal && (result.status === 'no_archive' || result.status === 'no_date')) {
        injectVerificationPill(titleEl, result, container, null);
      } else {
        result._debugUrl = url;
        result._debugSource = (bestSignal && bestSignal.source) || 'verification API';
        injectVerificationPill(titleEl, result, container, bestSignal);
      }
      repairFlippedSearchText();
    } catch { const ph = container.querySelector('[data-userply-wrapper]'); if (ph) ph.remove(); }
    finally { PROCESSING.delete(url); }
  }

  const BLOCKED_RE = /^(www\.)?(google\.|youtube\.|gstatic\.|googleusercontent\.|googleapis\.|googlesyndication\.|doubleclick\.|bing\.|microsoft\.|duckduckgo\.)/i;
  function isBlockedHostname(hostname) { if (!hostname) return true; if (BLOCKED_RE.test(hostname)) return true; if (hostname.endsWith('.google.com') || hostname === 'google.com') return true; return false; }
  function decodeBingRedirectValue(value) {
    if (!value) return null;
    try {
      let v = value;
      // Bing commonly stores the destination in a URL-safe base64-ish `u` param,
      // often prefixed with `a1`. Decode it before hostname filtering so real
      // Bing results are not mistaken for internal bing.com links.
      if (v.startsWith('a1')) v = v.slice(2);
      v = v.replace(/-/g, '+').replace(/_/g, '/');
      while (v.length % 4) v += '=';
      const decoded = atob(v);
      if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://'))) return decoded;
    } catch { }
    try {
      const decoded = decodeURIComponent(value);
      if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://'))) return decoded;
    } catch { }
    return null;
  }

  function resolveUrl(href) {
    try {
      const u = new URL(href, location.href);
      const direct = u.searchParams.get('uddg') || u.searchParams.get('q') || u.searchParams.get('url');
      if (direct) {
        try {
          const decodedDirect = decodeURIComponent(direct);
          if (decodedDirect.startsWith('http://') || decodedDirect.startsWith('https://')) return decodedDirect;
        } catch { }
        if (direct.startsWith('http://') || direct.startsWith('https://')) return direct;
      }
      if (/bing\.com$/i.test(u.hostname) || /\.bing\.com$/i.test(u.hostname)) {
        const decoded = decodeBingRedirectValue(u.searchParams.get('u')) || decodeBingRedirectValue(u.searchParams.get('r'));
        if (decoded) return decoded;
      }
    } catch { }
    return href;
  }

  function canonicalizeResultUrl(href) {
    try {
      const u = new URL(resolveUrl(href));
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','igshid'].forEach(k => u.searchParams.delete(k));
      u.hash = '';
      return u.toString();
    } catch { return resolveUrl(href); }
  }

  function detectEngine() { const host = window.location.hostname; if (/google\./i.test(host)) return 'google'; if (/bing\./i.test(host)) return 'bing'; if (/duckduckgo\./i.test(host)) return 'duckduckgo'; return null; }


  function repairFlippedSearchText() { }

  function findSafeResultContainer(el, link, strategy) {
    const engine = detectEngine();
    if (engine === 'google') {
      const rso = document.querySelector('#rso') || document.querySelector('#search');
      const preferred = el.closest('.MjjYud, .g, div[data-sokoban-container]') || link.closest('.MjjYud, .g, div[data-sokoban-container]');
      if (preferred && (!rso || rso.contains(preferred))) return preferred;
      let node = el.parentElement;
      while (node && node.parentElement && node.parentElement !== rso && node !== document.body) node = node.parentElement;
      if (node && rso && node.parentElement === rso) return node;
    }
    if (engine === 'duckduckgo') {
      const preferred = el.closest('article[data-testid="result"], div[data-testid="result"], li[data-layout], article, li, .result, .web-result') || link.closest('article[data-testid="result"], div[data-testid="result"], li[data-layout], article, li, .result, .web-result');
      if (preferred) return preferred;
    }
    if (engine === 'bing') {
      const preferred = el.closest('.b_algo') || link.closest('.b_algo');
      if (preferred) return preferred;
    }
    return el.closest(strategy.containerSelector) || link.closest(strategy.containerSelector) || el.parentElement || el;
  }

  function getResultLinks() {
    const engine = detectEngine();
    if (!engine) return [];
    const config = getEngineConfig(engine);
    if (!config) return [];
    const results = [];
    const seen = new Set();
    for (const strategy of config.strategies) {
      const elements = document.body.querySelectorAll(strategy.titleSelector);
      elements.forEach(el => {
        if (el.dataset.userplyDone) return;
        let link = null;
        let url = null;
        if (strategy.linkResolver === 'closest_anchor') { link = el.closest('a[href]'); }
        else if (strategy.linkResolver === 'self_or_closest_anchor') { link = (el.matches && el.matches('a[href]')) ? el : el.closest('a[href]'); if (!link) link = el.querySelector && el.querySelector('a[href]'); }
        else if (strategy.linkResolver === 'walk_parent_or_child_anchor') {
          let node = el.parentElement;
          for (let i = 0; i < 10 && node && node !== document.body; i++) { if (node.tagName === 'A' && node.href) { link = node; break; } const a = node.querySelector('a[href]'); if (a && a.href) { link = a; break; } node = node.parentElement; }
        } else if (strategy.linkResolver === 'walk_parent_15') {
          let node = el.parentElement;
          for (let i = 0; i < 15 && node && node !== document.body; i++) { if (node.tagName === 'A' && node.href) { link = node; break; } const a = node.querySelector('a[href]'); if (a) { try { if (!isBlockedHostname(new URL(resolveUrl(a.href)).hostname)) { link = a; break; } } catch { } } node = node.parentElement; }
        } else if (strategy.linkSelector) {
          const container = el.closest(strategy.containerSelector) || el;
          link = container.querySelector(strategy.linkSelector) || el.querySelector('a[href^="http"]');
          if (!link) { const parentContainer = el.closest('article,li,[data-testid]'); if (parentContainer) link = parentContainer.querySelector(strategy.linkSelector); }
        }
        if (!link || !link.href) return;
        url = canonicalizeResultUrl(link.href);
        try { if (isBlockedHostname(new URL(url).hostname)) return; } catch { return; }
        if (seen.has(url) || PROCESSED_URLS.has(url) || PROCESSING.has(url)) return;
        seen.add(url);
        const container = findSafeResultContainer(el, link, strategy);
        if (!container || container.hasAttribute('data-userply-processed') || container.querySelector('[data-userply-wrapper]')) return;
        el.dataset.userplyDone = '1';
        const titleEl = engine === 'duckduckgo'
          ? (container.querySelector('[data-testid="result-title-a"], .result__title a, a.result__a, h2, h3, [role="heading"]') || el)
          : (container.querySelector('h3, [role="heading"]') || el);
        results.push({ container, url, titleEl, engine });
      });
    }
    return results;
  }

  const SORT_MODE_NORMAL = 'normal';
  const SORT_MODE_NEWEST = 'newest';
  const SORT_MODE_OLDEST = 'oldest';
  let SORT_STATE = SORT_MODE_NORMAL;
  let ORIGINAL_ORDER = null;
  let DATE_SORT_ENABLED = false;
  let LICENSE_STATUS_LOADING = false;
  let LICENSE_STATUS_RESOLVED = false;

  function getSearchContainer() {
    const engine = detectEngine();
    const config = getEngineConfig(engine);
    if (config && config.searchContainer) { const selectors = config.searchContainer.split(',').map(s => s.trim()); for (const sel of selectors) { const el = document.querySelector(sel); if (el) return el; } }
    return document.querySelector('#rso') || document.querySelector('#search > div > div') || document.querySelector('#b_results') || document.querySelector('.results') || document.querySelector('#links');
  }

  function getSortableResultBlock(el) {
    const searchContainer = getSearchContainer();
    if (!searchContainer || !el) return el;
    let node = el;
    while (node && node.parentElement && node.parentElement !== searchContainer && node !== searchContainer && node !== document.body) node = node.parentElement;
    return (node && node.parentElement === searchContainer) ? node : el;
  }

  function normalizeSortDate(isoDate) {
    if (!isoDate) return null;
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function setSortDate(container, isoDate) {
    const stampedDate = normalizeSortDate(isoDate);
    if (!container || !stampedDate) return;
    const sortable = getSortableResultBlock(container);
    sortable.setAttribute('data-userply-sortable', '1');
    sortable.setAttribute('data-userply-sort-date', stampedDate);
    container.setAttribute('data-userply-sortable', '1');
    container.setAttribute('data-userply-sort-date', stampedDate);
    // Sorting disabled in this hard-normal build; stamp date only.
  }

  function getResultSortDate(result) {
    if (!result) return null;
    return result.actual_date || result.first_seen || result.claimed_date || null;
  }

  function parsePillDate(el) {
    const stampedDate = el.getAttribute('data-userply-sort-date') || el.querySelector('[data-userply-sort-date]')?.getAttribute('data-userply-sort-date');
    if (stampedDate) { const d = new Date(stampedDate); if (!isNaN(d.getTime())) return d; }
    const text = (el.textContent || '').trim();
    const dateMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i);
    if (dateMatch) { const d = new Date(dateMatch[0]); return isNaN(d.getTime()) ? null : d; }
    const yearMatch = text.match(/\b(20\d{2})\b/);
    if (yearMatch) return new Date(`${yearMatch[1]}-06-15`);
    return null;
  }

  function getSortableChildren(container) {
    return [...container.children].filter(el => el.id !== 'userply-sort');
  }

  function syncOriginalOrder(children) {
    if (!ORIGINAL_ORDER) ORIGINAL_ORDER = [...children];
    else {
      ORIGINAL_ORDER = ORIGINAL_ORDER.filter(el => children.includes(el));
      children.forEach(el => { if (!ORIGINAL_ORDER.includes(el)) ORIGINAL_ORDER.push(el); });
    }
    return ORIGINAL_ORDER;
  }

  function enforceSortAccess() {
    if (DATE_SORT_ENABLED) return;
    if (SORT_STATE !== SORT_MODE_NORMAL) SORT_STATE = SORT_MODE_NORMAL;
  }

  function getStoredLicenseKey() {
    return new Promise((resolve) => {
      try {
        if (!chrome || !chrome.storage || !chrome.storage.local || !chrome.storage.local.get) {
          resolve(null);
          return;
        }
        chrome.storage.local.get(['licenseKey'], (localData) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const direct = localData && typeof localData.licenseKey === 'string' ? localData.licenseKey.trim() : '';
          if (direct) {
            resolve(direct);
            return;
          }
          if (!chrome.storage.sync || !chrome.storage.sync.get) {
            resolve(null);
            return;
          }
          chrome.storage.sync.get(['licenseKey'], (syncData) => {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            const syncKey = syncData && typeof syncData.licenseKey === 'string' ? syncData.licenseKey.trim() : '';
            resolve(syncKey || null);
          });
        });
      } catch {
        resolve(null);
      }
    });
  }

  function verifyLicenseKey(licenseKey) {
    return new Promise((resolve) => {
      try {
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage || !licenseKey) {
          resolve(false);
          return;
        }
        chrome.runtime.sendMessage(
          { type: 'USERPLY_VERIFY_LICENSE', licenseKey },
          (response) => {
            if (chrome.runtime.lastError || !response || !response.ok || !response.data) {
              resolve(false);
              return;
            }
            const data = response.data;
            resolve(data.valid === true && data.features && data.features.dateSort === true);
          }
        );
      } catch {
        resolve(false);
      }
    });
  }

  async function ensureSortLicenseStatus() {
    if (LICENSE_STATUS_LOADING || LICENSE_STATUS_RESOLVED) return;
    LICENSE_STATUS_LOADING = true;
    try {
      const licenseKey = await getStoredLicenseKey();
      if (!licenseKey) {
        DATE_SORT_ENABLED = false;
      } else {
        DATE_SORT_ENABLED = await verifyLicenseKey(licenseKey);
      }
    } catch {
      DATE_SORT_ENABLED = false;
    } finally {
      LICENSE_STATUS_LOADING = false;
      LICENSE_STATUS_RESOLVED = true;
      enforceSortAccess();
      injectSortButton();
      applySortOrder();
    }
  }

  function applySortOrder() {
    const searchContainer = getSearchContainer();
    if (!searchContainer) return;
    const children = getSortableChildren(searchContainer);
    const original = syncOriginalOrder(children);
    const originalIndexMap = new Map(original.map((el, index) => [el, index]));
    enforceSortAccess();

    if (SORT_STATE === SORT_MODE_NORMAL) {
      original.forEach(el => {
        if (el.parentElement === searchContainer) searchContainer.appendChild(el);
      });
      return;
    }

    const sorted = children.map((el, index) => ({
      el,
      index: originalIndexMap.has(el) ? originalIndexMap.get(el) : index,
      time: parsePillDate(el)?.getTime() ?? null,
    })).sort((a, b) => {
      if (a.time === null && b.time === null) return a.index - b.index;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      if (a.time === b.time) return a.index - b.index;
      return SORT_STATE === SORT_MODE_NEWEST ? b.time - a.time : a.time - b.time;
    });

    sorted.forEach(item => {
      if (item.el.parentElement === searchContainer) searchContainer.appendChild(item.el);
    });
  }

  function injectSortButton() {
    const engine = detectEngine();
    const existing = document.getElementById('userply-sort');
    if (engine !== 'google') {
      if (existing) existing.remove();
      return;
    }
    const searchContainer = getSearchContainer();
    if (!searchContainer || !searchContainer.parentElement) return;
    if (!existing) {
      const controls = document.createElement('div');
      controls.id = 'userply-sort';
      controls.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;font-family:Arial,sans-serif;';

      const makeBtn = (label, mode) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.dataset.userplySortMode = mode;
        btn.style.cssText = 'padding:4px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.35);background:#fff;color:#334155;font-size:12px;line-height:1.3;cursor:pointer;';
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          SORT_STATE = mode;
          injectSortButton();
          applySortOrder();
        });
        return btn;
      };

      controls.appendChild(makeBtn('Normal', SORT_MODE_NORMAL));
      controls.appendChild(makeBtn('Newest', SORT_MODE_NEWEST));
      controls.appendChild(makeBtn('Oldest', SORT_MODE_OLDEST));
      const helper = document.createElement('span');
      helper.textContent = 'Sorting applies to visible results on this page.';
      helper.style.cssText = 'font-size:12px;line-height:1.4;color:#64748b;';
      controls.appendChild(helper);
      searchContainer.parentElement.insertBefore(controls, searchContainer);
    }

    const current = document.getElementById('userply-sort');
    if (!current) return;
    current.querySelectorAll('button[data-userply-sort-mode]').forEach((btn) => {
      const mode = btn.dataset.userplySortMode;
      const isPremiumMode = mode === SORT_MODE_NEWEST || mode === SORT_MODE_OLDEST;
      btn.disabled = isPremiumMode && !DATE_SORT_ENABLED;
      btn.style.opacity = btn.disabled ? '0.55' : '1';
      btn.style.cursor = btn.disabled ? 'not-allowed' : 'pointer';
      btn.title = btn.disabled ? 'Upgrade required' : '';
      btn.style.background = mode === SORT_STATE ? '#e2e8f0' : '#fff';
      btn.style.borderColor = mode === SORT_STATE ? '#94a3b8' : 'rgba(148,163,184,.35)';
    });

    if (!LICENSE_STATUS_LOADING && !LICENSE_STATUS_RESOLVED) ensureSortLicenseStatus();
  }

  function injectStyles() {
    if (document.getElementById('userply-styles')) return;
    const style = document.createElement('style');
    style.id = 'userply-styles';
    style.textContent = '@keyframes userply-pulse{0%,100%{opacity:.3}50%{opacity:.85}}[data-userply]{transform:none!important;rotate:none!important;scale:none!important;direction:ltr!important;unicode-bidi:isolate!important;writing-mode:horizontal-tb!important;text-orientation:mixed!important;}[data-userply-wrapper]{transform:none!important;rotate:none!important;scale:none!important;direction:ltr!important;unicode-bidi:isolate!important;writing-mode:horizontal-tb!important;contain:layout style!important;}';
    document.head.appendChild(style);
  }

  let scanCount = 0;
  function scan() {
    injectStyles();
    repairFlippedSearchText();
    injectSortButton();
    const items = getResultLinks();
    items.forEach(({ container, url, titleEl, engine }) => processResult(container, titleEl, url, engine));
    setTimeout(repairFlippedSearchText, 50);
    setTimeout(repairFlippedSearchText, 300);
    scanCount++;
    if (scanCount === 3 && items.length === 0) {
      const engine = detectEngine();
      if (engine) { const hasSearchQuery = window.location.search.includes('q=') || window.location.pathname.includes('/search'); if (hasSearchQuery) reportBreakage(engine, 0); }
    }
  }

  function resetProcessedState() {
    PROCESSING.clear();
    PROCESSED_URLS.clear();
    document.querySelectorAll('[data-userply-done]').forEach((el) => { delete el.dataset.userplyDone; });
    document.querySelectorAll('[data-userply-processed]').forEach((el) => { el.removeAttribute('data-userply-processed'); });
    document.querySelectorAll('[data-userply-wrapper], [data-userply]').forEach((el) => el.remove());
    document.querySelectorAll('[data-userply-sort-date], [data-userply-sortable]').forEach((el) => {
      el.removeAttribute('data-userply-sort-date');
      el.removeAttribute('data-userply-sortable');
    });
  }

  async function boot() {
    if (isDisabledSite()) return;
    await fetchRemoteConfig();
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(scan, 300);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(scan, 300));
    window.addEventListener('load', () => setTimeout(scan, 600));
    let scanTimer = null;
    const observer = new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 400); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    let lastHref = location.href;
    function onUrlChange() {
      if (location.href === lastHref) return;
      lastHref = location.href;
      resetProcessedState();
      scanCount = 0;
      SORT_STATE = SORT_MODE_NORMAL;
      ORIGINAL_ORDER = null;
      DATE_SORT_ENABLED = false;
      LICENSE_STATUS_LOADING = false;
      LICENSE_STATUS_RESOLVED = false;
      document.getElementById('userply-sort')?.remove();
      setTimeout(scan, 200);
      setTimeout(scan, 800);
    }
    window.addEventListener('popstate', onUrlChange);
    ['pushState', 'replaceState'].forEach(fn => { const orig = history[fn]; history[fn] = function () { const ret = orig.apply(this, arguments); setTimeout(onUrlChange, 0); return ret; }; });
    if (chrome && chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if ((areaName === 'local' || areaName === 'sync') && changes.licenseKey) {
          DATE_SORT_ENABLED = false;
          LICENSE_STATUS_LOADING = false;
          LICENSE_STATUS_RESOLVED = false;
          ensureSortLicenseStatus();
        }
      });
    }
    setInterval(onUrlChange, 1000);
  }

  boot();
})();