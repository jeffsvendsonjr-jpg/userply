// Service worker for userp.ly extension
// Review-hardened: no analytics or install/update event tracking.

const SUPABASE_URL = 'https://nihquqccvnfuaqsxyymj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHF1cWNjdm5mdWFxc3h5eW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1ODIsImV4cCI6MjA5NDY0MDU4Mn0.Q0ea1N8iWDoy0KzbFvL4rFYg0liZevnC3AFUDiJY1yE';
const VERIFY_URL = SUPABASE_URL + '/functions/v1/verify-date';
const LICENSE_VERIFY_URL = 'https://public-website-builder.replit.app/api/license/verify';
const LICENSE_RECHECK_ALARM = 'userply_license_recheck';
const LICENSE_RECHECK_PERIOD_MINUTES = 60;

// Pro plan identifiers returned by the license server
const PRO_PLANS = new Set(['monthly_pro', 'lifetime_pro', 'monthly', 'lifetime', 'pro']);

function normalizeLicenseResponse(data) {
  if (!data || typeof data !== 'object') return { valid: false, plan: 'free', features: { dateSort: false } };
  const plan = (data.plan || data.tier || '').toLowerCase();
  const valid = data.valid === true && PRO_PLANS.has(plan);
  return {
    valid,
    plan: valid ? plan : 'free',
    features: { dateSort: valid },
    expiresAt: data.expires_at || data.expiresAt || null,
  };
}

async function verifyLicenseKey(licenseKey) {
  try {
    const res = await fetch(LICENSE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: licenseKey }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { valid: false, plan: 'free', features: { dateSort: false } };
    const data = await res.json();
    return normalizeLicenseResponse(data);
  } catch {
    return { valid: false, plan: 'free', features: { dateSort: false } };
  }
}

async function recheckStoredLicense() {
  try {
    const stored = await chrome.storage.local.get(['userply_license_key']);
    const key = stored.userply_license_key;
    if (!key) return;
    const status = await verifyLicenseKey(key);
    await chrome.storage.local.set({ userply_license_status: status });
  } catch { }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'onboarding.html' });
  }
  chrome.alarms.create(LICENSE_RECHECK_ALARM, { periodInMinutes: LICENSE_RECHECK_PERIOD_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === LICENSE_RECHECK_ALARM) recheckStoredLicense();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === 'USERPLY_VERIFY_DATE') {
    (async () => {
      try {
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
        });
        if (!res.ok) { sendResponse({ ok: false, status: res.status }); return; }
        const data = await res.json();
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    })();
    return true;
  }

  if (message.type === 'USERPLY_LICENSE_VERIFY') {
    (async () => {
      try {
        const key = (message.licenseKey || '').trim();
        if (!key) {
          sendResponse({ ok: false, status: { valid: false, plan: 'free', features: { dateSort: false } } });
          return;
        }
        const status = await verifyLicenseKey(key);
        await chrome.storage.local.set({ userply_license_key: key, userply_license_status: status });
        sendResponse({ ok: true, status });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    })();
    return true;
  }

  if (message.type === 'USERPLY_LICENSE_GET') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['userply_license_key', 'userply_license_status']);
        sendResponse({
          ok: true,
          licenseKey: stored.userply_license_key || '',
          status: stored.userply_license_status || { valid: false, plan: 'free', features: { dateSort: false } },
        });
      } catch {
        sendResponse({ ok: false, status: { valid: false, plan: 'free', features: { dateSort: false } } });
      }
    })();
    return true;
  }

  return false;
});
