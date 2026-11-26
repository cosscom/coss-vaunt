"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ContextChip, contextChips, describeProject } from "./agent-context";
import type { PlaybackClock } from "@/modules/editor/player/playback-clock";
import type { EditorState } from "@/modules/editor/use-editor-state";
import { STUDIO_COPY } from "@/modules/studio-copy";

export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** What was in context when the author sent it, by label, to show under their message. */
  context?: string[];
  /** A reply that didn't arrive; its text is the error, and it isn't sent back to the agent. */
  failed?: boolean;
};

const storageKey = (projectId: string) => `studio.agent-thread.v1.${projectId}`;

function readThread(projectId: string): AgentMessage[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey(projectId)) ?? "[]");
    return Array.isArray(stored) ? (stored as AgentMessage[]) : [];
  } catch {
    return [];
  }
}

/** The conversation for a project, kept in localStorage per person, and the reply streaming into it. */
function useThread(projectId: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  // Which project's thread `messages` holds, so the empty first render never overwrites the saved one.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(readThread(projectId));
    setLoadedFor(projectId);
  }, [projectId]);

  useEffect(() => {
    if (loadedFor !== projectId || streaming) return;
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(messages));
  }, [loadedFor, projectId, messages, streaming]);

  useEffect(() => () => controller.current?.abort(), []);

  const send = async (text: string, context: string, labels: string[]) => {
    const user: AgentMessage = { id: crypto.randomUUID(), role: "user", content: text, context: labels };
    const reply: AgentMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const history = [...messages, user];
    setMessages([...history, reply]);
    setStreaming(true);
    const current = new AbortController();
    controller.current = current;
    const patch = (change: Partial<AgentMessage>) =>
      setMessages((list) =>
        list.map((message) => (message.id === reply.id ? { ...message, ...change } : message))
      );

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: history
            .filter((message) => !message.failed && message.content.trim())
            .map(({ role, content }) => ({ role, content })),
        }),
        signal: current.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(typeof body?.error === "string" ? body.error : response.statusText);
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let content = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        content += value;
        patch({ content });
      }
      if (!content.trim()) throw new Error(STUDIO_COPY.agent.failed);
    } catch (error) {
      // Stopped: keep whatever arrived; an empty reply is dropped rather than left as a blank bubble.
      if (current.signal.aborted) {
        setMessages((list) => list.filter((message) => message.id !== reply.id || message.content.trim()));
        return;
      }
      patch({
        content: error instanceof Error && error.message ? error.message : STUDIO_COPY.agent.failed,
        failed: true,
      });
    } finally {
      if (controller.current === current) controller.current = null;
      setStreaming(false);
    }
  };

  return {
    messages,
    streaming,
    send,
    stop: () => controller.current?.abort(),
    clear: () => {
      controller.current?.abort();
      setMessages([]);
    },
  };
}

/** The agent: its thread, the context chips for what's selected, and the composer's draft. */
export function useAgent(editor: EditorState, clock: PlaybackClock) {
  const thread = useThread(editor.project.id);
  const time = useSyncExternalStore(
    clock.subscribe,
    () => clock.getState().time,
    () => 0
  );
  const playing = useSyncExternalStore(
    clock.subscribe,
    () => clock.getState().playing,
    () => false
  );
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const chips: ContextChip[] = contextChips({
    project: editor.project,
    clip: editor.primaryClip,
    time,
    playing,
  }).filter((chip) => !dismissed.includes(chip.id));

  const ask = (text: string) => {
    const message = text.trim();
    if (!message || thread.streaming) return;
    void thread.send(
      message,
      describeProject(editor.project, editor.board, chips),
      chips.map((chip) => chip.label)
    );
    setDraft("");
  };

  return {
    thread,
    chips,
    dismiss: (id: string) => setDismissed((current) => [...current, id]),
    draft,
    setDraft,
    ask,
    busy: thread.streaming,
  };
}

export type AgentModel = ReturnType<typeof useAgent>;
