# 001 — Record any web app

- **Commit:** 6ed766e478c
- **Size:** LARGE
- **Depends on:** nothing

## Problem

The new-project dialog already saves another app's address, instructions and login (`settings.app = { kind: "custom", instructions }`, login in `<project>/app-login.json`, mode 600). Nothing reads them yet: generating a recording scene for such a project stops with "Recording apps other than Cal.com isn't supported yet" (`packages/product-video/src/ai/generate-board.ts`).

Everything below the storyboard assumes Cal.com:

| Where | Cal-specific part |
| --- | --- |
| `catalogues/routes/route-catalogue.ts`, `app-map.ts` | The pages scenes may open, their stable selectors, the seeded demo login, timezone and clock time |
| `recording/record-clip.ts` (`signIn`) | Logs in at `/auth/login` with `input[name=email]` and `input[name=password]` |
| `recording/scripted-reply.ts`, `agent-replies.ts` | The Main Agent chat: scripted fixtures, and capturing the real agent's replies |
| `ai/board-draft-prompt.ts`, `recording-explorer-prompt.ts` | Prompts that name Cal pages and the agent |

## Plan

1. **An app profile.** One type for "what the engine needs to know about the app": its pages (or none), how to sign in, its viewport, timezone and clock, and whether it has an agent chat to capture. Cal.com's catalogue becomes the built-in profile; a custom app builds one from the project.
2. **Sign-in from stored details.** For a custom app, the explorer signs in once by following the instructions and typing the login through a tool that never puts the values in the prompt (`typeSecret("password", selector)`). The steps it took are saved as the project's login script and replayed before every recording and rehearsal. A changed login page fails with a clear "sign-in no longer works; sign in again" rather than a missing-selector error.
3. **Pages from instructions.** The storyboard writer plans from the project's instructions instead of the Cal catalogue; a scene's page is any path on the app. The explorer finds selectors itself, as it already does.
4. **Agent capture stays Cal-only.** For other apps a chat box is just typing and clicking.
5. **Remove the "isn't supported yet" guard** in `generate-board.ts` once 2 and 3 work.

## Verify

- A scratch project against a small local app with a login form records a scene end to end, and the password never appears in a prompt, a log or `project.json`.
- Cal.com projects record exactly as before (same capture hashes, same takes reused).

## Spec

Write the spec change before building: it changes the project file, the prompts and what a recording can open.
