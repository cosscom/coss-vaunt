import path from "node:path";
import {
  importYoutubeVideo,
  parseYoutubeVideoId,
  YoutubeImportError,
} from "@calcom/product-video/imports/youtube-import";
import type { YoutubeImportEvent } from "@/modules/editor/imports/youtube-import-events";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type ImportRouteContext = { params: Promise<{ id: string }> };

/** Streams the import as newline-delimited JSON events: progress, then `done` with the clip or `error`. */
export async function POST(request: Request, { params }: ImportRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return new Response("Not found", { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const input =
    body && typeof body === "object" && "input" in body && typeof body.input === "string" ? body.input : "";
  const videoId = parseYoutubeVideoId(input);
  if (!videoId) return Response.json({ error: "Enter a YouTube video id or URL" }, { status: 400 });

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
    async start(controller) {
      const send = (event: YoutubeImportEvent) => {
        if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const clip = await importYoutubeVideo({
          projectDir: path.join(STUDIO_ROOT, project.id),
          videoId,
          signal: request.signal,
          onProgress: (progress) => send({ type: "progress", progress }),
        });
        send({ type: "done", clip });
      } catch (error) {
        send({
          type: "error",
          message: error instanceof YoutubeImportError ? error.message : "The import failed",
        });
      } finally {
        if (!cancelled) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
