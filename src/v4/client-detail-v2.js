// SMA-app — Client Detail v2 (eksperimen).
//
// Halaman terpisah dari client-detail.html, TIDAK menggantikan halaman
// lama. Tujuannya nyoba pendekatan visual baru (Ringkasan Eksekutif,
// tabel Project Performance) tanpa risiko ke halaman production yang
// sudah jalan.
//
// Strategi: bukan bangun ulang RAB/Pembayaran dari nol -- reuse fungsi
// yang sudah ada dan sudah teruji:
// - buildQuotationSection() + loadQuotationsForCases() dari
//   client-quotations.js -- tombol "Kelola RAB" beneran buka modal RAB
//   Builder asli.
// - openAddCaseModal() dari case-form.js -- tombol "+ Tambah Project"
//   beneran fungsional.
// - initClientPayments() dari client-payments.js -- section Pembayaran
//   di-embed penuh (container #client-payments-root), tanpa kode baru
//   sama sekali.
//
// Belum di-port ke v2 (lihat Issue #208 "Out of scope"): Repository
// Dokumen client-level (depends skema baru), progress % Workflow
// (depends skema baru), tab Dokumen/Workflow/Aktivitas, form Edit Info
// (sementara link ke client-detail.html).

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';
import { showToast } from './toast.js';
import { openAddCaseModal } from './case-form.js';
import { loadQuotationsForCases, buildQuotationSection, getQuotationsByCaseId } from './client-quotations.js';

const CLIENT_FIELDS = [
  'id', 'name', 'type', 'pic_name', 'pic_title', 'pic_phone', 'pic_email',
  'npwp', 'nib', 'business_field', 'address',
  'director_name', 'director_phone', 'director_id_number', 'created_at'
];

// Status quotation yang berarti "lagi di tangan seseorang, butuh
// ditindaklanjuti" -- dipakai buat hitung metrik Ringkasan Eksekutif.
// Konsisten dengan literal status yang sudah dipakai di client-quotations.js
// (PENDING_INTERNAL_APPROVAL/SENT/NEGOTIATING adalah status aktif di luar
// DRAFT/APPROVED_INTERNAL, yang belum/sudah lewat tahap "menunggu orang lain").
const FOLLOWUP_STATUSES = ['PENDING_INTERNAL_APPROVAL', 'SENT', 'NEGOTIATING'];
const INACTIVE_CASE_STATUSES = ['Selesai', 'Batal'];

let clientId = '';
let currentProfile = null;
let client = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined && text !== null) {node.textContent = text;}
  return node;
}

function rupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) {return '—';}
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

async function loadClient() {
  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_FIELDS.join(', '))
    .eq('id', clientId)
    .maybeSingle();
  if (error || !data) {return null;}
  return data;
}

function renderHeader() {
  document.getElementById('cdv2-name').textContent = client.name || 'Detail Client';
  const typeBadge = document.getElementById('cdv2-type');
  if (client.type) {
    typeBadge.textContent = client.type;
    typeBadge.hidden = false;
  }
  document.getElementById('cdv2-edit-link').href = `client-detail.html?id=${encodeURIComponent(clientId)}`;
}

function renderInfoBar() {
  document.getElementById('cdv2-info-pic').textContent = client.pic_name
    ? `${client.pic_name}${client.pic_phone ? ' — ' + client.pic_phone : ''}`
    : '—';
  document.getElementById('cdv2-info-bidang').textContent = client.business_field || '—';
  document.getElementById('cdv2-info-terdaftar').textContent = formatDate(client.created_at);

  const full = document.getElementById('cdv2-info-full');
  const toggleBtn = document.getElementById('cdv2-info-toggle');
  const rows = [
    ['NPWP', client.npwp],
    ['NIB', client.nib],
    ['Nama Direktur', client.director_name],
    ['No. HP Direktur', client.director_phone],
    ['No. KTP Direktur', client.director_id_number],
    ['Alamat', client.address],
    ['Email PIC', client.pic_email],
    ['Jabatan PIC', client.pic_title]
  ];
  full.replaceChildren();
  rows.forEach(([label, value]) => {
    const row = element('div', 'cdv2-info-row');
    row.append(
      element('span', 'cdv2-info-row-label', label),
      element('span', `cdv2-info-row-value${value ? '' : ' empty'}`, value || 'Belum diisi')
    );
    full.appendChild(row);
  });

  toggleBtn.addEventListener('click', () => {
    const showing = full.hidden;
    full.hidden = !showing;
    toggleBtn.textContent = showing ? '← Tampilkan ringkas' : 'Lihat detail lengkap →';
  });
}

function computeSummary(projects) {
  const totalRab = projects.reduce((sum, p) => sum + (Number(p.total_rab) || 0), 0);
  const activeCount = projects.filter((p) => !INACTIVE_CASE_STATUSES.includes(p.status)).length;

  const quotationsByCaseId = getQuotationsByCaseId();
  let followUpCount = 0;
  projects.forEach((p) => {
    const rows = quotationsByCaseId.get(p.id) || [];
    // loadQuotationsForCases() sudah order by version DESC per case_id,
    // jadi rows[0] adalah versi RAB terbaru untuk case ini.
    const latest = rows[0];
    if (latest && FOLLOWUP_STATUSES.includes(latest.status)) {followUpCount += 1;}
  });

  return { totalRab, activeCount, followUpCount };
}

function renderSummary(summary) {
  document.getElementById('cdv2-sum-piutang').textContent = rupiah(summary.totalRab);
  document.getElementById('cdv2-sum-aktif').textContent = String(summary.activeCount);
  document.getElementById('cdv2-sum-followup').textContent = summary.followUpCount > 0 ? `${summary.followUpCount} RAB` : '0';
}

function renderProjectRow(project) {
  const row = element('div', 'cdv2-proj-row');
  const main = element('div', 'cdv2-proj-main');
  main.append(
    element('div', 'cdv2-proj-name', project.service_type || 'Project tanpa jenis'),
    element('div', 'cdv2-proj-sub', project.case_number || '—')
  );
  const statusKey = (project.status || '').toLowerCase();
  const statusBadge = element('span', `cdv2-status-pill cdv2-status-${statusKey}`, project.status || '—');
  row.append(main, statusBadge);

  const quotation = buildQuotationSection(project, {
    profile: currentProfile,
    clientId,
    client,
    onRefresh: () => loadAndRenderProjects()
  });
  quotation.classList.add('cdv2-proj-quotation');
  row.appendChild(quotation);
  return row;
}

async function loadAndRenderProjects() {
  const table = document.getElementById('cdv2-project-table');
  table.replaceChildren();

  const { data, error } = await supabase
    .from('cases')
    .select('id, client_id, service_type, status, total_rab, negotiation_count, created_at, case_number')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    table.appendChild(element('div', 'empty-state', 'Gagal memuat project.'));
    return;
  }

  const projects = data || [];
  if (projects.length === 0) {
    table.appendChild(element('div', 'empty-state', 'Belum ada project untuk client ini.'));
    renderSummary({ totalRab: 0, activeCount: 0, followUpCount: 0 });
    return;
  }

  await loadQuotationsForCases(projects.map((p) => p.id));
  renderSummary(computeSummary(projects));
  projects.forEach((project) => table.appendChild(renderProjectRow(project)));
}

function wireAddProject() {
  document.getElementById('cdv2-add-project-btn')?.addEventListener('click', () => {
    if (!currentProfile?.id) {
      showToast('Gagal memuat profil pengguna. Muat ulang halaman.', { variant: 'error' });
      return;
    }
    openAddCaseModal(clientId, {
      profile: currentProfile,
      onCreated: () => loadAndRenderProjects()
    });
  });
}

export async function initClientDetailV2() {
  const root = document.getElementById('client-detail-v2-root');
  if (!root) {return;}

  clientId = new URLSearchParams(window.location.search).get('id')?.trim() || '';
  if (!clientId) {
    root.textContent = 'Client tidak ditemukan (parameter id kosong).';
    return;
  }

  try {
    currentProfile = await getProfile();
  } catch {
    currentProfile = null;
  }

  client = await loadClient();
  if (!client) {
    root.textContent = 'Client tidak ditemukan.';
    return;
  }

  renderHeader();
  renderInfoBar();
  wireAddProject();
  await loadAndRenderProjects();

  try {
    const { initClientPayments } = await import('./client-payments.js');
    await initClientPayments({ clientId, profile: currentProfile });
  } catch {
    const paymentsRoot = document.getElementById('client-payments-root');
    if (paymentsRoot) {paymentsRoot.textContent = 'Gagal memuat modul pembayaran.';}
  }

  root.setAttribute('aria-busy', 'false');
}
