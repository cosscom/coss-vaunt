# coss motion — extraction and desktop plans

Written on 2026-11-19 at commit `6ed766e478c` on branch `matthew/product-video-studio`. Committed with the proof of concept so the plan travels with it.

The studio (`apps/studio`) and its engine (`packages/product-video`) already work apart from the Cal.com app: they record whatever runs at a project's local address, and they read their AI key from `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY`). These plans take them to their own repo, and then to a desktop app.

| Order | Plan | Size | Depends on | Status |
| --- | --- | --- | --- | --- |
| 1 | [001 — Record any web app](001-record-any-web-app.md) | LARGE | — | TODO |
| 2 | [002 — Cut the monorepo dependencies](002-cut-monorepo-dependencies.md) | MEDIUM | — | TODO |
| 3 | [003 — Move to its own repo](003-move-to-own-repo.md) | SMALL | 002, ideally 001 | TODO |
| 4 | [004 — Desktop app](004-desktop-app.md) | LARGE | 003 | TODO |

001 comes first because it's easiest to test with the Cal app beside it: Cal becomes the built-in profile of a general feature, not the only thing the engine knows. 002 is mechanical and could land first if the repo move is more urgent than other apps.

## Open decisions (they need a human)

1. **Drop agent-browser?** The scene explorer drives the page through `agent-browser`, a native CLI binary per platform. Playwright, which recording needs anyway, can do everything the explorer uses: snapshot, click, type, describe an element, count a selector. Dropping it removes one native binary from every install and signing step in 004. The cost is reworking the explorer's page snapshots and re-checking how well the AI scripts scenes. Recommendation: only if the extra binary becomes a problem in 004.
2. **H.264 in a shipped desktop app.** Export uses ffmpeg with libx264, which is GPL. See 004 for the options; it's a licensing decision, not an engineering one.
3. **Name of the repo and packages.** Plans use `coss-motion` as a placeholder.

## Stays as it is

- **Playwright.** It runs the frame-exact recording (fake clock, a screenshot of each frame through the browser's debugging protocol), sign-in, the capture of the real agent's replies, and export. No other tool gives that control.
- **Local-only recording.** The localhost allowlist suits a standalone tool and a desktop app better than it suited the monorepo.
