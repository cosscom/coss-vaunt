import { z } from "zod";

/** How the editor behaves for this person. Kept apart from the settings file so the studio's pages can import it. */
export const editorPreferencesSchema = z.object({
  /** Whether resting the pointer on a stage layer selects it. */
  hoverSelect: z.boolean(),
  /** How long the pointer rests on a layer before it's selected, in ms. */
  hoverSelectDelayMs: z.number().int().min(150).max(3000),
});
export type EditorPreferences = z.infer<typeof editorPreferencesSchema>;

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = { hoverSelect: true, hoverSelectDelayMs: 800 };
