import path from "node:path";
import { linkRecordingTake } from "@calcom/product-video/recording/link-recording-take";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type TakeRouteContext = { params: Promise<{ id: string; clipId: string }> };

const SAFE_ID = /^[\w-]+$/;
const CAPTURE_HASH = /^[0-9a-f]{16}$/;

/** Gives a new clip a take another clip recorded. Body: `{ fromClipId, captureHash }`. */
export async function POST(request: Request, { params }: TakeRouteContext): Promise<Response> {
  const { id, clipId } = await params;
  const project = await studioProjectStore.get(id);
  if (!project || !SAFE_ID.test(clipId)) return Response.json({ error: "Clip not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const fromClipId =
    body && typeof body === "object" && "fromClipId" in body && typeof body.fromClipId === "string"
      ? body.fromClipId
      : "";
  const captureHash =
    body && typeof body === "object" && "captureHash" in body && typeof body.captureHash === "string"
      ? body.captureHash
      : "";
  if (!SAFE_ID.test(fromClipId) || !CAPTURE_HASH.test(captureHash))
    return Response.json({ error: "Invalid take" }, { status: 400 });

  const linked = await linkRecordingTake({
    projectDir: path.join(STUDIO_ROOT, project.id),
    fromClipId,
    toClipId: clipId,
    captureHash,
  });
  if (!linked) return Response.json({ error: "Take not found" }, { status: 404 });
  return Response.json({ ok: true });
}
