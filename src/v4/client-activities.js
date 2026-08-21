// SMA-app — Activity feed on Client Detail.
// Combines manual entries with automatic case, document, and payment logs.

import { supabase } from '../lib/supabaseClient.js';
import { showModal } from './modal.js';
import { showToast } from './toast.js';

const relativeTime = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
const projectDateTime = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

let initialized = false;
let activeClientId = '';
let currentProfile = null;
let projects = [];
let canCreateActivity = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {node.className = className;}
  if (text !== undefined) {node.textContent = text;}
  return node;
}

function setPanelState(root, message, state) {
  root.replaceChildren();
  const status = element('div', `client-activities-state client-activities-state-${state}`, message);
  status.setAttribute('role', state === 'error' ? 'alert' : 'status');
  root.appendChild(status);
  root.dataset.state = state;
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function formatRelativeTime(value) {
  if (!value) {return 'Waktu tidak tersedia';}
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {return 'Waktu tidak tersedia';}

  const difference = timestamp - Date.now();
  const absolute = Math.abs(difference);
  const units = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000]
  ];
  const [unit, milliseconds] = units.find(([, size]) => absolute >= size) || ['second', 1000];
  const relativeValue = Math.round(absolute / milliseconds) * Math.sign(difference);
  return relativeTime.format(relativeValue, unit);
}

function initials(name) {
  if (!name) {return '?';}
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function relatedRecord(value) {
  if (Array.isArray(value)) {return value[0] || null;}
  return value && typeof value === 'object' ? value : null;
}

function projectOptionLabel(project, duplicateTypes) {
  const serviceType = project.service_type || 'Project tanpa jenis';
  if (!duplicateTypes.has(serviceType)) {return serviceType;}

  const timestamp = new Date(project.created_at);
  const discriminator = Number.isFinite(timestamp.getTime())
    ? projectDateTime.format(timestamp)
    : `ID ${String(project.id).slice(0, 8)}`;
  return `${serviceType} — ${discriminator}`;
}

function createActivityEntry(activity) {
  const item = element('li', 'client-activity-entry');
  const user = relatedRecord(activity.by);
  const project = relatedRecord(activity.project);
  const userName = user?.name || 'Pengguna tidak tersedia';
  const avatar = element('div', 'client-activity-avatar', initials(user?.name));
  avatar.setAttribute('aria-hidden', 'true');

  const content = element('div', 'client-activity-content');
  const header = element('div', 'client-activity-header');
  header.append(
    element('strong', 'client-activity-user', userName),
    element('span', 'client-activity-type', activity.type || 'Jenis tidak tersedia')
  );

  const notes = element('p', 'client-activity-notes', activity.notes || 'Tidak ada catatan.');
  const meta = element('div', 'client-activity-meta');
  meta.appendChild(element('time', 'client-activity-time', formatRelativeTime(activity.created_at)));

  if (activity.case_id) {
    meta.appendChild(element(
      'span',
      'client-activity-project',
      project?.service_type || 'Project tidak tersedia'
    ));
  }

  content.append(header, notes, meta);
  item.append(avatar, content);
  return item;
}

function renderActivities(root, activities) {
  root.replaceChildren();
  const toolbar = element('div', 'client-activity-toolbar');
  toolbar.appendChild(element('h2', '', 'Riwayat Aktivitas'));
  if (canCreateActivity) {
    const addButton = element('button', 'btn btn-primary btn-sm', '+ Catat Aktivitas');
    addButton.type = 'button';
    addButton.dataset.addActivity = '';
    toolbar.appendChild(addButton);
  }
  root.appendChild(toolbar);

  if (activities.length === 0) {
    root.appendChild(element('div', 'client-activity-empty', 'Belum ada aktivitas untuk client ini.'));
  } else {
    const feed = element('ol', 'client-activity-feed');
    activities.forEach((activity) => feed.appendChild(createActivityEntry(activity)));
    root.appendChild(feed);
  }

  root.dataset.state = 'ready';
  root.setAttribute('aria-busy', 'false');
}

async function loadActivities(root) {
  setPanelState(root, 'Memuat aktivitas…', 'loading');
  projects = [];

  try {
    const caseQuery = canCreateActivity
      ? supabase
        .from('cases')
        .select('id, client_id, service_type, created_at')
        .eq('client_id', activeClientId)
        .order('service_type', { ascending: true })
      : Promise.resolve({ data: [], error: null });
    const [caseResult, activityResult] = await Promise.all([
      caseQuery,
      supabase
        .from('activities')
        .select(`
          id,
          client_id,
          case_id,
          type,
          notes,
          by_user,
          created_at,
          by:profiles(name),
          project:cases(service_type)
        `)
        .eq('client_id', activeClientId)
        .order('created_at', { ascending: false })
    ]);

    if (caseResult.error) {
      setPanelState(root, 'Gagal memuat daftar project.', 'error');
      return false;
    }
    if (activityResult.error) {
      setPanelState(root, 'Gagal memuat aktivitas.', 'error');
      return false;
    }

    projects = caseResult.data || [];
    renderActivities(root, activityResult.data || []);
    return true;
  } catch {
    setPanelState(root, 'Gagal memuat aktivitas.', 'error');
    return false;
  }
}

function buildActivityForm() {
  const form = document.createElement('form');
  form.id = 'activity-form';
  form.noValidate = true;

  const typeGroup = element('div', 'form-group');
  const typeLabel = element('label', 'form-label', 'Jenis aktivitas');
  typeLabel.htmlFor = 'activity-type';
  const typeInput = element('input', 'form-control');
  typeInput.id = 'activity-type';
  typeInput.name = 'type';
  typeInput.type = 'text';
  typeInput.required = true;
  typeGroup.append(typeLabel, typeInput);

  const notesGroup = element('div', 'form-group');
  const notesLabel = element('label', 'form-label', 'Catatan');
  notesLabel.htmlFor = 'activity-notes';
  const notesInput = element('textarea', 'form-control');
  notesInput.id = 'activity-notes';
  notesInput.name = 'notes';
  notesInput.rows = 4;
  notesInput.required = true;
  notesGroup.append(notesLabel, notesInput);

  const projectGroup = element('div', 'form-group');
  const projectLabel = element('label', 'form-label', 'Project');
  projectLabel.htmlFor = 'activity-case-id';
  const projectSelect = element('select', 'form-control');
  projectSelect.id = 'activity-case-id';
  projectSelect.name = 'case_id';
  const noProject = element('option', '', 'Tanpa project');
  noProject.value = '';
  projectSelect.appendChild(noProject);
  const typeCounts = new Map();
  projects.forEach((project) => {
    const serviceType = project.service_type || 'Project tanpa jenis';
    typeCounts.set(serviceType, (typeCounts.get(serviceType) || 0) + 1);
  });
  const duplicateTypes = new Set(
    [...typeCounts].filter(([, count]) => count > 1).map(([serviceType]) => serviceType)
  );
  projects.forEach((project) => {
    const option = element('option', '', projectOptionLabel(project, duplicateTypes));
    option.value = project.id;
    projectSelect.appendChild(option);
  });
  projectGroup.append(projectLabel, projectSelect);

  form.append(typeGroup, notesGroup, projectGroup);
  return form;
}

async function submitActivity(ctx, form, root) {
  if (!canCreateActivity || !currentProfile?.id || !form.reportValidity()) {return;}
  const submitButton = ctx.dialog.querySelector('.modal-footer .btn-primary');
  if (submitButton.disabled) {return;}

  const type = form.elements.namedItem('type').value.trim();
  const notes = form.elements.namedItem('notes').value.trim();
  const caseId = form.elements.namedItem('case_id').value.trim();
  if (!type || !notes || (caseId && !projects.some((project) => project.id === caseId))) {
    showToast('Jenis, catatan, atau project tidak valid.', { variant: 'error' });
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Menyimpan…';
  try {
    const { error } = await supabase.from('activities').insert({
      client_id: activeClientId,
      case_id: caseId || null,
      type,
      notes,
      by_user: currentProfile.id
    });

    if (error) {
      showToast('Gagal mencatat aktivitas.', { variant: 'error' });
      return;
    }

    ctx.close();
    const reloaded = await loadActivities(root);
    if (reloaded) {
      showToast('Aktivitas berhasil dicatat.', { variant: 'success' });
    } else {
      showToast('Aktivitas tersimpan, tetapi feed gagal dimuat ulang.', {
        variant: 'error',
        duration: 5000
      });
    }
  } catch {
    showToast('Gagal mencatat aktivitas.', { variant: 'error' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Catat Aktivitas';
  }
}

function openActivityModal(root) {
  if (!canCreateActivity || !currentProfile?.id) {return;}
  const form = buildActivityForm();
  const ctx = showModal({
    title: 'Catat Aktivitas',
    body: form,
    size: 'sm',
    actions: [
      { label: 'Batal', variant: 'outline' },
      {
        label: 'Catat Aktivitas',
        variant: 'primary',
        closeOnAction: false,
        action: () => {submitActivity(ctx, form, root);}
      }
    ]
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    submitActivity(ctx, form, root);
  });
}

function wireActions(root) {
  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-add-activity]')) {openActivityModal(root);}
  });
}

export async function initClientActivities({ clientId, profile } = {}) {
  const root = document.getElementById('client-activities-root');
  if (!root || initialized) {return;}
  initialized = true;
  activeClientId = clientId || '';
  currentProfile = profile || null;

  const role = currentProfile?.role;
  if (!['admin', 'internal', 'client'].includes(role)) {
    setPanelState(root, 'Anda tidak memiliki akses ke aktivitas client.', 'error');
    return;
  }

  canCreateActivity = ['admin', 'internal'].includes(role);
  wireActions(root);
  await loadActivities(root);
}
