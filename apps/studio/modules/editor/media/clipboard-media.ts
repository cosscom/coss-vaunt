import { mediaTypeOf } from "@calcom/product-video/imports/media-types";

type TransferItem = { kind: string; type: string; getAsFile: () => File | null };
/** The parts of a `DataTransfer` read here, so tests can pass a plain object. */
export type MediaTransfer = { files: ArrayLike<File>; items?: ArrayLike<TransferItem> };

/** Chrome names a pasted screenshot `image.png`; Safari may leave it unnamed. */
const GENERIC_PASTE_NAME = /^(image)?(\.\w+)?$/i;

/** Video or an image: what becomes a video-track clip. */
export function isMediaFile(file: File): boolean {
  const kind = mediaTypeOf(file.name, file.type)?.kind;
  return kind === "video" || kind === "image";
}

export function isAudioFile(file: File): boolean {
  return mediaTypeOf(file.name, file.type)?.kind === "audio";
}

/** A readable, unique name for a pasted blob: `pasted-2026-11-17T16-30-55.png`. */
export function pastedFileName(type: string, now: number, index: number): string {
  const extension = mediaTypeOf("", type)?.extension ?? ".png";
  const stamp = new Date(now).toISOString().slice(0, 19).replaceAll(":", "-");
  return `pasted-${stamp}${index > 0 ? `-${index + 1}` : ""}${extension}`;
}

function filesOf(transfer: MediaTransfer): File[] {
  const files = Array.from(transfer.files);
  if (files.length > 0) return files;
  return Array.from(transfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

/** Media from a paste: pasted files, or image blobs (screenshots), given a name when they have none. */
export function mediaFilesFromClipboard(
  source: ClipboardEvent | DataTransfer | MediaTransfer,
  now = Date.now()
): File[] {
  const transfer = "clipboardData" in source ? source.clipboardData : source;
  if (!transfer) return [];
  return filesOf(transfer)
    .filter(isMediaFile)
    .map((file, index) =>
      file.type.startsWith("image/") && GENERIC_PASTE_NAME.test(file.name)
        ? new File([file], pastedFileName(file.type, now, index), { type: file.type, lastModified: now })
        : file
    );
}

/** Media from a drop; dropped files keep their names. */
export function mediaFilesFromDrop(dataTransfer: DataTransfer | MediaTransfer): File[] {
  return filesOf(dataTransfer).filter(isMediaFile);
}

/** Audio from a drop, for an audio track; video and images are left to the video tracks. */
export function audioFilesFromDrop(dataTransfer: DataTransfer | MediaTransfer): File[] {
  return filesOf(dataTransfer).filter(isAudioFile);
}
