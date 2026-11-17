import { projectFileUrl } from "./project-file-url";

export type AudioBufferCache = {
  /** Fetches and decodes once per file; a failed load is retried on the next call. */
  load: (file: string) => Promise<AudioBuffer | null>;
  /** The decoded buffer, if it's ready. */
  get: (file: string) => AudioBuffer | undefined;
};

export function createAudioBufferCache(projectId: string, context: BaseAudioContext): AudioBufferCache {
  const pending = new Map<string, Promise<AudioBuffer | null>>();
  const decoded = new Map<string, AudioBuffer>();
  return {
    get: (file) => decoded.get(file),
    load: (file) => {
      const existing = pending.get(file);
      if (existing) return existing;
      const loading = fetch(projectFileUrl(projectId, file))
        .then((response) =>
          response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))
        )
        .then((bytes) => context.decodeAudioData(bytes))
        .then((buffer) => {
          decoded.set(file, buffer);
          return buffer;
        })
        .catch(() => {
          pending.delete(file);
          return null;
        });
      pending.set(file, loading);
      return loading;
    },
  };
}
