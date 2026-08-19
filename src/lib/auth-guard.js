// SMA-app — auth guard for admin-shell pages.
// Runs once per page load on every page with body[data-shell="admin"].
// 1. No session → redirect to login.html.
// 2. Has session → fetch profile, paint name/role into the sidebar,
//    hide any nav item whose data-roles doesn't include this user's role,
//    and hide nav-groups left with zero visible items.

import { getSession, getProfile, signOut } from './auth.js';
import { openMenu } from '../v4/menus.js';

const ROLE_LABEL = { admin: 'Admin', internal: 'Internal', client: 'Client' };

function applyRoleGate(role) {
  document.querySelectorAll('[data-roles]').forEach((el) => {
    const allowed = el.dataset.roles.split(',').map((r) => r.trim());
    if (!allowed.includes(role)) {el.style.display = 'none';}
  });
  // Hide groups (label + wrapper) that ended up with no visible nav-link.
  document.querySelectorAll('.nav-group').forEach((group) => {
    const hasVisible = Array.from(group.querySelectorAll('.nav-link'))
      .some((link) => link.style.display !== 'none');
    if (!hasVisible) {group.style.display = 'none';}
  });
}

function paintSidebarUser(profile) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nameEl) {nameEl.textContent = profile.name || profile.id;}
  if (roleEl) {roleEl.textContent = ROLE_LABEL[profile.role] || profile.role;}
  if (avatarEl) {
    const initial = (profile.name || '?').trim().charAt(0).toUpperCase();
    avatarEl.childNodes[0].textContent = initial;
  }
}

function wireSignOut() {
  const moreBtn = document.querySelector('.sidebar-user .more-btn');
  if (!moreBtn) {return;}
  moreBtn.addEventListener('click', () => {
    openMenu(moreBtn, [{ label: 'Keluar', action: () => signOut() }]);
  });
}

export async function guardAdminPage() {
  if (document.body.dataset.shell !== 'admin') {return;}

  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const profile = await getProfile();
  if (!profile) {
    // Logged in via Supabase Auth but no matching `profiles` row yet —
    // can't determine role, so don't guess. Send back to login with a
    // hint rather than rendering a broken/ungated dashboard.
    await signOut();
    return;
  }

  paintSidebarUser(profile);
  applyRoleGate(profile.role);
  wireSignOut();
}
