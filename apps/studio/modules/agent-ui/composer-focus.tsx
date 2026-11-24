export const AGENT_COMPOSER_INPUT_SLOT = "composer-input";

export function getAgentComposerInput(container: ParentNode | null | undefined): HTMLElement | null {
  return (
    container?.querySelector<HTMLElement>(
      `[data-slot="${AGENT_COMPOSER_INPUT_SLOT}"][contenteditable="true"], textarea[data-slot="${AGENT_COMPOSER_INPUT_SLOT}"]:not(:disabled)`
    ) ?? null
  );
}

export function focusAgentComposerInput(container: ParentNode | null | undefined): boolean {
  const input = getAgentComposerInput(container);
  if (!input) return false;

  input.focus({ preventScroll: true });
  if (input instanceof HTMLTextAreaElement) {
    input.setSelectionRange(input.value.length, input.value.length);
    return true;
  }
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  return true;
}

export function clearAgentComposerNativeSelection(container: ParentNode): void {
  const input = getAgentComposerInput(container);
  const selection = input?.ownerDocument.getSelection();
  if (!selection?.anchorNode || !input?.contains(selection.anchorNode)) return;

  // WebKit otherwise reuses the old caret geometry when Base UI blurs and refocuses the mobile editor.
  selection.removeAllRanges();
}
