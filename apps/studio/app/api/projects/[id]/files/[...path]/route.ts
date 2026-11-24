import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { isProjectId } from "@coss/vaunt-engine/project-store/file-project-store";
import { ensureRecordingTake } from "@coss/vaunt-engine/recording/link-recording-take";
import { RECORDING_MANIFEST_FILE } from "@coss/vaunt-engine/recording/recording-manifest";
import { parseByteRange } from "@/modules/editor/player/byte-range";
import { STUDIO_ROOT } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".json": "application/json",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

type FileRouteContext = { params: Promise<{ id: string; path: string[] }> };

function resolveProjectFile(id: string, segments: string[]): string | null {
  if (!isProjectId(id)) return null;
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === ".." || /[\\/\0]/.test(segment)
    )
  ) {
    return null;
  }
  const projectDir = path.join(STUDIO_ROOT, id);
  const file = path.resolve(projectDir, ...segments);
  return file.startsWith(`${projectDir}${path.sep}`) ? file : null;
}

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Serves a file from the project folder, with byte ranges so video can seek. A folder answers with its
 * entries, newest first, so the stage can find a clip's latest recording.
 */
export async function GET(request: Request, { params }: FileRouteContext): Promise<Response> {
  const { id, path: segments } = await params;
  const file = resolveProjectFile(id, segments);
  if (!file) return notFound();
  const [folder, clipId, captureHash, name] = segments;
  if (folder === "recordings" && name === RECORDING_MANIFEST_FILE && clipId && captureHash) {
    await ensureRecordingTake({ projectDir: path.join(STUDIO_ROOT, id), clipId, captureHash });
  }
  const info = await stat(file).catch(() => null);
  if (!info) return notFound();

  if (info.isDirectory()) {
    const entries = await readdir(file, { withFileTypes: true });
    const listed = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith("."))
        .map(async (entry) => ({
          name: entry.name,
          directory: entry.isDirectory(),
          modifiedAt: (await stat(path.join(file, entry.name))).mtimeMs,
        }))
    );
    listed.sort((a, b) => b.modifiedAt - a.modifiedAt);
    return Response.json({ entries: listed }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!info.isFile()) return notFound();

  const extension = path.extname(file).toLowerCase();
  const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": extension === ".json" ? "no-store" : "no-cache",
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
  });
  // `?download` saves the file (an export) instead of playing it in the tab.
  if (new URL(request.url).searchParams.has("download")) {
    headers.set("Content-Disposition", `attachment; filename="${path.basename(file).replace(/"/g, "")}"`);
  }
  if (extension !== ".json" && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  const range = parseByteRange(request.headers.get("range"), info.size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }
  const { start, end } = range ?? { start: 0, end: info.size - 1 };
  headers.set("Content-Length", String(Math.max(0, end - start + 1)));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  if (info.size === 0) return new Response(null, { status: 200, headers });

  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status: range ? 206 : 200, headers });
}
