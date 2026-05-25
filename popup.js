(function () {
  'use strict';
  function setPlan(status) {
    const planText = document.getElementById('plan-text');
    if (!planText) return;
    const isPro = !!(status && status.valid && status.features && status.features.dateSort);
    const statusLabel = status && status.status ? status.status : 'not_found';
    planText.textContent = isPro ? `Plan: Pro (${statusLabel})` : `Plan: Free (${statusLabel})`;
    planText.style.color = isPro ? '#4ade80' : '#94a3b8';
  }
  function refreshLicense() {
    try {
      chrome.runtime.sendMessage({ type: 'USERPLY_GET_LICENSE_STATUS', forceRefresh: true }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) return setPlan(null);
        setPlan(response.data);
      });
    } catch {
      setPlan(null);
    }
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!tabs[0]?.url) { dot.className = 'status-dot red'; text.textContent = 'No active tab'; return; }
    const url = tabs[0].url;
    const isSearch = url.includes('google.') || url.includes('bing.com') || url.includes('duckduckgo.com');
    if (isSearch) { dot.className = 'status-dot green'; text.textContent = 'Active on this page'; }
    else { dot.className = 'status-dot red'; text.textContent = 'Not a search page'; }
  });
  refreshLicense();
})();