// Service worker for userp.ly extension
// Review-hardened: no analytics or install/update event tracking.

const SUPABASE_URL = 'https://nihquqccvnfuaqsxyymj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHF1cWNjdm5mdWFxc3h5eW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1ODIsImV4cCI6MjA5NDY0MDU4Mn0.Q0ea1N8iWDoy0KzbFvL4rFYg0liZevnC3AFUDiJY1yE';
const VERIFY_URL = `${SUPABASE_URL}/functions/v1/verify-date`;
const LICENSE_VERIFY_URL = 'https://public-website-builder.replit.app/api/license/verify';

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'onboarding.html' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === 'USERPLY_VERIFY_LICENSE') {
    (async () => {
      try {
        const licenseKey = typeof message.licenseKey === 'string' ? message.licenseKey.trim() : '';
        if (!licenseKey) {
          sendResponse({ ok: true, data: { valid: false, features: {} } });
          return;
        }
        const res = await fetch(LICENSE_VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey }),
        });
        if (!res.ok) {
          sendResponse({ ok: false, status: res.status });
          return;
        }
        const data = await res.json();
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({ ok: false, error: error?.message || 'Unknown error' });
      }
    })();
    return true;
  }

  if (message.type !== 'USERPLY_VERIFY_DATE') return false;

  (async () => {
    try {
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          url: message.url,
          claimed_date: message.claimedDate || undefined,
          anonymous_id: message.anonymousId,
        }),
      });

      if (!res.ok) {
        sendResponse({ ok: false, status: res.status });
        return;
      }

      const data = await res.json();
      sendResponse({ ok: true, data });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || 'Unknown error' });
    }
  })();

  return true;
});
