"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/** Shortcut hints show ⌘ on macOS and Ctrl elsewhere; the server renders the Ctrl form. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false
  );
}
