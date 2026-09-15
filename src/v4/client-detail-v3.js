// SMA-app — Client Detail v3 (Issue #240, tab Project/RAB Issue #242,
// tab Workflow Issue #244, tab Dokumen/Pembayaran/Aktivitas Issue #246).
//
// Restrukturisasi dari client-detail-v2.js: section Info jadi card-based
// dengan edit inline per kartu, sisanya jadi shell 5-tab. Tab Project
// reuse langsung loadQuotationsForCases()/buildQuotationSection() dari
// client-quotations.js dan openAddCaseModal() dari case-form.js -- sama
// persis seperti di V2.
//
// Tab Workflow (Issue #244) reuse murni fungsi Tahapan/Deliverable/
// Invoice-alert/BAST dari client-detail-v2.js -- battle-tested, logic
// dan query TIDAK ditulis ulang, hanya class/id DOM yang disesuaikan
// prefix cdv3-. Query project-nya sengaja terpisah dari tab Project
// (loadAndRenderWorkflow() vs loadAndRenderProjects()) -- coupling
// cross-tab untuk share state dinilai nggak sepadan manfaatnya.
// buildDeliverableSummarySection() dari V2 sengaja TIDAK di-port --
// section duplikat, deliverable sudah muncul inline per-stage.
//
// Tab Dokumen/Pembayaran/Aktivitas (Issue #246) reuse murni modul yang
// sudah dipakai V1/V2 -- initClientDocuments/initClientPayments/
// initClientActivities di-lazy-import dan mount langsung ke root
// masing-masing (client-documents-root/client-payments-root/
// client-activities-root), sama seperti mountClientPortalAccess().
//
// V1 (client-detail.js) dan V2 (client-detail-v2.js) tidak disentuh.

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';
import { showToast } from './toast.js';
import { showModal } from './modal.js';
import { openAddCaseModal } from './case-form.js';
import {
  loadQuotationsForCases,
  buildQuotationSection,
  getQuotationsByCaseId,
  getWorkStagesForCase,
  getAcceptedTerminForCase,
  docEl,
  PREVIEW_CSS
} from './client-quotations.js';
import { getInvoicedTerminIds, openInvoicePreview } from './client-payments.js';

const CLIENT_FIELDS = [
  'id', 'name', 'type', 'pic_name', 'pic_title', 'pic_phone', 'pic_email',
  'npwp', 'nib', 'business_field', 'address',
  'director_name', 'director_phone', 'director_id_number',
  'referral_source', 'general_notes', 'created_at'
];

const EDITABLE_FIELDS = CLIENT_FIELDS.filter((field) => !['id', 'created_at'].includes(field));

const FIELD_META = {
  name: { label: 'Nama', type: 'text' },
  type: { label: 'Tipe', type: 'select', options: ['PT', 'CV', 'Yayasan', 'Perorangan'] },
  business_field: { label: 'Bidang Usaha', type: 'text' },
  npwp: { label: 'NPWP', type: 'text' },
  nib: { label: 'NIB', type: 'text' },
  director_name: { label: 'Nama Direktur', type: 'text' },
  director_phone: { label: 'No. HP Direktur', type: 'tel' },
  director_id_number: { label: 'No. KTP Direktur', type: 'text' },
  referral_source: { label: 'Sumber referral', type: 'text' },
  general_notes: { label: 'Catatan umum', type: 'textarea' },
  address: { label: 'Alamat', type: 'textarea' },
  pic_name: { label: 'Nama PIC', type: 'text' },
  pic_title: { label: 'Jabatan PIC', type: 'text' },
  pic_phone: { label: 'No. HP/WA PIC', type: 'tel' },
  pic_email: { label: 'Email PIC', type: 'email' }
};

const CARDS = [
  { key: 'identity', title: 'Identitas', fields: ['name', 'type', 'business_field'] },
  { key: 'business', title: 'Badan Usaha', fields: ['npwp', 'nib'] },
  { key: 'director', title: 'Direktur', fields: ['director_name', 'director_phone', 'director_id_number'] },
  { key: 'other', title: 'Lainnya', fields: ['referral_source', 'general_notes'] },
  { key: 'address', title: 'Alamat', fields: ['address'] },
  { key: 'pic', title: 'Kontak PIC', fields: ['pic_name', 'pic_title', 'pic_phone', 'pic_email'], gridLayout: true }
];

// Status case (Baru/Proses/Selesai/Batal) -- diporting dari V1
// (client-detail.js, dihapus di Issue #254; lihat Issue #256). Warna per
// status sudah ada lewat class cdv3-status-<key> (Issue #242), jadi tidak
// perlu STATUS_BADGE map terpisah seperti V1 -- cukup daftar valid value.
const STATUS_OPTIONS = ['Baru', 'Proses', 'Selesai', 'Batal'];
// Dipakai bareng tab Project & tab Workflow karena keduanya merujuk
// cases.id yang sama -- race-condition guard harus konsisten lintas tab.
const updatingCaseIds = new Set();

let clientId = '';
let currentProfile = null;
let client = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined && text !== null) {node.textContent = text;}
  return node;
}

function formatDate(value) {
  if (!value) {return '—';}
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function rupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
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
  document.getElementById('cdv3-name').textContent = client.name || 'Detail Client';
  const typeBadge = document.getElementById('cdv3-type');
  if (client.type) {
    typeBadge.textContent = client.type;
    typeBadge.hidden = false;
  }
}

function updateInfoBarTexts() {
  document.getElementById('cdv3-info-pic').textContent = client.pic_name
    ? `${client.pic_name}${client.pic_phone ? ' — ' + client.pic_phone : ''}`
    : '—';
  document.getElementById('cdv3-info-bidang').textContent = client.business_field || '—';
  document.getElementById('cdv3-info-terdaftar').textContent = formatDate(client.created_at);
}

function wireInfoToggle() {
  const full = document.getElementById('cdv3-info-full');
  const toggleBtn = document.getElementById('cdv3-info-toggle');
  toggleBtn.addEventListener('click', () => {
    const showing = full.hidden;
    full.hidden = !showing;
    toggleBtn.textContent = showing ? '← Tampilkan ringkas' : 'Lihat detail lengkap →';
  });
}

function buildFieldReadRow(field) {
  const meta = FIELD_META[field];
  const value = client[field];
  const row = document.createElement('div');
  row.append(
    element('dt', '', meta.label),
    element('dd', value ? '' : 'empty', value || 'Belum diisi')
  );
  return row;
}

function buildFieldInput(field) {
  const meta = FIELD_META[field];
  const group = element('div', 'form-group');
  const inputId = `cdv3-input-${field}`;
  const label = element('label', 'form-label', meta.label);
  label.htmlFor = inputId;

  let control;
  if (meta.type === 'select') {
    control = document.createElement('select');
    const placeholder = element('option', '', 'Pilih tipe');
    placeholder.value = '';
    control.appendChild(placeholder);
    meta.options.forEach((option) => {
      const optionEl = element('option', '', option);
      optionEl.value = option;
      control.appendChild(optionEl);
    });
  } else if (meta.type === 'textarea') {
    control = document.createElement('textarea');
  } else {
    control = document.createElement('input');
    control.type = meta.type;
  }
  control.className = 'form-control';
  control.id = inputId;
  control.name = field;
  group.append(label, control);
  return group;
}

function renderCardReadView(cardDef) {
  const dl = element('dl', cardDef.gridLayout ? 'cdv3-card-read cdv3-card-grid' : 'cdv3-card-read');
  cardDef.fields.forEach((field) => dl.appendChild(buildFieldReadRow(field)));
  return dl;
}

function buildCardForm(cardDef) {
  const form = document.createElement('form');
  form.className = cardDef.gridLayout ? 'cdv3-card-form cdv3-card-grid' : 'cdv3-card-form';
  form.noValidate = true;
  cardDef.fields.forEach((field) => form.appendChild(buildFieldInput(field)));

  const actions = element('div', 'form-actions right cdv3-card-form-actions');
  const cancelBtn = element('button', 'btn btn-outline btn-sm', 'Batal');
  cancelBtn.type = 'button';
  const saveBtn = element('button', 'btn btn-primary btn-sm', 'Simpan');
  saveBtn.type = 'submit';
  actions.append(cancelBtn, saveBtn);
  form.appendChild(actions);

  return { form, cancelBtn, saveBtn };
}

function populateCardForm(form, cardDef) {
  cardDef.fields.forEach((field) => {
    const control = form.elements.namedItem(field);
    if (control) {control.value = client[field] ?? '';}
  });
}

function cardFormPayload(form, cardDef) {
  return Object.fromEntries(
    cardDef.fields
      .filter((field) => EDITABLE_FIELDS.includes(field))
      .map((field) => [field, form.elements.namedItem(field).value.trim() || null])
  );
}

function mountCard(cardDef) {
  const container = document.querySelector(`[data-cdv3-card="${cardDef.key}"]`);
  if (!container) {return;}
  container.replaceChildren();

  const head = element('div', 'cdv3-card-head');
  head.appendChild(element('h3', 'cdv3-card-title', cardDef.title));
  const editBtn = element('button', 'btn btn-outline btn-sm', 'Edit');
  editBtn.type = 'button';
  head.appendChild(editBtn);
  container.appendChild(head);

  let readView = renderCardReadView(cardDef);
  container.appendChild(readView);

  const { form, cancelBtn, saveBtn } = buildCardForm(cardDef);
  form.hidden = true;
  container.appendChild(form);

  function setMode(editing) {
    if (editing) {populateCardForm(form, cardDef);}
    readView.hidden = editing;
    form.hidden = !editing;
    editBtn.hidden = editing;
  }

  editBtn.addEventListener('click', () => setMode(true));
  cancelBtn.addEventListener('click', () => setMode(false));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!form.reportValidity()) {return;}

    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(cardFormPayload(form, cardDef))
        .eq('id', clientId)
        .select(CLIENT_FIELDS.join(', '))
        .single();

      if (error || !data) {
        showToast('Gagal menyimpan perubahan.', { variant: 'error' });
        return;
      }

      client = data;
      const freshRead = renderCardReadView(cardDef);
      readView.replaceWith(freshRead);
      readView = freshRead;
      setMode(false);
      if (cardDef.key === 'identity') {
        renderHeader();
        updateInfoBarTexts();
      } else if (cardDef.key === 'pic') {
        updateInfoBarTexts();
      }
      showToast('Info client berhasil diperbarui.', { variant: 'success' });
    } catch {
      showToast('Gagal menyimpan perubahan.', { variant: 'error' });
    } finally {
      if (saveBtn.isConnected) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan';
      }
    }
  });
}

function renderCards() {
  CARDS.forEach((cardDef) => mountCard(cardDef));
}

function activateTab(root, tab) {
  const name = tab.dataset.clientTab;
  root.querySelectorAll('[data-client-tab]').forEach((candidate) => {
    const active = candidate === tab;
    candidate.classList.toggle('active', active);
    candidate.setAttribute('aria-selected', String(active));
    candidate.tabIndex = active ? 0 : -1;
  });
  root.querySelectorAll('[data-client-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.clientPanel !== name;
  });
}

function wireTabs(root) {
  const tabs = Array.from(root.querySelectorAll('[data-client-tab]'));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(root, tab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex;
      if (event.key === 'ArrowRight') {nextIndex = (index + 1) % tabs.length;}
      if (event.key === 'ArrowLeft') {nextIndex = (index - 1 + tabs.length) % tabs.length;}
      if (event.key === 'Home') {nextIndex = 0;}
      if (event.key === 'End') {nextIndex = tabs.length - 1;}
      if (nextIndex === undefined) {return;}
      event.preventDefault();
      activateTab(root, tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
}

// Ubah status case -- port dari V1 (client-detail.js), manual sepenuhnya,
// tidak ada auto-trigger (keputusan Ray, Issue #256).

function canUpdateCaseStatus() {
  return Boolean(currentProfile?.id && ['admin', 'internal'].includes(currentProfile.role));
}

async function rollbackCaseStatus(caseId, changedStatus, oldStatus) {
  try {
    return await supabase
      .from('cases')
      .update({ status: oldStatus }, { count: 'exact' })
      .eq('id', caseId)
      .eq('client_id', clientId)
      .eq('status', changedStatus);
  } catch (error) {
    return { error, count: null };
  }
}

async function updateCaseStatus(caseId, oldStatus, newStatus) {
  if (!canUpdateCaseStatus()) {return;}

  const controls = Array.from(
    document.querySelectorAll(`[data-case-status-control][data-case-id="${caseId}"]`)
  );

  if (
    !STATUS_OPTIONS.includes(oldStatus) ||
    !STATUS_OPTIONS.includes(newStatus) ||
    updatingCaseIds.has(caseId)
  ) {
    showToast('Status project tidak dapat diubah.', { variant: 'error' });
    await loadAndRenderProjects();
    await loadAndRenderWorkflow();
    return;
  }
  if (newStatus === oldStatus) {return;}

  const serviceType = controls[0]?.dataset.serviceType || '';
  controls.forEach((control) => {
    control.value = oldStatus;
    control.disabled = true;
  });
  updatingCaseIds.add(caseId);

  try {
    const { error: updateError, count: updatedCount } = await supabase
      .from('cases')
      .update({ status: newStatus }, { count: 'exact' })
      .eq('id', caseId)
      .eq('client_id', clientId)
      .eq('status', oldStatus);

    if (updateError || updatedCount !== 1) {
      showToast('Gagal mengubah status project.', { variant: 'error' });
      return;
    }

    const { error: activityError } = await supabase.from('activities').insert({
      client_id: clientId,
      case_id: caseId,
      type: 'Status Case',
      notes: `Status project ${serviceType} diubah dari ${oldStatus} menjadi ${newStatus}.`,
      by_user: currentProfile?.id
    });

    if (activityError) {
      const { error: rollbackError, count: rollbackCount } = await rollbackCaseStatus(
        caseId,
        newStatus,
        oldStatus
      );
      if (rollbackError || rollbackCount !== 1) {
        showToast('Status berubah, tetapi aktivitas gagal dicatat. Hubungi admin.', {
          variant: 'error',
          duration: 5000
        });
      } else {
        showToast('Perubahan dibatalkan karena aktivitas gagal dicatat.', { variant: 'error' });
      }
      return;
    }

    showToast('Status project berhasil diubah.', { variant: 'success' });
  } catch {
    showToast('Gagal mengubah status project.', { variant: 'error' });
  } finally {
    updatingCaseIds.delete(caseId);
    await loadAndRenderProjects();
    await loadAndRenderWorkflow();
  }
}

function buildStatusSelect(project) {
  const select = document.createElement('select');
  select.className = 'form-control cdv3-status-select';
  select.dataset.caseStatusControl = '';
  select.dataset.caseId = project.id;
  select.dataset.oldStatus = project.status || '';
  select.dataset.serviceType = project.service_type || '';
  select.setAttribute(
    'aria-label',
    `Ubah status project ${project.service_type || 'tanpa jenis'}`
  );
  STATUS_OPTIONS.forEach((status) => {
    const option = element('option', '', status);
    option.value = status;
    option.selected = status === project.status;
    select.appendChild(option);
  });
  return select;
}

function wireCaseStatusControls(root) {
  root.addEventListener('change', (event) => {
    const control = event.target.closest('[data-case-status-control]');
    if (!control) {return;}
    updateCaseStatus(control.dataset.caseId, control.dataset.oldStatus, control.value);
  });
}

function renderProjectRow(project) {
  const row = element('div', 'cdv3-proj-row');
  const main = element('div', 'cdv3-proj-main');
  const hasTitle = Boolean(project.notes && project.notes.trim());
  const nameEl = element('div', 'cdv3-proj-name', hasTitle ? project.notes : 'Judul belum diisi');
  if (!hasTitle) {nameEl.classList.add('cdv3-title-empty');}
  const titleGroup = element('div', 'cdv3-title-group');
  titleGroup.append(nameEl, element('span', 'cdv3-service-chip', project.service_type || '—'));
  main.append(
    titleGroup,
    element('div', 'cdv3-proj-sub', project.case_number || '—')
  );
  const statusEl = canUpdateCaseStatus()
    ? buildStatusSelect(project)
    : element(
      'span',
      `cdv3-status-pill cdv3-status-${(project.status || '').toLowerCase()}`,
      project.status || '—'
    );
  row.append(main, statusEl);

  const quotation = buildQuotationSection(project, {
    profile: currentProfile,
    clientId,
    client,
    onRefresh: () => loadAndRenderProjects()
  });
  quotation.classList.add('cdv3-proj-quotation');
  row.appendChild(quotation);

  return row;
}

async function loadAndRenderProjects() {
  const table = document.getElementById('cdv3-project-table');
  table.replaceChildren();

  const { data, error } = await supabase
    .from('cases')
    .select('id, client_id, service_type, notes, status, total_rab, negotiation_count, created_at, case_number')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    table.appendChild(element('div', 'empty-state', 'Gagal memuat project.'));
    return;
  }

  const projects = data || [];
  if (projects.length === 0) {
    table.appendChild(element('div', 'empty-state', 'Belum ada project untuk client ini.'));
    return;
  }

  await loadQuotationsForCases(projects.map((p) => p.id));
  projects.forEach((project) => table.appendChild(renderProjectRow(project)));
}

function wireAddProject() {
  document.getElementById('cdv3-add-project-btn')?.addEventListener('click', () => {
    if (!currentProfile?.id) {
      showToast('Gagal memuat profil pengguna. Muat ulang halaman.', { variant: 'error' });
      return;
    }
    openAddCaseModal(clientId, {
      profile: currentProfile,
      onCreated: () => {
        loadAndRenderProjects();
        loadAndRenderWorkflow();
      }
    });
  });
}

// ---------------------------------------------------------------------
// Tab Workflow (Issue #244) -- reuse murni dari client-detail-v2.js.
// Logic dan query TIDAK diubah; hanya class/id DOM yang di-prefix cdv3-.
// ---------------------------------------------------------------------

const WORK_STAGE_STATUS_LABEL = {
  PENDING: 'Menunggu',
  IN_PROGRESS: 'Berjalan',
  DONE: 'Selesai',
  BLOCKED: 'Terhambat'
};

const DELIVERABLE_BUCKET = 'case-deliverables';
const MAX_DELIVERABLE_FILE_SIZE = 10 * 1024 * 1024;
const DELIVERABLE_TYPE_LABEL = { PRODUK: 'Produk', SUMMARY: 'Summary Tahapan' };

const bastDateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

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
    .update({ status: newStatus, completed_at: newStatus === 'DONE' ? new Date().toISOString() : null })
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
  return element('span', `cdv3-status-pill cdv3-status-${key}`, WORK_STAGE_STATUS_LABEL[status] || status || '—');
}

function buildWorkStageActions(stage, project) {
  if (stage.status === 'DONE') {return null;}

  const actions = element('div', 'cdv3-workflow-actions');
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
      await loadAndRenderWorkflow();
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
  const alert = element('div', 'cdv3-workflow-invoice-alert');
  const info = element('div', 'cdv3-workflow-invoice-alert-info');
  info.append(
    element('span', 'cdv3-workflow-invoice-alert-name', termin.term_name),
    element('span', 'cdv3-workflow-invoice-alert-amount', rupiah(termin.amount))
  );
  alert.appendChild(info);

  const createBtn = element('button', 'btn btn-sm btn-primary', 'Buat Invoice');
  createBtn.type = 'button';
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    const ok = await createInvoiceFromTermin(termin, project);
    if (ok) {
      showToast('Invoice berhasil dibuat.', { variant: 'success' });
      await loadAndRenderWorkflow();
      return;
    }
    createBtn.disabled = false;
  });
  alert.appendChild(createBtn);
  return alert;
}

function buildInvoicedBadge(termin, project, payment) {
  const wrap = element('div', 'cdv3-workflow-invoiced-row');

  const badge = element('div', 'cdv3-workflow-invoiced-badge');
  badge.append(
    element('span', 'cdv3-workflow-invoiced-badge-icon', '✓'),
    element('span', 'cdv3-workflow-invoiced-badge-text', `${termin.term_name} — Sudah di-invoice`)
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

  const wrap = element('div', 'cdv3-workflow-invoice-alerts');
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

async function fetchCaseBast(caseId) {
  const { data, error } = await supabase
    .from('case_bast')
    .select('id, bast_number, created_at')
    .eq('case_id', caseId)
    .maybeSingle();
  if (error || !data) {return null;}
  return data;
}

async function fetchCasePayments(caseId) {
  const { data, error } = await supabase
    .from('payments')
    .select('id, type, amount, status, paid_at, invoice_number')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });
  if (error) {return [];}
  return data || [];
}

async function createBast(project) {
  const { data, error } = await supabase
    .from('case_bast')
    .insert({ case_id: project.id, created_by: currentProfile?.id })
    .select('id, bast_number, created_at')
    .single();
  if (error || !data) {
    showToast('Gagal membuat BAST.', { variant: 'error' });
    return null;
  }
  await supabase.from('activities').insert({
    client_id: clientId,
    case_id: project.id,
    type: 'BAST Dibuat',
    notes: `BAST ${data.bast_number} berhasil dibuat.`,
    by_user: currentProfile?.id
  });
  return data;
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
  const row = element('div', 'cdv3-deliverable-row');
  const info = element('div', 'cdv3-deliverable-info');
  info.append(
    element('span', 'cdv3-deliverable-type', DELIVERABLE_TYPE_LABEL[deliverable.type] || deliverable.type),
    element('span', 'cdv3-deliverable-name', deliverable.name)
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
    await loadAndRenderWorkflow();
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
  const wrap = element('div', 'cdv3-deliverable-section');
  wrap.appendChild(element('span', 'cdv3-deliverable-label', 'Deliverable'));

  const items = deliverablesByStage.get(stage.id) || [];
  if (items.length === 0) {
    wrap.appendChild(element('div', 'cdv3-deliverable-empty', 'Belum ada deliverable untuk tahap ini.'));
  } else {
    const list = element('div', 'cdv3-deliverable-list');
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
  const wrap = element('div', 'cdv3-proj-workflow');
  wrap.appendChild(element('span', 'cdv3-workflow-label', 'Tahapan Pekerjaan'));

  if (!stages || stages.length === 0) {
    wrap.appendChild(element('div', 'cdv3-workflow-empty', 'Belum ada tahapan pekerjaan.'));
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

  const list = element('div', 'cdv3-workflow-list');

  mainStages.forEach((stage) => {
    const subStages = subStagesByParent.get(stage.id) || [];
    const stageEl = element('div', 'cdv3-workflow-stage');
    const head = element('div', 'cdv3-workflow-stage-head');
    head.append(
      element('span', 'cdv3-workflow-stage-name', stage.name),
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
      const subList = element('div', 'cdv3-workflow-substages');
      subStages.forEach((sub) => {
        const subEl = element('div', 'cdv3-workflow-substage');
        const subHead = element('div', 'cdv3-workflow-substage-head');
        subHead.append(
          element('span', 'cdv3-workflow-substage-name', sub.name),
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

function buildBastStagesTable(doc, stages) {
  if (!stages || stages.length === 0) {
    return docEl(doc, 'p', 'preview-empty', 'Belum ada tahapan pekerjaan.');
  }
  const table = docEl(doc, 'table', 'preview-table');
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  ['Tahap', 'Tanggal Selesai'].forEach((h) => headRow.appendChild(docEl(doc, 'th', '', h)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  stages.forEach((stage) => {
    const row = doc.createElement('tr');
    row.appendChild(docEl(doc, 'td', '', stage.name));
    row.appendChild(docEl(doc, 'td', '', stage.completed_at ? bastDateFmt.format(new Date(stage.completed_at)) : '—'));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function buildBastPaymentsTable(doc, payments) {
  if (!payments || payments.length === 0) {
    return docEl(doc, 'p', 'preview-empty', 'Belum ada pembayaran tercatat.');
  }
  const table = docEl(doc, 'table', 'preview-table');
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  ['Tipe', 'Jumlah', 'Tanggal Lunas'].forEach((h) => headRow.appendChild(docEl(doc, 'th', '', h)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  let total = 0;
  payments.forEach((payment) => {
    total += Number(payment.amount) || 0;
    const row = doc.createElement('tr');
    row.appendChild(docEl(doc, 'td', '', payment.type));
    row.appendChild(docEl(doc, 'td', 'preview-table-num', rupiah(payment.amount)));
    row.appendChild(docEl(doc, 'td', '', payment.paid_at ? bastDateFmt.format(new Date(payment.paid_at)) : '—'));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  const tfoot = doc.createElement('tfoot');
  const totalRow = doc.createElement('tr');
  const totalLabel = docEl(doc, 'td', 'preview-table-total-label', 'Total — Lunas');
  totalLabel.colSpan = 2;
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(docEl(doc, 'td', 'preview-table-num preview-table-total', rupiah(total)));
  tfoot.appendChild(totalRow);
  table.appendChild(tfoot);

  return table;
}

function buildBastDeliverablesTable(doc, deliverableRows) {
  if (!deliverableRows || deliverableRows.length === 0) {
    return docEl(doc, 'p', 'preview-empty', 'Tidak ada dokumen tercatat.');
  }
  const table = docEl(doc, 'table', 'preview-table');
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  ['Tahap', 'Dokumen'].forEach((h) => headRow.appendChild(docEl(doc, 'th', '', h)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  deliverableRows.forEach((item) => {
    const row = doc.createElement('tr');
    row.appendChild(docEl(doc, 'td', '', item.stageName));
    row.appendChild(docEl(doc, 'td', '', `${item.name} (${DELIVERABLE_TYPE_LABEL[item.type] || item.type})`));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

async function buildBastPreviewContent(doc, data) {
  const { generatedDate, bastNumber, project, quotation, stages, payments, deliverableRows } = data;
  const bastClient = data.client;
  const root = docEl(doc, 'div', 'preview-doc');

  const letterhead = docEl(doc, 'div', 'preview-letterhead');
  letterhead.appendChild(docEl(doc, 'div', 'preview-company-name', 'Soul Mitra Abadi'));
  letterhead.appendChild(docEl(doc, 'div', 'preview-doc-title', 'Berita Acara Serah Terima'));
  root.appendChild(letterhead);

  const meta = docEl(doc, 'div', 'preview-meta');
  meta.appendChild(docEl(doc, 'span', '', `Tanggal: ${generatedDate}`));
  meta.appendChild(docEl(doc, 'span', '', `No. BAST: ${bastNumber || '—'}`));
  meta.appendChild(docEl(doc, 'span', '', `Ref. RAB: ${quotation?.quotation_number || '—'}`));
  root.appendChild(meta);

  root.appendChild(docEl(doc, 'p', 'preview-perihal', `Untuk: ${project?.service_type || '—'} (${project?.case_number || '—'})`));

  const kepada = docEl(doc, 'div', 'preview-kepada');
  kepada.appendChild(docEl(doc, 'p', '', 'Pihak Kedua'));
  const picLine = [bastClient?.pic_name, bastClient?.pic_title].filter(Boolean).join(', ');
  kepada.appendChild(docEl(doc, 'p', '', `Bpk/Ibu ${picLine || '—'}`));
  const companyLine = [bastClient?.type, bastClient?.name].filter(Boolean).join(' ');
  kepada.appendChild(docEl(doc, 'p', '', companyLine || '—'));
  root.appendChild(kepada);

  if (quotation?.description) {
    root.appendChild(docEl(doc, 'p', 'preview-paragraph', quotation.description));
  }

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Milestone Tahapan'));
  root.appendChild(buildBastStagesTable(doc, stages));

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Ringkasan Pembayaran'));
  root.appendChild(buildBastPaymentsTable(doc, payments));

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Dokumen yang Diserahkan'));
  root.appendChild(buildBastDeliverablesTable(doc, deliverableRows));

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Pernyataan'));
  root.appendChild(docEl(doc, 'p', 'preview-paragraph', 'Dengan ini Pihak Kedua menyatakan telah menerima seluruh hasil pekerjaan dari Pihak Pertama dengan baik dan lengkap, serta menyatakan bahwa pekerjaan telah selesai dan seluruh pembayaran telah lunas.'));

  const signatureBlock = docEl(doc, 'div', 'preview-signature-block');

  const smaCol = docEl(doc, 'div', 'preview-signature-col');
  smaCol.appendChild(docEl(doc, 'p', '', 'Soul Mitra Abadi,'));
  smaCol.appendChild(docEl(doc, 'div', 'preview-signature-space'));
  smaCol.appendChild(docEl(doc, 'p', 'preview-signature-name', '( Nama Jelas )'));
  signatureBlock.appendChild(smaCol);

  const clientCol = docEl(doc, 'div', 'preview-signature-col');
  clientCol.appendChild(docEl(doc, 'p', '', `${companyLine || 'Pihak Client'},`));
  clientCol.appendChild(docEl(doc, 'div', 'preview-signature-space'));
  clientCol.appendChild(docEl(doc, 'p', 'preview-signature-name', '( Nama Jelas )'));
  signatureBlock.appendChild(clientCol);

  root.appendChild(signatureBlock);

  return root;
}

function renderBastPreviewWindow(win, data) {
  const doc = win.document;
  doc.title = data.bastNumber ? `BAST — ${data.bastNumber}` : 'BAST';

  doc.head.replaceChildren();
  const meta = doc.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  doc.head.appendChild(meta);
  const style = doc.createElement('style');
  style.textContent = PREVIEW_CSS;
  doc.head.appendChild(style);

  doc.body.replaceChildren();

  const toolbar = docEl(doc, 'div', 'preview-toolbar');
  const printBtn = docEl(doc, 'button', 'primary', 'Print / Simpan sebagai PDF');
  printBtn.type = 'button';
  printBtn.addEventListener('click', () => win.print());
  const closeBtn = docEl(doc, 'button', '', 'Tutup');
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', () => win.close());
  toolbar.append(printBtn, closeBtn);
  doc.body.appendChild(toolbar);

  const page = docEl(doc, 'div', 'preview-page');
  buildBastPreviewContent(doc, data).then((content) => {
    page.appendChild(content);
  });
  doc.body.appendChild(page);
}

async function openBastPreview(project, bast, stages, payments, deliverablesByStage) {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Popup diblokir browser. Izinkan popup untuk membuka preview dokumen.', { variant: 'error' });
    return;
  }
  win.document.title = 'Memuat BAST…';
  const loading = docEl(win.document, 'p', '', 'Memuat dokumen…');
  loading.style.cssText = 'font-family: Arial, sans-serif; padding: 24px;';
  win.document.body.appendChild(loading);

  const quotation = (getQuotationsByCaseId().get(project.id) || []).find((q) => q.status === 'ACCEPTED') || null;
  const mainStages = stages.filter((s) => !s.parent_stage_id);
  const deliverableRows = [];
  mainStages.forEach((stage) => {
    const items = deliverablesByStage.get(stage.id) || [];
    items.forEach((item) => {
      deliverableRows.push({ stageName: stage.name, name: item.name, type: item.type });
    });
  });

  if (win.closed) {return;}

  renderBastPreviewWindow(win, {
    generatedDate: bastDateFmt.format(new Date(bast.created_at)),
    bastNumber: bast.bast_number,
    client,
    project,
    quotation,
    stages: mainStages,
    payments,
    deliverableRows
  });
}

function buildBastSection(project, stages, payments, bast, deliverablesByStage) {
  const wrap = element('div', 'cdv3-bast-section');
  wrap.appendChild(element('span', 'cdv3-bast-label', 'BAST'));

  if (bast) {
    const row = element('div', 'cdv3-workflow-invoiced-row');
    const badge = element('div', 'cdv3-workflow-invoiced-badge');
    badge.append(
      element('span', 'cdv3-workflow-invoiced-badge-icon', '✓'),
      element('span', 'cdv3-workflow-invoiced-badge-text', `${bast.bast_number} — dibuat ${bastDateFmt.format(new Date(bast.created_at))}`)
    );
    row.appendChild(badge);

    const viewBtn = element('button', 'btn btn-outline btn-sm', 'Lihat BAST');
    viewBtn.type = 'button';
    viewBtn.addEventListener('click', () => openBastPreview(project, bast, stages, payments, deliverablesByStage));
    row.appendChild(viewBtn);

    wrap.appendChild(row);
    return wrap;
  }

  const mainStages = stages.filter((s) => !s.parent_stage_id);
  const eligible = mainStages.length > 0
    && mainStages.every((s) => s.status === 'DONE')
    && payments.length > 0
    && payments.every((p) => p.status === 'Lunas');

  if (!eligible) {
    wrap.appendChild(element('div', 'cdv3-bast-empty', 'BAST dapat dibuat setelah semua tahap selesai dan semua pembayaran lunas.'));
    return wrap;
  }

  const createBtn = element('button', 'btn btn-sm btn-primary', 'Buat BAST');
  createBtn.type = 'button';
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    const created = await createBast(project);
    if (created) {
      showToast('BAST berhasil dibuat.', { variant: 'success' });
      await loadAndRenderWorkflow();
      return;
    }
    createBtn.disabled = false;
  });
  wrap.appendChild(createBtn);
  return wrap;
}

function renderWorkflowRow(project, stages, termin, invoicedTerminIds, deliverablesByStage, payments, bast) {
  const row = element('div', 'cdv3-workflow-row');

  const head = element('div', 'cdv3-workflow-row-head');
  const hasTitle = Boolean(project.notes && project.notes.trim());
  const nameEl = element('span', 'cdv3-workflow-row-name', hasTitle ? project.notes : 'Judul belum diisi');
  if (!hasTitle) {nameEl.classList.add('cdv3-title-empty');}
  const titleGroup = element('div', 'cdv3-title-group');
  titleGroup.append(nameEl, element('span', 'cdv3-service-chip', project.service_type || '—'));
  const statusEl = canUpdateCaseStatus()
    ? buildStatusSelect(project)
    : element('span', 'cdv3-workflow-row-status', project.status || '—');
  head.append(titleGroup, statusEl);
  row.appendChild(head);

  const progress = calcProgress(stages);
  if (progress !== null) {
    const progressEl = element('div', 'cdv3-proj-progress');
    const bar = element('div', 'cdv3-proj-progress-bar');
    const fill = element('div', 'cdv3-proj-progress-fill');
    fill.style.width = `${progress}%`;
    bar.appendChild(fill);
    progressEl.append(bar, element('span', 'cdv3-proj-progress-label', `Progress: ${progress}%`));
    row.appendChild(progressEl);
  }

  row.appendChild(buildWorkflowSection(project, stages, termin, invoicedTerminIds, deliverablesByStage));
  row.appendChild(buildBastSection(project, stages, payments, bast, deliverablesByStage));

  return row;
}

async function loadAndRenderWorkflow() {
  const table = document.getElementById('cdv3-workflow-table');
  if (!table) {return;}
  table.replaceChildren();

  const { data, error } = await supabase
    .from('cases')
    .select('id, client_id, service_type, notes, status, total_rab, negotiation_count, created_at, case_number')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    table.appendChild(element('div', 'empty-state', 'Gagal memuat project.'));
    return;
  }

  const projects = data || [];
  if (projects.length === 0) {
    table.appendChild(element('div', 'empty-state', 'Belum ada project untuk client ini.'));
    table.setAttribute('aria-busy', 'false');
    return;
  }

  await loadQuotationsForCases(projects.map((p) => p.id));
  const invoicedTerminIds = await getInvoicedTerminIds(projects.map((p) => p.id));

  for (const project of projects) {
    const stages = (await getWorkStagesForCase(project.id)) || [];
    const termin = await getAcceptedTerminForCase(project.id);
    const deliverablesByStage = await fetchDeliverablesForCase(project.id);
    const payments = await fetchCasePayments(project.id);
    const bast = await fetchCaseBast(project.id);
    table.appendChild(renderWorkflowRow(project, stages, termin, invoicedTerminIds, deliverablesByStage, payments, bast));
  }

  table.setAttribute('aria-busy', 'false');
}

async function mountClientPortalAccess() {
  try {
    const { initClientPortalAccess } = await import('./client-portal-access.js');
    await initClientPortalAccess({ clientId, profile: currentProfile });
  } catch {
    const accessRoot = document.querySelector('[data-client-portal-access-root]');
    if (accessRoot) {
      accessRoot.querySelector('[data-client-portal-access-message]').textContent =
        'Status akses Client Portal belum dapat dimuat.';
      accessRoot.setAttribute('aria-busy', 'false');
    }
  }
}

async function mountClientDocuments() {
  try {
    const { initClientDocuments } = await import('./client-documents.js');
    await initClientDocuments({ clientId, profile: currentProfile });
  } catch {
    const root = document.getElementById('client-documents-root');
    if (root) {root.textContent = 'Gagal memuat modul dokumen.';}
  }
}

async function mountClientPayments() {
  try {
    const { initClientPayments } = await import('./client-payments.js');
    await initClientPayments({ clientId, profile: currentProfile });
  } catch {
    const root = document.getElementById('client-payments-root');
    if (root) {root.textContent = 'Gagal memuat modul pembayaran.';}
  }
}

async function mountClientActivities() {
  try {
    const { initClientActivities } = await import('./client-activities.js');
    await initClientActivities({ clientId, profile: currentProfile });
  } catch {
    const root = document.getElementById('client-activities-root');
    if (root) {root.textContent = 'Gagal memuat modul aktivitas.';}
  }
}

export async function initClientDetailV3() {
  const root = document.getElementById('client-detail-v3-root');
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

  wireTabs(root);
  renderHeader();
  updateInfoBarTexts();
  wireInfoToggle();
  renderCards();
  wireAddProject();
  wireCaseStatusControls(root);
  await loadAndRenderProjects();
  await loadAndRenderWorkflow();
  await mountClientDocuments();
  await mountClientPayments();
  await mountClientActivities();
  await mountClientPortalAccess();

  root.setAttribute('aria-busy', 'false');
}
