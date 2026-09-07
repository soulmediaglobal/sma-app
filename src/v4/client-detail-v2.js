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
import { loadQuotationsForCases, buildQuotationSection, getQuotationsByCaseId, getWorkStagesForCase } from './client-quotations.js';

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

const WORK_STAGE_STATUS_LABEL = {
  PENDING: 'Menunggu',
  IN_PROGRESS: 'Berjalan',
  DONE: 'Selesai',
  BLOCKED: 'Terhambat'
};

async function updateWorkStageStatus(stage, newStatus, ctx) {
  if (!ctx.profile?.id) {
    showToast('Profil pengguna tidak tersedia.', { variant: 'error' });
    return false;
  }
  const { error } = await supabase
    .from('case_work_stages')
    .update({ status: newStatus })
    .eq('id', stage.id);
  if (error) {
    showToast('Gagal update status.', { variant: 'error' });
    return false;
  }
  await supabase.from('activities').insert({
    client_id: clientId,
    case_id: ctx.caseId,
    type: 'Status Tahapan',
    notes: `Tahap "${stage.name}" ditandai ${newStatus === 'DONE' ? 'selesai' : 'terhambat'}.`,
    by_user: ctx.profile.id
  });
  return true;
}

function calcProgress(stages) {
  const mainStages = stages.filter((s) => !s.parent_stage_id);
  if (mainStages.length === 0) {return null;}
  const done = mainStages.filter((s) => s.status === 'DONE').length;
  return Math.round((done / mainStages.length) * 100);
}

function workStageStatusBadge(status) {
  const key = (status || 'PENDING').toLowerCase();
  return element('span', `cdv2-status-pill cdv2-status-${key}`, WORK_STAGE_STATUS_LABEL[status] || status || '—');
}

function buildWorkStageActions(stage, project) {
  if (stage.status === 'DONE') {return null;}

  const actions = element('div', 'cdv2-workflow-actions');
  const doneBtn = element('button', 'btn btn-sm btn-success', 'Selesai');
  doneBtn.type = 'button';
  const blockedBtn = element('button', 'btn btn-sm btn-warning', 'Terhambat');
  blockedBtn.type = 'button';

  const handleClick = (newStatus) => async () => {
    doneBtn.disabled = true;
    blockedBtn.disabled = true;
    const ok = await updateWorkStageStatus(stage, newStatus, { caseId: project.id, profile: currentProfile });
    if (ok) {
      showToast('Status tahap diperbarui.', { variant: 'success' });
      await loadAndRenderProjects();
      return;
    }
    doneBtn.disabled = false;
    blockedBtn.disabled = false;
  };

  doneBtn.addEventListener('click', handleClick('DONE'));
  blockedBtn.addEventListener('click', handleClick('BLOCKED'));
  actions.append(doneBtn, blockedBtn);
  return actions;
}

function buildWorkflowSection(project, stages) {
  const wrap = element('div', 'cdv2-proj-workflow');
  wrap.appendChild(element('span', 'cdv2-workflow-label', 'Tahapan Pekerjaan'));

  if (!stages || stages.length === 0) {
    wrap.appendChild(element('div', 'cdv2-workflow-empty', 'Belum ada tahapan pekerjaan.'));
    return wrap;
  }

  const mainStages = stages.filter((s) => !s.parent_stage_id);
  const subStagesByParent = new Map();
  stages.forEach((s) => {
    if (!s.parent_stage_id) {return;}
    const siblings = subStagesByParent.get(s.parent_stage_id) || [];
    siblings.push(s);
    subStagesByParent.set(s.parent_stage_id, siblings);
  });

  const list = element('div', 'cdv2-workflow-list');

  mainStages.forEach((stage) => {
    const subStages = subStagesByParent.get(stage.id) || [];
    const stageEl = element('div', 'cdv2-workflow-stage');
    const head = element('div', 'cdv2-workflow-stage-head');
    head.append(
      element('span', 'cdv2-workflow-stage-name', stage.name),
      workStageStatusBadge(stage.status)
    );
    stageEl.appendChild(head);

    if (subStages.length === 0) {
      const actions = buildWorkStageActions(stage, project);
      if (actions) {stageEl.appendChild(actions);}
    } else {
      const subList = element('div', 'cdv2-workflow-substages');
      subStages.forEach((sub) => {
        const subEl = element('div', 'cdv2-workflow-substage');
        const subHead = element('div', 'cdv2-workflow-substage-head');
        subHead.append(
          element('span', 'cdv2-workflow-substage-name', sub.name),
          workStageStatusBadge(sub.status)
        );
        subEl.appendChild(subHead);
        const subActions = buildWorkStageActions(sub, project);
        if (subActions) {subEl.appendChild(subActions);}
        subList.appendChild(subEl);
      });
      stageEl.appendChild(subList);
    }

    list.appendChild(stageEl);
  });

  wrap.appendChild(list);
  return wrap;
}

async function renderProjectRow(project) {
  const row = element('div', 'cdv2-proj-row');
  const main = element('div', 'cdv2-proj-main');
  main.append(
    element('div', 'cdv2-proj-name', project.service_type || 'Project tanpa jenis'),
    element('div', 'cdv2-proj-sub', project.case_number || '—')
  );
  const statusKey = (project.status || '').toLowerCase();
  const statusBadge = element('span', `cdv2-status-pill cdv2-status-${statusKey}`, project.status || '—');

  const stages = (await getWorkStagesForCase(project.id)) || [];
  const progress = calcProgress(stages);
  if (progress !== null) {
    const progressEl = element('div', 'cdv2-proj-progress');
    const bar = element('div', 'cdv2-proj-progress-bar');
    const fill = element('div', 'cdv2-proj-progress-fill');
    fill.style.width = `${progress}%`;
    bar.appendChild(fill);
    progressEl.append(bar, element('span', 'cdv2-proj-progress-label', `Progress: ${progress}%`));
    main.appendChild(progressEl);
  }

  row.append(main, statusBadge);

  const quotation = buildQuotationSection(project, {
    profile: currentProfile,
    clientId,
    client,
    onRefresh: () => loadAndRenderProjects()
  });
  quotation.classList.add('cdv2-proj-quotation');
  row.appendChild(quotation);

  const workflow = buildWorkflowSection(project, stages);
  row.appendChild(workflow);

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
  for (const project of projects) {
    table.appendChild(await renderProjectRow(project));
  }
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
