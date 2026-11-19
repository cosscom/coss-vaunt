const finished = new EventTarget();

/** Tells the stage a take was written, so a clip recorded over in place shows its new frames. */
export function announceRecordingFinished(): void {
  finished.dispatchEvent(new Event("finished"));
}

export function onRecordingFinished(listener: () => void): () => void {
  finished.addEventListener("finished", listener);
  return () => finished.removeEventListener("finished", listener);
}
