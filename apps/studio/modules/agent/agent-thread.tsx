"use client";

import { CaptionsIcon, ClockIcon, MessageCircleIcon, SparklesIcon, VideoIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { Fragment, useEffect, useRef } from "react";
import type { AgentModel } from "./use-agent";
import { AgentMorphLoader } from "@/modules/agent-ui/agent-morph-loader";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.agent;

type Starter = { icon: typeof VideoIcon; title: string; detail: string; prompt: string };

const STARTERS: Starter[] = [
  { icon: VideoIcon, ...copy.starters.demo },
  { icon: SparklesIcon, ...copy.starters.hook },
  { icon: MessageCircleIcon, ...copy.starters.critique },
  { icon: ClockIcon, ...copy.starters.pacing },
  { icon: CaptionsIcon, ...copy.starters.captions },
];

function clipStarters(name: string): Starter[] {
  const { improve, length, caption } = copy.clipStarters;
  return [
    { icon: VideoIcon, title: improve.title, detail: name, prompt: improve.prompt(name) },
    { icon: ClockIcon, title: length.title, detail: length.detail, prompt: length.prompt(name) },
    { icon: CaptionsIcon, title: caption.title, detail: caption.detail, prompt: caption.prompt(name) },
  ];
}

const LIST_ITEM = /^\s*([-*]|\d+\.)\s/;

function inline(line: string): React.ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts of one line, never reordered
        <strong className="font-medium text-foreground" key={index}>
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts of one line, never reordered
        <code className="rounded bg-muted px-1 font-mono text-[0.85em]" key={index}>
          {part.slice(1, -1)}
        </code>
      );
    // biome-ignore lint/suspicious/noArrayIndexKey: parts of one line, never reordered
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Paragraphs, lists, headings, bold and inline code: enough that replies never show their markdown. */
export function AgentRichText({ text }: { text: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-2.5">
      {text.split(/\n{2,}/).map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => LIST_ITEM.test(line)))
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks of a reply that only grows at the end
            <ul className="flex flex-col gap-1 ps-4" key={index}>
              {lines.map((line, item) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: items of a block that only grows at the end
                <li className="list-disc marker:text-muted-foreground/64" key={item}>
                  {inline(line.replace(LIST_ITEM, ""))}
                </li>
              ))}
            </ul>
          );
        if (/^#{1,4}\s/.test(block))
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: blocks of a reply that only grows at the end
            <p className="font-medium text-foreground" key={index}>
              {inline(block.replace(/^#{1,4}\s/, ""))}
            </p>
          );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: blocks of a reply that only grows at the end
          <p className="whitespace-pre-wrap" key={index}>
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}

function EmptyThread({ agent }: { agent: AgentModel }): React.ReactElement {
  const clip = agent.chips.find((chip) => chip.kind === "clip");
  const starters = clip ? clipStarters(clip.label) : STARTERS;
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-4 pb-4">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5 px-1">
          <h3 className="text-balance font-heading font-semibold text-lg">
            {clip ? copy.clipTitle : copy.emptyTitle}
          </h3>
          <p className="text-pretty text-muted-foreground text-sm">
            {clip ? copy.clipDescription : copy.emptyDescription}
          </p>
        </div>
        <ul className="flex flex-col">
          {starters.map((starter) => (
            <li key={starter.title}>
              <button
                className="group flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-start text-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:bg-accent/80 disabled:opacity-64"
                disabled={agent.busy}
                onClick={() => agent.ask(starter.prompt)}
                type="button">
                <starter.icon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                />
                <span className="shrink-0 font-medium">{starter.title}</span>
                <span className="min-w-0 truncate text-muted-foreground">{starter.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The conversation, following the reply as it streams; the starters while there's nothing yet. */
export function AgentThread({ agent }: { agent: AgentModel }): React.ReactElement {
  const scroller = useRef<HTMLDivElement>(null);
  const { messages } = agent.thread;
  const last = messages.at(-1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the reply as it grows
  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, last?.content]);

  if (messages.length === 0) return <EmptyThread agent={agent} />;

  return (
    <div
      aria-live="polite"
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 text-sm leading-relaxed"
      ref={scroller}>
      {messages.map((message) =>
        message.role === "user" ? (
          <div className="flex flex-col items-end gap-1.5 ps-8" key={message.id}>
            <div className="max-w-full whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-foreground">
              {message.content}
            </div>
            {message.context && message.context.length > 1 ? (
              <span className="max-w-full truncate text-muted-foreground text-xs">
                {message.context.slice(1).join(" · ")}
              </span>
            ) : null}
          </div>
        ) : (
          <div
            className={cn("text-foreground/88", message.failed && "text-destructive-foreground")}
            key={message.id}>
            {message.content ? (
              <AgentRichText text={message.content} />
            ) : (
              <span className="flex items-center gap-2 text-muted-foreground">
                <AgentMorphLoader className="size-4" />
                {copy.thinking}
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
}
