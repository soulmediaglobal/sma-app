
/**
 * SMA-app — Client Workflow UI
 * UI prototype only.
 * NO Supabase query.
 * NO database mutation.
 * All workflow/project data below is dummy data.
 */

const PROJECTS = [
  {
    id: 'slf',
    name: 'SLF',
    status: 'Baru',
    statusClass: 'blue',
    pic: 'Tomy',
    rab: 'Rp75.000.000',
    created: '22 Agustus 2026',
    stage: 1,
    stageName: 'Pengumpulan Dokumen',
    responsibility: 'Client',
    action: 'Upload dokumen persyaratan',
    deadline: '27 Agustus 2026',
    description: 'Dokumen persyaratan awal untuk pengajuan SLF.',
    conditions: [
      ['Dokumen persyaratan sudah di-upload', false],
      ['Dokumen dapat diverifikasi SMA', false],
      ['Tidak ada dokumen yang kurang', false]
    ],
    documents: [
      ['KTP Direktur', 'Menunggu'],
      ['NPWP Perusahaan', 'Menunggu'],
      ['Dokumen Bangunan', 'Menunggu'],
      ['Dokumen Pendukung', 'Menunggu']
    ]
  },
  {
    id: 'izin-usaha',
    name: 'Izin Usaha',
    status: 'Proses',
    statusClass: 'yellow',
    pic: 'Bastomi',
    rab: 'Rp250.000.000',
    created: '22 Agustus 2026',
    stage: 3,
    stageName: 'Revisi Dokumen',
    responsibility: 'Client',
    action: 'Upload dokumen revisi yang diminta',
    deadline: '25 Agustus 2026',
    description: 'Upload dokumen revisi setelah proses verifikasi SMA.',
    conditions: [
      ['Dokumen revisi sudah di-upload', true],
      ['Dokumen memenuhi persyaratan', true],
      ['Tidak ada revisi tambahan', true]
    ],
    documents: [
      ['KTP Direktur', 'Lengkap'],
      ['NPWP Perusahaan', 'Lengkap'],
      ['Akta Perusahaan', 'Revisi'],
      ['Dokumen Pendukung', 'Menunggu']
    ]
  },
  {
    id: 'imb-pbg',
    name: 'IMB ke PBG',
    status: 'Selesai',
    statusClass: 'green',
    pic: 'Ray',
    rab: 'Rp12.000.000',
    created: '13 Agustus 2026',
    stage: 6,
    stageName: 'Selesai',
    responsibility: 'SMA',
    action: 'Project telah selesai',
    deadline: '22 Agustus 2026',
    description: 'Seluruh proses administrasi dan pembayaran telah selesai.',
    conditions: [
      ['Dokumen final sudah diterima', true],
      ['Proses administrasi selesai', true],
      ['Pembayaran sudah diverifikasi', true]
    ],
    documents: [
      ['KTP Direktur', 'Lengkap'],
      ['NPWP Perusahaan', 'Lengkap'],
      ['Akta Perusahaan', 'Lengkap'],
      ['Dokumen PBG', 'Lengkap']
    ]
  }
];

const STAGES = [
  'Pengumpulan Dokumen',
  'Verifikasi Dokumen',
  'Revisi Dokumen',
  'Proses Administrasi',
  'Pembayaran',
  'Selesai'
];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function stageStatus(index, currentStage) {
  if (index < currentStage) { return 'done'; }
  if (index === currentStage) { return 'active'; }
  return 'pending';
}

function renderProjectContext(project) {
  return `
    <div class="workflow-project-context">
      <div>
        <div class="workflow-eyebrow">PROJECT WORKFLOW</div>
        <div class="workflow-project-title">${esc(project.name)}</div>
        <div class="workflow-project-meta">
          <span class="workflow-project-status ${esc(project.statusClass)}">
            <span class="workflow-status-dot"></span>${esc(project.status)}
          </span>
          <span>PIC: <strong>${esc(project.pic)}</strong></span>
          <span>RAB: <strong>${esc(project.rab)}</strong></span>
          <span>Dibuat ${esc(project.created)}</span>
        </div>
      </div>

      <div class="workflow-project-selector">
        <label for="workflow-project-select">Workflow Project</label>
        <select id="workflow-project-select">
          ${PROJECTS.map((item) => `
            <option value="${esc(item.id)}" ${item.id === project.id ? 'selected' : ''}>
              ${esc(item.name)}
            </option>
          `).join('')}
        </select>
      </div>
    </div>
  `;
}

function renderStages(project) {
  return `
    <div class="workflow-card">
      <div class="workflow-card-header">
        <div>
          <div class="workflow-eyebrow">WORKFLOW PROGRESS</div>
          <h2>Progress Workflow</h2>
          <p>Alur pekerjaan <strong>${esc(project.name)}</strong> dari awal sampai selesai.</p>
        </div>
        <span class="workflow-stage-count">Tahap ${project.stage} dari ${STAGES.length}</span>
      </div>

      <div class="workflow-stages">
        ${STAGES.map((stage, index) => {
          const number = index + 1;
          const state = stageStatus(number, project.stage);

          return `
            <div class="workflow-stage ${state}">
              <div class="workflow-stage-line"></div>
              <div class="workflow-stage-dot">
                ${state === 'done' ? '✓' : number}
              </div>
              <div class="workflow-stage-title">${esc(stage)}</div>
              <div class="workflow-stage-status">
                ${state === 'done'
                  ? 'Selesai'
                  : state === 'active'
                    ? 'Sedang Berjalan'
                    : 'Belum Dimulai'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderResponsibility(project) {
  const completed = project.stage === 6;

  return `
    <div class="workflow-card">
      <div class="workflow-card-header">
        <div>
          <div class="workflow-eyebrow">CURRENT RESPONSIBILITY</div>
          <h2>${completed ? 'Project Telah Selesai' : 'Yang Perlu Dikerjakan Sekarang'}</h2>
        </div>
        <span class="workflow-owner-pill">${esc(project.responsibility)}</span>
      </div>

      <div class="workflow-responsibility">
        <div>
          <div class="workflow-small-label">TAHAP ${project.stage}</div>
          <h3>${esc(project.stageName)}</h3>
          <p>${esc(project.action)}</p>
        </div>

        <div class="workflow-responsibility-meta">
          <div>
            <span>Penanggung Jawab</span>
            <strong>${esc(project.responsibility)}</strong>
          </div>
          <div>
            <span>Deadline</span>
            <strong>${esc(project.deadline)}</strong>
          </div>
          <button class="btn btn-primary" type="button">
            ${completed ? 'Lihat Project' : 'Upload Revisi'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderDetails(project) {
  return `
    <div class="workflow-two-col">
      <div class="workflow-card">
        <div class="workflow-card-header">
          <div>
            <div class="workflow-eyebrow">DETAIL STAGE</div>
            <h2>${esc(project.stageName)}</h2>
          </div>
          <span class="workflow-state-pill">
            ${project.stage === 6 ? 'Selesai' : 'Sedang Berjalan'}
          </span>
        </div>

        <div class="workflow-detail-list">
          <div>
            <span>Status</span>
            <strong>
              ${project.stage === 6
                ? 'Seluruh proses telah selesai'
                : `Menunggu proses ${project.stageName.toLowerCase()}`}
            </strong>
          </div>
          <div>
            <span>Owner</span>
            <strong>${esc(project.responsibility)}</strong>
          </div>
          <div>
            <span>Next step</span>
            <strong>${esc(project.action)}</strong>
          </div>
        </div>
      </div>

      <div class="workflow-card">
        <div class="workflow-card-header">
          <div>
            <div class="workflow-eyebrow">COMPLETION CONDITIONS</div>
            <h2>Syarat Penyelesaian</h2>
          </div>
        </div>

        <div class="workflow-conditions">
          ${project.conditions.map(([label, checked]) => `
            <div class="workflow-condition ${checked ? 'checked' : ''}">
              <span>${checked ? '✓' : '○'}</span>
              <span>${esc(label)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderDocuments(project) {
  return `
    <div class="workflow-card">
      <div class="workflow-card-header">
        <div>
          <div class="workflow-eyebrow">DOCUMENT SUMMARY</div>
          <h2>Ringkasan Dokumen</h2>
        </div>
        <span class="workflow-stage-count">${project.documents.length} dokumen</span>
      </div>

      <div class="workflow-documents">
        ${project.documents.map(([name, status]) => `
          <div class="workflow-document">
            <span>${esc(name)}</span>
            <span class="workflow-document-status ${status === 'Lengkap' ? 'complete' : status === 'Revisi' ? 'revision' : 'waiting'}">
              ${esc(status)}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderWorkflow(root) {
  let selectedProjectId = PROJECTS[1].id;

  function render() {
    const project =
      PROJECTS.find((item) => item.id === selectedProjectId) || PROJECTS[0];

    root.innerHTML = `
      ${renderProjectContext(project)}
      ${renderStages(project)}
      ${renderResponsibility(project)}
      ${renderDetails(project)}
      ${renderDocuments(project)}
    `;

    const selector = root.querySelector('#workflow-project-select');
    if (selector) {
      selector.addEventListener('change', (event) => {
        selectedProjectId = event.target.value;
        render();
      });
    }
  }

  render();
}

export function initClientWorkflow() {
  const root = document.getElementById('client-workflow-root');
  if (!root) { return; }


  const defaultProject =
    PROJECTS.find((project) => project.id === 'izin-usaha') || PROJECTS[0];

  renderWorkflow(root, defaultProject);
}
