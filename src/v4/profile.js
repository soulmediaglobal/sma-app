// SMA-app — Profile page (production/profile.html): view/edit the logged-in
// user's own `profiles` row (name, phone, company, bio) + notification
// preferences. Avatar upload is intentionally not implemented — `profiles`
// has no `avatar_url` column yet; needs a future migration + Supabase
// Storage bucket before that capability can be added. Avatar display falls
// back to a generated ui-avatars.com image in the meantime.
//
// User-facing strings here (alerts) are in English, matching
// profile.html — a deliberate, page-scoped exception to this project's
// normal Bahasa Indonesia UI convention (see AGENTS.md and the
// LANGUAGE NOTE in profile.html's <head>). Don't copy this English-only
// pattern into other pages' JS.

import { supabase } from '../lib/supabaseClient.js';

const roleLabels = { admin: 'Admin', supervisor: 'Supervisor', internal: 'Internal/Team', client: 'Client' };
const roleColors = { admin: 'danger', supervisor: 'warning', internal: 'primary', client: 'info' };

let currentProfileId = null;

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

    document.getElementById('profileAvatar').src =
      `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'User')}&background=0d6efd&color=fff&size=128`;

    document.getElementById('displayName').textContent = profile.full_name || 'User';
    document.getElementById('displayRole').textContent = roleLabels[profile.role] || profile.role;
    document.getElementById('userRoleBadge').textContent = roleLabels[profile.role] || profile.role;
    document.getElementById('userRoleBadge').className = `badge bg-${roleColors[profile.role] || 'secondary'}`;
    document.getElementById('displayEmail').lastChild.textContent = ` ${profile.email || '-'}`;

    const nameParts = (profile.full_name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    document.getElementById('editFirstName').value = firstName;
    document.getElementById('editLastName').value = lastName;
    document.getElementById('editEmail').value = profile.email || '';
    document.getElementById('editPhone').value = profile.phone || '';
    document.getElementById('editRole').value = roleLabels[profile.role] || profile.role;
    // Company/Bio editing intentionally disabled; fields are not part of the supported Profile UI.

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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error:', error);
    alert('Failed to load profile: ' + error.message);
  }
}

async function saveProfile() {
  if (!currentProfileId) {alert('User not found'); return;}

  const firstName = document.getElementById('editFirstName').value.trim();
  const lastName = document.getElementById('editLastName').value.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const data = {
    full_name: fullName,
    phone: document.getElementById('editPhone').value
    // Company/Bio intentionally excluded; no schema change is required.
  };

  try {
    await updateProfile(currentProfileId, data);
    alert('Profile saved successfully! ✅');
    await loadProfile();
  } catch (error) {
    alert('Failed to save: ' + error.message);
  }
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

  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
  document.getElementById('saveNotifBtn').addEventListener('click', saveNotifications);
  document.getElementById('cancelBtn').addEventListener('click', loadProfile);

  document.querySelectorAll('.connect-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      alert(`${btn.dataset.provider} connect coming soon! 🚀`);
    });
  });
}
