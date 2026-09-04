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
  const { session } = await getSessionResult();
  return session;
}

export async function getSessionResult() {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: error ? null : data.session, error };
  } catch (error) {
    return { session: null, error };
  }
}

/** Current user's row from `profiles` (role, name, client_id), or null. */
export async function getProfile() {
  const { profile } = await getProfileResult();
  return profile;
}

export async function getProfileResult() {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return { profile: null, error: userError || new Error('Sesi tidak dapat diverifikasi.') };
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();
    return { profile: error ? null : data, error };
  } catch (error) {
    return { profile: null, error };
  }
}

export async function clearSession() {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      return { error };
    }
    const { session, error: sessionError } = await getSessionResult();
    if (sessionError || session) {
      return {
        error: sessionError || new Error('Sesi lokal belum dapat diakhiri.')
      };
    }
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/** Sign out and send the user back to the login page. */
export async function signOut(redirectTo = 'login.html') {
  const { error } = await clearSession();
  if (error) {
    return { error };
  }
  window.location.replace(redirectTo);
  return { error: null };
}
