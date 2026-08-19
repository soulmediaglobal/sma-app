// SMA-app — auth helpers.
// OTP (email code) login only, no password. `shouldCreateUser: false` means
// only emails that already exist in Supabase Auth can log in — this is an
// internal/invite-only tool, not public self-signup. Admin invites people
// via Supabase Dashboard > Authentication > Users > Invite, then adds a
// matching row in `profiles` with their role.

import { supabase } from './supabaseClient.js';

/** Send a one-time login code to `email`. */
export async function requestOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/production/index.html`
    }
  });
  return { error };
}

/** Verify the 6-digit code sent to `email`. Establishes the session on success. */
export async function verifyOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });
  return { data, error };
}

/** Current session, or null if not logged in. */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Current user's row from `profiles` (role, name, client_id), or null. */
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {return null;}
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Gagal ambil profile:', error.message);
    return null;
  }
  return data;
}

/** Sign out and send the user back to the login page. */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}
