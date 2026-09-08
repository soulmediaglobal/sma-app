// SMA-app — Payments tab on Client Detail.
// Shows RAB and receivable totals, payment terms per project, and records an
// activity for each successful transition from Pending to Lunas.

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { fetchBankAccount, docEl, PREVIEW_CSS, getQuotationsByCaseId } from './client-quotations.js';

const PAYMENT_TYPES = ['DP', 'Pelunasan'];
const PENDING_STATUS = 'Pending';
const PAID_STATUS = 'Lunas';

const PROOF_BUCKET = 'payment-proofs';
const MAX_PROOF_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_PROOF_MIME_TYPES = new Map([
  ['application/pdf', { label: 'PDF', extension: 'pdf' }],
  ['image/jpeg', { label: 'JPEG', extension: 'jpg' }],
  ['image/png', { label: 'PNG', extension: 'png' }],
  ['image/gif', { label: 'GIF', extension: 'gif' }]
]);
const VERIFICATION_UNVERIFIED = 'BELUM_BAYAR';
const VERIFICATION_UPLOADED = 'BUKTI_DIUPLOAD';
const VERIFICATION_VERIFIED = 'TERVERIFIKASI';

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

function findAcceptedQuotation(caseId) {
  const quotations = getQuotationsByCaseId().get(caseId) || [];
  return quotations.find((q) => q.status === 'ACCEPTED') || null;
}

async function buildInvoicePreviewContent(doc, data) {
  const { generatedDate, invoiceNumber, quotationNumber, client, project, termName, amount, bankAccount } = data;
  const root = docEl(doc, 'div', 'preview-doc');

  const letterhead = docEl(doc, 'div', 'preview-letterhead');
  letterhead.appendChild(docEl(doc, 'div', 'preview-company-name', 'Soul Mitra Abadi'));
  letterhead.appendChild(docEl(doc, 'div', 'preview-doc-title', 'Invoice'));
  root.appendChild(letterhead);

  const meta = docEl(doc, 'div', 'preview-meta');
  meta.appendChild(docEl(doc, 'span', '', `Tanggal: ${generatedDate}`));
  meta.appendChild(docEl(doc, 'span', '', `No. Invoice: ${invoiceNumber || '—'}`));
  meta.appendChild(docEl(doc, 'span', '', `Ref. RAB: ${quotationNumber || '—'}`));
  root.appendChild(meta);

  root.appendChild(docEl(doc, 'p', 'preview-perihal', `Untuk: ${project?.service_type || '—'} (${project?.case_number || '—'})`));

  const kepada = docEl(doc, 'div', 'preview-kepada');
  kepada.appendChild(docEl(doc, 'p', '', 'Kepada Yth.'));
  const picLine = [client?.pic_name, client?.pic_title].filter(Boolean).join(', ');
  kepada.appendChild(docEl(doc, 'p', '', `Bpk/Ibu ${picLine || '—'}`));
  const companyLine = [client?.type, client?.name].filter(Boolean).join(' ');
  kepada.appendChild(docEl(doc, 'p', '', companyLine || '—'));
  root.appendChild(kepada);

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Rincian Tagihan'));
  const tableWrap = docEl(doc, 'div', 'preview-table-wrap');
  const table = doc.createElement('table');
  table.className = 'preview-table';
  const tbody = doc.createElement('tbody');
  const row = doc.createElement('tr');
  const tdLabel = doc.createElement('td');
  tdLabel.textContent = termName || '—';
  const tdAmount = doc.createElement('td');
  tdAmount.textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount || 0);
  row.append(tdLabel, tdAmount);
  tbody.appendChild(row);
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  root.appendChild(tableWrap);

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Rekening Pembayaran'));
  if (bankAccount) {
    const rek = docEl(doc, 'div', 'preview-rekening');
    rek.appendChild(docEl(doc, 'p', '', `Bank: ${bankAccount.bank_name}`));
    rek.appendChild(docEl(doc, 'p', '', `No. Rekening: ${bankAccount.account_number}`));
    rek.appendChild(docEl(doc, 'p', '', `Atas Nama: ${bankAccount.account_holder_name}`));
    root.appendChild(rek);
  } else {
    root.appendChild(docEl(doc, 'p', 'preview-empty', 'Rekening bank belum tersedia.'));
  }

  return root;
}

function renderInvoicePreviewWindow(win, data) {
  const doc = win.document;
  doc.title = data.invoiceNumber ? `Invoice — ${data.invoiceNumber}` : 'Invoice';

  doc.head.replaceChildren();
  const meta = doc.createElement('meta');
  meta.setAttribute('charset', 'utf-8');
  doc.head.appendChild(meta);
  const style = doc.createElement('style');
  style.textContent = PREVIEW_CSS;
  doc.head.appendChild(style);

  doc.body.replaceChildren();

  const toolbar = docEl(doc, 'div', 'preview-toolbar');
  const printBtn = docEl(doc, 'button', 'primary', 'Print / Simpan sebagai PDF');
  printBtn.type = 'button';
  printBtn.addEventListener('click', () => win.print());
  const closeBtn = docEl(doc, 'button', '', 'Tutup');
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', () => win.close());
  toolbar.append(printBtn, closeBtn);
  doc.body.appendChild(toolbar);

  const page = docEl(doc, 'div', 'preview-page');
  buildInvoicePreviewContent(doc, data).then((content) => {
    page.appendChild(content);
  });
  doc.body.appendChild(page);
}

export async function openInvoicePreview(payment, project, client) {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Popup diblokir browser. Izinkan popup untuk membuka preview dokumen.', { variant: 'error' });
    return;
  }
  win.document.title = 'Memuat Invoice…';
  const loading = docEl(win.document, 'p', '', 'Memuat dokumen…');
  loading.style.cssText = 'font-family: Arial, sans-serif; padding: 24px;';
  win.document.body.appendChild(loading);

  const quotation = findAcceptedQuotation(payment.case_id);
  const bankAccount = quotation ? await fetchBankAccount(quotation.bank_account_id) : null;

  if (win.closed) {return;}

  renderInvoicePreviewWindow(win, {
    generatedDate: dateFmt.format(new Date(payment.invoice_issued_at || payment.created_at)),
    invoiceNumber: payment.invoice_number,
    quotationNumber: quotation?.quotation_number,
    client,
    project,
    termName: payment.type,
    amount: payment.amount,
    bankAccount
  });
}

function createPaymentRow(payment) {
  const row = element('li', 'client-payment-row');
  const info = element('div', 'client-payment-info');
  info.append(
    element('div', 'client-payment-type', payment.type),
    element('div', 'client-payment-created', `Dibuat ${formatDate(payment.created_at)}`)
  );
  if (payment.invoice_number) {
    const invoiceLine = element('div', 'client-payment-invoice-number');
    invoiceLine.textContent = payment.invoice_number;
    const previewLink = element('button', 'btn btn-outline btn-sm client-payment-invoice-preview', 'Lihat Invoice');
    previewLink.type = 'button';
    previewLink.addEventListener('click', () => {
      const project = projects.find((p) => p.id === payment.case_id);
      openInvoicePreview(payment, project, null);
    });
    invoiceLine.appendChild(previewLink);
    info.appendChild(invoiceLine);
  }

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
    if (!payment.verification_status || payment.verification_status === VERIFICATION_UNVERIFIED) {
      const uploadBtn = element('button', 'btn btn-outline btn-sm', 'Upload Bukti Transfer');
      uploadBtn.type = 'button';
      uploadBtn.dataset.uploadProof = '';
      uploadBtn.dataset.paymentId = payment.id;
      uploadBtn.dataset.caseId = payment.case_id;
      actions.appendChild(uploadBtn);
    } else if (payment.verification_status === VERIFICATION_UPLOADED) {
      const viewBtn = element('button', 'btn btn-outline btn-sm', 'Lihat Bukti');
      viewBtn.type = 'button';
      viewBtn.dataset.viewProof = '';
      viewBtn.dataset.paymentId = payment.id;
      actions.appendChild(viewBtn);

      const verifyBtn = element('button', 'btn btn-outline btn-sm', 'Verifikasi');
      verifyBtn.type = 'button';
      verifyBtn.dataset.verifyProof = '';
      verifyBtn.dataset.paymentId = payment.id;
      verifyBtn.dataset.caseId = payment.case_id;
      actions.appendChild(verifyBtn);
    } else if (payment.verification_status === VERIFICATION_VERIFIED) {
      const verifiedBadge = element('span', 'status status-green', 'Bukti Terverifikasi');
      actions.appendChild(verifiedBadge);

      const markPaid = element('button', 'btn btn-primary btn-sm', 'Tandai Lunas');
      markPaid.type = 'button';
      markPaid.dataset.markPaymentPaid = '';
      markPaid.dataset.paymentId = payment.id;
      markPaid.dataset.caseId = payment.case_id;
      actions.appendChild(markPaid);
    }
  }

  row.append(info, amount, actions);
  return row;
}

function uploadPaymentProof(root, trigger) {
  if (!canManagePayments || trigger.disabled) {return;}
  const paymentId = trigger.dataset.paymentId;
  const caseId = trigger.dataset.caseId;
  const payment = paymentsById.get(paymentId);
  if (!payment || payment.case_id !== caseId) {
    showToast('Pembayaran tidak ditemukan.', { variant: 'error' });
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = Array.from(ALLOWED_PROOF_MIME_TYPES.keys()).join(',');
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    document.body.removeChild(input);
    if (!file) {return;}

    const typeInfo = ALLOWED_PROOF_MIME_TYPES.get(file.type);
    if (!typeInfo) {
      showToast('Gunakan file PDF, JPG/JPEG, PNG, atau GIF.', { variant: 'error' });
      return;
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_PROOF_FILE_SIZE) {
      showToast('Ukuran file maksimal 10 MB.', { variant: 'error' });
      return;
    }

    trigger.disabled = true;
    const storagePath = `${caseId}/${crypto.randomUUID()}.${typeInfo.extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      showToast('Gagal upload bukti transfer.', { variant: 'error' });
      trigger.disabled = false;
      return;
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        proof_storage_path: storagePath,
        proof_uploaded_at: new Date().toISOString(),
        verification_status: VERIFICATION_UPLOADED
      })
      .eq('id', paymentId)
      .eq('case_id', caseId);

    if (updateError) {
      await supabase.storage.from(PROOF_BUCKET).remove([storagePath]);
      showToast('Gagal menyimpan bukti transfer.', { variant: 'error' });
      trigger.disabled = false;
      return;
    }

    showToast('Bukti transfer berhasil diupload.', { variant: 'success' });
    await loadPayments(root);
  });

  input.click();
}

async function viewPaymentProof(trigger) {
  if (trigger.disabled) {return;}
  const paymentId = trigger.dataset.paymentId;
  const payment = paymentsById.get(paymentId);
  if (!payment?.proof_storage_path) {
    showToast('Bukti transfer tidak ditemukan.', { variant: 'error' });
    return;
  }

  trigger.disabled = true;
  try {
    const { data, error } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrl(payment.proof_storage_path, 60);
    if (error || !data?.signedUrl) {
      showToast('Bukti transfer belum dapat dibuka. Silakan coba lagi.', { variant: 'error' });
      return;
    }
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  } finally {
    trigger.disabled = false;
  }
}

async function verifyPaymentProof(root, trigger) {
  if (!canManagePayments || trigger.disabled) {return;}
  const paymentId = trigger.dataset.paymentId;
  const caseId = trigger.dataset.caseId;
  const payment = paymentsById.get(paymentId);
  if (!payment || payment.case_id !== caseId || payment.verification_status !== VERIFICATION_UPLOADED) {
    showToast('Bukti transfer belum dapat diverifikasi.', { variant: 'error' });
    return;
  }

  trigger.disabled = true;
  const { error } = await supabase
    .from('payments')
    .update({ verification_status: VERIFICATION_VERIFIED })
    .eq('id', paymentId)
    .eq('case_id', caseId)
    .eq('verification_status', VERIFICATION_UPLOADED);

  if (error) {
    showToast('Gagal memverifikasi bukti transfer.', { variant: 'error' });
    trigger.disabled = false;
    return;
  }

  showToast('Bukti transfer diverifikasi.', { variant: 'success' });
  await loadPayments(root);
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
      .select('id, case_id, type, amount, status, paid_at, created_at, invoice_number, invoice_issued_at, quotation_item_id, verification_status, proof_storage_path')
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
    payment.verification_status !== VERIFICATION_VERIFIED ||
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
    if (paidTrigger) {markPaymentPaid(root, paidTrigger); return;}

    const uploadTrigger = event.target.closest('[data-upload-proof]');
    if (uploadTrigger) {uploadPaymentProof(root, uploadTrigger); return;}

    const viewProofTrigger = event.target.closest('[data-view-proof]');
    if (viewProofTrigger) {viewPaymentProof(viewProofTrigger); return;}

    const verifyTrigger = event.target.closest('[data-verify-proof]');
    if (verifyTrigger) {verifyPaymentProof(root, verifyTrigger);}
  });
}

export async function getInvoicedTerminIds(caseIds) {
  if (!caseIds.length) {return new Map();}
  const { data, error } = await supabase
    .from('payments')
    .select('id, case_id, invoice_number, invoice_issued_at, created_at, amount, quotation_item_id')
    .in('case_id', caseIds)
    .not('quotation_item_id', 'is', null);
  if (error) {return new Map();}
  return new Map((data || []).map((row) => [row.quotation_item_id, row]));
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
