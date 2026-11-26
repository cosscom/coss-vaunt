"use client";

import type { AgentEvent } from "@coss/vaunt-engine/ai/agent-chat";
import type { Board, BoardNode } from "@coss/vaunt-engine/storyboard/board-schema";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ContextChip, contextChips, describeProject } from "./agent-context";
import { type AgentChange, type AgentMessage, historyContent, takeEvents } from "./agent-events";
import type { PlaybackClock } from "@/modules/editor/player/playback-clock";
import type { EditorState } from "@/modules/editor/use-editor-state";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.agent;
const storageKey = (projectId: string) => `studio.agent-thread.v2.${projectId}`;

function readThread(projectId: string): AgentMessage[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey(projectId)) ?? "[]");
    return Array.isArray(stored) ? (stored as AgentMessage[]) : [];
  } catch {
    return [];
  }
}

/** What the agent can change in the editor, each step undoable from its card and with ⌘Z. */
type AgentEffects = {
  board: () => Board;
  editBoard: (update: (board: Board) => Board) => void;
  theme: () => "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
};

/** The conversation for a project, kept in localStorage per person, and the agent's turn streaming into it. */
function useThread(projectId: string, effects: AgentEffects) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  /** What a running tool is doing, like "Drafting the storyboard…". */
  const [status, setStatus] = useState<string | null>(null);
  // Which project's thread `messages` holds, so the empty first render never overwrites the saved one.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

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
    const patch = (change: (message: AgentMessage) => AgentMessage) =>
      setMessages((list) => list.map((message) => (message.id === reply.id ? change(message) : message)));
    const addChange = (change: AgentChange) =>
      patch((message) => ({ ...message, changes: [...(message.changes ?? []), change] }));

    const apply = (event: AgentEvent) => {
      const fx = effectsRef.current;
      switch (event.type) {
        case "text":
          setStatus(null);
          patch((message) => ({ ...message, content: message.content + event.delta }));
          return;
        case "status":
          setStatus(event.label);
          return;
        case "ask":
          patch((message) => ({ ...message, ask: { question: event.question, options: event.options } }));
          return;
        case "board": {
          const before = fx.board();
          fx.editBoard(() => event.board);
          addChange({ id: crypto.randomUUID(), kind: "board", summary: copy.drafted(event.summary), before });
          setStatus(null);
          return;
        }
        case "scene": {
          const before = fx.board();
          fx.editBoard((board) => ({
            ...board,
            nodes: board.nodes.map((node): BoardNode => (node.id === event.nodeId ? event.node : node)),
          }));
          addChange({ id: crypto.randomUUID(), kind: "scene", summary: event.summary, before });
          setStatus(null);
          return;
        }
        case "theme": {
          const before = fx.theme();
          if (before === event.theme) return;
          fx.setTheme(event.theme);
          addChange({ id: crypto.randomUUID(), kind: "theme", summary: copy.themeSet(event.theme), before });
          return;
        }
        case "error":
          throw new Error(event.message);
      }
    };

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          board: effectsRef.current.board(),
          messages: history
            .filter((message) => !message.failed)
            .map((message) => ({ role: message.role, content: historyContent(message) }))
            .filter((message) => message.content),
        }),
        signal: current.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(typeof body?.error === "string" ? body.error : response.statusText);
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const { events, rest } = takeEvents(buffer + value);
        buffer = rest;
        for (const event of events) apply(event);
      }
    } catch (error) {
      if (current.signal.aborted) {
        // Stopped: keep whatever arrived; a turn with nothing in it is dropped rather than left blank.
        setMessages((list) =>
          list.filter((message) => message.id !== reply.id || historyContent(message) !== "")
        );
        return;
      }
      patch((message) => ({
        ...message,
        content: error instanceof Error && error.message ? error.message : copy.failed,
        failed: true,
      }));
    } finally {
      if (controller.current === current) controller.current = null;
      setStreaming(false);
      setStatus(null);
    }
  };

  /** Puts back what a change replaced. The undo is itself an edit, so ⌘Z can bring the change back. */
  const undo = (messageId: string, changeId: string) => {
    const message = messages.find((item) => item.id === messageId);
    const change = message?.changes?.find((item) => item.id === changeId);
    if (!change || change.undone) return;
    if (change.kind === "theme") effectsRef.current.setTheme(change.before);
    else effectsRef.current.editBoard(() => change.before);
    setMessages((list) =>
      list.map((item) =>
        item.id === messageId
          ? {
              ...item,
              changes: item.changes?.map((entry) =>
                entry.id === changeId ? { ...entry, undone: true } : entry
              ),
            }
          : item
      )
    );
  };

  return {
    messages,
    streaming,
    status,
    send,
    undo,
    stop: () => controller.current?.abort(),
    clear: () => {
      controller.current?.abort();
      setMessages([]);
    },
  };
}

/**
 * The agent: its thread, the context chips for what's selected, and the composer's draft. `selectedScene` is the
 * storyboard scene selected on the canvas, which the agent revises when asked.
 */
export function useAgent(
  editor: EditorState,
  clock: PlaybackClock,
  { selectedScene, onGenerate }: { selectedScene: BoardNode | null; onGenerate: () => void }
) {
  const thread = useThread(editor.project.id, {
    board: () => editor.board,
    editBoard: (update) => editor.editBoard(update),
    theme: () => editor.project.settings.theme,
    setTheme: (theme) => editor.updateSettings({ theme }),
  });
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
    scene: selectedScene,
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
    /** Whether the board has scenes to generate, for the agent's card. */
    canGenerate: editor.board.nodes.length > 0,
    generate: onGenerate,
  };
}

export type AgentModel = ReturnType<typeof useAgent>;
