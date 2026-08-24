import { supabase } from '../lib/supabaseClient.js';

export function parseUserAgent(ua = navigator.userAgent) {
  let os = 'Unknown OS';
  if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  return os + ' · ' + browser;
}

export async function trackCurrentSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const currentDevice = parseUserAgent();
    await supabase
      .from('profiles')
      .update({
        last_sign_in_at: new Date().toISOString(),
        last_login_device: currentDevice
      })
      .eq('id', session.user.id);
  } catch (err) {
    console.error('Failed to track session:', err);
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return dateStr + ', ' + timeStr;
}

export async function initUserManagementTable() {
  const table = document.querySelector('#users-table');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div> Loading real data from Supabase...</td></tr>';

  try {
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profileErr) throw profileErr;

    const { data: assignees } = await supabase.from('case_assignees').select('user_id');
    const { data: clientCases } = await supabase.from('cases').select('client_id');

    const projectCounts = {};
    (assignees || []).forEach(item => {
      if (item.user_id) projectCounts[item.user_id] = (projectCounts[item.user_id] || 0) + 1;
    });
    (clientCases || []).forEach(item => {
      if (item.client_id) projectCounts[item.client_id] = (projectCounts[item.client_id] || 0) + 1;
    });

    if (!profiles || profiles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No users found in database.</td></tr>';
      return;
    }

    const roleBadges = {
      admin: 'bg-danger-subtle text-danger border border-danger',
      supervisor: 'bg-warning-subtle text-warning border border-warning',
      internal: 'bg-primary-subtle text-primary border border-primary',
      client: 'bg-success-subtle text-success border border-success'
    };

    tbody.innerHTML = profiles.map(user => {
      const initial = (user.full_name || user.email || 'U').charAt(0).toUpperCase();
      const role = (user.role || 'internal').toLowerCase();
      const badgeClass = roleBadges[role] || 'bg-secondary-subtle text-secondary border';
      const count = projectCounts[user.id] || 0;

      return '<tr>' +
        '<td><div class="d-flex align-items-center gap-2"><div class="avatar-circle bg-primary text-white d-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style="width: 32px; height: 32px; font-weight: bold; font-size: 14px;">' + initial + '</div><div><div class="fw-semibold text-body">' + (user.full_name || 'Unnamed User') + '</div><small class="text-muted">' + (user.email || '-') + '</small></div></div></td>' +
        '<td><span class="badge ' + badgeClass + ' text-uppercase px-2 py-1 fs-11">' + role + '</span></td>' +
        '<td>' + formatDate(user.created_at) + '</td>' +
        '<td><div>' + formatDateTime(user.last_sign_in_at) + '</div><small class="text-muted d-block">' + (user.last_login_device || 'No device info') + '</small></td>' +
        '<td>' + formatDateTime(user.updated_at) + '</td>' +
        '<td><span class="badge bg-secondary-subtle text-body border px-2 py-1 fs-12">' + count + ' Projects</span></td>' +
        '<td><button class="btn btn-sm btn-icon btn-ghost-secondary rounded-circle" data-user-id="' + user.id + '"><i class="bi bi-three-dots-vertical"></i></button></td>' +
      '</tr>';
    }).join('');

  } catch (err) {
    console.error('Error loading users table from Supabase:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Failed to load real data: ' + (err.message || err) + '</td></tr>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    trackCurrentSession();
    initUserManagementTable();
  });
} else {
  trackCurrentSession();
  initUserManagementTable();
}
