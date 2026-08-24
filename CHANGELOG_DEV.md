# Developer & AI Synchronization Changelog

File ini mencatat perubahan skema database, helper authorization, dan aturan bisnis penting agar seluruh agent AI (Gemini, Claude, ChatGPT/Dimas) dan developer manusia tetap tersinkronisasi.

---

## [Unreleased] - 2026-08-24

### 🟢 Completed (Issue #109: User & Role Management)
- **Database Migration**:
  - `20260824180000_add_account_status_and_role_security.sql` berhasil dibuat & di-audit.
  - Menambahkan kolom `account_status` (`ACTIVE`, `SUSPENDED`, `DISABLED`) & audit metadata pada `public.profiles`.
  - Helper `auth_role()` & `auth_client_id()` diperbarui untuk memblokir akun non-ACTIVE.
  - Trigger `prevent_profile_privilege_escalation` mengamankan `account_status`, `role`, dan `client_id` khusus Admin/Supervisor.
- **Code Quality**:
  - Auto-fix 17 linting errors pada `src/v4/user-management.js`. Build status: PASS.

### 🟡 Planned / In-Progress
- **Frontend / Admin UI**:
  - Integrasi UI User Management & Invite Staff di Portal Admin.

---
