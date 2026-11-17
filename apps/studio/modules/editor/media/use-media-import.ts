"use client";

import type { AudioClip, Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import { toastManager } from "@coss/ui/components/toast";
import { useCallback, useRef, useState } from "react";
import { MEDIA_IMPORT_COPY as copy } from "./media-import-copy";
import { type MediaUploadResult, uploadMediaFile } from "./media-upload-request";

const SUCCESS_TIMEOUT_MS = 4000;

export type MediaImport = {
  /** Uploads one at a time and resolves with the clips that imported, in the order given. */
  importFiles: (files: File[]) => Promise<Clip[]>;
  /** The same for audio files, resolving with audio clips. */
  importAudioFiles: (files: File[]) => Promise<AudioClip[]>;
  importing: boolean;
};

function convertedDescription(result: MediaUploadResult): string | undefined {
  if (result.conversion !== "transcode") return undefined;
  return "audioClip" in result ? copy.convertedAudio : copy.converted;
}

export function useMediaImport(projectId: string): MediaImport {
  const [pending, setPending] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const importOne = useCallback(
    async (file: File): Promise<MediaUploadResult | null> => {
      const toastId = toastManager.add({
        type: "loading",
        title: copy.importing(file.name),
        description: file.type === "video/quicktime" ? copy.converting : undefined,
        timeout: 0,
      });
      try {
        const result = await uploadMediaFile(projectId, file);
        toastManager.update(toastId, {
          type: "success",
          title: copy.imported(file.name),
          description: convertedDescription(result),
          timeout: SUCCESS_TIMEOUT_MS,
        });
        return result;
      } catch (error) {
        toastManager.update(toastId, {
          type: "error",
          title: copy.failed(file.name),
          description: error instanceof Error ? error.message : undefined,
          timeout: 0,
        });
        return null;
      }
    },
    [projectId]
  );

  const importAll = useCallback(
    <T>(files: File[], pick: (result: MediaUploadResult) => T | null): Promise<T[]> => {
      if (files.length === 0) return Promise.resolve([]);
      setPending((count) => count + 1);
      // Chained so two quick pastes still upload one file at a time.
      const run = queue.current.then(async () => {
        const clips: T[] = [];
        for (const file of files) {
          const result = await importOne(file);
          const clip = result ? pick(result) : null;
          if (clip) clips.push(clip);
        }
        return clips;
      });
      queue.current = run.catch(() => undefined);
      return run.finally(() => setPending((count) => count - 1));
    },
    [importOne]
  );

  const importFiles = useCallback(
    (files: File[]) => importAll(files, (result) => ("clip" in result ? result.clip : null)),
    [importAll]
  );
  const importAudioFiles = useCallback(
    (files: File[]) => importAll(files, (result) => ("audioClip" in result ? result.audioClip : null)),
    [importAll]
  );

  return { importFiles, importAudioFiles, importing: pending > 0 };
}
