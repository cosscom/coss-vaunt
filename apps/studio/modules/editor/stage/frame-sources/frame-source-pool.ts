import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import type { FrameSource } from "./frame-source";
import { createImageFrameSource } from "./image-frame-source";
import { createPlaceholderFrameSource } from "./placeholder-frame-source";
import { createRecordingFrameSource } from "./recording-frame-source";
import {
  type LoadedRecording,
  loadRecording,
  recordingHashFor,
  requestRecordingVideo,
} from "./recording-lookup";
import { createVideoFrameSource } from "./video-frame-source";

/** How often a recording clip still on its placeholder looks for its recording, e.g. one just finished. */
const RECORDING_RECHECK_MS = 3000;

type Entry = {
  key: string;
  source: FrameSource;
  /** The capture hash a recording clip shows; null for other clips and uncatalogued routes. */
  recordingHash: string | null;
  found: boolean;
  checking: boolean;
};

export type FrameSourcePool = {
  /** Makes a source for each new video clip and disposes those of removed clips. */
  sync: (project: Project) => void;
  get: (clipId: string) => FrameSource | undefined;
  /** Stops every source not in `visible` from decoding. */
  idleExcept: (visible: Set<string>) => void;
  dispose: () => void;
};

function sourceKey(clip: Clip, recordingHash: string | null, theme: Project["settings"]["theme"]): string {
  if (clip.source.kind === "import" || clip.source.kind === "image")
    return `${clip.source.kind}:${clip.source.file}`;
  return `recording:${recordingHash ?? theme}`;
}

/**
 * One frame source per video clip: imports play from their file, images show it; recordings show a
 * placeholder until the recording for their current capture hash (theme included) is on disk.
 */
export function createFrameSourcePool({
  maxAnisotropy,
  placeholderLabel,
  onFrame,
}: {
  maxAnisotropy: number;
  placeholderLabel: string;
  onFrame: () => void;
}): FrameSourcePool {
  const entries = new Map<string, Entry>();
  let projectUrl = "";
  let filesUrl = "";
  let disposed = false;

  const lookUpRecording = (clipId: string, entry: Entry) => {
    const hash = entry.recordingHash;
    if (!hash || entry.found || entry.checking) return;
    entry.checking = true;
    void loadRecording(filesUrl, clipId, hash)
      .then((recording) => {
        entry.checking = false;
        if (disposed || !recording || entries.get(clipId) !== entry) return;
        entry.source.dispose();
        entry.source = createRecordingFrameSource({ recording, maxAnisotropy, onFrame });
        entry.found = true;
        onFrame();
        if (!recording.manifest.video) upgradeToVideo(clipId, entry, recording, hash);
      })
      .catch(() => {
        entry.checking = false;
      });
  };

  // Older recordings have no playback video: they play their WebP frames until the studio has made one.
  const upgradeToVideo = (clipId: string, entry: Entry, recording: LoadedRecording, hash: string) => {
    void requestRecordingVideo(projectUrl, recording, clipId, hash)
      .then((withVideo) => {
        if (disposed || !withVideo || entries.get(clipId) !== entry) return;
        entry.source.dispose();
        entry.source = createRecordingFrameSource({ recording: withVideo, maxAnisotropy, onFrame });
        onFrame();
      })
      .catch(() => undefined);
  };

  const recheck = setInterval(() => {
    for (const [clipId, entry] of entries) lookUpRecording(clipId, entry);
  }, RECORDING_RECHECK_MS);

  const fileUrl = (file: string) => `${filesUrl}/${file.split("/").map(encodeURIComponent).join("/")}`;

  const createSource = (clip: Clip, settings: Project["settings"]): FrameSource => {
    const { source } = clip;
    if (source.kind === "image") {
      return createImageFrameSource({
        url: fileUrl(source.file),
        size: { width: source.width, height: source.height },
        maxAnisotropy,
        onFrame,
      });
    }
    if (source.kind === "import") {
      return createVideoFrameSource({
        url: fileUrl(source.file),
        size: { width: source.width, height: source.height },
        fps: settings.fps,
        maxAnisotropy,
        onFrame,
      });
    }
    return createPlaceholderFrameSource({ theme: settings.theme, label: placeholderLabel });
  };

  return {
    sync(project) {
      projectUrl = `/api/projects/${encodeURIComponent(project.id)}`;
      filesUrl = `${projectUrl}/files`;
      const clips = project.videoTracks
        .flatMap((track) => track.clips)
        .filter((clip) => clip.source.kind !== "text");
      const live = new Set(clips.map((clip) => clip.id));
      for (const [clipId, entry] of entries) {
        if (live.has(clipId)) continue;
        entry.source.dispose();
        entries.delete(clipId);
      }
      for (const clip of clips) {
        const recordingHash = recordingHashFor(project, clip);
        const key = sourceKey(clip, recordingHash, project.settings.theme);
        const current = entries.get(clip.id);
        if (current?.key === key) continue;
        current?.source.dispose();
        const entry = {
          key,
          source: createSource(clip, project.settings),
          recordingHash,
          found: false,
          checking: false,
        };
        entries.set(clip.id, entry);
        lookUpRecording(clip.id, entry);
      }
    },
    get: (clipId) => entries.get(clipId)?.source,
    idleExcept(visible) {
      for (const [clipId, entry] of entries) if (!visible.has(clipId)) entry.source.idle();
    },
    dispose() {
      disposed = true;
      clearInterval(recheck);
      for (const entry of entries.values()) entry.source.dispose();
      entries.clear();
    },
  };
}
