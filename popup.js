(function () {
  'use strict';

  function detectSupportedEngine(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const host = url.hostname.replace(/^www\./, '');
      if (/google\./i.test(host) && (url.searchParams.has('q') || url.pathname === '/search')) return 'Google';
      if (/bing\./i.test(host) && (url.searchParams.has('q') || url.pathname === '/search')) return 'Bing';
      if (/duckduckgo\./i.test(host) && url.searchParams.has('q')) return 'DuckDuckGo';
    } catch { }
    return null;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const url = tabs[0]?.url || '';
    const engine = detectSupportedEngine(url);
    if (engine) {
      dot.className = 'status-dot green';
      text.textContent = `Active on this ${engine} results page.`;
      return;
    }
    dot.className = 'status-dot red';
    text.textContent = 'Open a Google, Bing, or DuckDuckGo results page to use user.ply.';
  });
})();
