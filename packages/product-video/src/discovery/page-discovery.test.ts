import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { discoverPages, projectPages } from "./page-discovery";

const html = (title: string, body: string) =>
  `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;
const NAV = `<nav><a href="/projects">Projects</a><a href="/team">Team</a><a href="/logout">Log out</a></nav>`;

/** A small app: a sidebar on every page, deeper links only on the pages it leads to. */
function startApp(): Promise<Server> {
  const pages: Record<string, string> = {
    "/": html("Home", `${NAV}<a href="https://example.com/docs">Docs</a><a href="/report.pdf">Report</a>`),
    "/projects": html("Projects", `${NAV}<main><a href="/projects/new?from=list">New project</a></main>`),
    "/team": html("Team", `${NAV}<main><a href="/team/invite">Invite</a></main>`),
    "/plain": html("Plain", `<div class="menu"><a href="/projects">Projects</a></div>`),
  };
  const server = createServer((request, response) => {
    const page = pages[new URL(request.url ?? "/", "http://app.local").pathname];
    response.writeHead(page ? 200 : 404, { "content-type": "text/html" }).end(page ?? "Not found");
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

describe("discoverPages", { timeout: 60_000 }, () => {
  let server: Server;
  let baseUrl: string;
  beforeAll(async () => {
    server = await startApp();
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it("follows the navigation, lists its pages first and skips sign-out, files and other sites", async () => {
    const pages = await discoverPages({ baseUrl, login: null });
    expect(pages.slice(0, 2)).toEqual([
      { path: "/projects", label: "Projects", title: "Projects", inNav: true },
      { path: "/team", label: "Team", title: "Team", inNav: true },
    ]);
    expect(pages.map((page) => page.path).sort()).toEqual(
      ["/", "/projects", "/projects/new", "/team", "/team/invite"].sort()
    );
    expect(pages.find((page) => page.path === "/projects/new")).toMatchObject({
      label: "New project",
      inNav: false,
    });
  });

  it("follows the first page's links when the app's menu isn't marked up as navigation", async () => {
    const pages = await discoverPages({ baseUrl, login: null, startPath: "/plain" });
    expect(pages.find((page) => page.path === "/projects")).toMatchObject({ title: "Projects", inNav: true });
    expect(pages.map((page) => page.path)).toContain("/projects/new");
  });

  it("refuses an app that isn't on this machine", async () => {
    await expect(discoverPages({ baseUrl: "https://example.com", login: null })).rejects.toThrow(/Refusing/);
  });
});

describe("projectPages", () => {
  const page = { path: "/a", label: "A", title: "A", inNav: true };

  it("reuses a recent crawl, and crawls again once it is old or the address changes", async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), "pages-"));
    try {
      let clock = Date.parse("2026-11-23T10:00:00Z");
      const discover = vi.fn(async () => [page]);
      const ask = (baseUrl = "http://localhost:3000") =>
        projectPages({ projectDir, baseUrl, login: null, now: () => clock, discover, maxAgeMs: 60_000 });
      expect(await ask()).toEqual([page]);
      expect(await ask()).toEqual([page]);
      expect(discover).toHaveBeenCalledTimes(1);
      clock += 61_000;
      await ask();
      expect(discover).toHaveBeenCalledTimes(2);
      await ask("http://localhost:4000");
      expect(discover).toHaveBeenCalledTimes(3);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it("shares one crawl between callers asking at the same time", async () => {
    const projectDir = await mkdtemp(path.join(tmpdir(), "pages-"));
    try {
      const discover = vi.fn(async () => [page]);
      const ask = () => projectPages({ projectDir, baseUrl: "http://localhost:3000", login: null, discover });
      await Promise.all([ask(), ask()]);
      expect(discover).toHaveBeenCalledTimes(1);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  });
});
