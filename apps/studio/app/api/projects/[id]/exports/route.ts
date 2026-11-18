import path from "node:path";
import type { ExportEvent } from "@calcom/product-video/export/export-events";
import { cancelExportJob, followExportJob, startExportJob } from "@calcom/product-video/export/export-jobs";
import { exportFileName, exportSettingsSchema } from "@calcom/product-video/export/export-settings";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type ExportsRouteContext = { params: Promise<{ id: string }> };

/** Starts exporting the saved project in a child process; follow it with GET. Body: export settings. */
export async function POST(request: Request, { params }: ExportsRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  const parsed = exportSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid export settings" }, { status: 400 });
  const name = exportFileName(project, parsed.data, new Date());
  const { started } = startExportJob({
    repoRoot: path.dirname(STUDIO_ROOT),
    studioRoot: STUDIO_ROOT,
    // The exporter's headless browser loads this studio's render page.
    studioUrl: new URL(request.url).origin,
    projectId: project.id,
    settings: parsed.data,
    name,
  });
  return Response.json({ started, name }, { status: started ? 202 : 409 });
}

/**
 * Server-sent events: the project's export until `done` or `error` (replayed when it has already finished, so a
 * dropped connection still learns the result), or one `idle` event when the project has never exported.
 */
export async function GET(_request: Request, { params }: ExportsRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: ExportEvent | { type: "idle" }) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.type === "done" || event.type === "error" || event.type === "idle") {
          closed = true;
          controller.close();
        }
      };
      unsubscribe = followExportJob(project.id, send);
      if (!unsubscribe) send({ type: "idle" });
    },
    cancel() {
      unsubscribe?.();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" },
  });
}

/** Cancels the project's running export. */
export async function DELETE(_request: Request, { params }: ExportsRouteContext): Promise<Response> {
  const { id } = await params;
  return Response.json({ cancelled: cancelExportJob(id) });
}
