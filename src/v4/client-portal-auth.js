import { supabase } from '../lib/supabaseClient.js';
import { clearSession } from '../lib/auth.js';
import { AUTH_ROUTE } from '../lib/auth-routing.js';
import {
  clientPortalUrl,
  internalCmsUrl,
  isClientProfileComplete,
  requestClientPasswordReset,
  restoreClientSession,
  routeForClientProfile,
  setClientPassword,
  signInClientWithGoogle,
  signInClientWithPassword,
  signOutClient,
  updateClientProfile,
  waitForClientProfile
} from '../lib/client-portal-auth.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

let initializedRoot = null;
const APPLICATION_CARD_STATES = {
  DRAFT: {
    badge: 'Draft',
    description: 'Pengajuan belum dikirim. Lanjutkan dan periksa kembali datanya.',
    action: 'Lanjutkan Draft'
  },
  SUBMITTED: {
    badge: 'Menunggu Review',
    description: 'Pengajuan sudah terkirim dan menunggu pemeriksaan Tim SMA.',
    action: 'Lihat Pengajuan'
  },
  UNDER_REVIEW: {
    badge: 'Sedang Ditinjau',
    description: 'Tim SMA sedang memeriksa pengajuanmu.',
    action: 'Lihat Status'
  },
  REVISION_REQUIRED: {
    badge: 'Perlu Revisi',
    description: 'Tim SMA meminta beberapa perbaikan pada pengajuanmu.',
    action: 'Perbaiki Pengajuan'
  },
  APPROVED: {
    badge: 'Disetujui',
    description: 'Pengajuan disetujui. Aktivasi akses client sedang diproses.',
    action: 'Lihat Pengajuan'
  },
  REJECTED: {
    badge: 'Tidak Disetujui',
    description: 'Pengajuan ini tidak disetujui oleh Tim SMA.',
    action: 'Lihat Pengajuan'
  },
  CANCELLED: {
    badge: 'Dibatalkan',
    description: 'Pengajuan ini telah dibatalkan.',
    action: 'Lihat Pengajuan'
  }
};
const APPLICATION_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

function setButtonBusy(button, busy, busyLabel) {
  if (!button) {
    return;
  }
  if (!button.dataset.idleLabel) {
    button.dataset.idleLabel = button.textContent.trim();
  }
  button.disabled = busy;
  button.textContent = busy ? busyLabel : button.dataset.idleLabel;
}

function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('rate') || message.includes('limit')) {
    return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
  }
  if (message.includes('network') || !navigator.onLine) {
    return 'Koneksi internet bermasalah. Periksa koneksi lalu coba lagi.';
  }
  return 'Proses masuk belum berhasil. Silakan coba lagi.';
}

function isOperationalPasswordResetError(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    status === 429 ||
    status >= 500 ||
    code.includes('rate_limit') ||
    code === 'unexpected_failure' ||
    message.includes('network') ||
    message.includes('smtp') ||
    message.includes('configuration') ||
    !navigator.onLine
  );
}

function bindClientLogout(button) {
  if (!button || button.dataset.logoutBound === 'true') {
    return;
  }
  button.dataset.logoutBound = 'true';
  button.addEventListener('click', () => {
    if (button.disabled) {
      return;
    }
    setButtonBusy(button, true, 'Keluar…');
    signOutClient()
      .then(({ error }) => {
        if (!error) {
          return;
        }
        setButtonBusy(button, false, '');
        showToast('Sesi belum dapat diakhiri. Silakan coba lagi.', { variant: 'error' });
      })
      .catch(() => {
        setButtonBusy(button, false, '');
        showToast('Sesi belum dapat diakhiri. Silakan coba lagi.', { variant: 'error' });
      });
  });
}

function openForgotPasswordModal() {
  const wrapper = document.createElement('div');
  wrapper.className = 'client-forgot-password';

  const description = document.createElement('p');
  description.textContent =
    'Masukkan email Client Portal. Jika akun tersedia, kami akan mengirim tautan untuk membuat atau mengatur ulang password.';

  const form = document.createElement('form');
  form.className = 'client-auth-form';
  form.noValidate = true;
  const label = document.createElement('label');
  label.htmlFor = 'client-reset-email';
  label.textContent = 'Email';
  const input = document.createElement('input');
  input.id = 'client-reset-email';
  input.type = 'email';
  input.autocomplete = 'email';
  input.required = true;
  input.placeholder = 'nama@email.com';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'client-auth-primary';
  submit.textContent = 'Kirim Tautan';
  const feedback = document.createElement('p');
  feedback.className = 'client-auth-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;

  form.append(label, input, submit);
  wrapper.append(description, form, feedback);
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) {
      return;
    }
    pending = true;
    setButtonBusy(submit, true, 'Mengirim…');
    try {
      const { error } = await requestClientPasswordReset(input.value.trim());
      if (error && isOperationalPasswordResetError(error)) {
        feedback.dataset.variant = 'error';
        feedback.textContent = 'Tautan belum dapat dikirim. Coba lagi beberapa saat.';
        feedback.hidden = false;
        return;
      }
      form.hidden = true;
      feedback.dataset.variant = 'success';
      feedback.textContent =
        'Jika akun tersedia, tautan pengaturan password akan dikirim ke email tersebut.';
      feedback.hidden = false;
    } catch {
      feedback.dataset.variant = 'error';
      feedback.textContent = 'Tautan belum dapat dikirim. Coba lagi beberapa saat.';
      feedback.hidden = false;
    } finally {
      pending = false;
      setButtonBusy(submit, false, '');
    }
  });

  showModal({ title: 'Lupa password?', body: wrapper, size: 'sm' });
}

async function initClientLogin(root) {
  const googleButton = root.querySelector('[data-client-google]');
  const passwordForm = root.querySelector('[data-client-password-form]');
  const emailInput = root.querySelector('[data-client-email]');
  const passwordInput = root.querySelector('[data-client-password]');
  const feedback = root.querySelector('[data-client-auth-feedback]');
  const forgotPasswordButton = root.querySelector('[data-client-forgot-password]');
  let requestPending = false;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      feedback.dataset.variant = 'error';
      feedback.textContent = 'Sesi belum dapat diperiksa. Silakan coba masuk kembali.';
      feedback.hidden = false;
    } else if (data.session) {
      window.location.replace(clientPortalUrl('client-auth-callback.html'));
      return;
    }
  } catch {
    feedback.dataset.variant = 'error';
    feedback.textContent = 'Sesi belum dapat diperiksa. Silakan coba masuk kembali.';
    feedback.hidden = false;
  }

  googleButton.addEventListener('click', async () => {
    if (requestPending) {
      return;
    }
    requestPending = true;
    let redirectStarted = false;
    setButtonBusy(googleButton, true, 'Menghubungkan…');
    try {
      const { error } = await signInClientWithGoogle();
      if (!error) {
        redirectStarted = true;
        return;
      }
      feedback.dataset.variant = 'error';
      feedback.textContent = friendlyAuthError(error);
      feedback.hidden = false;
    } catch (error) {
      feedback.dataset.variant = 'error';
      feedback.textContent = friendlyAuthError(error);
      feedback.hidden = false;
    } finally {
      if (!redirectStarted) {
        setButtonBusy(googleButton, false, '');
        requestPending = false;
      }
    }
  });

  passwordForm.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (requestPending || !passwordForm.reportValidity()) {
      return;
    }

    requestPending = true;
    const submitButton = passwordForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, 'Memverifikasi…');
    let passwordSessionEstablished = false;
    try {
      const { data, error } = await signInClientWithPassword(
        emailInput.value.trim(),
        passwordInput.value
      );
      feedback.hidden = false;
      if (error) {
        feedback.dataset.variant = 'error';
        feedback.textContent = 'Email atau password belum sesuai.';
        return;
      }
      passwordSessionEstablished = true;

      const { profile } = data.user ? await waitForClientProfile(data.user.id) : { profile: null };
      const destination = routeForClientProfile(profile);
      if (destination === AUTH_ROUTE.INTERNAL) {
        window.location.replace(internalCmsUrl());
        return;
      }
      if (destination !== AUTH_ROUTE.CLIENT) {
        await clearSession();
        passwordSessionEstablished = false;
        feedback.dataset.variant = 'error';
        feedback.textContent = 'Email atau password belum sesuai.';
        return;
      }
      window.location.replace(clientPortalUrl('client-auth-callback.html'));
    } catch {
      if (passwordSessionEstablished) {
        await clearSession();
      }
      feedback.hidden = false;
      feedback.dataset.variant = 'error';
      feedback.textContent = 'Email atau password belum sesuai.';
    } finally {
      setButtonBusy(submitButton, false, '');
      requestPending = false;
    }
  });

  forgotPasswordButton.addEventListener('click', openForgotPasswordModal);
}

function cleanCallbackUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

async function initClientCallback(root) {
  const callbackCard = root.querySelector('.client-callback-card');
  const spinner = root.querySelector('.client-auth-spinner');
  const title = root.querySelector('[data-callback-title]');
  const message = root.querySelector('[data-callback-message]');
  const retryButton = root.querySelector('[data-callback-retry]');
  const logoutButton = root.querySelector('[data-client-logout]');
  let callbackPending = false;

  async function resolveCallback() {
    if (callbackPending) {
      return;
    }
    callbackPending = true;
    callbackCard.setAttribute('aria-busy', 'true');
    spinner.hidden = false;
    retryButton.hidden = true;
    title.textContent = 'Menyiapkan portal kamu';
    message.textContent = 'Kami sedang memverifikasi sesi dan menyiapkan profil.';

    const callbackError = new URL(window.location.href).searchParams.get('error');
    if (callbackError) {
      cleanCallbackUrl();
      callbackCard.setAttribute('aria-busy', 'false');
      spinner.hidden = true;
      title.textContent = 'Login belum berhasil';
      message.textContent =
        'Proses autentikasi dibatalkan atau ditolak. Silakan coba masuk kembali.';
      retryButton.hidden = false;
      callbackPending = false;
      return;
    }

    const { user, error } = await restoreClientSession();
    cleanCallbackUrl();
    if (error || !user) {
      callbackCard.setAttribute('aria-busy', 'false');
      spinner.hidden = true;
      title.textContent = 'Sesi tidak dapat dipulihkan';
      message.textContent = friendlyAuthError(error);
      retryButton.hidden = false;
      callbackPending = false;
      return;
    }

    const { profile } = await waitForClientProfile(user.id);
    if (!profile) {
      callbackCard.setAttribute('aria-busy', 'false');
      spinner.hidden = true;
      title.textContent = 'Profil masih disiapkan';
      message.textContent = 'Proses ini membutuhkan sedikit waktu. Coba lagi beberapa saat.';
      retryButton.hidden = false;
      callbackPending = false;
      return;
    }

    const destination = routeForClientProfile(profile);
    if (destination === AUTH_ROUTE.INTERNAL) {
      window.location.replace(internalCmsUrl());
      return;
    }
    if (destination === AUTH_ROUTE.CLIENT) {
      window.location.replace(clientPortalUrl('client-portal.html'));
      return;
    }

    title.textContent = 'Akun tidak dapat mengakses portal';
    message.textContent =
      'Akun sedang dinonaktifkan. Hubungi Tim SMA jika kamu memerlukan bantuan.';
    callbackCard.setAttribute('aria-busy', 'false');
    spinner.hidden = true;
    logoutButton.hidden = false;
    callbackPending = false;
  }

  retryButton.addEventListener('click', resolveCallback);
  bindClientLogout(logoutButton);
  await resolveCallback();
}

async function initClientSetPassword(root) {
  const card = root.querySelector('.client-set-password-card');
  const spinner = root.querySelector('[data-set-password-spinner]');
  const loading = root.querySelector('[data-set-password-loading]');
  const form = root.querySelector('[data-set-password-form]');
  const errorState = root.querySelector('[data-set-password-error]');
  const feedback = root.querySelector('[data-set-password-feedback]');
  const passwordInput = root.querySelector('[data-client-new-password]');
  const confirmInput = root.querySelector('[data-client-confirm-password]');
  let pending = false;

  const callbackError = new URL(window.location.href).searchParams.get('error');
  const { user, error } = callbackError
    ? { user: null, error: new Error('Tautan ditolak.') }
    : await restoreClientSession();
  cleanCallbackUrl();
  spinner.hidden = true;
  loading.hidden = true;
  card.setAttribute('aria-busy', 'false');

  if (error || !user) {
    errorState.hidden = false;
    return;
  }

  const { profile, error: profileError } = await waitForClientProfile(user.id);
  if (profileError || !profile) {
    errorState.hidden = false;
    return;
  }

  const destination = routeForClientProfile(profile);
  if (destination === AUTH_ROUTE.INTERNAL) {
    window.location.replace(internalCmsUrl());
    return;
  }
  if (destination !== AUTH_ROUTE.CLIENT) {
    errorState.hidden = false;
    return;
  }

  form.hidden = false;
  passwordInput.focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) {
      return;
    }
    if (passwordInput.value !== confirmInput.value) {
      feedback.dataset.variant = 'error';
      feedback.textContent = 'Ulangi password dengan nilai yang sama.';
      feedback.hidden = false;
      confirmInput.focus();
      return;
    }

    pending = true;
    const submitButton = form.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, 'Menyimpan…');
    try {
      const { error: updateError } = await setClientPassword(passwordInput.value);
      if (updateError) {
        feedback.dataset.variant = 'error';
        feedback.textContent =
          'Password belum dapat disimpan. Periksa ketentuan password lalu coba lagi.';
        feedback.hidden = false;
        return;
      }
      window.location.replace(clientPortalUrl('client-auth-callback.html'));
    } catch {
      feedback.dataset.variant = 'error';
      feedback.textContent = 'Password belum dapat disimpan. Silakan coba lagi.';
      feedback.hidden = false;
    } finally {
      pending = false;
      setButtonBusy(submitButton, false, '');
    }
  });
}

function renderClientPortal(root, profile) {
  const displayName = profile.full_name?.trim() || profile.name?.trim() || 'Pengguna';
  root.querySelectorAll('[data-client-name]').forEach(node => {
    node.textContent = displayName;
  });
  root.querySelector('[data-client-email]').textContent = profile.email || 'Email tidak tersedia';
  root.querySelector('[data-client-initial]').textContent = displayName.charAt(0).toUpperCase();
  root.querySelector('[data-client-link-status]').textContent = profile.client_id
    ? 'Terhubung dengan data client'
    : 'Akun eksternal aktif';

  const incomplete = !isClientProfileComplete(profile);
  const missingFields = [];
  if (!profile.name?.trim()) {
    missingFields.push('nama lengkap');
  }
  if (!profile.phone?.trim()) {
    missingFields.push('nomor WhatsApp');
  }
  const banner = root.querySelector('[data-profile-banner]');
  banner.hidden = !incomplete;
  root.querySelector('[data-profile-missing]').textContent = missingFields.join(' dan ');
  root.querySelector('[data-client-profile-name]').value = profile.name || '';
  root.querySelector('[data-client-phone]').value = profile.phone || '';
}

function formatApplicationDate(application) {
  const timestamp =
    application.status === 'SUBMITTED' ? application.submitted_at : application.updated_at;
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const prefix = application.status === 'SUBMITTED' ? 'Dikirim' : 'Diperbarui';
  return `${prefix} ${APPLICATION_DATE_FORMATTER.format(date)}`;
}

function applicationUrl(applicationId = null) {
  const url = new URL(clientPortalUrl('client-application.html'));
  if (applicationId) {
    url.searchParams.set('id', applicationId);
  }
  return url.href;
}

function createApplicationState(title, message, action) {
  const wrapper = document.createElement('div');
  wrapper.className = 'client-application-list-state';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = message;
  wrapper.append(heading, copy);
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'client-auth-secondary';
    button.textContent = action.label;
    button.addEventListener('click', action.handler);
    wrapper.append(button);
  }
  return wrapper;
}

function setApplicationListsLoading(root) {
  root.querySelectorAll('[data-application-list], [data-application-list-home]').forEach(list => {
    list.setAttribute('aria-busy', 'true');
    list.replaceChildren(createApplicationState('Memuat pengajuan…', 'Mohon tunggu sebentar.'));
  });
}

function createApplicationCard(application, { onDelete, profile }) {
  const state = APPLICATION_CARD_STATES[application.status] || {
    badge: 'Status tersedia',
    description: 'Buka pengajuan untuk melihat informasi terbaru.',
    action: 'Lihat Pengajuan'
  };
  const card = document.createElement('article');
  card.className = 'client-application-summary';

  const main = document.createElement('div');
  main.className = 'client-application-summary-main';
  const badge = document.createElement('span');
  badge.className = 'client-application-summary-status';
  badge.dataset.status = application.status;
  badge.textContent = state.badge;
  const copy = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = application.service_type?.trim() || 'Pengajuan layanan';
  const description = document.createElement('p');
  description.textContent =
    application.status === 'APPROVED' && profile.client_id
      ? 'Pengajuan telah disetujui dan akun client sudah aktif.'
      : state.description;
  const date = document.createElement('time');
  const formattedDate = formatApplicationDate(application);
  date.textContent = formattedDate || '';
  date.hidden = !formattedDate;
  copy.append(title, description, date);
  main.append(badge, copy);

  const actions = document.createElement('div');
  actions.className = 'client-application-summary-actions';
  const open = document.createElement('a');
  open.className = 'client-auth-primary';
  open.href = applicationUrl(application.id);
  open.textContent = state.action;
  actions.append(open);
  if (application.status === 'DRAFT') {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'client-auth-secondary client-application-delete';
    remove.textContent = 'Hapus Draft';
    remove.setAttribute(
      'aria-label',
      `Hapus draft ${application.service_type?.trim() || 'pengajuan layanan'}`
    );
    remove.addEventListener('click', () => onDelete(application, remove));
    actions.append(remove);
  }
  card.append(main, actions);
  return card;
}

function renderApplicationLists(root, applications, handlers) {
  const lists = root.querySelectorAll('[data-application-list], [data-application-list-home]');
  lists.forEach(list => {
    list.setAttribute('aria-busy', 'false');
    if (!applications.length) {
      list.replaceChildren(
        createApplicationState(
          'Belum ada pengajuan',
          'Ajukan layanan baru saat kamu siap menyampaikan kebutuhan kepada Tim SMA.'
        )
      );
      return;
    }
    list.replaceChildren(
      ...applications.map(application => createApplicationCard(application, handlers))
    );
  });
}

function renderApplicationListError(root, retry) {
  root.querySelectorAll('[data-application-list], [data-application-list-home]').forEach(list => {
    list.setAttribute('aria-busy', 'false');
    list.replaceChildren(
      createApplicationState(
        'Pengajuan belum dapat dimuat',
        'Daftar pengajuan belum tersedia. Coba lagi beberapa saat.',
        { label: 'Coba Lagi', handler: retry }
      )
    );
  });
}

async function initClientPortalHome(root) {
  const loading = root.querySelector('[data-portal-loading]');
  const content = root.querySelector('[data-portal-content]');
  const blocked = root.querySelector('[data-portal-blocked]');
  const profilePanel = root.querySelector('[data-profile-panel]');
  const phoneForm = root.querySelector('[data-phone-form]');
  const completeButtons = root.querySelectorAll('[data-complete-profile]');
  const createApplicationControls = root.querySelectorAll(
    '[data-create-application], [data-create-application-link]'
  );

  root.querySelectorAll('[data-client-logout]').forEach(button => {
    bindClientLogout(button);
  });

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }
    user = data.user;
  } catch {
    loading.hidden = true;
    blocked.hidden = false;
    blocked.querySelector('[data-blocked-message]').textContent =
      'Sesi belum dapat diverifikasi. Silakan coba lagi beberapa saat.';
    return;
  }
  if (!user) {
    window.location.replace(clientPortalUrl('client-portal-login.html'));
    return;
  }

  const { profile } = await waitForClientProfile(user.id);
  loading.hidden = true;
  if (!profile) {
    blocked.hidden = false;
    blocked.querySelector('[data-blocked-message]').textContent =
      'Profil belum dapat dimuat. Silakan keluar lalu coba masuk kembali.';
    return;
  }

  const destination = routeForClientProfile(profile);
  if (destination === AUTH_ROUTE.INTERNAL) {
    window.location.replace(internalCmsUrl());
    return;
  }
  if (destination !== AUTH_ROUTE.CLIENT) {
    blocked.hidden = false;
    blocked.querySelector('[data-blocked-message]').textContent =
      'Akun belum dapat digunakan. Hubungi Tim SMA untuk bantuan.';
    return;
  }

  let currentProfile = profile;
  let profileUpdatePending = false;
  let applicationLoadPending = false;
  let applicationMutationPending = false;

  const requestNewApplication = event => {
    event?.preventDefault();
    if (applicationMutationPending) {
      return;
    }
    if (!isClientProfileComplete(currentProfile)) {
      profilePanel.hidden = false;
      const firstMissing = currentProfile.name?.trim()
        ? root.querySelector('[data-client-phone]')
        : root.querySelector('[data-client-profile-name]');
      firstMissing.focus();
      showToast('Lengkapi nama dan nomor WhatsApp sebelum membuat pengajuan.', {
        variant: 'warning'
      });
      return;
    }
    window.location.assign(applicationUrl());
  };

  createApplicationControls.forEach(control => {
    if (control.tagName === 'BUTTON') {
      control.disabled = false;
    }
    control.addEventListener('click', requestNewApplication);
  });

  async function deleteDraft(application) {
    const { data: documents, error: documentsError } = await supabase
      .from('client_application_documents')
      .select('id, application_id, storage_path')
      .eq('application_id', application.id);
    if (documentsError || !Array.isArray(documents)) {
      return { ok: false, partial: false };
    }

    const expectedPrefix = `${currentProfile.id}/${application.id}/`;
    const paths = documents.map(document => document.storage_path);
    if (
      documents.some(
        document =>
          document.application_id !== application.id ||
          !document.storage_path.startsWith(expectedPrefix) ||
          document.storage_path.slice(expectedPrefix.length).includes('/')
      )
    ) {
      return { ok: false, partial: false };
    }

    let storageRemoved = false;
    if (paths.length) {
      const { error: storageError } = await supabase.storage
        .from('client-application-documents')
        .remove(paths);
      if (storageError) {
        return { ok: false, partial: true };
      }
      storageRemoved = true;
    }

    if (documents.length) {
      const documentIds = documents.map(document => document.id);
      const {
        data: removedMetadata,
        error: metadataError,
        count: metadataCount
      } = await supabase
        .from('client_application_documents')
        .delete({ count: 'exact' })
        .eq('application_id', application.id)
        .in('id', documentIds)
        .select('id');
      if (
        metadataError ||
        metadataCount !== documents.length ||
        removedMetadata?.length !== documents.length
      ) {
        return { ok: false, partial: storageRemoved };
      }
    }

    const {
      data: removedApplication,
      error: applicationError,
      count: applicationCount
    } = await supabase
      .from('client_applications')
      .delete({ count: 'exact' })
      .eq('id', application.id)
      .eq('applicant_profile_id', currentProfile.id)
      .eq('status', 'DRAFT')
      .select('id');
    if (applicationError || applicationCount !== 1 || removedApplication?.length !== 1) {
      return { ok: false, partial: documents.length > 0 };
    }
    return { ok: true, partial: false };
  }

  const refreshApplications = async () => {
    if (applicationLoadPending) {
      return;
    }
    applicationLoadPending = true;
    setApplicationListsLoading(root);
    try {
      const { data, error } = await supabase
        .from('client_applications')
        .select('id, service_type, status, submitted_at, updated_at, created_at')
        .eq('applicant_profile_id', user.id)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (error || !Array.isArray(data)) {
        renderApplicationListError(root, refreshApplications);
        return;
      }
      renderApplicationLists(root, data, {
        profile: currentProfile,
        onDelete(application, trigger) {
          if (applicationMutationPending || application.status !== 'DRAFT') {
            return;
          }
          const body = document.createElement('div');
          const copy = document.createElement('p');
          copy.textContent =
            'Draft dan seluruh dokumen pendukungnya akan dihapus. Tindakan ini tidak dapat dibatalkan.';
          const feedback = document.createElement('p');
          feedback.className = 'client-auth-feedback';
          feedback.setAttribute('role', 'status');
          feedback.setAttribute('aria-live', 'polite');
          feedback.hidden = true;
          body.append(copy, feedback);
          const modal = showModal({
            title: 'Hapus draft?',
            body,
            actions: [
              { label: 'Batal', variant: 'ghost' },
              {
                label: 'Hapus Draft',
                variant: 'danger',
                closeOnAction: false,
                action: ({ dialog, close }) => {
                  if (applicationMutationPending) {
                    return false;
                  }
                  applicationMutationPending = true;
                  const buttons = dialog.querySelectorAll('button');
                  buttons.forEach(button => {
                    button.disabled = true;
                  });
                  deleteDraft(application)
                    .then(async result => {
                      if (result.ok) {
                        close();
                        showToast('Draft berhasil dihapus.', { variant: 'success' });
                        await refreshApplications();
                        return;
                      }
                      feedback.textContent = result.partial
                        ? 'Sebagian data sudah terhapus, tetapi proses belum selesai. Muat ulang daftar dan hubungi Tim SMA bila draft masih tampil.'
                        : 'Draft belum dapat dihapus. Coba lagi beberapa saat.';
                      feedback.hidden = false;
                      if (result.partial) {
                        await refreshApplications();
                      }
                      buttons.forEach(button => {
                        button.disabled = false;
                      });
                    })
                    .catch(async () => {
                      feedback.textContent =
                        'Status penghapusan belum dapat dipastikan. Muat ulang daftar sebelum mencoba lagi.';
                      feedback.hidden = false;
                      await refreshApplications();
                      buttons.forEach(button => {
                        button.disabled = false;
                      });
                    })
                    .finally(() => {
                      applicationMutationPending = false;
                    });
                  return false;
                }
              }
            ],
            onClose: () => trigger.focus()
          });
          modal.dialog.addEventListener('keydown', event => {
            if (event.key === 'Escape' && applicationMutationPending) {
              event.preventDefault();
              event.stopPropagation();
            }
          });
          modal.dialog.parentElement.addEventListener(
            'click',
            event => {
              if (applicationMutationPending && event.target === modal.dialog.parentElement) {
                event.preventDefault();
                event.stopImmediatePropagation();
              }
            },
            { capture: true }
          );
        }
      });
    } catch {
      renderApplicationListError(root, refreshApplications);
    } finally {
      applicationLoadPending = false;
    }
  };

  renderClientPortal(root, currentProfile);
  content.hidden = false;
  const { initClientPortalProjects } = await import('./client-portal-projects.js');
  initClientPortalProjects({ root, profile: currentProfile });
  await refreshApplications();

  completeButtons.forEach(button =>
    button.addEventListener('click', () => {
      profilePanel.hidden = false;
      const firstMissing = currentProfile.name?.trim()
        ? root.querySelector('[data-client-phone]')
        : root.querySelector('[data-client-profile-name]');
      firstMissing.focus();
    })
  );

  phoneForm.addEventListener('submit', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (profileUpdatePending) {
      return;
    }
    const nameInput = root.querySelector('[data-client-profile-name]');
    const phoneInput = root.querySelector('[data-client-phone]');
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    if (!name) {
      showToast('Nama lengkap wajib diisi.', { variant: 'error' });
      nameInput.focus();
      return;
    }
    if (!phone) {
      showToast('Nomor WhatsApp wajib diisi.', { variant: 'error' });
      phoneInput.focus();
      return;
    }

    const submitButton = phoneForm.querySelector('button[type="submit"]');
    profileUpdatePending = true;
    setButtonBusy(submitButton, true, 'Menyimpan…');
    try {
      const { data, error } = await updateClientProfile(currentProfile.id, name, phone);
      if (error || !data) {
        showToast('Nomor WhatsApp belum dapat disimpan. Coba lagi.', { variant: 'error' });
        return;
      }
      currentProfile = data;
      renderClientPortal(root, currentProfile);
      profilePanel.hidden = true;
      showToast('Nomor WhatsApp berhasil disimpan.', { variant: 'success' });
    } catch {
      showToast('Nomor WhatsApp belum dapat disimpan. Coba lagi.', { variant: 'error' });
    } finally {
      profileUpdatePending = false;
      setButtonBusy(submitButton, false, '');
    }
  });
}

export async function initClientPortalAuth() {
  const root = document.querySelector('[data-client-auth-page]');
  if (!root || initializedRoot === root) {
    return;
  }
  initializedRoot = root;

  const page = root.dataset.clientAuthPage;
  const pageFiles = {
    login: 'client-portal-login.html',
    callback: 'client-auth-callback.html',
    'set-password': 'client-set-password.html',
    portal: 'client-portal.html'
  };
  const pageFile = pageFiles[page];
  if (!pageFile) {
    throw new Error('Halaman Client Portal tidak dikenal.');
  }
  const canonicalUrl = new URL(clientPortalUrl(pageFile));
  if (canonicalUrl.origin !== window.location.origin) {
    canonicalUrl.search = window.location.search;
    canonicalUrl.hash = window.location.hash;
    window.location.replace(canonicalUrl.href);
    return;
  }

  if (page === 'login') {
    await initClientLogin(root);
  }
  if (page === 'callback') {
    await initClientCallback(root);
  }
  if (page === 'set-password') {
    await initClientSetPassword(root);
  }
  if (page === 'portal') {
    await initClientPortalHome(root);
  }
}
