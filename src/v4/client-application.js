import { supabase } from '../lib/supabaseClient.js';
import {
  clientPortalUrl,
  isClientProfileComplete,
  signOutClient,
  waitForClientProfile
} from '../lib/client-portal-auth.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { initClientApplicationDocuments } from './client-application-documents.js';

const EDITABLE_STATUSES = new Set(['DRAFT', 'REVISION_REQUIRED']);
const STAFF_ROLES = new Set(['admin', 'supervisor', 'internal']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPLICATION_FIELDS = [
  'id',
  'applicant_profile_id',
  'applicant_type',
  'entity_type',
  'service_type',
  'applicant_name',
  'business_name',
  'nib',
  'npwp',
  'pic_name',
  'pic_email',
  'whatsapp_number',
  'region',
  'needs_description',
  'status',
  'applicant_visible_revision_notes',
  'created_at',
  'updated_at'
].join(', ');

let initializedRoot = null;

function setBusy(button, busy, busyText) {
  if (!button) {
    return;
  }
  if (!button.dataset.idleText) {
    button.dataset.idleText = button.textContent.trim();
  }
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.idleText;
}

function optionalText(value) {
  const trimmed = value.trim();
  return trimmed || null;
}

function digitsOnly(value, maxLength = Infinity) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function formatNpwp(value) {
  const digits = digitsOnly(value, 16);
  if (digits.length === 16) {
    return digits.match(/.{1,4}/g)?.join(' ') || digits;
  }

  let formatted = digits.slice(0, 2);
  if (digits.length > 2) {
    formatted += `.${digits.slice(2, 5)}`;
  }
  if (digits.length > 5) {
    formatted += `.${digits.slice(5, 8)}`;
  }
  if (digits.length > 8) {
    formatted += `.${digits.slice(8, 9)}`;
  }
  if (digits.length > 9) {
    formatted += `-${digits.slice(9, 12)}`;
  }
  if (digits.length > 12) {
    formatted += `.${digits.slice(12, 15)}`;
  }
  return formatted;
}

function bindLogout(button) {
  if (!button || button.dataset.bound === 'true') {
    return;
  }
  button.dataset.bound = 'true';
  button.addEventListener('click', async () => {
    if (button.disabled) {
      return;
    }
    setBusy(button, true, 'Keluar…');
    const { error } = await signOutClient();
    if (error) {
      setBusy(button, false, '');
      showToast('Sesi belum dapat diakhiri. Silakan coba lagi.', { variant: 'error' });
    }
  });
}

function relationFailureMessage() {
  return 'Pengajuan belum dapat dimuat. Coba lagi atau hubungi Tim SMA jika kendala berlanjut.';
}

function requestedApplicationId() {
  const value = new URL(window.location.href).searchParams.get('id');
  if (value === null) {
    return { valid: true, id: null };
  }
  return { valid: UUID_PATTERN.test(value), id: value };
}

function rememberApplicationId(applicationId) {
  const url = new URL(window.location.href);
  url.searchParams.set('id', applicationId);
  window.history.replaceState({}, document.title, url);
}

export async function initClientApplication() {
  const root = document.getElementById('client-application-root');
  if (!root || initializedRoot === root) {
    return;
  }
  initializedRoot = root;

  const loading = root.querySelector('[data-application-loading]');
  const state = root.querySelector('[data-application-state]');
  const content = root.querySelector('[data-application-content]');
  const stateEyebrow = root.querySelector('[data-state-eyebrow]');
  const stateTitle = root.querySelector('[data-state-title]');
  const stateMessage = root.querySelector('[data-state-message]');
  const statePrimary = root.querySelector('[data-state-primary]');
  const stateLogout = root.querySelector('[data-state-logout]');
  const form = root.querySelector('[data-application-form]');
  const saveButton = root.querySelector('[data-save-draft]');
  const submitButton = root.querySelector('[data-submit-application]');
  const revisionPanel = root.querySelector('[data-revision-panel]');
  const revisionNotes = root.querySelector('[data-revision-notes]');
  const statusBadge = root.querySelector('[data-application-status]');
  const applicationTitle = root.querySelector('[data-application-title]');
  const editorElements = root.querySelectorAll('[data-application-editor]');
  const applicantTypeInputs = Array.from(form.elements.applicant_type);
  const entityField = root.querySelector('[data-entity-field]');
  const entitySelect = form.elements.entity_type;
  const businessInput = form.elements.business_name;
  const businessLabel = root.querySelector('[data-business-label]');
  const serviceSelect = form.elements.service_type;
  const nibInput = form.elements.nib;
  const npwpInput = form.elements.npwp;
  const whatsappInput = form.elements.whatsapp_number;
  const nibError = root.querySelector('[data-nib-error]');
  const npwpError = root.querySelector('[data-npwp-error]');
  const whatsappError = root.querySelector('[data-whatsapp-error]');

  let currentProfile = null;
  let currentApplication = null;
  let requestPending = false;
  let servicesLoaded = false;
  let documentController = null;

  function normalizeNib() {
    nibInput.value = digitsOnly(nibInput.value, 13);
    nibInput.setCustomValidity(
      nibInput.value && nibInput.value.length !== 13 ? 'NIB harus berisi tepat 13 digit angka.' : ''
    );
  }

  function normalizeNpwp() {
    const rawDigits = npwpInput.value.replace(/\D/g, '').slice(0, 16);
    npwpInput.value = formatNpwp(rawDigits);
    npwpInput.setCustomValidity(
      rawDigits && ![15, 16].includes(rawDigits.length)
        ? 'NPWP harus berisi 15 atau 16 digit angka.'
        : ''
    );
  }

  function normalizeWhatsapp() {
    whatsappInput.value = digitsOnly(whatsappInput.value);
    whatsappInput.setCustomValidity(whatsappInput.value ? '' : 'Nomor WhatsApp wajib diisi.');
  }

  function setFieldError(input, errorElement, message) {
    const hasError = Boolean(message);
    input.classList.toggle('is-invalid', hasError);
    if (hasError) {
      input.setAttribute('aria-invalid', 'true');
      errorElement.textContent = message;
    } else {
      input.removeAttribute('aria-invalid');
    }
    errorElement.hidden = !hasError;
  }

  function clearFieldError(input, errorElement) {
    setFieldError(input, errorElement, '');
  }

  function validateNib({ showError = true } = {}) {
    normalizeNib();
    const message =
      nibInput.value && nibInput.value.length !== 13
        ? 'NIB harus berisi tepat 13 digit angka.'
        : '';
    if (showError) {
      setFieldError(nibInput, nibError, message);
    }
    return !message;
  }

  function validateNpwp({ showError = true } = {}) {
    normalizeNpwp();
    const digitCount = digitsOnly(npwpInput.value, 16).length;
    const message =
      digitCount && ![15, 16].includes(digitCount)
        ? 'NPWP harus berisi 15 atau 16 digit angka.'
        : '';
    if (showError) {
      setFieldError(npwpInput, npwpError, message);
    }
    return !message;
  }

  function validateWhatsapp({ showError = true } = {}) {
    normalizeWhatsapp();
    const message = whatsappInput.value ? '' : 'Nomor WhatsApp wajib diisi.';
    if (showError) {
      setFieldError(whatsappInput, whatsappError, message);
    }
    return !message;
  }

  function validateFormattedFields() {
    const nibValid = validateNib();
    const npwpValid = validateNpwp();
    const whatsappValid = validateWhatsapp();
    return nibValid && npwpValid && whatsappValid;
  }

  function setRequestPending(value) {
    requestPending = value;
    documentController?.setFormPending(value);
  }

  function rejectWhileDocumentsPending() {
    if (!documentController?.isPending()) {
      return false;
    }
    showToast('Tunggu proses dokumen selesai terlebih dahulu.', { variant: 'info' });
    return true;
  }

  documentController = initClientApplicationDocuments(root);

  nibInput.addEventListener('input', () => {
    normalizeNib();
    clearFieldError(nibInput, nibError);
  });
  npwpInput.addEventListener('input', () => {
    normalizeNpwp();
    clearFieldError(npwpInput, npwpError);
  });
  whatsappInput.addEventListener('input', () => {
    normalizeWhatsapp();
    clearFieldError(whatsappInput, whatsappError);
  });
  nibInput.addEventListener('blur', () => validateNib());
  npwpInput.addEventListener('blur', () => validateNpwp());
  whatsappInput.addEventListener('blur', () => validateWhatsapp());

  root.querySelectorAll('[data-client-logout]').forEach(bindLogout);
  bindLogout(stateLogout);

  function showPortalNavigation(profile) {
    const navShell = root.querySelector('[data-client-portal-nav-shell]');
    const menuToggle = root.querySelector('[data-portal-menu-toggle]');
    const backdrop = root.querySelector('[data-portal-drawer-backdrop]');
    root.querySelectorAll('[data-client-linked-only]').forEach(element => {
      element.hidden = !profile.client_id;
    });
    navShell.hidden = false;
    menuToggle.hidden = false;
    if (navShell.dataset.navigationBound === 'true') {
      return;
    }
    navShell.dataset.navigationBound = 'true';

    const setOpen = open => {
      navShell.classList.toggle('is-open', open);
      backdrop.hidden = !open;
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute(
        'aria-label',
        open ? 'Tutup menu Client Portal' : 'Buka menu Client Portal'
      );
    };
    menuToggle.addEventListener('click', () => {
      setOpen(!navShell.classList.contains('is-open'));
    });
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && navShell.classList.contains('is-open')) {
        setOpen(false);
        menuToggle.focus();
      }
    });
  }

  function setEditorVisible(visible) {
    editorElements.forEach(element => {
      element.hidden = !visible;
    });
    if (!visible) {
      revisionPanel.hidden = true;
    }
  }

  function renderState({ eyebrow = 'Pengajuan layanan', title, message, action, actionLabel }) {
    loading.hidden = true;
    state.hidden = false;
    stateEyebrow.textContent = eyebrow;
    stateTitle.textContent = title;
    stateMessage.textContent = message;
    statePrimary.hidden = !action;
    statePrimary.textContent = actionLabel || 'Coba lagi';
    statePrimary.onclick = action || null;
    window.requestAnimationFrame(() => stateTitle.focus());
  }

  function showState({ eyebrow = 'Pengajuan layanan', title, message, action, actionLabel }) {
    documentController.hide();
    setEditorVisible(false);
    content.hidden = true;
    renderState({ eyebrow, title, message, action, actionLabel });
  }

  function showForm() {
    loading.hidden = true;
    state.hidden = true;
    content.hidden = false;
    setEditorVisible(true);
    window.requestAnimationFrame(() => applicationTitle.focus());
  }

  function syncApplicantType() {
    const isBusiness = form.elements.applicant_type.value === 'BUSINESS';
    entityField.hidden = !isBusiness;
    entitySelect.required = isBusiness;
    if (!isBusiness) {
      entitySelect.value = '';
    }
    businessInput.required = isBusiness;
    businessLabel.textContent = isBusiness ? 'Nama badan usaha *' : 'Nama usaha (opsional)';
  }

  function fillForm(application) {
    const defaults = application || {
      applicant_type: 'INDIVIDUAL',
      applicant_name: currentProfile.name || currentProfile.full_name || '',
      pic_name: currentProfile.name || currentProfile.full_name || '',
      pic_email: currentProfile.email || '',
      whatsapp_number: currentProfile.phone || ''
    };

    form.elements.applicant_type.value = defaults.applicant_type || 'INDIVIDUAL';
    form.elements.entity_type.value = defaults.entity_type || '';
    form.elements.applicant_name.value = defaults.applicant_name || '';
    form.elements.business_name.value = defaults.business_name || '';
    nibInput.value = digitsOnly(defaults.nib || '', 13);
    npwpInput.value = formatNpwp(defaults.npwp || '');
    form.elements.pic_name.value = defaults.pic_name || '';
    form.elements.pic_email.value = defaults.pic_email || '';
    whatsappInput.value = digitsOnly(defaults.whatsapp_number || '');
    form.elements.region.value = defaults.region || '';
    form.elements.needs_description.value = defaults.needs_description || '';
    normalizeNib();
    normalizeNpwp();
    normalizeWhatsapp();
    syncApplicantType();

    statusBadge.textContent =
      application?.status === 'REVISION_REQUIRED' ? 'Perlu diperbaiki' : 'Draft';
    revisionPanel.hidden = application?.status !== 'REVISION_REQUIRED';
    revisionNotes.textContent =
      application?.applicant_visible_revision_notes?.trim() ||
      'Tim SMA meminta data pengajuan diperiksa dan dilengkapi kembali.';
  }

  function applicationPayload() {
    return {
      applicant_type: form.elements.applicant_type.value,
      entity_type: form.elements.applicant_type.value === 'BUSINESS' ? entitySelect.value : null,
      service_type: serviceSelect.value,
      applicant_name: form.elements.applicant_name.value.trim(),
      business_name: optionalText(businessInput.value),
      nib: optionalText(digitsOnly(nibInput.value, 13)),
      npwp: optionalText(digitsOnly(npwpInput.value, 16)),
      pic_name: form.elements.pic_name.value.trim(),
      pic_email: form.elements.pic_email.value.trim(),
      whatsapp_number: digitsOnly(whatsappInput.value),
      region: form.elements.region.value.trim(),
      needs_description: form.elements.needs_description.value.trim()
    };
  }

  function validateForm() {
    const formattedFieldsValid = validateFormattedFields();
    if (!form.reportValidity() || !formattedFieldsValid) {
      return false;
    }
    const payload = applicationPayload();
    if (
      !payload.applicant_name ||
      !payload.service_type ||
      !payload.pic_name ||
      !payload.pic_email ||
      !payload.whatsapp_number ||
      !payload.region ||
      !payload.needs_description ||
      (payload.applicant_type === 'BUSINESS' && (!payload.entity_type || !payload.business_name))
    ) {
      showToast('Lengkapi seluruh field wajib sebelum melanjutkan.', { variant: 'error' });
      return false;
    }
    return true;
  }

  async function loadServices(selectedValue = '') {
    serviceSelect.disabled = true;
    const { data, error } = await supabase
      .from('service_type_codes')
      .select('service_type')
      .order('service_type', { ascending: true });

    serviceSelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = error ? 'Jenis layanan belum dapat dimuat' : 'Pilih jenis layanan';
    serviceSelect.appendChild(placeholder);

    if (error || !data?.length) {
      servicesLoaded = false;
      return false;
    }

    data.forEach(({ service_type: serviceType }) => {
      const option = document.createElement('option');
      option.value = serviceType;
      option.textContent = serviceType;
      serviceSelect.appendChild(option);
    });
    serviceSelect.value = selectedValue;
    serviceSelect.disabled = false;
    servicesLoaded = true;
    return true;
  }

  async function persistDraft({ notify = true } = {}) {
    if (rejectWhileDocumentsPending() || !validateForm() || requestPending) {
      return { application: null, created: false, error: new Error('invalid') };
    }
    setRequestPending(true);
    setBusy(saveButton, true, 'Menyimpan…');
    submitButton.disabled = true;
    const payload = applicationPayload();
    const previousApplication = currentApplication;

    try {
      if (!previousApplication) {
        const { data, error } = await supabase
          .from('client_applications')
          .insert({
            ...payload,
            applicant_profile_id: currentProfile.id,
            status: 'DRAFT'
          })
          .select(APPLICATION_FIELDS)
          .single();
        if (error || !data) {
          return { application: null, created: false, error: error || new Error('insert') };
        }
        currentApplication = data;
        rememberApplicationId(data.id);
        documentController.setContext(currentProfile, currentApplication).catch(() => {});
        if (notify) {
          showToast('Draft berhasil disimpan.', { variant: 'success' });
        }
        return { application: data, created: true, error: null };
      }

      const { data, error, count } = await supabase
        .from('client_applications')
        .update(payload, { count: 'exact' })
        .eq('id', previousApplication.id)
        .eq('applicant_profile_id', currentProfile.id)
        .eq('status', previousApplication.status)
        .select(APPLICATION_FIELDS);
      if (error || count !== 1 || data?.length !== 1) {
        return { application: null, created: false, error: error || new Error('stale') };
      }
      currentApplication = data[0];
      documentController.setContext(currentProfile, currentApplication).catch(() => {});
      if (notify) {
        showToast('Draft berhasil diperbarui.', { variant: 'success' });
      }
      return { application: data[0], created: false, error: null };
    } catch (error) {
      return { application: null, created: false, error };
    } finally {
      setRequestPending(false);
      setBusy(saveButton, false, '');
      submitButton.disabled = false;
    }
  }

  function showApplicationHolding(application) {
    const status = application.status;
    const copy = {
      SUBMITTED: {
        eyebrow: 'Pengajuan terkirim',
        title: 'Pengajuan sudah diterima',
        message: 'Tim SMA akan memeriksa informasi yang kamu kirim.'
      },
      UNDER_REVIEW: {
        eyebrow: 'Sedang ditinjau',
        title: 'Tim SMA sedang memeriksa pengajuan',
        message: 'Kamu belum perlu melakukan tindakan sampai ada pembaruan berikutnya.'
      },
      APPROVED: {
        eyebrow: 'Pengajuan disetujui',
        title: currentProfile.client_id
          ? 'Pengajuan sudah disetujui'
          : 'Akses portal sedang disiapkan',
        message: currentProfile.client_id
          ? 'Tim SMA akan melanjutkan layanan berdasarkan pengajuan yang telah disetujui.'
          : 'Pengajuan sudah disetujui, tetapi akun belum terhubung ke data client aktif.'
      },
      REJECTED: {
        eyebrow: 'Pengajuan tidak disetujui',
        title: 'Pengajuan telah selesai ditinjau',
        message: 'Pengajuan ini tidak disetujui oleh Tim SMA.'
      },
      CANCELLED: {
        eyebrow: 'Pengajuan dibatalkan',
        title: 'Pengajuan telah dibatalkan',
        message: 'Pengajuan ini sudah dibatalkan dan tidak lagi diproses.'
      }
    };
    setEditorVisible(false);
    content.hidden = false;
    renderState({
      ...copy[status],
      message: `${copy[status].message} Halaman pemantauan status akan tersedia pada tahap berikutnya.`,
      action: ['REJECTED', 'CANCELLED'].includes(status)
        ? () => window.location.assign(clientPortalUrl('client-application.html'))
        : null,
      actionLabel: ['REJECTED', 'CANCELLED'].includes(status) ? 'Ajukan Pengajuan Baru' : null
    });
    documentController.setContext(currentProfile, application).catch(() => {});
  }

  async function submitApplication() {
    if (rejectWhileDocumentsPending() || !validateForm() || requestPending) {
      return false;
    }

    const draftResult = await persistDraft({ notify: false });
    if (draftResult.error || !draftResult.application) {
      showToast('Draft belum dapat disimpan. Periksa data lalu coba lagi.', { variant: 'error' });
      return false;
    }

    const oldStatus = draftResult.application.status;
    setRequestPending(true);
    setBusy(submitButton, true, 'Mengirim…');
    saveButton.disabled = true;
    try {
      const { data, error, count } = await supabase
        .from('client_applications')
        .update({ status: 'SUBMITTED' }, { count: 'exact' })
        .eq('id', draftResult.application.id)
        .eq('applicant_profile_id', currentProfile.id)
        .eq('status', oldStatus)
        .select('id, status');

      if (error || count !== 1 || data?.length !== 1) {
        const message = draftResult.created
          ? 'Draft sudah tersimpan, tetapi pengajuan belum dapat dikirim. Coba lagi.'
          : 'Pengajuan belum dapat dikirim. Muat ulang halaman lalu coba lagi.';
        showToast(message, { variant: 'error', duration: 5000 });
        return false;
      }

      currentApplication = { ...draftResult.application, status: 'SUBMITTED' };
      showToast('Pengajuan berhasil dikirim.', { variant: 'success' });
      showApplicationHolding(currentApplication);
      return true;
    } catch {
      const message = draftResult.created
        ? 'Draft sudah tersimpan, tetapi pengajuan belum dapat dikirim. Coba lagi.'
        : 'Pengajuan belum dapat dikirim. Muat ulang halaman lalu coba lagi.';
      showToast(message, { variant: 'error', duration: 5000 });
      return false;
    } finally {
      setRequestPending(false);
      setBusy(submitButton, false, '');
      saveButton.disabled = false;
    }
  }

  async function openEditableForm(application = null) {
    currentApplication = application;
    fillForm(application);
    const loaded = await loadServices(application?.service_type || '');
    if (!loaded) {
      showState({
        title: 'Jenis layanan belum dapat dimuat',
        message: relationFailureMessage(),
        action: () => openEditableForm(application),
        actionLabel: 'Coba lagi'
      });
      return;
    }
    showForm();
    documentController.setContext(currentProfile, application).catch(() => {});
  }

  applicantTypeInputs.forEach(input => input.addEventListener('change', syncApplicantType));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (rejectWhileDocumentsPending()) {
      return;
    }
    if (!servicesLoaded) {
      showToast('Jenis layanan belum selesai dimuat.', { variant: 'error' });
      return;
    }
    const result = await persistDraft();
    if (result.error && result.error.message !== 'invalid') {
      showToast('Draft belum dapat disimpan. Muat ulang lalu coba lagi.', { variant: 'error' });
    }
  });
  submitButton.addEventListener('click', () => {
    if (rejectWhileDocumentsPending() || !servicesLoaded || !validateForm() || requestPending) {
      return;
    }
    const body = document.createElement('p');
    body.textContent =
      'Setelah dikirim, data tidak dapat diedit kecuali Tim SMA meminta perbaikan. Lanjutkan?';
    const feedback = document.createElement('p');
    feedback.className = 'client-application-modal-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    feedback.hidden = true;
    const modalBody = document.createElement('div');
    modalBody.append(body, feedback);
    let modalPending = false;
    const modal = showModal({
      title: 'Kirim pengajuan?',
      body: modalBody,
      actions: [
        { label: 'Batal', variant: 'ghost' },
        {
          label: 'Kirim Pengajuan',
          variant: 'primary',
          closeOnAction: false,
          action: ({ dialog, close }) => {
            if (modalPending || requestPending || rejectWhileDocumentsPending()) {
              return false;
            }
            modalPending = true;
            feedback.hidden = true;
            const buttons = dialog.querySelectorAll('button');
            const confirmButton = dialog.querySelector('.modal-footer .btn-primary');
            buttons.forEach(button => {
              button.disabled = true;
            });
            confirmButton.textContent = 'Mengirim…';

            submitApplication()
              .then(success => {
                if (success) {
                  close();
                  return;
                }
                feedback.textContent =
                  'Pengajuan belum dapat dikirim. Periksa data lalu coba lagi.';
                feedback.hidden = false;
                modalPending = false;
                buttons.forEach(button => {
                  button.disabled = false;
                });
                confirmButton.textContent = 'Kirim Pengajuan';
                confirmButton.focus();
              })
              .catch(() => {
                feedback.textContent = 'Pengajuan belum dapat dikirim. Coba lagi beberapa saat.';
                feedback.hidden = false;
                modalPending = false;
                buttons.forEach(button => {
                  button.disabled = false;
                });
                confirmButton.textContent = 'Kirim Pengajuan';
                confirmButton.focus();
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
  });

  async function resolvePage() {
    documentController.hide();
    loading.hidden = false;
    state.hidden = true;
    content.hidden = true;

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
      window.location.replace(clientPortalUrl('client-portal-login.html'));
      return;
    }

    const { profile } = await waitForClientProfile(user.id);
    if (!profile) {
      stateLogout.hidden = false;
      showState({
        title: 'Profil masih disiapkan',
        message: 'Profil belum dapat dimuat. Coba lagi beberapa saat.',
        action: resolvePage,
        actionLabel: 'Coba lagi'
      });
      return;
    }
    currentProfile = profile;

    if (profile.account_status !== 'ACTIVE') {
      if (STAFF_ROLES.has(profile.role)) {
        await supabase.auth.signOut().catch(() => {});
        showState({
          title: 'Halaman tidak dapat dibuka',
          message: 'Gunakan jalur masuk yang sesuai untuk akun kamu.'
        });
        return;
      }
      stateLogout.hidden = false;
      showState({
        title: 'Akun tidak dapat digunakan',
        message: 'Akun sedang dinonaktifkan. Hubungi Tim SMA jika kamu memerlukan bantuan.'
      });
      return;
    }

    if (profile.role !== 'client' || STAFF_ROLES.has(profile.role)) {
      await supabase.auth.signOut().catch(() => {});
      showState({
        title: 'Halaman tidak dapat dibuka',
        message: 'Gunakan jalur masuk yang sesuai untuk akun kamu.'
      });
      return;
    }

    showPortalNavigation(profile);

    if (!isClientProfileComplete(profile)) {
      showState({
        title: 'Lengkapi profil terlebih dahulu',
        message: 'Nama lengkap dan nomor WhatsApp diperlukan sebelum membuat pengajuan.',
        action: () => window.location.assign(clientPortalUrl('client-portal.html')),
        actionLabel: 'Lengkapi Profil'
      });
      return;
    }

    const requested = requestedApplicationId();
    if (!requested.valid) {
      showState({
        title: 'Pengajuan tidak ditemukan',
        message: 'Tautan pengajuan tidak valid atau tidak tersedia untuk akun kamu.'
      });
      return;
    }
    if (!requested.id) {
      await openEditableForm();
      return;
    }

    const { data: application, error: applicationError } = await supabase
      .from('client_applications')
      .select(APPLICATION_FIELDS)
      .eq('id', requested.id)
      .eq('applicant_profile_id', profile.id)
      .maybeSingle();

    if (applicationError) {
      showState({
        title: 'Pengajuan belum dapat dimuat',
        message: relationFailureMessage(),
        action: resolvePage,
        actionLabel: 'Coba lagi'
      });
      return;
    }
    if (!application) {
      showState({
        title: 'Pengajuan tidak ditemukan',
        message: 'Pengajuan tidak tersedia atau bukan milik akun kamu.'
      });
      return;
    }
    if (EDITABLE_STATUSES.has(application.status)) {
      await openEditableForm(application);
      return;
    }
    if (
      ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(
        application.status
      )
    ) {
      showApplicationHolding(application);
      return;
    }
    showState({
      title: 'Status pengajuan belum dikenali',
      message: 'Pengajuan belum dapat dibuka. Hubungi Tim SMA jika kendala berlanjut.'
    });
  }

  await resolvePage();
}
