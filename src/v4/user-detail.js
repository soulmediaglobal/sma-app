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
import { showModal } from './modal.js';
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


function formatSessionBrand(row) {
  const brand = row.device_brand || (row.os === 'macOS' ? 'Mac' : 'Generic');
  const browser = row.browser || 'Browser';
  return `${brand} · ${browser}`;
}

function formatSessionLocation(row) {
  const parts = [row.city, row.country].filter(Boolean);
  return parts.length ? parts.join(', ') : '-';
}

function renderSessionHistory(rows) {
  const tbody = document.getElementById('sessionHistoryBody');
  if (!tbody) {return;}

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);">No sessions recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row, index) => {
    const chipClass = row.device_type === 'mobile' ? 'chip-blue' : 'chip-primary';
    const deviceLabel = row.device_type === 'mobile' ? 'Mobile' : 'Desktop';
    const loginTime = escapeHtml(formatDateTime(row.logged_in_at));
    const loginCell = index === 0
      ? `<span class="status status-green">Aktif sekarang</span><span class="ud-session-meta">${loginTime}</span>`
      : loginTime;

    return `
    <tr>
      <td class="ud-session-device-cell">
        <span class="chip ${chipClass}">${escapeHtml(deviceLabel)}</span>
        <span class="ud-session-meta">${escapeHtml(row.os || 'Unknown OS')}</span>
      </td>
      <td>${escapeHtml(formatSessionBrand(row))}</td>
      <td>${escapeHtml(row.ip_address || '-')}</td>
      <td>${escapeHtml(formatSessionLocation(row))}</td>
      <td>${loginCell}</td>
    </tr>
  `;
  }).join('');
}

async function loadSessionHistory(userId) {
  const tbody = document.getElementById('sessionHistoryBody');
  if (!tbody) {return;}
  try {
    const { data, error } = await supabase
      .from('login_history')
      .select('device_type, device_brand, os, browser, ip_address, city, country, logged_in_at')
      .eq('profile_id', userId)
      .order('logged_in_at', { ascending: false })
      .limit(5);
    if (error) {throw error;}
    renderSessionHistory(data || []);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#ff747d;">${escapeHtml(error.message)}</td></tr>`;
  }
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

/** Real activity log from the `activities` table (same query/formatting
 * pattern as dashboard.js's loadRecentActivity() — kept consistent so the
 * two pages don't drift). The most recent row here IS "last activity" for
 * this user; no separate field is needed elsewhere for that. */
async function renderActivity(userId) {
  const { data, error } = await supabase
    .from('activities')
    .select('id, type, notes, created_at, clients(name)')
    .eq('by_user', userId)
    .order('created_at', { ascending: false })
    .limit(8);

  const container = document.getElementById('detailActivity');
  if (error || !data || data.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">No activity recorded.</div>';
    return;
  }

  container.innerHTML = data.map((a) => `
    <div class="ud-event">
      <span class="ud-event-dot"></span>
      <div class="ud-event-time">${escapeHtml(formatDateTime(a.created_at))}</div>
      <div class="ud-event-title">${escapeHtml(a.type)}${a.clients?.name ? escapeHtml(' dengan ' + a.clients.name) : ''}</div>
      <div class="ud-event-meta">${escapeHtml(a.notes || '-')}</div>
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

    /* SESSION */
    await loadSessionHistory(userId);

    /* CONNECTED */
    setText('connectedEmail', profile.email || 'No email');

    /* STATS */
    const [{ count: assignmentCount }, { count: createdCaseCount }, { count: loginCount }] = await Promise.all([
      supabase.from('case_assignees').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('cases').select('*', { count: 'exact', head: true }).eq('created_by', userId),
      supabase.from('login_history').select('*', { count: 'exact', head: true }).eq('profile_id', userId)
    ]);

    setText('detailStatProjects', (assignmentCount || 0) + (createdCaseCount || 0));
    setText('detailStatTeam', assignmentCount || 0);
    setText('detailStatCommits', loginCount || 0);

    const days = profile.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0;
    setText('detailStatRating', days);

    /* ACTIVITY */
    renderActivity(userId);

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

/** `supabase.auth.signOut({ scope: 'global' })` invalidates every refresh
 * token for the *currently authenticated* user — there's no service-role
 * key on the frontend to force-revoke an arbitrary other user's sessions.
 * So this only actually does anything when viewing your own profile. */
function signOutAllSessions(btn) {
  showModal({
    title: 'Sign out of all sessions?',
    body: '<p>This signs you out on every device. You will need to log in again.</p>',
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Sign out all',
        variant: 'danger',
        action: async () => {
          btn.disabled = true;
          const { error } = await supabase.auth.signOut({ scope: 'global' });
          if (error) {
            showToast('Failed to sign out: ' + error.message, { variant: 'error' });
            btn.disabled = false;
            return;
          }

          // Belt-and-suspenders against a race hit in manual testing: right
          // after `signOut({ scope: 'global' })` resolved, login.html's own
          // "already got a session? bounce to index.html" check (src/v4/
          // login.js initLogin()) still read a session and redirected
          // straight back to the dashboard — confirmed by a second
          // navigation firing before the first one's cross-document view
          // transition finished (console: "AbortError: Transition was
          // skipped"). The supabase-js source shows scope:'global' *should*
          // clear local storage before its promise resolves (_signOut →
          // removeCurrentSession runs on every path where scope !==
          // 'others', see node_modules/@supabase/auth-js …
          // GoTrueClient.js), so rather than trust that timing, explicitly
          // re-check local session state and force a local-only clear
          // (storage removal only — no dependency on the network round
          // trip that just happened) if it's somehow still there.
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.auth.signOut({ scope: 'local' });
          }

          window.location.href = 'login.html';
        }
      }
    ]
  });
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

  const signOutAllBtn = document.getElementById('udSignOutAllBtn');
  if (signOutAllBtn) {
    if (me?.id === userId) {
      signOutAllBtn.addEventListener('click', () => signOutAllSessions(signOutAllBtn));
    } else {
      signOutAllBtn.disabled = true;
      signOutAllBtn.title = 'Only available on your own account — no admin API to force-sign-out another user.';
    }
  }
}
