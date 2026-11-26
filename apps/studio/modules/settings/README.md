# Settings

The studio's settings: one full-window screen, on every page. ⌘, opens it (Ctrl+, elsewhere), Esc or × closes it.
The title bars' gear and the agent's model picker ("AI settings…") open it at AI.

| File | What it is |
| --- | --- |
| `settings-provider.tsx` | The context every page shares: opens the screen, listens for ⌘,, loads the appearance and applies it to the page and the desktop window |
| `settings-screen.tsx` | The screen: the nav with search, the breadcrumb header, Restore defaults, the sections |
| `settings-sections.ts` | The sections, their nav groups, and what search matches |
| `settings-rows.tsx` | `SettingsGroup` and `SettingsRow`, the parts every section is made of |
| `general-section.tsx`, `appearance-section.tsx`, `ai-section.tsx`, `keybindings-section.tsx`, `about-section.tsx` | The sections |
| `ai-connections.ts` | The pickers' model lists per connected provider, and the requests that save keys |
| `appearance.ts` | What the glass setting puts on `<html>` |
| `settings-button.tsx` | The gear in the title bars |

Everything is saved in the engine's settings file, `$XDG_CONFIG_HOME/coss-vaunt/settings.json` (version 2: `ai` and
`appearance`; a version 1 file, the AI settings alone, is read as the `ai` part and rewritten on the next save). The
theme is the exception: next-themes keeps it in localStorage, since it has to apply before the first paint.

## Decided (November 2026)

Modelled on T3 Code's settings.

- **A screen, not a dialog:** it covers the whole window, on the editor shell's color, with one card inside: the nav
  on the left (search with `/`, then General and Appearance, "Studio": AI and Keybindings, "App": About), the
  section on the right under "Settings / Section", with Restore defaults and × at the right of that header. It
  fades in (200 ms, ease-out, a 1% scale; opacity only with reduced motion). In the desktop window the strip above
  the card drags the window.
- **Rows:** each section is groups of rows on a card, a title above each group; a row is the title and description
  on the left and its control on the right. A row that needs more (a key being typed, a test's result) opens under
  its title.
- **Restore defaults** resets everything but the connections: the theme to System, glass off at 64% tint, the model
  back to the provider's default. Keys stay.
- **General:** where projects and the settings file are, and "Show again" for the onboarding.
- **Appearance:** the theme (System / Light / Dark, moved here from the title bar's toggle), and the window's glass:
  a switch for macOS vibrancy behind the editor's shell and a tint slider (how much of the shell's color sits over
  the glass, 0–100%). The cards stay opaque. In a browser, or a window binary without the command, the switch is
  disabled with a note that it's the desktop window's.
- **AI:** the model in use (a select of every connected provider's models, then a model id field for anything else),
  then a row per provider: Anthropic, OpenAI, Google Gemini, xAI, Mistral, Groq, OpenRouter, Vercel AI Gateway and
  OpenAI-compatible (a base URL, like Ollama's or LM Studio's, and an optional key). A row says whether it's
  connected and how ("Saved key …abcd", "From GROQ_API_KEY", the server's address), and offers Add key, Replace,
  Remove and Test. Test asks the provider's default model for one word (a few tokens), or the compatible server for
  its models, which then join the model list. A key in the environment wins over a saved one and can't be removed
  here. The first connection made while nothing works becomes the model in use.
- **Keybindings:** the editor's keymap, read-only, grouped like the shortcuts dialog.
- **About:** the version (`vaunt start` passes it; a checkout says "dev") and whether it runs in the desktop window.
