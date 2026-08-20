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
  const { error } = await supabase
    .from('activities')
    .insert({
      client_id: clientId,
      case_id: caseId,
      type,
      notes,
      by_user: currentProfile?.id
    });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Gagal mencatat aktivitas:', error.message);
  }
}

async function updateCaseStatus(root, caseId, oldStatus, newStatus) {
  const { error } = await supabase
    .from('cases')
    .update({ status: newStatus })
    .eq('id', caseId);

  if (error) {
    showToast('Gagal mengubah status case.', { variant: 'error' });
    return;
  }

  await logActivity({
    caseId,
    type: 'Status Case',
    notes: `Status diubah dari ${oldStatus} menjadi ${newStatus}.`
  });

  showToast('Status case berhasil diubah.', { variant: 'success' });
  await loadProjects(root);
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

function openStatusMenu(root, trigger) {
  const caseId = trigger.dataset.caseId;
  const current = trigger.dataset.status;
  openMenu(trigger, STATUS_OPTIONS.map((status) => ({
    label: status === current ? `${status} ✓` : status,
    action: () => {
      if (status !== current) {updateCaseStatus(root, caseId, current, status);}
    }
  })));
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
  panel.addEventListener('click', (event) => {
    const statusTrigger = event.target.closest('[data-case-status-trigger]');
    if (statusTrigger) {
      openStatusMenu(root, statusTrigger);
      return;
    }
    const picTrigger = event.target.closest('[data-case-pic-trigger]');
    if (picTrigger) {
      openPicMenu(root, picTrigger);
    }
  });
}

async function loadProjects(root) {
  const panel = root.querySelector('#client-panel-cases');
  panel.querySelectorAll('.client-project-list, .client-detail-status').forEach((el) => el.remove());

  const isAdmin = currentProfile?.role === 'admin';

  const { data, error } = await supabase
    .from('cases')
    .select(`
      id,
      service_type,
      status,
      total_rab,
      created_at,
      assigned_to,
      assignee:profiles(id, name)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    panel.insertAdjacentHTML(
      'beforeend',
      '<div class="client-detail-status">Gagal memuat project.</div>'
    );
    return;
  }

  const projects = data || [];

  const list = document.createElement('div');
  list.className = 'client-project-list';

  if (projects.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Belum ada project</div>
        <div class="empty-state-desc">Tambahkan project pertama untuk client ini.</div>
      </div>
    `;
  } else {
    list.innerHTML = projects.map((project) => `
      <article class="client-project-card">
        <div class="client-project-card-header">
          <div>
            <h2>${project.service_type}</h2>
            <div class="client-project-meta">
              Dibuat ${dateFmt.format(new Date(project.created_at))}
            </div>
          </div>
          <button
            type="button"
            class="status status-trigger ${STATUS_BADGE[project.status] || ''}"
            data-case-status-trigger
            data-case-id="${project.id}"
            data-status="${project.status}"
            aria-haspopup="true"
            aria-expanded="false"
          >
            ${project.status}
          </button>
        </div>

        <div class="client-project-card-body">
          <div>
            <span class="client-project-label">PIC</span>
            ${isAdmin ? `
              <button
                type="button"
                class="client-project-pic-trigger"
                data-case-pic-trigger
                data-case-id="${project.id}"
                data-assignee-id="${project.assigned_to || ''}"
                aria-haspopup="true"
                aria-expanded="false"
              >
                ${project.assignee?.name || 'Belum di-assign'}
              </button>
            ` : `<span>${project.assignee?.name || 'Belum di-assign'}</span>`}
          </div>

          <div>
            <span class="client-project-label">RAB</span>
            <span>${project.total_rab ? rupiah.format(project.total_rab) : '—'}</span>
          </div>
        </div>
      </article>
    `).join('');
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

  currentProfile = await getProfile();
  await loadClient(root);
}
