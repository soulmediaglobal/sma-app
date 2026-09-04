// SMA-app — "RAB & Penawaran" section on the Project tab (client-detail.js).
// PRD_Project_Intake_RAB_Workflow_SMA-app.md §1/§2: independent section per
// project, opened on-demand, showing ALL case_quotations versions (not just
// the latest — old versions stay visible even after NEGOTIATING/SUPERSEDED).
//
// RLS (supabase/migrations/20260823050000_project_part5_tighten_quotation_rls.sql):
// internal can only insert/update case_quotations/case_quotation_items while
// status stays DRAFT; admin/supervisor are unrestricted. "Buat Penawaran"
// (DRAFT -> SENT) is therefore hidden/disabled here for internal — this is
// UX clarity only, RLS is the real enforcement.
//
// Document multi-select mechanics (confirmed with Ray, not guessed): picking
// a document_templates row inserts a `documents` row immediately (case_id,
// name = template.name, status 'Belum') — same shape as the manual
// "+ Tambah Dokumen" flow in client-documents.js, so both lists show the
// same rows. Unchecking only deletes the row if it's still status 'Belum';
// once a client has uploaded (or staff has verified/rejected) a file, the
// checkbox locks so an accidental uncheck can't erase that history.
//
// PROJECT Part V.2 addition (SPEC_PROJECT_Part_V2_RAB_Formal.md,
// supabase/migrations/20260824070000_project_part5-2_rab_formal_schema.sql):
// `case_quotation_line_items` ("Detail Pekerjaan" — description/detail/
// qty/rate/amount) is now the source of `case_quotations.total_amount`,
// not `case_quotation_items` (termin). Termin is an allocation of that
// total, not an independent source — mismatch between termin sum and
// total_amount is a non-blocking warning (Ray: never block sending the
// offer over this). `quotation_number` is DB-trigger-owned
// (20260824080000_generate_quotation_number_trigger.sql) — read-only here,
// never written from the frontend. `description` is a client-side template
// pre-filled on draft creation, but stays editable (not a lock).
//
// PROJECT Part V.2 — UI Preview Dokumen Formal (Issue #66). The single
// "Buat Penawaran" action is now 3 buttons: Simpan (aggregate save across
// description/line items/termin — each still has its own section-level
// save button; this one just runs all three so there's one explicit
// "save the draft" action instead of three scattered ones), Preview
// (read-only, no status change), Kirim Penawaran (same DRAFT->SENT logic
// as before, renamed). Preview opens in a new browser tab rather than a
// showModal() dialog — the app's print stylesheet (_pages.scss) hides
// `.modal-backdrop` under `@media print`, which would blank the page on
// window.print(); a bare new-tab document with its own inline CSS sidesteps
// that entirely and matches the "not the dark dashboard theme" requirement.
// Kontak (point 11) is `cases.created_by`, deliberately re-fetched here
// rather than reused from the `case_quotations.creator` join already on
// screen — that join is the RAB's *author*, not the case's, a different
// person. company_settings/profiles.phone came from migration
// 20260824090000_company_settings_and_profile_phone.sql.
//
// Issue #78 — multi rekening bank. The Rekening Pembayaran section of the
// preview no longer reads company_settings (left in place, unused legacy
// per that table's own migration comment); it reads the bank_accounts row
// the draft explicitly picked (case_quotations.bank_account_id, managed
// admin-only in Project Setting — see project-setting.js). No default/auto
// selection: an admin picks manually per RAB. Older quotations from before
// this feature (and a draft that hasn't picked one yet) have a null
// bank_account_id — the preview shows a placeholder line instead of
// erroring or printing "undefined".

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

const STATUS_LABEL = {
  DRAFT: 'Draft',
  PENDING_INTERNAL_APPROVAL: 'Menunggu Approval Internal',
  REVISION_REQUIRED: 'Perlu Revisi',
  APPROVED_INTERNAL: 'Disetujui Internal',
  SENT: 'Menunggu Persetujuan',
  ACCEPTED: 'Diterima',
  REJECTED: 'Ditolak',
  NEGOTIATING: 'Nego',
  SUPERSEDED: 'Digantikan'
};

const STATUS_CLASS = {
  DRAFT: 'status-blue',
  PENDING_INTERNAL_APPROVAL: 'status-yellow',
  REVISION_REQUIRED: 'status-red',
  APPROVED_INTERNAL: 'status-green',
  SENT: 'status-yellow',
  ACCEPTED: 'status-green',
  REJECTED: 'status-red',
  NEGOTIATING: 'client-quotation-status-nego',
  SUPERSEDED: 'client-quotation-status-superseded'
};

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

const EDITABLE_STATUSES = ['DRAFT', 'REVISION_REQUIRED'];
const INTERNAL_ACTIVE_STATUSES = [
  'DRAFT',
  'PENDING_INTERNAL_APPROVAL',
  'REVISION_REQUIRED',
  'APPROVED_INTERNAL'
];

let quotationsByCaseId = new Map();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined) {node.textContent = text;}
  return node;
}

function formatDate(value) {
  if (!value) {return null;}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFmt.format(date);
}

function formatDateTime(value) {
  if (!value) {return null;}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateTimeFmt.format(date);
}

function canCreateDraft(role) {
  return ['admin', 'supervisor', 'internal'].includes(role);
}

function canSendQuotation(role) {
  return ['admin', 'supervisor'].includes(role);
}

function canReviewQuotation(role) {
  return ['admin', 'supervisor'].includes(role);
}

function canRejectQuotation(role) {
  return ['admin', 'supervisor'].includes(role);
}

function buildNegotiationBadge(count) {
  const safeCount = Math.max(0, Number(count) || 0);
  const colorClass = safeCount >= 3 ? 'chip-red' : 'chip-yellow';
  return element('span', `chip ${colorClass}`, `Nego: ${safeCount}/3`);
}

function isEditableQuotation(quotation) {
  return EDITABLE_STATUSES.includes(quotation?.status);
}

// Matches client-documents.js's canManageDocuments — the `documents` table's
// established write-access rule (admin+internal only, supervisor excluded).
// Kept identical here since this checkbox writes to the same table.
function canManageDocuments(role) {
  return ['admin', 'internal'].includes(role);
}

/** Bulk-load all case_quotations (every version) for a set of case ids. */
export async function loadQuotationsForCases(caseIds) {
  quotationsByCaseId = new Map();
  if (!caseIds.length) {return quotationsByCaseId;}

  const { data, error } = await supabase
    .from('case_quotations')
    .select('id, case_id, version, status, total_amount, notes, quotation_number, sent_at, responded_at, client_response_notes, created_by, created_at, creator:profiles!created_by(id, name)')
    .in('case_id', caseIds)
    .order('case_id', { ascending: true })
    .order('version', { ascending: false });

  if (error) {return quotationsByCaseId;}

  (data || []).forEach((row) => {
    const rows = quotationsByCaseId.get(row.case_id) || [];
    rows.push(row);
    quotationsByCaseId.set(row.case_id, rows);
  });

  return quotationsByCaseId;
}

async function logActivity({ clientId, caseId, type, notes, profile }) {
  if (!profile?.id) {return { error: new Error('Profil pengguna tidak tersedia') };}
  try {
    return await supabase.from('activities').insert({
      client_id: clientId,
      case_id: caseId,
      type,
      notes,
      by_user: profile.id
    });
  } catch (error) {
    return { error };
  }
}

async function fetchActiveBankAccounts() {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, account_holder_name, account_number, bank_code, is_active')
    .order('bank_name', { ascending: true });
  if (error) {return [];}
  return data || [];
}

async function fetchQuotationItems(quotationId) {
  const { data, error } = await supabase
    .from('case_quotation_items')
    .select('id, term_name, amount, due_condition, order_index')
    .eq('quotation_id', quotationId)
    .order('order_index', { ascending: true });
  if (error) {return null;}
  return data || [];
}

async function fetchQuotationLineItems(quotationId) {
  const { data, error } = await supabase
    .from('case_quotation_line_items')
    .select('id, description, detail, qty, rate, amount, order_index, parent_item_id')
    .eq('quotation_id', quotationId)
    .order('order_index', { ascending: true });
  if (error) {return null;}
  return data || [];
}

function buildAutoDescription({ clientName, picName, serviceType }) {
  return `Sehubungan dengan permintaan yang telah diajukan oleh Pihak ${clientName || '—'} melalui Bapak/Ibu ${picName || '—'}, dengan ini kami dari Soul Mitra Abadi bermaksud mengajukan penawaran harga untuk layanan ${serviceType || '—'} dengan rincian sebagaimana tercantum di bawah ini.`;
}

function buildVersionHeader(quotation) {
  const header = element('div', 'client-quotation-version-summary');
  header.append(
    element('span', 'client-quotation-version-label', `v${quotation.version}`),
    element('span', `status ${STATUS_CLASS[quotation.status] || ''}`, STATUS_LABEL[quotation.status] || quotation.status),
    element('span', 'client-quotation-version-total', rupiah.format(quotation.total_amount || 0))
  );
  if (quotation.quotation_number) {
    header.appendChild(element('span', 'client-quotation-version-number', quotation.quotation_number));
  }

  const sentAt = formatDate(quotation.sent_at);
  const respondedAt = formatDate(quotation.responded_at);
  const dateParts = [];
  if (sentAt) {dateParts.push(`Dikirim ${sentAt}`);}
  if (respondedAt) {dateParts.push(`Direspon ${respondedAt}`);}
  const creatorName = (Array.isArray(quotation.creator) ? quotation.creator[0] : quotation.creator)?.name;
  if (creatorName) {dateParts.push(`Dibuat oleh ${creatorName}`);}
  if (dateParts.length) {header.appendChild(element('span', 'client-quotation-version-meta', dateParts.join(' · ')));}

  return header;
}

function relationName(value) {
  return (Array.isArray(value) ? value[0] : value)?.name || 'Pengguna';
}

function buildApprovalEvidence(quotation) {
  const card = element('div', 'client-quotation-approval-evidence');
  card.appendChild(element('strong', '', `Status approval internal: ${STATUS_LABEL[quotation.status] || quotation.status}`));

  let action = null;
  let reason = null;
  if (quotation.status === 'APPROVED_INTERNAL' && quotation.internal_approved_at) {
    action = `Disetujui oleh ${relationName(quotation.internal_approver)} · ${formatDateTime(quotation.internal_approved_at)}`;
  } else if (quotation.status === 'PENDING_INTERNAL_APPROVAL' && quotation.internal_submitted_at) {
    action = `Diajukan oleh ${relationName(quotation.internal_submitter)} · ${formatDateTime(quotation.internal_submitted_at)}`;
  } else if (quotation.status === 'REVISION_REQUIRED' && quotation.internal_reopened_at
    && (!quotation.internal_revision_requested_at || new Date(quotation.internal_reopened_at) >= new Date(quotation.internal_revision_requested_at))) {
    action = `Dibuka kembali oleh ${relationName(quotation.internal_reopener)} · ${formatDateTime(quotation.internal_reopened_at)}`;
    reason = quotation.internal_reopen_reason;
  } else if (quotation.status === 'REVISION_REQUIRED' && quotation.internal_revision_requested_at) {
    action = `Revisi diminta oleh ${relationName(quotation.internal_revision_requester)} · ${formatDateTime(quotation.internal_revision_requested_at)}`;
    reason = quotation.internal_revision_reason;
  }

  if (action) {card.appendChild(element('span', '', action));}
  if (reason) {card.appendChild(element('span', 'client-quotation-approval-reason', `Alasan: ${reason}`));}
  return card;
}

function renderReadOnlyItems(container, items) {
  container.replaceChildren();
  if (!items || items.length === 0) {
    container.appendChild(element('div', 'client-quotation-empty', 'Belum ada rincian termin di versi ini.'));
    return;
  }
  const list = element('ul', 'client-quotation-items-readonly');
  items.forEach((item) => {
    const row = element('li', 'client-quotation-item-readonly-row');
    row.append(
      element('span', 'client-quotation-item-readonly-name', item.term_name),
      element('span', 'client-quotation-item-readonly-amount', rupiah.format(item.amount || 0)),
      element('span', 'client-quotation-item-readonly-condition', item.due_condition || '—')
    );
    list.appendChild(row);
  });
  container.appendChild(list);
}

function renderReadOnlyLineItems(container, items) {
  container.replaceChildren();
  if (!items || items.length === 0) {
    container.appendChild(element('div', 'client-quotation-empty', 'Belum ada rincian pekerjaan di versi ini.'));
    return;
  }
  const list = element('ul', 'client-quotation-items-readonly');
  items.forEach((item) => {
    const row = element('li', 'client-quotation-line-item-readonly-row');
    row.append(
      element('span', 'client-quotation-item-readonly-name', item.detail ? `${item.description} — ${item.detail}` : item.description),
      element('span', 'client-quotation-item-readonly-condition', `${item.qty} × ${rupiah.format(item.rate || 0)}`),
      element('span', 'client-quotation-item-readonly-amount', rupiah.format(item.amount || 0))
    );
    list.appendChild(row);
  });
  container.appendChild(list);
}

function buildVersionRow(quotation, supersededByVersion, itemsCache, lineItemsCache, ctx, documents) {
  const row = element('article', 'client-quotation-version-row');

  const header = element('div', 'client-quotation-version-header');
  const toggle = element('button', 'client-quotation-version-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.appendChild(buildVersionHeader(quotation));
  if (quotation.notes) {toggle.title = quotation.notes;}
  header.appendChild(toggle);

  // Preview is a pure read action (no status change) — available for every
  // version, not just the DRAFT being edited, so old SENT/ACCEPTED/etc.
  // offers can still be reviewed/printed as they looked when sent.
  const previewBtn = element('button', 'btn btn-outline btn-sm client-quotation-version-preview-btn', 'Preview');
  previewBtn.type = 'button';
  previewBtn.addEventListener('click', () => openQuotationPreview(quotation, ctx, documents));
  header.appendChild(previewBtn);

  row.appendChild(header);

  if (quotation.status === 'SUPERSEDED' && supersededByVersion) {
    row.appendChild(element(
      'div',
      'client-quotation-version-replacement',
      `Versi ini digantikan oleh v${supersededByVersion}.`
    ));
  }

  const panel = element('div', 'client-quotation-version-items');
  panel.hidden = true;
  row.appendChild(panel);

  let expanded = false;
  toggle.addEventListener('click', async () => {
    expanded = !expanded;
    panel.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    if (!expanded || panel.dataset.loaded) {return;}
    panel.dataset.loaded = '1';
    panel.appendChild(element('div', 'client-quotation-empty', 'Memuat rincian…'));

    let lineItems = lineItemsCache.get(quotation.id);
    if (!lineItems) {
      lineItems = await fetchQuotationLineItems(quotation.id);
      if (lineItems) {lineItemsCache.set(quotation.id, lineItems);}
    }
    let items = itemsCache.get(quotation.id);
    if (!items) {
      items = await fetchQuotationItems(quotation.id);
      if (items) {itemsCache.set(quotation.id, items);}
    }

    panel.replaceChildren();
    if (quotation.description) {
      panel.appendChild(element('div', 'client-quotation-version-description', quotation.description));
    }

    panel.appendChild(element('h4', 'client-quotation-version-subtitle', 'Detail Pekerjaan'));
    const lineItemsPanel = element('div');
    panel.appendChild(lineItemsPanel);
    renderReadOnlyLineItems(lineItemsPanel, lineItems || []);

    panel.appendChild(element('h4', 'client-quotation-version-subtitle', 'Termin Pembayaran'));
    const terminPanel = element('div');
    panel.appendChild(terminPanel);
    renderReadOnlyItems(terminPanel, items || []);
  });

  if (quotation.client_response_notes) {
    row.appendChild(element('div', 'client-quotation-version-response', `Catatan client: ${quotation.client_response_notes}`));
  }
  if (quotation.rejection_reason) {
    row.appendChild(element('div', 'client-quotation-version-response', `Alasan penolakan: ${quotation.rejection_reason}`));
  }

  return row;
}

function itemRowTemplate() {
  return { term_name: '', amount: '', due_condition: '' };
}

function lineItemRowTemplate(parentId = null) {
  return { id: crypto.randomUUID(), parentId, description: '', detail: '', qty: 1, rate: '' };
}

function computeTotal(items) {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

// True kalau item ini punya minimal 1 child di array yang sama — parent
// item locked ke qty=1/rate=0 dan amount-nya derivatif dari children.
function isParentItem(items, item) {
  return items.some((candidate) => candidate.parentId === item.id);
}

function getItemChildren(items, item) {
  return items.filter((candidate) => candidate.parentId === item.id);
}

// Level 1 = depth 1. Dipakai buat validasi batas 3 level.
function getItemDepth(items, item) {
  let depth = 1;
  let current = item;
  while (current.parentId) {
    const parent = items.find((candidate) => candidate.id === current.parentId);
    if (!parent) {break;}
    depth += 1;
    current = parent;
  }
  return depth;
}

// Kedalaman maksimum subtree DI BAWAH item ini (1 = item sendiri, gak
// punya children). Dipakai buat validasi depth saat mindahin subtree.
function getSubtreeDepth(items, item) {
  const children = getItemChildren(items, item);
  if (children.length === 0) {return 1;}
  return 1 + Math.max(...children.map((child) => getSubtreeDepth(items, child)));
}

// [item, ...seluruh descendant-nya] dalam urutan DFS — dipakai buat
// mindahin/menghapus subtree sebagai satu blok utuh.
function getSubtreeItems(items, item) {
  const result = [item];
  getItemChildren(items, item).forEach((child) => {
    result.push(...getSubtreeItems(items, child));
  });
  return result;
}

function computeLineItemAmount(item, items) {
  const children = getItemChildren(items, item);
  if (children.length > 0) {
    return children.reduce((sum, child) => sum + computeLineItemAmount(child, items), 0);
  }
  const qty = Number(item.qty);
  const rate = Number(item.rate);
  if (!Number.isFinite(qty) || !Number.isFinite(rate)) {return 0;}
  return qty * rate;
}

// SUM leaf-only — parent gak ikut kehitung sendiri karena amount-nya
// derivatif dari children (lihat computeLineItemAmount).
function computeLineItemsTotal(items) {
  return items
    .filter((item) => !isParentItem(items, item))
    .reduce((sum, item) => sum + computeLineItemAmount(item, items), 0);
}

function getSiblings(items, item) {
  return items.filter((candidate) => candidate.parentId === item.parentId);
}

function getPreviousSibling(items, item) {
  const siblings = getSiblings(items, item);
  const currentIndex = siblings.indexOf(item);
  return currentIndex > 0 ? siblings[currentIndex - 1] : null;
}

function getNextSibling(items, item) {
  const siblings = getSiblings(items, item);
  const currentIndex = siblings.indexOf(item);
  return currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
}

// [startIndex, endIndex] (inclusive) dari subtree item ini di dalam array —
// valid selama array tetap terjaga urutan DFS (parent langsung diikuti
// semua descendant-nya sebelum sibling berikutnya).
function getSubtreeIndexRange(items, item) {
  const subtreeIds = new Set(getSubtreeItems(items, item).map((subtreeItem) => subtreeItem.id));
  let startIndex = -1;
  let endIndex = -1;
  items.forEach((candidate, index) => {
    if (subtreeIds.has(candidate.id)) {
      if (startIndex === -1) {startIndex = index;}
      endIndex = index;
    }
  });
  return [startIndex, endIndex];
}

// Menukar posisi dua subtree sibling yang bersebelahan, sebagai satu blok
// utuh (item + seluruh descendant-nya), supaya urutan DFS tetap valid.
function swapSubtreeBlocks(items, itemA, itemB) {
  const blockA = getSubtreeItems(items, itemA);
  const blockB = getSubtreeItems(items, itemB);
  const [startA] = getSubtreeIndexRange(items, itemA);
  items.splice(startA, blockA.length + blockB.length, ...blockB, ...blockA);
}

function getValidMoveTargets(items, item) {
  const subtreeIds = new Set(getSubtreeItems(items, item).map((subtreeItem) => subtreeItem.id));
  const movingDepth = getSubtreeDepth(items, item);
  return items.filter((candidate) => {
    if (subtreeIds.has(candidate.id)) {return false;}
    const candidateDepth = getItemDepth(items, candidate);
    return candidateDepth + movingDepth <= 3;
  });
}

// Memindahkan seluruh subtree item (item + descendant-nya) ke bawah parent
// baru, sebagai child terakhir dari parent tersebut. newParentId === null
// berarti dijadikan step level 1 (dipindah ke akhir array).
function moveItemToNewParent(items, item, newParentId) {
  const subtreeBlock = getSubtreeItems(items, item);
  const [start, end] = getSubtreeIndexRange(items, item);
  items.splice(start, end - start + 1);
  item.parentId = newParentId;
  if (newParentId === null) {
    items.push(...subtreeBlock);
    return;
  }
  const newParent = items.find((candidate) => candidate.id === newParentId);
  const [, parentSubtreeEnd] = getSubtreeIndexRange(items, newParent);
  items.splice(parentSubtreeEnd + 1, 0, ...subtreeBlock);
}

function renderEditableItems(container, state, onChange) {
  container.replaceChildren();

  if (state.items.length === 0) {
    container.appendChild(element('div', 'client-quotation-empty', 'Belum ada termin. Tambahkan minimal 1 termin.'));
  }

  state.items.forEach((item, index) => {
    const row = element('div', 'client-quotation-item-row');

    const nameInput = element('input', 'form-control');
    nameInput.type = 'text';
    nameInput.placeholder = 'Nama termin (mis. DP, Termin 1)';
    nameInput.value = item.term_name;
    nameInput.addEventListener('input', () => { item.term_name = nameInput.value; });

    const amountInput = element('input', 'form-control');
    amountInput.type = 'number';
    amountInput.min = '0';
    amountInput.step = 'any';
    amountInput.placeholder = 'Jumlah (Rp)';
    amountInput.value = item.amount;
    amountInput.addEventListener('input', () => {
      item.amount = amountInput.value;
      onChange?.();
    });

    const conditionInput = element('input', 'form-control');
    conditionInput.type = 'text';
    conditionInput.placeholder = 'Syarat (mis. saat kontrak ditandatangani)';
    conditionInput.value = item.due_condition || '';
    conditionInput.addEventListener('input', () => { item.due_condition = conditionInput.value; });

    const moveUp = element('button', 'client-quotation-item-move', '↑');
    moveUp.type = 'button';
    moveUp.disabled = index === 0;
    moveUp.setAttribute('aria-label', 'Pindah ke atas');
    moveUp.addEventListener('click', () => {
      [state.items[index - 1], state.items[index]] = [state.items[index], state.items[index - 1]];
      renderEditableItems(container, state, onChange);
      onChange?.();
    });

    const moveDown = element('button', 'client-quotation-item-move', '↓');
    moveDown.type = 'button';
    moveDown.disabled = index === state.items.length - 1;
    moveDown.setAttribute('aria-label', 'Pindah ke bawah');
    moveDown.addEventListener('click', () => {
      [state.items[index], state.items[index + 1]] = [state.items[index + 1], state.items[index]];
      renderEditableItems(container, state, onChange);
      onChange?.();
    });

    const removeBtn = element('button', 'client-quotation-item-remove', '×');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', 'Hapus termin');
    removeBtn.addEventListener('click', () => {
      state.items.splice(index, 1);
      renderEditableItems(container, state, onChange);
      onChange?.();
    });

    row.append(nameInput, amountInput, conditionInput, moveUp, moveDown, removeBtn);
    container.appendChild(row);
  });
}

function renderEditableLineItems(container, state, onChange) {
  container.replaceChildren();

  if (state.items.length === 0) {
    container.appendChild(element('div', 'client-quotation-empty', 'Belum ada rincian pekerjaan. Tambahkan minimal 1 baris.'));
    return;
  }

  // Amount display tiap row disimpan di sini supaya kita bisa update angka
  // Rupiah-nya (row ini + semua ancestor-nya, karena amount parent = SUM
  // children) tanpa full re-render — full re-render bikin input kehilangan
  // fokus tiap kali user ngetik qty/rate.
  const amountDisplays = new Map();

  function refreshAmountChain(item) {
    let current = item;
    while (current) {
      const display = amountDisplays.get(current.id);
      if (display) {
        display.textContent = rupiah.format(computeLineItemAmount(current, state.items));
      }
      current = current.parentId ? state.items.find((candidate) => candidate.id === current.parentId) : null;
    }
  }

  state.items.forEach((item) => {
    const depth = getItemDepth(state.items, item);
    const isParent = isParentItem(state.items, item);

    if (isParent) {
      // Parent item gak diisi manual — qty/rate di-lock, amount derivatif
      // dari children (lihat computeLineItemAmount).
      item.qty = 1;
      item.rate = 0;
    }

    const row = element('div', 'client-quotation-line-item-row');
    row.style.marginLeft = `${(depth - 1) * 24}px`;

    if (depth > 1) {
      row.appendChild(element('span', 'client-quotation-line-item-indent-marker', '↳'));
    }

    const descInput = element('input', 'form-control');
    descInput.type = 'text';
    descInput.placeholder = 'Deskripsi pekerjaan';
    descInput.value = item.description;
    descInput.addEventListener('input', () => { item.description = descInput.value; });

    const detailInput = element('input', 'form-control');
    detailInput.type = 'text';
    detailInput.placeholder = 'Detail (opsional)';
    detailInput.value = item.detail || '';
    detailInput.addEventListener('input', () => { item.detail = detailInput.value; });

    const qtyInput = element('input', 'form-control');
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.step = 'any';
    qtyInput.placeholder = 'Qty';
    qtyInput.value = item.qty;
    qtyInput.disabled = isParent;

    const rateInput = element('input', 'form-control');
    rateInput.type = 'number';
    rateInput.min = '0';
    rateInput.step = 'any';
    rateInput.placeholder = 'Rate (Rp)';
    rateInput.value = item.rate;
    rateInput.disabled = isParent;

    qtyInput.addEventListener('input', () => { item.qty = qtyInput.value; refreshAmountChain(item); onChange?.(); });
    rateInput.addEventListener('input', () => { item.rate = rateInput.value; refreshAmountChain(item); onChange?.(); });

    const amountDisplay = element('span', 'client-quotation-line-item-amount', rupiah.format(computeLineItemAmount(item, state.items)));
    amountDisplays.set(item.id, amountDisplay);

    const addSubBtn = element('button', 'client-quotation-item-add-sub', '+ Sub-step');
    addSubBtn.type = 'button';
    addSubBtn.hidden = depth >= 3;
    addSubBtn.addEventListener('click', () => {
      const newItem = lineItemRowTemplate(item.id);
      const [, subtreeEnd] = getSubtreeIndexRange(state.items, item);
      state.items.splice(subtreeEnd + 1, 0, newItem);
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    const moveTargets = getValidMoveTargets(state.items, item);
    const moveSelect = element('select', 'form-control client-quotation-item-move-parent');
    const topLevelOption = element('option', '', '— Jadikan step utama (level 1) —');
    topLevelOption.value = '';
    moveSelect.appendChild(topLevelOption);
    moveTargets.forEach((target) => {
      const targetDepth = getItemDepth(state.items, target);
      const label = `${'—'.repeat(targetDepth - 1)} ${target.description.trim() || '(tanpa deskripsi)'}`;
      const option = element('option', '', label);
      option.value = target.id;
      moveSelect.appendChild(option);
    });
    moveSelect.value = item.parentId || '';
    moveSelect.addEventListener('change', () => {
      const newParentId = moveSelect.value || null;
      if (newParentId === item.parentId) {return;}
      moveItemToNewParent(state.items, item, newParentId);
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    const previousSibling = getPreviousSibling(state.items, item);
    const nextSibling = getNextSibling(state.items, item);

    const moveUp = element('button', 'client-quotation-item-move', '↑');
    moveUp.type = 'button';
    moveUp.disabled = !previousSibling;
    moveUp.setAttribute('aria-label', 'Pindah ke atas');
    moveUp.addEventListener('click', () => {
      swapSubtreeBlocks(state.items, previousSibling, item);
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    const moveDown = element('button', 'client-quotation-item-move', '↓');
    moveDown.type = 'button';
    moveDown.disabled = !nextSibling;
    moveDown.setAttribute('aria-label', 'Pindah ke bawah');
    moveDown.addEventListener('click', () => {
      swapSubtreeBlocks(state.items, item, nextSibling);
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    const removeBtn = element('button', 'client-quotation-item-remove', '×');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', 'Hapus rincian pekerjaan');
    removeBtn.addEventListener('click', () => {
      const [rangeStart, rangeEnd] = getSubtreeIndexRange(state.items, item);
      state.items.splice(rangeStart, rangeEnd - rangeStart + 1);
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    row.append(descInput, detailInput, qtyInput, rateInput, amountDisplay, addSubBtn, moveSelect, moveUp, moveDown, removeBtn);
    container.appendChild(row);
  });
}

async function saveQuotationItems(draftId, items) {
  for (const item of items) {
    const amount = Number(item.amount);
    if (!item.term_name.trim() || !Number.isFinite(amount) || amount <= 0) {
      return { error: new Error('Nama termin wajib diisi dan jumlah harus lebih dari 0.') };
    }
  }

  const { error: deleteError } = await supabase
    .from('case_quotation_items')
    .delete()
    .eq('quotation_id', draftId);
  if (deleteError) {return { error: deleteError };}

  if (items.length > 0) {
    const { error: insertError } = await supabase
      .from('case_quotation_items')
      .insert(items.map((item, index) => ({
        quotation_id: draftId,
        term_name: item.term_name.trim(),
        amount: Number(item.amount),
        due_condition: item.due_condition?.trim() || null,
        order_index: index
      })));
    if (insertError) {return { error: insertError };}
  }

  return { error: null };
}

async function saveQuotationLineItems(draftId, items) {
  for (const item of items) {
    if (!item.description.trim()) {
      return { error: new Error('Deskripsi wajib diisi untuk semua baris.') };
    }
    if (isParentItem(items, item)) {continue;}
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate <= 0) {
      return { error: new Error('Qty dan rate harus lebih dari 0.') };
    }
  }

  const { error: deleteError } = await supabase
    .from('case_quotation_line_items')
    .delete()
    .eq('quotation_id', draftId);
  if (deleteError) {return { error: deleteError };}

  const total = computeLineItemsTotal(items);

  if (items.length > 0) {
    const { error: insertError } = await supabase
      .from('case_quotation_line_items')
      .insert(items.map((item, index) => ({
        id: item.id,
        quotation_id: draftId,
        description: item.description.trim(),
        detail: item.detail?.trim() || null,
        qty: Number(item.qty),
        rate: Number(item.rate),
        amount: computeLineItemAmount(item, items),
        order_index: index,
        parent_item_id: item.parentId
      })));
    if (insertError) {return { error: insertError };}
  }

  // total_amount is derived from line items (Part V.2) — termin no longer
  // writes it, so this is the single place case_quotations.total_amount
  // gets updated.
  const { error: totalError } = await supabase
    .from('case_quotations')
    .update({ total_amount: total })
    .eq('id', draftId)
    .in('status', EDITABLE_STATUSES);
  if (totalError) {return { error: totalError };}

  return { error: null, total };
}

function buildDescriptionEditor(draft) {
  const wrap = element('div', 'client-quotation-description-editor');
  const fieldId = `client-quotation-description-${draft.id}`;
  const label = element('label', 'client-quotation-description-label', 'Deskripsi Penawaran');
  label.htmlFor = fieldId;
  wrap.appendChild(label);

  const textarea = element('textarea', 'form-control client-quotation-description-input');
  textarea.id = fieldId;
  textarea.rows = 4;
  textarea.value = draft.description || '';
  textarea.placeholder = 'Deskripsi penawaran…';

  async function persist() {
    const value = textarea.value.trim() || null;
    const { error, count } = await supabase
      .from('case_quotations')
      .update({ description: value }, { count: 'exact' })
      .eq('id', draft.id)
      .in('status', EDITABLE_STATUSES);
    if (error || count !== 1) {return { error: error || new Error('Gagal menyimpan deskripsi.') };}
    draft.description = value;
    return { error: null };
  }

  const saveBtn = element('button', 'btn btn-outline btn-sm', 'Simpan Deskripsi');
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    const { error } = await persist();
    if (error) {
      showToast('Gagal menyimpan deskripsi.', { variant: 'error' });
    } else {
      showToast('Deskripsi berhasil disimpan.', { variant: 'success' });
    }
    if (saveBtn.isConnected) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Simpan Deskripsi';
    }
  });

  const actions = element('div', 'client-quotation-description-actions');
  actions.appendChild(saveBtn);

  wrap.append(textarea, actions);
  return { wrap, save: persist };
}

// Options list is active accounts plus the draft's currently-selected
// account even if it has since been deactivated in Project Setting — so
// picking a bank never has to disappear from an already-saved draft, and
// changing it still only ever offers active accounts as new choices.
function buildBankAccountEditor(draft, bankAccounts) {
  const wrap = element('div', 'client-quotation-bank-editor');
  const fieldId = `client-quotation-bank-account-${draft.id}`;
  const label = element('label', 'client-quotation-description-label', 'Rekening Bank');
  label.htmlFor = fieldId;
  wrap.appendChild(label);

  const select = element('select', 'form-control');
  select.id = fieldId;

  const placeholder = element('option', '', 'Pilih rekening bank…');
  placeholder.value = '';
  select.appendChild(placeholder);

  const options = bankAccounts.filter((account) => account.is_active || account.id === draft.bank_account_id);
  options.forEach((account) => {
    const optionLabel = `${account.bank_name} — ${account.account_number} (${account.account_holder_name})${account.is_active ? '' : ' — nonaktif'}`;
    const option = element('option', '', optionLabel);
    option.value = account.id;
    select.appendChild(option);
  });
  select.value = draft.bank_account_id || '';

  async function persist() {
    const value = select.value || null;
    const { error, count } = await supabase
      .from('case_quotations')
      .update({ bank_account_id: value }, { count: 'exact' })
      .eq('id', draft.id)
      .in('status', EDITABLE_STATUSES);
    if (error || count !== 1) {return { error: error || new Error('Gagal menyimpan rekening bank.') };}
    draft.bank_account_id = value;
    return { error: null };
  }

  const saveBtn = element('button', 'btn btn-outline btn-sm', 'Simpan Rekening');
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    const { error } = await persist();
    if (error) {
      showToast('Gagal menyimpan rekening bank.', { variant: 'error' });
    } else {
      showToast('Rekening bank berhasil disimpan.', { variant: 'success' });
    }
    if (saveBtn.isConnected) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Simpan Rekening';
    }
  });

  const actions = element('div', 'client-quotation-description-actions');
  actions.appendChild(saveBtn);

  wrap.append(select, actions);
  return { wrap, save: persist };
}

function buildLineItemsEditor(draft, lineItemsCache, ctx, onTotalChange) {
  const wrap = element('div', 'client-quotation-line-items-block');
  const itemsContainer = element('div', 'client-quotation-line-items-editor');
  const totalBar = element('div', 'client-quotation-total-bar');
  const totalValue = element('strong', '', rupiah.format(draft.total_amount || 0));
  totalBar.append(element('span', '', 'Total Rincian Pekerjaan (Nilai RAB)'), totalValue);

  const state = { items: [] };

  function notifyTotalChange() {
    const total = computeLineItemsTotal(state.items);
    totalValue.textContent = rupiah.format(total);
    onTotalChange?.(total);
  }

  function rerender() {
    renderEditableLineItems(itemsContainer, state, notifyTotalChange);
    notifyTotalChange();
  }

  const addBtn = element('button', 'btn btn-outline btn-sm', '+ Tambah Pekerjaan');
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    state.items.push(lineItemRowTemplate());
    rerender();
  });

  function persist() {
    return saveQuotationLineItems(draft.id, state.items);
  }

  const saveBtn = element('button', 'btn btn-primary btn-sm', 'Simpan Detail Pekerjaan');
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    const { error } = await persist();
    if (error) {
      showToast(error.message || 'Gagal menyimpan detail pekerjaan.', { variant: 'error' });
    } else {
      showToast('Detail pekerjaan berhasil disimpan.', { variant: 'success' });
      lineItemsCache.delete(draft.id);
      await ctx.refresh();
    }
    if (saveBtn.isConnected) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Simpan Detail Pekerjaan';
    }
  });

  const actions = element('div', 'client-quotation-items-actions');
  actions.append(addBtn, saveBtn);

  wrap.append(itemsContainer, totalBar, actions);

  const existingItems = lineItemsCache.get(draft.id);
  if (existingItems) {
    state.items = existingItems.map((item) => ({
      id: item.id,
      parentId: item.parent_item_id,
      description: item.description,
      detail: item.detail,
      qty: item.qty,
      rate: item.rate
    }));
    rerender();
  } else {
    itemsContainer.appendChild(element('div', 'client-quotation-empty', 'Memuat rincian…'));
    fetchQuotationLineItems(draft.id).then((items) => {
      lineItemsCache.set(draft.id, items || []);
      state.items = (items || []).map((item) => ({
        id: item.id,
        parentId: item.parent_item_id,
        description: item.description,
        detail: item.detail,
        qty: item.qty,
        rate: item.rate
      }));
      rerender();
    });
  }

  return { wrap, save: persist };
}

function buildTerminEditor(draft, itemsCache, ctx, getLineItemsTotal) {
  const wrap = element('div', 'client-quotation-termin-block');

  const itemsContainer = element('div', 'client-quotation-items-editor');
  const totalBar = element('div', 'client-quotation-total-bar');
  const totalValue = element('strong', '', rupiah.format(0));
  totalBar.append(element('span', '', 'Total Termin'), totalValue);

  const mismatchEl = element('div', 'client-quotation-mismatch-warning');
  mismatchEl.hidden = true;

  const state = { items: [] };

  function refreshTotals() {
    const terminTotal = computeTotal(state.items);
    totalValue.textContent = rupiah.format(terminTotal);
    const lineTotal = getLineItemsTotal();
    if (lineTotal > 0 && terminTotal !== lineTotal) {
      mismatchEl.hidden = false;
      mismatchEl.textContent = `Perhatian: total termin (${rupiah.format(terminTotal)}) belum sama dengan total rincian pekerjaan (${rupiah.format(lineTotal)}).`;
    } else {
      mismatchEl.hidden = true;
    }
  }

  const addBtn = element('button', 'btn btn-outline btn-sm', '+ Tambah Termin');
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => {
    state.items.push(itemRowTemplate());
    renderEditableItems(itemsContainer, state, refreshTotals);
    refreshTotals();
  });

  function persist() {
    return saveQuotationItems(draft.id, state.items);
  }

  const saveBtn = element('button', 'btn btn-primary btn-sm', 'Simpan Rincian Termin');
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan…';
    const { error } = await persist();
    if (error) {
      showToast(error.message || 'Gagal menyimpan rincian termin.', { variant: 'error' });
    } else {
      showToast('Rincian termin berhasil disimpan.', { variant: 'success' });
      itemsCache.delete(draft.id);
      await ctx.refresh();
    }
    if (saveBtn.isConnected) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Simpan Rincian Termin';
    }
  });

  const actions = element('div', 'client-quotation-items-actions');
  actions.append(addBtn, saveBtn);

  wrap.append(itemsContainer, mismatchEl, totalBar, actions);

  const existingItems = itemsCache.get(draft.id);
  if (existingItems) {
    state.items = existingItems.map((item) => ({
      term_name: item.term_name,
      amount: item.amount,
      due_condition: item.due_condition
    }));
    renderEditableItems(itemsContainer, state, refreshTotals);
    refreshTotals();
  } else {
    itemsContainer.appendChild(element('div', 'client-quotation-empty', 'Memuat rincian…'));
    fetchQuotationItems(draft.id).then((items) => {
      itemsCache.set(draft.id, items || []);
      state.items = (items || []).map((item) => ({
        term_name: item.term_name,
        amount: item.amount,
        due_condition: item.due_condition
      }));
      renderEditableItems(itemsContainer, state, refreshTotals);
      refreshTotals();
    });
  }

  return { wrap, refreshTotals, save: persist };
}

function buildDraftEditor(draft, itemsCache, lineItemsCache, ctx, bankAccounts) {
  const wrap = element('div', 'client-quotation-draft-editor');

  const numberClass = draft.quotation_number
    ? 'client-quotation-draft-number'
    : 'client-quotation-draft-number client-quotation-draft-number-pending';
  const numberText = draft.quotation_number
    ? `No. RAB: ${draft.quotation_number}`
    : 'Nomor RAB akan digenerate otomatis saat penawaran pertama dibuat.';
  wrap.appendChild(element('div', numberClass, numberText));

  const descriptionEditor = buildDescriptionEditor(draft);
  wrap.appendChild(descriptionEditor.wrap);

  wrap.appendChild(element('h3', 'client-quotation-draft-title', `Detail Pekerjaan — Draft v${draft.version}`));

  // Termin is created after line items but needs to read the live line-items
  // total for the mismatch warning, and line items need to notify termin
  // whenever the total changes — a shared ref breaks the ordering cycle
  // (termin's own refreshTotals isn't wired up until after it's built).
  const lineTotalRef = { value: draft.total_amount || 0 };
  let terminSectionRef = null;

  const lineItemsEditor = buildLineItemsEditor(draft, lineItemsCache, ctx, (total) => {
    lineTotalRef.value = total;
    terminSectionRef?.refreshTotals();
  });
  wrap.appendChild(lineItemsEditor.wrap);

  wrap.appendChild(element('h3', 'client-quotation-draft-title', `Termin Pembayaran — Draft v${draft.version}`));

  const terminSection = buildTerminEditor(draft, itemsCache, ctx, () => lineTotalRef.value);
  terminSectionRef = terminSection;
  wrap.appendChild(terminSection.wrap);

  wrap.appendChild(element('h3', 'client-quotation-draft-title', 'Rekening Bank'));
  const bankAccountEditor = buildBankAccountEditor(draft, bankAccounts);
  wrap.appendChild(bankAccountEditor.wrap);

  // Aggregate "Simpan" for the action row — runs the same persistence each
  // section's own save button already offers, so the draft can be saved in
  // one explicit click instead of three scattered ones. Stops at the first
  // failing section rather than saving partially and hiding which part broke.
  async function saveAll() {
    const sections = [
      ['Deskripsi', descriptionEditor.save],
      ['Detail Pekerjaan', lineItemsEditor.save],
      ['Termin Pembayaran', terminSection.save],
      ['Rekening Bank', bankAccountEditor.save]
    ];
    for (const [section, save] of sections) {
      const { error, total } = await save();
      if (error) {return { error, section };}
      if (total !== undefined) {draft.total_amount = total;}
    }
    return { error: null };
  }

  return { wrap, saveAll };
}

async function createDraftQuotation(quotations, ctx) {
  const nextVersion = quotations.length ? Math.max(...quotations.map((q) => q.version)) + 1 : 1;

  // Tandai semua versi lama (bukan DRAFT) jadi SUPERSEDED sebelum bikin
  // versi baru. Tidak diblokir kalau gagal/tidak kena baris (mis. role
  // internal yang RLS-nya cuma boleh update quotation berstatus DRAFT,
  // lihat Part V RLS tightening) — createDraftQuotation tetap lanjut
  // untuk role itu, limitasinya dicatat di changelog, bukan hard blocker.
  if (quotations.length) {
    await supabase
      .from('case_quotations')
      .update({ status: 'SUPERSEDED' })
      .eq('case_id', ctx.caseId)
      .neq('status', 'DRAFT');
  }

  const description = buildAutoDescription({
    clientName: ctx.client?.name,
    picName: ctx.client?.pic_name,
    serviceType: ctx.project?.service_type
  });

  const { data, error } = await supabase
    .from('case_quotations')
    .insert({ case_id: ctx.caseId, version: nextVersion, status: 'DRAFT', created_by: ctx.profile.id, description })
    .select('id')
    .single();

  if (error || !data) {
    showToast('Gagal membuat RAB baru.', { variant: 'error' });
    return;
  }

  await logActivity({
    clientId: ctx.clientId,
    caseId: ctx.caseId,
    type: 'Buat RAB',
    notes: `RAB versi ${nextVersion} dibuat sebagai draft.`,
    profile: ctx.profile
  });

  showToast('RAB baru berhasil dibuat.', { variant: 'success' });
  await ctx.refresh();
}

async function updateQuotationStatus(quotation, fromStatus, values, failureMessage) {
  const { error, count } = await supabase
    .from('case_quotations')
    .update(values, { count: 'exact' })
    .eq('id', quotation.id)
    .eq('status', fromStatus);
  return { error: error || (count === 1 ? null : new Error(failureMessage)) };
}

async function submitForInternalApproval(quotation, ctx) {
  if (!(quotation.total_amount > 0)) {
    showToast('Tambahkan minimal 1 rincian pekerjaan sebelum mengajukan approval.', { variant: 'error' });
    return;
  }
  const { error } = await updateQuotationStatus(
    quotation,
    quotation.status,
    { status: 'PENDING_INTERNAL_APPROVAL' },
    'Status quotation sudah berubah.'
  );
  if (error) {
    showToast('Gagal mengajukan approval internal.', { variant: 'error' });
    return;
  }
  await logActivity({
    clientId: ctx.clientId,
    caseId: ctx.caseId,
    type: 'Ajukan Approval Internal RAB',
    notes: `RAB versi ${quotation.version} diajukan untuk approval internal.`,
    profile: ctx.profile
  });
  showToast('RAB berhasil diajukan untuk approval internal.', { variant: 'success' });
  await ctx.refresh();
}

async function approveInternalQuotation(quotation, ctx) {
  const { error } = await updateQuotationStatus(
    quotation,
    'PENDING_INTERNAL_APPROVAL',
    { status: 'APPROVED_INTERNAL' },
    'Status quotation sudah berubah.'
  );
  if (error) {
    showToast('Gagal menyetujui RAB.', { variant: 'error' });
    return;
  }
  await logActivity({
    clientId: ctx.clientId,
    caseId: ctx.caseId,
    type: 'Approve Internal RAB',
    notes: `RAB versi ${quotation.version} disetujui secara internal.`,
    profile: ctx.profile
  });
  showToast('RAB disetujui. Penawaran belum dikirim ke client.', { variant: 'success' });
  await ctx.refresh();
}

async function requestQuotationRevision(quotation, reason, ctx) {
  const { error } = await updateQuotationStatus(
    quotation,
    'PENDING_INTERNAL_APPROVAL',
    { status: 'REVISION_REQUIRED', internal_revision_reason: reason },
    'Status quotation sudah berubah.'
  );
  if (error) {
    showToast('Gagal meminta revisi RAB.', { variant: 'error' });
    return;
  }
  await logActivity({
    clientId: ctx.clientId,
    caseId: ctx.caseId,
    type: 'Request Revision RAB',
    notes: `RAB versi ${quotation.version} perlu direvisi. Alasan: ${reason}`,
    profile: ctx.profile
  });
  showToast('RAB dikembalikan untuk direvisi.', { variant: 'success' });
  await ctx.refresh();
}

async function reopenApprovedQuotation(quotation, reason, ctx) {
  const { error } = await updateQuotationStatus(
    quotation,
    'APPROVED_INTERNAL',
    { status: 'REVISION_REQUIRED', internal_reopen_reason: reason },
    'Status quotation sudah berubah.'
  );
  if (error) {
    showToast('Gagal membuka kembali RAB.', { variant: 'error' });
    return;
  }
  await logActivity({
    clientId: ctx.clientId,
    caseId: ctx.caseId,
    type: 'Reopen Approved RAB',
    notes: `RAB versi ${quotation.version} dibuka kembali. Alasan: ${reason}`,
    profile: ctx.profile
  });
  showToast('RAB dibuka kembali dan wajib melalui approval ulang.', { variant: 'success' });
  await ctx.refresh();
}

function openReasonModal({ quotation, title, description, label, confirmLabel, onConfirm, ctx }) {
  const wrap = element('div', 'client-quotation-reason-modal');
  wrap.appendChild(element('p', '', description));
  const fieldId = `quotation-reason-${quotation.id}`;
  const fieldLabel = element('label', 'form-label', label);
  fieldLabel.htmlFor = fieldId;
  const textarea = element('textarea', 'form-control');
  textarea.id = fieldId;
  textarea.rows = 4;
  const errorEl = element('div', 'client-quotation-reason-error', 'Alasan wajib diisi.');
  errorEl.hidden = true;
  wrap.append(fieldLabel, textarea, errorEl);
  showModal({
    title,
    body: wrap,
    size: 'md',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: confirmLabel,
        variant: 'primary',
        action: () => {
          const reason = textarea.value.trim();
          if (!reason) {
            errorEl.hidden = false;
            textarea.focus();
            return false;
          }
          onConfirm(quotation, reason, ctx);
        }
      }
    ]
  });
}

async function sendQuotation(quotation, ctx) {
  const { error: updateError } = await updateQuotationStatus(
    quotation,
    'APPROVED_INTERNAL',
    { status: 'SENT', sent_at: new Date().toISOString() },
    'Status quotation sudah berubah.'
  );

  if (updateError) {
    showToast('Gagal mengirim penawaran. Pastikan RAB sudah disetujui internal.', { variant: 'error' });
    return;
  }

  const { error: caseError } = await supabase
    .from('cases')
    .update({ intake_status: 'QUOTED' })
    .eq('id', ctx.caseId);

  if (caseError) {
    showToast('Penawaran terkirim, tapi status intake project gagal diperbarui. Hubungi admin.', {
      variant: 'error',
      duration: 5000
    });
  }

  await logActivity({
    clientId: ctx.clientId,
    caseId: ctx.caseId,
    type: 'Kirim Penawaran',
    notes: `Penawaran RAB versi ${quotation.version} dikirim ke client (total ${rupiah.format(quotation.total_amount || 0)}).`,
    profile: ctx.profile
  });

  showToast('Penawaran berhasil dikirim.', { variant: 'success' });
  await ctx.refresh();
}

async function rejectQuotation(quotation, reason, ctx) {
  const { error } = await updateQuotationStatus(
    quotation,
    'SENT',
    {
      status: 'REJECTED',
      rejection_reason: reason,
      responded_at: new Date().toISOString()
    },
    'Status quotation sudah berubah.'
  );
  if (error) {
    showToast('Gagal menolak penawaran.', { variant: 'error' });
    return;
  }

  await logActivity({
    clientId: ctx.clientId,
    caseId: ctx.caseId,
    type: 'Reject RAB (Admin/Supervisor)',
    notes: `Penawaran RAB versi ${quotation.version} ditolak. Alasan: ${reason}`,
    profile: ctx.profile
  });
  showToast('Penawaran berhasil ditolak.', { variant: 'success' });
  await ctx.refresh();
}

function openRejectQuotationModal(quotation, ctx) {
  openReasonModal({
    quotation,
    title: 'Tolak Penawaran',
    description: `RAB versi ${quotation.version} akan ditolak dan tidak dapat dikirim ulang.`,
    label: 'Alasan penolakan (wajib)',
    confirmLabel: 'Tolak Penawaran',
    onConfirm: rejectQuotation,
    ctx
  });
}

// ============================================================================
// Preview Dokumen Formal (Issue #66) — read-only, no status change.
// ============================================================================

const previewDateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

// Bank account shown in the preview is the one picked per-RAB
// (case_quotations.bank_account_id), not the old single company_settings
// key/value rows — those stay in the DB unused (legacy). Returns null for
// quotations that predate this feature or a draft that hasn't picked one
// yet; the caller renders a placeholder instead of crashing on it.
async function fetchBankAccount(bankAccountId) {
  if (!bankAccountId) {return null;}
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('bank_name, account_holder_name, account_number, bank_code')
    .eq('id', bankAccountId)
    .single();
  if (error || !data) {return null;}
  return data;
}

async function fetchCaseCreatorContact(caseId) {
  const { data, error } = await supabase
    .from('cases')
    .select('created_by, creator:profiles!created_by(id, name, phone)')
    .eq('id', caseId)
    .single();
  if (error || !data) {return null;}
  return (Array.isArray(data.creator) ? data.creator[0] : data.creator) || null;
}

function docEl(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined && text !== null) {node.textContent = text;}
  return node;
}

const PREVIEW_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #e9e9e9;
  color: #1a1a1a;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
  line-height: 1.6;
}
.preview-toolbar {
  position: sticky;
  top: 0;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 12px 24px;
  background: #ffffff;
  border-bottom: 1px solid #ddd;
}
.preview-toolbar button {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid #444;
  background: #ffffff;
  color: #1a1a1a;
  cursor: pointer;
}
.preview-toolbar button.primary { background: #1a3b6d; border-color: #1a3b6d; color: #ffffff; }
.preview-page {
  max-width: 800px;
  margin: 24px auto 48px;
  background: #ffffff;
  padding: 48px 56px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.15);
}
.preview-letterhead { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; }
.preview-company-name { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
.preview-doc-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #444; margin-top: 4px; }
.preview-meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; }
.preview-perihal { font-weight: bold; margin: 16px 0; }
.preview-kepada p { margin: 2px 0; }
.preview-paragraph { text-align: justify; margin: 16px 0; }
.preview-section-title { font-size: 14px; font-weight: bold; margin: 24px 0 8px; border-bottom: 1px solid #999; padding-bottom: 4px; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
.preview-table th, .preview-table td { border: 1px solid #999; padding: 6px 8px; }
.preview-table th { background: #f0f0f0; text-align: left; }
.preview-table-num { text-align: right; white-space: nowrap; }
.preview-table-detail { font-size: 12px; color: #555; }
.preview-table-total-label { text-align: right; font-weight: bold; }
.preview-table-total { font-weight: bold; }
.preview-doc-list { margin: 0 0 16px; padding-left: 20px; }
.preview-rekening p, .preview-kontak p { margin: 2px 0; }
.preview-signature { margin-top: 32px; }
.preview-table-group-header { font-weight: bold; background: #fafafa; }
.preview-table tbody tr.preview-table-group-continue > td { border-top: hidden; }
.preview-empty { color: #777; font-style: italic; }
@media print {
  body { background: #ffffff; }
  .preview-toolbar { display: none; }
  .preview-page { box-shadow: none; margin: 0; max-width: none; padding: 0; }
}
`;

function buildPreviewLineItemsTable(doc, items) {
  if (!items || items.length === 0) {
    return docEl(doc, 'p', 'preview-empty', 'Belum ada rincian pekerjaan.');
  }

  // Helper tree (isParentItem, getItemChildren, computeLineItemsTotal) dari
  // editor line items dipakai ulang di sini — semua expect field `parentId`,
  // sedangkan row mentah dari DB pakai `parent_item_id`, jadi dinormalisasi
  // sekali di awal.
  const normalizedItems = items.map((item) => ({ ...item, parentId: item.parent_item_id }));

  const table = docEl(doc, 'table', 'preview-table');
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  ['No', 'Deskripsi', 'Qty', 'Rate', 'Jumlah'].forEach((h) => headRow.appendChild(docEl(doc, 'th', '', h)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');

  function buildHeaderRow(item, numberLabel, depth, isContinuation) {
    const row = doc.createElement('tr');
    if (isContinuation) {row.classList.add('preview-table-group-continue');}
    const cell = docEl(doc, 'td', 'preview-table-group-header', `${numberLabel}. ${item.description}`);
    cell.colSpan = 5;
    cell.style.paddingLeft = `${8 + (depth - 1) * 16}px`;
    row.appendChild(cell);
    return row;
  }

  function buildLeafRow(item, numberLabel, depth, isContinuation) {
    const row = doc.createElement('tr');
    if (isContinuation) {row.classList.add('preview-table-group-continue');}
    row.appendChild(docEl(doc, 'td', '', numberLabel));
    const descCell = docEl(doc, 'td', 'preview-table-desc');
    descCell.style.paddingLeft = `${8 + (depth - 1) * 16}px`;
    descCell.appendChild(docEl(doc, 'div', '', item.description));
    if (item.detail) {descCell.appendChild(docEl(doc, 'div', 'preview-table-detail', item.detail));}
    row.appendChild(descCell);
    row.appendChild(docEl(doc, 'td', 'preview-table-num', String(item.qty)));
    row.appendChild(docEl(doc, 'td', 'preview-table-num', rupiah.format(item.rate || 0)));
    row.appendChild(docEl(doc, 'td', 'preview-table-num', rupiah.format(item.amount || 0)));
    return row;
  }

  // Rekursif menambahkan baris untuk item ini + seluruh descendant-nya
  // (urutan DFS). isFirstInGroup true HANYA untuk baris pertama tiap
  // step top-level — baris itu tetap dapat border-top normal (batas kotak
  // baru). Semua baris berikutnya (anak, cucu, dst) ditandai
  // preview-table-group-continue supaya border-top-nya disembunyikan
  // (lihat CSS), sehingga menyambung jadi 1 kotak utuh dengan induknya.
  function appendItemRows(item, numberLabel, depth, isFirstInGroup) {
    if (isParentItem(normalizedItems, item)) {
      tbody.appendChild(buildHeaderRow(item, numberLabel, depth, !isFirstInGroup));
      getItemChildren(normalizedItems, item).forEach((child, childIndex) => {
        appendItemRows(child, `${numberLabel}.${childIndex + 1}`, depth + 1, false);
      });
    } else {
      tbody.appendChild(buildLeafRow(item, numberLabel, depth, !isFirstInGroup));
    }
  }

  const topLevelItems = normalizedItems.filter((item) => !item.parentId);
  topLevelItems.forEach((item, index) => {
    appendItemRows(item, String(index + 1), 1, true);
  });
  table.appendChild(tbody);

  const tfoot = doc.createElement('tfoot');
  const totalRow = doc.createElement('tr');
  const totalLabel = docEl(doc, 'td', 'preview-table-total-label', 'Total');
  totalLabel.colSpan = 4;
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(docEl(doc, 'td', 'preview-table-num preview-table-total', rupiah.format(computeLineItemsTotal(normalizedItems))));
  tfoot.appendChild(totalRow);
  table.appendChild(tfoot);

  return table;
}

function buildPreviewTerminTable(doc, items) {
  if (!items || items.length === 0) {
    return docEl(doc, 'p', 'preview-empty', 'Belum ada rincian termin.');
  }
  const table = docEl(doc, 'table', 'preview-table');
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  ['No', 'Nama Termin', 'Syarat Pembayaran', 'Jumlah'].forEach((h) => headRow.appendChild(docEl(doc, 'th', '', h)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  let total = 0;
  items.forEach((item, index) => {
    const row = doc.createElement('tr');
    row.appendChild(docEl(doc, 'td', '', String(index + 1)));
    row.appendChild(docEl(doc, 'td', '', item.term_name));
    row.appendChild(docEl(doc, 'td', '', item.due_condition || '—'));
    row.appendChild(docEl(doc, 'td', 'preview-table-num', rupiah.format(item.amount || 0)));
    tbody.appendChild(row);
    total += Number(item.amount) || 0;
  });
  table.appendChild(tbody);

  const tfoot = doc.createElement('tfoot');
  const totalRow = doc.createElement('tr');
  const totalLabel = docEl(doc, 'td', 'preview-table-total-label', 'Total');
  totalLabel.colSpan = 3;
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(docEl(doc, 'td', 'preview-table-num preview-table-total', rupiah.format(total)));
  tfoot.appendChild(totalRow);
  table.appendChild(tfoot);

  return table;
}

function buildPreviewDocumentsList(doc, documents) {
  if (!documents || documents.length === 0) {
    return docEl(doc, 'p', 'preview-empty', 'Belum ada dokumen yang ditentukan.');
  }
  const list = doc.createElement('ol');
  list.className = 'preview-doc-list';
  documents.forEach((docRow) => list.appendChild(docEl(doc, 'li', '', docRow.name)));
  return list;
}

function buildPreviewContent(doc, data) {
  const { generatedDate, quotationNumber, serviceType, client, description, lineItems, terminItems, documents, bankAccount, contact } = data;

  const root = docEl(doc, 'div', 'preview-doc');

  const letterhead = docEl(doc, 'div', 'preview-letterhead');
  letterhead.appendChild(docEl(doc, 'div', 'preview-company-name', 'Soul Mitra Abadi'));
  letterhead.appendChild(docEl(doc, 'div', 'preview-doc-title', 'Surat Penawaran'));
  root.appendChild(letterhead);

  const meta = docEl(doc, 'div', 'preview-meta');
  meta.appendChild(docEl(doc, 'span', '', `Tanggal: ${generatedDate}`));
  meta.appendChild(docEl(doc, 'span', '', `No. RAB: ${quotationNumber || '—'}`));
  root.appendChild(meta);

  root.appendChild(docEl(doc, 'p', 'preview-perihal', `Perihal: Surat Penawaran ${serviceType || '—'}`));

  const kepada = docEl(doc, 'div', 'preview-kepada');
  kepada.appendChild(docEl(doc, 'p', '', 'Kepada Yth.'));
  const picLine = [client?.pic_name, client?.pic_title].filter(Boolean).join(', ');
  kepada.appendChild(docEl(doc, 'p', '', `Bpk/Ibu ${picLine || '—'}`));
  const companyLine = [client?.type, client?.name].filter(Boolean).join(' ');
  kepada.appendChild(docEl(doc, 'p', '', companyLine || '—'));
  if (client?.address) {kepada.appendChild(docEl(doc, 'p', '', client.address));}
  root.appendChild(kepada);

  if (description) {
    root.appendChild(docEl(doc, 'p', 'preview-paragraph', description));
  }

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Rincian Pekerjaan'));
  root.appendChild(buildPreviewLineItemsTable(doc, lineItems));

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Dokumen yang Diperlukan'));
  root.appendChild(buildPreviewDocumentsList(doc, documents));

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Termin Pembayaran'));
  root.appendChild(buildPreviewTerminTable(doc, terminItems));

  root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Rekening Pembayaran'));
  if (bankAccount) {
    const rek = docEl(doc, 'div', 'preview-rekening');
    rek.appendChild(docEl(doc, 'p', '', `Bank: ${bankAccount.bank_name}`));
    rek.appendChild(docEl(doc, 'p', '', `No. Rekening: ${bankAccount.account_number}`));
    rek.appendChild(docEl(doc, 'p', '', `Atas Nama: ${bankAccount.account_holder_name}`));
    root.appendChild(rek);
  } else {
    root.appendChild(docEl(doc, 'p', 'preview-empty', 'Rekening bank belum dipilih untuk penawaran ini.'));
  }

  if (contact?.name) {
    root.appendChild(docEl(doc, 'h3', 'preview-section-title', 'Kontak'));
    const kontak = docEl(doc, 'div', 'preview-kontak');
    kontak.appendChild(docEl(doc, 'p', '', contact.name));
    if (contact.phone) {kontak.appendChild(docEl(doc, 'p', '', contact.phone));}
    root.appendChild(kontak);
  }

  root.appendChild(docEl(doc, 'p', 'preview-paragraph', 'Demikian penawaran ini kami sampaikan. Bapak/Ibu dapat menanggapi penawaran ini dengan menerima, menolak, atau mengajukan negosiasi melalui tombol respon yang akan tersedia pada portal client. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.'));

  const signature = docEl(doc, 'div', 'preview-signature');
  signature.appendChild(docEl(doc, 'p', '', 'Hormat kami,'));
  signature.appendChild(docEl(doc, 'p', '', 'Soul Mitra Abadi'));
  root.appendChild(signature);

  return root;
}

function renderPreviewWindow(win, data) {
  const doc = win.document;
  doc.title = data.quotationNumber ? `Preview Penawaran — ${data.quotationNumber}` : 'Preview Penawaran';

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
  page.appendChild(buildPreviewContent(doc, data));
  doc.body.appendChild(page);
}

/**
 * Opens the formal document preview in a new browser tab (not showModal —
 * the app's print stylesheet hides `.modal-backdrop` under @media print,
 * which would blank a modal-based preview on window.print()). Pure
 * read/review action: no status change, no writes. Works for any
 * case_quotations row — the currently-editing DRAFT (from the action row)
 * or any past version in "Riwayat Versi" (SENT/ACCEPTED/etc. — reviewing
 * an old offer as it looked when sent is exactly what Preview is for).
 */
async function openQuotationPreview(quotation, ctx, documents) {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Popup diblokir browser. Izinkan popup untuk membuka preview dokumen.', { variant: 'error' });
    return;
  }
  win.document.title = 'Memuat Preview…';
  const loading = docEl(win.document, 'p', '', 'Memuat dokumen…');
  loading.style.cssText = 'font-family: Arial, sans-serif; padding: 24px;';
  win.document.body.appendChild(loading);

  const [lineItems, terminItems, bankAccount, contact] = await Promise.all([
    fetchQuotationLineItems(quotation.id),
    fetchQuotationItems(quotation.id),
    fetchBankAccount(quotation.bank_account_id),
    fetchCaseCreatorContact(ctx.caseId)
  ]);

  if (win.closed) {return;}

  // A DRAFT hasn't been sent yet — its letter date is "today" (whenever it's
  // printed/sent). A past version already has a real send date; previewing
  // it later should show that historical date, not today's, or reviewing an
  // old SENT/ACCEPTED offer would misrepresent when it was actually issued.
  const clientFacingStatuses = ['SENT', 'ACCEPTED', 'REJECTED', 'NEGOTIATING', 'SUPERSEDED'];
  const historicalDate = quotation.sent_at || (clientFacingStatuses.includes(quotation.status) ? quotation.created_at : null);

  renderPreviewWindow(win, {
    generatedDate: previewDateFmt.format(historicalDate ? new Date(historicalDate) : new Date()),
    quotationNumber: quotation.quotation_number,
    serviceType: ctx.project?.service_type,
    client: ctx.client,
    description: quotation.description,
    lineItems: lineItems || [],
    terminItems: terminItems || [],
    documents: documents || [],
    bankAccount,
    contact
  });
}

function buildDocumentRow(template, documents, ctx, quotationEditable) {
  const row = element('label', 'client-quotation-doc-row');
  const matches = documents.filter((doc) => doc.name === template.name);
  const locked = matches.filter((doc) => doc.status !== 'Belum');
  const isChecked = matches.length > 0;
  const isLocked = locked.length > 0;

  const allowed = canManageDocuments(ctx.profile?.role) && quotationEditable;
  const checkbox = element('input', 'client-quotation-doc-checkbox');
  checkbox.type = 'checkbox';
  checkbox.checked = isChecked;
  checkbox.disabled = isLocked || !allowed;

  checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;
    if (checkbox.checked) {
      const { error } = await supabase
        .from('documents')
        .insert({ case_id: ctx.caseId, name: template.name, status: 'Belum', file_url: null });
      if (error) {
        showToast('Gagal menambahkan dokumen wajib.', { variant: 'error' });
        checkbox.checked = false;
      }
    } else {
      const removable = matches.filter((doc) => doc.status === 'Belum');
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', removable.map((doc) => doc.id));
      if (error) {
        showToast('Gagal menghapus dokumen wajib.', { variant: 'error' });
        checkbox.checked = true;
      }
    }
    checkbox.disabled = false;
    await ctx.refresh();
  });

  row.appendChild(checkbox);
  row.appendChild(element('span', '', template.name));
  if (isLocked) {
    row.appendChild(element('span', 'client-quotation-doc-lock', `(sudah ${locked[0].status.toLowerCase()})`));
  }
  return row;
}

async function renderModalBody(bodyEl, ctx) {
  bodyEl.replaceChildren();
  bodyEl.appendChild(element('div', 'client-quotation-empty', 'Memuat data RAB…'));

  const [quotationsResult, templatesResult, documentsResult, bankAccounts] = await Promise.all([
    supabase
      .from('case_quotations')
      .select('id, case_id, version, status, total_amount, notes, rejection_reason, quotation_number, description, bank_account_id, sent_at, responded_at, client_response_notes, created_by, created_at, creator:profiles!created_by(id, name), internal_submitted_at, internal_approved_at, internal_revision_requested_at, internal_revision_reason, internal_reopened_at, internal_reopen_reason, internal_submitter:profiles!internal_submitted_by(id, name), internal_approver:profiles!internal_approved_by(id, name), internal_revision_requester:profiles!internal_revision_requested_by(id, name), internal_reopener:profiles!internal_reopened_by(id, name)')
      .eq('case_id', ctx.caseId)
      .order('version', { ascending: false }),
    supabase
      .from('document_templates')
      .select('id, name, category_id, category:document_categories(name)')
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('documents')
      .select('id, name, status')
      .eq('case_id', ctx.caseId),
    fetchActiveBankAccounts()
  ]);

  if (quotationsResult.error || templatesResult.error || documentsResult.error) {
    bodyEl.replaceChildren(element('div', 'client-quotation-empty', 'Gagal memuat data RAB & Penawaran.'));
    return;
  }

  const quotations = quotationsResult.data || [];
  const templates = (templatesResult.data || []).slice().sort((a, b) => {
    const catA = a.category?.name || 'Lainnya';
    const catB = b.category?.name || 'Lainnya';
    return catA === catB ? a.name.localeCompare(b.name) : catA.localeCompare(catB);
  });
  const documents = documentsResult.data || [];
  const activeQuotation = quotations.find((q) => INTERNAL_ACTIVE_STATUSES.includes(q.status)) || null;
  const editableQuotation = isEditableQuotation(activeQuotation) ? activeQuotation : null;
  const itemsCache = new Map();
  const lineItemsCache = new Map();

  bodyEl.replaceChildren();

  const historyHeader = element('div', 'client-quotation-history-header');
  historyHeader.appendChild(element('h3', 'client-quotation-section-title', 'Riwayat Versi'));
  if (quotations.length > 0) {
    historyHeader.appendChild(buildNegotiationBadge(ctx.project?.negotiation_count));
  }
  bodyEl.appendChild(historyHeader);
  if (quotations.length === 0) {
    bodyEl.appendChild(element('div', 'client-quotation-empty', 'Belum ada RAB dibuat untuk project ini.'));
  } else {
    const list = element('div', 'client-quotation-version-list');
    quotations.forEach((quotation, index) => {
      const supersededByVersion = index > 0 ? quotations[index - 1].version : null;
      list.appendChild(buildVersionRow(
        quotation,
        supersededByVersion,
        itemsCache,
        lineItemsCache,
        ctx,
        documents
      ));
    });
    bodyEl.appendChild(list);
  }

  if (activeQuotation) {
    bodyEl.appendChild(buildApprovalEvidence(activeQuotation));
  }

  let draftEditor = null;
  if (!activeQuotation) {
    if (canCreateDraft(ctx.profile?.role)) {
      const createBtn = element('button', 'btn btn-primary btn-sm client-quotation-create-draft', '+ Buat RAB Baru');
      createBtn.type = 'button';
      createBtn.addEventListener('click', () => createDraftQuotation(quotations, ctx));
      bodyEl.appendChild(createBtn);
    }
  } else if (editableQuotation) {
    draftEditor = buildDraftEditor(editableQuotation, itemsCache, lineItemsCache, ctx, bankAccounts);
    bodyEl.appendChild(draftEditor.wrap);
  }

  bodyEl.appendChild(element('h3', 'client-quotation-section-title', 'Dokumen Wajib'));
  if (templates.length === 0) {
    bodyEl.appendChild(element('div', 'client-quotation-empty', 'Belum ada template dokumen aktif.'));
  } else {
    const docList = element('div', 'client-quotation-doc-list');
    let lastCategory = null;
    templates.forEach((template) => {
      const categoryName = template.category?.name || 'Lainnya';
      if (categoryName !== lastCategory) {
        docList.appendChild(element('div', 'client-quotation-doc-category', categoryName));
        lastCategory = categoryName;
      }
      docList.appendChild(buildDocumentRow(template, documents, ctx, !activeQuotation || Boolean(editableQuotation)));
    });
    bodyEl.appendChild(docList);
  }

  if (activeQuotation) {
    const actionSection = element('div', 'client-quotation-send-section');
    const previewBtn = element('button', 'btn btn-outline', 'Preview');
    previewBtn.type = 'button';
    previewBtn.addEventListener('click', () => openQuotationPreview(activeQuotation, ctx, documents));

    if (editableQuotation && draftEditor) {
      const saveBtn = element('button', 'btn btn-outline', 'Simpan');
      saveBtn.type = 'button';
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        const { error, section } = await draftEditor.saveAll();
        if (error) {
          showToast(`Gagal menyimpan ${section}: ${error.message || 'terjadi kesalahan.'}`, { variant: 'error' });
          saveBtn.disabled = false;
          return;
        }
        showToast('RAB berhasil disimpan.', { variant: 'success' });
        await ctx.refresh();
      });

      const submitBtn = element('button', 'btn btn-primary', 'Ajukan Approval Internal');
      submitBtn.type = 'button';
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        const { error, section } = await draftEditor.saveAll();
        if (error) {
          showToast(`Gagal menyimpan ${section}: ${error.message || 'terjadi kesalahan.'}`, { variant: 'error' });
          submitBtn.disabled = false;
          return;
        }
        await submitForInternalApproval(editableQuotation, ctx);
      });
      actionSection.append(saveBtn, previewBtn, submitBtn);
    } else if (activeQuotation.status === 'PENDING_INTERNAL_APPROVAL') {
      actionSection.appendChild(previewBtn);
      if (canReviewQuotation(ctx.profile?.role)) {
        const reviseBtn = element('button', 'btn btn-outline', 'Minta Revisi');
        reviseBtn.type = 'button';
        reviseBtn.addEventListener('click', () => openReasonModal({
          quotation: activeQuotation,
          title: 'Minta Revisi RAB',
          description: `RAB versi ${activeQuotation.version} akan dikembalikan ke author untuk diperbaiki.`,
          label: 'Alasan revisi (wajib)',
          confirmLabel: 'Minta Revisi',
          onConfirm: requestQuotationRevision,
          ctx
        }));
        const approveBtn = element('button', 'btn btn-primary', 'Approve Internal');
        approveBtn.type = 'button';
        approveBtn.addEventListener('click', () => approveInternalQuotation(activeQuotation, ctx));
        actionSection.append(reviseBtn, approveBtn);
      } else {
        actionSection.appendChild(element('span', 'client-quotation-send-hint', 'RAB terkunci selama review admin/supervisor.'));
      }
    } else if (activeQuotation.status === 'APPROVED_INTERNAL') {
      actionSection.appendChild(previewBtn);
      if (canSendQuotation(ctx.profile?.role)) {
        const reopenBtn = element('button', 'btn btn-outline', 'Reopen untuk Revisi');
        reopenBtn.type = 'button';
        reopenBtn.addEventListener('click', () => openReasonModal({
          quotation: activeQuotation,
          title: 'Reopen RAB',
          description: `Approval RAB versi ${activeQuotation.version} akan dibatalkan dan RAB kembali editable.`,
          label: 'Alasan reopen (wajib)',
          confirmLabel: 'Reopen RAB',
          onConfirm: reopenApprovedQuotation,
          ctx
        }));
        const sendBtn = element('button', 'btn btn-primary', 'Kirim Penawaran');
        sendBtn.type = 'button';
        sendBtn.addEventListener('click', () => sendQuotation(activeQuotation, ctx));
        actionSection.append(reopenBtn, sendBtn);
      } else {
        actionSection.appendChild(element('span', 'client-quotation-send-hint', 'Hanya admin/supervisor yang dapat mengirim penawaran.'));
      }
    }
    bodyEl.appendChild(actionSection);
  }

  const rejectableQuotation = quotations.find((quotation) => quotation.status === 'SENT') || null;
  if (rejectableQuotation && canRejectQuotation(ctx.profile?.role)) {
    const rejectSection = element('div', 'client-quotation-send-section');
    const rejectBtn = element('button', 'btn btn-danger', 'Tolak Penawaran');
    rejectBtn.type = 'button';
    rejectBtn.addEventListener('click', () => openRejectQuotationModal(rejectableQuotation, ctx));
    rejectSection.appendChild(rejectBtn);
    bodyEl.appendChild(rejectSection);
  }
}

function openQuotationModal(project, { profile, clientId, client, onRefresh }) {
  const ctx = {
    caseId: project.id,
    clientId,
    profile,
    client,
    project,
    refresh: async () => {
      await renderModalBody(bodyEl, ctx);
      onRefresh?.();
    }
  };

  const { body: bodyEl } = showModal({
    title: `RAB & Penawaran — ${project.service_type || 'Project'}`,
    size: 'xl',
    actions: [{ label: 'Tutup', variant: 'outline' }]
  });
  bodyEl.classList.add('client-quotation-modal-body');

  renderModalBody(bodyEl, ctx);
}

/** Build the compact badge + button shown on each project card. */
export function buildQuotationSection(project, { profile, clientId, client, onRefresh }) {
  const wrap = element('div', 'client-quotation-section');
  wrap.appendChild(element('span', 'client-project-label', 'RAB & Penawaran'));

  const row = element('div', 'client-quotation-row');
  const quotations = quotationsByCaseId.get(project.id) || [];
  const latest = quotations[0] || null;
  const statusKey = latest?.status;
  const badgeClass = statusKey ? (STATUS_CLASS[statusKey] || '') : 'client-quotation-status-none';
  const badgeLabel = statusKey ? (STATUS_LABEL[statusKey] || statusKey) : 'Belum Dibuat';
  row.appendChild(element('span', `status ${badgeClass}`, badgeLabel));
  if (latest?.quotation_number) {
    row.appendChild(element('span', 'client-quotation-number-badge', latest.quotation_number));
  }

  const btn = element('button', 'btn btn-outline btn-sm', quotations.length ? 'Kelola RAB' : 'Buat RAB');
  btn.type = 'button';
  btn.addEventListener('click', () => openQuotationModal(project, { profile, clientId, client, onRefresh }));
  row.appendChild(btn);

  wrap.appendChild(row);
  return wrap;
}
