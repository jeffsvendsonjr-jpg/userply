(function() {
  'use strict';
  const SETTINGS_KEY = 'userply_settings';
  const LICENSE_KEY_STORAGE_KEY = 'userply_license_key';
  const defaults = { enabled: true, pillPosition: 'below', showNoArchive: true, disabledSites: [] };
  function load() { try { const raw = localStorage.getItem(SETTINGS_KEY); return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }; } catch { return { ...defaults }; } }
  function save(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); showSaved(); }
  function showSaved() { const msg = document.getElementById('saved-msg'); msg.classList.add('show'); setTimeout(function() { msg.classList.remove('show'); }, 1500); }
  function setLicenseStatusText(status) {
    const el = document.getElementById('license-status');
    if (!el) return;
    const isPro = !!(status && status.valid && status.features && status.features.dateSort);
    const planLabel = isPro ? 'Pro' : 'Free';
    const statusLabel = status && status.status ? status.status : 'not_found';
    el.textContent = `Plan: ${planLabel} (${statusLabel})`;
    el.style.color = isPro ? '#4ade80' : '#94a3b8';
  }
  function sendMessage(payload) {
    return new Promise(function(resolve) {
      try {
        chrome.runtime.sendMessage(payload, function(response) {
          if (chrome.runtime.lastError) return resolve({ ok: false, data: null });
          resolve(response || { ok: false, data: null });
        });
      } catch { resolve({ ok: false, data: null }); }
    });
  }
  function loadLicense() {
    chrome.storage.local.get([LICENSE_KEY_STORAGE_KEY], async function(store) {
      const keyInput = document.getElementById('license-key');
      const savedKey = (store && typeof store[LICENSE_KEY_STORAGE_KEY] === 'string') ? store[LICENSE_KEY_STORAGE_KEY] : '';
      if (keyInput) keyInput.value = savedKey;
      const res = await sendMessage({ type: 'USERPLY_GET_LICENSE_STATUS', forceRefresh: false });
      setLicenseStatusText(res && res.ok ? res.data : null);
    });
  }
  async function saveLicense() {
    const keyInput = document.getElementById('license-key');
    if (!keyInput) return;
    const licenseKey = keyInput.value.trim().toUpperCase();
    keyInput.value = licenseKey;
    const res = await sendMessage({ type: 'USERPLY_SAVE_LICENSE_KEY', licenseKey: licenseKey });
    setLicenseStatusText(res && res.ok && res.data ? res.data.status : null);
    showSaved();
  }
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
  var settings = load();
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
  document.getElementById('clear-cache').addEventListener('click', function() { localStorage.removeItem('userply_cache'); showSaved(); });
  document.getElementById('license-save-btn').addEventListener('click', function() { saveLicense(); });
  document.getElementById('license-key').addEventListener('keydown', function(e) { if (e.key === 'Enter') saveLicense(); });
  loadLicense();
})();