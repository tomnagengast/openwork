# Task: Phase 3 Codex SDK runtime (adapter + wiring)

## Objective
Add a **Codex SDK** runtime adapter (`codex`) behind the existing `AgentRuntimeAdapter` abstraction, and wire it through the runtime factory so it can be exercised (dev-only) without changing the renderer.

This should be the second functional “non-deepagents” runtime (after `claude-sdk`), even if feature parity is incomplete. Keep deepagents + claude-sdk behavior unchanged.

## Non-goals (for this task)
- Do **not** add runtime selection UI yet.
- Do **not** refactor the renderer transport/event parsing yet.
- Full feature parity (todos/subagents/checkpoint history) is **not** required for this task.
- Do **not** change deepagents or claude-sdk behavior.

## Required changes

### 1) Add Codex SDK dependency
Add the Codex SDK package:
- `@openai/codex-sdk`

Pin a specific semver range (don’t use `latest`) and update the lockfile.

### 2) Implement Codex SDK adapter
Create `src/main/agent/runtimes/codex-sdk.ts` implementing `AgentRuntimeAdapter`.

Minimum requirements:
- `stream(input, signal)` runs the Codex SDK and yields IPC events:
  - Stream assistant output by yielding `{ type: 'token', messageId, token }` events.
  - End with `{ type: 'done' }` if not aborted.
  - Yield `{ type: 'error', error }` on failures (non-abort).
- Respect `AbortSignal` (stop streaming promptly on abort).
- Use the workspace path as the agent working directory (`cwd`) for tools/sandbox, if supported by the SDK.
- Session persistence (basic):
  - Persist the Codex thread/session identifier into Openwork thread metadata (e.g. `metadata.codexThreadId`).
  - On subsequent messages for the same Openwork thread, resume the Codex thread/session rather than starting a new one.
- HITL / permissions (minimal, no renderer changes):
  - Do **not** auto-approve destructive actions without user consent.
  - Prefer the Codex SDK’s built-in permission/approval hooks/callbacks if available.
  - If no hooks exist, implement a minimal Electron main-process modal (e.g. `dialog.showMessageBox`) to Allow/Deny for tool usage (similar to `claude-sdk.ts`).

Notes:
- `resume(...)` and `interrupt(...)` must exist (interface requires them). If proper HITL mapping isn’t feasible with the SDK yet, it’s acceptable for these methods to yield a single `{ type: 'error', error: 'Not supported' }` and return (do not throw unhandled errors).

### 3) Wire through runtime-factory
Update `src/main/agent/runtime-factory.ts`:
- Add a `codex` case that returns the new adapter.
- Keep `deepagents` as default.

### 4) Dev-only runtime selection (no UI)
`src/main/ipc/agent.ts` already allows `OPENWORK_AGENT_RUNTIME=codex`.

Ensure it works end-to-end by returning the Codex adapter from the runtime factory when `codex` is selected.

## Acceptance criteria
- `npm run typecheck` passes.
- `npm run lint` passes (or, if repo-wide lint is failing unrelatedly, at least no new lint errors from the changed files).
- With `OPENWORK_AGENT_RUNTIME=codex` and a configured OpenAI key, the app can:
  - Start a thread, send a message, and receive an assistant response (at least token-streamed or chunked).
  - If a tool/sandbox action requires permission, a modal approval prompt appears and the run continues based on the choice.
- With `OPENWORK_AGENT_RUNTIME` unset, deepagents behavior remains unchanged.

## Follow-ups (not part of this task)
- Emit richer tool_call/tool_result/interrupt events for Codex to match deepagents UX more closely.
- Replace modal approvals with the existing in-app HITL UI.
- Add settings UI + per-thread runtime override.
