import { supabase } from './supabaseClient.js';
import { signOut } from './auth.js';
import { clientPortalUrl, resolveProfileRoute } from './auth-routing.js';

export { clientPortalUrl, internalCmsUrl } from './auth-routing.js';
const PROFILE_RETRY_DELAYS = [0, 250, 500, 1000, 1500];

export function clientCallbackUrl() {
  return clientPortalUrl('client-auth-callback.html');
}

export function clientSetPasswordUrl() {
  return clientPortalUrl('client-set-password.html');
}

export async function signInClientWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: clientCallbackUrl() }
  });
}

export async function signInClientWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function requestClientPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: clientSetPasswordUrl()
  });
}

export async function setClientPassword(password) {
  return supabase.auth.updateUser({ password });
}

export async function restoreClientSession() {
  try {
    const callbackUrl = new URL(window.location.href);
    const code = callbackUrl.searchParams.get('code');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {return { session: null, error };}
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      return { session: null, error: error || new Error('Sesi login tidak ditemukan.') };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { session: null, error: userError || new Error('Akun tidak dapat diverifikasi.') };
    }

    return { session: data.session, user: userData.user, error: null };
  } catch (error) {
    return { session: null, user: null, error };
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function waitForClientProfile(userId) {
  let lastError = null;

  for (const delay of PROFILE_RETRY_DELAYS) {
    if (delay) {await wait(delay);}
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, full_name, email, phone, role, client_id, account_status')
        .eq('id', userId)
        .maybeSingle();

      if (data) {return { profile: data, error: null };}
      if (error) {lastError = error;}
    } catch (error) {
      lastError = error;
    }
  }

  return {
    profile: null,
    error: lastError || new Error('Profil belum selesai disiapkan.')
  };
}

export function routeForClientProfile(profile) {
  return resolveProfileRoute(profile);
}

export function isClientProfileComplete(profile) {
  return Boolean(profile?.name?.trim() && profile?.phone?.trim());
}

export async function signOutClient() {
  const loginUrl = clientPortalUrl('client-portal-login.html');
  return signOut(loginUrl);
}

export async function updateClientProfile(profileId, name, phone) {
  return supabase
    .from('profiles')
    .update({ name, full_name: name, phone })
    .eq('id', profileId)
    .select('id, name, full_name, email, phone, role, client_id, account_status')
    .single();
}
