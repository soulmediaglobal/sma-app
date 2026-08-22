// SMA-app — Workflow tab on Client Detail.
// Menampilkan progress case_stages per project (case), current
// responsibility, detail stage, dan ringkasan dokumen. Read-only di
// task ini — edit stage (tambah/hapus/reorder/ubah owner) adalah scope
// terpisah (PRD_Workflow_Layer_SMA-app.md §3.2), belum diimplementasi.

import { supabase } from '../lib/supabaseClient.js';

const STATUS_LABEL = {
  Baru: 'Baru',
  Proses: 'Sedang Berjalan',
  Selesai: 'Selesai',
  Batal: 'Dibatalkan'
};

const STATUS_CLASS = {
  Baru: 'blue',
  Proses: 'yellow',
  Selesai: 'green',
  Batal: 'yellow'
};

const STAGE_DOT_STATE = {
  COMPLETED: 'done',
  SKIPPED: 'done',
  IN_PROGRESS: 'active',
  WAITING: 'active',
  BLOCKED: 'active',
  PENDING: 'pending',
  CANCELLED: 'pending',
  CANCELLED_LABEL: 'Dibatalkan'
};

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR'
});

let initialized = false;
let activeClientId = '';
let projects = [];
let stagesByCaseId = new Map();
let documentsByCaseId = new Map();
let selectedCaseId = '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) { node.className = className; }
  if (text !== undefined) { node.textContent = text; }
  return node;
}

function formatDate(value) {
  return value ? dateFmt.format(new Date(value)) : '—';
}

function formatRupiah(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? rupiah.format(number) : '—';
}

function setRootState(root, message, state) {
  root.replaceChildren();
  const status = element('div', 'workflow-project-context', message);
  status.setAttribute('role', state === 'error' ? 'alert' : 'status');
  root.appendChild(status);
  root.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function stageDotLabel(state, isCancelled) {
  if (isCancelled) { return 'Dibatalkan'; }
  if (state === 'done') { return 'Selesai'; }
  if (state === 'active') { return 'Sedang Berjalan'; }
  return 'Belum Dimulai';
}

function renderProjectContext(root, project) {
  const wrap = element('div', 'workflow-project-context');

  const left = element('div');
  left.append(element('div', 'workflow-eyebrow', 'PROJECT WORKFLOW'));
  left.append(element('div', 'workflow-project-title', project.service_type || 'Project tanpa jenis'));

  const meta = element('div', 'workflow-project-meta');
  const statusSpan = element('span', `workflow-project-status ${STATUS_CLASS[project.status] || ''}`);
  statusSpan.append(element('span', 'workflow-status-dot'), document.createTextNode(STATUS_LABEL[project.status] || project.status || '—'));
  meta.appendChild(statusSpan);

  const picSpan = element('span');
  picSpan.append(document.createTextNode('PIC: '));
  picSpan.append(element('strong', '', project.assignee?.name || 'Belum ditentukan'));
  meta.appendChild(picSpan);

  const rabSpan = element('span');
  rabSpan.append(document.createTextNode('RAB: '));
  rabSpan.append(element('strong', '', formatRupiah(project.total_rab)));
  meta.appendChild(rabSpan);

  meta.appendChild(element('span', '', `Dibuat ${formatDate(project.created_at)}`));
  left.appendChild(meta);
  wrap.appendChild(left);

  if (projects.length > 1) {
    const selectorWrap = element('div', 'workflow-project-selector');
    const label = element('label', '', 'Workflow Project');
    label.htmlFor = 'workflow-project-select';
    const select = element('select');
    select.id = 'workflow-project-select';
    projects.forEach((item) => {
      const option = element('option', '', item.service_type || 'Project tanpa jenis');
      option.value = item.id;
      option.selected = item.id === project.id;
      select.appendChild(option);
    });
    select.addEventListener('change', (event) => {
      selectedCaseId = event.target.value;
      renderWorkflow(root);
    });
    selectorWrap.append(label, select);
    wrap.appendChild(selectorWrap);
  }

  return wrap;
}

function renderStages(project, stages) {
  const card = element('div', 'workflow-card');
  const header = element('div', 'workflow-card-header');
  const headerLeft = element('div');
  headerLeft.append(element('div', 'workflow-eyebrow', 'WORKFLOW PROGRESS'));
  headerLeft.append(element('h2', '', 'Progress Workflow'));
  const desc = element('p');
  desc.append(document.createTextNode('Alur pekerjaan '));
  desc.append(element('strong', '', project.service_type || 'project ini'));
  desc.append(document.createTextNode(' dari awal sampai selesai.'));
  headerLeft.appendChild(desc);
  header.appendChild(headerLeft);

  if (stages.length > 0) {
    header.appendChild(element('span', 'workflow-stage-count', `${stages.filter((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED').length} dari ${stages.length} tahap selesai`));
  }
  card.appendChild(header);

  if (stages.length === 0) {
    card.appendChild(element('div', 'workflow-condition', 'Belum ada tahapan workflow untuk project ini.'));
    return card;
  }

  const stagesWrap = element('div', 'workflow-stages');
  stages.forEach((stage) => {
    const isCancelled = stage.status === 'CANCELLED';
    const state = STAGE_DOT_STATE[stage.status] || 'pending';
    const stageEl = element('div', `workflow-stage ${state}`);
    stageEl.appendChild(element('div', 'workflow-stage-line'));
    const dot = element('div', 'workflow-stage-dot', state === 'done' ? '✓' : String(stage.order_index));
    stageEl.appendChild(dot);
    stageEl.appendChild(element('div', 'workflow-stage-title', stage.name));
    stageEl.appendChild(element('div', 'workflow-stage-status', stageDotLabel(state, isCancelled)));
    stagesWrap.appendChild(stageEl);
  });
  card.appendChild(stagesWrap);

  return card;
}

function renderResponsibility(project, stages) {
  const card = element('div', 'workflow-card');
  const currentStage = stages.find((s) => s.id === project.current_stage_id);
  const header = element('div', 'workflow-card-header');
  const headerLeft = element('div');
  headerLeft.appendChild(element('div', 'workflow-eyebrow', 'CURRENT RESPONSIBILITY'));

  if (!currentStage) {
    const label = project.status === 'Selesai' ? 'Project Telah Selesai'
      : project.status === 'Batal' ? 'Project Dibatalkan'
        : 'Belum Ada Tahap Aktif';
    headerLeft.appendChild(element('h2', '', label));
    header.appendChild(headerLeft);
    card.appendChild(header);
    return card;
  }

  headerLeft.appendChild(element('h2', '', 'Yang Perlu Dikerjakan Sekarang'));
  header.appendChild(headerLeft);
  header.appendChild(element('span', 'workflow-owner-pill', currentStage.owner || '—'));
  card.appendChild(header);

  const body = element('div', 'workflow-responsibility');
  const left = element('div');
  left.appendChild(element('div', 'workflow-small-label', `TAHAP ${currentStage.order_index}`));
  left.appendChild(element('h3', '', currentStage.name));
  left.appendChild(element('p', '', currentStage.blocking_reason || 'Menunggu proses tahap ini.'));
  body.appendChild(left);

  const metaWrap = element('div', 'workflow-responsibility-meta');
  const ownerMeta = element('div');
  ownerMeta.appendChild(element('span', '', 'Penanggung Jawab'));
  ownerMeta.appendChild(element('strong', '', currentStage.owner || '—'));
  metaWrap.appendChild(ownerMeta);

  const dueMeta = element('div');
  dueMeta.appendChild(element('span', '', 'Deadline'));
  dueMeta.appendChild(element('strong', '', formatDate(currentStage.due_at)));
  metaWrap.appendChild(dueMeta);
  body.appendChild(metaWrap);

  card.appendChild(body);
  return card;
}

function renderDetails(stages, project) {
  const currentStage = stages.find((s) => s.id === project.current_stage_id);
  if (!currentStage) { return null; }

  const wrap = element('div', 'workflow-two-col');

  const detailCard = element('div', 'workflow-card');
  const detailHeader = element('div', 'workflow-card-header');
  const detailLeft = element('div');
  detailLeft.appendChild(element('div', 'workflow-eyebrow', 'DETAIL STAGE'));
  detailLeft.appendChild(element('h2', '', currentStage.name));
  detailHeader.appendChild(detailLeft);
  detailHeader.appendChild(element('span', 'workflow-state-pill', stageDotLabel(STAGE_DOT_STATE[currentStage.status] || 'pending', currentStage.status === 'CANCELLED')));
  detailCard.appendChild(detailHeader);

  const list = element('div', 'workflow-detail-list');
  const ownerRow = element('div');
  ownerRow.appendChild(element('span', '', 'Owner'));
  ownerRow.appendChild(element('strong', '', currentStage.owner || '—'));
  list.appendChild(ownerRow);

  const startedRow = element('div');
  startedRow.appendChild(element('span', '', 'Mulai'));
  startedRow.appendChild(element('strong', '', formatDate(currentStage.started_at)));
  list.appendChild(startedRow);

  if (currentStage.blocking_reason) {
    const blockedRow = element('div');
    blockedRow.appendChild(element('span', '', 'Catatan'));
    blockedRow.appendChild(element('strong', '', currentStage.blocking_reason));
    list.appendChild(blockedRow);
  }
  detailCard.appendChild(list);
  wrap.appendChild(detailCard);

  return wrap;
}

function renderDocuments(documents) {
  const card = element('div', 'workflow-card');
  const header = element('div', 'workflow-card-header');
  const headerLeft = element('div');
  headerLeft.appendChild(element('div', 'workflow-eyebrow', 'DOCUMENT SUMMARY'));
  headerLeft.appendChild(element('h2', '', 'Ringkasan Dokumen'));
  header.appendChild(headerLeft);
  header.appendChild(element('span', 'workflow-stage-count', `${documents.length} dokumen`));
  card.appendChild(header);

  if (documents.length === 0) {
    card.appendChild(element('div', 'workflow-condition', 'Belum ada dokumen untuk project ini.'));
    return card;
  }

  const list = element('div', 'workflow-documents');
  documents.forEach((doc) => {
    const row = element('div', 'workflow-document');
    row.appendChild(element('span', '', doc.name));
    const statusClass = doc.status === 'Terverifikasi' ? 'complete'
      : doc.status === 'Ditolak' ? 'revision'
        : 'waiting';
    row.appendChild(element('span', `workflow-document-status ${statusClass}`, doc.status));
    list.appendChild(row);
  });
  card.appendChild(list);

  return card;
}

function renderWorkflow(root) {
  const project = projects.find((p) => p.id === selectedCaseId) || projects[0];
  if (!project) {
    setRootState(root, 'Client ini belum memiliki project.', 'empty');
    return;
  }
  selectedCaseId = project.id;

  const stages = stagesByCaseId.get(project.id) || [];
  const documents = documentsByCaseId.get(project.id) || [];

  root.replaceChildren();
  root.appendChild(renderProjectContext(root, project));
  root.appendChild(renderStages(project, stages));
  root.appendChild(renderResponsibility(project, stages));
  const details = renderDetails(stages, project);
  if (details) { root.appendChild(details); }
  root.appendChild(renderDocuments(documents));
  root.setAttribute('aria-busy', 'false');
}

async function loadWorkflow(root) {
  setRootState(root, 'Memuat workflow…', 'loading');

  try {
    const { data: caseRows, error: caseError } = await supabase
      .from('cases')
      .select('id, service_type, status, total_rab, created_at, current_stage_id, assignee:profiles(name)')
      .eq('client_id', activeClientId)
      .order('created_at', { ascending: false });

    if (caseError) {
      setRootState(root, 'Gagal memuat workflow.', 'error');
      return;
    }

    projects = caseRows || [];
    if (projects.length === 0) {
      setRootState(root, 'Client ini belum memiliki project.', 'empty');
      return;
    }

    const caseIds = projects.map((p) => p.id);

    const [{ data: stageRows, error: stageError }, { data: docRows, error: docError }] = await Promise.all([
      supabase
        .from('case_stages')
        .select('id, case_id, name, order_index, status, owner, blocking_reason, due_at, started_at, completed_at')
        .in('case_id', caseIds)
        .order('order_index', { ascending: true }),
      supabase
        .from('documents')
        .select('id, case_id, name, status')
        .in('case_id', caseIds)
    ]);

    if (stageError || docError) {
      setRootState(root, 'Gagal memuat detail workflow.', 'error');
      return;
    }

    stagesByCaseId = new Map();
    (stageRows || []).forEach((stage) => {
      const list = stagesByCaseId.get(stage.case_id) || [];
      list.push(stage);
      stagesByCaseId.set(stage.case_id, list);
    });

    documentsByCaseId = new Map();
    (docRows || []).forEach((doc) => {
      const list = documentsByCaseId.get(doc.case_id) || [];
      list.push(doc);
      documentsByCaseId.set(doc.case_id, list);
    });

    selectedCaseId = projects[0].id;
    renderWorkflow(root);
  } catch {
    setRootState(root, 'Gagal memuat workflow.', 'error');
  }
}

export async function initClientWorkflow({ clientId } = {}) {
  const root = document.getElementById('client-workflow-root');
  if (!root || initialized) { return; }
  initialized = true;
  activeClientId = clientId || '';
  await loadWorkflow(root);
}
