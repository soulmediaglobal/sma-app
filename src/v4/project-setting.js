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

let initialized = false;

export async function initProjectSetting() {
  const root = document.getElementById('project-setting-root');
  if (!root || initialized) {return;}
  initialized = true;

  const profile = await getProfile();
  const canEdit = profile?.role === 'admin';
  await loadTemplates(root, canEdit);
}
