# vaunt-window

The desktop window `npx vaunt start` opens the studio in. It's a Tauri v2 app with no frontend of its own: the Node
launcher (`packages/vaunt/bin/vaunt.mjs`) runs the studio server, then starts this binary with the studio's address.
On macOS it renders with WKWebView, the same engine as Safari.

- Closing the last window exits the process, and the launcher then stops the server. Stopping the launcher closes the
  window.
- OS file drops reach the page: Tauri's own drop handler is off, so the timeline and media panel get them.
- Downloads (the export dialog's link) save to `~/Downloads` and are shown in Finder once they finish.
- Links outside the studio open in the system browser. `window.open` to a studio page opens another window.
- Glass (Settings › Appearance): the window is transparent, and the `set_glass` command turns macOS vibrancy (the
  sidebar material) on and off behind it; the page makes the editor's shell see-through to match. A window opens
  with the glass the settings file has (`appearance.glass` in `~/.config/coss-vaunt/settings.json`), and the page
  marks `<html data-vaunt-glass>` so Settings knows the window can do it. Transparency needs Tauri's
  `macos-private-api` feature, so this build can't go on the Mac App Store.

## Develop

```bash
bun run build          # in packages/vaunt, once
bun run build          # here: cargo build --release
node ../vaunt/bin/vaunt.mjs start
```

The launcher finds the window in this order: `$VAUNT_WINDOW`, the platform package
`@coss/vaunt-window-<platform>-<arch>` (not published yet), then `target/release` or `target/debug` here. With none,
or with `--browser`, it opens the default browser as before.

To try the window against `bun dev` instead, run `bun run dev` here (it opens http://localhost:3102).

If linking fails with `tapi error: malformed file … unknown architecture arm64e.x1-macos`, your Command Line Tools'
linker is older than the newest SDK. Build against the previous SDK:
`SDKROOT=$(xcrun --show-sdk-path --sdk macosx26.5 2>/dev/null || echo /Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk) cargo build`.
