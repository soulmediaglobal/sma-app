// SMA-app — login_history capture (Issue #125). Called after a successful
// OTP login (see src/v4/login.js). The core row (device/os/browser) is
// awaited by the caller — it's a single fast insert, so the login flow
// isn't meaningfully delayed, and it guarantees the row actually exists
// before navigation happens. IP/city/country enrichment is a SEPARATE,
// genuinely fire-and-forget UPDATE kicked off after that insert — it can
// take up to IP_LOOKUP_TIMEOUT_MS and must never block navigation, so the
// caller does not (and must not) await it.
//
// This split exists because the original all-in-one version awaited the
// IP lookup INSIDE the same fire-and-forget call, before ever reaching the
// insert. Navigating to index.html right after kicking that off (with no
// gap) tore down the page context mid-fetch essentially every time, so the
// insert was never reached and no row was ever written — silently, since
// the code never got far enough to hit the try/catch's error path.

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

/** Best-effort: look up IP/city/country and UPDATE the row that's already
 * been written. Never awaited by anything — a slow/timed-out/failed lookup
 * just leaves those 3 (nullable) columns empty. */
async function enrichLoginHistoryLocation(rowId) {
  const location = await fetchIpLocation();
  if (!location.ip_address && !location.city && !location.country) {return;}

  const { error } = await supabase.from('login_history').update(location).eq('id', rowId);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to enrich login history with location:', error.message);
  }
}

/** Record one login_history row for `profileId`. Await this — it's a
 * single fast insert (device/os/browser only) that must land before the
 * caller navigates away, otherwise the row never gets written at all. IP
 * geolocation enrichment happens separately afterward, fully
 * fire-and-forget (see enrichLoginHistoryLocation above) — this function
 * does not wait on it. */
export async function recordLoginHistory(profileId) {
  try {
    const ua = navigator.userAgent;
    const { deviceType, os } = detectDeviceAndOs(ua);
    const deviceBrand = deviceType === 'mobile' ? extractDeviceBrand(ua, os) : null;
    const browser = detectBrowser(ua);

    const { data, error } = await supabase
      .from('login_history')
      .insert({
        profile_id: profileId,
        device_type: deviceType,
        device_brand: deviceBrand,
        os,
        browser
      })
      .select('id')
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to record login history:', error.message);
      return;
    }

    enrichLoginHistoryLocation(data.id);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to record login history:', error);
  }
}
