import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

const BUCKET = 'client-application-documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Map([
  ['application/pdf', { label: 'PDF', extension: 'pdf' }],
  ['image/jpeg', { label: 'JPEG', extension: 'jpg' }],
  ['image/png', { label: 'PNG', extension: 'png' }]
]);
const EDITABLE_STATUSES = new Set(['DRAFT', 'REVISION_REQUIRED']);
const DOCUMENT_FIELDS = [
  'id',
  'application_id',
  'file_name',
  'storage_path',
  'mime_type',
  'file_size_bytes',
  'created_at'
].join(', ');
const instances = new WeakMap();
const sizeFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

function formatFileSize(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) {
    return 'Ukuran tidak tersedia';
  }
  const value = Number(bytes);
  if (value >= 1024 * 1024) {
    return `${sizeFormatter.format(value / (1024 * 1024))} MB`;
  }
  return `${sizeFormatter.format(value / 1024)} KB`;
}

function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return 'Gunakan file PDF, JPG/JPEG, atau PNG.';
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return 'Ukuran setiap file harus lebih dari 0 dan maksimal 10 MB.';
  }
  return null;
}

function createDocumentRow(documentApi, editable, handlers) {
  const row = documentApi.createElement('article');
  row.className = 'client-application-document-row';
  const details = documentApi.createElement('div');
  details.className = 'client-application-document-details';
  const name = documentApi.createElement('strong');
  name.textContent = handlers.item.file_name;
  const meta = documentApi.createElement('span');
  const type = ALLOWED_MIME_TYPES.get(handlers.item.mime_type)?.label || 'Dokumen';
  meta.textContent = `${type} · ${formatFileSize(handlers.item.file_size_bytes)}`;
  details.append(name, meta);

  const actions = documentApi.createElement('div');
  actions.className = 'client-application-document-actions';
  const viewButton = documentApi.createElement('button');
  viewButton.type = 'button';
  viewButton.className = 'client-auth-secondary';
  viewButton.textContent = 'Lihat / unduh';
  viewButton.setAttribute('aria-label', `Lihat atau unduh ${handlers.item.file_name}`);
  viewButton.addEventListener('click', handlers.onView);
  actions.appendChild(viewButton);

  if (editable) {
    const deleteButton = documentApi.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'client-auth-secondary client-application-document-delete';
    deleteButton.textContent = 'Hapus';
    deleteButton.setAttribute('aria-label', `Hapus ${handlers.item.file_name}`);
    deleteButton.addEventListener('click', handlers.onDelete);
    actions.appendChild(deleteButton);
  }
  row.append(details, actions);
  return row;
}

export function initClientApplicationDocuments(root) {
  if (instances.has(root)) {
    return instances.get(root);
  }

  const panel = root.querySelector('[data-application-documents]');
  const uploadControl = root.querySelector('[data-document-upload-control]');
  const uploadLabel = root.querySelector('[data-document-upload-label]');
  const input = root.querySelector('[data-document-input]');
  const notice = root.querySelector('[data-document-notice]');
  const progress = root.querySelector('[data-document-progress]');
  const list = root.querySelector('[data-document-list]');

  let profile = null;
  let application = null;
  let documents = [];
  let mutationPending = false;
  let formPending = false;
  let viewPending = false;
  let activeRefreshes = 0;
  let contextVersion = 0;
  let queuedContext = null;

  function isEditable() {
    return Boolean(application && EDITABLE_STATUSES.has(application.status));
  }

  function updateBusyUi(text = '') {
    const busy = mutationPending || activeRefreshes > 0;
    panel.setAttribute('aria-busy', String(busy));
    input.disabled = mutationPending || formPending || !isEditable();
    uploadControl.classList.toggle('is-disabled', input.disabled);
    uploadLabel.textContent = mutationPending && text ? text : 'Pilih dokumen';
    progress.hidden = !mutationPending;
    progress.textContent = mutationPending ? text : '';
  }

  function setMutationPending(value, text = '') {
    mutationPending = value;
    updateBusyUi(text);
  }

  function render() {
    list.replaceChildren();
    if (!application) {
      notice.textContent = 'Simpan draft terlebih dahulu untuk mengunggah dokumen.';
      uploadControl.hidden = true;
      return;
    }
    const editable = isEditable();
    notice.textContent = editable
      ? 'PDF, JPG/JPEG, atau PNG. Maksimal 10 MB per file.'
      : 'Dokumen ditampilkan sebagai arsip dan tidak dapat diubah setelah pengajuan dikirim.';
    uploadControl.hidden = !editable;
    updateBusyUi();

    if (!documents.length) {
      const empty = document.createElement('p');
      empty.className = 'client-application-document-empty';
      empty.textContent = editable
        ? 'Belum ada dokumen pendukung. Kamu tetap dapat mengirim pengajuan tanpa dokumen.'
        : 'Tidak ada dokumen pendukung pada pengajuan ini.';
      list.appendChild(empty);
      return;
    }
    documents.forEach(item => {
      list.appendChild(
        createDocumentRow(document, editable, {
          item,
          onView: () => viewDocument(item),
          onDelete: () => confirmDelete(item)
        })
      );
    });
  }

  function renderLoadFailure() {
    list.replaceChildren();
    const failure = document.createElement('p');
    failure.className = 'client-application-document-empty';
    failure.textContent = 'Dokumen belum dapat dimuat.';
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'client-auth-secondary';
    retryButton.textContent = 'Coba lagi';
    retryButton.addEventListener('click', () => {
      loadDocuments().catch(() => {});
    });
    list.append(failure, retryButton);
  }

  async function loadDocuments(version = contextVersion) {
    if (!application) {
      documents = [];
      render();
      return true;
    }
    list.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'client-application-document-empty';
    loading.textContent = 'Memuat dokumen…';
    list.appendChild(loading);

    const applicationId = application.id;
    activeRefreshes += 1;
    updateBusyUi();
    try {
      const { data, error } = await supabase
        .from('client_application_documents')
        .select(DOCUMENT_FIELDS)
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });
      if (version !== contextVersion || application?.id !== applicationId) {
        return false;
      }
      if (error) {
        renderLoadFailure();
        return false;
      }
      documents = data || [];
      render();
      return true;
    } catch {
      if (version === contextVersion && application?.id === applicationId) {
        renderLoadFailure();
      }
      return false;
    } finally {
      activeRefreshes = Math.max(0, activeRefreshes - 1);
      updateBusyUi();
    }
  }

  function applyHiddenContext() {
    contextVersion += 1;
    panel.hidden = true;
    application = null;
    documents = [];
    updateBusyUi();
  }

  async function applyContext(nextProfile, nextApplication) {
    contextVersion += 1;
    const version = contextVersion;
    profile = nextProfile;
    application = nextApplication;
    documents = [];
    panel.hidden = false;
    render();
    return loadDocuments(version);
  }

  async function refreshOrApplyQueuedContext() {
    if (queuedContext) {
      const nextContext = queuedContext;
      queuedContext = null;
      if (nextContext.hidden) {
        applyHiddenContext();
        return true;
      }
      return applyContext(nextContext.profile, nextContext.application);
    }
    return loadDocuments();
  }

  async function viewDocument(item) {
    if (viewPending || item.application_id !== application?.id) {
      return;
    }
    viewPending = true;
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(item.storage_path, 60);
      if (error || !data?.signedUrl) {
        showToast('Dokumen belum dapat dibuka. Silakan coba lagi.', { variant: 'error' });
        return;
      }
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch {
      showToast('Dokumen belum dapat dibuka. Silakan coba lagi.', { variant: 'error' });
    } finally {
      viewPending = false;
    }
  }

  async function verifyMetadata(operation, storagePath) {
    try {
      const { data, error } = await supabase
        .from('client_application_documents')
        .select('id')
        .eq('storage_path', storagePath)
        .eq('application_id', operation.applicationId)
        .eq('uploaded_by_profile_id', operation.profileId)
        .maybeSingle();
      if (error) {
        return { known: false, exists: false };
      }
      return { known: true, exists: Boolean(data) };
    } catch {
      return { known: false, exists: false };
    }
  }

  async function uploadFile(file, operation) {
    const type = ALLOWED_MIME_TYPES.get(file.type);
    const storagePath = `${operation.profileId}/${operation.applicationId}/${crypto.randomUUID()}.${type.extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    });
    if (uploadError) {
      return { ok: false, partial: true, uncertain: true };
    }

    const { error: metadataError } = await supabase.from('client_application_documents').insert({
      application_id: operation.applicationId,
      category: 'SUPPORTING',
      file_name: file.name.trim() || `Dokumen.${type.extension}`,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      uploaded_by_profile_id: operation.profileId
    });
    if (!metadataError) {
      return { ok: true, partial: false, uncertain: false };
    }

    const verification = await verifyMetadata(operation, storagePath);
    if (!verification.known) {
      return { ok: false, partial: true, uncertain: true };
    }
    if (verification.exists) {
      return { ok: true, partial: false, uncertain: false };
    }
    try {
      const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([storagePath]);
      return { ok: false, partial: Boolean(cleanupError), uncertain: false };
    } catch {
      return { ok: false, partial: true, uncertain: false };
    }
  }

  async function handleFiles() {
    if (mutationPending || formPending || !profile || !application || !isEditable()) {
      input.value = '';
      if (mutationPending || formPending) {
        showToast('Tunggu proses dokumen selesai terlebih dahulu.', { variant: 'info' });
      }
      return;
    }
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) {
      return;
    }
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        showToast(`${file.name}: ${validationError}`, { variant: 'error', duration: 5000 });
        return;
      }
    }

    const operation = { profileId: profile.id, applicationId: application.id };
    setMutationPending(true, `Mengunggah 1 dari ${files.length}…`);
    let partialFailure = false;
    let uncertainFailure = false;
    let successfulUploads = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        setMutationPending(true, `Mengunggah ${index + 1} dari ${files.length}…`);
        const result = await uploadFile(files[index], operation);
        if (!result.ok) {
          partialFailure = result.partial;
          uncertainFailure = result.uncertain;
          break;
        }
        successfulUploads += 1;
      }
    } catch {
      partialFailure = true;
    } finally {
      setMutationPending(false);
    }

    await refreshOrApplyQueuedContext();
    if (successfulUploads === files.length) {
      showToast('Dokumen berhasil ditambahkan.', { variant: 'success' });
      return;
    }
    showToast(
      uncertainFailure
        ? 'Status upload belum dapat dipastikan. Muat ulang sebelum mencoba lagi.'
        : partialFailure
          ? 'Upload tidak selesai sepenuhnya. Muat ulang atau hubungi Tim SMA.'
          : 'Sebagian atau seluruh dokumen belum dapat diunggah. Silakan coba lagi.',
      { variant: 'error', duration: 6000 }
    );
  }

  async function deleteDocument(item, operation) {
    let storageRemoved = false;
    try {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([item.storage_path]);
      if (storageError) {
        return { ok: false, partial: false, uncertain: true };
      }
      storageRemoved = true;
      const { error: metadataError, count } = await supabase
        .from('client_application_documents')
        .delete({ count: 'exact' })
        .eq('id', item.id)
        .eq('application_id', operation.applicationId)
        .eq('storage_path', item.storage_path);
      if (metadataError || count !== 1) {
        return { ok: false, partial: true, uncertain: false };
      }
      return { ok: true, partial: false, uncertain: false };
    } catch {
      return { ok: false, partial: storageRemoved, uncertain: !storageRemoved };
    }
  }

  function confirmDelete(item) {
    if (
      mutationPending ||
      formPending ||
      !isEditable() ||
      item.application_id !== application?.id
    ) {
      if (mutationPending || formPending) {
        showToast('Tunggu proses dokumen selesai terlebih dahulu.', { variant: 'info' });
      }
      return;
    }
    const operation = { applicationId: application.id };
    const body = document.createElement('p');
    body.textContent = `Hapus “${item.file_name}” dari pengajuan ini?`;
    let modalPending = false;
    const modal = showModal({
      title: 'Hapus dokumen?',
      body,
      actions: [
        { label: 'Batal', variant: 'ghost' },
        {
          label: 'Hapus',
          variant: 'danger',
          closeOnAction: false,
          action: ({ dialog, close }) => {
            if (modalPending || mutationPending || formPending) {
              return false;
            }
            modalPending = true;
            setMutationPending(true, 'Menghapus dokumen…');
            dialog.querySelectorAll('button').forEach(button => {
              button.disabled = true;
            });
            deleteDocument(item, operation)
              .then(async result => {
                setMutationPending(false);
                close();
                await refreshOrApplyQueuedContext();
                if (result.ok) {
                  showToast('Dokumen berhasil dihapus.', { variant: 'success' });
                  return;
                }
                showToast(
                  result.uncertain
                    ? 'Status penghapusan belum dapat dipastikan. Muat ulang sebelum mencoba lagi.'
                    : result.partial
                      ? 'File terhapus, tetapi metadata belum terhapus. Muat ulang dan hubungi Tim SMA.'
                      : 'Dokumen belum dapat dihapus. Silakan coba lagi.',
                  { variant: 'error', duration: 6000 }
                );
              })
              .catch(async () => {
                setMutationPending(false);
                close();
                await refreshOrApplyQueuedContext();
                showToast('Dokumen belum dapat dihapus. Silakan coba lagi.', { variant: 'error' });
              });
            return false;
          }
        }
      ]
    });
    modal.dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modalPending) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    modal.dialog.parentElement.addEventListener(
      'click',
      event => {
        if (modalPending && event.target === modal.dialog.parentElement) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { capture: true }
    );
  }

  input.addEventListener('change', handleFiles);
  const controller = {
    hide() {
      if (mutationPending) {
        queuedContext = { hidden: true };
        return;
      }
      applyHiddenContext();
    },
    isPending() {
      return mutationPending;
    },
    setFormPending(value) {
      formPending = value;
      updateBusyUi();
    },
    async setContext(nextProfile, nextApplication) {
      if (mutationPending) {
        queuedContext = { hidden: false, profile: nextProfile, application: nextApplication };
        return false;
      }
      return applyContext(nextProfile, nextApplication);
    }
  };
  instances.set(root, controller);
  return controller;
}
