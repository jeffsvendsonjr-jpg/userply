// Service worker for userp.ly extension
// Review-hardened: no analytics or install/update event tracking.

const SUPABASE_URL = 'https://nihquqccvnfuaqsxyymj.supabase.co';
const VERIFY_URL = `${SUPABASE_URL}/functions/v1/verify-date`;
const LICENSE_VERIFY_URL = 'https://public-website-builder.replit.app/api/license/verify';
const LICENSE_KEY_STORAGE = 'userply_license_key';
const LICENSE_STATUS_STORAGE = 'userply_license_status';

function getFreeLicenseStatus(reason) {
  return {
    valid: false,
    plan: 'Free',
    features: { dateSort: false },
    reason: reason || 'free',
    checkedAt: new Date().toISOString(),
  };
}

function normalizeLicenseStatus(payload) {
  const valid = payload && (payload.valid === true || payload.isValid === true || payload.status === 'active');
  const dateSort = !!(payload && payload.features && payload.features.dateSort);
  if (!valid || !dateSort) return getFreeLicenseStatus(!valid ? 'invalid' : 'feature_disabled');
  return {
    valid: true,
    plan: payload.plan || payload.tier || 'Pro',
    features: { dateSort: true },
    checkedAt: new Date().toISOString(),
  };
}

async function verifyLicenseKey(licenseKey) {
  if (!licenseKey) return getFreeLicenseStatus('missing_key');
  try {
    const res = await fetch(LICENSE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, license_key: licenseKey, key: licenseKey }),
    });
    if (!res.ok) return getFreeLicenseStatus(`http_${res.status}`);
    const data = await res.json();
    return normalizeLicenseStatus(data && typeof data === 'object' ? data : null);
  } catch (error) {
    return getFreeLicenseStatus(error && error.message ? error.message : 'verification_failed');
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'onboarding.html' });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'USERPLY_VERIFY_DATE') {
    (async () => {
      try {
        const res = await fetch(VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    })();
    return true;
  }

  if (message.type === 'USERPLY_LICENSE_SAVE') {
    chrome.storage.local.set({ [LICENSE_KEY_STORAGE]: (message.licenseKey || '').trim() }, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
    });
    return true;
  }

  if (message.type === 'USERPLY_LICENSE_GET_STATUS') {
    chrome.storage.local.get([LICENSE_KEY_STORAGE, LICENSE_STATUS_STORAGE], (data) => {
      const status = data && data[LICENSE_STATUS_STORAGE] ? normalizeLicenseStatus(data[LICENSE_STATUS_STORAGE]) : getFreeLicenseStatus('uninitialized');
      sendResponse({
        ok: !chrome.runtime.lastError,
        licenseKey: data ? (data[LICENSE_KEY_STORAGE] || '') : '',
        status,
      });
    });
    return true;
  }

  if (message.type === 'USERPLY_LICENSE_VERIFY') {
    (async () => {
      const licenseKey = (message.licenseKey || '').trim();
      const status = await verifyLicenseKey(licenseKey);
      chrome.storage.local.set({ [LICENSE_KEY_STORAGE]: licenseKey, [LICENSE_STATUS_STORAGE]: status }, () => {
        sendResponse({ ok: !chrome.runtime.lastError, status });
      });
    })();
    return true;
  }

  return false;
});
