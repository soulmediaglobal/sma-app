export const AUTH_ROUTE = Object.freeze({
  INTERNAL: 'internal',
  CLIENT: 'client',
  BLOCKED: 'blocked'
});

const INTERNAL_ROLES = new Set(['admin', 'supervisor', 'internal']);
const CMS_PRODUCTION_ORIGIN = 'https://team.soulmitra.id';
const CLIENT_PRODUCTION_ORIGIN = 'https://mitra.soulmitra.id';
const PRODUCTION_HOSTS = new Set(['team.soulmitra.id', 'mitra.soulmitra.id']);

export function resolveProfileRoute(profile) {
  if (!profile || profile.account_status !== 'ACTIVE') {
    return AUTH_ROUTE.BLOCKED;
  }
  if (INTERNAL_ROLES.has(profile.role)) {
    return AUTH_ROUTE.INTERNAL;
  }
  if (profile.role === 'client') {
    return AUTH_ROUTE.CLIENT;
  }
  return AUTH_ROUTE.BLOCKED;
}

function pageUrl(page) {
  return new URL(page, window.location.href).href;
}

function productionUrl(origin, page) {
  return new URL(`/production/${page}`, origin).href;
}

export function clientPortalUrl(page) {
  if (PRODUCTION_HOSTS.has(window.location.hostname)) {
    return productionUrl(CLIENT_PRODUCTION_ORIGIN, page);
  }
  return pageUrl(page);
}

export function clientPortalHomeUrl() {
  return clientPortalUrl('client-portal.html');
}

export function internalCmsUrl() {
  if (PRODUCTION_HOSTS.has(window.location.hostname)) {
    return productionUrl(CMS_PRODUCTION_ORIGIN, 'index.html');
  }
  return pageUrl('index.html');
}

export function internalLoginUrl() {
  if (PRODUCTION_HOSTS.has(window.location.hostname)) {
    return productionUrl(CMS_PRODUCTION_ORIGIN, 'login.html');
  }
  return pageUrl('login.html');
}
