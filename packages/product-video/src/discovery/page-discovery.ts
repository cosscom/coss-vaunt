import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { z } from "zod";
import type { AppLogin } from "../project-store/project-store";
import { signIn } from "../recording/app-sign-in";
import { RECORDING_VIEWPORT } from "../recording/capture-hash";
import { assertAllowedRecordingHost } from "../recording/host-allowlist";
import { pageRuntimeScript } from "../recording/record-clip";

const DISCOVERED_PAGES_FILE = "discovered-pages.json";
/** Pages visited for their links beyond the first; the app's navigation usually reaches everything that matters. */
const MAX_VISITS = 6;
const MAX_PAGES = 40;
const IDLE_MS = 3_000;
/** Pages found less than this long ago are reused rather than crawled again. */
export const DISCOVERY_MAX_AGE_MS = 30 * 60_000;
const SKIPPED_PATH = /(^|\/)(api|_next|static|assets)(\/|$)|(log|sign)[-_]?out|\.[a-z0-9]{2,4}$/i;

export const discoveredPageSchema = z.object({
  path: z.string(),
  /** The link's text where the app links to it. */
  label: z.string(),
  /** The page's own title, for pages the crawl opened. */
  title: z.string(),
  /** Linked from the app's navigation: a sidebar, header or nav. */
  inNav: z.boolean(),
});
export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;

const discoveryFileSchema = z.object({
  baseUrl: z.string(),
  discoveredAt: z.iso.datetime(),
  pages: z.array(discoveredPageSchema),
});

type FoundLink = { path: string; label: string; inNav: boolean };

async function linksOn(page: Page): Promise<{ path: string; title: string; links: FoundLink[] }> {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).flatMap((anchor) => {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return [];
      const label = (anchor.getAttribute("aria-label") || anchor.innerText || anchor.title || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      const inNav = anchor.closest('nav, header, aside, [role=navigation], [class*="sidebar" i]') !== null;
      return [{ path: url.pathname, label, inNav }];
    });
    return { path: location.pathname, title: document.title.trim().slice(0, 80), links };
  });
}

/** Folds what a page links to into `pages`, keeping each path's first label and whether any nav links to it. */
function addLinks(pages: Map<string, DiscoveredPage>, links: readonly FoundLink[]): void {
  for (const link of links) {
    if (SKIPPED_PATH.test(link.path)) continue;
    const known = pages.get(link.path);
    if (known) {
      known.inNav ||= link.inNav;
      known.label ||= link.label;
    } else pages.set(link.path, { path: link.path, label: link.label, title: "", inNav: link.inNav });
  }
}

/**
 * The app's pages, for planning scenes: signs in, opens `startPath`, and follows the navigation links a few pages
 * deep. Navigation pages come first. Writes are faked as they are while recording.
 */
export async function discoverPages({
  baseUrl,
  login,
  startPath = "/",
}: {
  baseUrl: string;
  login: AppLogin | null;
  startPath?: string;
}): Promise<DiscoveredPage[]> {
  assertAllowedRecordingHost(baseUrl);
  const origin = new URL(baseUrl).origin;
  const browser = await chromium.launch();
  try {
    const storageState = await signIn({ browser, baseUrl, startPath, login });
    const context = await browser.newContext({ storageState, viewport: RECORDING_VIEWPORT });
    await context.addInitScript({ content: pageRuntimeScript() });
    const page = await context.newPage();
    const pages = new Map<string, DiscoveredPage>();
    const visited = new Set<string>();
    const visit = async (pathname: string) => {
      visited.add(pathname);
      const response = await page
        .goto(new URL(pathname, origin).toString(), { waitUntil: "load", timeout: 60_000 })
        .catch(() => null);
      if (!response || response.status() >= 400 || new URL(page.url()).origin !== origin) return;
      await page.waitForLoadState("networkidle", { timeout: IDLE_MS }).catch(() => undefined);
      const found = await linksOn(page);
      visited.add(found.path);
      addLinks(pages, [{ path: found.path, label: "", inNav: false }, ...found.links]);
      const self = pages.get(found.path);
      if (self) self.title = found.title;
    };
    await visit(startPath);
    // The navigation's pages first; an app whose menu isn't marked up as one gets its first page's links instead.
    const firstPage = new Set(pages.keys());
    for (let visits = 0; visits < MAX_VISITS; visits++) {
      const unvisited = [...pages.values()].filter((candidate) => !visited.has(candidate.path));
      const next =
        unvisited.find((candidate) => candidate.inNav) ??
        unvisited.find((candidate) => firstPage.has(candidate.path));
      if (!next) break;
      await visit(next.path);
    }
    return [...pages.values()].sort((a, b) => Number(b.inNav) - Number(a.inNav)).slice(0, MAX_PAGES);
  } finally {
    await browser.close();
  }
}

export async function readDiscoveredPages(
  projectDir: string,
  baseUrl: string
): Promise<{ pages: DiscoveredPage[]; discoveredAt: Date } | null> {
  try {
    const saved = discoveryFileSchema.parse(
      JSON.parse(await readFile(path.join(projectDir, DISCOVERED_PAGES_FILE), "utf8"))
    );
    if (saved.baseUrl !== baseUrl) return null;
    return { pages: saved.pages, discoveredAt: new Date(saved.discoveredAt) };
  } catch {
    return null;
  }
}

async function writeDiscoveredPages(
  projectDir: string,
  saved: { baseUrl: string; discoveredAt: string; pages: DiscoveredPage[] }
): Promise<void> {
  const file = path.join(projectDir, DISCOVERED_PAGES_FILE);
  await mkdir(projectDir, { recursive: true });
  const partial = `${file}.${process.pid}.tmp`;
  await writeFile(partial, `${JSON.stringify(saved, null, 2)}\n`);
  await rename(partial, file);
}

/** One crawl per project at a time; lives on globalThis so a dev-server module reload doesn't start a second. */
const registry = globalThis as { __studioPageDiscovery?: Map<string, Promise<DiscoveredPage[]>> };
registry.__studioPageDiscovery ??= new Map();
const running: Map<string, Promise<DiscoveredPage[]>> = registry.__studioPageDiscovery;

/** The project's discovered pages, crawled again when they're older than `maxAgeMs` or for another address. */
export async function projectPages({
  projectDir,
  baseUrl,
  login,
  maxAgeMs = DISCOVERY_MAX_AGE_MS,
  now = () => Date.now(),
  discover = discoverPages,
}: {
  projectDir: string;
  baseUrl: string;
  login: AppLogin | null;
  maxAgeMs?: number;
  now?: () => number;
  discover?: typeof discoverPages;
}): Promise<DiscoveredPage[]> {
  const saved = await readDiscoveredPages(projectDir, baseUrl);
  if (saved && now() - saved.discoveredAt.getTime() < maxAgeMs) return saved.pages;
  const inFlight = running.get(projectDir);
  if (inFlight) return inFlight;
  const crawl = discover({ baseUrl, login })
    .then(async (pages) => {
      await writeDiscoveredPages(projectDir, { baseUrl, discoveredAt: new Date(now()).toISOString(), pages });
      return pages;
    })
    .finally(() => running.delete(projectDir));
  running.set(projectDir, crawl);
  return crawl;
}
