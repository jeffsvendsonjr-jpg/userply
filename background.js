// Service worker for userp.ly extension
// Review-hardened: no analytics or install/update event tracking.

const SUPABASE_URL = 'https://nihquqccvnfuaqsxyymj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHF1cWNjdm5mdWFxc3h5eW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1ODIsImV4cCI6MjA5NDY0MDU4Mn0.Q0ea1N8iWDoy0KzbFvL4rFYg0liZevnC3AFUDiJY1yE';
const VERIFY_URL = `${SUPABASE_URL}/functions/v1/verify-date`;
const LICENSE_VERIFY_URL = 'https://public-website-builder.replit.app/api/license/verify';
const VERIFY_RATE_LIMIT_BACKOFF_MS = 60000;
const VERIFY_TRANSIENT_BACKOFF_MS = 15000;
let verifyBackoffUntil = 0;

function getRetryAfterMs(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? 0 : Math.max(0, retryAt - Date.now());
}

function getVerifyBackoffRemaining() {
  const remaining = verifyBackoffUntil - Date.now();
  if (remaining <= 0) {
    verifyBackoffUntil = 0;
    return 0;
  }
  return remaining;
}

function applyVerifyBackoff(ms = VERIFY_TRANSIENT_BACKOFF_MS) {
  verifyBackoffUntil = Math.max(verifyBackoffUntil, Date.now() + Math.max(ms, VERIFY_TRANSIENT_BACKOFF_MS));
}

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
      const backoffRemaining = getVerifyBackoffRemaining();
      if (backoffRemaining > 0) {
        sendResponse({ ok: false, status: 429, retryAfterMs: backoffRemaining });
        return;
      }

      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          url: message.url,
          claimed_date: message.claimedDate || undefined,
          anonymous_id: message.anonymousId,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const retryAfterMs = res.status === 429
          ? Math.max(getRetryAfterMs(res.headers.get('retry-after')), VERIFY_RATE_LIMIT_BACKOFF_MS)
          : (res.status >= 500 ? VERIFY_TRANSIENT_BACKOFF_MS : 0);
        if (retryAfterMs > 0) applyVerifyBackoff(retryAfterMs);
        sendResponse({ ok: false, status: res.status, retryAfterMs: retryAfterMs || undefined });
        return;
      }

      const data = await res.json();
      sendResponse({ ok: true, data });
    } catch (error) {
      applyVerifyBackoff();
      sendResponse({ ok: false, error: error?.message || 'Unknown error', transportError: true, retryAfterMs: VERIFY_TRANSIENT_BACKOFF_MS });
    }
  })();

  return true;
});
