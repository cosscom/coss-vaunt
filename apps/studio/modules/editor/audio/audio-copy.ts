export const AUDIO_COPY = {
  newTrackName: (index: number) => `Audio ${index}`,
  track: {
    mute: (name: string) => `Mute ${name}`,
    unmute: (name: string) => `Unmute ${name}`,
    importAudio: "Import audio",
    noAudio: "Drop music or sound effects here",
    addTrackDrop: "Drop audio or drag a clip here for a new track",
  },
  clip: {
    seconds: (value: number) => `${value.toFixed(1)} s`,
  },
  menu: {
    duplicate: "Duplicate",
    split: "Split at playhead",
    delete: "Delete",
    addVolumeKeyframe: "Add volume keyframe at playhead",
    muteTrack: "Mute track",
    unmuteTrack: "Unmute track",
    ease: "Ease",
    deleteKeyframe: "Delete keyframe",
  },
  lane: {
    volume: "Volume",
    keyframeAt: (time: string) => `Volume keyframe at ${time}`,
  },
  inspector: {
    title: "Audio",
    name: "Name",
    kind: "Kind",
    music: "Music",
    sfx: "Sound effect",
    kindHint: "Music ducks while sound effects play.",
    volume: "Volume",
    fadeIn: "Fade in",
    fadeOut: "Fade out",
    trimStart: "Trim start",
  },
} as const;
