import { markOnboardingCompleted, onboardingCompleted } from "@/modules/onboarding/onboarding-store";

export const dynamic = "force-dynamic";

/** `{ completed }`: whether this machine has finished (or skipped through) onboarding. */
export async function GET(): Promise<Response> {
  return Response.json({ completed: await onboardingCompleted() });
}

/** Records that onboarding is done, so the studio opens straight to the projects next time. */
export async function PUT(): Promise<Response> {
  await markOnboardingCompleted();
  return Response.json({ completed: true });
}
