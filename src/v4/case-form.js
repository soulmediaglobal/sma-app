// SMA-app — Tambah Project Baru modal. Opened from the client detail page's
// Project tab ("+ Tambah Project"). PRD_Project_Intake_RAB_Workflow §1/§2.1:
// "Info Project" is now a standalone, lightweight section — 4 fields, no
// RAB/quotation/document fields at all (that's the separate "RAB &
// Penawaran" section, Part V). Status defaults to "Baru", intake_status
// defaults to DRAFT at the DB level.
// Query pattern follows src/v4/client-form.js. Team-picker UI mirrors the
// post-creation team section in src/v4/client-detail.js (buildTeamSection)
// so the add/remove chip pattern stays identical before and after creation.

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';
import { openMenu } from './menus.js';

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

// case_assignees RLS (audited, see supabase/migrations/20260822150000_*):
// admin/supervisor select+insert+delete, internal select-only. This is
// timing-agnostic — it applies the same whether the case already exists or
// is being created right now — so the "who can add team members" rule
// during creation is identical to the post-creation rule already enforced
// in client-detail.js.
function canManageAssignees(profile) {
  return Boolean(profile?.id && ['admin', 'supervisor'].includes(profile.role));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined) {node.textContent = text;}
  return node;
}

async function loadAssignableProfiles() {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['internal', 'supervisor'])
    .order('name', { ascending: true });
  return data || [];
}

function renderTeamChips(list, state) {
  list.innerHTML = '';

  if (state.pending.length === 0) {
    list.appendChild(element('span', 'client-project-team-empty', 'Belum ada anggota tim'));
  } else {
    state.pending.forEach((member) => {
      const chip = element('span', 'client-project-team-chip');
      chip.appendChild(element('span', '', member.name));
      const removeBtn = element('button', 'client-project-team-remove', '×');
      removeBtn.type = 'button';
      removeBtn.setAttribute('aria-label', `Hapus ${member.name} dari tim project`);
      removeBtn.addEventListener('click', () => {
        state.pending = state.pending.filter((m) => m.id !== member.id);
        renderTeamChips(list, state);
      });
      chip.appendChild(removeBtn);
      list.appendChild(chip);
    });
  }

  const addBtn = element('button', 'btn btn-outline btn-sm client-project-team-add', '+ Tambah');
  addBtn.type = 'button';
  addBtn.setAttribute('aria-haspopup', 'true');
  addBtn.setAttribute('aria-expanded', 'false');
  addBtn.addEventListener('click', () => openAddTeamMenu(addBtn, list, state));
  list.appendChild(addBtn);
}

async function openAddTeamMenu(trigger, list, state) {
  const candidates = await loadAssignableProfiles();
  const pendingIds = new Set(state.pending.map((m) => m.id));
  const available = candidates.filter((profile) => !pendingIds.has(profile.id));

  if (available.length === 0) {
    showToast('Semua staf yang tersedia sudah ditambahkan.', { variant: 'info' });
    return;
  }

  openMenu(trigger, available.map((profile) => ({
    label: profile.name,
    action: () => {
      state.pending.push({ id: profile.id, name: profile.name });
      renderTeamChips(list, state);
    }
  })));
}

function buildTeamField(profile, state) {
  const wrap = document.createElement('div');
  // A plain span, not <label> — this heads a chip list, not a single
  // form control, so there's nothing for a <label for> to associate with.
  wrap.appendChild(element('span', 'form-label', 'Tambah Team'));

  if (!canManageAssignees(profile)) {
    wrap.appendChild(element(
      'div',
      'client-project-team-empty',
      'Tim internal bisa ditambahkan setelah project dibuat (oleh admin/supervisor).'
    ));
    return wrap;
  }

  const list = element('div', 'client-project-team-list');
  wrap.appendChild(list);
  renderTeamChips(list, state);
  return wrap;
}

function buildForm(profile, state) {
  const form = document.createElement('form');
  form.id = 'case-form';
  form.noValidate = true;
  form.innerHTML = `
    <div class="form-group">
      <label class="form-label" for="case-creator">Project Creator</label>
      <input class="form-control" id="case-creator" type="text" disabled readonly>
    </div>
    <div class="form-group">
      <label class="form-label" for="case-service-type">Jenis layanan <span class="required">*</span></label>
      <select class="form-control" id="case-service-type" name="service_type" required>
        <option value="">Pilih jenis layanan</option>
        ${SERVICE_TYPES.map((s) => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" data-team-slot></div>
    <div class="form-group">
      <label class="form-label" for="case-notes">Deskripsi</label>
      <textarea class="form-control" id="case-notes" name="notes"></textarea>
    </div>
  `;
  // Set via property assignment, not innerHTML — profile.name is
  // user-editable data and must never be interpolated into a template string.
  form.querySelector('#case-creator').value = profile?.name || '—';
  form.querySelector('[data-team-slot]').appendChild(buildTeamField(profile, state));
  return form;
}

function casePayload(form, clientId, createdBy) {
  const notes = form.elements.namedItem('notes').value.trim();
  return {
    client_id: clientId,
    service_type: form.elements.namedItem('service_type').value,
    notes: notes || null,
    created_by: createdBy,
    status: 'Baru'
  };
}

async function insertTeam(caseId, clientId, profile, pending) {
  const { error } = await supabase
    .from('case_assignees')
    .insert(pending.map((member) => ({
      case_id: caseId,
      user_id: member.id,
      assigned_by: profile.id
    })));

  if (error) {
    showToast('Project tersimpan, tapi sebagian anggota tim gagal ditambahkan.', {
      variant: 'error',
      duration: 5000
    });
    return;
  }

  await Promise.all(pending.map((member) => supabase
    .from('activities')
    .insert({
      client_id: clientId,
      case_id: caseId,
      type: 'Tambah Anggota Tim',
      notes: `${member.name} ditambahkan ke tim internal project.`,
      by_user: profile.id
    })));
}

async function submitCase(ctx, form, clientId, profile, state, onCreated) {
  if (!form.reportValidity()) {return;}
  if (!profile?.id) {
    showToast('Gagal memuat profil pengguna. Muat ulang halaman.', { variant: 'error' });
    return;
  }

  const submitBtn = ctx.dialog.querySelector('.modal-footer .btn-primary');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan…';

  try {
    const payload = casePayload(form, clientId, profile.id);
    const pending = state.pending;

    if (pending.length > 0) {
      // Need the new row's id to attach case_assignees, so select it back.
      // Safe here (unlike a plain insert-only call): cases RLS grants
      // select to every role that can also insert (admin, internal).
      const { data, error } = await supabase
        .from('cases')
        .insert(payload)
        .select('id')
        .single();

      if (error || !data) {
        showToast('Gagal menambahkan project baru.', { variant: 'error' });
        return;
      }

      await insertTeam(data.id, clientId, profile, pending);
    } else {
      const { error } = await supabase.from('cases').insert(payload);

      if (error) {
        showToast('Gagal menambahkan project baru.', { variant: 'error' });
        return;
      }
    }

    showToast('Project baru berhasil ditambahkan.', { variant: 'success' });
    onCreated?.();
    ctx.close();
  } catch {
    showToast('Gagal menambahkan project baru.', { variant: 'error' });
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simpan Project';
  }
}

/**
 * Open the "Tambah Project Baru" modal for the given client.
 * @param {string} clientId
 * @param {{ onCreated?: () => void, profile?: { id: string, name: string, role: string } }} [opts]
 */
export function openAddCaseModal(clientId, { onCreated, profile } = {}) {
  const state = { pending: [] };
  const form = buildForm(profile, state);

  const ctx = showModal({
    title: 'Tambah Project Baru',
    body: form,
    size: 'md',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Simpan Project',
        variant: 'primary',
        closeOnAction: false,
        action: () => { submitCase(ctx, form, clientId, profile, state, onCreated); }
      }
    ]
  });
}
