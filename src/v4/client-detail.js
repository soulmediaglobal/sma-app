// SMA-app — Client Detail / Info tab.
// Loads one client by the `?id=` supplied by Client List and owns only the
// Info panel. The remaining stable tab panels are filled by later issues.

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';
import { showToast } from './toast.js';
import { openMenu } from './menus.js';
import { openAddCaseModal } from './case-form.js';
import { loadQuotationsForCases, buildQuotationSection } from './client-quotations.js';

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
let assignableProfiles = null;
let projectsById = new Map();
let assigneesByCaseId = new Map();
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
    if (!currentProfile?.id) {
      showToast('Gagal memuat profil pengguna. Muat ulang halaman.', { variant: 'error' });
      return;
    }
    openAddCaseModal(clientId, {
      profile: currentProfile,
      onCreated: () => loadProjects(root)
    });
  });
}

async function loadAssignableProfiles() {
  if (assignableProfiles) {return assignableProfiles;}
  const { data } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['internal', 'supervisor'])
    .order('name', { ascending: true });
  assignableProfiles = data || [];
  return assignableProfiles;
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

function canManageAssignees() {
  return Boolean(currentProfile?.id && ['admin', 'supervisor'].includes(currentProfile.role));
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

async function addAssignee(root, caseId, userId, userName) {
  const { error } = await supabase
    .from('case_assignees')
    .insert({ case_id: caseId, user_id: userId, assigned_by: currentProfile?.id || null });

  if (error) {
    showToast('Gagal menambahkan anggota tim.', { variant: 'error' });
    return;
  }

  await logActivity({
    caseId,
    type: 'Tambah Anggota Tim',
    notes: `${userName} ditambahkan ke tim internal project.`
  });

  showToast('Anggota tim berhasil ditambahkan.', { variant: 'success' });
  await loadProjects(root);
}

async function removeAssignee(root, trigger) {
  if (trigger.disabled) {return;}
  const assigneeRowId = trigger.dataset.assigneeId;
  const caseId = trigger.dataset.caseId;
  const memberName = trigger.dataset.memberName;
  trigger.disabled = true;

  try {
    const { error } = await supabase
      .from('case_assignees')
      .delete()
      .eq('id', assigneeRowId)
      .eq('case_id', caseId);

    if (error) {
      showToast('Gagal menghapus anggota tim.', { variant: 'error' });
      return;
    }

    await logActivity({
      caseId,
      type: 'Hapus Anggota Tim',
      notes: `${memberName} dihapus dari tim internal project.`
    });

    showToast('Anggota tim berhasil dihapus.', { variant: 'success' });
    await loadProjects(root);
  } finally {
    if (trigger.isConnected) {trigger.disabled = false;}
  }
}

async function openAddAssigneeMenu(root, trigger) {
  const caseId = trigger.dataset.caseId;
  if (!projectsById.has(caseId)) {return;}

  const candidates = await loadAssignableProfiles();
  const assignedIds = new Set((assigneesByCaseId.get(caseId) || []).map((row) => row.user_id));
  const available = candidates.filter((profile) => !assignedIds.has(profile.id));

  if (available.length === 0) {
    showToast('Semua staf yang tersedia sudah masuk tim project ini.', { variant: 'info' });
    return;
  }

  openMenu(trigger, available.map((profile) => ({
    label: profile.name,
    action: () => {addAssignee(root, caseId, profile.id, profile.name);}
  })));
}

function wireProjectActions(root) {
  const panel = root.querySelector('#client-panel-cases');
  panel.addEventListener('change', (event) => {
    const statusControl = event.target.closest('[data-case-status-control]');
    if (statusControl) {updateCaseStatus(root, statusControl, statusControl.value);}
  });
  panel.addEventListener('click', (event) => {
    const addAssigneeTrigger = event.target.closest('[data-add-assignee-trigger]');
    if (addAssigneeTrigger) {
      openAddAssigneeMenu(root, addAssigneeTrigger);
      return;
    }

    const removeAssigneeTrigger = event.target.closest('[data-remove-assignee]');
    if (removeAssigneeTrigger) {
      removeAssignee(root, removeAssigneeTrigger);
    }
  });
}

function buildTeamSection(project, canManageTeam, assigneesError) {
  const team = document.createElement('div');
  team.appendChild(element('span', 'client-project-label', 'Tim Internal'));

  const teamList = element('div', 'client-project-team-list');

  if (assigneesError) {
    teamList.appendChild(element('span', 'client-project-team-error', 'Gagal memuat tim.'));
  } else {
    const rows = assigneesByCaseId.get(project.id) || [];
    if (rows.length === 0) {
      teamList.appendChild(element('span', 'client-project-team-empty', 'Belum ada anggota tim'));
    } else {
      rows.forEach((row) => {
        const memberName = relatedRecord(row.member)?.name || 'Pengguna tidak dikenal';
        const chip = element('span', 'client-project-team-chip');
        chip.appendChild(element('span', '', memberName));
        if (canManageTeam) {
          const removeBtn = element('button', 'client-project-team-remove', '×');
          removeBtn.type = 'button';
          removeBtn.dataset.removeAssignee = '';
          removeBtn.dataset.assigneeId = row.id;
          removeBtn.dataset.caseId = project.id;
          removeBtn.dataset.memberName = memberName;
          removeBtn.setAttribute('aria-label', `Hapus ${memberName} dari tim project`);
          chip.appendChild(removeBtn);
        }
        teamList.appendChild(chip);
      });
    }
  }

  if (canManageTeam) {
    const addBtn = element('button', 'btn btn-outline btn-sm client-project-team-add', '+ Tambah');
    addBtn.type = 'button';
    addBtn.dataset.addAssigneeTrigger = '';
    addBtn.dataset.caseId = project.id;
    addBtn.setAttribute('aria-haspopup', 'true');
    addBtn.setAttribute('aria-expanded', 'false');
    teamList.appendChild(addBtn);
  }

  team.appendChild(teamList);
  return team;
}

async function loadProjects(root) {
  const panel = root.querySelector('#client-panel-cases');
  panel.querySelectorAll('.client-project-list, .client-detail-status').forEach((el) => el.remove());
  projectsById = new Map();
  assigneesByCaseId = new Map();

  const canUpdateStatus = canUpdateCaseStatus();
  const canManageTeam = canManageAssignees();

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
        created_by,
        creator:profiles!created_by(id, name)
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

  let assigneesError = false;
  if (projects.length > 0) {
    try {
      const { data: assigneeRows, error: assigneeErr } = await supabase
        .from('case_assignees')
        .select('id, case_id, user_id, member:profiles!user_id(id, name, role)')
        .in('case_id', projects.map((project) => project.id))
        .order('assigned_at', { ascending: true });

      if (assigneeErr) {
        assigneesError = true;
      } else {
        (assigneeRows || []).forEach((row) => {
          const rows = assigneesByCaseId.get(row.case_id) || [];
          rows.push(row);
          assigneesByCaseId.set(row.case_id, rows);
        });
      }
    } catch {
      assigneesError = true;
    }

    await loadQuotationsForCases(projects.map((project) => project.id));
  }

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
      const creator = document.createElement('div');
      creator.append(
        element('span', 'client-project-label', 'Dibuat oleh'),
        element('span', '', relatedRecord(project.creator)?.name || 'Tidak diketahui')
      );

      const rab = document.createElement('div');
      rab.append(
        element('span', 'client-project-label', 'RAB'),
        element('span', '', project.total_rab ? rupiah.format(project.total_rab) : '—')
      );

      const team = buildTeamSection(project, canManageTeam, assigneesError);
      const quotation = buildQuotationSection(project, {
        profile: currentProfile,
        clientId,
        client,
        onRefresh: () => loadProjects(root)
      });
      body.append(creator, rab, team, quotation);
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
    try {
      const { initClientWorkflow } = await import('./client-workflow.js');
      await initClientWorkflow({ clientId, profile: currentProfile });
    } catch {
      const workflowRoot = root.querySelector('#client-workflow-root');
      if (workflowRoot) {
        workflowRoot.textContent = 'Gagal memuat modul workflow.';
        workflowRoot.setAttribute('aria-busy', 'false');
      }
    }
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
