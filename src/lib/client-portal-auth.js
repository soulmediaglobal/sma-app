import { supabase } from './supabaseClient.js';

const STAFF_ROLES = new Set(['admin', 'supervisor', 'internal']);
const PROFILE_RETRY_DELAYS = [0, 250, 500, 1000, 1500];

export function clientPortalUrl(page) {
  return new URL(page, window.location.href).href;
}

export function clientCallbackUrl() {
  return clientPortalUrl('client-auth-callback.html');
}

export function internalCmsUrl() {
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return clientPortalUrl('index.html');
  }
  return 'https://team.soulmitra.id/production/index.html';
}

export async function signInClientWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: clientCallbackUrl() }
  });
}

export async function requestClientMagicLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: clientCallbackUrl()
    }
  });
}

export async function restoreClientSession() {
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
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function waitForClientProfile(userId) {
  let lastError = null;

  for (const delay of PROFILE_RETRY_DELAYS) {
    if (delay) {await wait(delay);}
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, full_name, email, phone, role, client_id, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (data) {return { profile: data, error: null };}
    if (error) {lastError = error;}
  }

  return {
    profile: null,
    error: lastError || new Error('Profil belum selesai disiapkan.')
  };
}

export function routeForClientProfile(profile) {
  if (profile.account_status !== 'ACTIVE') {return 'blocked';}
  if (STAFF_ROLES.has(profile.role)) {return 'internal';}
  if (profile.role === 'client') {return 'client';}
  return 'blocked';
}

export function isClientProfileComplete(profile) {
  return Boolean(profile?.name?.trim() && profile?.phone?.trim());
}

export async function signOutClient() {
  await supabase.auth.signOut();
  window.location.replace(clientPortalUrl('client-portal-login.html'));
}

export async function updateClientProfile(profileId, name, phone) {
  return supabase
    .from('profiles')
    .update({ name, full_name: name, phone })
    .eq('id', profileId)
    .select('id, name, full_name, email, phone, role, client_id, account_status')
    .single();
}
