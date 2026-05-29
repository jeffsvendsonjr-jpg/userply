(function() {
  'use strict';
  const SETTINGS_KEY = 'userply_settings';
  const defaults = { enabled: true, pillPosition: 'below', showNoArchive: true, disabledSites: [] };
  function load() { try { const raw = localStorage.getItem(SETTINGS_KEY); return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }; } catch { return { ...defaults }; } }
  function save(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); showSaved(); }
  function showSaved() { const msg = document.getElementById('saved-msg'); msg.classList.add('show'); setTimeout(function() { msg.classList.remove('show'); }, 1500); }
  function setLicenseStatus(text, cls) {
    var el = document.getElementById('license-status');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('ok');
    el.classList.remove('error');
    if (cls) el.classList.add(cls);
  }
  function getLicenseStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.storage.sync) return null;
    return chrome.storage;
  }
  function readStoredLicenseKey(done) {
    var storage = getLicenseStorage();
    if (!storage) { done(''); return; }
    storage.local.get('licenseKey', function(local) {
      if (local && typeof local.licenseKey === 'string' && local.licenseKey.trim()) {
        done(local.licenseKey.trim());
        return;
      }
      storage.sync.get('licenseKey', function(sync) {
        if (sync && typeof sync.licenseKey === 'string' && sync.licenseKey.trim()) {
          done(sync.licenseKey.trim());
          return;
        }
        done('');
      });
    });
  }
  function persistLicenseKey(licenseKey, done) {
    var storage = getLicenseStorage();
    if (!storage) { done(); return; }
    storage.local.set({ licenseKey: licenseKey }, function() {
      storage.sync.set({ licenseKey: licenseKey }, function() { done(); });
    });
  }
  function verifyLicenseKey(licenseKey, done) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      done({ ok: false, error: 'Runtime messaging unavailable.' });
      return;
    }
    chrome.runtime.sendMessage({ type: 'USERPLY_VERIFY_LICENSE', licenseKey: licenseKey }, function(response) {
      if (chrome.runtime.lastError) {
        done({ ok: false, error: chrome.runtime.lastError.message || 'Verification failed.' });
        return;
      }
      if (!response || !response.ok || !response.data) {
        done({ ok: false, error: 'Verification failed.' });
        return;
      }
      done({ ok: true, data: response.data });
    });
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
  var licenseInput = document.getElementById('license-key');
  var verifyLicenseBtn = document.getElementById('verify-license-btn');
  document.getElementById('toggle-enabled').checked = settings.enabled;
  document.getElementById('pill-position').value = settings.pillPosition;
  document.getElementById('toggle-noarchive').checked = settings.showNoArchive;
  renderDisabledList(settings);
  readStoredLicenseKey(function(licenseKey) { licenseInput.value = licenseKey; });
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
  verifyLicenseBtn.addEventListener('click', function() {
    var licenseKey = (licenseInput.value || '').trim();
    verifyLicenseBtn.disabled = true;
    setLicenseStatus('Verifying license...');
    verifyLicenseKey(licenseKey, function(result) {
      persistLicenseKey(licenseKey, function() {
        verifyLicenseBtn.disabled = false;
        if (!result.ok) {
          setLicenseStatus('Saved key, but verification failed. Try again.', 'error');
          return;
        }
        if (result.data.valid === true && result.data.features && result.data.features.dateSort === true) {
          setLicenseStatus('License verified and saved.', 'ok');
          showSaved();
          return;
        }
        setLicenseStatus('License saved, but this key does not enable date sorting.', 'error');
      });
    });
  });
})();