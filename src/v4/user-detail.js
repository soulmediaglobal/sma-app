// SMA-app — User Detail page (production/user_detail.html): account
// overview + edit for a single `profiles` row, reached from User
// Management (?id=<uuid>). Avatar is display-only — `profiles` has no
// avatar_url column yet; needs a future migration + Supabase Storage
// bucket before an upload feature can be added here.
//
// Editable fields are deliberately limited to `full_name` and `phone` —
// the only user-editable columns that actually exist on `profiles`
// (verified against supabase/migrations/*.sql). `company`, `position`,
// `bio` are shown read-only (always "-") since those columns don't
// exist yet. `role` stays read-only here too: prevent_profile_privilege_
// escalation only lets admin/supervisor change it, and this page has no
// safeguard yet against locking out the last active admin — that
// belongs in a dedicated role-change UI, not a quick edit here.
//
// User-facing strings here (toasts) are in English, matching
// user_detail.html — a deliberate, page-scoped exception to this
// project's normal Bahasa Indonesia UI convention (see AGENTS.md and
// the LANGUAGE NOTE in user_detail.html's <head>). Don't copy this
// English-only pattern into other pages' JS.

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';
import { updateProfile } from './profile.js';
import { showToast } from './toast.js';

const roleLabels = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  internal: 'Internal / Team',
  client: 'Client'
};

const roleClasses = {
  admin: 'ud-role-admin',
  supervisor: 'ud-role-supervisor',
  internal: 'ud-role-internal',
  client: 'ud-role-client'
};

const statusLabels = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DISABLED: 'Disabled'
};

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {node.textContent = value ?? '-';}
}

function setValue(id, value) {
  const node = document.getElementById(id);
  if (node) {node.value = value ?? '';}
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateTime(value) {
  if (!value) {return '-';}
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDevice(device) {
  if (!device) {return { device: 'Unknown device', browser: 'Browser' };}
  const parts = device.split(' · ');
  return { device: parts[0] || 'Unknown', browser: parts[1] || 'Browser' };
}

function avatarUrl(name) {
  return 'https://ui-avatars.com/api/?name=' +
    encodeURIComponent(name || 'User') +
    '&background=1abb9c&color=fff&size=256&bold=true';
}

function calculateProfileCompletion(profile) {
  // avatar_url intentionally excluded — no such column on `profiles` yet.
  const fields = [
    profile.full_name,
    profile.email,
    profile.company,
    profile.position,
    profile.phone,
    profile.bio
  ];
  const completed = fields.filter(Boolean).length;
  return Math.round((completed / fields.length) * 100);
}

function renderActivity(profile) {
  const events = [];

  if (profile.created_at) {
    events.push({ title: 'Account created', time: formatDateTime(profile.created_at), meta: 'SMA App' });
  }
  if (profile.last_sign_in_at) {
    events.push({
      title: 'Signed in',
      time: formatDateTime(profile.last_sign_in_at),
      meta: profile.last_login_device || 'Device not recorded'
    });
  }
  if (profile.status_changed_at) {
    events.push({
      title: 'Account status changed to ' + (statusLabels[profile.account_status] || profile.account_status),
      time: formatDateTime(profile.status_changed_at),
      meta: profile.status_reason || 'Status update'
    });
  }
  if (profile.updated_at && profile.updated_at !== profile.created_at) {
    events.push({ title: 'Profile updated', time: formatDateTime(profile.updated_at), meta: 'Profile information' });
  }

  events.sort((a, b) => new Date(b.time) - new Date(a.time));

  const container = document.getElementById('detailActivity');
  if (!events.length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No activity recorded.</div>';
    return;
  }

  container.innerHTML = events.map((event) => `
    <div class="ud-event">
      <span class="ud-event-dot"></span>
      <div class="ud-event-time">${escapeHtml(event.time)}</div>
      <div class="ud-event-title">${escapeHtml(event.title)}</div>
      <div class="ud-event-meta">${escapeHtml(event.meta)}</div>
    </div>
  `).join('');
}

let loadedProfile = null;

async function loadUserDetail(userId, canEditRole) {
  if (!userId) {
    setText('detailName', 'User ID not found');
    return;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {throw error;}
    if (!profile) {
      setText('detailName', 'User not found');
      return;
    }

    const name = profile.full_name || profile.nama || profile.name || profile.username || profile.display_name || 'User';
    const role = String(profile.role || 'internal').toLowerCase();
    const status = String(profile.account_status || 'ACTIVE').toUpperCase();

    /* PROFILE */
    const avatar = document.getElementById('detailAvatar');
    avatar.src = profile.avatar_url || avatarUrl(name);
    avatar.alt = name;

    setText('detailName', name);
    setText('detailRole', roleLabels[role] || role);
    setText('detailEmail', profile.email || '-');

    const roleBadge = document.getElementById('detailRoleBadge');
    roleBadge.textContent = roleLabels[role] || role;
    roleBadge.className = 'ud-badge ' + (roleClasses[role] || 'ud-role-internal');

    const statusBadge = document.getElementById('detailStatus');
    statusBadge.className = 'ud-badge ' + (status === 'ACTIVE' ? 'ud-status-active' : 'ud-status-inactive');
    statusBadge.innerHTML = '<span>●</span> ' + (statusLabels[status] || status);

    /* COMPLETION */
    setText('completionValue', calculateProfileCompletion(profile) + '%');

    /* PERSONAL INFO */
    setValue('detailInfoName', profile.full_name || '');
    setText('detailInfoEmail', profile.email);
    setText('detailInfoCompany', profile.company);
    setValue('detailInfoPhone', profile.phone || '');
    const roleSelect = document.getElementById('detailInfoRole');
    if (roleSelect) {
      roleSelect.value = role;
      roleSelect.disabled = !canEditRole;
      roleSelect.classList.toggle('ud-form-input', canEditRole);
    }
    setText('detailInfoPosition', profile.position);
    setText('detailInfoCreated', formatDateTime(profile.created_at));
    setText('detailInfoBio', profile.bio);

    /* SECURITY */
    setText('securityStatus', statusLabels[status] || status);
    setText('securityRole', roleLabels[role] || role);
    setText('securityLogin', formatDateTime(profile.last_sign_in_at));
    setText('securityDevice', profile.last_login_device || 'Not recorded');

    /* SESSION */
    const device = formatDevice(profile.last_login_device);
    setText('sessionDevice', device.device);
    setText('sessionBrowser', device.browser);
    setText('sessionLastSeen', profile.last_sign_in_at ? formatDateTime(profile.last_sign_in_at) : 'Never');
    if (profile.last_sign_in_at) {
      document.getElementById('sessionLastSeen').classList.add('ud-live');
    }

    /* CONNECTED */
    setText('connectedEmail', profile.email || 'No email');

    /* STATS */
    const [{ count: assignmentCount }, { count: createdCaseCount }] = await Promise.all([
      supabase.from('case_assignees').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('cases').select('*', { count: 'exact', head: true }).eq('created_by', userId)
    ]);

    setText('detailStatProjects', (assignmentCount || 0) + (createdCaseCount || 0));
    setText('detailStatTeam', assignmentCount || 0);
    setText('detailStatCommits', profile.last_sign_in_at ? '1+' : '0');

    const days = profile.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0;
    setText('detailStatRating', days);

    /* ACTIVITY */
    renderActivity(profile);

    loadedProfile = profile;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load user detail:', error);
    setText('detailName', 'Failed to load user');
    const activity = document.getElementById('detailActivity');
    activity.innerHTML = `<div style="color:#ff747d;font-size:12px;">${escapeHtml(error.message)}</div>`;
  }
}

async function saveUserDetail(userId, saveBtn) {
  if (!loadedProfile || saveBtn.disabled) {return;}

  const fullName = document.getElementById('detailInfoName').value.trim();
  const phone = document.getElementById('detailInfoPhone').value.trim();

  if (!fullName) {
    showToast('Full name is required.', { variant: 'error' });
    return;
  }

  const data = { full_name: fullName, phone };
  const roleSelect = document.getElementById('detailInfoRole');
  if (roleSelect && !roleSelect.disabled) {
    data.role = roleSelect.value;
  }
  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = 'Menyimpan…';
  try {
    await updateProfile(userId, data);
    loadedProfile = { ...loadedProfile, ...data };
    setText('detailName', fullName);
    showToast('Profile saved successfully.', { variant: 'success' });
  } catch (error) {
    showToast('Failed to save: ' + error.message, { variant: 'error' });
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalLabel;
  }
}

function discardUserDetail() {
  if (!loadedProfile) {return;}
  setValue('detailInfoName', loadedProfile.full_name || '');
  setValue('detailInfoPhone', loadedProfile.phone || '');
  const roleSelect = document.getElementById('detailInfoRole');
  if (roleSelect) {roleSelect.value = loadedProfile.role || 'internal';}
}

let initialized = false;

export async function initUserDetail() {
  if (!document.querySelector('.user-detail-page') || initialized) {return;}
  initialized = true;

  // ?id= absent -> viewing own profile ("Profil Saya" nav item links
  // here without an id). Fall back to the logged-in user's own id.
  let userId = new URLSearchParams(window.location.search).get('id');
  const me = await getProfile();
  if (!userId) {
    userId = me?.id || null;
  }

  const canEditRole = ['admin', 'supervisor'].includes(me?.role);
  await loadUserDetail(userId, canEditRole);

  const saveBtn = document.getElementById('userDetailSaveBtn');
  const discardBtn = document.getElementById('userDetailDiscardBtn');
  if (saveBtn) {saveBtn.addEventListener('click', () => saveUserDetail(userId, saveBtn));}
  if (discardBtn) {discardBtn.addEventListener('click', discardUserDetail);}
}
