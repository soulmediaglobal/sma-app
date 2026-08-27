import { supabase } from '../lib/supabaseClient.js';
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
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session) {
    window.location.replace(clientPortalUrl('client-auth-callback.html'));
    return;
  }

  const googleButton = root.querySelector('[data-client-google]');
  const passwordForm = root.querySelector('[data-client-password-form]');
  const emailInput = root.querySelector('[data-client-email]');
  const passwordInput = root.querySelector('[data-client-password]');
  const feedback = root.querySelector('[data-client-auth-feedback]');
  const forgotPasswordButton = root.querySelector('[data-client-forgot-password]');
  let requestPending = false;

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
      if (!profile || routeForClientProfile(profile) !== 'client') {
        await supabase.auth.signOut();
        passwordSessionEstablished = false;
        feedback.dataset.variant = 'error';
        feedback.textContent = 'Email atau password belum sesuai.';
        return;
      }
      window.location.replace(clientPortalUrl('client-auth-callback.html'));
    } catch {
      if (passwordSessionEstablished) {
        await supabase.auth.signOut().catch(() => {});
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
    if (destination === 'internal') {
      window.location.replace(internalCmsUrl());
      return;
    }
    if (destination === 'client') {
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

  const { profile } = await waitForClientProfile(user.id);
  if (!profile || routeForClientProfile(profile) !== 'client') {
    await supabase.auth.signOut().catch(() => {});
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

async function initClientPortalHome(root) {
  const loading = root.querySelector('[data-portal-loading]');
  const content = root.querySelector('[data-portal-content]');
  const blocked = root.querySelector('[data-portal-blocked]');
  const profilePanel = root.querySelector('[data-profile-panel]');
  const phoneForm = root.querySelector('[data-phone-form]');
  const projectButton = root.querySelector('[data-create-project]');
  const completeButtons = root.querySelectorAll('[data-complete-profile]');

  root.querySelectorAll('[data-client-logout]').forEach(button => {
    bindClientLogout(button);
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
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
  if (destination === 'internal') {
    window.location.replace(internalCmsUrl());
    return;
  }
  if (destination !== 'client') {
    blocked.hidden = false;
    blocked.querySelector('[data-blocked-message]').textContent =
      'Akun sedang dinonaktifkan. Hubungi Tim SMA untuk bantuan.';
    return;
  }

  let currentProfile = profile;
  let profileUpdatePending = false;
  renderClientPortal(root, currentProfile);
  content.hidden = false;

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

  projectButton.addEventListener('click', () => {
    if (!isClientProfileComplete(currentProfile)) {
      profilePanel.hidden = false;
      const firstMissing = currentProfile.name?.trim()
        ? root.querySelector('[data-client-phone]')
        : root.querySelector('[data-client-profile-name]');
      firstMissing.focus();
      showToast('Lengkapi nama dan nomor WhatsApp sebelum mengajukan project.', {
        variant: 'warning'
      });
      return;
    }
    showToast('Form pengajuan project akan tersedia pada tahap berikutnya.', { variant: 'info' });
  });
}

export async function initClientPortalAuth() {
  const root = document.querySelector('[data-client-auth-page]');
  if (!root || initializedRoot === root) {
    return;
  }
  initializedRoot = root;

  const page = root.dataset.clientAuthPage;
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
