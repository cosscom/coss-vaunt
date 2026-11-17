import path from "node:path";
import { z } from "zod";
import { getTextEffect, listTextEffects } from "../catalogues/text-effects/text-effect-catalogue";
import { probeMedia } from "../imports/media-probe";
import { mediaTypeOf } from "../imports/media-types";
import { clipFromMedia } from "../imports/media-upload";
import type { BoardNode } from "../storyboard/board-schema";
import { createRecordingClip, createTextClip } from "../storyboard/storyboard-factories";
import { type Action, type Clip, clipSchema } from "../storyboard/storyboard-schema";
import { type StudioModel, studioModel } from "./studio-model";
import { runUntilSubmitted } from "./submit-tool-loop";

type NodeOf<Kind extends BoardNode["kind"]> = Extract<BoardNode, { kind: Kind }>;

/** A node that can't become a clip as it stands; the message is for the author. */
export class NodeGenerationError extends Error {}

const MAX_CLIP_TEXT = 200;

/** A cheap, fixed choice for text with no direction: short lines pop, longer ones build word by word. */
export function defaultTextEffect(words: string): string {
  const count = words.trim().split(/\s+/).filter(Boolean).length;
  if (count <= 3) return "spring-scale-in";
  if (count <= 8) return "per-word-crossfade";
  return "line-by-line-slide";
}

/** Lets the model match an effect to the node's direction, from the visible catalogue. */
export async function pickTextEffect(
  node: NodeOf<"text">,
  model: StudioModel = studioModel("plan")
): Promise<string> {
  const effects = listTextEffects().filter((effect) => effect.visible);
  const ids = effects.map((effect) => effect.id);
  const { value } = await runUntilSubmitted({
    model,
    effort: "low",
    maxSteps: 2,
    system: `Pick the text animation that best fits a title card in a short product video. Call pickEffect with one id.\n${effects
      .map((effect) => `- ${effect.id}: ${effect.description}`)
      .join("\n")}`,
    prompt: `Words: ${JSON.stringify(node.words)}\nDirection: ${JSON.stringify(node.notes)}`,
    submit: {
      name: "pickEffect",
      description: "Submit the chosen effect id.",
      schema: z.object({ effect: z.string() }),
      check: ({ effect }) => (ids.includes(effect) ? [] : [`Use one of: ${ids.join(", ")}`]),
    },
  });
  return value.effect;
}

/** Writes a title card's words from its title, notes and the board brief when the author left them blank. */
export async function writeTextWords(
  node: NodeOf<"text">,
  brief: string,
  model: StudioModel = studioModel("plan")
): Promise<string> {
  const { value } = await runUntilSubmitted({
    model,
    effort: "low",
    maxSteps: 2,
    system: `Write the words for one title card in a short product video for Cal.com. Keep it to one short line (at most 8 words), in sentence case, with no quotes or emoji. Call writeWords with them.`,
    prompt: `Card title: ${JSON.stringify(node.title)}\nDirection: ${JSON.stringify(node.notes)}\nVideo brief: ${JSON.stringify(brief)}`,
    submit: {
      name: "writeWords",
      description: "Submit the words for the card.",
      schema: z.object({ words: z.string() }),
      check: ({ words }) =>
        words.trim() && words.trim().length <= MAX_CLIP_TEXT ? [] : ["Write one short line of words"],
    },
  });
  return value.words.trim();
}

/** The effect a text node plays: its own, else the model's pick when it has notes, else the default. */
export async function textEffectFor(
  node: NodeOf<"text">,
  pick: (node: NodeOf<"text">) => Promise<string> = pickTextEffect
): Promise<string> {
  if (node.effect && getTextEffect(node.effect)) return node.effect;
  if (node.notes.trim()) return pick(node);
  return defaultTextEffect(node.words);
}

export function textClipForNode(node: NodeOf<"text">, effect: string, clipId?: string): Clip {
  const text = node.words.trim();
  if (!text) throw new NodeGenerationError("Add the words to show");
  if (text.length > MAX_CLIP_TEXT)
    throw new NodeGenerationError(`Keep the words under ${MAX_CLIP_TEXT} characters`);
  const clip = createTextClip({ text, name: node.title, duration: node.duration });
  if (clip.source.kind !== "text") throw new Error("createTextClip made a non-text clip");
  return clipSchema.parse({
    ...clip,
    id: clipId ?? clip.id,
    storyboardNodeId: node.id,
    source: { ...clip.source, effectIn: effect },
  });
}

export function recordingClipForNode(
  node: NodeOf<"recording">,
  { actions, clipId, startFrom }: { actions: Action[]; clipId?: string; startFrom?: string }
): Clip {
  const clip = createRecordingClip({ name: node.title, route: node.route, duration: node.duration });
  return clipSchema.parse({
    ...clip,
    id: clipId ?? clip.id,
    storyboardNodeId: node.id,
    source: {
      kind: "recording",
      route: node.route,
      actions,
      startFrom: startFrom ? { clipId: startFrom } : undefined,
    },
  });
}

/** An image or video clip from the node's file under `imports/`, as long as the node where the file allows. */
export async function mediaClipForNode(
  node: NodeOf<"media">,
  projectDir: string,
  clipId?: string
): Promise<Clip> {
  if (!node.file) throw new NodeGenerationError("Pick a file");
  const file = path.posix.normalize(node.file);
  if (!file.startsWith("imports/") || file.includes(".."))
    throw new NodeGenerationError("Pick a file from imports");
  const type = mediaTypeOf(file, "");
  if (!type || type.kind === "audio") throw new NodeGenerationError("Pick a video or an image");
  const probe = await probeMedia(path.join(projectDir, file));
  if (!probe) throw new NodeGenerationError(`Couldn't read ${file}`);
  const clip = clipFromMedia({
    id: clipId ?? crypto.randomUUID(),
    name: node.title,
    file,
    kind: type.kind,
    probe,
  });
  return clipSchema.parse({
    ...clip,
    duration: type.kind === "video" ? Math.min(node.duration, clip.duration) : node.duration,
    storyboardNodeId: node.id,
  });
}
