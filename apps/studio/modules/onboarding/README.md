# Onboarding

The first-run screen. It shows over the projects page until it's finished once on a machine
(`~/.config/coss-vaunt/onboarding.json`), and again at `/?onboarding`. It stands in for the startup intro on that
visit, since its first slide is the intro.

| File | What it is |
| --- | --- |
| `first-run.tsx` | Puts the onboarding over the projects page; on finish records it, fades out, grows the window, fades the studio in |
| `onboarding.tsx` | The window: backdrop, slides, footer, transitions, auto-advance; the welcome and setup slides |
| `studio-slides.tsx` | Slide 2 (bento, with the Claude key) and slide 3 (the tile walk) |
| `feature-cards.tsx` | The live demo cards, built from the studio's own components and catalogues |
| `use-setup-tools.ts` | Tool status and the streamed ffmpeg install (`/api/setup/tools`, `/api/setup/ffmpeg`) |
| `onboarding-store.ts` | Whether onboarding is done (`/api/onboarding`) |
| `brand-marks.tsx` | Claude, X, Chromium and FFmpeg marks; the dock-style app icon tile |

## Decided (from the prototype, November 2026)

Explored at `/proto/onboarding` with three directions for the showcase, then iterated; the prototype is deleted.

- **Four slides:** welcome (the intro), the studio with Claude (bento), your media (tile walk), setup (Chromium and
  ffmpeg). No "point vaunt at your app" slide: the projects page already does that.
- **Layout:** Raycast's. Copy in the left column anchored from the top (`pt-[34vh]`), so the badge and the title's
  first line sit at the same height on every slide; visual on the right. The welcome slide is one centred column:
  the logo and its copy are measured and centred as a group, lifted 2.5% above centre.
- **Backdrop:** a dithered canvas glow (Gaussian falloff, triangular dither, drawn once at device resolution) under
  SVG grain. Glow 1.3× of a 7.5% white peak, ellipse 78% × 48%, centred at 50%; grain 40% opacity, 400 px tile,
  overlay blend. A CSS radial gradient banded into rings at this brightness; SVG gradients are no better.
- **Welcome:** the startup particle reveal in place of a panel, started 2.2 s in (skipping its dark lead-in) at 1.2×.
  Title with the catalogue's Soft Blur at 2.8 s, the line with Focus Blur Resolve at 3.4 s. Moves on by itself 4 s
  after the copy lands, shown as white filling the active step; any click or key cancels it.
- **Tile walk:** tilt 30°, turn 0°, a 20% eased fade on the left, depth of field from four backdrop-blur layers at
  0.75× (1 / 2.5 / 5 px toward the far edge, 1.2 px near). Hover eases the drift to a stop (time constant 0.24 s)
  instead of freezing it. Off-screen cards pause.
- **Slide transitions:** the outgoing slide stays mounted (same instance) for 380 ms. Its copy leaves in 220 ms
  (ease-in, up 10 px, blur 6 px, 20 ms stagger); the new copy arrives 150 ms in (560 ms, strong ease-out, up from
  14 px, blur 6 px, 50 ms stagger), both along the direction of travel. The visual side only fades.
- **Greens:** the border beam's success green (`#4ade80`) for success on the AI and setup cards and the copy chip.
- **Finish:** the onboarding fades out (280 ms), the desktop window grows to 1920 × 1080 centred on its screen if the
  screen's usable area fits it (460 ms, in-out), then the studio fades in (560 ms, from 8 px below and 2 px blur).
- **Window chrome:** no visible title bar on macOS; the content runs under the window buttons, a 28 px strip drags
  the window, and studio pages leave `--titlebar-inset` of room.

## Rejected

- **Turntable** (one card at a time on a 3D carousel, turning with the stage's in-out curve): each card landed well,
  but most people would see one or two features before moving on.
- **One showcase slide picked from three directions:** bento and tile walk both earned a slide, with different
  themes (directing with AI; bringing your own media).
- **A panel around the intro** on the welcome slide: read as a video player; the logo forms on the backdrop instead.
- **The CSS animation for the walk's drift:** pausing on hover froze it mid-step; a JS velocity that eases to zero
  reads as the camera settling.
- **The theme's success token** for the copy chip: its teal clashed with the beam's green on the same slide.
- **HTML-in-canvas for depth of field:** Chromium-only and experimental; the window renders with WebKit.
- **A "point vaunt at your app" slide** with a live reachability check: duplicated project creation.
