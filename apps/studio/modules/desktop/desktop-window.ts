"use client";

/**
 * The desktop window (packages/vaunt-window), when the studio runs inside it. Tauri injects its IPC bridge into the
 * page; the window grants loopback pages a few window commands (see capabilities/window.json). In a browser there's
 * no bridge and everything here is a no-op.
 */
type TauriInternals = {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
  metadata: { currentWindow: { label: string } };
};

type PhysicalRect = { position: { x: number; y: number }; size: { width: number; height: number } };
type Monitor = PhysicalRect & { scaleFactor: number; workArea?: PhysicalRect };

function tauri(): TauriInternals | null {
  return (globalThis as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__ ?? null;
}

export function isDesktopWindow(): boolean {
  return tauri() !== null;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/**
 * Grows the window to `width` × `height` points, centred on its screen's usable area, if that screen has room and
 * the window is smaller. It animates there (on-screen movement, so an in-out curve), unless the user prefers reduced
 * motion. Resolves to whether it resized.
 */
export async function growWindowTo(width: number, height: number, durationMs = 460): Promise<boolean> {
  const bridge = tauri();
  if (!bridge) return false;
  const label = bridge.metadata.currentWindow.label;
  const call = <T>(command: string, args: Record<string, unknown> = {}) =>
    bridge.invoke<T>(`plugin:window|${command}`, { label, ...args });
  try {
    const [scale, size, position, monitor] = await Promise.all([
      call<number>("scale_factor"),
      call<{ width: number; height: number }>("inner_size"),
      call<{ x: number; y: number }>("outer_position"),
      call<Monitor | null>("current_monitor"),
    ]);
    if (!monitor) return false;
    const area = monitor.workArea ?? monitor;
    const areaWidth = area.size.width / scale;
    const areaHeight = area.size.height / scale;
    const from = {
      x: position.x / scale,
      y: position.y / scale,
      width: size.width / scale,
      height: size.height / scale,
    };
    if (areaWidth < width || areaHeight < height) return false;
    if (from.width >= width && from.height >= height) return false;
    const to = {
      x: area.position.x / scale + (areaWidth - width) / 2,
      y: area.position.y / scale + (areaHeight - height) / 2,
      width,
      height,
    };
    const apply = (frame: typeof to) =>
      Promise.all([
        call("set_size", {
          value: { Logical: { width: Math.round(frame.width), height: Math.round(frame.height) } },
        }),
        call("set_position", { value: { Logical: { x: Math.round(frame.x), y: Math.round(frame.y) } } }),
      ]);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await apply(to);
      return true;
    }
    const start = await nextFrame();
    for (let now = start; now - start < durationMs; now = await nextFrame()) {
      const t = ease((now - start) / durationMs);
      await apply({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        width: from.width + (to.width - from.width) * t,
        height: from.height + (to.height - from.height) * t,
      });
    }
    await apply(to);
    return true;
  } catch {
    // An older window binary without these permissions, or a monitor that went away: stay as we are.
    return false;
  }
}

/**
 * Whether the window can show glass: the desktop window on macOS marks `<html data-vaunt-glass>` before the page
 * loads (an older window binary doesn't, and a browser never does).
 */
export function canUseGlass(): boolean {
  return tauri() !== null && document.documentElement.dataset.vauntGlass !== undefined;
}

/** Turns the window's macOS vibrancy on or off behind the page's transparent areas. Resolves to whether it applied. */
export async function setWindowGlass(enabled: boolean): Promise<boolean> {
  const bridge = tauri();
  if (!bridge) return false;
  try {
    await bridge.invoke("set_glass", { enabled });
    return true;
  } catch {
    return false;
  }
}
