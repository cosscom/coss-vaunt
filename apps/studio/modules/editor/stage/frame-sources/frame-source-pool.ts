import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import type { FrameSource } from "./frame-source";
import { createImageFrameSource } from "./image-frame-source";
import { createPlaceholderFrameSource } from "./placeholder-frame-source";
import { createRecordingFrameSource } from "./recording-frame-source";
import {
  type LoadedRecording,
  loadLatestRecording,
  loadRecording,
  recordingTakesFor,
  requestRecordingVideo,
  wantedTakes,
} from "./recording-lookup";
import { createVideoFrameSource } from "./video-frame-source";

/** How often a recording clip still on its placeholder looks for its recording, e.g. one just finished. */
const RECORDING_RECHECK_MS = 3000;

type Entry = {
  key: string;
  source: FrameSource;
  /** The takes a recording clip can show, best first; empty for other clips and uncatalogued routes. */
  recordingHashes: string[];
  /** The take it shows: one of `recordingHashes`, or an older take of the clip while it has none of them. */
  shown: LoadedRecording | null;
  /** Bumped by each lookup, so only the latest one's answer lands. */
  lookup: number;
  checking: boolean;
  /** The lookup in flight, so an export can wait for the recording before drawing. */
  pending: Promise<void>;
};

export type FrameSourcePool = {
  /** Makes a source for each new video clip and disposes those of removed clips. */
  sync: (project: Project) => void;
  get: (clipId: string) => FrameSource | undefined;
  /** The take a recording clip shows, for its cursor path. */
  recordingFor: (clipId: string) => LoadedRecording | null;
  /** Export: waits for the clip's media, then holds exactly the frame for `time`. */
  prepare: (clipId: string, time: number) => Promise<void>;
  /** Stops every source not in `visible` from decoding. */
  idleExcept: (visible: Set<string>) => void;
  /** Loads every source again for `project`, e.g. after a recording was replaced on disk; recordings keep their frame until the new one is in. */
  refresh: (project: Project) => void;
  dispose: () => void;
};

function sourceKey(clip: Clip, takesKey: string | null, theme: Project["settings"]["theme"]): string {
  if (clip.source.kind === "import" || clip.source.kind === "image")
    return `${clip.source.kind}:${clip.source.file}`;
  return `recording:${takesKey ?? theme}`;
}

const isRecordingKey = (key: string) => key.startsWith("recording:");

/** A new source shows nothing until its video decodes, so a refresh swaps only takes that changed on disk. */
const recordedOver = (shown: LoadedRecording | null, loaded: LoadedRecording) =>
  JSON.stringify(shown?.manifest) !== JSON.stringify(loaded.manifest);

/**
 * One frame source per video clip: imports play from their file, images show it; recordings show the take for
 * their current capture hash (theme included), else their newest take, else a placeholder until they are recorded.
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

  const show = (clipId: string, entry: Entry, recording: LoadedRecording) => {
    entry.source.dispose();
    entry.source = createRecordingFrameSource({ recording, maxAnisotropy, onFrame });
    entry.shown = recording;
    onFrame();
    // Older recordings have no playback video: they play their WebP frames until the studio has made one.
    if (recording.manifest.video || !upgrade) return;
    void requestRecordingVideo(projectUrl, recording, clipId, recording.hash)
      .then((withVideo) => {
        if (!disposed && withVideo && entries.get(clipId) === entry && entry.shown === recording)
          show(clipId, entry, withVideo);
      })
      .catch(() => undefined);
  };

  /** `reload` also swaps in the shown take again when it was recorded over on disk. */
  const lookUpRecording = (clipId: string, entry: Entry, reload = false) => {
    if (!isRecordingKey(entry.key)) return;
    const wanted = reload
      ? entry.recordingHashes
      : wantedTakes(entry.recordingHashes, entry.shown?.hash ?? null);
    const latestOtherwise = reload || entry.shown === null;
    if (entry.checking || (wanted.length === 0 && !latestOtherwise)) return;
    const lookup = ++entry.lookup;
    entry.checking = true;
    entry.pending = loadRecording(filesUrl, clipId, wanted)
      .then((recording) => recording ?? (latestOtherwise ? loadLatestRecording(filesUrl, clipId) : null))
      .then(
        (recording) => {
          if (disposed || entries.get(clipId) !== entry || entry.lookup !== lookup) return;
          entry.checking = false;
          if (
            recording &&
            (recording.hash !== entry.shown?.hash || (reload && recordedOver(entry.shown, recording)))
          )
            show(clipId, entry, recording);
        },
        () => {
          if (entry.lookup === lookup) entry.checking = false;
        }
      );
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
        if (current && current.key !== key && isRecordingKey(current.key) && isRecordingKey(key)) {
          // A new version of the clip keeps showing the take it has until the lookup for its own answers.
          current.key = key;
          current.checking = false;
        }
        if (current?.key === key) {
          current.recordingHashes = takes?.hashes ?? [];
          lookUpRecording(clip.id, current);
          continue;
        }
        current?.source.dispose();
        const entry: Entry = {
          key,
          source: createSource(clip, project.settings),
          recordingHashes: takes?.hashes ?? [],
          shown: null,
          lookup: 0,
          checking: false,
          pending: Promise.resolve(),
        };
        entries.set(clip.id, entry);
        lookUpRecording(clip.id, entry);
      }
    },
    get: (clipId) => entries.get(clipId)?.source,
    recordingFor: (clipId) => entries.get(clipId)?.shown ?? null,
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
      for (const [clipId, entry] of entries) {
        if (isRecordingKey(entry.key)) {
          entry.checking = false;
          lookUpRecording(clipId, entry, true);
          continue;
        }
        entry.source.dispose();
        entries.delete(clipId);
      }
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
