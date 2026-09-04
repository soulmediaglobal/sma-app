// SMA-app — auth guard for admin-shell pages.
// Runs once per page load on every page with body[data-shell="admin"].
// 1. No session → redirect to login.html.
// 2. Has session → fetch profile, paint name/role into the sidebar,
//    hide any nav item whose data-roles doesn't include this user's role,
//    and hide nav-groups left with zero visible items.

import { clearSession, getProfileResult, getSessionResult } from './auth.js';
import {
  AUTH_ROUTE,
  clientPortalHomeUrl,
  internalCmsUrl,
  internalLoginUrl,
  resolveProfileRoute
} from './auth-routing.js';
import { openMenu } from '../v4/menus.js';
import { showLocalLogoutModal } from '../v4/logout.js';

export const GUARD_DECISION = Object.freeze({
  ALLOWED: 'allowed',
  REDIRECTED: 'redirected',
  DENIED: 'denied'
});

const ROLE_LABEL = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  internal: 'Internal'
};

function applyRoleGate(role) {
  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.dataset.roles.split(',').map(r => r.trim());
    if (!allowed.includes(role)) {
      el.style.display = 'none';
    }
  });
  // Hide groups (label + wrapper) that ended up with no visible nav-link.
  document.querySelectorAll('.nav-group').forEach(group => {
    const hasVisible = Array.from(group.querySelectorAll('.nav-link')).some(
      link => link.style.display !== 'none'
    );
    if (!hasVisible) {
      group.style.display = 'none';
    }
  });
}

function paintSidebarUser(profile) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nameEl) {
    nameEl.textContent = profile.name || profile.id;
  }
  if (roleEl) {
    roleEl.textContent = ROLE_LABEL[profile.role] || profile.role;
  }
  if (avatarEl) {
    const initial = (profile.name || '?').trim().charAt(0).toUpperCase();
    avatarEl.childNodes[0].textContent = initial;
  }
}

function wireSignOut() {
  const moreBtn = document.querySelector('.sidebar-user .more-btn');
  if (!moreBtn) {
    return;
  }
  moreBtn.addEventListener('click', () => {
    openMenu(moreBtn, [{ label: 'Keluar', action: () => showLocalLogoutModal() }]);
  });
}

export function applyAdminProfile(profile) {
  paintSidebarUser(profile);
  applyRoleGate(profile.role);
  wireSignOut();
}

async function denyAdminAccess() {
  const { error } = await clearSession();
  if (error) {
    return {
      decision: GUARD_DECISION.DENIED,
      profile: null,
      error: true,
      redirectUrl: internalLoginUrl()
    };
  }
  const redirectUrl = internalLoginUrl();
  window.location.replace(redirectUrl);
  return { decision: GUARD_DECISION.DENIED, profile: null, error: false, redirectUrl };
}

export async function guardAdminPage() {
  if (document.body.dataset.shell !== 'admin') {
    return { decision: GUARD_DECISION.ALLOWED, profile: null };
  }

  const { session, error: sessionError } = await getSessionResult();
  if (sessionError) {
    return denyAdminAccess();
  }
  if (!session) {
    const redirectUrl = internalLoginUrl();
    window.location.replace(redirectUrl);
    return { decision: GUARD_DECISION.REDIRECTED, profile: null, redirectUrl };
  }

  const { profile, error: profileError } = await getProfileResult();
  if (profileError || !profile) {
    return denyAdminAccess();
  }

  const destination = resolveProfileRoute(profile);
  if (destination === AUTH_ROUTE.CLIENT) {
    const redirectUrl = clientPortalHomeUrl();
    window.location.replace(redirectUrl);
    return { decision: GUARD_DECISION.REDIRECTED, profile: null, redirectUrl };
  }
  if (destination !== AUTH_ROUTE.INTERNAL) {
    return denyAdminAccess();
  }
  const cmsUrl = internalCmsUrl();
  if (new URL(cmsUrl).origin !== window.location.origin) {
    window.location.replace(cmsUrl);
    return { decision: GUARD_DECISION.REDIRECTED, profile: null, redirectUrl: cmsUrl };
  }

  return { decision: GUARD_DECISION.ALLOWED, profile };
}
