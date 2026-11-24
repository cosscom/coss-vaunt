# 002 — Cut the monorepo dependencies

- **Commit:** 6ed766e478c
- **Size:** MEDIUM, mostly mechanical, about a day or two
- **Depends on:** nothing

## Problem

Three workspace packages tie the studio to the monorepo. `@calcom/ai` is the one that matters: it pulls in `@calcom/env`, `@calcom/kv`, `@calcom/logger`, `@calcom/i18n` and `@calcom/ai-adapter`, none of which the studio needs.

## Where

| Import | Used in | Replace with |
| --- | --- | --- |
| `@calcom/ai/model-registry` | `packages/product-video/src/ai/studio-model.ts` | The AI SDK (`ai`) with the AI Gateway provider; the key names stay `AI_GATEWAY_API_KEY` / `ANTHROPIC_API_KEY` |
| `@calcom/ai/generate-text` | `packages/product-video/src/ai/submit-tool-loop.ts` | `generateText` and `stepCountIs` from `ai` |
| `@calcom/ai/agent-tool` | `submit-tool-loop.ts`, `recording-explorer.ts` | `tool` from `ai` |
| `@calcom/ai/react/ui/agent-composer` | `apps/studio/modules/editor/storyboard/storyboard-composer.tsx` | Copy the component into the studio |
| `@calcom/ai/react/ui/agent-status-indicator` | `apps/studio/modules/editor/storyboard/scene-node.tsx` | Copy |
| `@calcom/ai/react/ui/pointer-glow` | `apps/studio/modules/editor/layout/resizable-split.tsx` | Copy |
| `@source "…/packages/ai/src/react/ui/{…}.tsx"` | `apps/studio/app/globals.css` | Point at the copied files |
| `@coss/ui/*` (79 files; 34 components, icons, `lib/utils`) | Across the studio | Add the components from the coss ui registry. `@coss/ui/shared/inline-editable-text` and `segmented-radio-group` are Cal's own composites: copy them in |
| `@calcom/tsconfig` | Both `package.json`s | A local `tsconfig.base.json` |

## Plan

1. Swap the three engine imports for the AI SDK; keep `studio-model.ts` as the one place that picks the model.
2. Copy the three AI UI components and the two coss composites into `apps/studio/modules/vendor/` (or similar), with their own imports fixed.
3. Replace `@coss/ui` with registry components, keeping the import paths stable through a path alias so the 79 files don't change.
4. Drop the workspace dependencies from both `package.json`s, pinning versions that already appear in the monorepo.

## Verify

`grep -rn "@calcom/" apps/studio packages/product-video/src` finds only `@coss/vaunt-engine`. Type checks, the studio's tests and the package's tests pass. A draft, a generate and an export work against the local Cal app.
