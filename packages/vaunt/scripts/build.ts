/**
 * Builds the publishable package into dist/:
 *
 * - dist/studio: the studio's Next.js standalone server without its node_modules (npm drops every node_modules
 *   folder from a published package), so `next`, `react` and the server's other externals resolve from this
 *   package's own dependencies instead. `externals.json` lists the hashed aliases Turbopack requires them by, which
 *   `vaunt start` links up.
 * - dist/engine: the engine's record, export and generate CLIs bundled to plain `.mjs` for Node; the studio runs them
 *   through VAUNT_ENGINE_DIR. Playwright and agent-browser stay external, as they ship browsers and native binaries.
 */
import { cp, mkdir, readdir, readFile, readlink, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { $ } from "bun";
import { ENGINE_CLI_SOURCES } from "../../product-video/src/engine-cli";

const ENGINE_EXTERNALS = ["playwright", "playwright-core", "agent-browser"];
/** Matches next.config.ts under VAUNT_STANDALONE, so a build doesn't touch a running `bun dev`'s `.next`. */
const NEXT_DIST_DIR = ".next-vaunt";

const packageDir = path.resolve(import.meta.dir, "..");
const repoRoot = path.resolve(packageDir, "../..");
const studioDir = path.join(repoRoot, "apps/studio");
const engineDir = path.join(repoRoot, "packages/product-video");
const dist = path.join(packageDir, "dist");

type PackageJson = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const readPackage = async (dir: string): Promise<PackageJson> =>
  JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));

/** Names of the packages directly inside a node_modules folder, scoped ones included. */
async function packageNames(nodeModules: string): Promise<string[]> {
  const entries = await readdir(nodeModules).catch(() => []);
  const names = await Promise.all(
    entries
      .filter((entry) => !entry.startsWith("."))
      .map(async (entry) =>
        entry.startsWith("@")
          ? (await readdir(path.join(nodeModules, entry))).map((scoped) => `${entry}/${scoped}`)
          : [entry]
      )
  );
  return names.flat();
}

/** Every package reachable from this package's dependencies, as installed in the workspace. */
async function dependencyClosure(): Promise<Set<string>> {
  const seen = new Set<string>();
  const visit = async (fromDir: string, deps: PackageJson): Promise<void> => {
    const names = Object.keys({
      ...deps.dependencies,
      ...deps.optionalDependencies,
      ...deps.peerDependencies,
    });
    for (const name of names) {
      if (seen.has(name)) continue;
      let resolved: string;
      try {
        resolved = await realpath(
          path.dirname(createRequire(path.join(fromDir, "package.json")).resolve(`${name}/package.json`))
        );
      } catch {
        continue; // Not installed, like an optional dependency for another platform.
      }
      seen.add(name);
      await visit(resolved, await readPackage(resolved));
    }
  };
  await visit(packageDir, await readPackage(packageDir));
  return seen;
}

/** Fails the build when a dependency's version drifts from the one the studio or engine is built against. */
async function checkPinnedVersions(): Promise<void> {
  const own = (await readPackage(packageDir)).dependencies ?? {};
  for (const workspace of [studioDir, engineDir]) {
    const deps = (await readPackage(workspace)).dependencies ?? {};
    for (const [name, version] of Object.entries(own))
      if (deps[name] && deps[name] !== version)
        throw new Error(
          `${name} is ${version} here but ${deps[name]} in ${path.relative(repoRoot, workspace)}`
        );
  }
}

async function buildStudio(): Promise<void> {
  await rm(path.join(studioDir, NEXT_DIST_DIR), { recursive: true, force: true });
  await $`bun run build`
    .cwd(studioDir)
    .env({ ...process.env, VAUNT_STANDALONE: "1", NEXT_TELEMETRY_DISABLED: "1" });

  const standalone = path.join(studioDir, NEXT_DIST_DIR, "standalone");
  const server = path.join(standalone, "apps/studio");
  const out = path.join(dist, "studio");
  await mkdir(out, { recursive: true });
  await cp(path.join(server, "server.js"), path.join(out, "server.js"));
  await cp(path.join(server, "package.json"), path.join(out, "package.json"));
  await cp(path.join(server, NEXT_DIST_DIR), path.join(out, NEXT_DIST_DIR), {
    recursive: true,
    filter: (source) => path.basename(source) !== "node_modules",
  });
  await cp(path.join(studioDir, NEXT_DIST_DIR, "static"), path.join(out, NEXT_DIST_DIR, "static"), {
    recursive: true,
  });

  // Turbopack requires server externals by hashed names (`playwright-<hash>`) linked from <distDir>/node_modules.
  const aliasDir = path.join(server, NEXT_DIST_DIR, "node_modules");
  const externals: Record<string, string> = {};
  for (const alias of await packageNames(aliasDir)) {
    const target = path.resolve(aliasDir, path.dirname(alias), await readlink(path.join(aliasDir, alias)));
    externals[alias] = (await readPackage(target)).name;
  }
  await writeFile(
    path.join(out, "externals.json"),
    `${JSON.stringify({ dir: path.join(NEXT_DIST_DIR, "node_modules"), aliases: externals }, null, 2)}\n`
  );

  // Everything the traced server needs has to come from this package's dependencies once published.
  const traced = new Set([
    ...(await packageNames(path.join(standalone, "node_modules"))),
    ...(await packageNames(path.join(standalone, "node_modules/.bun/node_modules"))),
    ...Object.values(externals),
  ]);
  const available = await dependencyClosure();
  const missing = [...traced].filter((name) => !available.has(name));
  if (missing.length > 0)
    throw new Error(`The studio server needs packages vaunt doesn't depend on: ${missing.join(", ")}`);
  // The standalone copy includes the studio's sources, tests and all, which the studio's Vitest would pick up.
  await rm(path.join(studioDir, NEXT_DIST_DIR), { recursive: true, force: true });
}

async function buildEngine(): Promise<void> {
  const result = await Bun.build({
    entrypoints: Object.values(ENGINE_CLI_SOURCES).map((source) => path.join(engineDir, source)),
    outdir: path.join(dist, "engine"),
    naming: "[name].mjs",
    target: "node",
    format: "esm",
    external: ENGINE_EXTERNALS,
  });
  if (!result.success) throw new AggregateError(result.logs, "Bundling the engine CLIs failed");
}

await checkPinnedVersions();
await rm(dist, { recursive: true, force: true });
await buildStudio();
await buildEngine();
console.log(`Built ${path.relative(repoRoot, dist)}`);
