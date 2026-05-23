(function() {
  'use strict';
  const SETTINGS_KEY = 'userply_settings';
  const RESULT_CACHE_KEY = 'userply_cache_v6_complete_ddg';
  const LEGACY_RESULT_CACHE_KEY = 'userply_cache';
  const defaults = { enabled: true, pillPosition: 'below', showNoArchive: true, disabledSites: [] };
  function normalize(settings) {
    var out = { ...defaults, ...(settings && typeof settings === 'object' ? settings : {}) };
    if (!Array.isArray(out.disabledSites)) out.disabledSites = [];
    return out;
  }
  async function load() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        if (data && data[SETTINGS_KEY]) return normalize(data[SETTINGS_KEY]);
      }
    } catch { }
    try { const raw = localStorage.getItem(SETTINGS_KEY); return raw ? normalize(JSON.parse(raw)) : { ...defaults }; } catch { return { ...defaults }; }
  }
  async function save(settings) {
    const normalized = normalize(settings);
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
      }
    } catch { }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized)); } catch { }
    showSaved();
  }
  function showSaved() { const msg = document.getElementById('saved-msg'); msg.classList.add('show'); setTimeout(function() { msg.classList.remove('show'); }, 1500); }
  function renderDisabledList(settings) {
    var list = document.getElementById('disabled-list');
    list.innerHTML = '';
    settings.disabledSites.forEach(function(site, i) {
      var li = document.createElement('li'); li.textContent = site;
      var btn = document.createElement('button'); btn.textContent = '\u00d7'; btn.setAttribute('aria-label', 'Remove ' + site);
      btn.addEventListener('click', function() { settings.disabledSites.splice(i, 1); save(settings); renderDisabledList(settings); });
      li.appendChild(btn); list.appendChild(li);
    });
  }
  (async function init() {
    var settings = await load();
    document.getElementById('toggle-enabled').checked = settings.enabled;
    document.getElementById('pill-position').value = settings.pillPosition;
    document.getElementById('toggle-noarchive').checked = settings.showNoArchive;
    renderDisabledList(settings);
    document.getElementById('toggle-enabled').addEventListener('change', function(e) { settings.enabled = e.target.checked; save(settings); });
    document.getElementById('pill-position').addEventListener('change', function(e) { settings.pillPosition = e.target.value; save(settings); });
    document.getElementById('toggle-noarchive').addEventListener('change', function(e) { settings.showNoArchive = e.target.checked; save(settings); });
    document.getElementById('add-site-btn').addEventListener('click', function() {
      var input = document.getElementById('new-site');
      var site = input.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (site && !settings.disabledSites.includes(site)) { settings.disabledSites.push(site); save(settings); renderDisabledList(settings); input.value = ''; }
    });
    document.getElementById('new-site').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('add-site-btn').click(); });
    document.getElementById('clear-cache').addEventListener('click', function() {
      localStorage.removeItem(RESULT_CACHE_KEY);
      localStorage.removeItem(LEGACY_RESULT_CACHE_KEY);
      showSaved();
    });
  })();
})();