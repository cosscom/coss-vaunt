import path from "node:path";
import { importUploadedAudio } from "@calcom/product-video/imports/audio-upload";
import { mediaTypeOf } from "@calcom/product-video/imports/media-types";
import { importUploadedMedia, MediaUploadError } from "@calcom/product-video/imports/media-upload";
import { MEDIA_UPLOAD_NAME_HEADER } from "@/modules/editor/media/media-upload-request";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type UploadRouteContext = { params: Promise<{ id: string }> };

const STATUS: Record<MediaUploadError["code"], number> = {
  "unsupported-type": 415,
  "too-large": 413,
  empty: 422,
  unreadable: 422,
  "convert-failed": 500,
};

function decodeName(header: string | null): string | null {
  if (!header) return null;
  try {
    return decodeURIComponent(header);
  } catch {
    return null;
  }
}

/**
 * The raw file as the body (streamed to disk, never buffered), its MIME type as `Content-Type` and its
 * URI-encoded name in `X-File-Name`. Answers `{ clip, conversion }`, `{ audioClip, conversion }` for audio,
 * or `{ error }`.
 */
export async function POST(request: Request, { params }: UploadRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return new Response("Not found", { status: 404 });

  const name = decodeName(request.headers.get(MEDIA_UPLOAD_NAME_HEADER));
  if (!name || !request.body) return Response.json({ error: "Send a file with its name" }, { status: 400 });
  const length = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  const mime = request.headers.get("content-type") ?? "";
  const importUpload = mediaTypeOf(name, mime)?.kind === "audio" ? importUploadedAudio : importUploadedMedia;

  try {
    const result = await importUpload({
      projectDir: path.join(STUDIO_ROOT, project.id),
      name,
      mime,
      body: request.body,
      declaredBytes: Number.isFinite(length) ? length : undefined,
      signal: request.signal,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return Response.json({ error: error.message }, { status: STATUS[error.code] });
    }
    return Response.json({ error: "The upload failed" }, { status: 500 });
  }
}
