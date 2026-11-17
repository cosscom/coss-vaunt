import type { AudioTrack, Clip, Project, VideoTrack } from "./storyboard-schema";

export const DEFAULT_RECORDING_SECONDS = 4;
export const DEFAULT_TEXT_SECONDS = 3;
export const DEFAULT_BASE_URL = "http://localhost:3101";

export function createVideoTrack(name: string): VideoTrack {
  return { id: crypto.randomUUID(), name, clips: [] };
}

export function createAudioTrack(name: string): AudioTrack {
  return { id: crypto.randomUUID(), name, clips: [] };
}

export function createRecordingClip({
  name,
  route,
  start = 0,
  duration = DEFAULT_RECORDING_SECONDS,
}: {
  name: string;
  route: string;
  start?: number;
  duration?: number;
}): Clip {
  return {
    id: crypto.randomUUID(),
    name,
    start,
    duration,
    transitionIn: "crossfade",
    properties: {},
    source: { kind: "recording", route, actions: [] },
  };
}

export function createTextClip({
  text,
  name = text,
  start = 0,
  duration = DEFAULT_TEXT_SECONDS,
}: {
  text: string;
  name?: string;
  start?: number;
  duration?: number;
}): Clip {
  return {
    id: crypto.randomUUID(),
    name,
    start,
    duration,
    transitionIn: "crossfade",
    properties: {},
    source: { kind: "text", text, size: "title", align: "center", weight: 600 },
  };
}

export function createProject({ name, now }: { name: string; now: Date }): Project {
  const timestamp = now.toISOString();
  return {
    version: 2,
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: {
      aspectRatio: "16:9",
      theme: "light",
      fps: 60,
      background: { kind: "color", value: "#0b0b0c" },
      device: { cornerRadius: 16, contactShadow: true, plinth: false, reflection: 0 },
      baseUrl: DEFAULT_BASE_URL,
    },
    videoTracks: [createVideoTrack("Video 1")],
    audioTracks: [createAudioTrack("Audio")],
  };
}
