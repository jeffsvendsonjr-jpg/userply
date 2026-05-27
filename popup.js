(function () {
  'use strict';
  function normalizeStatus(status) {
    if (!status || status.valid !== true || !status.features || status.features.dateSort !== true) {
      return { valid: false, plan: 'Free', features: { dateSort: false } };
    }
    return { valid: true, plan: status.plan || 'Pro', features: { dateSort: true } };
  }

  function setLicenseText(status) {
    const el = document.getElementById('license-text');
    const normalized = normalizeStatus(status);
    el.textContent = `License: ${normalized.valid ? 'Pro' : 'Free'}`;
  }

  chrome.runtime.sendMessage({ type: 'USERPLY_LICENSE_GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response) {
      setLicenseText(null);
      return;
    }
    setLicenseText(response.status);
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!tabs[0]?.url) { dot.className = 'status-dot red'; text.textContent = 'No active tab'; return; }
    const url = tabs[0].url;
    const isSearch = url.includes('google.');
    if (isSearch) { dot.className = 'status-dot green'; text.textContent = 'Active on this page'; }
    else { dot.className = 'status-dot red'; text.textContent = 'Not a Google Search page'; }
  });
})();