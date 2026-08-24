# PROJECT CONTEXT HANDOVER

## 1. REPO TREES
.claude/launch.json
.claude/settings.json
.cursor/rules/project.mdc
.devcontainer/devcontainer.json
.editorconfig
.env.example
.npmignore
.nvmrc
.prettierignore
.prettierrc
AGENTS.md
CLAUDE.md
CLIENT_SIDE_SYNC_SMA-app.md
CONTRIBUTING.md
LICENSE.txt
PRD_Client_Management_SMA-app.pdf
PRD_Client_Portal_SMA-app.md
PRD_Project_Intake_RAB_Workflow_SMA-app.md
PRD_Workflow_Layer_SMA-app.md
README.md
SPEC_PROJECT_Part_V2_RAB_Formal.md
changelog.md
dev-watch.sh
docs/README.md
docs/app-modules.md
docs/architecture.md
docs/charts.md
docs/command-palette.md
docs/components.md
docs/data-adapter.md
docs/deployment.md
docs/faq.md
docs/forms.md
docs/getting-started.md
docs/migration-v2.md
docs/overlays.md
docs/pages.md
docs/project-structure.md
docs/pwa.md
docs/tables.md
docs/theming.md
docs/typescript.md
eslint.config.js
examples/README.md
examples/express-sqlite/README.md
examples/express-sqlite/db.js
examples/express-sqlite/package-lock.json
examples/express-sqlite/package.json
examples/express-sqlite/seed.js
examples/express-sqlite/server.js
package-lock.json
package.json
production/calendar.html
production/chartjs.html
production/chat.html
production/client-detail.html
production/client-form.html
production/client.html
production/coming_soon.html
production/contacts.html
production/e_commerce.html
production/echarts.html
production/faq.html
production/file_manager.html
production/fixed_footer.html
production/fixed_sidebar.html
production/forgot_password.html
production/form.html
production/form_advanced.html
production/form_buttons.html
production/form_upload.html
production/form_validation.html
production/form_wizards.html
production/general_elements.html
production/icons.html
production/inbox.html
production/index.html
production/index2.html
production/index3.html
production/index4.html
production/invoice.html
production/kanban.html
production/landing.html
production/level2.html
production/lock_screen.html
production/login.html
production/maintenance.html
production/map.html
production/media_gallery.html
production/notifications.html
production/offline.html
production/order_detail.html
production/orders.html
production/other_charts.html
production/page_403.html
production/page_404.html
production/page_500.html
production/plain_page.html
production/playground.html
production/pricing_tables.html
production/product_detail.html
production/profile.html
production/project_detail.html
production/project_setting.html
production/projects.html
production/register.html
production/settings.html
production/tables.html
production/tables_dynamic.html
production/theme.html
production/typography.html
production/user_management.html
production/verify_2fa.html
production/widgets.html
public/images/american-express.png
public/images/android-chrome-192x192.svg
public/images/android-chrome-512x512.svg
public/images/apple-touch-icon.svg
public/images/cropper.jpg
public/images/favicon-16x16.svg
public/images/favicon-32x32.svg
public/images/favicon.ico
public/images/favicon.svg
public/images/img.jpg
public/images/inbox.png
public/images/logo-icon.svg
public/images/logo.svg
public/images/mastercard.png
public/images/media.jpg
public/images/paypal.png
public/images/picture.jpg
public/images/prod-1.jpg
public/images/prod-2.jpg
public/images/prod-3.jpg
public/images/prod-4.jpg
public/images/prod-5.jpg
public/images/user.png
public/images/visa.png
public/site.webmanifest
public/sw.js
scripts/deploy-preview.sh
scripts/new-page.mjs
scripts/screenshots.mjs
scripts/smoke.mjs
src/lib/auth-guard.js
src/lib/auth.js
src/lib/supabaseClient.js
src/main-v4.js
src/scss/v4/_apps.scss
src/scss/v4/_auth.scss
src/scss/v4/_client-detail.scss
src/scss/v4/_client-workflow.scss
src/scss/v4/_components.scss
src/scss/v4/_datatable.scss
src/scss/v4/_forms.scss
src/scss/v4/_layout.scss
src/scss/v4/_pages.scss
src/scss/v4/_project-setting.scss
src/scss/v4/_tokens.scss
src/scss/v4/_widgets.scss
src/scss/v4/main.scss
src/v4/calendar.js
src/v4/case-form.js
src/v4/charts.js
src/v4/client-activities.js
src/v4/client-detail.js
src/v4/client-documents.js
src/v4/client-form.js
src/v4/client-list.js
src/v4/client-payments.js
src/v4/client-quotations.js
src/v4/client-workflow.js
src/v4/command-palette.js
src/v4/dashboard.js
src/v4/data-adapter.js
src/v4/details.js
src/v4/file-manager.js
src/v4/form-controls.js
src/v4/inbox.js
src/v4/kanban.js
src/v4/login.js
src/v4/markup.js
src/v4/menus.js
src/v4/modal.js
src/v4/page-actions.js
src/v4/product-images.js
src/v4/product-mockups.js
src/v4/project-setting.js
src/v4/settings.js
src/v4/shell-render.js
src/v4/shell.js
src/v4/tables.js
src/v4/toast.js
supabase/migrations/20260819110000_add_client_identity_contact_columns.sql
supabase/migrations/20260819110100_drop_legacy_client_contact_columns.sql
supabase/migrations/20260822140000_prevent_profile_privilege_escalation.sql
supabase/migrations/20260822150000_create_workflow_engine_core_schema.sql
supabase/migrations/20260822160000_replace_workflow_engine_with_case_stages.sql
supabase/migrations/20260822170000_sync_case_status_from_stages.sql
supabase/migrations/20260822180000_seed_case_stages_existing_projects.sql
supabase/migrations/20260822190000_seed_5_clients_variatif.sql
supabase/migrations/20260822200000_project_part1_schema_foundation.sql
supabase/migrations/20260822210000_project_part2_reconcile_existing.sql
supabase/migrations/20260822220000_project_part4_seed_document_templates.sql
supabase/migrations/20260822230000_add_cases_created_by.sql
supabase/migrations/20260823050000_project_part5_tighten_quotation_rls.sql
supabase/migrations/20260824070000_project_part5-2_rab_formal_schema.sql
supabase/migrations/20260824080000_generate_quotation_number_trigger.sql
supabase/migrations/20260824090000_company_settings_and_profile_phone.sql
supabase/migrations/20260824100000_project_part6_terima_tolak_nego.sql
supabase/migrations/20260824110000_bank_accounts_multi.sql
supabase/migrations/20260824120000_document_categories_and_code_unique.sql
tests/README.md
types/gentelella.d.ts
vite.config.js

## 2. RULES & DOCUMENTATION

--- FILE: CLAUDE.md ---
# CLAUDE.md

See [AGENTS.md](AGENTS.md) — that file is the single source of truth for
this project's conventions, team workflow, and rules. Read it in full
before writing or changing any code.

This stub exists because Claude Code specifically looks for `CLAUDE.md`
by default, while every other AI tool on this project (ChatGPT, and any
other AGENTS.md-aware tool) reads `AGENTS.md` directly. Keeping the real
content in one file (`AGENTS.md`) avoids the two files drifting out of
sync.

--- FILE: README.md ---
# Gentelella v4 — Free Admin Dashboard Template

[![npm version](https://img.shields.io/npm/v/gentelella.svg?logo=npm&label=npm)](https://www.npmjs.com/package/gentelella)
[![npm downloads](https://img.shields.io/npm/dw/gentelella.svg?logo=npm&label=downloads)](https://www.npmjs.com/package/gentelella)
[![jsDelivr](https://img.shields.io/jsdelivr/npm/hw/gentelella.svg?logo=jsdelivr&label=jsDelivr)](https://www.jsdelivr.com/package/npm/gentelella)
[![GitHub stars](https://img.shields.io/github/stars/ColorlibHQ/gentelella?style=flat&logo=github&label=stars)](https://github.com/ColorlibHQ/gentelella/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![Made with Vite 8](https://img.shields.io/badge/Vite-8-646cff.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![No jQuery](https://img.shields.io/badge/jQuery-free-success.svg)](#tech-stack)
[![PWA Ready](https://img.shields.io/badge/PWA-ready-5a0fc8.svg)](#tech-stack)

**Gentelella v4** is a free, open-source **admin dashboard template** built with **vanilla JavaScript**, **SCSS**, and **Vite 8**. **No Bootstrap. No jQuery. No SPA framework.** A modern alternative to Bootstrap admin templates for SaaS dashboards, CRM systems, internal tools, e-commerce backends, and project management apps.

**58 production-ready HTML pages**, **20 ECharts chart variants**, fully interactive **inbox / kanban / calendar / file manager / settings**, a **live theme generator**, a **component playground**, a **⌘K command palette**, **dark mode**, and **PWA support**. MIT-licensed. Free for personal and commercial use.

Built for 2026 by [Colorlib](https://colorlib.com). **[Live demo →](https://preview.colorlib.com/theme/gentelella/)**

<p align="center">
  <a href="https://preview.colorlib.com/theme/gentelella/production/index.html">
    <img alt="Gentelella v4 admin dashboard preview — light theme" src="docs/screenshots/readme/dashboard-light.webp" width="49%">
  </a>
  <a href="https://preview.colorlib.com/theme/gentelella/production/index.html">
    <img alt="Gentelella v4 admin dashboard preview — dark theme" src="docs/screenshots/readme/dashboard-dark.webp" width="49%">
  </a>
</p>

<p align="center">
  <em>Inbox · Kanban · Theme generator</em><br>
  <a href="https://preview.colorlib.com/theme/gentelella/production/inbox.html">
    <img alt="Inbox client with folders, reader pane, and compose modal" src="docs/screenshots/readme/inbox.webp" width="32%">
  </a>
  <a href="https://preview.colorlib.com/theme/gentelella/production/kanban.html">
    <img alt="Kanban board with drag-and-drop task management" src="docs/screenshots/readme/kanban.webp" width="32%">
  </a>
  <a href="https://preview.colorlib.com/theme/gentelella/production/theme.html">
    <img alt="Live theme generator with real-time color customization" src="docs/screenshots/readme/theme.webp" width="32%">
  </a>
</p>

> **Generate your own screenshots** — `npm run build && npm run screenshots` boots Playwright and captures 22 key pages × light + dark = 44 PNGs to `docs/screenshots/`, plus downscaled WebP hero shots for this README (needs `cwebp` — `brew install webp`).

---

## Why Gentelella v4

The original Gentelella has been a free Bootstrap admin template since 2014 — **3M+ downloads**, [4.5k+ GitHub stars](https://github.com/ColorlibHQ/gentelella). v4 is a ground-up redesign:

- **No Bootstrap, no jQuery** — vanilla JavaScript + SCSS. ~178 MB `node_modules` (down from ~600 MB on v2).
- **Vite 8 build system** — instant HMR, multi-page app with auto-discovered entry points, hashed assets.
- **Light + dark mode** with `prefers-color-scheme` detection and pre-paint script (no flash of incorrect theme).
- **PWA-ready** — installable on desktop and mobile, offline shell, service worker.
- **AI-assisted development** — ships with helper files for Claude Code, Cursor, GitHub Copilot, and any [agents.md](https://agents.md)-compatible tool.

Perfect for: **SaaS dashboards**, **CRM**, **ERP**, **internal admin panels**, **project management tools**, **e-commerce backends**, **analytics dashboards**, **HR/payroll**, **booking systems**, **content management**.

## Features

- **🎨 Live theme generator** — pick a primary color, watch every chart, button, badge, and link restyle in real time. Copy or download the generated SCSS tokens. Demo: [theme.html](https://preview.colorlib.com/theme/gentelella/theme.html)
- **🧪 Component playground** — every reusable component on one page, side-by-side with its **exact HTML** and a Copy button. Demo: [playground.html](https://preview.colorlib.com/theme/gentelella/playground.html)
- **⌘K command palette** — fuzzy search across all 58 pages and inline actions
- **📬 Real inbox client** — folders, reader pane, compose modal, reply/forward, J/K/R/S/# keyboard shortcuts, search across the active folder
- **📱 PWA** — installable on macOS / Windows / iOS / Android, offline shell, service worker
- **↔️ Sidebar rail mode** — desktop hamburger collapses sidebar to icon-only with hover tooltips and click-to-flyout submenus
- **🌗 Dark mode** — `prefers-color-scheme` aware, pre-paint script prevents flash, manual toggle persists in `localStorage`
- **♿ Accessibility** — skip-link, keyboard focus rings, ARIA labels on interactive controls, semantic landmarks, screen-reader-friendly DataTables

## What you get

| Surface | What's in it |
| --- | --- |
| **Dashboards** | 4 variants — operations, analytics (heatmap, funnel, cohort matrix), sales (gauge, radar, pipeline), system health (resource bars, deployment list, error log) |
| **Auth** | Sign-in · social (Google, GitHub) · register · forgot password · 2FA · lock screen · 403 / 404 / 500 |
| **Forms** | General form · advanced controls · 6-step wizard · drag-and-drop upload · validation · **date-range picker · multi-select · rich text editor** |
| **Tables** | DataTables — sort, search, paginate, **row selection, CSV export** · 23-row + 50-row demos |
| **Charts** | **20 ECharts variants** — line, area, stacked area, bar, horizontal bar, mixed bar/line, donut, pie, radar, gauge, scatter, heatmap, funnel, candlestick, polar bar, treemap, sankey, calendar heatmap, gantt + dashboard mini-line |
| **App pages** | Calendar (full CRUD) · inbox (folders, compose, reader) · chat (8 threads) · kanban (drag-drop) · file manager (tree + grid) · notifications · invoice (editable line items) · profile · settings (persisted) · FAQ |
| **E-commerce** | Storefront · product detail · order list · order detail · pricing tiers |
| **Admin** | Contacts · user management (search, filters, role editor) · maintenance · coming-soon |
| **UI library** | **Component playground** · **theme generator** · 120+ icons in 14 categories · typography · 18 widget variants · media gallery · general elements (banners, accordion, drawer, popover, timeline) |
| **Map** | Leaflet customer map |
| **Marketing** | Landing page with hero, stats band, features, showcase, testimonials, FAQ |
| **Layouts** | Fixed sidebar / fixed footer / nested page / blank starter |

Plus: 10 SCSS partials · build-time + runtime shell (no FOUC) · `data-page` attribute auto-highlights nav · mobile drawer + desktop rail mode · light/dark with `prefers-color-scheme` + pre-paint · cross-document view transitions · skip-to-content · keyboard focus-visible · accordion sidebar with sessionStorage memory · `localStorage`-persisted settings · per-page **`<meta description>`**, **Open Graph**, and **Twitter Card** tags auto-injected at build time.

## Upgrade to a Premium Dashboard

Need advanced features, dedicated support, and production-ready code? Explore our handpicked collection of professional admin templates on [DashboardPack](https://dashboardpack.com/?utm_source=github&utm_medium=readme&utm_campaign=gentelella).

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://dashboardpack.com/theme-details/apex-dashboard-nextjs/?utm_source=github&utm_medium=readme&utm_campaign=gentelella">
        <img src="docs/screenshots/dashboardpack/apex.webp" alt="Apex Dashboard — Next.js 16 admin template with shadcn/ui" width="100%">
      </a>
      <br>
      <a href="https://dashboardpack.com/theme-details/apex-dashboard-nextjs/?utm_source=github&utm_medium=readme&utm_campaign=gentelella"><strong>Apex Dashboard</strong></a>
      <br>
      <sub>Next.js 16 + React 19 + Tailwind CSS v4 + shadcn/ui. 5 dashboard variants, 20+ app pages, 125+ routes, full CRUD.</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://dashboardpack.com/theme-details/zenith-shadcn/?utm_source=github&utm_medium=readme&utm_campaign=gentelella">
        <img src="docs/screenshots/dashboardpack/zenith.webp" alt="Zenith — ultra-minimal Next.js admin dashboard with shadcn/ui" width="100%">
      </a>
      <br>
      <a href="https://dashboardpack.com/theme-details/zenith-shadcn/?utm_source=github&utm_medium=readme&utm_campaign=gentelella"><strong>Zenith Dashboard</strong></a>
      <br>
      <sub>Next.js 16 + React 19 + Tailwind CSS v4 + shadcn/ui. Achromatic design, 50+ pages, 6 dashboards, live theme customizer.</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <a href="https://dashboardpack.com/theme-details/haze-dashboard-nuxt/?utm_source=github&utm_medium=readme&utm_campaign=gentelella">
        <img src="docs/screenshots/dashboardpack/haze.webp" alt="Haze — Nuxt 4 admin dashboard with 92+ pages and 5 dashboards" width="100%">
      </a>
      <br>
      <a href="https://dashboardpack.com/theme-details/haze-dashboard-nuxt/?utm_source=github&utm_medium=readme&utm_campaign=gentelella"><strong>Haze</strong></a>
      <br>
      <sub>Nuxt 4 + Nuxt UI v4 + Tailwind CSS v4. 92+ pages, 7 layouts, 5 dashboards, RTL, i18n, mock API layer.</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://dashboardpack.com/theme-details/tailpanel/?utm_source=github&utm_medium=readme&utm_campaign=gentelella">
        <img src="docs/screenshots/dashboardpack/tailpanel.webp" alt="TailPanel — modern React and Tailwind CSS admin panel" width="100%">
      </a>
      <br>
      <a href="https://dashboardpack.com/theme-details/tailpanel/?utm_source=github&utm_medium=readme&utm_campaign=gentelella"><strong>TailPanel</strong></a>
      <br>
      <sub>React + TypeScript + Tailwind CSS + Vite. 9 dashboard designs, dark and light themes.</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <a href="https://dashboardpack.com/theme-details/admindek-html/?utm_source=github&utm_medium=readme&utm_campaign=gentelella">
        <img src="docs/screenshots/dashboardpack/admindek.webp" alt="Admindek — feature-rich Bootstrap 5 dashboard with dark mode" width="100%">
      </a>
      <br>
      <a href="https://dashboardpack.com/theme-details/admindek-html/?utm_source=github&utm_medium=readme&utm_campaign=gentelella"><strong>Admindek</strong></a>
      <br>
      <sub>Bootstrap 5 + vanilla JS. 100+ components, dark/light modes, RTL support, 10 color presets.</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://dashboardpack.com/theme-details/svelteforge-premium/?utm_source=github&utm_medium=readme&utm_campaign=gentelella">
        <img src="docs/screenshots/dashboardpack/svelteforge.webp" alt="SvelteForge Premium — SvelteKit admin dashboard with multi-tenant support" width="100%">
      </a>
      <br>
      <a href="https://dashboardpack.com/theme-details/svelteforge-premium/?utm_source=github&utm_medium=readme&utm_campaign=gentelella"><strong>SvelteForge Premium</strong></a>
      <br>
      <sub>SvelteKit + Tailwind CSS v4. 30+ wired-up modules, multi-tenant from row zero, dark/light/system mode.</sub>
    </td>
  </tr>
</table>

<p align="center">
  <a href="https://dashboardpack.com/?utm_source=github&utm_medium=readme&utm_campaign=gentelella"><strong>View All Premium Templates →</strong></a>
</p>

## Tech stack

- **Vite 8** with Rolldown — multi-page app, 58 auto-discovered entry points
- **SCSS** with `@use` modules — no Bootstrap, no framework
- **Vanilla ES2022** — no jQuery, no SPA framework, no build-time JSX
- **Apache ECharts 6** — lazy-imported, modular (only chart types actually used)
- **DataTables.net 3** core — re-skinned from scratch to match the design system
- **Leaflet 1.9** — lazy-imported on the map page only
- **Inter** font from Google Fonts
- **Playwright** (devDep) — for the screenshot pipeline and smoke tests

3 production deps, 10 dev deps, **~178 MB `node_modules`** (was ~600 MB on the old Gentelella).

## Documentation

Full docs live at **<https://gentelella.colorlib.com/docs/>** — covering every part of v4:

| Topic | Doc |
| --- | --- |
| Setup, build, deploy | [getting-started](https://gentelella.colorlib.com/docs/getting-started/) |
| Directory layout | [project-structure](https://gentelella.colorlib.com/docs/project-structure/) |
| Shell injection + lazy modules | [architecture](https://gentelella.colorlib.com/docs/architecture/) |
| Tokens, dark mode, theme generator | [theming](https://gentelella.colorlib.com/docs/theming/) |
| Adding pages + sidebar entries | [adding-pages](https://gentelella.colorlib.com/docs/adding-pages/) |
| Component playground | [playground](https://gentelella.colorlib.com/docs/playground/) |
| ECharts factories | [echarts](https://gentelella.colorlib.com/docs/echarts/) |
| DataTables, row selection, CSV | [tables](https://gentelella.colorlib.com/docs/tables/) |
| Inputs, validation, custom controls | [forms](https://gentelella.colorlib.com/docs/forms/) |
| `showModal`, `showToast`, `openMenu` | [overlays](https://gentelella.colorlib.com/docs/overlays/) |
| ⌘K | [command palette](https://gentelella.colorlib.com/docs/palette/) |
| Inbox client | [inbox](https://gentelella.colorlib.com/docs/inbox/) |
| Kanban board | [kanban](https://gentelella.colorlib.com/docs/kanban/) |
| Vite multi-page setup | [vite-build](https://gentelella.colorlib.com/docs/vite-build/) |
| Service worker, manifest, offline | [pwa](https://gentelella.colorlib.com/docs/pwa/) |
| Hosts, subpath, cache headers | [deployment](https://gentelella.colorlib.com/docs/deployment/) |
| IntelliSense via `.d.ts` | [typescript](https://gentelella.colorlib.com/docs/typescript/) |
| Seed vs HTTP backend (`?api=1`) | [data-adapter](https://gentelella.colorlib.com/docs/data-adapter/) |
| Coming from old Gentelella | [migration-v2](https://gentelella.colorlib.com/docs/migration-v2/) |
| Common questions | [FAQ](https://gentelella.colorlib.com/docs/faq/) |

## Quick start

```bash
git clone https://github.com/ColorlibHQ/gentelella.git
cd gentelella
npm install
npm run dev
```

Open [http://localhost:9173/production/index.html](http://localhost:9173/production/index.html). The dev server hot-reloads SCSS, JS, and HTML. Override the port with `PORT=4000 npm run dev`.

### Production build

```bash
npm run build
```

Outputs static HTML + hashed JS/CSS to `dist/`. Deploy the `dist/` folder to any static host (Netlify, Vercel, Cloudflare Pages, S3, GitHub Pages).

To deploy under a subpath (e.g. `https://example.com/admin/`):

```bash
BASE_PATH=/admin/ npm run build
```

### npm package

The package is consumable as an npm dependency for granular imports:

```bash
npm install gentelella
```

```js
import { mountShell, showModal, showToast } from 'gentelella';
import 'gentelella/scss/v4/main.scss';
```

Subpath exports: `gentelella/v4/*` (JS modules), `gentelella/scss/*` (styles), `gentelella/types` (TypeScript declarations).

### CDN (jsDelivr)

The package ships the pre-built `dist/` and the unbundled `src/`, so every file is reachable via [jsDelivr](https://www.jsdelivr.com/package/npm/gentelella) without a bundler. Useful for prototyping, design-system inspection, or pulling individual ES modules:

```html
<!-- Pull individual ES-module helpers — paths under src/v4/ are stable -->
<script type="module">
  import { showModal } from 'https://cdn.jsdelivr.net/npm/gentelella@4/src/v4/modal.js';
  import { showToast } from 'https://cdn.jsdelivr.net/npm/gentelella@4/src/v4/toast.js';
  showToast('Hello from CDN', { variant: 'success' });
</script>
```

Browse the 58 built demo pages straight from CDN — every reference page renders with all assets resolved:

```text
https://cdn.jsdelivr.net/npm/gentelella@4/dist/production/index.html
https://cdn.jsdelivr.net/npm/gentelella@4/dist/production/inbox.html
https://cdn.jsdelivr.net/npm/gentelella@4/dist/production/kanban.html
…
```

**Heads-up on hashing.** Vite emits content-hashed asset filenames in `dist/assets/` and `dist/js/` (`main-v4-DDS6x4g-.css` etc.), so direct CDN URLs for those chunks change on every release. The main `src/main-v4.js` entry also imports SCSS source, so it isn't browser-loadable — use it through your bundler. For an AdminLTE-style single-file `<script src>` drop-in with a stable URL, use the npm package with your own bundler instead. Gentelella v4's CDN strength is browsing the demo HTML pages and importing individual `src/v4/*` ES-module helpers.

### Scripts

```text
npm run dev              Start Vite dev server (port 9173)
npm run build            Production build to dist/
npm run build:dev        Non-minified build (debugging)
npm run preview          Serve dist/ to preview the production build (port 9174)
npm run analyze          Build + open the bundle treemap
npm run new -- <slug>    Scaffold a new page (see `--help` for flags)
npm run screenshots      Boot Playwright + capture 44 PNGs to docs/screenshots/
npm run smoke            Boot dev server, hit every page, assert HTTP 200
npm run deploy:preview   Build + sync to R2 with per-file cache headers
npm run lint             ESLint across src/
npm run format           Prettier write across src/
```

## AI-assisted development

Gentelella v4 ships with helper files for the major AI coding tools — drop the repo open in any of them and the assistant gets immediate, accurate context about the architecture, conventions, and recipes:

| Tool | File |
| --- | --- |
| **Claude Code** | [`CLAUDE.md`](CLAUDE.md) |
| **Cursor** | [`.cursor/rules/project.mdc`](.cursor/rules/project.mdc) |
| **GitHub Copilot** | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) |
| **Aider, Cline, Codex, Continue** (and other [agents.md](https://agents.md) tools) | [`AGENTS.md`](AGENTS.md) |

Each file documents the hard rules (vanilla DOM only, single entry point, shell opt-in via body attributes, NAV as one constant, overlay helpers, CSS custom properties for colors, subpath-safe URLs), anti-patterns to avoid, and copy-pasteable recipes for adding pages, charts, modals, and toasts.

## Project layout

```text
src/
├── main-v4.js                 Entry — mounts shell, initializes charts/tables
├── v4/
│   ├── shell.js               Runtime: mobile drawer, theme toggle, dropdowns
│   ├── shell-render.js        Pure: nav config + sidebar/topbar/footer HTML
│   ├── charts.js              ECharts factories (revenue, sales, donut, …)
│   ├── tables.js              DataTables init for [data-datatable]
│   ├── menus.js               Popover menus + side panels
│   ├── modal.js               Modal dialog system
│   ├── toast.js               Toast notifications
│   ├── command-palette.js     ⌘K fuzzy search
│   ├── calendar.js            Month-grid calendar
│   ├── inbox.js               Inbox folder + message list
│   ├── kanban.js              Drag-and-drop kanban board
│   ├── file-manager.js        Tree + grid file browser
│   ├── form-controls.js       Date range, multi-select, rich text
│   ├── settings.js            localStorage-backed settings page
│   ├── details.js             Project / order / contact detail panels
│   ├── markup.js              Pure string helpers for JS-rendered content
│   ├── data-adapter.js        Seed + HTTP adapters for backend hydration
│   ├── product-images.js      Product gallery zoom
│   └── product-mockups.js     SVG product mockups
└── scss/v4/
    ├── main.scss              @use aggregator
    ├── _tokens.scss           CSS custom properties (colors, sidebar, fonts, radii)
    ├── _layout.scss           Sidebar, topbar, main, grid, footer, responsive
    ├── _components.scss       Buttons, cards, tables, status, toggles, progress
    ├── _forms.scss            Inputs, selects, validation, input groups
    ├── _widgets.scss          Stat cards, activity, donuts, sparklines, todos
    ├── _pages.scss            Pagination, alerts, calendar, inbox, invoice, …
    ├── _datatable.scss        DataTables UI overrides
    ├── _auth.scss             Login + error layouts
    └── _apps.scss             Chat, kanban, file manager, settings

production/                    58 entry HTML pages — one per surface
public/                        Static assets copied as-is
dist/                          Build output (gitignored)
types/gentelella.d.ts          TypeScript declarations
vite.config.js                 Multi-page Vite config
```

## Customization

### Design tokens

Every color, radius, sidebar dimension, and font setting lives as a CSS custom property in [`src/scss/v4/_tokens.scss`](src/scss/v4/_tokens.scss). Edit `:root`, save, the Vite dev server reloads.

Want a different brand color? Change `--primary` and `--primary-dk`. Every chart, every button, every active nav item updates — ECharts reads these variables at chart-init time.

### Adding a page

The fast way:

```sh
npm run new -- reports --title "Reports" --pretitle "Admin" \
  --breadcrumb "Home > User management|user_management.html > Reports" \
  --nav-group "Admin" --icon "profile"
```

This creates `production/reports.html` with the standard skeleton and (with `--nav-group`) inserts a sidebar entry into the `NAV` array of [`src/v4/shell-render.js`](src/v4/shell-render.js). Vite auto-discovers the new entry — no config change needed. Run `npm run new -- --help` for all options, or use `--dry-run` to preview without writing.

The manual way:

1. Copy any existing page in `production/` (e.g. `profile.html`) as your starting point.
2. Update the `<title>`, `data-page`, and `data-breadcrumb` attributes. Breadcrumb segments become links automatically when their text matches a sidebar entry (`Forms` → `form.html`); point one anywhere else with a pipe, e.g. `data-breadcrumb="Home > Projects|projects.html > Acme Redesign"`. The final segment is the current page and is never a link.
3. Replace the `<main>` content with your markup using the v4 components.
4. Optionally add a new sidebar item by editing the `NAV` array in [`src/v4/shell-render.js`](src/v4/shell-render.js).

The shell auto-marks the matching nav item active based on `data-page`.

### Adding a chart

Add a factory function to [`src/v4/charts.js`](src/v4/charts.js) following the `revenueLine` / `salesBar` pattern, register it in the `charts` map, then drop a `<div data-chart="your-name" style="width:100%;height:300px"></div>` into any page. Colors come from the design tokens automatically.

### Adding a sortable table

Mark up a regular `<table class="table" data-datatable>` with `<thead>` and `<tbody>`. The init runs automatically. Use `<th data-orderable="false">` to disable sorting on a column, and `data-page-length="25"` on the table to change the page size.

### Sidebar navigation

The sidebar is rendered from a single source — the `NAV` array in [`src/v4/shell-render.js`](src/v4/shell-render.js). Edit there, every page updates.

### TypeScript / IntelliSense

Type declarations for the public JS surface ship in [`types/gentelella.d.ts`](types/gentelella.d.ts) and are wired up via the `types` field in `package.json`. VS Code resolves IntelliSense automatically — no `tsconfig` required, no rewrite. Covers `mountShell`, `showModal`, `showToast`, `openMenu`, `seedAdapter`/`httpAdapter`, chart/table init, and the `NAV` schema.

### Markup helpers

For pages that build content from data (orders rows, inbox threads, kanban cards), [`src/v4/markup.js`](src/v4/markup.js) exposes pure string-returning helpers — `statTile()`, `statusBadge()`, `customerCell()`, `activityItem()`, `visitorRow()`, `emptyState()`, `banner()`, `skeletonRows()`, plus `escapeHtml()`. Live examples on the [Playground](https://preview.colorlib.com/theme/gentelella/playground.html#helpers-intro). Static pages keep their hand-written HTML — these are for JS-driven content where the boilerplate adds up.

## SEO and metadata

Every page is built with SEO in mind:

- **Semantic HTML5** — `<main>`, `<nav>`, `<aside>`, `<header>`, semantic `<h1>` page titles
- **Per-page `<meta description>`** auto-derived from the breadcrumb
- **Open Graph + Twitter Card** tags injected at build time
- **PWA manifest** + theme-color (light + dark variants)
- **Pre-paint theme script** — eliminates flash of incorrect theme on load
- **Skip-to-content link** + ARIA landmarks for screen reader navigation
- **`Cache-Control`-aware deploy** ([`scripts/deploy-preview.sh`](scripts/deploy-preview.sh)) — long-cache for hashed assets, short-cache for HTML, no-cache for service worker

## Deployment

Static template — deploy `dist/` anywhere that serves files.

| Host | Notes |
| --- | --- |
| **Netlify / Vercel / Cloudflare Pages** | Drop in, no config needed. Set `BASE_PATH=/` (default). |
| **GitHub Pages** | `BASE_PATH=/your-repo/ npm run build`, push `dist/` to `gh-pages`. |
| **S3 / CloudFront** | Upload `dist/`. Set the bucket as a static site, point CloudFront at it. |
| **Any nginx / Apache** | `cp -r dist/* /var/www/html/`. |
| **Cloudflare R2** | Use the built-in [`npm run deploy:preview`](scripts/deploy-preview.sh) for per-file cache headers. |

No backend. No environment variables required (other than `BASE_PATH` if you're deploying under a subpath).

## What's intentionally NOT included

- **No backend.** Forms post to `#` and don't persist. The dashboard is a UI template — wire up your own API.
- **No auth.** The login form is a redirect; there's no session, no token, no validation.
- **No real-time.** No WebSockets, no SSE, no polling. Activity feeds and stats are static.
- **No state management.** Toggles and todo checkboxes flip via direct DOM mutation.
- **No formal accessibility audit.** Skip-link, focus rings, ARIA labels and landmarks are wired, but no systematic screen-reader testing has been done. PRs welcome.

## Roadmap

Shipped in `4.0.0` — full list in [`changelog.md`](changelog.md). Still planned:

- **Image optimization** — compress `public/images/*.jpg` and ship AVIF + JPG fallback
- **Lighthouse audit** + tuning to 95+ Performance / 100 A11y / 100 SEO / 100 PWA
- **JSON-LD structured data** on landing + marketing pages
- **`sitemap.xml`** generator (auto-built from `production/*.html`)
- **Per-page chart-type tree-shaking** to slim the ECharts vendor chunk
- **RTL support** (logical-properties pass)
- **i18n extraction pattern**

Want any of these prioritized? [Open an issue](https://github.com/ColorlibHQ/gentelella/issues).

## License

MIT — free for personal and commercial use. See [`LICENSE.txt`](LICENSE.txt).

## Credit

Gentelella has been a free Bootstrap admin template since 2014, originally by [Aigars Silkalns](https://colorlib.com) at Colorlib. v4 is a ground-up redesign for 2026 — Bootstrap and jQuery are gone, replaced by a self-contained design system.

If Gentelella v4 saves you time, consider starring the repo on [GitHub](https://github.com/ColorlibHQ/gentelella) — it helps other developers find the project.

## 3. SUPABASE / DATABASE TYPES
\n--- FILE: ./supabase/migrations/20260824070000_project_part5-2_rab_formal_schema.sql ---
-- Issue #60 — PROJECT, Part V.2: RAB Formal (schema).
-- Lampiran PRD: SPEC_PROJECT_Part_V2_RAB_Formal.md. Bukan revisi
-- Part V (v2.10.0) — penambahan. case_quotation_items (termin
-- pembayaran) TETAP DIPAKAI, tidak diubah/dihapus.
--
-- SCHEMA ONLY. Tidak ada trigger generate nomor RAB (task terpisah
-- setelah ini), tidak ada perubahan frontend.

begin;

-- ========================================================================
-- 1. service_type_codes — mapping service_type ke kode 3 huruf
-- ========================================================================

create table public.service_type_codes (
  service_type text primary key,
  code varchar(3) not null
);

alter table public.service_type_codes enable row level security;

-- Tabel konfigurasi internal — pola sama seperti document_templates:
-- admin manage, supervisor/internal select-only, tidak ada akses client.
create policy service_type_codes_admin_all
  on public.service_type_codes
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy service_type_codes_supervisor_select
  on public.service_type_codes
  for select
  using (public.auth_role() = 'supervisor');

create policy service_type_codes_internal_select
  on public.service_type_codes
  for select
  using (public.auth_role() = 'internal');

insert into public.service_type_codes (service_type, code) values
  ('PBG', 'PBG'),
  ('SLF', 'SLF'),
  ('NIB', 'NIB'),
  ('Pendirian PT', 'PPT'),
  ('Pendirian CV', 'PCV'),
  ('Pendirian Yayasan', 'PYY'),
  ('Pendirian PT + OSS', 'POS'),
  ('Perubahan Alamat', 'PAL'),
  ('Perubahan Pengurus', 'PPG'),
  ('Laporan Tahunan', 'LAP'),
  ('SIUP', 'SIU'),
  ('Izin Usaha', 'IZU'),
  ('Izin Lingkungan (UKL-UPL)', 'IZL'),
  ('Amdal', 'AMD'),
  ('Perpanjangan NIB', 'PNB'),
  ('Merek Dagang (HKI)', 'HKI'),
  ('BPJS Ketenagakerjaan', 'BPJ'),
  ('Akta Perubahan Modal', 'AKT'),
  ('Sertifikasi Halal', 'HAL'),
  ('Izin Operasional', 'IZO'),
  ('IMB ke PBG', 'IMB');

-- ========================================================================
-- 2. case_quotation_line_items — rincian pekerjaan (deskripsi, qty,
--    rate, amount) — BEDA dari case_quotation_items (termin pembayaran)
-- ========================================================================

create table public.case_quotation_line_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.case_quotations(id) on delete cascade,
  description text not null,
  detail text,
  qty numeric not null default 1,
  rate numeric not null,
  amount numeric not null,
  order_index int not null,
  unique (quotation_id, order_index)
);

create index case_quotation_line_items_quotation_id_idx on public.case_quotation_line_items(quotation_id);

alter table public.case_quotation_line_items enable row level security;

-- Pola RLS identik dengan case_quotation_items (Part I): admin ALL;
-- supervisor setara; internal dibatasi ke quotation berstatus DRAFT;
-- client SELECT-only via join ke cases.client_id.
create policy case_quotation_line_items_admin_all
  on public.case_quotation_line_items
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy case_quotation_line_items_supervisor_select
  on public.case_quotation_line_items
  for select
  using (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_supervisor_insert
  on public.case_quotation_line_items
  for insert
  with check (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_supervisor_update
  on public.case_quotation_line_items
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_supervisor_delete
  on public.case_quotation_line_items
  for delete
  using (public.auth_role() = 'supervisor');

create policy case_quotation_line_items_internal_select
  on public.case_quotation_line_items
  for select
  using (public.auth_role() = 'internal');

create policy case_quotation_line_items_internal_insert
  on public.case_quotation_line_items
  for insert
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_line_items_internal_update
  on public.case_quotation_line_items
  for update
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  )
  with check (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_line_items_internal_delete
  on public.case_quotation_line_items
  for delete
  using (
    public.auth_role() = 'internal'
    and exists (
      select 1 from public.case_quotations q
      where q.id = case_quotation_line_items.quotation_id
        and q.status = 'DRAFT'
    )
  );

create policy case_quotation_line_items_client_select_own
  on public.case_quotation_line_items
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.case_quotations q
      join public.cases c on c.id = q.case_id
      where q.id = case_quotation_line_items.quotation_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ========================================================================
-- 3. case_quotations — tambahan kolom
-- ========================================================================

alter table public.case_quotations
  add column quotation_number text,
  add column description text;

commit;
\n--- FILE: ./supabase/migrations/20260822150000_create_workflow_engine_core_schema.sql ---
-- Skema inti workflow engine generik (Issue #33): workflow_templates,
-- workflow_template_stages, workflow_instances, workflow_stages.
--
-- Scope: DB schema only. Tidak menyentuh cases.status atau kolom existing
-- tabel manapun, tidak ada perubahan frontend/JS. workflow_actions dan
-- workflow_transitions sengaja TIDAK dibuat di sini (task terpisah).
--
-- Pola RLS mengikuti audit manual terhadap pg_policies pada `cases` dan
-- `case_assignees` (bukan tebakan):
--   cases:          admin ALL; supervisor select+update; internal
--                   select+insert+update; client select-own via client_id.
--   case_assignees: admin select/insert/delete; supervisor
--                   select/insert/delete; internal select-only; TIDAK ada
--                   policy client sama sekali (assignee bukan data yang
--                   ditampilkan ke client).
--
-- Deviasi yang disengaja dari pola case_assignees: workflow_stages dan
-- workflow_instances MENAMBAHKAN policy client select-own (via join ke
-- cases.client_id), karena SMA_APP_MASTER_ARCHITECTURE.js eksplisit
-- mensyaratkan client bisa melihat "Workflow Progress" di halaman project
-- mereka sendiri (clientProjectDetail.sections). Konfigurasi workflow
-- (workflow_templates/workflow_template_stages) TIDAK diberi akses client
-- sama sekali, karena roleOwnershipMatrix.CONFIGURE_WORKFLOW = ADMIN only.

begin;

-- ----------------------------------------------------------------------
-- workflow_templates — blueprint reusable per tipe project.
-- ----------------------------------------------------------------------

create table public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.workflow_templates enable row level security;

create policy workflow_templates_admin_all
  on public.workflow_templates
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_templates_supervisor_select
  on public.workflow_templates
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_templates_internal_select
  on public.workflow_templates
  for select
  using (public.auth_role() = 'internal');

-- ----------------------------------------------------------------------
-- workflow_template_stages — daftar stage dalam satu template.
-- ----------------------------------------------------------------------

create table public.workflow_template_stages (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workflow_templates(id) on delete cascade,
  name text not null,
  sequence int not null,
  description text,
  created_at timestamptz not null default now(),
  unique (template_id, sequence)
);

create index workflow_template_stages_template_id_idx
  on public.workflow_template_stages(template_id);

alter table public.workflow_template_stages enable row level security;

create policy workflow_template_stages_admin_all
  on public.workflow_template_stages
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_template_stages_supervisor_select
  on public.workflow_template_stages
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_template_stages_internal_select
  on public.workflow_template_stages
  for select
  using (public.auth_role() = 'internal');

-- ----------------------------------------------------------------------
-- workflow_instances — copy workflow per project (`cases`), boleh
-- divergen dari template aslinya.
-- ----------------------------------------------------------------------

create table public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  template_id uuid references public.workflow_templates(id) on delete set null,
  name text not null,
  status text not null default 'ACTIVE'
    check (status in ('DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now()
);

create index workflow_instances_case_id_idx
  on public.workflow_instances(case_id);

create index workflow_instances_template_id_idx
  on public.workflow_instances(template_id);

alter table public.workflow_instances enable row level security;

create policy workflow_instances_admin_all
  on public.workflow_instances
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_instances_supervisor_select
  on public.workflow_instances
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_instances_supervisor_update
  on public.workflow_instances
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy workflow_instances_internal_select
  on public.workflow_instances
  for select
  using (public.auth_role() = 'internal');

create policy workflow_instances_internal_insert
  on public.workflow_instances
  for insert
  with check (public.auth_role() = 'internal');

create policy workflow_instances_internal_update
  on public.workflow_instances
  for update
  using (public.auth_role() = 'internal')
  with check (public.auth_role() = 'internal');

create policy workflow_instances_client_select_own
  on public.workflow_instances
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.cases c
      where c.id = workflow_instances.case_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ----------------------------------------------------------------------
-- workflow_stages — stage instance milik satu workflow_instance
-- (di-copy dari workflow_template_stages, boleh divergen).
-- ----------------------------------------------------------------------

create table public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  template_stage_id uuid references public.workflow_template_stages(id) on delete set null,
  name text not null,
  sequence int not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
  description text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workflow_instance_id, sequence)
);

create index workflow_stages_workflow_instance_id_idx
  on public.workflow_stages(workflow_instance_id);

alter table public.workflow_stages enable row level security;

create policy workflow_stages_admin_all
  on public.workflow_stages
  for all
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy workflow_stages_supervisor_select
  on public.workflow_stages
  for select
  using (public.auth_role() = 'supervisor');

create policy workflow_stages_supervisor_insert
  on public.workflow_stages
  for insert
  with check (public.auth_role() = 'supervisor');

create policy workflow_stages_supervisor_update
  on public.workflow_stages
  for update
  using (public.auth_role() = 'supervisor')
  with check (public.auth_role() = 'supervisor');

create policy workflow_stages_supervisor_delete
  on public.workflow_stages
  for delete
  using (public.auth_role() = 'supervisor');

create policy workflow_stages_internal_select
  on public.workflow_stages
  for select
  using (public.auth_role() = 'internal');

create policy workflow_stages_client_select_own
  on public.workflow_stages
  for select
  using (
    public.auth_role() = 'client'
    and exists (
      select 1
      from public.workflow_instances wi
      join public.cases c on c.id = wi.case_id
      where wi.id = workflow_stages.workflow_instance_id
        and c.client_id = public.auth_client_id()
    )
  );

-- ----------------------------------------------------------------------
-- workflow_instances.current_stage_id — ditambahkan lewat ALTER karena
-- workflow_stages baru ada setelah workflow_instances dibuat di atas
-- (dependency melingkar: instance -> stage -> balik ke instance).
-- ----------------------------------------------------------------------

alter table public.workflow_instances
  add column current_stage_id uuid references public.workflow_stages(id) on delete set null;

commit;
