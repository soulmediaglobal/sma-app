// SMA-app — Payments tab on Client Detail.
// Shows RAB and receivable totals, payment terms per project, and records an
// activity for each successful transition from Pending to Lunas.

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

const PAYMENT_TYPES = ['DP', 'Pelunasan'];
const PENDING_STATUS = 'Pending';
const PAID_STATUS = 'Lunas';

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR'
});

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

let initialized = false;
let activeClientId = '';
let currentProfile = null;
let projects = [];
let paymentsById = new Map();
let canManagePayments = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined) {node.textContent = text;}
  return node;
}

function numericValue(value, { nullAsZero = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return nullAsZero ? 0 : Number.NaN;
  }
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : Number.NaN;
}

function formatRupiah(value) {
  return Number.isFinite(value) ? rupiah.format(value) : 'Nilai tidak valid';
}

function setPanelState(root, message, state) {
  root.replaceChildren();
  const status = element('div', `client-payments-state client-payments-state-${state}`, message);
  status.setAttribute('role', state === 'error' ? 'alert' : 'status');
  root.appendChild(status);
  root.dataset.state = state;
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function formatDate(value) {
  if (!value) {return '—';}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFmt.format(date);
}

function createSummary(paymentRows) {
  const totalRab = projects.reduce(
    (sum, project) => sum + numericValue(project.total_rab, { nullAsZero: true }),
    0
  );
  const totalPaid = paymentRows.reduce(
    (sum, payment) => sum + (payment.status === PAID_STATUS ? numericValue(payment.amount) : 0),
    0
  );
  const remaining = totalRab - totalPaid;
  const summary = element('div', 'client-payment-summary');

  [
    ['Total RAB', totalRab],
    ['Total sudah dibayar', totalPaid],
    ['Sisa piutang', remaining]
  ].forEach(([label, value]) => {
    const card = element('div', 'client-payment-summary-card');
    card.append(
      element('span', 'client-payment-summary-label', label),
      element('strong', 'client-payment-summary-value', formatRupiah(value))
    );
    summary.appendChild(card);
  });

  return summary;
}

function createPaymentRow(payment) {
  const row = element('li', 'client-payment-row');
  const info = element('div', 'client-payment-info');
  info.append(
    element('div', 'client-payment-type', payment.type),
    element('div', 'client-payment-created', `Dibuat ${formatDate(payment.created_at)}`)
  );

  const amount = element('strong', 'client-payment-amount', formatRupiah(numericValue(payment.amount)));
  const status = element(
    'span',
    `status client-payment-status ${payment.status === PAID_STATUS ? 'status-green' : 'status-yellow'}`,
    payment.status
  );
  const paidAt = element(
    'span',
    'client-payment-paid-at',
    payment.status === PAID_STATUS ? `Dibayar ${formatDate(payment.paid_at)}` : 'Belum dibayar'
  );
  const actions = element('div', 'client-payment-actions');
  actions.append(status, paidAt);

  if (canManagePayments && payment.status === PENDING_STATUS) {
    const markPaid = element('button', 'btn btn-primary btn-sm', 'Tandai Lunas');
    markPaid.type = 'button';
    markPaid.dataset.markPaymentPaid = '';
    markPaid.dataset.paymentId = payment.id;
    markPaid.dataset.caseId = payment.case_id;
    actions.appendChild(markPaid);
  }

  row.append(info, amount, actions);
  return row;
}

function createProjectGroup(project, paymentRows) {
  const group = element('article', 'client-payment-project');
  const header = element('div', 'client-payment-project-header');
  const heading = element('div');
  heading.append(
    element('h2', '', project.service_type),
    element(
      'div',
      'client-payment-project-rab',
      `RAB ${formatRupiah(numericValue(project.total_rab, { nullAsZero: true }))}`
    )
  );
  header.appendChild(heading);

  if (canManagePayments) {
    const addButton = element('button', 'btn btn-outline btn-sm', '+ Tambah Termin');
    addButton.type = 'button';
    addButton.dataset.addPayment = '';
    addButton.dataset.caseId = project.id;
    addButton.dataset.projectName = project.service_type;
    header.appendChild(addButton);
  }

  group.appendChild(header);
  if (paymentRows.length === 0) {
    group.appendChild(element('div', 'client-payment-empty', 'Belum ada pembayaran untuk project ini.'));
    return group;
  }

  const list = element('ul', 'client-payment-list');
  paymentRows.forEach((payment) => list.appendChild(createPaymentRow(payment)));
  group.appendChild(list);
  return group;
}

function renderPayments(root, paymentRows) {
  root.replaceChildren();
  paymentsById = new Map(paymentRows.map((payment) => [payment.id, payment]));
  const rowsByCase = new Map();
  paymentRows.forEach((payment) => {
    const rows = rowsByCase.get(payment.case_id) || [];
    rows.push(payment);
    rowsByCase.set(payment.case_id, rows);
  });

  root.appendChild(createSummary(paymentRows));
  const list = element('div', 'client-payment-project-list');
  projects.forEach((project) => {
    list.appendChild(createProjectGroup(project, rowsByCase.get(project.id) || []));
  });
  root.appendChild(list);
  root.dataset.state = 'ready';
  root.setAttribute('aria-busy', 'false');
}

async function loadPayments(root) {
  setPanelState(root, 'Memuat pembayaran…', 'loading');
  projects = [];
  paymentsById.clear();
  try {
    const { data: caseRows, error: caseError } = await supabase
      .from('cases')
      .select('id, client_id, service_type, total_rab, created_at')
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

    const { data: paymentRows, error: paymentError } = await supabase
      .from('payments')
      .select('id, case_id, type, amount, status, paid_at, created_at')
      .in('case_id', projects.map((project) => project.id))
      .order('created_at', { ascending: true });

    if (paymentError) {
      setPanelState(root, 'Gagal memuat pembayaran.', 'error');
      return;
    }

    renderPayments(root, paymentRows || []);
  } catch {
    setPanelState(root, 'Gagal memuat pembayaran.', 'error');
  }
}

function buildPaymentForm(projectName) {
  const form = document.createElement('form');
  form.id = 'payment-form';
  form.noValidate = true;

  const context = element('div', 'client-payment-form-context');
  context.append(element('span', '', 'Project'), element('strong', '', projectName));

  const typeGroup = element('div', 'form-group');
  const typeLabel = element('label', 'form-label', 'Jenis pembayaran');
  typeLabel.htmlFor = 'payment-type';
  const typeSelect = element('select', 'form-control');
  typeSelect.id = 'payment-type';
  typeSelect.name = 'type';
  typeSelect.required = true;
  PAYMENT_TYPES.forEach((type) => {
    const option = element('option', '', type);
    option.value = type;
    typeSelect.appendChild(option);
  });
  typeGroup.append(typeLabel, typeSelect);

  const amountGroup = element('div', 'form-group');
  const amountLabel = element('label', 'form-label', 'Jumlah pembayaran');
  amountLabel.htmlFor = 'payment-amount';
  const amountInput = element('input', 'form-control');
  amountInput.id = 'payment-amount';
  amountInput.name = 'amount';
  amountInput.type = 'number';
  amountInput.min = '1';
  amountInput.step = 'any';
  amountInput.required = true;
  amountGroup.append(amountLabel, amountInput);

  form.append(context, typeGroup, amountGroup);
  return form;
}

async function submitPayment(ctx, form, root, caseId) {
  if (!canManagePayments || !form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}

  const type = form.elements.namedItem('type').value.trim();
  const amount = Number(form.elements.namedItem('amount').value.trim());
  if (!PAYMENT_TYPES.includes(type) || !Number.isFinite(amount) || amount <= 0) {
    showToast('Jenis atau jumlah pembayaran tidak valid.', { variant: 'error' });
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';
  try {
    const { error } = await supabase.from('payments').insert({ case_id: caseId, type, amount });
    if (error) {
      showToast('Gagal menambahkan termin.', { variant: 'error' });
      return;
    }

    ctx.close();
    showToast('Termin berhasil ditambahkan.', { variant: 'success' });
    await loadPayments(root);
  } catch {
    showToast('Gagal menambahkan termin.', { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Tambah Termin';
  }
}

function openAddPaymentModal(root, trigger) {
  if (!canManagePayments) {return;}
  const caseId = trigger.dataset.caseId;
  if (!projects.some((project) => project.id === caseId)) {
    showToast('Project tidak ditemukan.', { variant: 'error' });
    return;
  }

  const form = buildPaymentForm(trigger.dataset.projectName);
  const ctx = showModal({
    title: 'Tambah Termin',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Tambah Termin',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitPayment(ctx, form, root, caseId);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitPayment(ctx, form, root, caseId);
  });
}

async function insertPaymentActivity({ caseId, paymentType, amount }) {
  if (!currentProfile?.id) {return { error: new Error('Profil pengguna tidak tersedia') };}
  try {
    return await supabase.from('activities').insert({
      client_id: activeClientId,
      case_id: caseId,
      type: 'Status Pembayaran',
      notes: `${paymentType} sebesar ${formatRupiah(amount)} diubah dari Pending menjadi Lunas.`,
      by_user: currentProfile.id
    });
  } catch (error) {
    return { error };
  }
}

async function rollbackPayment(paymentId, caseId, paidAt, oldStatus, oldPaidAt) {
  try {
    return await supabase
      .from('payments')
      .update({ status: oldStatus, paid_at: oldPaidAt }, { count: 'exact' })
      .eq('id', paymentId)
      .eq('case_id', caseId)
      .eq('status', PAID_STATUS)
      .eq('paid_at', paidAt);
  } catch (error) {
    return { error, count: null };
  }
}

async function markPaymentPaid(root, trigger) {
  if (!canManagePayments || trigger.disabled) {return;}
  const paymentId = trigger.dataset.paymentId;
  const caseId = trigger.dataset.caseId;
  const payment = paymentsById.get(paymentId);
  const paidAt = new Date().toISOString();
  if (
    !payment ||
    payment.case_id !== caseId ||
    payment.status !== PENDING_STATUS ||
    payment.paid_at ||
    !projects.some((project) => project.id === caseId)
  ) {
    showToast('Pembayaran tidak dapat ditandai lunas.', { variant: 'error' });
    return;
  }
  trigger.disabled = true;

  try {
    const updateQuery = supabase
      .from('payments')
      .update({ status: PAID_STATUS, paid_at: paidAt }, { count: 'exact' })
      .eq('id', paymentId)
      .eq('case_id', caseId)
      .eq('status', PENDING_STATUS)
      .is('paid_at', null);
    const { error: updateError, count: updatedCount } = await updateQuery;

    if (updateError || updatedCount !== 1) {
      showToast('Gagal menandai pembayaran lunas.', { variant: 'error' });
      await loadPayments(root);
      return;
    }

    const amount = numericValue(payment.amount);
    const { error: activityError } = await insertPaymentActivity({
      caseId,
      paymentType: payment.type,
      amount
    });
    if (activityError) {
      const { error: rollbackError, count: rollbackCount } = await rollbackPayment(
        paymentId,
        caseId,
        paidAt,
        PENDING_STATUS,
        null
      );
      if (rollbackError || rollbackCount !== 1) {
        showToast('Pembayaran lunas, tetapi aktivitas gagal dicatat. Hubungi admin.', {
          variant: 'error',
          duration: 5000
        });
      } else {
        showToast('Perubahan dibatalkan karena aktivitas gagal dicatat.', { variant: 'error' });
      }
      await loadPayments(root);
      return;
    }

    showToast('Pembayaran berhasil ditandai lunas.', { variant: 'success' });
    await loadPayments(root);
  } catch {
    showToast('Gagal menandai pembayaran lunas.', { variant: 'error' });
    await loadPayments(root);
  } finally {
    if (trigger.isConnected) {trigger.disabled = false;}
  }
}

function wireActions(root) {
  root.addEventListener('click', (event) => {
    const addTrigger = event.target.closest('[data-add-payment]');
    if (addTrigger) {
      openAddPaymentModal(root, addTrigger);
      return;
    }

    const paidTrigger = event.target.closest('[data-mark-payment-paid]');
    if (paidTrigger) {markPaymentPaid(root, paidTrigger);}
  });
}

export async function initClientPayments({ clientId, profile } = {}) {
  const root = document.getElementById('client-payments-root');
  if (!root || initialized) {return;}
  initialized = true;
  activeClientId = clientId || '';
  currentProfile = profile || null;

  const role = currentProfile?.role;
  if (!['admin', 'internal', 'client'].includes(role)) {
    setPanelState(root, 'Anda tidak memiliki akses ke pembayaran client.', 'error');
    return;
  }

  canManagePayments = ['admin', 'internal'].includes(role);
  wireActions(root);
  await loadPayments(root);
}
