// SMA-app — Documents tab on Client Detail.
// Lists document checklists per project, adds manual-link checklist items,
// and writes an activity entry for every successful status change.

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { openMenu } from './menus.js';
import { showToast } from './toast.js';

const DOCUMENT_STATUSES = ['Belum', 'Upload', 'Terverifikasi', 'Ditolak'];
const STATUS_CLASS = {
  Belum: 'client-document-status-belum',
  Upload: 'status-blue',
  Terverifikasi: 'status-green',
  Ditolak: 'status-red'
};
// Terverifikasi/Ditolak are manual staff decisions after reviewing the file —
// auto-sync from file_url presence must never override them.
// NOTE: this admin/internal-side document link editing may need reconciling
// with the client-facing document upload flow once the Client Self-Service
// Portal (roadmap #8) is built — check for duplicated logic or RLS conflicts
// when that lands.
const LOCKED_STATUSES = ['Terverifikasi', 'Ditolak'];

function deriveAutoStatus(currentStatus, fileUrl) {
  if (LOCKED_STATUSES.includes(currentStatus)) {return currentStatus;}
  return fileUrl ? 'Upload' : 'Belum';
}

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

let initialized = false;
let activeClientId = '';
let currentProfile = null;
let projects = [];
let canManageDocuments = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined) {node.textContent = text;}
  return node;
}

function setPanelState(root, message, state) {
  root.replaceChildren();
  const status = element('div', `client-documents-state client-documents-state-${state}`, message);
  status.setAttribute('role', state === 'error' ? 'alert' : 'status');
  root.appendChild(status);
  root.dataset.state = state;
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function safeFileUrl(value) {
  if (!value) {return null;}
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function createFileLink(documentRow) {
  const url = safeFileUrl(documentRow.file_url);
  if (!documentRow.file_url) {return element('span', 'client-document-file-empty', 'Belum ada link');}
  if (!url) {return element('span', 'client-document-file-invalid', 'Link tidak valid');}

  const link = element('a', 'client-document-file-link', 'Buka file');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function createEditLinkButton(documentRow) {
  const button = element('button', 'btn btn-outline btn-sm client-document-edit-link', 'Edit Link');
  button.type = 'button';
  button.dataset.editDocumentLink = '';
  button.dataset.documentId = documentRow.id;
  button.dataset.caseId = documentRow.case_id;
  button.dataset.documentName = documentRow.name;
  button.dataset.fileUrl = documentRow.file_url || '';
  button.dataset.status = documentRow.status;
  button.setAttribute('aria-label', `Edit link dokumen ${documentRow.name}`);
  return button;
}

function createStatusButton(documentRow) {
  const button = element('button', `status client-document-status ${STATUS_CLASS[documentRow.status] || ''}`, documentRow.status);
  button.type = 'button';
  button.dataset.documentStatusTrigger = '';
  button.dataset.documentId = documentRow.id;
  button.dataset.caseId = documentRow.case_id;
  button.dataset.documentName = documentRow.name;
  button.dataset.status = documentRow.status;
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', `Ubah status ${documentRow.name}`);
  return button;
}

function createDocumentRow(documentRow) {
  const row = element('li', 'client-document-row');
  const info = element('div', 'client-document-info');
  info.appendChild(element('div', 'client-document-name', documentRow.name));
  const createdAt = new Date(documentRow.created_at);
  info.appendChild(element(
    'div',
    'client-document-meta',
    Number.isNaN(createdAt.getTime()) ? 'Tanggal tidak tersedia' : `Ditambahkan ${dateFmt.format(createdAt)}`
  ));

  const actions = element('div', 'client-document-actions');
  actions.appendChild(createFileLink(documentRow));
  actions.appendChild(createEditLinkButton(documentRow));
  actions.appendChild(createStatusButton(documentRow));
  row.append(info, actions);
  return row;
}

function createProjectGroup(project, documents) {
  const group = element('article', 'client-document-project');
  const header = element('div', 'client-document-project-header');
  const heading = element('div');
  heading.appendChild(element('h2', '', project.service_type));

  const createdAt = new Date(project.created_at);
  heading.appendChild(element(
    'div',
    'client-document-project-meta',
    Number.isNaN(createdAt.getTime()) ? 'Tanggal project tidak tersedia' : `Project dibuat ${dateFmt.format(createdAt)}`
  ));

  const addButton = element('button', 'btn btn-outline btn-sm', '+ Tambah Dokumen');
  addButton.type = 'button';
  addButton.dataset.addDocument = '';
  addButton.dataset.caseId = project.id;
  addButton.dataset.projectName = project.service_type;
  header.append(heading, addButton);
  group.appendChild(header);

  if (documents.length === 0) {
    group.appendChild(element('div', 'client-document-empty', 'Belum ada dokumen untuk project ini.'));
    return group;
  }

  const list = element('ul', 'client-document-list');
  documents.forEach((documentRow) => list.appendChild(createDocumentRow(documentRow)));
  group.appendChild(list);
  return group;
}

function renderDocuments(root, documentRows) {
  root.replaceChildren();
  const rowsByCase = new Map();
  documentRows.forEach((row) => {
    const rows = rowsByCase.get(row.case_id) || [];
    rows.push(row);
    rowsByCase.set(row.case_id, rows);
  });

  const list = element('div', 'client-document-project-list');
  projects.forEach((project) => {
    list.appendChild(createProjectGroup(project, rowsByCase.get(project.id) || []));
  });
  root.appendChild(list);
  root.dataset.state = 'ready';
  root.setAttribute('aria-busy', 'false');
}

async function loadDocuments(root) {
  setPanelState(root, 'Memuat checklist dokumen…', 'loading');

  try {
    const { data: caseRows, error: caseError } = await supabase
      .from('cases')
      .select('id, client_id, service_type, created_at')
      .eq('client_id', activeClientId)
      .order('created_at', { ascending: false });

    if (caseError) {
      setPanelState(root, 'Gagal memuat daftar project.', 'error');
      return;
    }

    projects = caseRows || [];
    if (projects.length === 0) {
      setPanelState(root, 'Client ini belum memiliki project.', 'empty');
      return;
    }

    const { data: documentRows, error: documentError } = await supabase
      .from('documents')
      .select('id, case_id, name, status, file_url, created_at')
      .in('case_id', projects.map((project) => project.id))
      .order('created_at', { ascending: true });

    if (documentError) {
      setPanelState(root, 'Gagal memuat checklist dokumen.', 'error');
      return;
    }

    renderDocuments(root, documentRows || []);
  } catch {
    setPanelState(root, 'Gagal memuat checklist dokumen.', 'error');
  }
}

function buildDocumentForm(projectName) {
  const form = document.createElement('form');
  form.id = 'document-form';
  form.noValidate = true;

  const context = element('div', 'client-document-form-context');
  context.appendChild(element('span', '', 'Project'));
  context.appendChild(element('strong', '', projectName));

  const nameGroup = element('div', 'form-group');
  const nameLabel = element('label', 'form-label', 'Nama dokumen');
  nameLabel.htmlFor = 'document-name';
  const required = element('span', 'required', ' *');
  nameLabel.appendChild(required);
  const nameInput = element('input', 'form-control');
  nameInput.id = 'document-name';
  nameInput.name = 'name';
  nameInput.type = 'text';
  nameInput.required = true;
  nameGroup.append(nameLabel, nameInput);

  const urlGroup = element('div', 'form-group');
  const urlLabel = element('label', 'form-label', 'Link file');
  urlLabel.htmlFor = 'document-file-url';
  const urlInput = element('input', 'form-control');
  urlInput.id = 'document-file-url';
  urlInput.name = 'file_url';
  urlInput.type = 'url';
  urlInput.placeholder = 'Tempel link file';
  const help = element('div', 'form-help', 'Opsional. Gunakan link Google Drive atau penyimpanan lainnya.');
  urlGroup.append(urlLabel, urlInput, help);

  form.append(context, nameGroup, urlGroup);
  return form;
}

async function submitDocument(ctx, form, root, caseId) {
  if (!canManageDocuments) {return;}
  if (!form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}
  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';

  const name = form.elements.namedItem('name').value.trim();
  const fileUrl = form.elements.namedItem('file_url').value.trim();
  const normalizedFileUrl = safeFileUrl(fileUrl);
  if (fileUrl && !normalizedFileUrl) {
    showToast('Link file harus menggunakan http atau https.', { variant: 'error' });
    submitButton.disabled = false;
    submitButton.textContent = 'Tambah Dokumen';
    return;
  }

  try {
    const { error } = await supabase
      .from('documents')
      .insert({
        case_id: caseId,
        name,
        status: deriveAutoStatus('Belum', normalizedFileUrl),
        file_url: normalizedFileUrl
      });

    if (error) {
      showToast('Gagal menambahkan dokumen.', { variant: 'error' });
      return;
    }

    ctx.close();
    showToast('Dokumen berhasil ditambahkan.', { variant: 'success' });
    await loadDocuments(root);
  } catch {
    showToast('Gagal menambahkan dokumen.', { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Tambah Dokumen';
  }
}

function openAddDocumentModal(root, trigger) {
  if (!canManageDocuments) {return;}
  const projectName = trigger.dataset.projectName;
  const caseId = trigger.dataset.caseId;
  if (!projects.some((project) => project.id === caseId)) {
    showToast('Project tidak ditemukan.', { variant: 'error' });
    return;
  }
  const form = buildDocumentForm(projectName);

  const ctx = showModal({
    title: 'Tambah Dokumen',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Tambah Dokumen',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitDocument(ctx, form, root, caseId);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitDocument(ctx, form, root, caseId);
  });
}

async function insertStatusActivity({ caseId, documentName, oldStatus, newStatus, automatic = false }) {
  if (!currentProfile?.id) {return { error: new Error('Profil pengguna tidak tersedia') };}
  const suffix = automatic ? ' (otomatis mengikuti keberadaan link file)' : '';
  return supabase
    .from('activities')
    .insert({
      client_id: activeClientId,
      case_id: caseId,
      type: 'Status Dokumen',
      notes: `Status dokumen "${documentName}" diubah dari ${oldStatus} menjadi ${newStatus}.${suffix}`,
      by_user: currentProfile.id
    });
}

async function rollbackDocumentStatus(documentId, caseId, changedStatus, oldStatus) {
  return supabase
    .from('documents')
    .update({ status: oldStatus }, { count: 'exact' })
    .eq('id', documentId)
    .eq('case_id', caseId)
    .eq('status', changedStatus);
}

async function rollbackDocumentEdit(documentId, caseId, changedStatus, oldStatus, oldFileUrl) {
  return supabase
    .from('documents')
    .update({ status: oldStatus, file_url: oldFileUrl }, { count: 'exact' })
    .eq('id', documentId)
    .eq('case_id', caseId)
    .eq('status', changedStatus);
}

function buildEditLinkForm(documentName, currentFileUrl) {
  const form = document.createElement('form');
  form.id = 'edit-document-link-form';
  form.noValidate = true;

  const context = element('div', 'client-document-form-context');
  context.appendChild(element('span', '', 'Dokumen'));
  context.appendChild(element('strong', '', documentName));

  const urlGroup = element('div', 'form-group');
  const urlLabel = element('label', 'form-label', 'Link file');
  urlLabel.htmlFor = 'edit-document-file-url';
  const urlInput = element('input', 'form-control');
  urlInput.id = 'edit-document-file-url';
  urlInput.name = 'file_url';
  urlInput.type = 'url';
  urlInput.placeholder = 'Tempel link file';
  urlInput.value = currentFileUrl || '';
  const help = element(
    'div',
    'form-help',
    'Kosongkan untuk menghapus link. Status Belum/Upload mengikuti otomatis; Terverifikasi/Ditolak tidak berubah.'
  );
  urlGroup.append(urlLabel, urlInput, help);

  form.append(context, urlGroup);
  return form;
}

async function submitEditLink(ctx, form, root, { documentId, caseId, documentName, oldStatus, oldFileUrl }) {
  if (!canManageDocuments) {return;}
  if (!form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}
  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';

  const fileUrl = form.elements.namedItem('file_url').value.trim();
  const normalizedFileUrl = safeFileUrl(fileUrl);
  if (fileUrl && !normalizedFileUrl) {
    showToast('Link file harus menggunakan http atau https.', { variant: 'error' });
    submitButton.disabled = false;
    submitButton.textContent = 'Simpan';
    return;
  }

  const newStatus = deriveAutoStatus(oldStatus, normalizedFileUrl);

  try {
    const { error: updateError, count: updatedCount } = await supabase
      .from('documents')
      .update({ file_url: normalizedFileUrl, status: newStatus }, { count: 'exact' })
      .eq('id', documentId)
      .eq('case_id', caseId)
      .eq('status', oldStatus);

    if (updateError || updatedCount !== 1) {
      showToast('Gagal memperbarui link dokumen.', { variant: 'error' });
      await loadDocuments(root);
      return;
    }

    if (newStatus !== oldStatus) {
      const { error: activityError } = await insertStatusActivity({
        caseId,
        documentName,
        oldStatus,
        newStatus,
        automatic: true
      });

      if (activityError) {
        const { error: rollbackError, count: rollbackCount } = await rollbackDocumentEdit(
          documentId,
          caseId,
          newStatus,
          oldStatus,
          oldFileUrl
        );
        if (rollbackError || rollbackCount !== 1) {
          showToast('Link berubah, tetapi aktivitas gagal dicatat. Hubungi admin.', { variant: 'error', duration: 5000 });
        } else {
          showToast('Perubahan dibatalkan karena aktivitas gagal dicatat.', { variant: 'error' });
        }
        await loadDocuments(root);
        return;
      }
    }

    ctx.close();
    showToast('Link dokumen berhasil diperbarui.', { variant: 'success' });
    await loadDocuments(root);
  } catch {
    showToast('Gagal memperbarui link dokumen.', { variant: 'error' });
    await loadDocuments(root);
  } finally {
    if (submitButton.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = 'Simpan';
    }
  }
}

// NOTE: this is the admin/internal "Edit Link" path — reconcile with the
// client-facing document upload flow once the Client Self-Service Portal
// (roadmap #8) is built (duplicated logic or RLS conflicts on file_url/status).
function openEditLinkModal(root, trigger) {
  if (!canManageDocuments) {return;}
  const documentId = trigger.dataset.documentId;
  const caseId = trigger.dataset.caseId;
  const documentName = trigger.dataset.documentName;
  const oldFileUrl = trigger.dataset.fileUrl || '';
  const oldStatus = trigger.dataset.status;
  const form = buildEditLinkForm(documentName, oldFileUrl);
  const context = { documentId, caseId, documentName, oldStatus, oldFileUrl };

  const ctx = showModal({
    title: 'Edit Link Dokumen',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Simpan',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitEditLink(ctx, form, root, context);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitEditLink(ctx, form, root, context);
  });
}

async function updateDocumentStatus(root, trigger, newStatus) {
  if (!canManageDocuments || trigger.disabled) {return;}
  const documentId = trigger.dataset.documentId;
  const caseId = trigger.dataset.caseId;
  const documentName = trigger.dataset.documentName;
  const oldStatus = trigger.dataset.status;
  trigger.disabled = true;

  try {
    const { error: updateError, count: updatedCount } = await supabase
      .from('documents')
      .update({ status: newStatus }, { count: 'exact' })
      .eq('id', documentId)
      .eq('case_id', caseId)
      .eq('status', oldStatus);

    if (updateError || updatedCount !== 1) {
      showToast('Gagal mengubah status dokumen.', { variant: 'error' });
      await loadDocuments(root);
      return;
    }

    const { error: activityError } = await insertStatusActivity({
      caseId,
      documentName,
      oldStatus,
      newStatus
    });

    if (activityError) {
      const { error: rollbackError, count: rollbackCount } = await rollbackDocumentStatus(
        documentId,
        caseId,
        newStatus,
        oldStatus
      );
      if (rollbackError || rollbackCount !== 1) {
        showToast('Status berubah, tetapi aktivitas gagal dicatat. Hubungi admin.', { variant: 'error', duration: 5000 });
      } else {
        showToast('Perubahan dibatalkan karena aktivitas gagal dicatat.', { variant: 'error' });
      }
      await loadDocuments(root);
      return;
    }

    showToast('Status dokumen berhasil diubah.', { variant: 'success' });
    await loadDocuments(root);
  } catch {
    showToast('Gagal mengubah status dokumen.', { variant: 'error' });
    await loadDocuments(root);
  } finally {
    if (trigger.isConnected) {trigger.disabled = false;}
  }
}

function openStatusMenu(root, trigger) {
  if (!canManageDocuments || trigger.disabled) {return;}
  const currentStatus = trigger.dataset.status;
  openMenu(trigger, DOCUMENT_STATUSES.map((status) => ({
    label: status === currentStatus ? `${status} ✓` : status,
    action: () => {
      if (status !== currentStatus) {updateDocumentStatus(root, trigger, status);}
    }
  })));
}

function wireActions(root) {
  root.addEventListener('click', (event) => {
    const addTrigger = event.target.closest('[data-add-document]');
    if (addTrigger) {
      openAddDocumentModal(root, addTrigger);
      return;
    }

    const editLinkTrigger = event.target.closest('[data-edit-document-link]');
    if (editLinkTrigger) {
      openEditLinkModal(root, editLinkTrigger);
      return;
    }

    const statusTrigger = event.target.closest('[data-document-status-trigger]');
    if (statusTrigger) {openStatusMenu(root, statusTrigger);}
  });
}

export async function initClientDocuments({ clientId, profile } = {}) {
  const root = document.getElementById('client-documents-root');
  if (!root || initialized) {return;}
  initialized = true;
  activeClientId = clientId || '';
  currentProfile = profile || null;
  canManageDocuments = ['admin', 'internal'].includes(currentProfile?.role);
  if (!canManageDocuments) {
    setPanelState(root, 'Anda tidak memiliki akses ke dokumen client.', 'error');
    return;
  }
  wireActions(root);
  await loadDocuments(root);
}
