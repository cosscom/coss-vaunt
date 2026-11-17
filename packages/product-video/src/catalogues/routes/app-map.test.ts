import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_MAP, appMapLines } from "./app-map";
import { isAppPath } from "./route-catalogue";

const web = path.resolve(import.meta.dirname, "../../../../../apps/web");
const navigation = [
  readFileSync(path.join(web, "modules/shell/navigation/Navigation.tsx"), "utf8"),
  readFileSync(path.join(web, "modules/shell/useBottomNavItems.ts"), "utf8"),
].join("\n");
const pageDirs = [
  "app/(use-page-wrapper)/(main-nav)",
  "app/(use-page-wrapper)",
  "app/(use-page-wrapper)/settings/(settings-layout)",
];

/** Whether `segments` resolve under `dir`, where a `[param]` folder matches any segment. */
function resolves(dir: string, segments: string[]): boolean {
  if (segments.length === 0) return true;
  if (!existsSync(dir)) return false;
  const [first, ...rest] = segments;
  const names = readdirSync(dir);
  return names.some(
    (name) => (name === first || /^\[[^.]+\]$/.test(name)) && resolves(path.join(dir, name), rest)
  );
}

describe("APP_MAP", () => {
  it("links only to pages the app's navigation has", () => {
    for (const page of APP_MAP) expect(navigation, page.path).toContain(`href: "${page.path}"`);
  });

  it("names subpages that exist as routes", () => {
    for (const sub of APP_MAP.flatMap((page) => page.subpages)) {
      expect(isAppPath(sub.path)).toBe(true);
      const segments = sub.path.split("/").filter(Boolean);
      const found = pageDirs.some(
        (dir) => resolves(path.join(web, dir), segments) || resolves(path.join(web, dir), segments.slice(1))
      );
      expect(found, sub.path).toBe(true);
    }
  });

  it("formats compactly", () => {
    expect(appMapLines()).toContain("- Bookings /bookings/upcoming (sidebar):");
    expect(appMapLines()).toContain("    - /settings/my-account/profile:");
  });
});
