import { supabase } from '../lib/supabaseClient.js';

const CASE_STATUS = {
  Baru: { label: 'Baru', className: 'is-new' },
  Proses: { label: 'Dalam Proses', className: 'is-progress' },
  Selesai: { label: 'Selesai', className: 'is-complete' },
  Batal: { label: 'Dibatalkan', className: 'is-cancelled' }
};
const COMPLETED_STAGE_STATUSES = new Set(['COMPLETED', 'SKIPPED']);
const ACTIVE_STAGE_STATUSES = new Set(['IN_PROGRESS', 'WAITING', 'BLOCKED']);
const ACTIVE_CASE_STATUSES = new Set(['Baru', 'Proses']);
const PUBLIC_CLIENT_ROUTES = new Set(['home', 'applications', 'help']);
const LINKED_CLIENT_ROUTES = new Set(['projects', 'documents', 'payments']);
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

let initializedRoot = null;

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Belum tersedia' : dateFormatter.format(date);
}

function shortReference(id) {
  return `#${String(id).slice(0, 8).toUpperCase()}`;
}

function statusConfig(status) {
  return CASE_STATUS[status] || { label: 'Status belum tersedia', className: 'is-neutral' };
}

function stageProgress(project) {
  const stages = project.stages;
  const completed = stages.filter(stage => COMPLETED_STAGE_STATUSES.has(stage.status)).length;
  const percentage = stages.length ? Math.round((completed / stages.length) * 100) : 0;
  const current =
    stages.find(stage => stage.id === project.current_stage_id) ||
    stages.find(stage => ACTIVE_STAGE_STATUSES.has(stage.status)) ||
    stages.find(stage => stage.status === 'PENDING') ||
    null;
  return { completed, percentage, current };
}

function safeDiagnostic(error, source) {
  const rawCode = String(error?.code || 'UNKNOWN');
  const code = /^[A-Z0-9_]+$/i.test(rawCode) ? rawCode.slice(0, 40) : 'UNKNOWN';
  const statusValue = Number(error?.status || 0);
  return {
    source,
    code,
    status: Number.isInteger(statusValue) && statusValue > 0 ? String(statusValue) : ''
  };
}

function createAction(label, action) {
  const button = createElement('button', 'client-project-action', label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function renderLoading(container) {
  container.setAttribute('aria-busy', 'true');
  const state = createElement('div', 'client-project-state');
  state.append(createElement('div', 'client-auth-spinner'));
  state.append(createElement('p', '', 'Memuat project kamu…'));
  container.replaceChildren(state);
}

function renderState(container, title, message, action) {
  container.setAttribute('aria-busy', 'false');
  const state = createElement('div', 'client-project-state');
  state.append(createElement('h2', '', title), createElement('p', '', message));
  if (action) {
    state.append(createAction(action.label, action.onClick));
  }
  container.replaceChildren(state);
}

function renderProgress(project) {
  const progress = stageProgress(project);
  const wrapper = createElement('div', 'client-project-progress');
  const copy = createElement('div', 'client-project-progress__copy');
  copy.append(
    createElement('span', '', 'Progres tahapan'),
    createElement(
      'strong',
      '',
      project.stagesUnavailable
        ? 'Progres tahapan belum dapat dimuat'
        : project.stages.length
          ? `${progress.completed} dari ${project.stages.length} tahap selesai`
          : 'Tahapan sedang disiapkan'
    )
  );
  const percentage = createElement('span', '', `${progress.percentage}%`);
  const track = createElement('div', 'client-project-progress__track');
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-label', `Progres ${project.service_type}`);
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  if (!project.stagesUnavailable) {
    track.setAttribute('aria-valuenow', String(progress.percentage));
  } else {
    track.setAttribute('aria-valuetext', 'Progres tahapan belum dapat dimuat');
  }
  const fill = createElement('span', 'client-project-progress__fill');
  fill.style.width = `${progress.percentage}%`;
  track.append(fill);
  wrapper.append(copy, percentage, track);
  if (project.stagesUnavailable) {
    wrapper.append(
      createElement('small', 'client-project-progress__warning', 'Data project tetap tersedia.')
    );
  } else if (progress.current) {
    wrapper.append(createElement('small', '', `Tahap saat ini: ${progress.current.name}`));
  }
  return wrapper;
}

function renderProjectCard(project, openDetail) {
  const status = statusConfig(project.status);
  const card = createElement('article', 'client-project-card');
  const header = createElement('div', 'client-project-card__header');
  const identity = createElement('div', 'client-project-card__identity');
  identity.append(
    createElement('span', 'client-project-reference', `Referensi ${shortReference(project.id)}`),
    createElement('h2', '', project.service_type || 'Layanan belum tersedia')
  );
  const badge = createElement('span', `client-project-status ${status.className}`, status.label);
  header.append(identity, badge);

  const metadata = createElement('div', 'client-project-card__meta');
  metadata.append(
    createElement('span', '', `Layanan: ${project.service_type || 'Belum tersedia'}`),
    createElement('span', '', `Update terakhir: ${formatDate(project.updated_at)}`)
  );

  const footer = createElement('div', 'client-project-card__footer');
  footer.append(createAction('Buka Detail', () => openDetail(project.id)));
  card.append(header, metadata, renderProgress(project), footer);
  return card;
}

function stageLabel(status) {
  if (COMPLETED_STAGE_STATUSES.has(status)) {
    return 'Selesai';
  }
  if (ACTIVE_STAGE_STATUSES.has(status)) {
    return status === 'WAITING' ? 'Menunggu' : 'Sedang berjalan';
  }
  if (status === 'CANCELLED') {
    return 'Dibatalkan';
  }
  return 'Belum dimulai';
}

function renderProjectDetail(container, project, goBack) {
  container.setAttribute('aria-busy', 'false');
  const wrapper = createElement('div', 'client-project-detail');
  const back = createAction('← Kembali ke daftar', goBack);
  back.classList.add('client-project-back');

  const heading = createElement('div', 'client-project-detail__heading');
  const titleGroup = createElement('div');
  titleGroup.append(
    createElement('span', 'client-project-reference', `Referensi ${shortReference(project.id)}`),
    createElement('h2', '', project.service_type || 'Layanan belum tersedia'),
    createElement('p', '', `Update terakhir ${formatDate(project.updated_at)}`)
  );
  const status = statusConfig(project.status);
  heading.append(
    titleGroup,
    createElement('span', `client-project-status ${status.className}`, status.label)
  );

  const stages = createElement('section', 'client-project-stages');
  stages.append(createElement('h3', '', 'Tahapan Project'), renderProgress(project));
  const list = createElement('ol', 'client-project-stage-list');
  if (project.stagesUnavailable) {
    list.append(
      createElement(
        'li',
        'client-project-stage client-project-stage--empty',
        'Tahapan belum dapat dimuat. Informasi utama project tetap tersedia.'
      )
    );
  } else if (!project.stages.length) {
    list.append(
      createElement(
        'li',
        'client-project-stage client-project-stage--empty',
        'Tahapan project sedang disiapkan oleh Tim SMA.'
      )
    );
  } else {
    project.stages.forEach(stage => {
      const item = createElement('li', 'client-project-stage');
      const marker = createElement('span', 'client-project-stage__marker');
      marker.setAttribute('aria-hidden', 'true');
      const copy = createElement('div');
      copy.append(
        createElement('strong', '', stage.name),
        createElement('span', '', stageLabel(stage.status))
      );
      item.append(marker, copy);
      list.append(item);
    });
  }
  stages.append(list);
  wrapper.append(back, heading, stages);
  container.replaceChildren(wrapper);
  heading.querySelector('h2').tabIndex = -1;
  heading.querySelector('h2').focus();
}

async function fetchProjects(clientId) {
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('id, client_id, service_type, status, current_stage_id, created_at, updated_at')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (casesError) {
    return { projects: null, diagnostic: safeDiagnostic(casesError, 'cases') };
  }
  if (!cases?.length) {
    return { projects: [] };
  }

  if (cases.some(project => project.client_id !== clientId)) {
    return {
      projects: null,
      diagnostic: { source: 'cases', code: 'OWNERSHIP_MISMATCH', status: '' }
    };
  }

  const caseIds = cases.map(project => project.id);
  const { data: stages, error: stagesError } = await supabase
    .from('case_stages')
    .select('id, case_id, name, order_index, status')
    .in('case_id', caseIds)
    .order('order_index', { ascending: true });

  if (stagesError) {
    return {
      projects: cases.map(project => ({ ...project, stages: [], stagesUnavailable: true })),
      diagnostic: safeDiagnostic(stagesError, 'case_stages')
    };
  }

  return {
    projects: cases.map(project => ({
      ...project,
      stages: (stages || []).filter(stage => stage.case_id === project.id),
      stagesUnavailable: false
    }))
  };
}

export function initClientPortalProjects({ root, profile }) {
  if (!root || initializedRoot === root) {
    return;
  }
  initializedRoot = root;

  const navShell = root.querySelector('[data-client-portal-nav-shell]');
  const navItems = Array.from(root.querySelectorAll('[data-portal-route]'));
  const views = new Map(
    Array.from(root.querySelectorAll('[data-portal-view]')).map(view => [
      view.dataset.portalView,
      view
    ])
  );
  const projectsContainer = root.querySelector('[data-client-projects]');
  const summaryContainer = root.querySelector('[data-client-project-summary]');
  const menuToggle = root.querySelector('[data-portal-menu-toggle]');
  const drawerBackdrop = root.querySelector('[data-portal-drawer-backdrop]');
  const linkedOnlyElements = root.querySelectorAll('[data-client-linked-only]');
  let projects = null;
  let diagnostic = null;
  let loadingPromise = null;

  navShell.hidden = false;
  menuToggle.hidden = false;
  linkedOnlyElements.forEach(element => {
    element.hidden = !profile.client_id;
  });

  function setDrawerOpen(open) {
    navShell.classList.toggle('is-open', open);
    drawerBackdrop.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute(
      'aria-label',
      open ? 'Tutup menu Client Portal' : 'Buka menu Client Portal'
    );
  }

  menuToggle.addEventListener('click', () => {
    setDrawerOpen(!navShell.classList.contains('is-open'));
  });
  drawerBackdrop.addEventListener('click', () => setDrawerOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navShell.classList.contains('is-open')) {
      setDrawerOpen(false);
      menuToggle.focus();
    }
  });
  navItems.forEach(item => item.addEventListener('click', () => setDrawerOpen(false)));

  function routeFromHash() {
    const value = window.location.hash.slice(1);
    if (value.startsWith('project/')) {
      return profile.client_id
        ? { view: 'projects', projectId: value.slice('project/'.length) }
        : { view: 'home', projectId: null };
    }
    const allowed =
      PUBLIC_CLIENT_ROUTES.has(value) || (profile.client_id && LINKED_CLIENT_ROUTES.has(value));
    return { view: allowed ? value : 'home', projectId: null };
  }

  function openDetail(projectId) {
    window.location.hash = `project/${projectId}`;
  }

  function renderProjectsList() {
    projectsContainer.setAttribute('aria-busy', 'false');
    const list = createElement('div', 'client-project-list');
    const activeCount = projects.filter(project => ACTIVE_CASE_STATUSES.has(project.status)).length;
    const counts = createElement('div', 'client-project-counts');
    counts.append(
      createElement('strong', '', `${activeCount} project aktif`),
      createElement('span', '', `${projects.length} project total`),
      createElement('small', '', 'Aktif mencakup status Baru dan Dalam Proses.')
    );
    list.append(counts);
    if (diagnostic?.source === 'case_stages') {
      list.append(createPartialWarning(diagnostic));
    }
    projects.forEach(project => list.append(renderProjectCard(project, openDetail)));
    projectsContainer.replaceChildren(list);
  }

  function createPartialWarning(value) {
    const warning = createElement('div', 'client-project-partial-warning');
    warning.setAttribute('role', 'status');
    warning.textContent = `Daftar project berhasil dimuat, tetapi progres tahapan belum tersedia (kode ${value.code}).`;
    return warning;
  }

  function renderHomeSummary() {
    summaryContainer.setAttribute('aria-busy', 'false');
    const activeProject = projects.find(project => !['Selesai', 'Batal'].includes(project.status));
    const project = activeProject || projects[0];
    if (!project) {
      renderState(
        summaryContainer,
        'Belum ada project',
        'Project akan tampil setelah pengajuan disetujui dan akses client diaktifkan.'
      );
      return;
    }
    summaryContainer.replaceChildren(renderProjectCard(project, openDetail));
    if (diagnostic?.source === 'case_stages') {
      summaryContainer.prepend(createPartialWarning(diagnostic));
    }
  }

  function setLoadState(state, value = null) {
    root.dataset.projectLoadState = state;
    projectsContainer.dataset.projectLoadState = state;
    summaryContainer.dataset.projectLoadState = state;
    [root, projectsContainer, summaryContainer].forEach(element => {
      if (value) {
        element.dataset.projectErrorSource = value.source;
        element.dataset.projectErrorCode = value.code;
        if (value.status) {
          element.dataset.projectErrorStatus = value.status;
        }
      } else {
        delete element.dataset.projectErrorSource;
        delete element.dataset.projectErrorCode;
        delete element.dataset.projectErrorStatus;
      }
    });
  }

  function retryLoad() {
    loadProjects(true);
  }

  async function loadProjects(force = false) {
    if (!profile.client_id) {
      projects = [];
      setLoadState('profile-unlinked');
      renderState(
        projectsContainer,
        'Akses project belum terhubung',
        'Profil akunmu belum terhubung dengan data client yang telah disetujui.'
      );
      renderState(
        summaryContainer,
        'Akses project belum terhubung',
        'Project akan tersedia setelah aktivasi client selesai.'
      );
      return;
    }
    if (projects && !force) {
      return;
    }
    if (loadingPromise) {
      await loadingPromise;
      return;
    }

    setLoadState('loading');
    renderLoading(projectsContainer);
    renderLoading(summaryContainer);
    loadingPromise = fetchProjects(profile.client_id);
    let result;
    try {
      result = await loadingPromise;
    } catch {
      result = { projects: null };
    } finally {
      loadingPromise = null;
    }
    projects = result.projects;
    diagnostic = result.diagnostic || null;
    if (projects === null) {
      setLoadState('query-error', diagnostic);
      renderState(
        projectsContainer,
        'Project belum dapat dimuat',
        `Query cases gagal atau akses data ditolak (kode ${diagnostic?.code || 'UNKNOWN'}). Coba lagi beberapa saat.`,
        {
          label: 'Coba Lagi',
          onClick: retryLoad
        }
      );
      renderState(
        summaryContainer,
        'Ringkasan belum dapat dimuat',
        'Status project belum tersedia. Coba lagi beberapa saat.',
        {
          label: 'Coba Lagi',
          onClick: retryLoad
        }
      );
      return;
    }
    if (!projects.length) {
      setLoadState('empty');
      renderState(
        projectsContainer,
        'Client belum memiliki project',
        'Belum ada project yang terdaftar untuk data client ini.'
      );
      renderHomeSummary();
      return;
    }
    setLoadState(diagnostic ? 'ready-partial' : 'ready', diagnostic);
    renderProjectsList();
    renderHomeSummary();
  }

  async function renderRoute() {
    const route = routeFromHash();
    views.forEach((view, key) => {
      view.hidden = key !== route.view;
    });
    navItems.forEach(item => {
      const active = item.dataset.portalRoute === route.view;
      item.classList.toggle('is-active', active);
      if (active) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });

    if (route.view === 'home') {
      if (profile.client_id) {
        await loadProjects();
      }
      views.get(route.view)?.querySelector('h1')?.focus();
      return;
    }

    if (route.view !== 'projects') {
      views.get(route.view)?.querySelector('h1')?.focus();
      return;
    }

    const requestedHash = window.location.hash;
    await loadProjects();
    if (window.location.hash !== requestedHash) {
      return;
    }
    if (!profile.client_id || !projects) {
      return;
    }
    if (!route.projectId) {
      renderProjectsList();
      return;
    }
    const project = projects.find(item => item.id === route.projectId);
    if (!project) {
      renderState(
        projectsContainer,
        'Project tidak ditemukan',
        'Project ini tidak tersedia untuk akunmu.',
        {
          label: 'Kembali ke Daftar',
          onClick: () => {
            window.location.hash = 'projects';
          }
        }
      );
      return;
    }
    renderProjectDetail(projectsContainer, project, () => {
      window.location.hash = 'projects';
    });
  }

  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
