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

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

const STATUS_LABEL = {
  DRAFT: 'Draft',
  SENT: 'Menunggu Persetujuan',
  ACCEPTED: 'Diterima',
  REJECTED: 'Ditolak',
  NEGOTIATING: 'Nego',
  SUPERSEDED: 'Digantikan'
};

const STATUS_CLASS = {
  DRAFT: 'status-blue',
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

function canCreateDraft(role) {
  return ['admin', 'supervisor', 'internal'].includes(role);
}

function canSendQuotation(role) {
  return ['admin', 'supervisor'].includes(role);
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
    .select('id, description, detail, qty, rate, amount, order_index')
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

function buildVersionRow(quotation, itemsCache, lineItemsCache, ctx, documents) {
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

  return row;
}

function itemRowTemplate() {
  return { term_name: '', amount: '', due_condition: '' };
}

function lineItemRowTemplate() {
  return { description: '', detail: '', qty: 1, rate: '' };
}

function computeTotal(items) {
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function computeLineItemAmount(item) {
  const qty = Number(item.qty);
  const rate = Number(item.rate);
  if (!Number.isFinite(qty) || !Number.isFinite(rate)) {return 0;}
  return qty * rate;
}

function computeLineItemsTotal(items) {
  return items.reduce((sum, item) => sum + computeLineItemAmount(item), 0);
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
  }

  state.items.forEach((item, index) => {
    const row = element('div', 'client-quotation-line-item-row');

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

    const rateInput = element('input', 'form-control');
    rateInput.type = 'number';
    rateInput.min = '0';
    rateInput.step = 'any';
    rateInput.placeholder = 'Rate (Rp)';
    rateInput.value = item.rate;

    const amountDisplay = element('span', 'client-quotation-line-item-amount', rupiah.format(computeLineItemAmount(item)));

    function recomputeAmount() {
      amountDisplay.textContent = rupiah.format(computeLineItemAmount(item));
      onChange?.();
    }
    qtyInput.addEventListener('input', () => { item.qty = qtyInput.value; recomputeAmount(); });
    rateInput.addEventListener('input', () => { item.rate = rateInput.value; recomputeAmount(); });

    const moveUp = element('button', 'client-quotation-item-move', '↑');
    moveUp.type = 'button';
    moveUp.disabled = index === 0;
    moveUp.setAttribute('aria-label', 'Pindah ke atas');
    moveUp.addEventListener('click', () => {
      [state.items[index - 1], state.items[index]] = [state.items[index], state.items[index - 1]];
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    const moveDown = element('button', 'client-quotation-item-move', '↓');
    moveDown.type = 'button';
    moveDown.disabled = index === state.items.length - 1;
    moveDown.setAttribute('aria-label', 'Pindah ke bawah');
    moveDown.addEventListener('click', () => {
      [state.items[index], state.items[index + 1]] = [state.items[index + 1], state.items[index]];
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    const removeBtn = element('button', 'client-quotation-item-remove', '×');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', 'Hapus rincian pekerjaan');
    removeBtn.addEventListener('click', () => {
      state.items.splice(index, 1);
      renderEditableLineItems(container, state, onChange);
      onChange?.();
    });

    row.append(descInput, detailInput, qtyInput, rateInput, amountDisplay, moveUp, moveDown, removeBtn);
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
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    if (!item.description.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate <= 0) {
      return { error: new Error('Deskripsi wajib diisi, qty dan rate harus lebih dari 0.') };
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
        quotation_id: draftId,
        description: item.description.trim(),
        detail: item.detail?.trim() || null,
        qty: Number(item.qty),
        rate: Number(item.rate),
        amount: computeLineItemAmount(item),
        order_index: index
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
    .eq('status', 'DRAFT');
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
      .eq('status', 'DRAFT');
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

function buildDraftEditor(draft, itemsCache, lineItemsCache, ctx) {
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

  // Aggregate "Simpan" for the action row — runs the same persistence each
  // section's own save button already offers, so the draft can be saved in
  // one explicit click instead of three scattered ones. Stops at the first
  // failing section rather than saving partially and hiding which part broke.
  async function saveAll() {
    const sections = [
      ['Deskripsi', descriptionEditor.save],
      ['Detail Pekerjaan', lineItemsEditor.save],
      ['Termin Pembayaran', terminSection.save]
    ];
    for (const [section, save] of sections) {
      const { error } = await save();
      if (error) {return { error, section };}
    }
    return { error: null };
  }

  return { wrap, saveAll };
}

async function createDraftQuotation(quotations, ctx) {
  const nextVersion = quotations.length ? Math.max(...quotations.map((q) => q.version)) + 1 : 1;
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

async function sendQuotation(draft, ctx) {
  if (!(draft.total_amount > 0)) {
    showToast('Tambahkan minimal 1 rincian pekerjaan (nilai RAB) sebelum mengirim penawaran.', { variant: 'error' });
    return;
  }

  const { error: updateError, count } = await supabase
    .from('case_quotations')
    .update({ status: 'SENT', sent_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', draft.id)
    .eq('status', 'DRAFT');

  if (updateError || count !== 1) {
    showToast('Gagal mengirim penawaran.', { variant: 'error' });
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
    notes: `Penawaran RAB versi ${draft.version} dikirim ke client (total ${rupiah.format(draft.total_amount || 0)}).`,
    profile: ctx.profile
  });

  showToast('Penawaran berhasil dikirim.', { variant: 'success' });
  await ctx.refresh();
}

// ============================================================================
// Preview Dokumen Formal (Issue #66) — read-only, no status change.
// ============================================================================

const previewDateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

async function fetchCompanySettings() {
  const { data, error } = await supabase.from('company_settings').select('key, value');
  if (error) {return {};}
  const settings = {};
  (data || []).forEach((row) => { settings[row.key] = row.value; });
  return settings;
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
  const table = docEl(doc, 'table', 'preview-table');
  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');
  ['No', 'Deskripsi', 'Qty', 'Rate', 'Jumlah'].forEach((h) => headRow.appendChild(docEl(doc, 'th', '', h)));
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = doc.createElement('tbody');
  let total = 0;
  items.forEach((item, index) => {
    const row = doc.createElement('tr');
    row.appendChild(docEl(doc, 'td', '', String(index + 1)));
    const descCell = docEl(doc, 'td', 'preview-table-desc');
    descCell.appendChild(docEl(doc, 'div', '', item.description));
    if (item.detail) {descCell.appendChild(docEl(doc, 'div', 'preview-table-detail', item.detail));}
    row.appendChild(descCell);
    row.appendChild(docEl(doc, 'td', 'preview-table-num', String(item.qty)));
    row.appendChild(docEl(doc, 'td', 'preview-table-num', rupiah.format(item.rate || 0)));
    row.appendChild(docEl(doc, 'td', 'preview-table-num', rupiah.format(item.amount || 0)));
    tbody.appendChild(row);
    total += Number(item.amount) || 0;
  });
  table.appendChild(tbody);

  const tfoot = doc.createElement('tfoot');
  const totalRow = doc.createElement('tr');
  const totalLabel = docEl(doc, 'td', 'preview-table-total-label', 'Total');
  totalLabel.colSpan = 4;
  totalRow.appendChild(totalLabel);
  totalRow.appendChild(docEl(doc, 'td', 'preview-table-num preview-table-total', rupiah.format(total)));
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
  const { generatedDate, quotationNumber, serviceType, client, description, lineItems, terminItems, documents, company, contact } = data;

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
  const rek = docEl(doc, 'div', 'preview-rekening');
  rek.appendChild(docEl(doc, 'p', '', `Bank: ${company?.bank_name || '—'}`));
  rek.appendChild(docEl(doc, 'p', '', `No. Rekening: ${company?.bank_account_number || '—'}`));
  rek.appendChild(docEl(doc, 'p', '', `Atas Nama: ${company?.bank_account_holder || '—'}`));
  root.appendChild(rek);

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

  const [lineItems, terminItems, company, contact] = await Promise.all([
    fetchQuotationLineItems(quotation.id),
    fetchQuotationItems(quotation.id),
    fetchCompanySettings(),
    fetchCaseCreatorContact(ctx.caseId)
  ]);

  if (win.closed) {return;}

  // A DRAFT hasn't been sent yet — its letter date is "today" (whenever it's
  // printed/sent). A past version already has a real send date; previewing
  // it later should show that historical date, not today's, or reviewing an
  // old SENT/ACCEPTED offer would misrepresent when it was actually issued.
  const historicalDate = quotation.sent_at || (quotation.status !== 'DRAFT' ? quotation.created_at : null);

  renderPreviewWindow(win, {
    generatedDate: previewDateFmt.format(historicalDate ? new Date(historicalDate) : new Date()),
    quotationNumber: quotation.quotation_number,
    serviceType: ctx.project?.service_type,
    client: ctx.client,
    description: quotation.description,
    lineItems: lineItems || [],
    terminItems: terminItems || [],
    documents: documents || [],
    company,
    contact
  });
}

function buildDocumentRow(template, documents, ctx) {
  const row = element('label', 'client-quotation-doc-row');
  const matches = documents.filter((doc) => doc.name === template.name);
  const locked = matches.filter((doc) => doc.status !== 'Belum');
  const isChecked = matches.length > 0;
  const isLocked = locked.length > 0;

  const allowed = canManageDocuments(ctx.profile?.role);
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

  const [quotationsResult, templatesResult, documentsResult] = await Promise.all([
    supabase
      .from('case_quotations')
      .select('id, case_id, version, status, total_amount, notes, quotation_number, description, sent_at, responded_at, client_response_notes, created_by, created_at, creator:profiles!created_by(id, name)')
      .eq('case_id', ctx.caseId)
      .order('version', { ascending: false }),
    supabase
      .from('document_templates')
      .select('id, name, category')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('documents')
      .select('id, name, status')
      .eq('case_id', ctx.caseId)
  ]);

  if (quotationsResult.error || templatesResult.error || documentsResult.error) {
    bodyEl.replaceChildren(element('div', 'client-quotation-empty', 'Gagal memuat data RAB & Penawaran.'));
    return;
  }

  const quotations = quotationsResult.data || [];
  const templates = templatesResult.data || [];
  const documents = documentsResult.data || [];
  const draft = quotations.find((q) => q.status === 'DRAFT') || null;
  const itemsCache = new Map();
  const lineItemsCache = new Map();

  bodyEl.replaceChildren();

  bodyEl.appendChild(element('h3', 'client-quotation-section-title', 'Riwayat Versi'));
  if (quotations.length === 0) {
    bodyEl.appendChild(element('div', 'client-quotation-empty', 'Belum ada RAB dibuat untuk project ini.'));
  } else {
    const list = element('div', 'client-quotation-version-list');
    quotations.forEach((quotation) => list.appendChild(buildVersionRow(quotation, itemsCache, lineItemsCache, ctx, documents)));
    bodyEl.appendChild(list);
  }

  let draftEditor = null;
  if (!draft) {
    if (canCreateDraft(ctx.profile?.role)) {
      const createBtn = element('button', 'btn btn-primary btn-sm client-quotation-create-draft', '+ Buat RAB Baru');
      createBtn.type = 'button';
      createBtn.addEventListener('click', () => createDraftQuotation(quotations, ctx));
      bodyEl.appendChild(createBtn);
    }
  } else {
    draftEditor = buildDraftEditor(draft, itemsCache, lineItemsCache, ctx);
    bodyEl.appendChild(draftEditor.wrap);
  }

  bodyEl.appendChild(element('h3', 'client-quotation-section-title', 'Dokumen Wajib'));
  if (templates.length === 0) {
    bodyEl.appendChild(element('div', 'client-quotation-empty', 'Belum ada template dokumen aktif.'));
  } else {
    const docList = element('div', 'client-quotation-doc-list');
    let lastCategory = null;
    templates.forEach((template) => {
      if (template.category !== lastCategory) {
        docList.appendChild(element('div', 'client-quotation-doc-category', template.category || 'Lainnya'));
        lastCategory = template.category;
      }
      docList.appendChild(buildDocumentRow(template, documents, ctx));
    });
    bodyEl.appendChild(docList);
  }

  if (draft && draftEditor) {
    const actionSection = element('div', 'client-quotation-send-section');

    const saveBtn = element('button', 'btn btn-outline', 'Simpan');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan…';
      const { error, section } = await draftEditor.saveAll();
      if (error) {
        showToast(`Gagal menyimpan ${section}: ${error.message || 'terjadi kesalahan.'}`, { variant: 'error' });
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan';
        return;
      }
      itemsCache.delete(draft.id);
      lineItemsCache.delete(draft.id);
      showToast('Draft berhasil disimpan.', { variant: 'success' });
      await ctx.refresh();
    });

    const previewBtn = element('button', 'btn btn-outline', 'Preview');
    previewBtn.type = 'button';
    previewBtn.addEventListener('click', () => openQuotationPreview(draft, ctx, documents));

    const sendBtn = element('button', 'btn btn-primary', 'Kirim Penawaran');
    sendBtn.type = 'button';
    const allowed = canSendQuotation(ctx.profile?.role);
    const hasItems = (draft.total_amount || 0) > 0;
    sendBtn.disabled = !allowed || !hasItems;
    sendBtn.addEventListener('click', () => sendQuotation(draft, ctx));

    actionSection.append(saveBtn, previewBtn, sendBtn);
    if (!allowed) {
      actionSection.appendChild(element('span', 'client-quotation-send-hint', 'Hanya admin/supervisor yang dapat mengirim penawaran.'));
    } else if (!hasItems) {
      actionSection.appendChild(element('span', 'client-quotation-send-hint', 'Tambahkan minimal 1 rincian pekerjaan (nilai RAB) sebelum mengirim.'));
    }
    bodyEl.appendChild(actionSection);
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
    size: 'lg',
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
