import { accessSync, constants, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type Env = Record<string, string | undefined>;

/**
 * Where vaunt keeps its own copies of tools such as ffmpeg: `$VAUNT_BIN_DIR`, else `$VAUNT_HOME/bin`, else
 * `~/.vaunt/bin`. `npx vaunt start` sets VAUNT_BIN_DIR for the studio it starts (`<data dir>/bin`).
 */
export function vauntBinDir(env: Env = process.env, home: string = os.homedir()): string {
  if (env.VAUNT_BIN_DIR) return path.resolve(env.VAUNT_BIN_DIR);
  if (env.VAUNT_HOME) return path.resolve(env.VAUNT_HOME, "bin");
  return path.join(home, ".vaunt", "bin");
}

/** The file name of a tool on this platform: `ffmpeg.exe` on Windows. */
export function executableName(name: string, platform: NodeJS.Platform = process.platform): string {
  return platform === "win32" ? `${name}.exe` : name;
}

function isExecutable(file: string): boolean {
  try {
    if (!statSync(file).isFile()) return false;
    if (process.platform !== "win32") accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The tool's copy in vaunt's bin dir, when there is one. */
export function vauntToolCopy(name: string, env: Env = process.env): string | null {
  const file = path.join(vauntBinDir(env), executableName(name));
  return isExecutable(file) ? file : null;
}

/** The first `name` on the PATH, as an absolute path, or null. */
export function findOnPath(name: string, env: Env = process.env): string | null {
  const dirs = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean);
  const names =
    process.platform === "win32"
      ? (env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").map((ext) => `${name}${ext.toLowerCase()}`)
      : [name];
  for (const dir of dirs)
    for (const candidate of names) {
      const file = path.resolve(dir, candidate);
      if (isExecutable(file)) return file;
    }
  return null;
}

/**
 * What to run for `ffmpeg` / `ffprobe`: vaunt's own copy when it has installed one, else the bare name for the PATH.
 * Resolved on every call, so a copy installed while the studio runs is used straight away.
 */
export function vauntTool(name: "ffmpeg" | "ffprobe"): string {
  return vauntToolCopy(name) ?? name;
}
