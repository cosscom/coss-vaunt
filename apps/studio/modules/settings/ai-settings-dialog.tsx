"use client";

import {
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsView,
  API_KEY_ENV,
  DEFAULT_MODELS,
} from "@calcom/product-video/ai/ai-providers";
import { Button } from "@coss/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@coss/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@coss/ui/components/field";
import { Form } from "@coss/ui/components/form";
import { Input } from "@coss/ui/components/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@coss/ui/components/select";
import { toastManager } from "@coss/ui/components/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { SettingsIcon } from "@coss/ui/icons";
import type * as React from "react";
import { useState } from "react";
import {
  type AiSettingsForm,
  aiSettingsRequest,
  hasKeyAfterSave,
  initialAiSettingsForm,
} from "./ai-settings-form";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.aiSettings;
const SETTINGS_URL = "/api/settings/ai";
const providerItems = AI_PROVIDERS.map((provider) => ({ value: provider, label: copy.providers[provider] }));

function AiSettingsFields({
  view,
  onSaved,
}: {
  view: AiSettingsView;
  onSaved: () => void;
}): React.ReactElement {
  const [form, setForm] = useState<AiSettingsForm>(() => initialAiSettingsForm(view));
  const [saving, setSaving] = useState(false);
  const update = (change: Partial<AiSettingsForm>) => setForm((current) => ({ ...current, ...change }));
  const source = view.keys[form.provider];
  const saved = source === "saved" && !form.removeKey;

  return (
    <Form
      className="contents"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          const response = await fetch(SETTINGS_URL, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(aiSettingsRequest(form)),
          });
          if (!response.ok) throw new Error(response.statusText);
          toastManager.add({ type: "success", title: copy.saved });
          onSaved();
        } catch {
          toastManager.add({ type: "error", title: copy.saveFailed });
        } finally {
          setSaving(false);
        }
      }}>
      <DialogPanel className="flex flex-col gap-4">
        <Field>
          <FieldLabel>{copy.provider}</FieldLabel>
          <Select
            items={providerItems}
            onValueChange={(provider: AiProvider | null) => {
              if (provider) update({ provider, apiKey: "", removeKey: false });
            }}
            value={form.provider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup alignItemWithTrigger={false}>
              {providerItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Field>
        <Field>
          <FieldLabel>{copy.apiKey}</FieldLabel>
          {source === "env" ? (
            <FieldDescription>{copy.envKey(API_KEY_ENV[form.provider])}</FieldDescription>
          ) : (
            <>
              <Input
                autoComplete="off"
                onChange={(event) => update({ apiKey: event.target.value })}
                placeholder={saved ? copy.savedKeyPlaceholder : copy.keyPlaceholder}
                spellCheck={false}
                type="password"
                value={form.apiKey}
              />
              {saved ? (
                <Button
                  className="self-start"
                  onClick={() => update({ apiKey: "", removeKey: true })}
                  size="sm"
                  type="button"
                  variant="ghost">
                  {copy.removeKey}
                </Button>
              ) : null}
            </>
          )}
        </Field>
        <Field>
          <FieldLabel>{copy.model}</FieldLabel>
          <Input
            onChange={(event) => update({ model: event.target.value })}
            placeholder={DEFAULT_MODELS[form.provider]}
            spellCheck={false}
            value={form.model}
          />
          <FieldDescription>{copy.modelHint}</FieldDescription>
        </Field>
        <p className="text-muted-foreground text-xs">{copy.file(view.file)}</p>
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />}>{copy.cancel}</DialogClose>
        <Button disabled={saving || !hasKeyAfterSave(form, view)} type="submit">
          {copy.save}
        </Button>
      </DialogFooter>
    </Form>
  );
}

/** The header button that opens the AI provider, key and model settings. */
export function AiSettingsButton(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AiSettingsView | null>(null);

  const openDialog = async () => {
    setView(null);
    setOpen(true);
    try {
      const response = await fetch(SETTINGS_URL);
      if (!response.ok) throw new Error(response.statusText);
      setView((await response.json()) as AiSettingsView);
    } catch {
      setOpen(false);
      toastManager.add({ type: "error", title: copy.loadFailed });
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={<Button aria-label={copy.open} onClick={openDialog} size="icon-sm" variant="ghost" />}>
          <SettingsIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipPopup>{copy.open}</TooltipPopup>
      </Tooltip>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          {view ? <AiSettingsFields key={view.file} onSaved={() => setOpen(false)} view={view} /> : null}
        </DialogPopup>
      </Dialog>
    </>
  );
}
