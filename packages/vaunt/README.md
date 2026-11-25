# vaunt

coss vaunt makes product videos for web apps from the app itself. Describe the video, and it plans the scenes,
records your app frame by frame in a headless browser, and lays the takes out on a 3D stage with camera moves,
cursor, close-ups, text effects and audio. Export to MP4.

```bash
npx vaunt start
```

Needs Node 22, and ffmpeg on the path for recording previews and export. The first run downloads Chromium for the
recorder. The studio opens at http://localhost:3102 (or the next free port); projects are kept in `~/.vaunt/projects`.

It records apps running on your own machine (`localhost`) only. Planning scenes with AI needs an Anthropic, OpenAI or
Vercel AI Gateway key, added in the studio's settings or set as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or
`AI_GATEWAY_API_KEY`.

| Option | |
| --- | --- |
| `--port <port>` | Port for the studio (default 3102, or the next free one) |
| `--data <dir>` | Where projects, recordings and exports are kept (default `~/.vaunt`, or `$VAUNT_HOME`) |
| `--app-url <url>` | The local app address new projects start with (default http://localhost:3000) |
| `--no-open` | Don't open the browser |
