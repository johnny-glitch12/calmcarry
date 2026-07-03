---
name: machine-transfer-2026-07
description: July 2026 Mac→PC transfer — every project repo now carries a claude-memory/ snapshot; secrets move by hand; two security follow-ups outstanding
metadata: 
  node_type: memory
  type: project
  originSessionId: ebe41cd4-f98b-47b8-81ee-f7251a8555dc
---

On 2026-07-03 all active projects were packaged for transfer to the user's PC via private GitHub repos under `johnny-glitch12`: calmcarry, iptv-landing (new repo), taskforce (+3 previously-unpushed branches), longevity-forever (new), longevity-docs (new), fluido, fluido-presale (new), mission-control (= "Jarvis"). Each repo has a `claude-memory/` folder with that project's Claude memory snapshot + import README.

**Why:** Claude Code memory/chats don't sync via the Anthropic account; repos are the carrier.

**How to apply:** On a new machine, clone → run `claude` → import `claude-memory/`. Secrets never travel via git: each project's `.env`/`.env.local`, iptv `prisma/dev.db`, mission-control `data/`, taskforce gitignored investor-docs folders (~65MB) must be copied by hand.

Outstanding security follow-ups: (1) taskforce `memory/test_credentials.md` is tracked in git with plaintext test-account passwords (survived an earlier filter-repo purge) — purge or accept; (2) mission-control `.env.local` says its Anthropic + ElevenLabs keys were shared in plaintext — rotate instead of copying. Not transferred: ~/safe-spine (knowledge-spine), goldiama-site/-fund, taskforce_marketer (just a bare venv).
