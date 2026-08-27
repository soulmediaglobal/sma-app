// SMA-app — Logs & Activity (Issue #138).
// Login history is an audit trail. A newest row must not be presented as an
// active session because login_history has no session/revocation state.

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';

const PAGE_SIZE = 20;
const allowedRoles = new Set(['admin', 'supervisor']);
const roleLabels = {
  admin: 'Admin',
  supervisor: 'Supervisor',
  internal: 'Internal',
  client: 'Client'
};

let initialized = false;
let currentPage = 1;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateTime(value) {
  if (!value) {return '—';}
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function localDayStart(daysAgo = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function activateTab(tab) {
  const name = tab.dataset.logsTab;
  document.querySelectorAll('[data-logs-tab]').forEach((candidate) => {
    const active = candidate === tab;
    candidate.classList.toggle('active', active);
    candidate.setAttribute('aria-selected', String(active));
    candidate.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-logs-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.logsPanel !== name;
  });
}

function wireTabs() {
  const tabs = Array.from(document.querySelectorAll('[data-logs-tab]'));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex;
      if (event.key === 'ArrowRight') {nextIndex = (index + 1) % tabs.length;}
      if (event.key === 'ArrowLeft') {nextIndex = (index - 1 + tabs.length) % tabs.length;}
      if (event.key === 'Home') {nextIndex = 0;}
      if (event.key === 'End') {nextIndex = tabs.length - 1;}
      if (nextIndex === undefined) {return;}
      event.preventDefault();
      activateTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
}

function setStat(id, value) {
  const element = document.getElementById(id);
  if (element) {element.textContent = String(value ?? 0);}
}

async function loadDashboard() {
  const root = document.getElementById('logs-dashboard-root');
  const state = document.getElementById('logs-dashboard-state');
  const queries = [
    supabase.from('login_history').select('*', { count: 'exact', head: true }),
    supabase.from('login_history').select('*', { count: 'exact', head: true }).gte('logged_in_at', localDayStart()),
    supabase.from('login_history').select('*', { count: 'exact', head: true }).gte('logged_in_at', localDayStart(6)),
    supabase.from('login_history').select('*', { count: 'exact', head: true }).eq('device_type', 'desktop'),
    supabase.from('login_history').select('*', { count: 'exact', head: true }).eq('device_type', 'mobile')
  ];

  try {
    const results = await Promise.all(queries);
    const failed = results.find((result) => result.error);
    if (failed) {throw failed.error;}
    ['total', 'today', 'week', 'desktop', 'mobile'].forEach((name, index) => {
      setStat(`logs-stat-${name}`, results[index].count);
    });
    state.textContent = '';
  } catch {
    state.textContent = 'Gagal memuat ringkasan login. Periksa izin akses data lalu coba lagi.';
  } finally {
    root.setAttribute('aria-busy', 'false');
  }
}

function renderRows(rows) {
  const body = document.getElementById('logs-activity-body');
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="7">Belum ada riwayat login.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((row) => {
    const profile = row.profile || {};
    const name = profile.name || profile.email || 'Pengguna tidak dikenal';
    const email = profile.email && profile.email !== name ? `<div class="stat-subtext">${escapeHtml(profile.email)}</div>` : '';
    const device = [row.device_brand, row.os, row.device_type].filter(Boolean).join(' · ') || '—';
    const location = [row.city, row.country].filter(Boolean).join(', ') || '—';
    return `<tr>
      <td class="cell-strong">${escapeHtml(name)}${email}</td>
      <td>${escapeHtml(roleLabels[profile.role] || profile.role || '—')}</td>
      <td>${escapeHtml(device)}</td>
      <td>${escapeHtml(row.browser || '—')}</td>
      <td>${escapeHtml(row.ip_address || '—')}</td>
      <td>${escapeHtml(location)}</td>
      <td>${escapeHtml(formatDateTime(row.logged_in_at))}</td>
    </tr>`;
  }).join('');
}

async function loadActivityPage(page) {
  const root = document.getElementById('logs-activity-root');
  const body = document.getElementById('logs-activity-body');
  const previous = document.getElementById('logs-page-prev');
  const next = document.getElementById('logs-page-next');
  const info = document.getElementById('logs-page-info');
  root.setAttribute('aria-busy', 'true');
  body.innerHTML = '<tr><td colspan="7">Memuat…</td></tr>';
  previous.disabled = true;
  next.disabled = true;

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  try {
    const { data, count, error } = await supabase
      .from('login_history')
      .select('id, device_type, device_brand, os, browser, ip_address, city, country, logged_in_at, profile:profiles(name, email, role)', { count: 'exact' })
      .order('logged_in_at', { ascending: false })
      .range(from, to);
    if (error) {throw error;}

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(page, totalPages);
    if (page > totalPages) {
      await loadActivityPage(totalPages);
      return;
    }
    renderRows(data || []);
    info.textContent = `Halaman ${currentPage} dari ${totalPages} · ${total} login`;
    previous.disabled = currentPage <= 1;
    next.disabled = currentPage >= totalPages;
  } catch {
    body.innerHTML = '<tr><td colspan="7">Gagal memuat riwayat login. Periksa izin akses data lalu coba lagi.</td></tr>';
    info.textContent = 'Data tidak tersedia';
  } finally {
    root.setAttribute('aria-busy', 'false');
  }
}

function wirePagination() {
  document.getElementById('logs-page-prev').addEventListener('click', () => {
    if (currentPage > 1) {loadActivityPage(currentPage - 1);}
  });
  document.getElementById('logs-page-next').addEventListener('click', () => {
    loadActivityPage(currentPage + 1);
  });
}

function showAccessDenied() {
  const root = document.getElementById('logs-dashboard-root');
  root.innerHTML = '<div class="stat-subtext">Anda tidak memiliki akses ke halaman ini.</div>';
  root.setAttribute('aria-busy', 'false');
  document.querySelectorAll('[data-logs-tab]').forEach((tab) => {tab.disabled = true;});
}

export async function initLogs() {
  if (document.body.dataset.page !== 'logs' || initialized) {return;}
  initialized = true;

  const profile = await getProfile();
  if (!profile || !allowedRoles.has(profile.role)) {
    showAccessDenied();
    return;
  }

  wireTabs();
  wirePagination();
  await Promise.all([loadDashboard(), loadActivityPage(1)]);
}
