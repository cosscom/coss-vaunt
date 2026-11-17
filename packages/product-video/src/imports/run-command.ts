import { execFile } from "node:child_process";

/** Runs a binary with an argument array (no shell); rejects with the last stderr line. */
export function runCommand(
  file: string,
  args: string[],
  { timeout, signal, onLine }: { timeout: number; signal?: AbortSignal; onLine?: (line: string) => void }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      { timeout, signal, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new Error(String(stderr).trim().split("\n").pop() || error.message));
        else resolve(String(stdout));
      }
    );
    if (!onLine) return;
    let buffered = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      buffered += chunk.toString("utf8");
      const lines = buffered.split(/\r?\n|\r/);
      buffered = lines.pop() ?? "";
      for (const line of lines) onLine(line);
    });
  });
}
