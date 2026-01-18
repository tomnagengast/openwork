Implementation notes (keep scope tight)

- **Review feedback (blocking)**: `npx eslint ...` reports errors in `src/renderer/src/components/settings/SettingsDialog.tsx`.
  - Add explicit return types:
    - `export function SettingsDialog(...): React.JSX.Element`
    - `async function loadSettings(): Promise<void>`
    - `async function handleRuntimeChange(...): Promise<void>`
    - `async function saveApiKey(...): Promise<void>`
    - `function handleKeyChange(...): void`
    - `function toggleShowKey(...): void`
  - Fix unused catch param (prefer `catch { ... }` where you don’t use the error).
  - Re-run `npx eslint src/renderer/src/components/settings/SettingsDialog.tsx` and ensure **0 errors** (warnings ok).

- Reuse the existing workspace metadata pattern in `src/main/ipc/models.ts` (parse `thread.metadata`, mutate one key, `updateThread(..., { metadata: JSON.stringify(metadata) })`).
- Avoid circular deps: if multiple IPC modules need the same electron-store instance, consider a tiny shared helper (e.g., `src/main/settings.ts`) rather than instantiating multiple stores pointing at the same file.
- Runtime selection should be computed once per request using the precedence in the task; make sure `invoke`, `resume`, and `interrupt` all use the same helper.
- UI: a new `RuntimePicker` can closely mirror `WorkspacePicker` (Popover + Button, load on mount via `window.api.agentRuntime.get(threadId)` and update on selection).
- Settings: keep API key edits accessible even if you filter by runtime (a “Show all providers” toggle is enough).
