// SMA-app — Project Setting page: "Jenis Dokumen" / "Jenis Layanan" /
// "Rekening Bank", 3 tabs on one page (production/project_setting.html).
//
// Nav visibility is admin-only (roles: ['admin'] in shell-render.js NAV,
// same mechanism as User Management — see src/lib/auth-guard.js). That's a
// UX convenience, not the security boundary: document_templates /
// document_categories RLS (*_admin_all) is admin-only for insert/update/
// delete, supervisor/internal are SELECT-only. A supervisor/internal who
// reaches this page via direct URL can still see it (RLS allows their
// SELECT) but save controls are hidden for non-admin, since a write from
// them would just fail at the DB level — same "canManageX" UX pattern
// already used in client-quotations.js / client-documents.js / case-form.js.

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

function isUniqueViolation(error) {
  return error?.code === '23505';
}

// ============================================================================
// Jenis Dokumen (Issues #91 + #94) — full CRUD over document_categories
// (id, name unique, order_index) and document_templates (id, name,
// category_id FK). Which documents are required for which service type is
// configured from the Jenis Layanan tab instead (see below) — picking a
// service and then its required documents is the natural admin flow, vs.
// picking a document and then every service that needs it. Reordering
// categories swaps order_index between adjacent rows (two plain updates,
// no RPC/transaction — order_index has no uniqueness constraint so a
// transient collision during the swap is harmless, and the tab always
// reloads from the DB afterward regardless of partial failure).
// ============================================================================

function friendlyCategoryError(error, existing) {
  if (isUniqueViolation(error)) {return 'Nama kategori sudah dipakai.';}
  return existing ? 'Gagal menyimpan kategori.' : 'Gagal menambahkan kategori.';
}

function buildCategoryForm(existing) {
  const form = document.createElement('form');
  form.noValidate = true;

  const group = element('div', 'form-group');
  const label = element('label', 'form-label', 'Nama Kategori');
  label.htmlFor = 'category-name';
  const input = element('input', 'form-control');
  input.id = 'category-name';
  input.name = 'name';
  input.type = 'text';
  input.required = true;
  input.value = existing?.name || '';
  group.append(label, input);
  form.appendChild(group);

  return form;
}

async function submitCategoryForm(ctx, form, root, categories, existing) {
  if (!form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}

  const name = form.elements.namedItem('name').value.trim();
  if (!name) {
    showToast('Nama kategori wajib diisi.', { variant: 'error' });
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';
  try {
    const { error } = existing
      ? await supabase.from('document_categories').update({ name }).eq('id', existing.id)
      : await supabase.from('document_categories').insert({
        name,
        order_index: categories.reduce((max, category) => Math.max(max, category.order_index), 0) + 1
      });

    if (error) {
      showToast(friendlyCategoryError(error, existing), { variant: 'error' });
      return;
    }

    ctx.close();
    showToast(existing ? 'Kategori berhasil diperbarui.' : 'Kategori berhasil ditambahkan.', { variant: 'success' });
    await loadDocumentsTab(root, true);
  } catch {
    showToast(friendlyCategoryError(null, existing), { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = existing ? 'Simpan' : 'Tambah Kategori';
  }
}

function openCategoryModal(root, categories, existing) {
  const form = buildCategoryForm(existing);
  const ctx = showModal({
    title: existing ? 'Edit Kategori' : 'Tambah Kategori',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: existing ? 'Simpan' : 'Tambah Kategori',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitCategoryForm(ctx, form, root, categories, existing);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitCategoryForm(ctx, form, root, categories, existing);
  });
}

async function moveCategory(root, categories, category, direction, trigger) {
  if (trigger?.disabled) {return;}
  const sorted = [...categories].sort((a, b) => a.order_index - b.order_index);
  const index = sorted.findIndex((candidate) => candidate.id === category.id);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= sorted.length) {return;}
  const target = sorted[targetIndex];

  if (trigger) {trigger.disabled = true;}
  try {
    const [a, b] = await Promise.all([
      supabase.from('document_categories').update({ order_index: target.order_index }).eq('id', category.id),
      supabase.from('document_categories').update({ order_index: category.order_index }).eq('id', target.id)
    ]);

    if (a.error || b.error) {
      showToast('Gagal mengubah urutan kategori.', { variant: 'error' });
      await loadDocumentsTab(root, true);
      return;
    }
    await loadDocumentsTab(root, true);
  } catch {
    showToast('Gagal mengubah urutan kategori.', { variant: 'error' });
  } finally {
    if (trigger?.isConnected) {trigger.disabled = false;}
  }
}

function buildDocumentForm(categories, existing, defaultCategoryId) {
  const form = document.createElement('form');
  form.noValidate = true;

  const nameGroup = element('div', 'form-group');
  const nameLabel = element('label', 'form-label', 'Nama Dokumen');
  nameLabel.htmlFor = 'document-name';
  const nameInput = element('input', 'form-control');
  nameInput.id = 'document-name';
  nameInput.name = 'name';
  nameInput.type = 'text';
  nameInput.required = true;
  nameInput.value = existing?.name || '';
  nameGroup.append(nameLabel, nameInput);
  form.appendChild(nameGroup);

  const catGroup = element('div', 'form-group');
  const catLabel = element('label', 'form-label', 'Kategori');
  catLabel.htmlFor = 'document-category';
  const catSelect = document.createElement('select');
  catSelect.className = 'form-control';
  catSelect.id = 'document-category';
  catSelect.name = 'category_id';
  catSelect.required = true;
  const currentCategoryId = existing ? existing.category_id : defaultCategoryId;
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    option.selected = category.id === currentCategoryId;
    catSelect.appendChild(option);
  });
  catGroup.append(catLabel, catSelect);
  form.appendChild(catGroup);

  return form;
}

async function submitDocumentForm(ctx, form, root, existing) {
  if (!form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}

  const name = form.elements.namedItem('name').value.trim();
  const categoryId = form.elements.namedItem('category_id').value;
  if (!name) {
    showToast('Nama dokumen wajib diisi.', { variant: 'error' });
    return;
  }
  if (!categoryId) {
    showToast('Pilih kategori dokumen.', { variant: 'error' });
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';
  try {
    const { error } = existing
      ? await supabase.from('document_templates').update({ name, category_id: categoryId }).eq('id', existing.id)
      : await supabase.from('document_templates').insert({ name, category_id: categoryId });

    if (error) {
      showToast(existing ? 'Gagal menyimpan dokumen.' : 'Gagal menambahkan dokumen.', { variant: 'error' });
      return;
    }

    ctx.close();
    showToast(existing ? 'Dokumen berhasil diperbarui.' : 'Dokumen berhasil ditambahkan.', { variant: 'success' });
    await loadDocumentsTab(root, true);
  } catch {
    showToast(existing ? 'Gagal menyimpan dokumen.' : 'Gagal menambahkan dokumen.', { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = existing ? 'Simpan' : 'Tambah Dokumen';
  }
}

function openDocumentModal(root, categories, existing, defaultCategoryId) {
  const form = buildDocumentForm(categories, existing, defaultCategoryId);
  const ctx = showModal({
    title: existing ? 'Edit Dokumen' : 'Tambah Dokumen',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: existing ? 'Simpan' : 'Tambah Dokumen',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitDocumentForm(ctx, form, root, existing);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitDocumentForm(ctx, form, root, existing);
  });
}

function buildDocumentRow(root, doc, categories, canEdit) {
  const row = element('div', 'project-setting-doc-row');
  row.appendChild(element('span', 'project-setting-doc-row-name', doc.name));

  if (canEdit) {
    const editBtn = element('button', 'btn btn-outline btn-sm', 'Edit');
    editBtn.type = 'button';
    editBtn.addEventListener('click', () => openDocumentModal(root, categories, doc));
    row.appendChild(editBtn);
  }

  return row;
}

function buildCategoryBlock(root, category, documents, categories, canEdit, index, total) {
  const block = element('div', 'project-setting-doc-category-block');

  const header = element('div', 'project-setting-doc-category-block-header');
  header.appendChild(element('div', 'project-setting-doc-category-name', category.name));

  if (canEdit) {
    const actions = element('div', 'project-setting-doc-category-actions');

    const upBtn = element('button', 'btn btn-outline btn-sm', '↑');
    upBtn.type = 'button';
    upBtn.disabled = index === 0;
    upBtn.setAttribute('aria-label', `Pindahkan kategori "${category.name}" ke atas`);
    upBtn.addEventListener('click', () => moveCategory(root, categories, category, -1, upBtn));
    actions.appendChild(upBtn);

    const downBtn = element('button', 'btn btn-outline btn-sm', '↓');
    downBtn.type = 'button';
    downBtn.disabled = index === total - 1;
    downBtn.setAttribute('aria-label', `Pindahkan kategori "${category.name}" ke bawah`);
    downBtn.addEventListener('click', () => moveCategory(root, categories, category, 1, downBtn));
    actions.appendChild(downBtn);

    const editBtn = element('button', 'btn btn-outline btn-sm', 'Edit');
    editBtn.type = 'button';
    editBtn.addEventListener('click', () => openCategoryModal(root, categories, category));
    actions.appendChild(editBtn);

    header.appendChild(actions);
  }
  block.appendChild(header);

  const list = element('div', 'project-setting-doc-list');
  if (documents.length === 0) {
    list.appendChild(element('div', 'project-setting-doc-empty', 'Belum ada dokumen di kategori ini.'));
  } else {
    documents.forEach((doc) => list.appendChild(buildDocumentRow(root, doc, categories, canEdit)));
  }
  block.appendChild(list);

  if (canEdit) {
    const addDocBtn = element('button', 'btn btn-outline btn-sm project-setting-doc-add', '+ Tambah Dokumen');
    addDocBtn.type = 'button';
    addDocBtn.addEventListener('click', () => openDocumentModal(root, categories, null, category.id));
    block.appendChild(addDocBtn);
  }

  return block;
}

function renderDocumentsTab(root, categories, templates, canEdit) {
  root.replaceChildren();

  if (canEdit) {
    const addCatBtn = element('button', 'btn btn-primary btn-sm project-setting-category-add', '+ Tambah Kategori');
    addCatBtn.type = 'button';
    addCatBtn.addEventListener('click', () => openCategoryModal(root, categories, null));
    root.appendChild(addCatBtn);
  }

  if (categories.length === 0) {
    const empty = element('div', 'project-setting-state project-setting-state-empty', 'Belum ada kategori dokumen.');
    empty.setAttribute('role', 'status');
    root.appendChild(empty);
    root.setAttribute('aria-busy', 'false');
    return;
  }

  const byCategory = new Map();
  templates.forEach((doc) => {
    const list = byCategory.get(doc.category_id) || [];
    list.push(doc);
    byCategory.set(doc.category_id, list);
  });

  const list = element('div', 'project-setting-category-list');
  categories.forEach((category, index) => {
    list.appendChild(buildCategoryBlock(root, category, byCategory.get(category.id) || [], categories, canEdit, index, categories.length));
  });
  root.appendChild(list);
  root.setAttribute('aria-busy', 'false');
}

async function loadDocumentsTab(root, canEdit) {
  setPanelState(root, 'Memuat daftar dokumen…', 'loading');

  try {
    const [categoriesResult, templatesResult] = await Promise.all([
      supabase
        .from('document_categories')
        .select('id, name, order_index')
        .order('order_index', { ascending: true }),
      supabase
        .from('document_templates')
        .select('id, name, category_id')
        .order('name', { ascending: true })
    ]);

    if (categoriesResult.error || templatesResult.error) {
      setPanelState(root, 'Gagal memuat daftar dokumen.', 'error');
      return;
    }

    renderDocumentsTab(root, categoriesResult.data || [], templatesResult.data || [], canEdit);
  } catch {
    setPanelState(root, 'Gagal memuat daftar dokumen.', 'error');
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
// Jenis Layanan (Issues #85 + #91 + #94) — per-service-type config: the
// 3-letter code used for quotation numbering (service_type_codes, no id
// column — service_type is the PK, code now has a UNIQUE constraint added
// in 20260824120000_document_categories_and_code_unique.sql) plus a
// checklist of which document_templates are required for that service,
// grouped by document_categories with a per-category search filter (Ray's
// UX feedback: a flat checkbox dump per category wasn't clear enough).
// Checking/unchecking a document updates document_templates.
// default_service_types (add/remove this service_type from that document's
// array) — same column client-quotations.js's RAB document multi-select
// already reads, just written from the service side instead of the
// document side. New service types are created directly from this tab now
// (input service_type name + code) instead of being limited to whatever
// already exists in cases.service_type history — deliberately NOT backed
// by a FK to cases.service_type (Issue #94: existing case data doesn't
// cleanly match, deferred). Same RLS pattern as the other tabs: admin ALL,
// supervisor/internal SELECT-only, no client access
// (service_type_codes_admin_all / _supervisor_select / _internal_select in
// 20260824070000_project_part5-2_rab_formal_schema.sql;
// document_templates_admin_all / document_categories_admin_all — not
// recreated here). service_type_codes is read by generate_quotation_number()
// (unchanged, out of scope) to build the SMA/YYYY-MM/CODE/seq quotation
// number.
// ============================================================================

const SERVICE_CODE_MAX_LENGTH = 3;

function isValidServiceCode(value) {
  return value.length > 0 && value.length <= SERVICE_CODE_MAX_LENGTH;
}

function friendlyServiceCodeError(error, { serviceType, code, isNewServiceType }) {
  if (isUniqueViolation(error)) {
    if (error.message?.includes('service_type_codes_code_unique')) {
      return `Kode "${code}" sudah dipakai jenis layanan lain.`;
    }
    if (isNewServiceType) {return `Jenis layanan "${serviceType}" sudah ada.`;}
  }
  return isNewServiceType
    ? `Gagal menambahkan jenis layanan "${serviceType}".`
    : `Gagal menyimpan kode "${serviceType}".`;
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
      showToast(
        friendlyServiceCodeError(error, { serviceType: row.service_type, code: value, isNewServiceType: false }),
        { variant: 'error' }
      );
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

function filterChecklist(listEl, query) {
  const q = query.trim().toLowerCase();
  listEl.querySelectorAll('.form-check').forEach((label) => {
    label.hidden = q.length > 0 && !label.dataset.docName.includes(q);
  });
}

function buildDocChecklistSection(row, category, documents, canEdit, onToggle) {
  const section = element('div', 'project-setting-doc-checklist-section');

  const header = element('div', 'project-setting-doc-checklist-section-header');
  header.appendChild(element('span', 'project-setting-doc-checklist-section-title', category.name));

  const searchBox = element('div', 'search-box project-setting-doc-checklist-search');
  searchBox.insertAdjacentHTML('afterbegin', '<svg class="s-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>');
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Cari dokumen…';
  searchInput.setAttribute('aria-label', `Cari dokumen di kategori ${category.name}`);
  searchBox.appendChild(searchInput);
  header.appendChild(searchBox);
  section.appendChild(header);

  const list = element('div', 'project-setting-doc-checklist-list');
  if (documents.length === 0) {
    list.appendChild(element('div', 'project-setting-doc-checklist-empty', 'Belum ada dokumen di kategori ini.'));
  } else {
    documents.forEach((template) => {
      const label = element('label', 'form-check');
      label.dataset.docName = template.name.toLowerCase();
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = (template.default_service_types || []).includes(row.service_type);
      checkbox.disabled = !canEdit;
      if (canEdit) {
        checkbox.addEventListener('change', () => onToggle(checkbox, template));
      }
      label.append(checkbox, document.createTextNode(template.name));
      list.appendChild(label);
    });
  }
  section.appendChild(list);

  searchInput.addEventListener('input', () => filterChecklist(list, searchInput.value));

  return section;
}

function buildServiceDocChecklist(row, categories, documentsByCategory, canEdit) {
  const details = element('details', 'accordion-item project-setting-service-docs');

  const summary = document.createElement('summary');
  summary.className = 'accordion-summary';
  const countLabel = element('span');
  summary.appendChild(countLabel);
  summary.insertAdjacentHTML('beforeend', '<svg class="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6l4 4 4-4"/></svg>');
  details.appendChild(summary);

  const content = element('div', 'accordion-content project-setting-service-doc-checklist');

  let checkedCount = 0;
  categories.forEach((category) => {
    const documents = documentsByCategory.get(category.id) || [];
    documents.forEach((template) => {
      if ((template.default_service_types || []).includes(row.service_type)) {checkedCount += 1;}
    });
    content.appendChild(buildDocChecklistSection(
      row,
      category,
      documents,
      canEdit,
      (checkbox, template) => toggleDocumentService(checkbox, template, row.service_type, countLabel)
    ));
  });

  countLabel.textContent = `${checkedCount} dokumen wajib`;
  details.appendChild(content);
  return details;
}

function buildServiceTypeRow(row, categories, documentsByCategory, canEdit) {
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

  item.appendChild(buildServiceDocChecklist(row, categories, documentsByCategory, canEdit));

  return item;
}

function buildAddServiceTypeForm() {
  const form = document.createElement('form');
  form.id = 'service-type-form';
  form.noValidate = true;

  const typeGroup = element('div', 'form-group');
  const typeLabel = element('label', 'form-label', 'Nama Jenis Layanan');
  typeLabel.htmlFor = 'service-type-name';
  const typeInput = element('input', 'form-control');
  typeInput.id = 'service-type-name';
  typeInput.name = 'service_type';
  typeInput.type = 'text';
  typeInput.required = true;
  typeGroup.append(typeLabel, typeInput);
  form.appendChild(typeGroup);

  const codeGroup = element('div', 'form-group');
  const codeLabel = element('label', 'form-label', 'Kode');
  codeLabel.htmlFor = 'service-type-code';
  const codeInput = element('input', 'form-control');
  codeInput.id = 'service-type-code';
  codeInput.name = 'code';
  codeInput.type = 'text';
  codeInput.required = true;
  codeInput.maxLength = SERVICE_CODE_MAX_LENGTH;
  codeGroup.append(codeLabel, codeInput);
  form.appendChild(codeGroup);

  return form;
}

async function submitAddServiceType(ctx, form, root) {
  if (!form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}

  const serviceType = form.elements.namedItem('service_type').value.trim();
  const code = form.elements.namedItem('code').value.trim().toUpperCase();

  if (!serviceType) {
    showToast('Nama jenis layanan wajib diisi.', { variant: 'error' });
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
      showToast(friendlyServiceCodeError(error, { serviceType, code, isNewServiceType: true }), { variant: 'error' });
      return;
    }

    ctx.close();
    showToast(`Jenis layanan "${serviceType}" berhasil ditambahkan.`, { variant: 'success' });
    await loadServiceTypes(root, true);
  } catch {
    showToast(`Gagal menambahkan jenis layanan "${serviceType}".`, { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Tambah Layanan';
  }
}

function openAddServiceTypeModal(root) {
  const form = buildAddServiceTypeForm();
  const ctx = showModal({
    title: 'Tambah Jenis Layanan',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Tambah Layanan',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitAddServiceType(ctx, form, root);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitAddServiceType(ctx, form, root);
  });
}

function renderServiceTypes(root, rows, categories, templates, canEdit) {
  root.replaceChildren();

  if (canEdit) {
    const addBtn = element('button', 'btn btn-primary btn-sm project-setting-service-code-add', '+ Tambah Layanan');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => openAddServiceTypeModal(root));
    root.appendChild(addBtn);
  }

  if (rows.length === 0) {
    const empty = element('div', 'project-setting-state project-setting-state-empty', 'Belum ada jenis layanan.');
    empty.setAttribute('role', 'status');
    root.appendChild(empty);
    root.setAttribute('aria-busy', 'false');
    return;
  }

  const documentsByCategory = new Map();
  templates.forEach((template) => {
    const list = documentsByCategory.get(template.category_id) || [];
    list.push(template);
    documentsByCategory.set(template.category_id, list);
  });

  const list = element('div', 'project-setting-service-list');
  rows.forEach((row) => list.appendChild(buildServiceTypeRow(row, categories, documentsByCategory, canEdit)));
  root.appendChild(list);
  root.setAttribute('aria-busy', 'false');
}

async function loadServiceTypes(root, canEdit) {
  setPanelState(root, 'Memuat jenis layanan…', 'loading');

  try {
    const [codesResult, categoriesResult, templatesResult] = await Promise.all([
      supabase
        .from('service_type_codes')
        .select('service_type, code')
        .order('service_type', { ascending: true }),
      supabase
        .from('document_categories')
        .select('id, name, order_index')
        .order('order_index', { ascending: true }),
      supabase
        .from('document_templates')
        .select('id, name, category_id, default_service_types')
        .order('name', { ascending: true })
    ]);

    if (codesResult.error || categoriesResult.error || templatesResult.error) {
      setPanelState(root, 'Gagal memuat daftar jenis layanan.', 'error');
      return;
    }

    renderServiceTypes(root, codesResult.data || [], categoriesResult.data || [], templatesResult.data || [], canEdit);
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
    documentsRoot ? loadDocumentsTab(documentsRoot, canEdit) : Promise.resolve(),
    serviceTypesRoot ? loadServiceTypes(serviceTypesRoot, canEdit) : Promise.resolve(),
    bankRoot ? loadBankAccounts(bankRoot, canEdit) : Promise.resolve()
  ]);
}
