// SMA-app — Project Setting page: "Kelola Dokumen Wajib per Jenis Layanan".
// First sub-feature of the "Project Setting" admin page (more are planned —
// service_type_codes / company_settings management, still on hold, separate
// tasks). This task is document_templates.default_service_types only: no
// add/delete of document_templates rows (separate future "kelola master
// dokumen" feature).
//
// Nav visibility is admin-only (roles: ['admin'] in shell-render.js NAV,
// same mechanism as User Management — see src/lib/auth-guard.js). That's a
// UX convenience, not the security boundary: document_templates RLS
// (document_templates_admin_all) is admin-only for insert/update/delete,
// supervisor/internal are SELECT-only. A supervisor/internal who reaches
// this page via direct URL can still see it (RLS allows their SELECT) but
// the save button below is hidden for non-admin, since a write from them
// would just fail at the DB level — same "canManageX" UX pattern already
// used in client-quotations.js / client-documents.js / case-form.js.
//
// default_service_types field uses the existing chips multi-select
// component (v4/form-controls.js, data-multi-select) instead of a plain
// comma-separated text input. That component already exists and is in use
// elsewhere in this codebase (production/form.html) — it fits this field
// better than free text because the option list (distinct `cases.service_type`
// values, queried live, not hardcoded) runs to a couple dozen entries and
// benefits from search-to-add + chip removal rather than typo-prone typing.

import { supabase } from '../lib/supabaseClient.js';
import { getProfile } from '../lib/auth.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined) {node.textContent = text;}
  return node;
}

function setPanelState(root, message, state) {
  root.replaceChildren();
  const status = element('div', `project-setting-state project-setting-state-${state}`, message);
  status.setAttribute('role', state === 'error' ? 'alert' : 'status');
  root.appendChild(status);
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

async function loadServiceTypeOptions() {
  const { data, error } = await supabase.from('cases').select('service_type');
  if (error) {return [];}
  const values = new Set();
  (data || []).forEach((row) => { if (row.service_type) {values.add(row.service_type);} });
  return [...values].sort((a, b) => a.localeCompare(b, 'id'));
}

function buildReadOnlyField(template) {
  const wrap = element('div', 'project-setting-field-readonly');
  const types = template.default_service_types || [];
  if (types.length === 0) {
    wrap.appendChild(element('span', 'project-setting-empty-chip', 'Belum diatur'));
  } else {
    types.forEach((type) => wrap.appendChild(element('span', 'project-setting-chip', type)));
  }
  return wrap;
}

function buildEditableField(template, serviceTypeOptions) {
  const fieldWrap = element('div', 'project-setting-field');

  const msWrap = element('div', 'multi-select');
  msWrap.dataset.multiSelect = '';
  const select = document.createElement('select');
  select.multiple = true;
  select.hidden = true;
  const current = new Set(template.default_service_types || []);
  serviceTypeOptions.forEach((type) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    option.selected = current.has(type);
    select.appendChild(option);
  });
  msWrap.appendChild(select);
  fieldWrap.appendChild(msWrap);

  const saveBtn = element('button', 'btn btn-primary btn-sm project-setting-save', 'Simpan');
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', async () => {
    const selected = [...select.selectedOptions].map((o) => o.value);
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    try {
      const { error } = await supabase
        .from('document_templates')
        .update({ default_service_types: selected.length ? selected : null })
        .eq('id', template.id);

      if (error) {
        showToast(`Gagal menyimpan "${template.name}".`, { variant: 'error' });
        return;
      }
      template.default_service_types = selected;
      showToast(`"${template.name}" berhasil disimpan.`, { variant: 'success' });
    } catch {
      showToast(`Gagal menyimpan "${template.name}".`, { variant: 'error' });
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Simpan';
    }
  });
  fieldWrap.appendChild(saveBtn);

  return fieldWrap;
}

function buildTemplateRow(template, serviceTypeOptions, canEdit) {
  const row = element('div', 'project-setting-template-row');
  row.appendChild(element('div', 'project-setting-template-name', template.name));
  row.appendChild(canEdit ? buildEditableField(template, serviceTypeOptions) : buildReadOnlyField(template));
  return row;
}

function renderTemplates(root, templates, serviceTypeOptions, canEdit) {
  root.replaceChildren();

  if (templates.length === 0) {
    setPanelState(root, 'Belum ada template dokumen.', 'empty');
    return;
  }

  const list = element('div', 'project-setting-category-list');
  let lastCategory = null;
  templates.forEach((template) => {
    if (template.category !== lastCategory) {
      list.appendChild(element('div', 'project-setting-category-heading', template.category || 'Lainnya'));
      lastCategory = template.category;
    }
    list.appendChild(buildTemplateRow(template, serviceTypeOptions, canEdit));
  });
  root.appendChild(list);
  root.setAttribute('aria-busy', 'false');

  if (canEdit) {
    import('./form-controls.js').then((m) => m.initFormControls());
  }
}

async function loadTemplates(root, canEdit) {
  setPanelState(root, 'Memuat daftar dokumen…', 'loading');

  try {
    const [templatesResult, serviceTypeOptions] = await Promise.all([
      supabase
        .from('document_templates')
        .select('id, name, category, default_service_types')
        .order('category', { ascending: true })
        .order('name', { ascending: true }),
      loadServiceTypeOptions()
    ]);

    if (templatesResult.error) {
      setPanelState(root, 'Gagal memuat daftar template dokumen.', 'error');
      return;
    }

    renderTemplates(root, templatesResult.data || [], serviceTypeOptions, canEdit);
  } catch {
    setPanelState(root, 'Gagal memuat daftar template dokumen.', 'error');
  }
}

// ============================================================================
// Rekening Bank (Issue #78) — second section on the same page. Same RLS
// pattern as document_templates above: admin ALL, supervisor/internal
// SELECT-only, no client access (bank_accounts_admin_all /
// bank_accounts_supervisor_select / bank_accounts_internal_select in
// 20260824110000_bank_accounts_multi.sql — not recreated here). Rows are
// never hard-deleted: case_quotations.bank_account_id references this table
// (on delete set null), and RAB documents that already picked an old
// account must keep rendering it, so "delete" is a toggle to is_active =
// false instead.
// ============================================================================

const BANK_FIELDS = [
  { name: 'bank_name', label: 'Nama Bank', required: true },
  { name: 'account_holder_name', label: 'Nama Pemilik Rekening', required: true },
  { name: 'account_number', label: 'Nomor Rekening', required: true },
  { name: 'bank_code', label: 'Kode Bank (opsional)', required: false }
];

function buildBankAccountForm(existing) {
  const form = document.createElement('form');
  form.id = 'bank-account-form';
  form.noValidate = true;

  BANK_FIELDS.forEach((field) => {
    const group = element('div', 'form-group');
    const fieldId = `bank-account-${field.name}`;
    const label = element('label', 'form-label', field.label);
    label.htmlFor = fieldId;
    const input = element('input', 'form-control');
    input.id = fieldId;
    input.name = field.name;
    input.type = 'text';
    input.required = field.required;
    input.value = existing?.[field.name] || '';
    group.append(label, input);
    form.appendChild(group);
  });

  return form;
}

function readBankAccountForm(form) {
  const values = {};
  BANK_FIELDS.forEach((field) => {
    values[field.name] = form.elements.namedItem(field.name).value.trim();
  });
  return values;
}

async function submitBankAccount(ctx, form, root, existing) {
  if (!form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}

  const values = readBankAccountForm(form);
  if (!values.bank_name || !values.account_holder_name || !values.account_number) {
    showToast('Nama bank, pemilik rekening, dan nomor rekening wajib diisi.', { variant: 'error' });
    return;
  }

  const payload = {
    bank_name: values.bank_name,
    account_holder_name: values.account_holder_name,
    account_number: values.account_number,
    bank_code: values.bank_code || null
  };

  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';
  try {
    const { error } = existing
      ? await supabase.from('bank_accounts').update(payload).eq('id', existing.id)
      : await supabase.from('bank_accounts').insert(payload);

    if (error) {
      showToast(existing ? 'Gagal menyimpan perubahan rekening.' : 'Gagal menambahkan rekening.', { variant: 'error' });
      return;
    }

    ctx.close();
    showToast(existing ? 'Rekening berhasil diperbarui.' : 'Rekening berhasil ditambahkan.', { variant: 'success' });
    await loadBankAccounts(root, true);
  } catch {
    showToast(existing ? 'Gagal menyimpan perubahan rekening.' : 'Gagal menambahkan rekening.', { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = existing ? 'Simpan' : 'Tambah Rekening';
  }
}

function openBankAccountModal(root, existing) {
  const form = buildBankAccountForm(existing);
  const ctx = showModal({
    title: existing ? 'Edit Rekening Bank' : 'Tambah Rekening Bank',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: existing ? 'Simpan' : 'Tambah Rekening',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitBankAccount(ctx, form, root, existing);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitBankAccount(ctx, form, root, existing);
  });
}

async function toggleBankAccountActive(root, account, trigger) {
  if (trigger.disabled) {return;}
  trigger.disabled = true;
  try {
    const { error } = await supabase
      .from('bank_accounts')
      .update({ is_active: !account.is_active })
      .eq('id', account.id);

    if (error) {
      showToast('Gagal mengubah status rekening.', { variant: 'error' });
      return;
    }
    showToast(account.is_active ? 'Rekening dinonaktifkan.' : 'Rekening diaktifkan.', { variant: 'success' });
    await loadBankAccounts(root, true);
  } catch {
    showToast('Gagal mengubah status rekening.', { variant: 'error' });
  } finally {
    if (trigger.isConnected) {trigger.disabled = false;}
  }
}

function buildBankAccountRow(root, account, canEdit) {
  const row = element('div', 'project-setting-bank-row');

  const info = element('div', 'project-setting-bank-info');
  const nameLine = element('div', 'project-setting-bank-name-line');
  nameLine.append(
    element('span', 'project-setting-bank-name', account.bank_name),
    element('span', `status ${account.is_active ? 'status-green' : 'status-red'}`, account.is_active ? 'Aktif' : 'Nonaktif')
  );
  info.appendChild(nameLine);

  const metaParts = [account.account_holder_name, account.account_number];
  if (account.bank_code) {metaParts.push(`Kode ${account.bank_code}`);}
  info.appendChild(element('div', 'project-setting-bank-meta', metaParts.filter(Boolean).join(' · ')));

  row.appendChild(info);

  if (canEdit) {
    const actions = element('div', 'project-setting-bank-actions');

    const editBtn = element('button', 'btn btn-outline btn-sm', 'Edit');
    editBtn.type = 'button';
    editBtn.addEventListener('click', () => openBankAccountModal(root, account));
    actions.appendChild(editBtn);

    const toggleBtn = element('button', 'btn btn-outline btn-sm', account.is_active ? 'Nonaktifkan' : 'Aktifkan');
    toggleBtn.type = 'button';
    toggleBtn.addEventListener('click', () => toggleBankAccountActive(root, account, toggleBtn));
    actions.appendChild(toggleBtn);

    row.appendChild(actions);
  }

  return row;
}

function renderBankAccounts(root, accounts, canEdit) {
  root.replaceChildren();

  if (canEdit) {
    const addBtn = element('button', 'btn btn-primary btn-sm project-setting-bank-add', '+ Tambah Rekening');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => openBankAccountModal(root, null));
    root.appendChild(addBtn);
  }

  if (accounts.length === 0) {
    const empty = element('div', 'project-setting-state project-setting-state-empty', 'Belum ada rekening bank.');
    empty.setAttribute('role', 'status');
    root.appendChild(empty);
    root.setAttribute('aria-busy', 'false');
    return;
  }

  const list = element('div', 'project-setting-bank-list');
  accounts.forEach((account) => list.appendChild(buildBankAccountRow(root, account, canEdit)));
  root.appendChild(list);
  root.setAttribute('aria-busy', 'false');
}

async function loadBankAccounts(root, canEdit) {
  setPanelState(root, 'Memuat rekening bank…', 'loading');

  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('id, bank_name, account_holder_name, account_number, bank_code, is_active')
      .order('is_active', { ascending: false })
      .order('bank_name', { ascending: true });

    if (error) {
      setPanelState(root, 'Gagal memuat daftar rekening bank.', 'error');
      return;
    }

    renderBankAccounts(root, data || [], canEdit);
  } catch {
    setPanelState(root, 'Gagal memuat daftar rekening bank.', 'error');
  }
}

// ============================================================================
// Kode Layanan (Issue #85) — third section on the same page. service_type_codes
// has no id column (service_type is the PK). Same RLS pattern as the other
// two sections: admin ALL, supervisor/internal SELECT-only, no client access
// (service_type_codes_admin_all / _supervisor_select / _internal_select in
// 20260824070000_project_part5-2_rab_formal_schema.sql, not recreated here).
// Read by generate_quotation_number() (unchanged, out of scope) to build the
// SMA/YYYY-MM/CODE/seq quotation number.
// ============================================================================

const SERVICE_CODE_MAX_LENGTH = 3;

function isValidServiceCode(value) {
  return value.length > 0 && value.length <= SERVICE_CODE_MAX_LENGTH;
}

async function loadMissingServiceTypes(existingTypes) {
  const { data, error } = await supabase.from('cases').select('service_type');
  if (error) {return [];}
  const existing = new Set(existingTypes);
  const values = new Set();
  (data || []).forEach((row) => {
    if (row.service_type && !existing.has(row.service_type)) {values.add(row.service_type);}
  });
  return [...values].sort((a, b) => a.localeCompare(b, 'id'));
}

async function saveServiceCode(input, row) {
  const value = input.value.trim().toUpperCase();
  if (value === row.code) {input.value = row.code; return;}
  if (!isValidServiceCode(value)) {
    showToast(`Kode untuk "${row.service_type}" wajib diisi (maks ${SERVICE_CODE_MAX_LENGTH} karakter).`, { variant: 'error' });
    input.value = row.code;
    return;
  }

  input.disabled = true;
  try {
    const { error } = await supabase
      .from('service_type_codes')
      .update({ code: value })
      .eq('service_type', row.service_type);

    if (error) {
      showToast(`Gagal menyimpan kode "${row.service_type}".`, { variant: 'error' });
      input.value = row.code;
      return;
    }
    row.code = value;
    input.value = value;
    showToast(`Kode "${row.service_type}" berhasil disimpan.`, { variant: 'success' });
  } catch {
    showToast(`Gagal menyimpan kode "${row.service_type}".`, { variant: 'error' });
    input.value = row.code;
  } finally {
    input.disabled = false;
  }
}

function buildServiceCodeRow(row, canEdit) {
  const rowEl = element('div', 'project-setting-service-code-row');
  rowEl.appendChild(element('div', 'project-setting-service-code-name', row.service_type));

  if (canEdit) {
    const input = element('input', 'form-control project-setting-service-code-input');
    input.type = 'text';
    input.value = row.code;
    input.maxLength = SERVICE_CODE_MAX_LENGTH;
    input.setAttribute('aria-label', `Kode untuk ${row.service_type}`);
    input.addEventListener('change', () => saveServiceCode(input, row));
    rowEl.appendChild(input);
  } else {
    rowEl.appendChild(element('div', 'project-setting-service-code-value', row.code));
  }

  return rowEl;
}

function buildAddServiceCodeForm(missingTypes) {
  const form = document.createElement('form');
  form.id = 'service-code-form';
  form.noValidate = true;

  const typeGroup = element('div', 'form-group');
  const typeLabel = element('label', 'form-label', 'Jenis Layanan');
  typeLabel.htmlFor = 'service-code-type';
  const select = document.createElement('select');
  select.className = 'form-control';
  select.id = 'service-code-type';
  select.name = 'service_type';
  select.required = true;
  missingTypes.forEach((type) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });
  typeGroup.append(typeLabel, select);
  form.appendChild(typeGroup);

  const codeGroup = element('div', 'form-group');
  const codeLabel = element('label', 'form-label', 'Kode');
  codeLabel.htmlFor = 'service-code-value';
  const codeInput = element('input', 'form-control');
  codeInput.id = 'service-code-value';
  codeInput.name = 'code';
  codeInput.type = 'text';
  codeInput.required = true;
  codeInput.maxLength = SERVICE_CODE_MAX_LENGTH;
  codeGroup.append(codeLabel, codeInput);
  form.appendChild(codeGroup);

  return form;
}

async function submitAddServiceCode(ctx, form, root) {
  if (!form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}

  const serviceType = form.elements.namedItem('service_type').value;
  const code = form.elements.namedItem('code').value.trim().toUpperCase();

  if (!serviceType) {
    showToast('Pilih jenis layanan.', { variant: 'error' });
    return;
  }
  if (!isValidServiceCode(code)) {
    showToast(`Kode wajib diisi (maks ${SERVICE_CODE_MAX_LENGTH} karakter).`, { variant: 'error' });
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';
  try {
    const { error } = await supabase
      .from('service_type_codes')
      .insert({ service_type: serviceType, code });

    if (error) {
      showToast(`Gagal menambahkan kode "${serviceType}".`, { variant: 'error' });
      return;
    }

    ctx.close();
    showToast(`Kode "${serviceType}" berhasil ditambahkan.`, { variant: 'success' });
    await loadServiceCodes(root, true);
  } catch {
    showToast(`Gagal menambahkan kode "${serviceType}".`, { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Tambah Kode';
  }
}

async function openAddServiceCodeModal(root, existingTypes) {
  const missingTypes = await loadMissingServiceTypes(existingTypes);
  if (missingTypes.length === 0) {
    showToast('Semua jenis layanan sudah punya kode.', { variant: 'info' });
    return;
  }

  const form = buildAddServiceCodeForm(missingTypes);
  const ctx = showModal({
    title: 'Tambah Kode Layanan',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Tambah Kode',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitAddServiceCode(ctx, form, root);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitAddServiceCode(ctx, form, root);
  });
}

function renderServiceCodes(root, rows, canEdit) {
  root.replaceChildren();

  if (canEdit) {
    const addBtn = element('button', 'btn btn-primary btn-sm project-setting-service-code-add', '+ Tambah Kode');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => openAddServiceCodeModal(root, rows.map((row) => row.service_type)));
    root.appendChild(addBtn);
  }

  if (rows.length === 0) {
    const empty = element('div', 'project-setting-state project-setting-state-empty', 'Belum ada kode layanan.');
    empty.setAttribute('role', 'status');
    root.appendChild(empty);
    root.setAttribute('aria-busy', 'false');
    return;
  }

  const list = element('div', 'project-setting-service-code-list');
  rows.forEach((row) => list.appendChild(buildServiceCodeRow(row, canEdit)));
  root.appendChild(list);
  root.setAttribute('aria-busy', 'false');
}

async function loadServiceCodes(root, canEdit) {
  setPanelState(root, 'Memuat kode layanan…', 'loading');

  try {
    const { data, error } = await supabase
      .from('service_type_codes')
      .select('service_type, code')
      .order('service_type', { ascending: true });

    if (error) {
      setPanelState(root, 'Gagal memuat daftar kode layanan.', 'error');
      return;
    }

    renderServiceCodes(root, data || [], canEdit);
  } catch {
    setPanelState(root, 'Gagal memuat daftar kode layanan.', 'error');
  }
}

// Tabs ("Kelola Dokumen" / "Kelola Rekening Bank" / "Kode Layanan") — same
// tabs-underline markup + activate/wire pattern as client-detail.js's
// data-client-tab / data-client-panel, just namespaced data-project-setting-tab /
// data-project-setting-panel for this page.
function activateProjectSettingTab(tab) {
  const name = tab.dataset.projectSettingTab;
  document.querySelectorAll('[data-project-setting-tab]').forEach((candidate) => {
    const active = candidate === tab;
    candidate.classList.toggle('active', active);
    candidate.setAttribute('aria-selected', String(active));
    candidate.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('[data-project-setting-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.projectSettingPanel !== name;
  });
}

function wireProjectSettingTabs() {
  const tabs = Array.from(document.querySelectorAll('[data-project-setting-tab]'));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateProjectSettingTab(tab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex;
      if (event.key === 'ArrowRight') {nextIndex = (index + 1) % tabs.length;}
      if (event.key === 'ArrowLeft') {nextIndex = (index - 1 + tabs.length) % tabs.length;}
      if (event.key === 'Home') {nextIndex = 0;}
      if (event.key === 'End') {nextIndex = tabs.length - 1;}
      if (nextIndex === undefined) {return;}
      event.preventDefault();
      activateProjectSettingTab(tabs[nextIndex]);
      tabs[nextIndex].focus();
    });
  });
}

let initialized = false;

export async function initProjectSetting() {
  const root = document.getElementById('project-setting-root');
  const bankRoot = document.getElementById('bank-accounts-root');
  const serviceCodesRoot = document.getElementById('service-codes-root');
  if ((!root && !bankRoot && !serviceCodesRoot) || initialized) {return;}
  initialized = true;

  wireProjectSettingTabs();

  const profile = await getProfile();
  const canEdit = profile?.role === 'admin';
  await Promise.all([
    root ? loadTemplates(root, canEdit) : Promise.resolve(),
    bankRoot ? loadBankAccounts(bankRoot, canEdit) : Promise.resolve(),
    serviceCodesRoot ? loadServiceCodes(serviceCodesRoot, canEdit) : Promise.resolve()
  ]);
}
