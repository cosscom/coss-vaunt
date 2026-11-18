import { z } from "zod";
import { isAllowedRecordingHost } from "../recording/host-allowlist";
import { aspectRatioSchema, projectAppSchema, projectSchema } from "../storyboard/storyboard-schema";

/** What the new-project dialog sends: a name and the setup, with an optional login for a custom app. */
export const newProjectInputSchema = z.object({
  name: projectSchema.shape.name,
  setup: z.object({
    aspectRatio: aspectRatioSchema,
    app: projectAppSchema,
    baseUrl: z.url().refine(isAllowedRecordingHost, "The app must run on this machine"),
    login: z
      .object({ username: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) })
      .optional(),
  }),
});
