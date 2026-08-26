// SMA-app — login_history capture (Issue #125). Called fire-and-forget
// after a successful OTP login (see src/v4/login.js). Never awaited by
// the login flow — a failure here must not block or delay the user
// reaching the app.

import { supabase } from './supabaseClient.js';

const IP_LOOKUP_URL = 'https://ipapi.co/json/';
const IP_LOOKUP_TIMEOUT_MS = 3000;

/** @returns {{ deviceType: 'mobile' | 'desktop', os: string | null }} */
function detectDeviceAndOs(ua) {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  let os = null;
  if (isMobile) {
    if (/iPhone|iPad|iPod/.test(ua)) {os = 'iOS';}
    else if (/Android/.test(ua)) {os = 'Android';}
  } else {
    if (/Windows/.test(ua)) {os = 'Windows';}
    else if (/Mac OS X/.test(ua)) {os = 'macOS';}
    else if (/Linux/.test(ua)) {os = 'Linux';}
  }
  return { deviceType: isMobile ? 'mobile' : 'desktop', os };
}

/** Best-effort device model string for mobile UAs. Apple UAs only ever expose
 * the generic "iPhone"/"iPad" token (no model number) — that's a platform
 * limitation, not a gap in this parser. */
function extractDeviceBrand(ua, os) {
  if (os === 'iOS') {
    if (/iPad/.test(ua)) {return 'iPad';}
    if (/iPhone/.test(ua)) {return 'iPhone';}
    if (/iPod/.test(ua)) {return 'iPod';}
    return null;
  }
  if (os === 'Android') {
    const match = ua.match(/Android [^;]+;\s*([^)]+)\)/);
    if (!match) {return null;}
    const model = match[1].split('Build/')[0].trim();
    if (!model || /^(k|wv)$/i.test(model)) {return null;}
    return model;
  }
  return null;
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) {return 'Edge';}
  if (/FxiOS\//.test(ua) || /Firefox\//.test(ua)) {return 'Firefox';}
  if (/CriOS\//.test(ua) || (/Chrome\//.test(ua) && !/Edg\//.test(ua))) {return 'Chrome';}
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/CriOS\//.test(ua)) {return 'Safari';}
  return null;
}

/** Best-effort IP + city + country lookup. Never throws — returns {} on any
 * failure or timeout so the caller can insert a row without these fields. */
async function fetchIpLocation() {
  try {
    const res = await Promise.race([
      fetch(IP_LOOKUP_URL),
      new Promise((_, reject) => setTimeout(() => reject(new Error('IP lookup timed out')), IP_LOOKUP_TIMEOUT_MS))
    ]);
    if (!res.ok) {return {};}
    const data = await res.json();
    return {
      ip_address: data.ip || null,
      city: data.city || null,
      country: data.country_name || null
    };
  } catch {
    return {};
  }
}

/** Record one login_history row for `profileId`. Fire-and-forget — the
 * caller must not `await` this before continuing the login flow. */
export async function recordLoginHistory(profileId) {
  try {
    const ua = navigator.userAgent;
    const { deviceType, os } = detectDeviceAndOs(ua);
    const deviceBrand = deviceType === 'mobile' ? extractDeviceBrand(ua, os) : null;
    const browser = detectBrowser(ua);
    const location = await fetchIpLocation();

    const { error } = await supabase.from('login_history').insert({
      profile_id: profileId,
      device_type: deviceType,
      device_brand: deviceBrand,
      os,
      browser,
      ...location
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to record login history:', error.message);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to record login history:', error);
  }
}
