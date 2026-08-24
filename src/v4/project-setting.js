// SMA-app — Project Setting page: "Jenis Dokumen" / "Jenis Layanan" /
// "Rekening Bank", 3 tabs on one page (production/project_setting.html).
//
// Nav visibility is admin-only (roles: ['admin'] in shell-render.js NAV,
// same mechanism as User Management — see src/lib/auth-guard.js). That's a
// UX convenience, not the security boundary: document_templates RLS
// (document_templates_admin_all) is admin-only for insert/update/delete,
// supervisor/internal are SELECT-only. A supervisor/internal who reaches
// this page via direct URL can still see it (RLS allows their SELECT) but
// save controls are hidden for non-admin, since a write from them would
// just fail at the DB level — same "canManageX" UX pattern already used in
// client-quotations.js / client-documents.js / case-form.js.

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

// ============================================================================
// Jenis Dokumen (Issue #91) — read-only master list of document_templates
// (name + category). Which documents are required for which service type is
// configured from the Jenis Layanan tab instead (see below), reversed from
// this tab's original direction — picking a service and then its required
// documents is the natural admin flow, vs. picking a document and then every
// service that needs it. The underlying column (document_templates.
// default_service_types) is unchanged, only which side writes it moved.
// Add/edit of document_templates rows themselves (name, category) is a
// separate future "kelola master dokumen" feature (Issue #72), intentionally
// not part of this reorg.
// ============================================================================

function renderDocuments(root, templates) {
  root.replaceChildren();

  if (templates.length === 0) {
    setPanelState(root, 'Belum ada template dokumen.', 'empty');
    return;
  }

  const list = element('div', 'project-setting-category-list');
  let lastCategory = null;
  const sortedTemplates = templates.slice().sort((a, b) => {
    const catA = a.category?.name || 'Lainnya';
    const catB = b.category?.name || 'Lainnya';
    return catA === catB ? a.name.localeCompare(b.name) : catA.localeCompare(catB);
  });
  sortedTemplates.forEach((template) => {
    const categoryName = template.category?.name || 'Lainnya';
    if (categoryName !== lastCategory) {
      list.appendChild(element('div', 'project-setting-category-heading', categoryName));
      lastCategory = categoryName;
    }
    list.appendChild(element('div', 'project-setting-doc-row', template.name));
  });
  root.appendChild(list);
  root.setAttribute('aria-busy', 'false');
}

async function loadDocuments(root) {
  setPanelState(root, 'Memuat daftar dokumen…', 'loading');

  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select('id, name, category_id, category:document_categories(name)')
      .order('name', { ascending: true });

    if (error) {
      setPanelState(root, 'Gagal memuat daftar template dokumen.', 'error');
      return;
    }

    renderDocuments(root, data || []);
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
// Jenis Layanan (Issues #85 + #91) — per-service-type config: the 3-letter
// code used for quotation numbering (service_type_codes, no id column —
// service_type is the PK) plus a checklist of which document_templates are
// required for that service. Checking/unchecking a document here updates
// document_templates.default_service_types (add/remove this service_type
// from that document's array) — same column client-quotations.js's RAB
// document multi-select already reads, just written from the service side
// instead of the document side. Same RLS pattern as the other tabs: admin
// ALL, supervisor/internal SELECT-only, no client access
// (service_type_codes_admin_all / _supervisor_select / _internal_select in
// 20260824070000_project_part5-2_rab_formal_schema.sql;
// document_templates_admin_all — not recreated here). service_type_codes is
// read by generate_quotation_number() (unchanged, out of scope) to build the
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

async function toggleDocumentService(checkbox, template, serviceType, countLabel) {
  if (checkbox.disabled) {return;}
  checkbox.disabled = true;
  const nowChecked = checkbox.checked;
  const current = new Set(template.default_service_types || []);
  if (nowChecked) {current.add(serviceType);} else {current.delete(serviceType);}
  const next = [...current];

  try {
    const { error } = await supabase
      .from('document_templates')
      .update({ default_service_types: next.length ? next : null })
      .eq('id', template.id);

    if (error) {
      checkbox.checked = !nowChecked;
      showToast(`Gagal memperbarui "${template.name}".`, { variant: 'error' });
      return;
    }
    template.default_service_types = next;
    const count = parseInt(countLabel.textContent, 10) + (nowChecked ? 1 : -1);
    countLabel.textContent = `${count} dokumen wajib`;
  } catch {
    checkbox.checked = !nowChecked;
    showToast(`Gagal memperbarui "${template.name}".`, { variant: 'error' });
  } finally {
    checkbox.disabled = false;
  }
}

function buildServiceDocChecklist(row, documentTemplates, canEdit) {
  const details = element('details', 'accordion-item project-setting-service-docs');

  const summary = document.createElement('summary');
  summary.className = 'accordion-summary';
  const countLabel = element('span');
  summary.appendChild(countLabel);
  summary.insertAdjacentHTML('beforeend', '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4"/></svg>');
  details.appendChild(summary);

  const content = element('div', 'accordion-content project-setting-service-doc-checklist');

  let checkedCount = 0;
  let lastCategory = null;
  documentTemplates.forEach((template) => {
    if (template.category !== lastCategory) {
      content.appendChild(element('div', 'project-setting-doc-category-heading', template.category || 'Lainnya'));
      lastCategory = template.category;
    }
    const label = element('label', 'form-check');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const isChecked = (template.default_service_types || []).includes(row.service_type);
    checkbox.checked = isChecked;
    if (isChecked) {checkedCount += 1;}
    checkbox.disabled = !canEdit;
    if (canEdit) {
      checkbox.addEventListener('change', () => toggleDocumentService(checkbox, template, row.service_type, countLabel));
    }
    label.append(checkbox, document.createTextNode(template.name));
    content.appendChild(label);
  });

  countLabel.textContent = `${checkedCount} dokumen wajib`;
  details.appendChild(content);
  return details;
}

function buildServiceTypeRow(row, documentTemplates, canEdit) {
  const item = element('div', 'project-setting-service-item');

  const header = element('div', 'project-setting-service-code-row');
  header.appendChild(element('div', 'project-setting-service-code-name', row.service_type));

  if (canEdit) {
    const input = element('input', 'form-control project-setting-service-code-input');
    input.type = 'text';
    input.value = row.code;
    input.maxLength = SERVICE_CODE_MAX_LENGTH;
    input.setAttribute('aria-label', `Kode untuk ${row.service_type}`);
    input.addEventListener('change', () => saveServiceCode(input, row));
    header.appendChild(input);
  } else {
    header.appendChild(element('div', 'project-setting-service-code-value', row.code));
  }
  item.appendChild(header);

  item.appendChild(buildServiceDocChecklist(row, documentTemplates, canEdit));

  return item;
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
    await loadServiceTypes(root, true);
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

function renderServiceTypes(root, rows, documentTemplates, canEdit) {
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

  const list = element('div', 'project-setting-service-list');
  rows.forEach((row) => list.appendChild(buildServiceTypeRow(row, documentTemplates, canEdit)));
  root.appendChild(list);
  root.setAttribute('aria-busy', 'false');
}

async function loadServiceTypes(root, canEdit) {
  setPanelState(root, 'Memuat jenis layanan…', 'loading');

  try {
    const [codesResult, templatesResult] = await Promise.all([
      supabase
        .from('service_type_codes')
        .select('service_type, code')
        .order('service_type', { ascending: true }),
      supabase
        .from('document_templates')
        .select('id, name, category, default_service_types')
        .order('category', { ascending: true })
        .order('name', { ascending: true })
    ]);

    if (codesResult.error || templatesResult.error) {
      setPanelState(root, 'Gagal memuat daftar jenis layanan.', 'error');
      return;
    }

    renderServiceTypes(root, codesResult.data || [], templatesResult.data || [], canEdit);
  } catch {
    setPanelState(root, 'Gagal memuat daftar jenis layanan.', 'error');
  }
}

// Tabs ("Jenis Dokumen" / "Jenis Layanan" / "Rekening Bank") — same
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
  const documentsRoot = document.getElementById('project-setting-root');
  const serviceTypesRoot = document.getElementById('service-types-root');
  const bankRoot = document.getElementById('bank-accounts-root');
  if ((!documentsRoot && !serviceTypesRoot && !bankRoot) || initialized) {return;}
  initialized = true;

  wireProjectSettingTabs();

  const profile = await getProfile();
  const canEdit = profile?.role === 'admin';
  await Promise.all([
    documentsRoot ? loadDocuments(documentsRoot) : Promise.resolve(),
    serviceTypesRoot ? loadServiceTypes(serviceTypesRoot, canEdit) : Promise.resolve(),
    bankRoot ? loadBankAccounts(bankRoot, canEdit) : Promise.resolve()
  ]);
}
