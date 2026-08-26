// SMA-app — login_history capture (Issue #128).
import { supabase } from './supabaseClient.js';

const IP_LOOKUP_TIMEOUT_MS = 1500;

function detectDeviceAndOs(ua) {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua);
  let os = null;
  if (isMobile) {
    if (/iPhone|iPad|iPod/.test(ua)) { os = 'iOS'; }
    else if (/Android/.test(ua)) { os = 'Android'; }
  } else {
    if (/Windows/.test(ua)) { os = 'Windows'; }
    else if (/Mac OS X/.test(ua)) { os = 'macOS'; }
    else if (/Linux/.test(ua)) { os = 'Linux'; }
  }
  return { deviceType: isMobile ? 'mobile' : 'desktop', os };
}

function extractDeviceBrand(ua, os) {
  if (os === 'iOS') {
    if (/iPad/.test(ua)) { return 'iPad'; }
    if (/iPhone/.test(ua)) { return 'iPhone'; }
    if (/iPod/.test(ua)) { return 'iPod'; }
    return null;
  }
  if (os === 'Android') {
    const match = ua.match(/Android [^;]+;\s*([^)]+)\)/);
    if (!match) { return null; }
    const model = match[1].split('Build/')[0].trim();
    if (!model || /^(k|wv)$/i.test(model)) { return null; }
    return model;
  }
  return null;
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) { return 'Edge'; }
  if (/FxiOS\//.test(ua) || /Firefox\//.test(ua)) { return 'Firefox'; }
  if (/CriOS\//.test(ua) || (/Chrome\//.test(ua) && !/Edg\//.test(ua))) { return 'Chrome'; }
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/CriOS\//.test(ua)) { return 'Safari'; }
  return null;
}

/** Quick IP + location lookup with 1.5s timeout per provider.
 *
 * BigDataCloud's Client Info API is tried first (Issue #130 - an
 * attempt at better city-level accuracy than ipwho.is for Indonesian
 * ISPs, whose IP-to-city registration data is often inaccurate in most
 * free geolocation databases). Falls back to ipify+ipwho.is (the
 * original provider) if BigDataCloud fails or times out.
 *
 * Neither provider can fully fix Indonesia's underlying accuracy
 * problem - IP geolocation depends on how each ISP registers its
 * address blocks, not on which lookup service is used - but this is
 * worth trying since BigDataCloud may have better-maintained data. */
async function fetchIpLocation() {
  const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IP_LOOKUP_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) { return null; }
      return await res.json();
    } catch {
      return null;
    }
  };

  // Try BigDataCloud's client-side Client Info API first - no API key,
  // no rate limit, returns IP + city/country in one call.
  try {
    const bdcData = await fetchWithTimeout('https://api.bigdatacloud.net/data/client-info');
    if (bdcData?.ipAddress) {
      return {
        ip_address: bdcData.ipAddress,
        city: bdcData.location?.city || null,
        country: bdcData.location?.country?.name || null
      };
    }
  } catch {
    // fall through to the ipify+ipwho.is fallback below
  }

  // Fallback: original provider (ipify for IPv4, ipwho.is for geo).
  try {
    const ipData = await fetchWithTimeout('https://api4.ipify.org?format=json');
    const ipv4 = ipData?.ip || null;

    if (ipv4) {
      const geoData = await fetchWithTimeout(`https://ipwho.is/${ipv4}`);
      if (geoData && geoData.success !== false) {
        return {
          ip_address: ipv4,
          city: geoData.city || null,
          country: geoData.country || null
        };
      }
      return { ip_address: ipv4, city: null, country: null };
    }
  } catch {
    // ignore
  }

  return {};
}

/** Record full login history row before page navigation */
export async function recordLoginHistory(profileId) {
  try {
    const ua = navigator.userAgent;
    const { deviceType, os } = detectDeviceAndOs(ua);
    const deviceBrand = deviceType === 'mobile' ? extractDeviceBrand(ua, os) : null;
    const browser = detectBrowser(ua);

    // Fetch IP and Location before insert (fast timeout)
    const location = await fetchIpLocation();

    const { error } = await supabase
      .from('login_history')
      .insert({
        profile_id: profileId,
        device_type: deviceType,
        device_brand: deviceBrand,
        os,
        browser,
        ip_address: location.ip_address || null,
        city: location.city || null,
        country: location.country || null
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
