/** Asks the studio to give `clipId` the frames of a take `fromClipId` recorded; false when it couldn't. */
export async function linkTakeRequest({
  projectId,
  clipId,
  fromClipId,
  captureHash,
}: {
  projectId: string;
  clipId: string;
  fromClipId: string;
  captureHash: string;
}): Promise<boolean> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/take`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromClipId, captureHash }),
    }
  ).catch(() => null);
  return response?.ok ?? false;
}
