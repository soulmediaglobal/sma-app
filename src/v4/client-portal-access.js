import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

const STAFF_ROLES = new Set(['admin', 'supervisor', 'internal']);
const STATUS_VIEW = {
  NOT_INVITED: {
    label: 'Belum diundang',
    className: 'status-gray',
    message: 'Belum ada akun Client Portal yang terhubung.'
  },
  INVITED: {
    label: 'Undangan terkirim',
    className: 'status-yellow',
    message: 'Email penyiapan password sudah dikirim dan belum diselesaikan.'
  },
  ACTIVE: {
    label: 'Portal aktif',
    className: 'status-green',
    message: 'Akun PIC dapat menggunakan Client Portal.'
  },
  DISABLED: {
    label: 'Akses dinonaktifkan',
    className: 'status-red',
    message: 'Akun tidak dapat membaca data Client Portal.'
  }
};

let root = null;
let clientId = '';
let currentProfile = null;
let snapshot = null;
let requestPending = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function isStaffActive(profile) {
  return profile?.account_status === 'ACTIVE' && STAFF_ROLES.has(profile.role);
}

async function errorCode(error) {
  const response = error?.context;
  if (!response || typeof response.clone !== 'function') {
    return '';
  }
  try {
    const body = await response.clone().json();
    return String(body?.error || '');
  } catch {
    return '';
  }
}

async function invokeAccess(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('client-portal-access', {
    body: { action, clientId, ...extra }
  });
  if (error) {
    return { data: null, error, code: await errorCode(error) };
  }
  return { data, error: null, code: '' };
}

function setLoading(loading) {
  if (!root) {
    return;
  }
  root.setAttribute('aria-busy', String(loading));
  root.querySelectorAll('button').forEach(button => {
    button.disabled = loading;
  });
}

function modalEmail(email) {
  const wrapper = element('div', 'client-portal-access-modal');
  const label = element('label', 'form-label', 'Email PIC');
  const input = document.createElement('input');
  input.className = 'form-control';
  input.type = 'email';
  input.value = email || '';
  input.readOnly = true;
  input.setAttribute('aria-readonly', 'true');
  label.appendChild(input);
  wrapper.appendChild(label);
  wrapper.appendChild(
    element(
      'p',
      'client-portal-access-help',
      'Jika email salah, tutup modal lalu gunakan Edit Info untuk memperbarui Email PIC.'
    )
  );
  return wrapper;
}

async function performAction(action, context, successMessage, extra = {}) {
  if (requestPending) {
    return;
  }
  requestPending = true;
  const actionButtons = context.dialog.querySelectorAll('.modal-footer button');
  actionButtons.forEach(button => {
    button.disabled = true;
  });

  try {
    const { error } = await invokeAccess(action, extra);
    if (error) {
      showToast('Permintaan belum dapat diproses. Periksa data lalu coba lagi.', {
        variant: 'error'
      });
      context.close();
      requestPending = false;
      await loadStatus();
      return;
    }
    context.close();
    showToast(successMessage, { variant: 'success' });
    requestPending = false;
    await loadStatus();
  } catch {
    showToast('Permintaan belum dapat diproses. Silakan coba lagi.', { variant: 'error' });
  } finally {
    requestPending = false;
    actionButtons.forEach(button => {
      button.disabled = false;
    });
  }
}

function openInviteModal() {
  const body = modalEmail(snapshot?.email);
  if (snapshot?.requiresLinkConfirmation) {
    body.appendChild(
      element(
        'p',
        'client-portal-access-warning',
        'Email ini sudah memiliki akun client yang belum terhubung. Konfirmasi untuk menghubungkannya ke client ini dan mengirim email pengaturan password.'
      )
    );
  } else {
    body.appendChild(
      element(
        'p',
        'client-portal-access-copy',
        'Sistem akan membuat akun client, menghubungkannya ke data client ini, lalu mengirim email untuk membuat password.'
      )
    );
  }

  showModal({
    title: snapshot?.requiresLinkConfirmation
      ? 'Hubungkan akun Client Portal?'
      : 'Kirim undangan Client Portal?',
    body,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: snapshot?.requiresLinkConfirmation ? 'Hubungkan & Kirim' : 'Kirim Undangan',
        variant: 'primary',
        closeOnAction: false,
        action: context =>
          performAction('invite', context, 'Undangan Client Portal berhasil dikirim.', {
            confirmExisting: snapshot?.requiresLinkConfirmation === true
          })
      }
    ]
  });
}

function openResendModal() {
  const body = modalEmail(snapshot?.email);
  body.appendChild(
    element(
      'p',
      'client-portal-access-copy',
      'Email baru akan dikirim agar PIC dapat membuat atau mengatur ulang password Client Portal.'
    )
  );
  showModal({
    title: 'Kirim ulang pengaturan password?',
    body,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Kirim Ulang',
        variant: 'primary',
        closeOnAction: false,
        action: context =>
          performAction('resend', context, 'Email pengaturan password berhasil dikirim ulang.')
      }
    ]
  });
}

function openAccessChangeModal(action) {
  const enabling = action === 'reactivate';
  const body = modalEmail(snapshot?.email);
  body.appendChild(
    element(
      'p',
      enabling ? 'client-portal-access-copy' : 'client-portal-access-warning',
      enabling
        ? 'Akun akan kembali memperoleh akses sesuai relasi client dan kebijakan RLS.'
        : 'Akun akan segera ditolak oleh route guard dan RLS tidak lagi memberikan akses data client.'
    )
  );
  showModal({
    title: enabling ? 'Aktifkan kembali akses?' : 'Nonaktifkan akses Client Portal?',
    body,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: enabling ? 'Aktifkan Kembali' : 'Nonaktifkan',
        variant: enabling ? 'primary' : 'danger',
        closeOnAction: false,
        action: context =>
          performAction(
            action,
            context,
            enabling
              ? 'Akses Client Portal berhasil diaktifkan.'
              : 'Akses Client Portal berhasil dinonaktifkan.'
          )
      }
    ]
  });
}

function providerChip(provider) {
  if (provider === 'google') {
    return { label: 'Google', chipClass: 'chip-blue' };
  }
  return { label: 'Email & Password', chipClass: 'chip-primary' };
}

function button(label, variant, action) {
  const control = element('button', `btn btn-${variant}`, label);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
}

function openManageModal() {
  const body = modalEmail(snapshot?.email);
  body.appendChild(
    element(
      'p',
      'client-portal-access-copy',
      snapshot?.emailMatches === false
        ? 'Email PIC berbeda dari email akun yang terhubung. Perbarui Email PIC sebelum mengirim ulang pengaturan password.'
        : 'Pilih tindakan untuk akun Client Portal yang terhubung.'
    )
  );

  if (snapshot?.authProviders && !snapshot.authProviders.includes('email')) {
    body.appendChild(
      element(
        'p',
        'client-portal-access-copy',
        'Client ini masuk lewat Google, tidak ada password untuk direset.'
      )
    );
  }

  const actions = [{ label: 'Tutup', variant: 'outline' }];
  if (snapshot?.emailMatches !== false && snapshot?.authProviders?.includes('email')) {
    actions.push({
      label: 'Reset Password',
      variant: 'primary',
      closeOnAction: false,
      action: context =>
        performAction('resend', context, 'Email pengaturan password berhasil dikirim ulang.')
    });
  }
  if (snapshot?.canManageAccess) {
    actions.push({
      label: 'Nonaktifkan',
      variant: 'danger',
      closeOnAction: false,
      action: context =>
        performAction('disable', context, 'Akses Client Portal berhasil dinonaktifkan.')
    });
  }
  showModal({ title: 'Kelola Akses Client Portal', body, size: 'sm', actions });
}

function renderStatus() {
  const badge = root
    .closest('.client-portal-access')
    .querySelector('[data-client-portal-access-badge]');
  const message = root.querySelector('[data-client-portal-access-message]');
  const actions = root.querySelector('[data-client-portal-access-actions]');
  actions.replaceChildren();

  const existingAuthMethod = root.querySelector('[data-client-portal-access-auth-method]');
  if (existingAuthMethod) {
    existingAuthMethod.remove();
  }

  const view = STATUS_VIEW[snapshot?.status] || STATUS_VIEW.NOT_INVITED;
  badge.className = `status ${view.className}`;
  badge.textContent = view.label;
  message.textContent = view.message;

  if (!snapshot?.email) {
    message.textContent = 'Email PIC belum tersedia. Gunakan Edit Info sebelum mengirim undangan.';
  } else if (snapshot.status === 'NOT_INVITED') {
    actions.appendChild(button('Kirim Undangan', 'primary', openInviteModal));
  } else if (snapshot.status === 'INVITED') {
    actions.appendChild(button('Kirim Ulang', 'outline', openResendModal));
  } else if (snapshot.status === 'ACTIVE') {
    if (snapshot.authProviders && snapshot.authProviders.length) {
      const authMethod = element('div', 'client-portal-auth-method');
      authMethod.setAttribute('data-client-portal-access-auth-method', '');
      authMethod.appendChild(element('span', 'client-portal-auth-method-label', 'Metode login'));
      snapshot.authProviders.forEach(provider => {
        const { label, chipClass } = providerChip(provider);
        authMethod.appendChild(element('span', `chip ${chipClass}`, label));
      });
      message.insertAdjacentElement('afterend', authMethod);
    }
    actions.appendChild(button('Kelola Akses', 'outline', openManageModal));
  } else if (snapshot.status === 'DISABLED' && snapshot.canManageAccess) {
    actions.appendChild(
      button('Aktifkan Kembali', 'primary', () => openAccessChangeModal('reactivate'))
    );
  }
  root.setAttribute('aria-busy', 'false');
}

function renderError() {
  const badge = root
    .closest('.client-portal-access')
    .querySelector('[data-client-portal-access-badge]');
  badge.className = 'status status-red';
  badge.textContent = 'Tidak tersedia';
  root.querySelector('[data-client-portal-access-message]').textContent =
    'Status akses belum dapat dimuat. Periksa konfigurasi layanan lalu coba lagi.';
  const actions = root.querySelector('[data-client-portal-access-actions]');
  actions.replaceChildren(button('Coba lagi', 'outline', loadStatus));
  root.setAttribute('aria-busy', 'false');
}

async function loadStatus() {
  if (!root || requestPending) {
    return;
  }
  setLoading(true);
  try {
    const { data, error } = await invokeAccess('status');
    if (error || !data?.status) {
      renderError();
      return;
    }
    snapshot = data;
    renderStatus();
  } catch {
    renderError();
  } finally {
    setLoading(false);
  }
}

export async function initClientPortalAccess(options) {
  const nextRoot = document.querySelector('[data-client-portal-access-root]');
  if (!nextRoot) {
    return;
  }
  root = nextRoot;
  clientId = options?.clientId || '';
  currentProfile = options?.profile || null;

  if (!isStaffActive(currentProfile)) {
    root.querySelector('[data-client-portal-access-message]').textContent =
      'Akses status portal tidak tersedia untuk akun ini.';
    root.setAttribute('aria-busy', 'false');
    return;
  }
  await loadStatus();
}
