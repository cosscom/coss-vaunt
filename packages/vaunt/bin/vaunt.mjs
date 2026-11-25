#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const MIN_NODE_MAJOR = 22;
const DEFAULT_PORT = 3102;
const HOST = "127.0.0.1";
const READY_TIMEOUT_MS = 60_000;

const require = createRequire(import.meta.url);
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const studioDir = path.join(packageDir, "dist/studio");
const engineDir = path.join(packageDir, "dist/engine");
const { version } = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));

const HELP = `coss vaunt ${version}: product videos for web apps, made from the app itself.

Usage
  vaunt start [options]   Start the studio and open it in your browser

Options
  --port <port>       Port for the studio (default ${DEFAULT_PORT}, or the next free one)
  --data <dir>        Where projects, recordings and exports are kept (default ~/.vaunt, or $VAUNT_HOME)
  --app-url <url>     The local app address new projects start with (default http://localhost:3000)
  --no-open           Don't open the browser
  -h, --help          Show this help
  -v, --version       Show the version
`;

function fail(message) {
  console.error(`vaunt: ${message}`);
  process.exit(1);
}

/** Whether nothing listens on the port at `host`; an address the machine lacks (no IPv6) counts as free. */
function portFree(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => resolve(error.code !== "EADDRINUSE"));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

/**
 * The first free port from `start`, trying a handful above it. It has to be free on IPv6 loopback too: the browser
 * may resolve `localhost` to ::1 and reach another server there.
 */
async function freePort(start, { exact }) {
  const tries = exact ? 1 : 20;
  for (let port = start; port < start + tries; port++)
    if ((await portFree(port, HOST)) && (await portFree(port, "::1"))) return port;
  fail(
    exact
      ? `port ${start} is in use; pick another with --port`
      : `no free port between ${start} and ${start + tries - 1}`
  );
}

function hasFfmpeg() {
  return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
}

function ffmpegHint() {
  if (process.platform === "darwin") return "brew install ffmpeg";
  if (process.platform === "win32") return "winget install ffmpeg";
  return "your package manager, e.g. sudo apt install ffmpeg";
}

/** Downloads Playwright's Chromium on first run; the recorder, exporter and AI explorer all drive it. */
function ensureChromium() {
  const { chromium } = require("playwright");
  if (existsSync(chromium.executablePath())) return;
  console.log("Downloading Chromium for recording (first run only)…");
  const cli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
  const result = spawnSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
  if (result.status !== 0) fail("couldn't download Chromium; try `npx playwright install chromium`");
}

/** Links the hashed names the studio server requires its externals by (see scripts/build.ts) to the installed packages. */
function linkExternals() {
  const { dir, aliases } = JSON.parse(readFileSync(path.join(studioDir, "externals.json"), "utf8"));
  for (const [alias, name] of Object.entries(aliases)) {
    const link = path.join(studioDir, dir, alias);
    if (existsSync(link)) continue;
    try {
      // A dangling link from a moved install reads as missing; clear it before relinking.
      if (lstatSync(link, { throwIfNoEntry: false })) rmSync(link, { force: true });
      mkdirSync(path.dirname(link), { recursive: true });
      symlinkSync(path.dirname(require.resolve(`${name}/package.json`)), link, "junction");
    } catch (error) {
      if (error.code === "EEXIST") continue; // Another `vaunt start` linked it first.
      fail(
        `couldn't link ${name} into ${studioDir}: ${error.message}. Run vaunt as the user who installed it.`
      );
    }
  }
}

function openBrowser(url) {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.on("error", () => undefined);
  child.unref();
}

async function waitUntilReady(url, server) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) return false;
    const ok = await fetch(url, { redirect: "manual" }).then(
      () => true,
      () => false
    );
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function start(values) {
  const requested = values.port ? Number(values.port) : null;
  if (requested !== null && !(Number.isInteger(requested) && requested > 0 && requested < 65536))
    fail(`--port must be a port number, not ${values.port}`);
  if (!existsSync(path.join(studioDir, "server.js")))
    fail(`the studio isn't built in ${packageDir}; run \`bun run build\` in packages/vaunt`);

  const dataDir = path.resolve(values.data ?? process.env.VAUNT_HOME ?? path.join(os.homedir(), ".vaunt"));
  const studioRoot = path.join(dataDir, "projects");
  mkdirSync(studioRoot, { recursive: true });

  if (!hasFfmpeg())
    console.warn(
      `Warning: ffmpeg isn't on your PATH. Recording previews and export need it; install it with ${ffmpegHint()}.`
    );
  ensureChromium();
  linkExternals();

  const port = await freePort(requested ?? DEFAULT_PORT, { exact: requested !== null });
  const server = spawn(process.execPath, [path.join(studioDir, "server.js")], {
    cwd: dataDir,
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      HOSTNAME: HOST,
      PORT: String(port),
      VAUNT_LOCAL_ONLY: "1",
      VAUNT_STUDIO_ROOT: studioRoot,
      VAUNT_ENGINE_DIR: engineDir,
      ...(values["app-url"] ? { STUDIO_APP_URL: values["app-url"] } : {}),
    },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
  server.on("exit", (code, signal) => process.exit(code ?? (signal ? 0 : 1)));

  if (!(await waitUntilReady(`http://${HOST}:${port}/`, server))) {
    server.kill();
    fail("the studio didn't start");
  }
  const url = `http://localhost:${port}`;
  console.log(`coss vaunt is running at ${url}\nProjects are kept in ${studioRoot}\nPress Ctrl+C to stop.`);
  if (!values["no-open"]) openBrowser(url);
}

const [major] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE_MAJOR) fail(`needs Node ${MIN_NODE_MAJOR} or newer; this is ${process.version}`);

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string" },
      data: { type: "string" },
      "app-url": { type: "string" },
      "no-open": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
} catch (error) {
  fail(`${error.message}\n\n${HELP}`);
}
const { values, positionals } = parsed;
const [command] = positionals;

if (values.version) console.log(version);
else if (values.help || !command || command === "help") console.log(HELP);
else if (command === "start") await start(values);
else fail(`unknown command ${command}\n\n${HELP}`);
