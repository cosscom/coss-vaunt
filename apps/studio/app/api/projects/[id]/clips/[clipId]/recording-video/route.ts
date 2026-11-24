import path from "node:path";
import { recordingDirectory } from "@coss/vaunt-engine/recording/recording-manifest";
import { ensureRecordingVideo } from "@coss/vaunt-engine/recording/recording-video";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type RecordingVideoRouteContext = { params: Promise<{ id: string; clipId: string }> };

const SAFE_ID = /^[\w-]+$/;
const CAPTURE_HASH = /^[0-9a-f]{16}$/;

/** Makes a recording's playback video if it has none. Body: `{ captureHash }`; returns `{ manifest }`. */
export async function POST(request: Request, { params }: RecordingVideoRouteContext): Promise<Response> {
  const { id, clipId } = await params;
  const project = await studioProjectStore.get(id);
  if (!project || !SAFE_ID.test(clipId))
    return Response.json({ error: "Recording not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const captureHash =
    body && typeof body === "object" && "captureHash" in body && typeof body.captureHash === "string"
      ? body.captureHash
      : "";
  if (!CAPTURE_HASH.test(captureHash))
    return Response.json({ error: "Invalid capture hash" }, { status: 400 });

  const manifest = await ensureRecordingVideo(
    path.join(STUDIO_ROOT, project.id, recordingDirectory(clipId, captureHash))
  );
  if (!manifest) return Response.json({ error: "Recording not found" }, { status: 404 });
  return Response.json({ manifest });
}
