// SMA-app — Client Detail v3 (Issue #240, tab Project/RAB Issue #242).
//
// Restrukturisasi dari client-detail-v2.js: section Info jadi card-based
// dengan edit inline per kartu, sisanya jadi shell 5-tab. Tab Project
// reuse langsung loadQuotationsForCases()/buildQuotationSection() dari
// client-quotations.js dan openAddCaseModal() dari case-form.js -- sama
// persis seperti di V2, tanpa progress/workflow/deliverable/BAST (itu
// masuk tab Workflow, issue terpisah). Tab Workflow/Dokumen/Pembayaran/
// Aktivitas masih placeholder, menunggu issue terpisah per tab.
//
// V1 (client-detail.js) dan V2 (client-detail-v2.js) tidak disentuh.

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';
import { showToast } from './toast.js';
import { openAddCaseModal } from './case-form.js';
import { loadQuotationsForCases, buildQuotationSection } from './client-quotations.js';

const CLIENT_FIELDS = [
  'id', 'name', 'type', 'pic_name', 'pic_title', 'pic_phone', 'pic_email',
  'npwp', 'nib', 'business_field', 'address',
  'director_name', 'director_phone', 'director_id_number',
  'referral_source', 'general_notes', 'created_at'
];

const EDITABLE_FIELDS = CLIENT_FIELDS.filter((field) => !['id', 'created_at'].includes(field));

const FIELD_META = {
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
  { key: 'business', title: 'Badan Usaha', fields: ['npwp', 'nib'] },
  { key: 'director', title: 'Direktur', fields: ['director_name', 'director_phone', 'director_id_number'] },
  { key: 'other', title: 'Lainnya', fields: ['referral_source', 'general_notes'] },
  { key: 'address', title: 'Alamat', fields: ['address'] },
  { key: 'pic', title: 'Kontak PIC', fields: ['pic_name', 'pic_title', 'pic_phone', 'pic_email'], gridLayout: true }
];

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
  const control = meta.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (meta.type !== 'textarea') {control.type = meta.type;}
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
      if (cardDef.key === 'pic') {updateInfoBarTexts();}
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

function renderProjectRow(project) {
  const row = element('div', 'cdv3-proj-row');
  const main = element('div', 'cdv3-proj-main');
  main.append(
    element('div', 'cdv3-proj-name', project.service_type || 'Project tanpa jenis'),
    element('div', 'cdv3-proj-sub', project.case_number || '—')
  );
  const statusKey = (project.status || '').toLowerCase();
  const statusBadge = element('span', `cdv3-status-pill cdv3-status-${statusKey}`, project.status || '—');
  row.append(main, statusBadge);

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
      onCreated: () => loadAndRenderProjects()
    });
  });
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
  await loadAndRenderProjects();
  await mountClientPortalAccess();

  root.setAttribute('aria-busy', 'false');
}
