# 003 — Move to its own repo

- **Commit:** 6ed766e478c
- **Size:** SMALL
- **Depends on:** 002 (and ideally 001, so the new repo isn't Cal-only)

## Plan

1. [cosscom/coss-vaunt](https://github.com/cosscom/coss-vaunt) with `apps/studio` and `packages/product-video` moved as they are, keeping history with `git filter-repo --path apps/studio --path packages/product-video --path .agents/skills/animate-text`. The engine has its own copy of the animate-text catalogue; the skill comes along so agents in the new repo can still pick and translate text effects, with `.claude/skills/animate-text` linked to it again.
2. A small workspace setup (Yarn or pnpm) and Biome config copied from the monorepo, trimmed to these two packages.
3. Setup steps in the README:
   - `npx playwright install chromium`
   - ffmpeg on the path, for export
   - `AI_GATEWAY_API_KEY` in `.env`
   - for Cal.com projects: a local Cal app with the seeded demo user, and its Trigger.dev agent worker for real agent replies
4. Next's `output: "standalone"` build, which 004 needs anyway.
5. Leave a pointer in the Cal monorepo, then remove `apps/studio` and `packages/product-video` there.

## Verify

A fresh clone on a clean machine follows the README, opens the studio, records a Cal.com scene and exports an MP4.
