import { supabase } from '../lib/supabaseClient.js';
import {
  clientPortalUrl,
  internalCmsUrl,
  isClientProfileComplete,
  requestClientMagicLink,
  restoreClientSession,
  routeForClientProfile,
  signInClientWithGoogle,
  signOutClient,
  updateClientProfile,
  waitForClientProfile
} from '../lib/client-portal-auth.js';
import { showToast } from './toast.js';

let initializedRoot = null;

function setButtonBusy(button, busy, busyLabel) {
  if (!button) {return;}
  if (!button.dataset.idleLabel) {button.dataset.idleLabel = button.textContent.trim();}
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

async function initClientLogin(root) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.replace(clientPortalUrl('client-auth-callback.html'));
    return;
  }

  const googleButton = root.querySelector('[data-client-google]');
  const magicForm = root.querySelector('[data-client-magic-form]');
  const emailInput = root.querySelector('[data-client-email]');
  const feedback = root.querySelector('[data-client-auth-feedback]');
  let requestPending = false;

  googleButton.addEventListener('click', async () => {
    if (requestPending) {return;}
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

  magicForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (requestPending || !magicForm.reportValidity()) {return;}

    requestPending = true;
    const submitButton = magicForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, 'Mengirim…');
    try {
      const { error } = await requestClientMagicLink(emailInput.value.trim());
      feedback.hidden = false;
      if (error) {
        feedback.dataset.variant = 'error';
        feedback.textContent = friendlyAuthError(error);
        return;
      }

      feedback.dataset.variant = 'success';
      feedback.textContent = 'Tautan masuk sudah dikirim. Silakan periksa email kamu.';
      emailInput.value = '';
    } catch (error) {
      feedback.hidden = false;
      feedback.dataset.variant = 'error';
      feedback.textContent = friendlyAuthError(error);
    } finally {
      setButtonBusy(submitButton, false, '');
      requestPending = false;
    }
  });
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
    if (callbackPending) {return;}
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
      message.textContent = 'Proses autentikasi dibatalkan atau ditolak. Silakan coba masuk kembali.';
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
    message.textContent = 'Akun sedang dinonaktifkan. Hubungi Tim SMA jika kamu memerlukan bantuan.';
    callbackCard.setAttribute('aria-busy', 'false');
    spinner.hidden = true;
    logoutButton.hidden = false;
    callbackPending = false;
  }

  retryButton.addEventListener('click', resolveCallback);
  logoutButton.addEventListener('click', signOutClient);
  await resolveCallback();
}

function renderClientPortal(root, profile) {
  const displayName = profile.full_name?.trim() || profile.name?.trim() || 'Pengguna';
  root.querySelectorAll('[data-client-name]').forEach((node) => {
    node.textContent = displayName;
  });
  root.querySelector('[data-client-email]').textContent = profile.email || 'Email tidak tersedia';
  root.querySelector('[data-client-initial]').textContent = displayName.charAt(0).toUpperCase();
  root.querySelector('[data-client-link-status]').textContent = profile.client_id
    ? 'Terhubung dengan data client'
    : 'Akun eksternal aktif';

  const incomplete = !isClientProfileComplete(profile);
  const missingFields = [];
  if (!profile.name?.trim()) {missingFields.push('nama lengkap');}
  if (!profile.phone?.trim()) {missingFields.push('nomor WhatsApp');}
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

  root.querySelectorAll('[data-client-logout]').forEach((button) => {
    button.addEventListener('click', signOutClient);
  });

  const { data: { user } } = await supabase.auth.getUser();
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

  completeButtons.forEach((button) => button.addEventListener('click', () => {
    profilePanel.hidden = false;
    const firstMissing = currentProfile.name?.trim()
      ? root.querySelector('[data-client-phone]')
      : root.querySelector('[data-client-profile-name]');
    firstMissing.focus();
  }));

  phoneForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (profileUpdatePending) {return;}
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
      showToast('Lengkapi nama dan nomor WhatsApp sebelum mengajukan project.', { variant: 'warning' });
      return;
    }
    showToast('Form pengajuan project akan tersedia pada tahap berikutnya.', { variant: 'info' });
  });

}

export async function initClientPortalAuth() {
  const root = document.querySelector('[data-client-auth-page]');
  if (!root || initializedRoot === root) {return;}
  initializedRoot = root;

  const page = root.dataset.clientAuthPage;
  if (page === 'login') {await initClientLogin(root);}
  if (page === 'callback') {await initClientCallback(root);}
  if (page === 'portal') {await initClientPortalHome(root);}
}
