import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { vauntTool } from "../setup/vaunt-bin";

const runFile = promisify(execFile);

/** Encoder lists by ffmpeg binary, so a copy installed while the process runs gets read afresh. */
const encoders = new Map<string, Promise<string>>();

/** Whether the ffmpeg vaunt uses (its own copy, else the PATH's) has the encoder, e.g. `libx264`. */
export async function ffmpegHasEncoder(name: string): Promise<boolean> {
  const file = vauntTool("ffmpeg");
  let list = encoders.get(file);
  if (!list) {
    list = runFile(file, ["-hide_banner", "-encoders"], { maxBuffer: 8 * 1024 * 1024 }).then(
      ({ stdout }) => stdout,
      () => {
        // Not there (yet): ask again next time rather than remembering the failure.
        encoders.delete(file);
        return "";
      }
    );
    encoders.set(file, list);
  }
  return new RegExp(`^\\s*\\S+\\s+${name}\\s`, "m").test(await list);
}
