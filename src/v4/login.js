// SMA-app — login page logic. Two-step OTP: request code by email, then
// verify the 6-digit code. No password, no self-signup (see src/lib/auth.js).

import { requestOtp, verifyOtp, getSession } from '../lib/auth.js';
import { recordLoginHistory } from '../lib/login-history.js';
import { showToast } from './toast.js';

export async function initLogin() {
  // Already logged in — skip the form entirely.
  const session = await getSession();
  if (session) {
    window.location.href = 'index.html';
    return;
  }

  const emailStep = document.getElementById('otp-email-step');
  const codeStep = document.getElementById('otp-code-step');
  const emailForm = document.getElementById('otp-email-form');
  const codeForm = document.getElementById('otp-code-form');
  const emailInput = document.getElementById('otp-email');
  const codeInput = document.getElementById('otp-code');
  const emailDisplay = document.getElementById('otp-email-display');
  const backBtn = document.getElementById('otp-back');
  const resendBtn = document.getElementById('otp-resend');
  let currentEmail = '';

  function setBusy(form, busy, idleLabel) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = busy;
    btn.textContent = busy ? 'Mengirim…' : idleLabel;
  }

  async function sendCode(email) {
    const { error } = await requestOtp(email);
    if (error) {
      showToast(error.message || 'Gagal mengirim kode. Coba lagi.', { variant: 'error' });
      return false;
    }
    showToast('Kode terkirim. Cek email kamu.', { variant: 'success' });
    return true;
  }

  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    currentEmail = emailInput.value.trim();
    setBusy(emailForm, true, 'Kirim kode');
    const ok = await sendCode(currentEmail);
    setBusy(emailForm, false, 'Kirim kode');
    if (!ok) {return;}

    emailDisplay.textContent = currentEmail;
    emailStep.style.display = 'none';
    codeStep.style.display = '';
    codeInput.value = '';
    codeInput.focus();
  });

  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = codeForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Memverifikasi…';
    const { data, error } = await verifyOtp(currentEmail, codeInput.value.trim());
    btn.disabled = false;
    btn.textContent = 'Verifikasi';
    if (error) {
      showToast(error.message || 'Kode salah atau sudah kadaluarsa.', { variant: 'error' });
      return;
    }
    // Awaited: it's one fast insert (device/os/browser only) — IP/location
    // enrichment happens separately afterward and is NOT awaited here (see
    // src/lib/login-history.js). Awaiting the whole thing here, including
    // the IP lookup, used to mean navigating away almost always tore down
    // the page mid-fetch before the insert ever ran, so no row was ever
    // written at all.
    const userId = data?.user?.id;
    if (userId) {await recordLoginHistory(userId);}
    window.location.href = 'index.html';
  });

  backBtn.addEventListener('click', () => {
    codeStep.style.display = 'none';
    emailStep.style.display = '';
  });

  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    await sendCode(currentEmail);
    resendBtn.disabled = false;
  });
}
