(function () {
  'use strict';
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!tabs[0]?.url) { dot.className = 'status-dot red'; text.textContent = 'No active tab'; return; }
    const url = tabs[0].url;
    const isSearch = url.includes('google.');
    if (isSearch) { dot.className = 'status-dot green'; text.textContent = 'Active on this page'; }
    else { dot.className = 'status-dot red'; text.textContent = 'Not a Google search page'; }
  });
  chrome.runtime.sendMessage({ type: 'USERPLY_LICENSE_GET' }, (response) => {
    if (chrome.runtime.lastError) return;
    const badge = document.getElementById('plan-badge');
    if (!badge) return;
    const status = (response && response.status) || { valid: false, plan: 'free' };
    const isPro = status.valid === true;
    badge.textContent = isPro ? 'PRO' : 'FREE';
    badge.className = 'plan-badge ' + (isPro ? 'pro' : 'free');
  });
})();