# CLAUDE.md

See [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) — that file is the single source of truth for this project's governance, workflow, and technical conventions.

Read **Chapter 0-9** in full before writing or changing any code — this covers git workflow, AI collaboration rules, verification protocol, and escalation criteria. **Chapter 10** is technical reference (architecture, conventions, recipes): read **C10P1** (the index) always, then open only the specific C10P2-P9 sections your task actually touches — see **C6P7 (Tiered Reading Rule)** for exactly how that works.

This stub exists because Claude Code specifically looks for `CLAUDE.md` by default, while every other AI tool on this project reads its own convention file (`.cursor/rules/project.mdc`, `.github/copilot-instructions.md`). Keeping the real content in one file (`DEVELOPMENT_RULES.md`) avoids these stubs drifting out of sync with each other.
