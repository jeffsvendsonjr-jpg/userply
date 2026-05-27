(function() {
  'use strict';
  const SETTINGS_KEY = 'userply_settings';
  const defaults = { enabled: true, pillPosition: 'below', showNoArchive: true, disabledSites: [] };
  function load() { try { const raw = localStorage.getItem(SETTINGS_KEY); return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults }; } catch { return { ...defaults }; } }
  function save(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); showSaved(); }
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

  // License management
  function renderPlanStatus(status) {
    var badge = document.getElementById('plan-status');
    if (!badge) return;
    var isPro = status && status.valid === true;
    badge.textContent = isPro ? 'Pro' : 'Free';
    badge.className = 'plan-status ' + (isPro ? 'pro' : 'free');
  }
  function setLicenseMsg(text, color) {
    var el = document.getElementById('license-msg');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || '#94a3b8';
  }
  chrome.runtime.sendMessage({ type: 'USERPLY_LICENSE_GET' }, function(response) {
    if (chrome.runtime.lastError) return;
    var status = (response && response.status) || { valid: false, plan: 'free' };
    renderPlanStatus(status);
    var keyInput = document.getElementById('license-key-input');
    if (keyInput && response && response.licenseKey) keyInput.value = response.licenseKey;
  });
  document.getElementById('verify-license-btn').addEventListener('click', function() {
    var btn = this;
    var keyInput = document.getElementById('license-key-input');
    var key = (keyInput && keyInput.value || '').trim();
    if (!key) { setLicenseMsg('Please enter a license key.', '#f87171'); return; }
    btn.disabled = true;
    setLicenseMsg('Verifying…', '#94a3b8');
    chrome.runtime.sendMessage({ type: 'USERPLY_LICENSE_VERIFY', licenseKey: key }, function(response) {
      btn.disabled = false;
      if (chrome.runtime.lastError || !response) { setLicenseMsg('Verification failed. Please try again.', '#f87171'); return; }
      if (!response.ok) { setLicenseMsg('Verification failed. Please check your key.', '#f87171'); renderPlanStatus({ valid: false }); return; }
      var status = response.status || { valid: false, plan: 'free' };
      renderPlanStatus(status);
      if (status.valid) {
        var planLabel = status.plan === 'lifetime_pro' || status.plan === 'lifetime' ? 'Lifetime Pro' : 'Monthly Pro';
        setLicenseMsg('Activated: ' + planLabel, '#4ade80');
      } else {
        setLicenseMsg('Key not valid or expired. You are on the Free plan.', '#f87171');
      }
    });
  });
})();