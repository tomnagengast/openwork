# Task: Phase 4 — runtime selection UI + persistence

## Objective
Make agent runtime selection user-facing and persistent:
- Global default runtime (settings)
- Per-thread runtime override (thread metadata)
- Main process uses the selected runtime (no longer dev-only via `OPENWORK_AGENT_RUNTIME`)

Runtimes: `deepagents` | `claude-sdk` | `codex`

## Non-goals (for this task)
- Do not change streaming event shapes or renderer parsing beyond what’s needed to surface selection UI.
- Do not attempt to fully implement `resume()` / `interrupt()` for Codex beyond what already exists.
- Do not redesign HITL; keep current modal approvals as-is.

## Required changes

### 1) Persist a global default runtime (main process)
Add a non-sensitive settings key (electron-store, same store used for models/workspace is fine):
- Key: `defaultAgentRuntime`
- Default: `deepagents`

Add IPC handlers (names can vary, but keep them consistent and typed):
- `agentRuntime:getDefault` → returns `RuntimeType`
- `agentRuntime:setDefault` → sets `defaultAgentRuntime` (validate allowed values)

### 2) Add per-thread runtime override (thread metadata)
Store override in thread metadata (do not overwrite other metadata keys like `workspacePath`, `codexThreadId`, `claudeSessionId`):
- Key: `agentRuntime` (string union)

Add IPC handlers:
- `agentRuntime:get` (threadId) → returns the *effective* runtime for that thread:
  - if thread metadata has `agentRuntime`, use it
  - else fall back to `defaultAgentRuntime`
- `agentRuntime:set` (threadId, runtimeOrNull) → if null, clear `agentRuntime`; else set it (validate allowed values)

### 3) Main agent selection precedence (invoke/resume/interrupt)
Update `src/main/ipc/agent.ts` runtime selection so it’s not dev-only.

Precedence (highest → lowest):
1. `OPENWORK_AGENT_RUNTIME` env var (dev override; keep existing behavior)
2. Thread metadata override: `metadata.agentRuntime`
3. Global default: `defaultAgentRuntime`
4. Fallback: `deepagents`

Ensure **all** handlers use the same selection logic:
- `agent:invoke`
- `agent:resume`
- `agent:interrupt`

### 4) Expose APIs to the renderer (preload)
Expose in `window.api`:
- `window.api.agentRuntime.getDefault()`
- `window.api.agentRuntime.setDefault(runtime)`
- `window.api.agentRuntime.get(threadId)`
- `window.api.agentRuntime.set(threadId, runtimeOrNull)`

Update both `src/preload/index.ts` and `src/preload/index.d.ts` accordingly.

### 5) Add UI controls

#### Settings (global default)
Update `src/renderer/src/components/settings/SettingsDialog.tsx`:
- Add an “Agent Runtime” section with a simple radio/segmented control:
  - deepagents
  - Claude SDK
  - Codex
- Load the current default when the dialog opens.
- Persist changes via `window.api.agentRuntime.setDefault(...)`.

API key UI behavior (minimal but user-friendly):
- Show the API key field(s) relevant to the selected runtime (Anthropic for Claude SDK, OpenAI for Codex).
- Keep a way to reveal/edit the other API keys (toggle “Show all providers” is fine).

#### Per-thread override (chat)
Add a small picker next to `ModelSwitcher` / `WorkspacePicker` in `src/renderer/src/components/chat/ChatContainer.tsx`:
- Shows the current effective runtime for this thread
- Allows choosing:
  - “Use default” (clears per-thread override)
  - deepagents
  - Claude SDK
  - Codex
- Persists via `window.api.agentRuntime.set(threadId, ...)`

## Acceptance criteria
- `npm run typecheck` passes.
- `npm run lint` passes (or at least no new lint/type errors introduced by this task).
- With `OPENWORK_AGENT_RUNTIME` **unset**, changing the runtime in Settings changes the runtime used for new agent runs.
- Per-thread override persists (stored in thread metadata) and takes precedence over the global default.
- With `OPENWORK_AGENT_RUNTIME` **set**, it overrides both UI settings (dev/test behavior preserved).

