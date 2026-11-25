import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runFile = promisify(execFile);

let encoders: Promise<string> | undefined;

/** Whether `ffmpeg` on the PATH has the encoder, e.g. `libx264`; ffmpeg's encoder list is read once per process. */
export async function ffmpegHasEncoder(name: string): Promise<boolean> {
  encoders ??= runFile("ffmpeg", ["-hide_banner", "-encoders"]).then(
    ({ stdout }) => stdout,
    () => ""
  );
  return new RegExp(`^\\s*\\S+\\s+${name}\\s`, "m").test(await encoders);
}
