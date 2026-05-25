// Service worker for userp.ly extension
// Review-hardened: no analytics or install/update event tracking.

const SUPABASE_URL = 'https://nihquqccvnfuaqsxyymj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHF1cWNjdm5mdWFxc3h5eW1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1ODIsImV4cCI6MjA5NDY0MDU4Mn0.Q0ea1N8iWDoy0KzbFvL4rFYg0liZevnC3AFUDiJY1yE';
const VERIFY_URL = `${SUPABASE_URL}/functions/v1/verify-date`;
const LICENSE_VERIFY_URL = 'https://public-website-builder.replit.app/api/license/verify';
const LICENSE_KEY_STORAGE_KEY = 'userply_license_key';
const LICENSE_STATUS_STORAGE_KEY = 'userply_license_status';
const LICENSE_RECHECK_MS = 24 * 60 * 60 * 1000;
const LICENSE_RECHECK_ALARM = 'userply_license_recheck_alarm';

function getFreeLicenseStatus(status) {
  return {
    valid: false,
    plan: 'free',
    features: { dateSort: false },
    status: status || 'not_found',
    checkedAt: Date.now(),
  };
}

function normalizeLicenseResponse(data) {
  if (!data || typeof data !== 'object') return getFreeLicenseStatus('verification_failed');
  return {
    valid: data.valid === true,
    plan: typeof data.plan === 'string' && data.plan ? data.plan : 'free',
    features: {
      dateSort: !!(data.features && data.features.dateSort === true),
    },
    status: typeof data.status === 'string' && data.status ? data.status : (data.valid ? 'active' : 'not_found'),
    checkedAt: Date.now(),
  };
}

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result || {}));
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve());
  });
}

function shouldRecheckLicense(statusObj) {
  if (!statusObj || typeof statusObj !== 'object') return true;
  const checkedAt = Number(statusObj.checkedAt);
  if (!checkedAt) return true;
  return (Date.now() - checkedAt) >= LICENSE_RECHECK_MS;
}

async function verifyLicense(licenseKey) {
  if (!licenseKey) return getFreeLicenseStatus('not_found');
  try {
    const res = await fetch(LICENSE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return getFreeLicenseStatus('verification_failed');
    const data = await res.json();
    return normalizeLicenseResponse(data);
  } catch {
    return getFreeLicenseStatus('verification_failed');
  }
}

async function getLicenseStatus(options = {}) {
  const forceRefresh = !!options.forceRefresh;
  const { [LICENSE_KEY_STORAGE_KEY]: licenseKeyRaw, [LICENSE_STATUS_STORAGE_KEY]: cachedStatus } = await storageGet([
    LICENSE_KEY_STORAGE_KEY,
    LICENSE_STATUS_STORAGE_KEY,
  ]);
  const licenseKey = typeof licenseKeyRaw === 'string' ? licenseKeyRaw.trim().toUpperCase() : '';
  if (!licenseKey) {
    const free = getFreeLicenseStatus('not_found');
    await storageSet({ [LICENSE_STATUS_STORAGE_KEY]: free });
    return free;
  }
  if (!forceRefresh && !shouldRecheckLicense(cachedStatus)) return cachedStatus;
  const verified = await verifyLicense(licenseKey);
  await storageSet({ [LICENSE_STATUS_STORAGE_KEY]: verified });
  return verified;
}

async function saveLicenseKeyAndVerify(licenseKeyRaw) {
  const normalized = typeof licenseKeyRaw === 'string' ? licenseKeyRaw.trim().toUpperCase() : '';
  await storageSet({ [LICENSE_KEY_STORAGE_KEY]: normalized });
  const status = await getLicenseStatus({ forceRefresh: true });
  return { licenseKey: normalized, status };
}

function ensureLicenseAlarm() {
  chrome.alarms.get(LICENSE_RECHECK_ALARM, (existing) => {
    if (existing) return;
    chrome.alarms.create(LICENSE_RECHECK_ALARM, { periodInMinutes: 60 });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'onboarding.html' });
  }
  ensureLicenseAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureLicenseAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || alarm.name !== LICENSE_RECHECK_ALARM) return;
  getLicenseStatus({ forceRefresh: false }).catch(() => { });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'USERPLY_SAVE_LICENSE_KEY') {
    (async () => {
      try {
        const data = await saveLicenseKeyAndVerify(message.licenseKey || '');
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    })();
    return true;
  }

  if (message.type === 'USERPLY_GET_LICENSE_STATUS') {
    (async () => {
      try {
        const status = await getLicenseStatus({ forceRefresh: !!message.forceRefresh });
        sendResponse({ ok: true, data: status });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error), data: getFreeLicenseStatus('verification_failed') });
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
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    }
  })();

  return true;
});
