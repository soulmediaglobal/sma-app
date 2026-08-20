// SMA-app — Tambah Case Baru modal. Opened from the client detail page's
// Case & Progress tab ("+ Tambah Case"). PRD §6.4: compact form — jenis
// layanan, RAB, catatan opsional, PIC opsional. Status defaults to "Baru".
// Query pattern follows src/v4/client-form.js.

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

// Static list per issue #7's technical note — dropdown to be Settings-managed
// later (separate task), hardcoded for now.
const SERVICE_TYPES = [
  'Pendirian PT',
  'Pendirian CV',
  'Pendirian Yayasan',
  'NPWP',
  'NIB',
  'PBG',
  'SLF',
  'Izin Usaha',
  'Merek Dagang',
  'Lainnya'
];

function buildForm() {
  const form = document.createElement('form');
  form.id = 'case-form';
  form.noValidate = true;
  form.innerHTML = `
    <div class="form-group">
      <label class="form-label" for="case-service-type">Jenis layanan <span class="required">*</span></label>
      <select class="form-control" id="case-service-type" name="service_type" required>
        <option value="">Pilih jenis layanan</option>
        ${SERVICE_TYPES.map((s) => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="case-rab">RAB (Rp) <span class="required">*</span></label>
      <input class="form-control" id="case-rab" name="total_rab" type="number" min="1" step="1" required>
    </div>
    <div class="form-group">
      <label class="form-label" for="case-pic">PIC</label>
      <select class="form-control" id="case-pic" name="assigned_to">
        <option value="">Belum di-assign</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label" for="case-notes">Catatan</label>
      <textarea class="form-control" id="case-notes" name="notes"></textarea>
    </div>
  `;
  return form;
}

async function loadInternalUsers(select) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .in('role', ['admin', 'internal'])
    .order('name', { ascending: true });

  (data || []).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

function casePayload(form, clientId) {
  const notes = form.elements.namedItem('notes').value.trim();
  const assignedTo = form.elements.namedItem('assigned_to').value;
  return {
    client_id: clientId,
    service_type: form.elements.namedItem('service_type').value,
    total_rab: Number(form.elements.namedItem('total_rab').value),
    notes: notes || null,
    assigned_to: assignedTo || null,
    status: 'Baru'
  };
}

async function submitCase(ctx, form, clientId, onCreated) {
  if (!form.reportValidity()) {return;}

  const submitBtn = ctx.dialog.querySelector('.modal-footer .btn-primary');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan…';

  try {
    // Deliberately not chaining .select().single() here: that would ask
    // PostgREST to read the row back under the table's SELECT policy, which
    // can be narrower than the INSERT policy and reject the read-back even
    // though the write succeeded — surfacing a false error. Nothing here
    // consumes the inserted row yet, so we only need to know the write
    // itself didn't fail.
    const { error } = await supabase
      .from('cases')
      .insert(casePayload(form, clientId));

    if (error) {
      showToast('Gagal menambahkan case baru.', { variant: 'error' });
      return;
    }

    showToast('Case baru berhasil ditambahkan.', { variant: 'success' });
    onCreated?.();
    ctx.close();
  } catch {
    showToast('Gagal menambahkan case baru.', { variant: 'error' });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Case';
  }
}

/**
 * Open the "Tambah Case Baru" modal for the given client.
 * @param {string} clientId
 * @param {{ onCreated?: () => void }} [opts]
 */
export function openAddCaseModal(clientId, { onCreated } = {}) {
  const form = buildForm();

  const ctx = showModal({
    title: 'Tambah Case Baru',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Simpan Case',
        variant: 'primary',
        closeOnAction: false,
        action: () => { submitCase(ctx, form, clientId, onCreated); }
      }
    ]
  });

  loadInternalUsers(form.elements.namedItem('assigned_to'));
}
