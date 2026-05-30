(function () {
  'use strict';
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    const url = tabs[0]?.url || '';
    const isGoogle = url.includes('google.');
    if (isGoogle) {
      dot.className = 'status-dot green';
      text.textContent = 'Active on this Google page.';
      return;
    }
    dot.className = 'status-dot red';
    text.textContent = 'Open a Google results page to use user.ply.';
  });
})();
