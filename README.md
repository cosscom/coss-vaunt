# coss vaunt

Product videos for web apps, made from the app itself. Describe the video, and coss vaunt plans the scenes, drives
your app in a headless browser to record each one frame by frame, and lays the takes out on a 3D stage with camera
moves, cursor, close-ups, text effects and audio. Export to MP4.

It records apps running on your own machine (`localhost`) only.

## Run it

Needs Node 22 and ffmpeg on the path (for recording previews and export).

```bash
npx vaunt start
```

The first run downloads Chromium for the recorder. The studio opens at http://localhost:3102 (or the next free
port), and projects, recordings and exports are kept in `~/.vaunt/projects`. `npx vaunt --help` lists the options:
`--port`, `--data <dir>` for somewhere other than `~/.vaunt`, `--app-url` for the address new projects start with,
and `--no-open`.

## Develop

Needs [Bun](https://bun.com) 1.3 as well.

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
SSO aren't supported. The login is saved beside the project in `app-login.json`, not in the project file. The conversation with the agent is kept
beside it too, in `agent-thread.json`.

While exploring and recording, the app's writes (form posts, mutations and other API calls that change data) are
answered in the page and never reach its server. Chat messages are the exception: when a scene sends a message to an
assistant in your app, the app answers it for real once, and its streamed reply is saved in the project's
`app-replies/` folder and replayed in every take. That reply runs your app's agent for real, so a message that asks it
to change something will change it. Delete a reply's file to have the app answer that message again.

## Layout

| Path | What |
| --- | --- |
| `apps/studio` | The studio, a Next.js app (`@coss/vaunt`) |
| `packages/product-video` | The engine (`@coss/vaunt-engine`): storyboard, recording, AI planning, export |
| `packages/vaunt` | The published `vaunt` package: the `vaunt start` launcher and the build that bundles the studio and engine |
| `packages/coss-ui` | The coss ui components the studio uses, copied from the Cal.com monorepo |
| `.agents/skills/animate-text` | The animate-text skill for coding agents; the engine keeps its own copy of the catalogue |

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

### Publishing

`packages/vaunt` is what `npx vaunt` installs. Its build makes a standalone production build of the studio and
bundles the engine's record, export and generate CLIs to plain JavaScript, so the package runs on Node with no Bun,
tsx or checkout:

```bash
bun run --cwd packages/vaunt build   # writes packages/vaunt/dist
node packages/vaunt/bin/vaunt.mjs start
cd packages/vaunt && npm publish     # builds again first (prepack)
```

Keep the package's `next`, `react`, `react-dom`, `playwright` and `agent-browser` versions in step with the studio's
and the engine's; the build fails when they drift, or when the studio's server needs a package `vaunt` doesn't
depend on.

