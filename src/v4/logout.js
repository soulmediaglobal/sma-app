import { signOut } from '../lib/auth.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

let activeLogoutPromise = null;

export function performLocalLogout(redirectTo = 'login.html') {
  if (activeLogoutPromise) {
    return activeLogoutPromise;
  }

  const operation = (async () => {
    try {
      const { error } = await signOut(redirectTo);
      if (!error) {
        return true;
      }
    } catch {
      // The user-facing failure is intentionally generic below.
    }
    showToast('Sesi belum dapat diakhiri. Silakan coba lagi.', { variant: 'error' });
    return false;
  })();

  activeLogoutPromise = operation;
  operation.then(succeeded => {
    if (!succeeded && activeLogoutPromise === operation) {
      activeLogoutPromise = null;
    }
  });
  return operation;
}

export function showLocalLogoutModal(redirectTo = 'login.html') {
  let pending = false;
  let modalHandle = null;

  modalHandle = showModal({
    title: 'Keluar?',
    size: 'sm',
    body: '<p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin:0">Anda perlu masuk kembali untuk mengakses dashboard.</p>',
    canClose: () => !pending,
    actions: [
      { label: 'Batal', variant: 'ghost' },
      {
        label: 'Keluar',
        variant: 'primary',
        closeOnAction: false,
        action: async () => {
          if (pending) {
            return;
          }
          pending = true;
          const buttons = modalHandle.dialog.querySelectorAll('button');
          const actionButton = modalHandle.dialog.querySelector('.modal-footer .btn-primary');
          buttons.forEach(button => {
            button.disabled = true;
          });
          actionButton.textContent = 'Keluar…';

          const succeeded = await performLocalLogout(redirectTo);
          if (!succeeded) {
            pending = false;
            buttons.forEach(button => {
              button.disabled = false;
            });
            actionButton.textContent = 'Keluar';
          }
        }
      }
    ]
  });

  return modalHandle;
}
