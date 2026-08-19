// SMA-app — Overview Dashboard data wiring.
// Pulls stat cards, status breakdown, recent activity, and recent cases
// straight from Supabase. Only runs on index.html (body[data-page="dashboard"]).

import { supabase } from '../lib/supabaseClient.js';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_COLOR = {
  Baru: 'var(--blue)',
  Proses: 'var(--yellow)',
  Selesai: 'var(--green)',
  Batal: 'var(--red)'
};

const STATUS_BADGE = {
  Baru: 'status-blue',
  Proses: 'status-yellow',
  Selesai: 'status-green',
  Batal: 'status-red'
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) {return 'Baru saja';}
  if (min < 60) {return `${min} menit lalu`;}
  const hr = Math.floor(min / 60);
  if (hr < 24) {return `${hr} jam lalu`;}
  const day = Math.floor(hr / 24);
  return `${day} hari lalu`;
}

function initials(name) {
  if (!name) {return '?';}
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

async function loadStatCards() {
  const [clientCount, activeCases, pendingPayments, activeRab] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('cases').select('*', { count: 'exact', head: true }).in('status', ['Baru', 'Proses']),
    supabase.from('payments').select('amount').eq('status', 'Pending'),
    supabase.from('cases').select('total_rab').in('status', ['Baru', 'Proses'])
  ]);

  document.getElementById('stat-total-client').textContent = clientCount.count ?? '0';
  document.getElementById('stat-case-aktif').textContent = activeCases.count ?? '0';

  const piutangTotal = (pendingPayments.data || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  document.getElementById('stat-piutang').textContent = rupiah.format(piutangTotal);

  const rabTotal = (activeRab.data || []).reduce((sum, c) => sum + Number(c.total_rab || 0), 0);
  document.getElementById('stat-rab-aktif').textContent = rupiah.format(rabTotal);
}

async function loadStatusBreakdown() {
  const { data, error } = await supabase.from('cases').select('status');
  const el = document.getElementById('status-breakdown');
  if (error || !data) {
    el.innerHTML = '<div class="stat-subtext">Gagal memuat data.</div>';
    return;
  }
  const counts = { Baru: 0, Proses: 0, Selesai: 0, Batal: 0 };
  data.forEach((c) => { if (counts[c.status] !== undefined) {counts[c.status] += 1;} });
  const total = data.length || 1;

  el.innerHTML = Object.entries(counts).map(([status, n]) => `
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span>${status}</span><span style="color:var(--text-muted)">${n}</span>
      </div>
      <div class="progress-thin"><div class="bar" style="width:${(n / total) * 100}%;background:${STATUS_COLOR[status]}"></div></div>
    </div>
  `).join('');
}

async function loadRecentActivity() {
  const { data, error } = await supabase
    .from('activities')
    .select('id, type, notes, created_at, clients(name), by:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(6);

  const el = document.getElementById('activity-list');
  if (error || !data || data.length === 0) {
    el.innerHTML = '<li class="activity-item"><div class="activity-body">Belum ada aktivitas.</div></li>';
    return;
  }
  el.innerHTML = data.map((a) => `
    <li class="activity-item">
      <div class="activity-avatar" style="background:var(--primary)">${initials(a.by?.name)}</div>
      <div>
        <div class="activity-body"><strong>${a.by?.name || 'Seseorang'}</strong> — ${a.type}${a.clients?.name ? ` dengan <strong>${a.clients.name}</strong>` : ''}${a.notes ? `: ${a.notes}` : ''}</div>
        <div class="activity-time">${timeAgo(a.created_at)}</div>
      </div>
    </li>
  `).join('');
}

async function loadRecentCases() {
  const { data, error } = await supabase
    .from('cases')
    .select('id, service_type, status, total_rab, created_at, clients(name), assignee:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(8);

  const tbody = document.getElementById('recent-cases-body');
  if (error || !data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Belum ada case.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((c) => `
    <tr>
      <td class="cell-strong">${c.clients?.name || '—'}</td>
      <td>${c.service_type}</td>
      <td>${c.assignee?.name || '<span style="color:var(--text-muted)">Belum di-assign</span>'}</td>
      <td class="cell-strong">${c.total_rab ? rupiah.format(c.total_rab) : '—'}</td>
      <td><span class="status ${STATUS_BADGE[c.status] || ''}">${c.status}</span></td>
      <td>${dateFmt.format(new Date(c.created_at))}</td>
    </tr>
  `).join('');
}

export async function initDashboard() {
  if (document.body.dataset.page !== 'dashboard') {return;}
  await Promise.all([
    loadStatCards(),
    loadStatusBreakdown(),
    loadRecentActivity(),
    loadRecentCases()
  ]);
}
