# coss vaunt

Product videos for web apps, made from the app itself. Describe the video, and coss vaunt plans the scenes, drives
your app in a headless browser to record each one frame by frame, and lays the takes out on a 3D stage with camera
moves, cursor, close-ups, text effects and audio. Export to MP4.

It records apps running on your own machine (`localhost`) only.

## Setup

Needs [Bun](https://bun.com) 1.3, Node 22 (Next.js and the recorder run on it), and ffmpeg on the path for export.

```bash
bun install
bunx playwright install chromium
bun dev
```

Open http://localhost:3102. Projects, recordings and exports are kept in `.studio/` at the repo root.

### AI key

Planning and scripting scenes needs a key for Anthropic, OpenAI or the Vercel AI Gateway. Add one in the studio's
settings (the gear button); it's saved to `~/.config/coss-vaunt/settings.json`, readable only by you. A key in the
environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY`) takes priority over a saved one.

### Your app

A new project asks for your app's address (`http://localhost:3000` by default), notes about the app for the AI, and
an optional test login. With a login, the recorder signs in itself through the app's sign-in form; email links and
SSO aren't supported. The login is saved beside the project in `app-login.json`, not in the project file.

## Layout

| Path | What |
| --- | --- |
| `apps/studio` | The studio, a Next.js app (`@coss/vaunt`) |
| `packages/product-video` | The engine (`@coss/vaunt-engine`): storyboard, recording, AI planning, export |
| `packages/coss-ui` | The coss ui components the studio uses, copied from the Cal.com monorepo |
| `.agents/skills/animate-text` | The animate-text skill for coding agents; the engine keeps its own copy of the catalogue |
| `plans/` | Plans for what comes next |

## Commands

```bash
bun dev           # the studio on :3102
bun run build     # production build of the studio; bun start serves it
bun type-check
bun run test      # Vitest; plain `bun test` runs Bun's own test runner instead
bun lint          # Biome; bun lint:fix to apply fixes
```

If port 3102 is taken, run the studio on another one with
`bun run --cwd apps/studio next dev --port 3103`.

The engine can record and export without the studio's UI (the studio still has to be running for export):

```bash
bun run --cwd packages/product-video record <projectId> <clipId>
bun run --cwd packages/product-video export <projectId> --studio http://localhost:3102
```

Run either with no arguments to see its options.
