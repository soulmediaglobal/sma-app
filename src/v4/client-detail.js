// SMA-app — Client Detail / Info tab.
// Loads one client by the `?id=` supplied by Client List and owns only the
// Info panel. The remaining stable tab panels are filled by later issues.

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';
import { showToast } from './toast.js';
import { openMenu } from './menus.js';
import { openAddCaseModal } from './case-form.js';

const CLIENT_FIELDS = [
  'id',
  'name',
  'type',
  'npwp',
  'nib',
  'business_field',
  'address',
  'pic_name',
  'pic_title',
  'pic_phone',
  'pic_email',
  'director_name',
  'director_phone',
  'director_id_number',
  'referral_source',
  'general_notes',
  'created_at'
];

const EDITABLE_FIELDS = CLIENT_FIELDS.filter((field) => !['id', 'created_at'].includes(field));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const STATUS_BADGE = {
  Baru: 'status-blue',
  Proses: 'status-yellow',
  Selesai: 'status-green',
  Batal: 'status-red'
};

const STATUS_OPTIONS = Object.keys(STATUS_BADGE);

let initialized = false;
let client = null;
let clientId = '';
let currentProfile = null;
let internalUsers = null;
let projectsById = new Map();
const updatingCaseIds = new Set();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined) {node.textContent = text;}
  return node;
}

function relatedRecord(value) {
  if (Array.isArray(value)) {return value[0] || null;}
  return value && typeof value === 'object' ? value : null;
}

function renderProjectError(panel) {
  panel.appendChild(element('div', 'client-detail-status', 'Gagal memuat project.'));
}

function setStatus(root, message, state = 'loading') {
  const status = root.querySelector('#client-detail-status');
  status.textContent = message;
  status.hidden = false;
  root.dataset.state = state;
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  root.querySelector('#client-info-read').hidden = true;
  root.querySelector('#client-info-form').hidden = true;
  root.querySelector('#client-edit-btn').hidden = true;
}

function displayValue(field, value) {
  if (!value) {return '—';}
  if (field === 'created_at') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : dateFmt.format(date);
  }
  return String(value);
}

function renderReadView(root) {
  root.querySelector('#client-detail-name').textContent = client.name;
  const type = root.querySelector('#client-detail-type');
  type.textContent = client.type;
  type.hidden = false;

  root.querySelectorAll('[data-client-value]').forEach((el) => {
    const field = el.dataset.clientValue;
    el.textContent = displayValue(field, client[field]);
  });

  root.querySelector('#client-detail-status').hidden = true;
  root.querySelector('#client-info-form').hidden = true;
  root.querySelector('#client-info-read').hidden = false;
  root.querySelector('#client-edit-btn').hidden = false;
  root.dataset.state = 'ready';
  root.setAttribute('aria-busy', 'false');
}

function populateForm(root) {
  const form = root.querySelector('#client-info-form');
  EDITABLE_FIELDS.forEach((field) => {
    const control = form.elements.namedItem(field);
    if (control) {control.value = client[field] ?? '';}
  });
}

function setEditMode(root, editing) {
  if (editing) {populateForm(root);}
  root.querySelector('#client-info-read').hidden = editing;
  root.querySelector('#client-info-form').hidden = !editing;
  root.querySelector('#client-edit-btn').hidden = editing;
  root.dataset.mode = editing ? 'edit' : 'read';
  if (editing) {root.querySelector('#client-name').focus();}
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

function formPayload(form) {
  return Object.fromEntries(EDITABLE_FIELDS.map((field) => {
    const value = form.elements.namedItem(field)?.value.trim() || '';
    return [field, ['name', 'type'].includes(field) ? value : value || null];
  }));
}

async function saveClient(root, form) {
  if (!form.reportValidity()) {return;}
  const saveButton = root.querySelector('#client-save-btn');
  saveButton.disabled = true;
  saveButton.textContent = 'Menyimpan…';

  try {
    const { data, error } = await supabase
      .from('clients')
      .update(formPayload(form))
      .eq('id', clientId)
      .select(CLIENT_FIELDS.join(', '))
      .single();

    if (error || !data) {
      showToast('Gagal menyimpan perubahan client.', { variant: 'error' });
      return;
    }

    client = data;
    renderReadView(root);
    setEditMode(root, false);
    showToast('Info client berhasil diperbarui.', { variant: 'success' });
  } catch {
    showToast('Gagal menyimpan perubahan client.', { variant: 'error' });
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Simpan';
  }
}

function wireCaseActions(root) {
  root.querySelector('#client-add-case-btn')?.addEventListener('click', () => {
    openAddCaseModal(clientId);
  });
}

async function loadInternalUsers() {
  if (internalUsers) {return internalUsers;}
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['admin', 'internal'])
    .order('name', { ascending: true });
  internalUsers = data || [];
  return internalUsers;
}

async function logActivity({ caseId, type, notes }) {
  if (!currentProfile?.id) {return { error: new Error('Profil pengguna tidak tersedia') };}
  try {
    return await supabase
      .from('activities')
      .insert({
        client_id: clientId,
        case_id: caseId,
        type,
        notes,
        by_user: currentProfile.id
      });
  } catch (error) {
    return { error };
  }
}

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

async function updateCaseStatus(root, control, newStatus) {
  if (!canUpdateCaseStatus() || control.disabled) {return;}
  const caseId = control.dataset.caseId;
  const project = projectsById.get(caseId);
  const oldStatus = project?.status;
  if (
    !project ||
    project.client_id !== clientId ||
    !STATUS_OPTIONS.includes(oldStatus) ||
    !STATUS_OPTIONS.includes(newStatus) ||
    updatingCaseIds.has(caseId)
  ) {
    showToast('Status project tidak dapat diubah.', { variant: 'error' });
    await loadProjects(root);
    return;
  }
  if (newStatus === oldStatus) {return;}

  control.value = oldStatus;
  control.disabled = true;
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
      await loadProjects(root);
      return;
    }

    const { error: activityError } = await logActivity({
      caseId,
      type: 'Status Case',
      notes: `Status project ${project.service_type} diubah dari ${oldStatus} menjadi ${newStatus}.`
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
      await loadProjects(root);
      return;
    }

    showToast('Status project berhasil diubah.', { variant: 'success' });
    await loadProjects(root);
  } catch {
    showToast('Gagal mengubah status project.', { variant: 'error' });
    await loadProjects(root);
  } finally {
    updatingCaseIds.delete(caseId);
    if (control.isConnected) {control.disabled = false;}
  }
}

async function reassignCasePic(root, caseId, newAssigneeId, newAssigneeName) {
  const { error } = await supabase
    .from('cases')
    .update({ assigned_to: newAssigneeId || null })
    .eq('id', caseId);

  if (error) {
    showToast('Gagal reassign PIC.', { variant: 'error' });
    return;
  }

  await logActivity({
    caseId,
    type: 'Reassign PIC',
    notes: `PIC diubah menjadi ${newAssigneeName}.`
  });

  showToast('PIC berhasil diperbarui.', { variant: 'success' });
  await loadProjects(root);
}

async function openPicMenu(root, trigger) {
  const caseId = trigger.dataset.caseId;
  const currentAssigneeId = trigger.dataset.assigneeId || '';
  const users = await loadInternalUsers();

  const items = [
    {
      label: currentAssigneeId ? 'Belum di-assign' : 'Belum di-assign ✓',
      action: () => {
        if (currentAssigneeId) {reassignCasePic(root, caseId, '', 'Belum di-assign');}
      }
    },
    '-',
    ...users.map((user) => ({
      label: user.id === currentAssigneeId ? `${user.name} ✓` : user.name,
      action: () => {
        if (user.id !== currentAssigneeId) {reassignCasePic(root, caseId, user.id, user.name);}
      }
    }))
  ];

  openMenu(trigger, items);
}

function wireProjectActions(root) {
  const panel = root.querySelector('#client-panel-cases');
  panel.addEventListener('change', (event) => {
    const statusControl = event.target.closest('[data-case-status-control]');
    if (statusControl) {updateCaseStatus(root, statusControl, statusControl.value);}
  });
  panel.addEventListener('click', (event) => {
    const picTrigger = event.target.closest('[data-case-pic-trigger]');
    if (picTrigger) {
      openPicMenu(root, picTrigger);
    }
  });
}

async function loadProjects(root) {
  const panel = root.querySelector('#client-panel-cases');
  panel.querySelectorAll('.client-project-list, .client-detail-status').forEach((el) => el.remove());
  projectsById = new Map();

  const isAdmin = currentProfile?.role === 'admin';
  const canUpdateStatus = canUpdateCaseStatus();

  let data;
  let error;
  try {
    ({ data, error } = await supabase
      .from('cases')
      .select(`
        id,
        client_id,
        service_type,
        status,
        total_rab,
        created_at,
        assigned_to,
        assignee:profiles(id, name)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }));
  } catch {
    renderProjectError(panel);
    return;
  }

  if (error) {
    renderProjectError(panel);
    return;
  }

  const projects = data || [];
  projectsById = new Map(projects.map((project) => [project.id, project]));

  const list = document.createElement('div');
  list.className = 'client-project-list';

  if (projects.length === 0) {
    const empty = element('div', 'empty-state');
    empty.append(
      element('div', 'empty-state-title', 'Belum ada project'),
      element('div', 'empty-state-desc', 'Tambahkan project pertama untuk client ini.')
    );
    list.appendChild(empty);
  } else {
    projects.forEach((project) => {
      const card = element('article', 'client-project-card');
      const header = element('div', 'client-project-card-header');
      const heading = document.createElement('div');
      heading.append(
        element('h2', '', project.service_type || 'Project tanpa jenis'),
        element('div', 'client-project-meta', `Dibuat ${displayValue('created_at', project.created_at)}`)
      );

      if (canUpdateStatus) {
        const statusControl = element(
          'span',
          `client-project-status-control status ${STATUS_BADGE[project.status] || ''}`
        );
        const select = element('select', 'client-project-status-select');
        select.dataset.caseStatusControl = '';
        select.dataset.caseId = project.id;
        select.setAttribute(
          'aria-label',
          `Ubah status project ${project.service_type || 'tanpa jenis'}, ID ${project.id.slice(0, 8)}`
        );
        STATUS_OPTIONS.forEach((status) => {
          const option = element('option', '', status);
          option.value = status;
          option.selected = status === project.status;
          select.appendChild(option);
        });
        statusControl.append(select, element('span', 'client-project-status-chevron', '▾'));
        statusControl.lastElementChild.setAttribute('aria-hidden', 'true');
        header.append(heading, statusControl);
      } else {
        header.append(
          heading,
          element('span', `status ${STATUS_BADGE[project.status] || ''}`, project.status || '—')
        );
      }

      const body = element('div', 'client-project-card-body');
      const pic = document.createElement('div');
      pic.appendChild(element('span', 'client-project-label', 'PIC'));
      const assigneeName = relatedRecord(project.assignee)?.name || 'Belum di-assign';
      if (isAdmin) {
        const picTrigger = element('button', 'client-project-pic-trigger', assigneeName);
        picTrigger.type = 'button';
        picTrigger.dataset.casePicTrigger = '';
        picTrigger.dataset.caseId = project.id;
        picTrigger.dataset.assigneeId = project.assigned_to || '';
        picTrigger.setAttribute('aria-haspopup', 'true');
        picTrigger.setAttribute('aria-expanded', 'false');
        pic.appendChild(picTrigger);
      } else {
        pic.appendChild(element('span', '', assigneeName));
      }

      const rab = document.createElement('div');
      rab.append(
        element('span', 'client-project-label', 'RAB'),
        element('span', '', project.total_rab ? rupiah.format(project.total_rab) : '—')
      );
      body.append(pic, rab);
      card.append(header, body);
      list.appendChild(card);
    });
  }

  panel.appendChild(list);
}

function wireInfoActions(root) {
  const form = root.querySelector('#client-info-form');
  root.querySelector('#client-edit-btn').addEventListener('click', () => setEditMode(root, true));
  root.querySelector('#client-cancel-btn').addEventListener('click', () => {
    populateForm(root);
    setEditMode(root, false);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    saveClient(root, form);
  });
}

async function loadClient(root) {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_FIELDS.join(', '))
      .eq('id', clientId)
      .maybeSingle();

    if (error) {
      setStatus(root, 'Gagal memuat data client. Silakan coba lagi.', 'error');
      return;
    }
    if (!data) {
      setStatus(root, 'Client tidak ditemukan.', 'not-found');
      return;
    }

    client = data;
    renderReadView(root);
    await loadProjects(root);
    try {
      const { initClientDocuments } = await import('./client-documents.js');
      await initClientDocuments({ clientId, profile: currentProfile });
    } catch {
      const documentsRoot = root.querySelector('#client-documents-root');
      if (documentsRoot) {
        documentsRoot.textContent = 'Gagal memuat modul dokumen.';
        documentsRoot.setAttribute('aria-busy', 'false');
      }
    }
    try {
      const { initClientPayments } = await import('./client-payments.js');
      await initClientPayments({ clientId, profile: currentProfile });
    } catch {
      const paymentsRoot = root.querySelector('#client-payments-root');
      if (paymentsRoot) {
        paymentsRoot.textContent = 'Gagal memuat modul pembayaran.';
        paymentsRoot.setAttribute('aria-busy', 'false');
      }
    }
    try {
      const { initClientActivities } = await import('./client-activities.js');
      await initClientActivities({ clientId, profile: currentProfile });
    } catch {
      const activitiesRoot = root.querySelector('#client-activities-root');
      if (activitiesRoot) {
        activitiesRoot.textContent = 'Gagal memuat modul aktivitas.';
        activitiesRoot.setAttribute('aria-busy', 'false');
      }
    }
  } catch {
    setStatus(root, 'Gagal memuat data client. Silakan coba lagi.', 'error');
  }
}

export async function initClientDetail() {
  const root = document.getElementById('client-detail-root');
  if (!root || initialized) {return;}
  initialized = true;

  wireTabs(root);
  wireInfoActions(root);
  wireCaseActions(root);
  wireProjectActions(root);

  clientId = new URLSearchParams(window.location.search).get('id')?.trim() || '';
  if (!UUID_PATTERN.test(clientId)) {
    setStatus(root, 'ID client tidak valid.', 'invalid-id');
    return;
  }

  try {
    currentProfile = await getProfile();
  } catch {
    currentProfile = null;
  }
  await loadClient(root);
}
