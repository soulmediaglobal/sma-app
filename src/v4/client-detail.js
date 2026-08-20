// SMA-app — Client Detail / Info tab.
// Loads one client by the `?id=` supplied by Client List and owns only the
// Info panel. The remaining stable tab panels are filled by later issues.

import { supabase } from '../lib/supabaseClient.js';
import { showToast } from './toast.js';
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

let initialized = false;
let client = null;
let clientId = '';

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

  clientId = new URLSearchParams(window.location.search).get('id')?.trim() || '';
  if (!UUID_PATTERN.test(clientId)) {
    setStatus(root, 'ID client tidak valid.', 'invalid-id');
    return;
  }

  await loadClient(root);
}
