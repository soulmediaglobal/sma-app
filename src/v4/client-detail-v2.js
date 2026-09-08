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
import { showModal } from './modal.js';
import { openAddCaseModal } from './case-form.js';
import { loadQuotationsForCases, buildQuotationSection, getQuotationsByCaseId, getWorkStagesForCase, getAcceptedTerminForCase } from './client-quotations.js';
import { getInvoicedTerminIds, openInvoicePreview } from './client-payments.js';

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

const DELIVERABLE_BUCKET = 'case-deliverables';
const MAX_DELIVERABLE_FILE_SIZE = 10 * 1024 * 1024;
const DELIVERABLE_TYPE_LABEL = { PRODUK: 'Produk', SUMMARY: 'Summary Tahapan' };

async function updateWorkStageStatus(stage, newStatus, ctx) {
  if (!ctx.profile?.id) {
    showToast('Profil pengguna tidak tersedia.', { variant: 'error' });
    return false;
  }
  if (newStatus === 'DONE') {
    const { count } = await supabase
      .from('case_deliverables')
      .select('id', { count: 'exact', head: true })
      .eq('stage_id', stage.id);
    if (!count) {
      showToast('Upload minimal 1 Produk atau Summary Tahapan sebelum menandai tahap ini selesai.', { variant: 'error' });
      return false;
    }
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

async function createInvoiceFromTermin(termin, project) {
  const { error } = await supabase.from('payments').insert({
    case_id: project.id,
    type: termin.term_name,
    amount: termin.amount,
    quotation_item_id: termin.id,
    invoice_issued_at: new Date().toISOString()
  });
  if (error) {
    showToast('Gagal membuat invoice.', { variant: 'error' });
    return false;
  }
  await supabase.from('activities').insert({
    client_id: clientId,
    case_id: project.id,
    type: 'Invoice Dibuat',
    notes: `Invoice untuk Termin "${termin.term_name}" sebesar ${rupiah(termin.amount)} berhasil dibuat.`,
    by_user: currentProfile?.id
  });
  return true;
}

function buildInvoiceAlert(termin, project) {
  const alert = element('div', 'cdv2-workflow-invoice-alert');
  const info = element('div', 'cdv2-workflow-invoice-alert-info');
  info.append(
    element('span', 'cdv2-workflow-invoice-alert-name', termin.term_name),
    element('span', 'cdv2-workflow-invoice-alert-amount', rupiah(termin.amount))
  );
  alert.appendChild(info);

  const createBtn = element('button', 'btn btn-sm btn-primary', 'Buat Invoice');
  createBtn.type = 'button';
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    const ok = await createInvoiceFromTermin(termin, project);
    if (ok) {
      showToast('Invoice berhasil dibuat.', { variant: 'success' });
      await loadAndRenderProjects();
      return;
    }
    createBtn.disabled = false;
  });
  alert.appendChild(createBtn);
  return alert;
}

function buildInvoicedBadge(termin, project, payment) {
  const wrap = element('div', 'cdv2-workflow-invoiced-row');

  const badge = element('div', 'cdv2-workflow-invoiced-badge');
  badge.append(
    element('span', 'cdv2-workflow-invoiced-badge-icon', '✓'),
    element('span', 'cdv2-workflow-invoiced-badge-text', `${termin.term_name} — Sudah di-invoice`)
  );
  wrap.appendChild(badge);

  if (payment) {
    const viewBtn = element('button', 'btn btn-outline btn-sm', 'Lihat Invoice');
    viewBtn.type = 'button';
    viewBtn.addEventListener('click', () => openInvoicePreview(payment, project, client));
    wrap.appendChild(viewBtn);
  }

  return wrap;
}

function buildInvoiceAlerts(stage, project, termin, invoicedTerminIds) {
  if (stage.status !== 'DONE') {return null;}
  const matchingTermin = termin.filter((t) => t.stage_id === stage.id);
  if (matchingTermin.length === 0) {return null;}

  const wrap = element('div', 'cdv2-workflow-invoice-alerts');
  matchingTermin.forEach((t) => {
    if (invoicedTerminIds.has(t.id)) {
      wrap.appendChild(buildInvoicedBadge(t, project, invoicedTerminIds.get(t.id)));
    } else {
      wrap.appendChild(buildInvoiceAlert(t, project));
    }
  });
  return wrap;
}

async function fetchDeliverablesForCase(caseId) {
  const { data, error } = await supabase
    .from('case_deliverables')
    .select('id, stage_id, type, name, storage_path, created_at')
    .eq('case_id', caseId);
  if (error) {return new Map();}
  const deliverablesByStage = new Map();
  (data || []).forEach((row) => {
    const list = deliverablesByStage.get(row.stage_id) || [];
    list.push(row);
    deliverablesByStage.set(row.stage_id, list);
  });
  return deliverablesByStage;
}

async function viewDeliverable(deliverable, trigger) {
  if (trigger.disabled) {return;}
  trigger.disabled = true;
  try {
    const { data, error } = await supabase.storage
      .from(DELIVERABLE_BUCKET)
      .createSignedUrl(deliverable.storage_path, 60);
    if (error || !data?.signedUrl) {
      showToast('Dokumen belum dapat dibuka. Silakan coba lagi.', { variant: 'error' });
      return;
    }
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  } finally {
    trigger.disabled = false;
  }
}

function buildDeliverableRow(deliverable) {
  const row = element('div', 'cdv2-deliverable-row');
  const info = element('div', 'cdv2-deliverable-info');
  info.append(
    element('span', 'cdv2-deliverable-type', DELIVERABLE_TYPE_LABEL[deliverable.type] || deliverable.type),
    element('span', 'cdv2-deliverable-name', deliverable.name)
  );
  row.appendChild(info);

  const viewBtn = element('button', 'btn btn-outline btn-sm', 'Lihat');
  viewBtn.type = 'button';
  viewBtn.addEventListener('click', () => viewDeliverable(deliverable, viewBtn));
  row.appendChild(viewBtn);

  return row;
}

function buildDeliverableForm(state) {
  const form = document.createElement('form');
  form.id = 'deliverable-form';
  form.noValidate = true;

  const segmented = element('div', 'segmented client-document-mode-toggle');
  const produkLabel = document.createElement('label');
  const produkRadio = element('input', '');
  produkRadio.type = 'radio';
  produkRadio.name = 'deliverable_type';
  produkRadio.value = 'PRODUK';
  produkRadio.checked = true;
  produkLabel.append(produkRadio, element('span', '', DELIVERABLE_TYPE_LABEL.PRODUK));

  const summaryLabel = document.createElement('label');
  const summaryRadio = element('input', '');
  summaryRadio.type = 'radio';
  summaryRadio.name = 'deliverable_type';
  summaryRadio.value = 'SUMMARY';
  summaryLabel.append(summaryRadio, element('span', '', DELIVERABLE_TYPE_LABEL.SUMMARY));

  segmented.append(produkLabel, summaryLabel);
  produkRadio.addEventListener('change', () => {state.type = 'PRODUK';});
  summaryRadio.addEventListener('change', () => {state.type = 'SUMMARY';});

  const nameGroup = element('div', 'form-group');
  const nameLabel = element('label', 'form-label', 'Nama Dokumen');
  nameLabel.htmlFor = 'deliverable-name';
  nameLabel.appendChild(element('span', 'required', ' *'));
  const nameInput = element('input', 'form-control');
  nameInput.id = 'deliverable-name';
  nameInput.name = 'name';
  nameInput.type = 'text';
  nameInput.required = true;
  nameGroup.append(nameLabel, nameInput);

  const fileGroup = element('div', 'form-group');
  const fileLabel = element('label', 'form-label', 'File PDF');
  fileLabel.htmlFor = 'deliverable-file';
  fileLabel.appendChild(element('span', 'required', ' *'));
  const fileInput = element('input', 'form-control');
  fileInput.id = 'deliverable-file';
  fileInput.name = 'file';
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf';
  fileInput.required = true;
  const help = element('div', 'form-help', 'Format PDF. Maksimal 10 MB.');
  fileGroup.append(fileLabel, fileInput, help);

  form.append(segmented, nameGroup, fileGroup);
  return form;
}

async function submitDeliverable(ctx, form, stage, project) {
  if (!form.reportValidity()) {return false;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return false;}

  const type = form.elements.namedItem('deliverable_type').value;
  const name = form.elements.namedItem('name').value.trim();
  const file = form.elements.namedItem('file').files?.[0];

  if (!file) {
    showToast('Pilih file PDF terlebih dahulu.', { variant: 'error' });
    return false;
  }
  if (file.type !== 'application/pdf') {
    showToast('Gunakan file PDF.', { variant: 'error' });
    return false;
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_DELIVERABLE_FILE_SIZE) {
    showToast('Ukuran file maksimal 10 MB.', { variant: 'error' });
    return false;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';

  const storagePath = `${project.id}/${stage.id}/${crypto.randomUUID()}.pdf`;

  try {
    const { error: uploadError } = await supabase.storage
      .from(DELIVERABLE_BUCKET)
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      showToast('Gagal upload deliverable.', { variant: 'error' });
      return false;
    }

    const { error: insertError } = await supabase.from('case_deliverables').insert({
      case_id: project.id,
      stage_id: stage.id,
      type,
      name,
      storage_path: storagePath,
      mime_type: 'application/pdf',
      file_size_bytes: file.size,
      uploaded_by: currentProfile?.id
    });

    if (insertError) {
      await supabase.storage.from(DELIVERABLE_BUCKET).remove([storagePath]);
      showToast('Gagal menyimpan deliverable.', { variant: 'error' });
      return false;
    }

    ctx.close();
    showToast('Deliverable berhasil diupload.', { variant: 'success' });
    await loadAndRenderProjects();
    return true;
  } catch {
    showToast('Gagal upload deliverable.', { variant: 'error' });
    return false;
  } finally {
    if (submitButton.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = 'Upload Deliverable';
    }
  }
}

function openUploadDeliverableModal(stage, project) {
  if (!currentProfile?.id) {
    showToast('Profil pengguna tidak tersedia.', { variant: 'error' });
    return;
  }
  const state = { type: 'PRODUK' };
  const form = buildDeliverableForm(state);

  const ctx = showModal({
    title: 'Upload Deliverable',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Upload Deliverable',
        variant: 'primary',
        closeOnAction: false,
        action: () => submitDeliverable(ctx, form, stage, project)
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitDeliverable(ctx, form, stage, project);
  });
}

function buildDeliverableSection(stage, project, deliverablesByStage) {
  const wrap = element('div', 'cdv2-deliverable-section');
  wrap.appendChild(element('span', 'cdv2-deliverable-label', 'Deliverable'));

  const items = deliverablesByStage.get(stage.id) || [];
  if (items.length === 0) {
    wrap.appendChild(element('div', 'cdv2-deliverable-empty', 'Belum ada deliverable untuk tahap ini.'));
  } else {
    const list = element('div', 'cdv2-deliverable-list');
    items.forEach((item) => list.appendChild(buildDeliverableRow(item)));
    wrap.appendChild(list);
  }

  const uploadBtn = element('button', 'btn btn-outline btn-sm', 'Upload Deliverable');
  uploadBtn.type = 'button';
  uploadBtn.addEventListener('click', () => openUploadDeliverableModal(stage, project));
  wrap.appendChild(uploadBtn);

  return wrap;
}

function buildWorkflowSection(project, stages, termin, invoicedTerminIds, deliverablesByStage) {
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
      stageEl.appendChild(buildDeliverableSection(stage, project, deliverablesByStage));
      const alerts = buildInvoiceAlerts(stage, project, termin, invoicedTerminIds);
      if (alerts) {stageEl.appendChild(alerts);}
    } else {
      const alerts = buildInvoiceAlerts(stage, project, termin, invoicedTerminIds);
      if (alerts) {stageEl.appendChild(alerts);}
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
        subEl.appendChild(buildDeliverableSection(sub, project, deliverablesByStage));
        subList.appendChild(subEl);
      });
      stageEl.appendChild(subList);
    }

    list.appendChild(stageEl);
  });

  wrap.appendChild(list);
  return wrap;
}

function buildDeliverableSummarySection(stages, deliverablesByStage) {
  const wrap = element('div', 'cdv2-deliverable-summary');
  wrap.appendChild(element('span', 'cdv2-deliverable-summary-label', 'Ringkasan Deliverable'));

  const groups = stages.filter((stage) => (deliverablesByStage.get(stage.id) || []).length > 0);
  if (groups.length === 0) {
    wrap.appendChild(element('div', 'cdv2-deliverable-summary-empty', 'Belum ada deliverable untuk project ini.'));
    return wrap;
  }

  groups.forEach((stage) => {
    const group = element('div', 'cdv2-deliverable-summary-group');
    group.appendChild(element('div', 'cdv2-deliverable-summary-stage-name', stage.name));
    const items = deliverablesByStage.get(stage.id) || [];
    items.forEach((item) => group.appendChild(buildDeliverableRow(item)));
    wrap.appendChild(group);
  });

  return wrap;
}

async function renderProjectRow(project, invoicedTerminIds) {
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

  const termin = await getAcceptedTerminForCase(project.id);
  const deliverablesByStage = await fetchDeliverablesForCase(project.id);
  const workflow = buildWorkflowSection(project, stages, termin, invoicedTerminIds, deliverablesByStage);
  row.appendChild(workflow);

  const deliverableSummary = buildDeliverableSummarySection(stages, deliverablesByStage);
  row.appendChild(deliverableSummary);

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
  const invoicedTerminIds = await getInvoicedTerminIds(projects.map((p) => p.id));
  for (const project of projects) {
    table.appendChild(await renderProjectRow(project, invoicedTerminIds));
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
