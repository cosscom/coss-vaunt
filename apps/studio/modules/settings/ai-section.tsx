"use client";

import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Input } from "@coss/ui/components/input";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@coss/ui/components/select";
import { toastManager } from "@coss/ui/components/toast";
import { cn } from "@coss/ui/lib/utils";
import {
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsView,
  API_KEY_ENV,
  DEFAULT_COMPATIBLE_BASE_URL,
} from "@coss/vaunt-engine/ai/ai-providers";
import type * as React from "react";
import { useState } from "react";
import {
  activeModel,
  choiceValue,
  isHttpUrl,
  keyUpdate,
  type ModelGroup,
  modelGroups,
  parseChoice,
} from "./ai-connections";
import { SettingsGroup, SettingsRow } from "./settings-rows";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.settings.ai;
export const AI_SETTINGS_URL = "/api/settings/ai";

type AiUpdate = {
  provider?: AiProvider;
  model?: string;
  keys?: Partial<Record<AiProvider, string | null>>;
  baseUrl?: string | null;
};

/** Saves part of the AI settings and returns what the server now has. */
export async function saveAiSettings(update: AiUpdate): Promise<AiSettingsView> {
  const response = await fetch(AI_SETTINGS_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error(response.statusText);
  return (await response.json()) as AiSettingsView;
}

type TestResult = { ok: true; models?: string[] } | { ok: false; error: string };

function ModelSelect({
  view,
  groups,
  onChange,
}: {
  view: AiSettingsView;
  groups: ModelGroup[];
  onChange: (update: AiUpdate) => void;
}): React.ReactElement {
  const items = groups.flatMap((group) =>
    group.models.map((model) => ({
      value: choiceValue(group.provider, model.id),
      label: `${model.label} · ${copy.providers[group.provider]}`,
    }))
  );
  const value = choiceValue(view.provider, activeModel(view));
  return (
    <Select
      disabled={groups.length === 0}
      items={items}
      onValueChange={(next: string | null) => {
        const choice = next ? parseChoice(next) : null;
        if (choice) onChange(choice);
      }}
      value={items.some((item) => item.value === value) ? value : null}>
      <SelectTrigger aria-label={copy.activeModel} className="w-64" size="sm">
        <SelectValue placeholder={copy.notConnected} />
      </SelectTrigger>
      <SelectPopup alignItemWithTrigger={false}>
        {groups.map((group) => (
          <SelectGroup key={group.provider}>
            <SelectGroupLabel>{copy.providers[group.provider]}</SelectGroupLabel>
            {group.models.map((model) => (
              <SelectItem key={model.id} value={choiceValue(group.provider, model.id)}>
                {model.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectPopup>
    </Select>
  );
}

/** The model id field: any model the chosen provider offers, saved when it loses focus or on Enter. */
function ModelIdInput({
  view,
  onChange,
}: {
  view: AiSettingsView;
  onChange: (update: AiUpdate) => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(view.model);
  const commit = () => {
    if (draft.trim() !== view.model) onChange({ provider: view.provider, model: draft.trim() });
  };
  return (
    <Input
      aria-label={copy.customModel}
      className="w-64 font-mono"
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      placeholder={view.defaultModel || copy.customModel}
      size="sm"
      spellCheck={false}
      value={draft}
    />
  );
}

function StatusDot({ connected }: { connected: boolean }): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn("size-1.5 shrink-0 rounded-full", connected ? "bg-success" : "bg-muted-foreground/40")}
    />
  );
}

/**
 * One provider: whether it's connected and how, with its key (masked: only where it comes from and its last four
 * characters), and a test that it answers. The OpenAI-compatible server takes an address and an optional key.
 */
function ConnectionRow({
  provider,
  view,
  onSaved,
  onModelsFound,
}: {
  provider: AiProvider;
  view: AiSettingsView;
  onSaved: (view: AiSettingsView) => void;
  onModelsFound: (provider: AiProvider, models: string[]) => void;
}): React.ReactElement {
  const connection = view.connections[provider];
  const compatible = provider === "compatible";
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(view.baseUrl || DEFAULT_COMPATIBLE_BASE_URL);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestResult | "testing" | null>(null);
  const name = copy.providers[provider];

  const save = async (update: AiUpdate, message: string) => {
    setBusy(true);
    try {
      onSaved(await saveAiSettings(update));
      toastManager.add({ type: "success", title: message });
      setEditing(false);
      setKey("");
      setTest(null);
    } catch {
      toastManager.add({ type: "error", title: STUDIO_COPY.settings.saveFailed });
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setTest("testing");
    try {
      const response = await fetch(`${AI_SETTINGS_URL}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const result = (await response.json()) as TestResult;
      setTest(result);
      if (result.ok && result.models) onModelsFound(provider, result.models);
    } catch (error) {
      setTest({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  const canSave = compatible ? isHttpUrl(baseUrl) : key.trim().length > 0;
  const submit = () => {
    if (!canSave) return;
    if (compatible)
      void save({ baseUrl: baseUrl.trim(), ...(key.trim() ? keyUpdate(provider, key) : {}) }, copy.keySaved);
    else void save(keyUpdate(provider, key), copy.keySaved);
  };

  let status: string = copy.notConnected;
  if (connection?.source === "env") status = copy.fromEnv(API_KEY_ENV[provider]);
  else if (compatible && connection) status = view.baseUrl;
  else if (connection) status = copy.savedKey(connection.hint);

  const active = connection !== null && view.provider === provider;

  return (
    <SettingsRow
      control={
        editing ? null : (
          <>
            {connection ? (
              <Button disabled={test === "testing"} onClick={() => void runTest()} size="sm" variant="ghost">
                {test === "testing" ? copy.testing : copy.test}
              </Button>
            ) : null}
            {connection?.source === "saved" ? (
              <>
                <Button onClick={() => setEditing(true)} size="sm" variant="ghost">
                  {copy.replaceKey}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void save(
                      compatible
                        ? { baseUrl: null, ...keyUpdate(provider, null) }
                        : keyUpdate(provider, null),
                      copy.keyRemoved
                    )
                  }
                  size="sm"
                  variant="ghost">
                  {copy.removeKey}
                </Button>
              </>
            ) : null}
            {connection ? null : (
              <Button onClick={() => setEditing(true)} size="sm" variant="outline">
                {copy.addKey}
              </Button>
            )}
          </>
        )
      }
      description={
        <span className="flex min-w-0 items-center gap-1.5">
          <StatusDot connected={connection !== null} />
          <span className="truncate">{connection ? status : copy.providerDescriptions[provider]}</span>
        </span>
      }
      title={
        <>
          {name}
          {active ? (
            <Badge size="sm" variant="secondary">
              {copy.active}
            </Badge>
          ) : null}
        </>
      }>
      {editing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}>
          {compatible ? (
            <Input
              aria-invalid={baseUrl.length > 0 && !isHttpUrl(baseUrl)}
              aria-label={copy.baseUrl}
              autoFocus
              className="min-w-64 flex-1 font-mono"
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={DEFAULT_COMPATIBLE_BASE_URL}
              size="sm"
              spellCheck={false}
              value={baseUrl}
            />
          ) : null}
          <Input
            aria-label={compatible ? copy.optionalKey : `${name} API key`}
            autoComplete="off"
            autoFocus={!compatible}
            className="min-w-48 flex-1 font-mono"
            onChange={(event) => setKey(event.target.value)}
            placeholder={compatible ? copy.optionalKey : copy.keyPlaceholder}
            size="sm"
            spellCheck={false}
            type="password"
            value={key}
          />
          <Button disabled={busy || !canSave} size="sm" type="submit">
            {copy.save}
          </Button>
          <Button
            onClick={() => {
              setEditing(false);
              setKey("");
            }}
            size="sm"
            type="button"
            variant="ghost">
            {copy.cancel}
          </Button>
          {compatible ? (
            <p className="w-full text-muted-foreground text-xs">{copy.baseUrlDescription}</p>
          ) : null}
        </form>
      ) : null}
      {test && test !== "testing" ? (
        <p
          className={cn("text-xs", test.ok ? "text-success-foreground" : "text-destructive-foreground")}
          role="status">
          {test.ok
            ? test.models
              ? `${copy.testOk(name)} · ${copy.testModels(test.models.length)}`
              : copy.testOk(name)
            : `${copy.testFailed(name)}: ${test.error}`}
        </p>
      ) : null}
    </SettingsRow>
  );
}

/** The AI section: the model in use, and a row per provider to connect. */
export function AiSection({
  view,
  onViewChange,
}: {
  view: AiSettingsView | null;
  onViewChange: (view: AiSettingsView) => void;
}): React.ReactElement | null {
  const [found, setFound] = useState<Partial<Record<AiProvider, string[]>>>({});
  if (!view) return null;
  const groups = modelGroups(view, found);

  const change = async (update: AiUpdate) => {
    try {
      onViewChange(await saveAiSettings(update));
    } catch {
      toastManager.add({ type: "error", title: STUDIO_COPY.settings.saveFailed });
    }
  };

  return (
    <>
      <SettingsGroup title={copy.model}>
        <SettingsRow
          control={<ModelSelect groups={groups} onChange={(update) => void change(update)} view={view} />}
          description={groups.length === 0 ? copy.noConnection : copy.activeModelDescription}
          title={copy.activeModel}
        />
        <SettingsRow
          control={
            <ModelIdInput
              // A new provider or a model picked above starts the field over.
              key={`${view.provider}:${view.model}`}
              onChange={(update) => void change(update)}
              view={view}
            />
          }
          description={copy.customModelDescription}
          title={copy.customModel}
        />
      </SettingsGroup>
      <SettingsGroup description={copy.connectionsDescription(view.file)} title={copy.connections}>
        {AI_PROVIDERS.map((provider) => (
          <ConnectionRow
            key={provider}
            onModelsFound={(id, models) => setFound((current) => ({ ...current, [id]: models }))}
            onSaved={onViewChange}
            provider={provider}
            view={view}
          />
        ))}
      </SettingsGroup>
    </>
  );
}
