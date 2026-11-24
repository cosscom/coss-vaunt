# coss vaunt — extraction plans

Written on 2026-11-19 at commit `6ed766e478c` on branch `matthew/product-video-studio`. Committed with the proof of concept so the plan travels with it.

These plans took the studio (`apps/studio`) and its engine (`packages/product-video`) out of the Cal.com monorepo and into [cosscom/coss-vaunt](https://github.com/cosscom/coss-vaunt). All three are done. A desktop app was planned as 004 and dropped on 2026-11-24.

| Order | Plan | Size | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | [001 — Record any web app](001-record-any-web-app.md) | LARGE | — | Done, without a Cal profile: any app, a generic sign-in and a page crawl |
| 2 | [002 — Cut the monorepo dependencies](002-cut-monorepo-dependencies.md) | MEDIUM | — | Done; coss ui is copied into `packages/coss-ui` |
| 3 | [003 — Move to its own repo](003-move-to-own-repo.md) | SMALL | 002, ideally 001 | Done. The studio never reached the monorepo's `main`, so there is nothing to remove there |

## Stays as it is

- **Playwright.** It runs the frame-exact recording (fake clock, a screenshot of each frame through the browser's debugging protocol), sign-in, page discovery and export. No other tool gives that control.
- **agent-browser.** The scene explorer drives the page through it. Playwright could do the same, but without a desktop build to package there's no reason to rework the explorer.
- **Local-only recording.** The localhost allowlist suits a standalone tool better than it suited the monorepo.
