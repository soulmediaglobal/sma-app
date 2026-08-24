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

    const roleStyles = {
      admin: 'background-color: rgba(220, 53, 69, 0.25); color: #ff6b6b; border: 1px solid rgba(220, 53, 69, 0.5);',
      supervisor: 'background-color: rgba(255, 193, 7, 0.25); color: #ffd166; border: 1px solid rgba(255, 193, 7, 0.5);',
      internal: 'background-color: rgba(13, 110, 253, 0.25); color: #6ea8fe; border: 1px solid rgba(13, 110, 253, 0.5);',
      client: 'background-color: rgba(25, 135, 84, 0.25); color: #75b798; border: 1px solid rgba(25, 135, 84, 0.5);'
    };

    const avatarColors = ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#198754', '#20c997', '#0dcaf0'];

    tbody.innerHTML = profiles.map(user => {
      const name = user.full_name || user.nama || user.name || user.username || user.display_name || user.email || 'User ' + String(user.id).slice(0, 5);
      const email = user.email || user.user_email || '-';
      const initial = name.charAt(0).toUpperCase();
      const role = (user.role || 'internal').toLowerCase();

      const bgAvatar = avatarColors[Math.abs(String(user.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % avatarColors.length];
      const rStyle = roleStyles[role] || 'background-color: rgba(108, 117, 125, 0.25); color: #adb5bd; border: 1px solid rgba(108, 117, 125, 0.5);';
      const count = projectCounts[user.id] || 0;

      return '<tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">' +
        '<td style="padding: 12px 16px;"><div style="display: flex; align-items: center; gap: 12px;"><div style="width: 36px; height: 36px; border-radius: 50%; background-color: ' + bgAvatar + '; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; flex-shrink: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">' + initial + '</div><div><div style="font-weight: 600; color: #f8fafc; font-size: 14px;">' + name + '</div><div style="font-size: 12px; color: #94a3b8;">' + email + '</div></div></div></td>' +
        '<td style="padding: 12px 16px;"><span style="padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ' + rStyle + '">' + role + '</span></td>' +
        '<td style="padding: 12px 16px; color: #cbd5e1; font-size: 13px;">' + formatDate(user.created_at) + '</td>' +
        '<td style="padding: 12px 16px;"><div style="color: #cbd5e1; font-size: 13px;">' + formatDateTime(user.last_sign_in_at) + '</div><small style="color: #64748b; font-size: 11px; display: block; margin-top: 2px;">' + (user.last_login_device || 'No device info') + '</small></td>' +
        '<td style="padding: 12px 16px; color: #cbd5e1; font-size: 13px;">' + formatDateTime(user.updated_at) + '</td>' +
        '<td style="padding: 12px 16px;"><span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; background: rgba(255,255,255,0.06); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.15); display: inline-block;">' + count + ' Projects</span></td>' +
        '<td style="padding: 12px 16px; text-align: center;"><button type="button" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; cursor: pointer; width: 30px; height: 30px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px;" data-user-id="' + user.id + '">⋮</button></td>' +
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
