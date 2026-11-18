import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import type { FrameSource } from "./frame-source";
import { createImageFrameSource } from "./image-frame-source";
import { createPlaceholderFrameSource } from "./placeholder-frame-source";
import { createRecordingFrameSource } from "./recording-frame-source";
import {
  type LoadedRecording,
  loadRecording,
  recordingTakesFor,
  requestRecordingVideo,
} from "./recording-lookup";
import { createVideoFrameSource } from "./video-frame-source";

/** How often a recording clip still on its placeholder looks for its recording, e.g. one just finished. */
const RECORDING_RECHECK_MS = 3000;

type Entry = {
  key: string;
  source: FrameSource;
  /** The takes a recording clip can show, best first; empty for other clips and uncatalogued routes. */
  recordingHashes: string[];
  /** The take it shows; until the best one is recorded it keeps looking for it. */
  foundHash: string | null;
  checking: boolean;
  /** The lookup in flight, so an export can wait for the recording before drawing. */
  pending: Promise<void>;
};

export type FrameSourcePool = {
  /** Makes a source for each new video clip and disposes those of removed clips. */
  sync: (project: Project) => void;
  get: (clipId: string) => FrameSource | undefined;
  /** Export: waits for the clip's media, then holds exactly the frame for `time`. */
  prepare: (clipId: string, time: number) => Promise<void>;
  /** Stops every source not in `visible` from decoding. */
  idleExcept: (visible: Set<string>) => void;
  /** Drops every source and loads them again for `project`, e.g. after a recording was replaced on disk. */
  refresh: (project: Project) => void;
  dispose: () => void;
};

function sourceKey(clip: Clip, takesKey: string | null, theme: Project["settings"]["theme"]): string {
  if (clip.source.kind === "import" || clip.source.kind === "image")
    return `${clip.source.kind}:${clip.source.file}`;
  return `recording:${takesKey ?? theme}`;
}

/**
 * One frame source per video clip: imports play from their file, images show it; recordings show a
 * placeholder until the recording for their current capture hash (theme included) is on disk.
 */
export function createFrameSourcePool({
  maxAnisotropy,
  placeholderLabel,
  onFrame,
  upgrade = true,
}: {
  maxAnisotropy: number;
  placeholderLabel: string;
  onFrame: () => void;
  /** Off for export: swapping a recording to its playback video mid-render would drop the prepared frame. */
  upgrade?: boolean;
}): FrameSourcePool {
  const entries = new Map<string, Entry>();
  let projectUrl = "";
  let filesUrl = "";
  let disposed = false;

  const lookUpRecording = (clipId: string, entry: Entry) => {
    const [best] = entry.recordingHashes;
    if (!best || entry.foundHash === best || entry.checking) return;
    entry.checking = true;
    // Showing a stand-in take already: only the best one is worth swapping to.
    const wanted = entry.foundHash ? [best] : entry.recordingHashes;
    entry.pending = loadRecording(filesUrl, clipId, wanted)
      .then((recording) => {
        entry.checking = false;
        if (disposed || !recording || entries.get(clipId) !== entry || recording.hash === entry.foundHash)
          return;
        entry.source.dispose();
        entry.source = createRecordingFrameSource({ recording, maxAnisotropy, onFrame });
        entry.foundHash = recording.hash;
        onFrame();
        if (!recording.manifest.video && upgrade) upgradeToVideo(clipId, entry, recording, recording.hash);
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

  const pool: FrameSourcePool = {
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
        const takes = recordingTakesFor(project, clip);
        const key = sourceKey(clip, takes?.key ?? null, project.settings.theme);
        const current = entries.get(clip.id);
        if (current?.key === key) {
          // A zoom edit can change which DPR the clip needs; keep showing the take until a better one turns up.
          current.recordingHashes = takes?.hashes ?? [];
          lookUpRecording(clip.id, current);
          continue;
        }
        current?.source.dispose();
        const entry: Entry = {
          key,
          source: createSource(clip, project.settings),
          recordingHashes: takes?.hashes ?? [],
          foundHash: null,
          checking: false,
          pending: Promise.resolve(),
        };
        entries.set(clip.id, entry);
        lookUpRecording(clip.id, entry);
      }
    },
    get: (clipId) => entries.get(clipId)?.source,
    async prepare(clipId, time) {
      const entry = entries.get(clipId);
      if (!entry) return;
      await entry.pending;
      await entry.source.prepare(time);
    },
    idleExcept(visible) {
      for (const [clipId, entry] of entries) if (!visible.has(clipId)) entry.source.idle();
    },
    refresh(project) {
      for (const entry of entries.values()) entry.source.dispose();
      entries.clear();
      pool.sync(project);
    },
    dispose() {
      disposed = true;
      clearInterval(recheck);
      for (const entry of entries.values()) entry.source.dispose();
      entries.clear();
    },
  };
  return pool;
}
