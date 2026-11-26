"use client";

import { Button } from "@coss/ui/components/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@coss/ui/components/collapsible";
import {
  CaptionsIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  ClockIcon,
  MessageCircleIcon,
  RotateCcwIcon,
  SparklesIcon,
  VideoIcon,
} from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { Fragment, useEffect, useRef } from "react";
import type { AgentChange, AgentMessage } from "./agent-events";
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

/** What the agent changed: one line each, with Undo, and Generate once there's a board to record. */
function ChangeCard({
  agent,
  message,
  change,
}: {
  agent: AgentModel;
  message: AgentMessage;
  change: AgentChange;
}): React.ReactElement {
  const showGenerate = change.kind === "board" && !change.undone && !change.failed && agent.canGenerate;
  const Icon = change.failed ? CircleAlertIcon : CheckIcon;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-2.5 text-xs",
        (change.undone || change.failed) && "border-dashed bg-transparent"
      )}>
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0",
            change.undone || change.failed ? "text-muted-foreground" : "text-success-foreground"
          )}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            change.undone && "text-muted-foreground line-through",
            change.failed && "text-muted-foreground"
          )}
          title={change.failed ? change.summary : undefined}>
          {change.summary}
        </span>
        {change.failed ? null : change.undone ? (
          <span className="shrink-0 text-muted-foreground">{copy.undone}</span>
        ) : (
          <Button
            className="shrink-0"
            onClick={() => agent.thread.undo(message.id, change.id)}
            size="xs"
            variant="ghost">
            <RotateCcwIcon aria-hidden="true" />
            {copy.undo}
          </Button>
        )}
      </div>
      {change.kind === "board" && change.rationale ? <Rationale text={change.rationale} /> : null}
      {showGenerate ? (
        <Button className="w-full" onClick={agent.generate} size="sm">
          {copy.generate}
        </Button>
      ) : null}
    </div>
  );
}

/** The planner's reasons for a draft's scenes, closed until asked for. */
function Rationale({ text }: { text: string }): React.ReactElement {
  return (
    <Collapsible className="-mx-1">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-start text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <ChevronDownIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 -rotate-90 transition-transform duration-150 group-data-panel-open:rotate-0 motion-reduce:transition-none"
        />
        {copy.whyTheseScenes}
      </CollapsibleTrigger>
      <CollapsiblePanel className="motion-reduce:transition-none">
        <p className="text-pretty pe-1 pt-1 ps-6 text-muted-foreground leading-relaxed">{text}</p>
      </CollapsiblePanel>
    </Collapsible>
  );
}

/** A question the agent is waiting on: its replies as buttons, while it's the latest turn. */
function Replies({ agent, options, live }: { agent: AgentModel; options: string[]; live: boolean }) {
  return (
    <div aria-label={copy.replyLabel} className="flex flex-wrap gap-1.5" role="group">
      {options.map((option) => (
        <Button
          className="rounded-full"
          disabled={!live || agent.busy}
          key={option}
          onClick={() => agent.ask(option)}
          size="xs"
          variant="secondary">
          {option}
        </Button>
      ))}
    </div>
  );
}

function AssistantTurn({
  agent,
  message,
  latest,
}: {
  agent: AgentModel;
  message: AgentMessage;
  latest: boolean;
}): React.ReactElement {
  const streamingHere = latest && agent.busy;
  const empty = !message.content && !message.ask && !message.changes?.length;
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 text-foreground/88",
        message.failed && "text-destructive-foreground"
      )}>
      {message.content ? <AgentRichText text={message.content} /> : null}
      {message.ask ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium text-foreground">{message.ask.question}</p>
          <Replies agent={agent} live={latest} options={message.ask.options} />
        </div>
      ) : null}
      {message.changes?.map((change) => (
        <ChangeCard agent={agent} change={change} key={change.id} message={message} />
      ))}
      {streamingHere && (empty || agent.thread.status) ? (
        <span className="flex items-center gap-2 text-muted-foreground">
          <AgentMorphLoader className="size-4" />
          {agent.thread.status ?? copy.thinking}
        </span>
      ) : null}
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
  }, [messages.length, last?.content, last?.ask, last?.changes?.length, agent.thread.status]);

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
          <AssistantTurn agent={agent} key={message.id} latest={message.id === last?.id} message={message} />
        )
      )}
    </div>
  );
}
