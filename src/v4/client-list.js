// SMA-app — Client List page data wiring.
// Loads all clients from Supabase, aggregates active-case count + RAB per
// client from `cases` (status Baru/Proses), then renders + client-side
// filters the table. Only runs on client.html (body[data-page="client"]).
// PRD §6.1. Query pattern follows src/v4/dashboard.js.

import { supabase } from '../lib/supabaseClient.js';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const ACTIVE_STATUSES = ['Baru', 'Proses'];

const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let clients = [];
let filterText = '';
let filterType = '';
let filterCaseStatus = '';

function visible() {
  const q = filterText.trim().toLowerCase();
  return clients.filter((c) =>
    (!q || c.name.toLowerCase().includes(q) || (c.contact_name || '').toLowerCase().includes(q)) &&
    (!filterType || c.type === filterType) &&
    (!filterCaseStatus || (filterCaseStatus === 'active' ? c.activeCaseCount > 0 : c.activeCaseCount === 0))
  );
}

function render() {
  const tbody = document.getElementById('client-rows');
  if (!tbody) {return;}

  if (clients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Belum ada client.</td></tr>';
    return;
  }

  const items = visible();
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Tidak ada client yang cocok dengan pencarian/filter.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((c) => `
    <tr data-id="${c.id}" style="cursor:pointer">
      <td class="cell-strong">${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.type) || '—'}</td>
      <td>${escapeHtml(c.contact_name) || '—'}</td>
      <td>${escapeHtml(c.contact_phone) || '—'}</td>
      <td>${c.activeCaseCount}</td>
      <td class="cell-strong">${c.activeCaseCount > 0 ? rupiah.format(c.activeRabTotal) : '—'}</td>
      <td>${dateFmt.format(new Date(c.created_at))}</td>
    </tr>
  `).join('');
}

async function loadClients() {
  const tbody = document.getElementById('client-rows');

  const [clientsRes, casesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, type, contact_name, contact_phone, contact_email, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('cases')
      .select('client_id, status, total_rab')
      .in('status', ACTIVE_STATUSES)
  ]);

  if (clientsRes.error || !clientsRes.data) {
    if (tbody) {tbody.innerHTML = '<tr><td colspan="7">Gagal memuat data client.</td></tr>';}
    return;
  }

  const activeByClient = new Map();
  (casesRes.data || []).forEach((c) => {
    const agg = activeByClient.get(c.client_id) || { count: 0, rab: 0 };
    agg.count += 1;
    agg.rab += Number(c.total_rab || 0);
    activeByClient.set(c.client_id, agg);
  });

  clients = clientsRes.data.map((c) => {
    const agg = activeByClient.get(c.id) || { count: 0, rab: 0 };
    return { ...c, activeCaseCount: agg.count, activeRabTotal: agg.rab };
  });

  render();
}

function wireFilters() {
  const searchInput = document.getElementById('client-search');
  const typeSelect = document.getElementById('filter-type');
  const statusSelect = document.getElementById('filter-case-status');

  searchInput?.addEventListener('input', (e) => { filterText = e.target.value; render(); });
  typeSelect?.addEventListener('change', (e) => { filterType = e.target.value; render(); });
  statusSelect?.addEventListener('change', (e) => { filterCaseStatus = e.target.value; render(); });

  document.getElementById('client-rows')?.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) {return;}
    window.location.href = `client-detail.html?id=${encodeURIComponent(row.dataset.id)}`;
  });
}

export async function initClientList() {
  if (document.body.dataset.page !== 'client') {return;}
  wireFilters();
  await loadClients();
}
