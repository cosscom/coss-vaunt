import type { AudioConversion } from "@coss/vaunt-engine/imports/audio-upload";
import type { VideoConversion } from "@coss/vaunt-engine/imports/media-upload";
import type { AudioClip, Clip } from "@coss/vaunt-engine/storyboard/storyboard-schema";

export const MEDIA_UPLOAD_NAME_HEADER = "x-file-name";

export type MediaUploadResult =
  | { clip: Clip; conversion: VideoConversion }
  | { audioClip: AudioClip; conversion: AudioConversion };

/** Sends the file as the raw request body, so the server can stream it to disk. */
export async function uploadMediaFile(
  projectId: string,
  file: File,
  signal?: AbortSignal
): Promise<MediaUploadResult> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/imports/upload`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      [MEDIA_UPLOAD_NAME_HEADER]: encodeURIComponent(file.name),
    },
    body: file,
    signal,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : null;
    throw new Error(message ?? `The upload failed (${response.status})`);
  }
  return body as MediaUploadResult;
}
