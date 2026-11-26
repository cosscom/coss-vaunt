import type { Board } from "@coss/vaunt-engine/storyboard/board-schema";
import type { Clip, Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { projectDuration } from "@coss/vaunt-engine/storyboard/track-resolution";

/** Something the author is pointing the agent at; the project is always in context. */
export type ContextChip =
  | { id: "project"; kind: "project"; label: string }
  | { id: string; kind: "clip"; label: string; clipId: string }
  | { id: string; kind: "moment"; label: string; time: number };

/** A playhead under this is the start of the video, not a moment anyone picked. */
const MIN_MOMENT_SECONDS = 0.05;
/** A clip's settings, cut off past this, so one busy clip can't crowd out the rest of the context. */
const MAX_CLIP_JSON = 3000;

/** `1:04.2`: minutes, seconds and tenths, how people say a moment in a video. */
export function formatMoment(seconds: number): string {
  const tenths = Math.floor(Math.max(0, seconds) * 10);
  const whole = Math.floor(tenths / 10);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${tenths % 10}`;
}

/** The chips for what's selected: the project, the selected clip, and the playhead while paused on a video. */
export function contextChips({
  project,
  clip,
  time,
  playing,
}: {
  project: Project;
  clip: Clip | null;
  time: number;
  playing: boolean;
}): ContextChip[] {
  const chips: ContextChip[] = [{ id: "project", kind: "project", label: project.name }];
  if (clip) chips.push({ id: `clip:${clip.id}`, kind: "clip", label: clip.name, clipId: clip.id });
  const hasClips = project.videoTracks.some((track) => track.clips.length > 0);
  if (hasClips && !playing && time > MIN_MOMENT_SECONDS) {
    const tenths = Math.floor(time * 10) / 10;
    chips.push({ id: `moment:${tenths}`, kind: "moment", label: formatMoment(time), time });
  }
  return chips;
}

/** The project, its board and timeline, and what the author is pointing at, as prose for the agent. */
export function describeProject(project: Project, board: Board, chips: readonly ContextChip[]): string {
  const { aspectRatio, theme } = project.settings;
  const lines = [
    `Project "${project.name}", ${aspectRatio}, ${theme} theme, ${projectDuration(project).toFixed(1)} s long.`,
    board.brief ? `Brief: ${board.brief}` : "No brief yet.",
    board.nodes.length > 0
      ? `Storyboard scenes:\n${board.nodes
          .map((node, index) => `${index + 1}. [${node.kind}] ${node.title} (${node.duration} s)`)
          .join("\n")}`
      : "The storyboard is empty.",
  ];
  project.videoTracks.forEach((track, index) => {
    if (track.clips.length === 0) return;
    const clips = track.clips
      .map(
        (clip) =>
          `- "${clip.name}", ${clip.source.kind}, at ${clip.start.toFixed(1)} s for ${clip.duration.toFixed(1)} s`
      )
      .join("\n");
    lines.push(`Video track ${index + 1}${track.hidden ? " (hidden)" : ""}:\n${clips}`);
  });
  if (project.videoTracks.every((track) => track.clips.length === 0)) lines.push("The timeline is empty.");

  const allClips = project.videoTracks.flatMap((track) => track.clips);
  for (const chip of chips) {
    if (chip.kind === "clip") {
      const clip = allClips.find((item) => item.id === chip.clipId);
      if (clip)
        lines.push(
          `The author is pointing at clip "${clip.name}":\n${JSON.stringify(clip).slice(0, MAX_CLIP_JSON)}`
        );
    } else if (chip.kind === "moment") {
      lines.push(`The author is pointing at ${chip.label} on the timeline.`);
    }
  }
  return lines.join("\n\n");
}
