# 004 — Desktop app

- **Commit:** 6ed766e478c
- **Size:** LARGE
- **Depends on:** 003

## Problem

The studio is a Node app with a web front end. Recording, export and AI generation run as Node child processes; the Next server's routes and server actions read and write project files and stream progress. A desktop build has to carry:

- a Node runtime and the Next standalone server
- Chromium for Playwright, around 150 MB, whatever the app's own window uses
- ffmpeg, for export
- agent-browser's native binary, for the explorer (unless the open decision in the README drops it)
- AI keys, which should live in the OS keychain instead of `.env`

## Recommendation: Electron

- Node is built in: the Next server and the engine run as they do today, with no sidecar.
- The window is Chromium, the same engine Playwright records with, so what you edit matches what records and exports. The stage, the intro and the border beams are heavy WebGL and have only been tested in Chrome.
- The download ends up about the same size as the alternative, because both ship Chromium.

**Tauri** works too: package Node, the Next standalone server and the engine as a sidecar, and load it at a local address. But its small-download advantage mostly disappears once Node and Chromium are bundled, and the UI would run in WebKit on macOS and WebKitGTK on Linux, where the WebGL surfaces are untested and WebKitGTK's GPU support is unreliable. Choose it only if a small installer matters more than shipping speed.

## Plan

1. An Electron main process that starts the Next standalone server on a free local port and opens it in a window.
2. Projects in the OS's app-data folder instead of the repo's `.studio`.
3. Chromium for Playwright downloaded on first launch, with progress (keeps the installer small).
4. AI keys entered in settings and stored in the keychain.
5. The intro plays on first launch of each session, as it does now on the projects page.

## Decisions before shipping

- **ffmpeg licensing.** Our H.264 export uses libx264, which is GPL. Bundling a GPL ffmpeg in a closed-source app isn't allowed. Options:
  - **a.** Encode with the OS's hardware encoders: VideoToolbox on macOS, Media Foundation on Windows, through an LGPL ffmpeg build.
  - **b.** Ask users to install ffmpeg themselves.
  - **c.** Open-source the app.
- **macOS signing and notarisation** for every bundled binary: Node, ffmpeg, agent-browser.

## Verify

A signed build installs on a clean macOS machine, downloads Chromium on first run, records a scene from a local app and exports an MP4, with no terminal involved.
