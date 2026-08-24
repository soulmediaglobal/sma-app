const navItems = [
  { key: 'home', label: 'Beranda', icon: '⌂' },
  { key: 'services', label: 'Layanan Saya', icon: '◇' },
  { key: 'documents', label: 'Dokumen', icon: '▤' },
  { key: 'payments', label: 'Pembayaran', icon: '◫' },
  { key: 'profile', label: 'Profil', icon: '○' },
];

const stages = ['Diterima', 'Siapkan dokumen', 'Verifikasi', 'Diproses', 'Selesai'];

const clientMilestones = [
  'Pengajuan Diterima',
  'Persiapan Dokumen',
  'Verifikasi Dokumen',
  'Proses Perizinan',
  'Selesai'
];

const waitingLabels = {
  team: ['Tim SMA', 'team', 'SMA'],
  client: ['Anda', 'client', 'Anda'],
  agency: ['Instansi', 'agency', 'Instansi'],
  none: ['Tidak ada', 'none', '✓']
};

const sharedUpdates = [
  { icon: '✓', title: 'Dokumen Akta Pendirian disetujui', note: 'Dokumen telah selesai diperiksa oleh Tim SMA.', time: 'Kemarin' },
  { icon: '↗', title: 'Pengajuan masuk tahap verifikasi', note: 'Kelengkapan dokumen perusahaan mulai diperiksa.', time: '20 Agu' },
  { icon: '✓', title: 'Pengajuan PBG diterima', note: 'Layanan berhasil dibuat dan tercatat di portal.', time: '18 Agu' }
];

const homeScenarios = {
  normal: {
    label: 'Proses normal tanpa tindakan',
    milestone: 3,
    condition: 'Dokumen lengkap dan sedang diverifikasi oleh Tim SMA.',
    waiting: 'team',
    nextStep: 'Kami akan memberi kabar setelah pemeriksaan selesai.',
    documentSummary: '5 dari 6 disetujui',
    paymentSummary: 'DP sudah diterima',
    actions: [],
    updates: [
      { icon: '↻', title: 'Dokumen terakhir sedang diperiksa', note: 'Tidak ada tindakan yang perlu Anda lakukan saat ini.', time: '10 menit lalu' },
      ...sharedUpdates
    ]
  },
  revision: {
    label: 'Client perlu memperbaiki dokumen',
    milestone: 4,
    condition: 'Diperlukan penyesuaian NIB berdasarkan hasil pemeriksaan.',
    waiting: 'client',
    nextStep: 'Unggah versi NIB yang menampilkan seluruh nomor dokumen.',
    documentSummary: '1 dokumen perlu diperbaiki',
    paymentSummary: 'DP sudah diterima',
    actions: [
      { type: 'revision', icon: '▤', urgency: 0, dueAt: '2026-08-23', due: 'Besok, 23 Agu', eyebrow: 'DOKUMEN · PBG', title: 'Perbaiki dokumen NIB', description: 'Nomor NIB pada file sebelumnya terpotong.', cta: 'Perbaiki dokumen' }
    ],
    updates: [
      { icon: '!', title: 'Perbaikan dokumen NIB diminta', note: 'Tim SMA menambahkan instruksi perbaikan untuk dokumen Anda.', time: '12 menit lalu', tone: 'warning' },
      ...sharedUpdates
    ]
  },
  team: {
    label: 'Menunggu tindakan Tim SMA',
    milestone: 3,
    condition: 'NIB pengganti telah diterima dan sedang diperiksa.',
    waiting: 'team',
    nextStep: 'Tim SMA sedang memeriksa dokumen terbaru Anda.',
    documentSummary: '1 dokumen sedang diperiksa',
    paymentSummary: 'DP sudah diterima',
    actions: [],
    updates: [
      { icon: '✓', title: 'Dokumen NIB pengganti diterima', note: 'Versi terbaru berhasil masuk antrean pemeriksaan.', time: '8 menit lalu' },
      ...sharedUpdates
    ]
  },
  agency: {
    label: 'Menunggu instansi',
    milestone: 4,
    condition: 'Berkas PBG telah disampaikan dan menunggu pemeriksaan instansi.',
    waiting: 'agency',
    nextStep: 'Kami akan memperbarui portal setelah ada tanggapan instansi.',
    documentSummary: '6 dari 6 disetujui',
    paymentSummary: 'DP sudah diterima',
    actions: [],
    updates: [
      { icon: '↗', title: 'Berkas disampaikan ke instansi', note: 'Pengajuan PBG telah masuk ke tahap pemeriksaan instansi.', time: 'Hari ini, 09.10' },
      ...sharedUpdates
    ]
  },
  dp: {
    label: 'Menunggu pembayaran DP',
    milestone: 1,
    condition: 'Layanan siap dimulai setelah pembayaran DP dikonfirmasi.',
    waiting: 'client',
    nextStep: 'Lihat invoice DP dan ikuti petunjuk pembayaran.',
    documentSummary: 'Checklist belum dimulai',
    paymentSummary: 'DP menunggu pembayaran',
    actions: [
      { type: 'payment', icon: 'Rp', urgency: 1, dueAt: '2026-08-24', due: 'Jatuh tempo 24 Agu', eyebrow: 'PEMBAYARAN · PBG', title: 'Pembayaran DP diperlukan', description: 'Pembayaran DP diperlukan sebelum persiapan dokumen dimulai.', cta: 'Lihat pembayaran' }
    ],
    updates: [
      { icon: 'Rp', title: 'Invoice DP diterbitkan', note: 'Invoice tersedia pada halaman Pembayaran.', time: 'Hari ini, 08.30', tone: 'payment' },
      { icon: '✓', title: 'Pengajuan PBG diterima', note: 'Layanan berhasil dibuat dan menunggu aktivasi.', time: 'Kemarin' },
      ...sharedUpdates.slice(2)
    ]
  },
  multiple: {
    label: 'Beberapa tindakan sekaligus',
    milestone: 4,
    condition: 'Proses perizinan berjalan dengan beberapa kelengkapan menunggu respons Anda.',
    waiting: 'client',
    nextStep: 'Selesaikan tindakan berdasarkan urutan urgensi di bawah.',
    documentSummary: '2 dokumen perlu tindakan',
    paymentSummary: '1 termin menunggu pembayaran',
    actions: [
      { type: 'revision', icon: '▤', urgency: 0, dueAt: '2026-08-22', due: 'Tenggat hari ini', eyebrow: 'DOKUMEN · PBG', title: 'Perbaiki dokumen NIB', description: 'Nomor dokumen pada unggahan sebelumnya terpotong.', cta: 'Perbaiki dokumen' },
      { type: 'approval', icon: '✓', urgency: 1, dueAt: '2026-08-23', due: 'Besok, 23 Agu', eyebrow: 'PERSETUJUAN · PBG', title: 'Konfirmasi perubahan layanan', description: 'Tim SMA membutuhkan persetujuan sebelum proses dilanjutkan.', cta: 'Berikan persetujuan' },
      { type: 'payment', icon: 'Rp', urgency: 1, dueAt: '2026-08-25', due: '25 Agu', eyebrow: 'PEMBAYARAN · NIB', title: 'Termin berikutnya tersedia', description: 'Lihat rincian termin sebelum batas pembayaran.', cta: 'Lihat pembayaran' },
      { type: 'document', icon: '↑', urgency: 2, dueAt: '2026-08-28', due: '28 Agu', eyebrow: 'DOKUMEN · NIB', title: 'Unggah surat kuasa', description: 'Surat kuasa diperlukan untuk melengkapi pengajuan.', cta: 'Unggah dokumen' }
    ],
    updates: [
      { icon: '!', title: 'Tiga tindakan perlu diperhatikan', note: 'Tindakan dengan tenggat terdekat ditampilkan lebih dahulu.', time: 'Baru saja', tone: 'warning' },
      { icon: '↗', title: 'Proses PBG tetap berjalan', note: 'Milestone tertinggi tidak berubah saat ada penyesuaian.', time: '1 jam lalu' },
      ...sharedUpdates
    ]
  }
};

function selectedScenarioKey() {
  const key = new URLSearchParams(window.location.search).get('scenario');
  return Object.hasOwn(homeScenarios, key) ? key : 'revision';
}

function route() {
  const current = window.location.hash.replace('#', '') || 'home';
  return ['home', 'services', 'service-detail', 'documents', 'payments', 'profile'].includes(current) ? current : 'home';
}

function navKey(current) {
  return current === 'service-detail' ? 'services' : current;
}

function shell(current, content) {
  const active = navKey(current);
  return `
    <div class="portal-layout">
      <aside class="sidebar">
        <a class="brand" href="#home">
          <span class="brand__mark">S</span>
          <span><strong>Soul Mitra Abadi</strong><small>Client Portal</small></span>
        </a>
        <nav class="sidebar__nav" aria-label="Navigasi utama">
          ${navItems.map((item) => `<a class="nav-link ${active === item.key ? 'is-active' : ''}" href="#${item.key}"><span class="nav-link__icon">${item.icon}</span>${item.label}</a>`).join('')}
        </nav>
        <div class="sidebar__support">
          <i>?</i><strong>Ada pertanyaan?</strong>
          <p>Tim kami siap membantu selama jam kerja.</p>
          <button class="button button--ghost button--small" data-action="support">Hubungi tim SMA</button>
        </div>
        <a class="sidebar__user" href="#profile">
          <span class="avatar">DA</span>
          <span><strong>Dimas Ari</strong><small>PT Artha Prima Sejahtera</small></span>
        </a>
      </aside>
      <header class="topbar">
        <a class="brand topbar__mobile-brand" href="#home"><span class="brand__mark">S</span><span><strong>SMA Portal</strong></span></a>
        <div class="breadcrumb">Client Portal <strong>› ${pageName(current)}</strong></div>
        <div class="topbar__actions">
          <button class="icon-button" data-action="notifications" aria-label="Notifikasi">♢</button>
          <button class="icon-button" data-action="support" aria-label="Bantuan">?</button>
          <a class="desktop-account" href="#profile"><span>Dimas Ari</span><span class="avatar">DA</span></a>
        </div>
      </header>
      <main class="portal-main">${content}</main>
      <nav class="bottom-nav" aria-label="Navigasi mobile">
        ${navItems.map((item) => `<a class="${active === item.key ? 'is-active' : ''}" href="#${item.key}"><i>${item.icon}</i>${item.label.replace(' Saya', '')}</a>`).join('')}
      </nav>
    </div>`;
}

function pageName(current) {
  return ({ home: 'Beranda', services: 'Layanan Saya', 'service-detail': 'Detail Layanan', documents: 'Dokumen', payments: 'Pembayaran', profile: 'Profil' })[current];
}

function progressSteps(activeIndex = 2) {
  return `<div class="progress-steps">${stages.map((stage, index) => `<div class="progress-step ${index < activeIndex ? 'is-done' : ''} ${index === activeIndex ? 'is-active' : ''}"><i>${index < activeIndex ? '✓' : index + 1}</i><span>${stage}</span></div>`).join('')}</div>`;
}

function pageHead(eyebrow, title, description, extra = '') {
  return `<header class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${extra || '<span class="page-head__date">Jumat, 21 Agustus 2026</span>'}</header>`;
}

function homeProgress(highestMilestone) {
  return `<div class="client-progress" aria-label="Progress layanan: tahap ${highestMilestone} dari ${clientMilestones.length}">
    ${clientMilestones.map((milestone, index) => {
      const number = index + 1;
      const state = number < highestMilestone ? 'is-done' : number === highestMilestone ? 'is-active' : '';
      return `<div class="client-progress__step ${state}">
        <div class="client-progress__marker">${number < highestMilestone ? '✓' : number}</div>
        <span>${milestone}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function scenarioTool(activeKey) {
  return `<aside class="scenario-tool" aria-label="Alat demo prototype">
    <div><span>ALAT DEMO</span><strong>Ganti skenario Beranda</strong></div>
    <label><span class="sr-only">Skenario prototype</span><select data-scenario-select>
      ${Object.entries(homeScenarios).map(([key, scenario]) => `<option value="${key}" ${key === activeKey ? 'selected' : ''}>${scenario.label}</option>`).join('')}
    </select></label>
  </aside>`;
}

function waitingIndicator(waiting) {
  const [label, className, icon] = waitingLabels[waiting] || waitingLabels.none;
  return `<div class="waiting-indicator waiting-indicator--${className}">
    <span class="waiting-indicator__icon" aria-hidden="true">${icon}</span>
    <span><small>SEDANG MENUNGGU</small><strong>${label}</strong></span>
  </div>`;
}

function actionCard(action) {
  return `<article class="home-action home-action--${action.type}">
    <div class="home-action__top">
      <span class="home-action__icon" aria-hidden="true">${action.icon}</span>
      <span class="home-action__due">${action.due}</span>
    </div>
    <span class="home-action__eyebrow">${action.eyebrow}</span>
    <h3>${action.title}</h3>
    <p>${action.description}</p>
    <button class="button button--warning button--block" type="button" data-home-action="${action.type}" data-home-action-title="${action.title}">${action.cta} →</button>
  </article>`;
}

function homeActions(actions) {
  const prioritized = [...actions]
    .sort((a, b) => a.urgency - b.urgency || new Date(a.dueAt) - new Date(b.dueAt));
  const visible = prioritized.slice(0, 3);

  if (visible.length === 0) {
    return `<section class="home-section" aria-labelledby="home-actions-title">
      <div class="home-section__head"><div><span class="eyebrow">TINDAKAN</span><h2 id="home-actions-title">Perlu Tindakan Anda</h2></div></div>
      <div class="home-action-empty"><span aria-hidden="true">✓</span><div><strong>Tidak ada tindakan untuk saat ini</strong><p>Proses sedang berjalan. Kami akan memberi tahu jika ada yang perlu Anda lakukan.</p></div></div>
    </section>`;
  }

  return `<section class="home-section" aria-labelledby="home-actions-title">
    <div class="home-section__head"><div><span class="eyebrow">TINDAKAN</span><h2 id="home-actions-title">Perlu Tindakan Anda</h2><p>Diurutkan berdasarkan urgensi dan tenggat terdekat.</p></div>
      ${prioritized.length > visible.length ? `<button class="home-section__link" type="button" data-view-all-actions>Lihat Semua Tindakan (${prioritized.length}) →</button>` : ''}
    </div>
    <div class="home-actions-grid">${visible.map(actionCard).join('')}</div>
  </section>`;
}

function updatesTimeline(updates) {
  return updates.slice(0, 5).map((update) => `<div class="timeline-item ${update.tone ? `timeline-item--${update.tone}` : ''}">
    <span class="timeline-item__dot" aria-hidden="true">${update.icon}</span>
    <div><h4>${update.title}</h4><p>${update.note}</p></div>
    <time>${update.time}</time>
  </div>`).join('');
}

function homePage() {
  const scenarioKey = selectedScenarioKey();
  const scenario = homeScenarios[scenarioKey];

  return `<section class="page home-page">
    ${scenarioTool(scenarioKey)}
    ${pageHead('SELAMAT DATANG KEMBALI', 'Halo, Dimas 👋', 'Berikut hal terpenting dari proses legalitas PT Artha Prima Sejahtera hari ini.')}
    <article class="card home-progress-card">
      <div class="home-progress-card__head">
        <div class="service-name"><span class="service-icon">P</span><div><h2>Layanan PBG</h2><p>SMA-PBG-2026-0081 · Aktif</p></div></div>
        <a class="button button--ghost button--small" href="#service-detail">Lihat detail →</a>
      </div>
      ${homeProgress(scenario.milestone)}
      <div class="home-current-state">
        <div><span class="home-current-state__label">MILESTONE TERTINGGI</span><strong>${clientMilestones[scenario.milestone - 1]}</strong></div>
        <div><span class="home-current-state__label">KONDISI SAAT INI</span><strong>${scenario.condition}</strong><p>${scenario.nextStep}</p></div>
        ${waitingIndicator(scenario.waiting)}
      </div>
    </article>

    ${homeActions(scenario.actions)}

    <div class="metric-grid home-metrics">
      <article class="metric"><span class="metric__icon">▤</span><span>Dokumen</span><strong>${scenario.documentSummary}</strong><a href="#documents">Lihat dokumen →</a></article>
      <article class="metric"><span class="metric__icon">Rp</span><span>Pembayaran</span><strong>${scenario.paymentSummary}</strong><a href="#payments">Lihat pembayaran →</a></article>
      <article class="metric"><span class="metric__icon">↗</span><span>Pembaruan</span><strong>${scenario.updates.length} kabar terbaru</strong><button type="button" data-view-all-updates>Lihat semua →</button></article>
    </div>

    <div class="home-lower-grid">
      <article class="card home-updates"><div class="card__head"><div><h3>Pembaruan Terbaru</h3><p>Riwayat penting yang dibagikan oleh Tim SMA</p></div><button class="home-section__link" type="button" data-view-all-updates>Lihat Semua Pembaruan →</button></div><div class="card__body"><div class="timeline">${updatesTimeline(scenario.updates)}</div></div></article>
      <article class="card home-help"><div class="card__body"><span class="home-help__icon">?</span><span class="eyebrow">BUTUH BANTUAN?</span><h3>Kami siap mendampingi</h3><p>Hubungi Tim SMA jika ada bagian proses yang ingin Anda tanyakan.</p><button class="button button--ghost button--block" type="button" data-action="support">Hubungi Tim SMA</button></div></article>
    </div>
  </section>`;
}

function servicesPage() {
  const item = (icon, name, date, status, statusClass, done, action) => `<article class="service-row"><div class="service-row__main"><span class="service-icon">${icon}</span><div><h3>${name}</h3><p>Dibuat ${date}</p><div class="mini-progress">${[0,1,2,3,4].map((i) => `<i class="${i < done ? 'is-done' : ''}"></i>`).join('')}</div></div></div><div class="service-row__aside"><span class="status ${statusClass}">${status}</span><a class="button button--ghost button--small" href="${action}">Lihat detail →</a></div></article>`;
  return `<section class="page">${pageHead('LAYANAN SAYA', 'Semua proses dalam satu tempat', 'Pilih layanan untuk melihat progress, dokumen, pembayaran, dan update yang terkait.', '<button class="button button--primary" data-action="request-service">+ Ajukan layanan</button>')}
    <div class="service-list">
      ${item('P', 'PBG', '20 Agustus 2026', 'Sedang diverifikasi', '', 2, '#service-detail')}
      ${item('N', 'NIB', '20 Agustus 2026', 'Persiapan dokumen', 'status--warning', 1, '#service-detail')}
      ${item('S', 'SLF', '17 Agustus 2026', 'Selesai', 'status--neutral', 5, '#service-detail')}
    </div>
  </section>`;
}

function detailPage() {
  return `<section class="page">
    <a href="#services" class="card__link">← Kembali ke Layanan Saya</a>
    <article class="card" style="margin-top:16px">
      <div class="detail-hero"><div><span class="eyebrow">DETAIL LAYANAN</span><h1>PBG</h1><p>Nomor layanan SMA-PBG-2026-0081 · Dibuat 20 Agustus 2026</p></div><span class="status">Sedang diverifikasi</span></div>
      <div class="card__body" style="padding-top:0">${progressSteps(2)}</div>
      <div class="detail-tabs" role="tablist"><button class="detail-tab is-active" data-tab="overview">Ringkasan</button><button class="detail-tab" data-tab="docs">Dokumen</button><button class="detail-tab" data-tab="pay">Pembayaran</button><button class="detail-tab" data-tab="updates">Update</button></div>
      <div class="detail-panel is-active" data-panel="overview"><div class="info-pairs"><div class="info-pair"><span>Status saat ini</span><strong>Verifikasi dokumen</strong></div><div class="info-pair"><span>Pendamping</span><strong>Ray</strong></div><div class="info-pair"><span>Estimasi berikutnya</span><strong>2–3 hari kerja</strong></div></div><article class="card action-card" style="margin-top:18px"><div class="card__body"><small>PERLU TINDAKAN ANDA</small><h3>Unggah ulang NIB</h3><p>Pastikan seluruh sisi dokumen terlihat dan teks dapat dibaca.</p><button class="button button--warning" data-action="upload">Unggah dokumen</button></div></article></div>
      <div class="detail-panel" data-panel="docs"><div class="document-row"><div><h4>NIB</h4><p>Perlu diunggah ulang</p></div><span class="status status--warning">Perlu diperbaiki</span><button class="button button--primary button--small" data-action="upload">Unggah</button></div><div class="document-row"><div><h4>Akta pendirian</h4><p>Diverifikasi 20 Agustus</p></div><span class="status">Terverifikasi</span><span></span></div></div>
      <div class="detail-panel" data-panel="pay"><div class="document-row"><div><h4>DP</h4><p>Dibayar 20 Agustus 2026</p></div><strong>Rp7.500.000</strong><span class="status">Lunas</span></div><div class="document-row"><div><h4>Pelunasan</h4><p>Belum jatuh tempo</p></div><strong>Rp12.500.000</strong><span class="status status--warning">Pending</span></div></div>
      <div class="detail-panel" data-panel="updates"><div class="timeline"><div class="timeline-item"><span class="timeline-item__dot">✓</span><div><h4>Dokumen sedang diperiksa</h4><p>Tim telah menerima dokumen terakhir.</p></div><time>10 menit lalu</time></div><div class="timeline-item"><span class="timeline-item__dot">↗</span><div><h4>Masuk tahap verifikasi</h4><p>Kelengkapan perusahaan sedang diperiksa.</p></div><time>Kemarin</time></div><div class="timeline-item"><span class="timeline-item__dot">✓</span><div><h4>Pengajuan diterima</h4><p>Layanan PBG berhasil dibuat.</p></div><time>20 Agu</time></div></div></div>
    </article>
  </section>`;
}

function documentsPage() {
  const row = (name, note, status, cls, action = '') => `<div class="document-row"><div><h4>${name}</h4><p>${note}</p></div><span class="status ${cls}">${status}</span>${action ? `<button class="button button--primary button--small" data-action="upload">${action}</button>` : '<span></span>'}</div>`;
  return `<section class="page">${pageHead('DOKUMEN', 'Kelengkapan dokumen Anda', 'Pantau dokumen yang dibutuhkan untuk setiap layanan. Status diperbarui oleh tim SMA.')}
    <div class="document-groups">
      <article class="document-group"><header class="document-group__head"><div><h3>PBG</h3><p>4 dari 6 dokumen lengkap</p></div><a class="card__link" href="#service-detail">Lihat layanan</a></header>${row('NIB', 'Unggahan sebelumnya kurang jelas', 'Perlu diperbaiki', 'status--warning', 'Unggah ulang')}${row('Akta pendirian', 'Diverifikasi 20 Agustus 2026', 'Terverifikasi', '')}${row('KTP Direktur', 'Sedang diperiksa oleh tim', 'Sedang diperiksa', 'status--neutral')}${row('Surat kuasa', 'Belum ada dokumen', 'Belum diunggah', 'status--warning', 'Unggah')}</article>
      <article class="document-group"><header class="document-group__head"><div><h3>NIB</h3><p>2 dari 3 dokumen lengkap</p></div><a class="card__link" href="#service-detail">Lihat layanan</a></header>${row('KTP Pemilik', 'Diverifikasi 20 Agustus 2026', 'Terverifikasi', '')}${row('NPWP', 'Belum ada dokumen', 'Belum diunggah', 'status--warning', 'Unggah')}</article>
    </div>
  </section>`;
}

function paymentsPage() {
  return `<section class="page">${pageHead('PEMBAYARAN', 'Ringkasan pembayaran', 'Lihat tagihan, pembayaran yang sudah diterima, dan termin berikutnya.')}
    <div class="payment-summary"><article class="metric"><span>Total tagihan</span><strong>Rp30.000.000</strong></article><article class="metric"><span>Sudah dibayar</span><strong style="color:var(--teal)">Rp12.500.000</strong></article><article class="metric"><span>Sisa pembayaran</span><strong style="color:var(--orange)">Rp17.500.000</strong></article></div>
    <article class="card"><div class="card__head"><div><h3>Riwayat dan tagihan</h3><p>Seluruh layanan PT Artha Prima Sejahtera</p></div><button class="button button--ghost button--small" data-action="download">Unduh ringkasan</button></div><div class="payment-table"><div class="payment-row payment-row--head"><span>Layanan / Jenis</span><span>Jumlah</span><span>Status</span><span>Tanggal</span><span>Aksi</span></div><div class="payment-row"><span><strong>PBG</strong><br><small style="color:var(--muted)">DP</small></span><strong>Rp7.500.000</strong><span class="status">Lunas</span><span>20 Agu 2026</span><button class="button button--ghost button--small" data-action="receipt">Bukti</button></div><div class="payment-row"><span><strong>NIB</strong><br><small style="color:var(--muted)">Pelunasan</small></span><strong>Rp5.000.000</strong><span class="status">Lunas</span><span>18 Agu 2026</span><button class="button button--ghost button--small" data-action="receipt">Bukti</button></div><div class="payment-row"><span><strong>PBG</strong><br><small style="color:var(--muted)">Pelunasan</small></span><strong>Rp12.500.000</strong><span class="status status--warning">Pending</span><span>24 Agu 2026</span><button class="button button--primary button--small" data-action="pay">Lihat tagihan</button></div></div></article>
  </section>`;
}

function profilePage() {
  return `<section class="page">${pageHead('PROFIL', 'Informasi akun dan perusahaan', 'Pastikan data berikut selalu terbaru agar proses layanan berjalan lancar.')}
    <div class="profile-layout"><article class="card"><div class="card__body profile-summary"><span class="profile-avatar">AP</span><h2>PT Artha Prima Sejahtera</h2><p>Klien aktif sejak Agustus 2026</p><div class="profile-meta"><div><span>Jenis entitas</span><strong>Perseroan Terbatas</strong></div><div><span>Kontak utama</span><strong>Dimas Ari</strong></div><div><span>Email login</span><strong>dimas@contoh.com</strong></div></div></div></article><article class="card"><div class="card__head"><div><h3>Data perusahaan</h3><p>Perubahan disimpan sebagai prototype saja</p></div></div><form class="card__body" id="profile-form"><div class="form-grid"><label class="field"><span>Nama perusahaan</span><input value="PT Artha Prima Sejahtera" required /></label><label class="field"><span>Jenis entitas</span><select><option>PT</option><option>CV</option><option>Yayasan</option></select></label><label class="field"><span>Nama PIC</span><input value="Dimas Ari" required /></label><label class="field"><span>Nomor WhatsApp</span><input value="0812 3456 7890" /></label><label class="field"><span>Email</span><input type="email" value="dimas@contoh.com" /></label><label class="field"><span>NPWP</span><input value="01.234.567.8-901.000" /></label></div><label class="field"><span>Alamat</span><textarea>Jl. Contoh No. 10, Sleman, Daerah Istimewa Yogyakarta</textarea></label><button class="button button--primary" type="submit">Simpan perubahan</button></form></article></div>
  </section>`;
}

function render() {
  const current = route();
  const pages = { home: homePage, services: servicesPage, 'service-detail': detailPage, documents: documentsPage, payments: paymentsPage, profile: profilePage };
  document.querySelector('#portal-root').innerHTML = shell(current, pages[current]());
  document.title = `${pageName(current)} — SMA Client Portal`;
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.querySelector('#toast-root').append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function showModal({ title, body, action = 'Simpan', onSubmit }) {
  const root = document.querySelector('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal__head"><h2>${title}</h2><button class="modal__close" aria-label="Tutup">×</button></header><form class="modal-form"><div class="modal__body">${body}</div><footer class="modal__foot"><button class="button button--ghost" type="button" data-modal-close>Batal</button><button class="button button--primary" type="submit">${action}</button></footer></form></section></div>`;
  const close = () => root.replaceChildren();
  root.querySelector('.modal__close').addEventListener('click', close);
  root.querySelector('[data-modal-close]').addEventListener('click', close);
  root.querySelector('.modal-backdrop').addEventListener('click', (event) => { if (event.target.classList.contains('modal-backdrop')) close(); });
  root.querySelector('form').addEventListener('submit', (event) => { event.preventDefault(); onSubmit?.(new FormData(event.currentTarget)); close(); });
  root.querySelector('input, select, textarea')?.focus();
}

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-scenario-select]');
  if (!select || !Object.hasOwn(homeScenarios, select.value)) return;
  const url = new URL(window.location.href);
  url.searchParams.set('scenario', select.value);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash || '#home'}`);
  render();
});

document.addEventListener('click', (event) => {
  const homeAction = event.target.closest('[data-home-action]');
  if (homeAction) {
    showModal({
      title: homeAction.dataset.homeActionTitle,
      action: 'Tutup',
      body: '<div class="prototype-message"><span>PROTOTYPE</span><p>CTA ini menunjukkan arah interaksi. Detail dan penyimpanan data akan dibuat pada tahap berikutnya.</p></div>'
    });
    return;
  }

  if (event.target.closest('[data-view-all-actions]')) {
    const actions = [...homeScenarios[selectedScenarioKey()].actions]
      .sort((a, b) => a.urgency - b.urgency || new Date(a.dueAt) - new Date(b.dueAt));
    showModal({
      title: 'Semua Tindakan',
      action: 'Tutup',
      body: `<div class="prototype-list">${actions.map((item) => `<div><span>${item.due}</span><strong>${item.title}</strong><p>${item.description}</p></div>`).join('')}</div>`
    });
    return;
  }

  if (event.target.closest('[data-view-all-updates]')) {
    showModal({
      title: 'Semua Pembaruan',
      action: 'Tutup',
      body: `<div class="timeline prototype-updates">${updatesTimeline(homeScenarios[selectedScenarioKey()].updates)}</div>`
    });
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'upload') showModal({ title: 'Unggah dokumen', action: 'Simpan dokumen', body: '<label class="field"><span>Nama dokumen</span><input value="NIB terbaru" required></label><label class="field"><span>Link Google Drive</span><input type="url" placeholder="https://drive.google.com/..."></label><p style="color:var(--muted);font-size:11px;line-height:1.5">Prototype tidak benar-benar mengunggah file.</p>', onSubmit: () => showToast('Dokumen berhasil dikirim untuk diperiksa.') });
  if (action === 'support') showModal({ title: 'Hubungi Tim SMA', action: 'Coba kirim', body: '<label class="field"><span>Pesan</span><textarea placeholder="Tulis pertanyaan Anda..." required></textarea></label><div class="prototype-message"><span>PROTOTYPE</span><p>Pesan pada demo ini tidak akan disimpan atau dikirim.</p></div>', onSubmit: () => showToast('Mode prototype — pesan tidak disimpan.') });
  if (action === 'notifications') showToast('Tidak ada notifikasi baru.');
  if (action === 'request-service') showModal({ title: 'Ajukan layanan baru', action: 'Kirim permintaan', body: '<label class="field"><span>Pilih layanan</span><select><option>PBG</option><option>NIB</option><option>SLF</option><option>Pendirian PT</option></select></label><label class="field"><span>Catatan</span><textarea placeholder="Ceritakan kebutuhan Anda..."></textarea></label>', onSubmit: () => showToast('Permintaan layanan berhasil dikirim.') });
  if (action === 'pay') showModal({ title: 'Tagihan PBG', action: 'Tutup', body: '<div class="info-pair"><span>Jumlah</span><strong style="font-size:24px">Rp12.500.000</strong></div><p style="color:var(--muted);font-size:12px;line-height:1.6">Pembayaran dilakukan melalui instruksi resmi yang dikirimkan tim SMA. Prototype tidak memproses pembayaran.</p>' });
  if (action === 'receipt' || action === 'download') showToast('File contoh sedang disiapkan.');
});

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  document.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
  document.querySelectorAll('[data-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab));
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'profile-form') return;
  event.preventDefault();
  showToast('Perubahan profil tersimpan dalam prototype.');
});

window.addEventListener('hashchange', render);
render();
