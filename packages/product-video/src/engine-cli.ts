import path from "node:path";

/** Also the bundle's entry points, built to `<basename>.mjs`. */
export const ENGINE_CLI_SOURCES = {
  record: "src/recording/record-clip-cli.ts",
  export: "src/export/export-video-cli.ts",
  generate: "src/ai/generate-board-cli.ts",
} as const;

export type EngineCli = keyof typeof ENGINE_CLI_SOURCES;

/**
 * How to run one of the engine's CLIs: its bundled `.mjs` under Node when `VAUNT_ENGINE_DIR` is set (the published
 * `vaunt` package; see packages/vaunt/scripts/build.ts), else the TypeScript source through the engine's tsx.
 */
export function engineCliCommand(repoRoot: string, cli: EngineCli): { command: string; args: string[] } {
  const bundled = process.env.VAUNT_ENGINE_DIR;
  if (bundled)
    return {
      command: process.execPath,
      args: [path.join(bundled, `${path.basename(ENGINE_CLI_SOURCES[cli], ".ts")}.mjs`)],
    };
  const engineDir = path.join(repoRoot, "packages/product-video");
  return {
    command: path.join(engineDir, "node_modules/.bin/tsx"),
    args: [path.join(engineDir, ENGINE_CLI_SOURCES[cli])],
  };
}
