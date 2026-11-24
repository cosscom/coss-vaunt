import path from "node:path";
import type { RecordingEvent, RecordingStreamEvent } from "@coss/vaunt-engine/recording/recording-events";
import {
  followRecordingJob,
  isRecordingJobRunning,
  recordingJobKey,
  startRecordingJob,
} from "@coss/vaunt-engine/recording/recording-jobs";
import { findClip, recordingStatus } from "@coss/vaunt-engine/recording/recording-status";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type RecordRouteContext = { params: Promise<{ id: string; clipId: string }> };

function parseTheme(value: unknown): "light" | "dark" | null {
  return value === "light" || value === "dark" ? value : null;
}

async function loadRecordingClip(id: string, clipId: string) {
  const project = await studioProjectStore.get(id);
  const clip = project && findClip(project, clipId);
  if (!project || !clip || clip.source.kind !== "recording") return null;
  return { project, clip };
}

/** Starts recording the clip in a child process; follow it with GET. Body: `{ theme?, force? }`. */
export async function POST(request: Request, { params }: RecordRouteContext): Promise<Response> {
  const { id, clipId } = await params;
  const loaded = await loadRecordingClip(id, clipId);
  if (!loaded) return Response.json({ error: "Recording clip not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => ({}));
  const fields = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const theme = parseTheme(fields.theme) ?? loaded.project.settings.theme;
  const { started } = startRecordingJob({
    repoRoot: path.dirname(STUDIO_ROOT),
    studioRoot: STUDIO_ROOT,
    projectId: loaded.project.id,
    clipId,
    theme,
    force: fields.force === true,
  });
  return Response.json({ started, theme }, { status: started ? 202 : 409 });
}

/**
 * Server-sent events: a running recording's progress until `done` or `error`, or one `status` event saying
 * whether the clip's current capture is already recorded. `?theme=light|dark` defaults to the project's.
 */
export async function GET(request: Request, { params }: RecordRouteContext): Promise<Response> {
  const { id, clipId } = await params;
  const loaded = await loadRecordingClip(id, clipId);
  if (!loaded) return Response.json({ error: "Recording clip not found" }, { status: 404 });
  const theme = parseTheme(new URL(request.url).searchParams.get("theme")) ?? loaded.project.settings.theme;
  const key = recordingJobKey({ projectId: loaded.project.id, clipId, theme });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: RecordingStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.type === "done" || event.type === "error" || event.type === "status") {
          closed = true;
          controller.close();
        }
      };
      if (isRecordingJobRunning(key)) {
        unsubscribe = followRecordingJob(key, (event: RecordingEvent) => send(event));
        return;
      }
      try {
        send(
          await recordingStatus({
            project: loaded.project,
            clip: loaded.clip,
            theme,
            projectDir: path.join(STUDIO_ROOT, loaded.project.id),
          })
        );
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : String(error) });
      }
    },
    cancel() {
      unsubscribe?.();
    },
  });
  request.signal.addEventListener("abort", () => unsubscribe?.());

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" },
  });
}
