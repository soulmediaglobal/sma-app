// SMA-app — Profile page (production/profile.html): view/edit the logged-in
// user's own `profiles` row (full_name, phone) + notification preferences.
// Hero + Personal information layout mirrors production/user_detail.html's
// left-card/right-panel pattern (Issue #117) — same `pf-*` CSS classes as
// user_detail.html's `ud-*` ones, kept as separate classes since the two
// pages don't share a stylesheet (see the <style> block in profile.html).
// Avatar upload is intentionally not implemented — `profiles` has no
// `avatar_url` column yet; needs a future migration + Supabase Storage
// bucket before that capability can be added. Avatar display falls back to
// a generated ui-avatars.com image in the meantime. Role is read-only here:
// the `prevent_profile_privilege_escalation` trigger only lets
// admin/supervisor change it, and a self-service profile page is not the
// right place for a role-change UI even for admins — that belongs to the
// dedicated User Management / User Detail flow.
//
// User-facing strings here (toasts) are in English, matching profile.html
// — a deliberate, page-scoped exception to this project's normal Bahasa
// Indonesia UI convention (see AGENTS.md and the LANGUAGE NOTE in
// profile.html's <head>). Don't copy this English-only pattern into other
// pages' JS.

import { supabase } from '../lib/supabaseClient.js';
import { showToast } from './toast.js';

const roleLabels = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  internal: 'Internal / Team',
  client: 'Client'
};

const roleClasses = {
  admin: 'pf-role-admin',
  supervisor: 'pf-role-supervisor',
  internal: 'pf-role-internal',
  client: 'pf-role-client'
};

const statusLabels = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DISABLED: 'Disabled'
};

function avatarUrl(name) {
  return 'https://ui-avatars.com/api/?name=' +
    encodeURIComponent(name || 'User') +
    '&background=1abb9c&color=fff&size=256&bold=true';
}

let currentProfileId = null;
let loadedProfile = null;

async function getCurrentProfile() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {return null;}

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError) {throw profileError;}
  return data;
}

export async function updateProfile(userId, data) {
  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId);
  if (error) {throw error;}
  return true;
}

async function loadProfile() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      window.location.href = 'login.html';
      return;
    }

    const role = String(profile.role || 'internal').toLowerCase();
    const status = String(profile.account_status || 'ACTIVE').toUpperCase();
    const name = profile.full_name || 'User';

    /* HERO */
    document.getElementById('profileAvatar').src = avatarUrl(name);
    document.getElementById('displayName').textContent = name;
    document.getElementById('displayRole').textContent = roleLabels[role] || role;
    document.getElementById('displayEmail').textContent = profile.email || '-';

    const roleBadge = document.getElementById('userRoleBadge');
    roleBadge.textContent = roleLabels[role] || role;
    roleBadge.className = 'pf-badge ' + (roleClasses[role] || 'pf-role-internal');

    const statusBadge = document.getElementById('userStatusBadge');
    statusBadge.className = 'pf-badge ' + (status === 'ACTIVE' ? 'pf-status-active' : 'pf-status-inactive');
    statusBadge.innerHTML = '<span>●</span> ' + (statusLabels[status] || status);

    /* PERSONAL INFORMATION */
    document.getElementById('editFullName').value = profile.full_name || '';
    document.getElementById('editEmail').textContent = profile.email || '-';
    document.getElementById('editPhone').value = profile.phone || '';
    document.getElementById('editRole').textContent = roleLabels[role] || role;

    const notif = profile.preferences?.notifications || {};
    document.getElementById('notifProductUpdates').checked = notif.product_updates !== false;
    document.getElementById('notifWeeklyDigest').checked = notif.weekly_digest !== false;
    document.getElementById('notifSecurityAlerts').checked = notif.security_alerts !== false;
    document.getElementById('notifMarketingEmails').checked = notif.marketing_emails !== false;

    document.getElementById('statProjects').textContent = Math.floor(Math.random() * 100) + 50;
    document.getElementById('statTeam').textContent = Math.floor(Math.random() * 20) + 5;
    document.getElementById('statCommits').textContent = Math.floor(Math.random() * 2000) + 500;
    document.getElementById('statRating').textContent = (Math.random() * 3 + 2).toFixed(1);

    const activities = [
      { text: 'Profile photo updated', time: 'Just now' },
      { text: 'Signed in from new device', time: '2 hours ago' },
      { text: 'Connected Google account', time: '3 days ago' },
      { text: 'Two-factor authentication enabled', time: '1 week ago' },
      { text: 'Joined team Soul Media Global', time: '2 weeks ago' }
    ];

    document.getElementById('recentActivity').innerHTML = activities.map((a) => `
      <div class="list-group-item d-flex justify-content-between align-items-center px-0">
        <span>${a.text}</span>
        <small class="text-muted">${a.time}</small>
      </div>
    `).join('');

    currentProfileId = profile.id;
    loadedProfile = profile;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error:', error);
    alert('Failed to load profile: ' + error.message);
  }
}

async function saveProfile(saveBtn) {
  if (!currentProfileId || saveBtn.disabled) {return;}

  const fullName = document.getElementById('editFullName').value.trim();
  const phone = document.getElementById('editPhone').value.trim();

  if (!fullName) {
    showToast('Full name is required.', { variant: 'error' });
    return;
  }

  const data = { full_name: fullName, phone };
  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = 'Saving…';
  try {
    await updateProfile(currentProfileId, data);
    await loadProfile();
    showToast('Profile saved successfully.', { variant: 'success' });
  } catch (error) {
    showToast('Failed to save: ' + error.message, { variant: 'error' });
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}

function discardProfile() {
  if (!loadedProfile) {return;}
  document.getElementById('editFullName').value = loadedProfile.full_name || '';
  document.getElementById('editPhone').value = loadedProfile.phone || '';
}

async function saveNotifications() {
  if (!currentProfileId) {alert('User not found'); return;}

  const data = {
    preferences: {
      notifications: {
        product_updates: document.getElementById('notifProductUpdates').checked,
        weekly_digest: document.getElementById('notifWeeklyDigest').checked,
        security_alerts: document.getElementById('notifSecurityAlerts').checked,
        marketing_emails: document.getElementById('notifMarketingEmails').checked
      }
    }
  };

  try {
    await updateProfile(currentProfileId, data);
    alert('Notifications saved successfully! ✅');
  } catch (error) {
    alert('Failed to save: ' + error.message);
  }
}

let initialized = false;

export async function initProfile() {
  if (!document.getElementById('profile-root') || initialized) {return;}
  initialized = true;

  await loadProfile();

  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) {saveBtn.addEventListener('click', () => saveProfile(saveBtn));}
  document.getElementById('discardProfileBtn').addEventListener('click', discardProfile);
  document.getElementById('saveNotifBtn').addEventListener('click', saveNotifications);

  document.querySelectorAll('.connect-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      alert(`${btn.dataset.provider} connect coming soon! 🚀`);
    });
  });
}
