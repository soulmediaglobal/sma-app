// SMA-app — shared profile update helper.
//
// The standalone "Profile Saya" page (production/profile.html) was
// consolidated into production/user_detail.html (Issue #119) —
// user_detail.js now handles viewing/editing both "my own profile"
// (no ?id= in the URL) and "another user's profile" (?id=<uuid>,
// admin/supervisor only) through the same page. This file now only
// holds updateProfile(), which user-detail.js imports and calls for
// both cases — kept here rather than moved into user-detail.js so the
// update logic has exactly one implementation regardless of which
// page/flow calls it.
//
// Editable fields are deliberately limited to `full_name` and `phone`
// — the only user-editable columns that actually exist on `profiles`
// (verified against supabase/migrations/*.sql). Callers must not pass
// `company`, `bio`, or `avatar_url` — those columns don't exist yet.

import { supabase } from '../lib/supabaseClient.js';

export async function updateProfile(userId, data) {
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId);
  if (error) {throw error;}
  return true;
}
