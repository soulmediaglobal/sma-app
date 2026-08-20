// SMA-app — Tambah Client Baru form.
// One-page form (not a wizard) for §5.1 fields, grouped in the 4 agreed
// sections. Only `name` and `type` are required. On submit, INSERT into
// `clients` and redirect to the new client's Detail page. PRD §6.3.

import { supabase } from '../lib/supabaseClient.js';
import { showToast } from './toast.js';

const EDITABLE_FIELDS = [
  'name',
  'type',
  'npwp',
  'nib',
  'business_field',
  'address',
  'pic_name',
  'pic_title',
  'pic_phone',
  'pic_email',
  'director_name',
  'director_phone',
  'director_id_number',
  'referral_source',
  'general_notes'
];

const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

let existingClients = [];

function findSimilarName(name) {
  const q = normalize(name);
  if (q.length < 3) {return null;}
  return existingClients.find((c) => {
    const cn = normalize(c.name);
    return cn === q || cn.includes(q) || q.includes(cn);
  }) || null;
}

function wireDuplicateWarning(form) {
  const nameInput = form.elements.namedItem('name');
  const warning = document.getElementById('client-form-duplicate-warning');
  const text = document.getElementById('client-form-duplicate-text');

  nameInput.addEventListener('input', () => {
    const match = findSimilarName(nameInput.value);
    if (match) {
      text.innerHTML = `Sudah ada client dengan nama serupa: <strong>${match.name}</strong>. Lanjutkan?`;
      warning.style.display = 'flex';
    } else {
      warning.style.display = 'none';
    }
  });
}

async function loadExistingNames() {
  const { data } = await supabase.from('clients').select('id, name');
  existingClients = data || [];
}

function formPayload(form) {
  return Object.fromEntries(EDITABLE_FIELDS.map((field) => {
    const value = form.elements.namedItem(field).value.trim();
    return [field, ['name', 'type'].includes(field) ? value : value || null];
  }));
}

async function submitClient(form) {
  if (!form.reportValidity()) {return;}
  const submitButton = document.getElementById('client-form-submit');
  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';

  try {
    const { data, error } = await supabase
      .from('clients')
      .insert(formPayload(form))
      .select('id')
      .single();

    if (error || !data) {
      showToast('Gagal menyimpan client baru.', { variant: 'error' });
      return;
    }

    showToast('Client baru berhasil ditambahkan.', { variant: 'success' });
    window.location.href = `client-detail.html?id=${encodeURIComponent(data.id)}`;
  } catch {
    showToast('Gagal menyimpan client baru.', { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Simpan Client';
  }
}

export async function initClientForm() {
  const form = document.getElementById('client-form');
  if (!form) {return;}

  wireDuplicateWarning(form);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitClient(form);
  });

  await loadExistingNames();
}
