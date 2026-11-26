import { z } from "zod";

/** How the desktop window looks. Kept apart from the settings file so the studio's pages can import it. */
export const appearanceSchema = z.object({
  /** macOS vibrancy behind the editor's shell, in the desktop window only. */
  glass: z.boolean(),
  /** How much of the shell's colour sits over the glass, 0–100. */
  tint: z.number().min(0).max(100),
});
export type Appearance = z.infer<typeof appearanceSchema>;

export const DEFAULT_APPEARANCE: Appearance = { glass: false, tint: 64 };
