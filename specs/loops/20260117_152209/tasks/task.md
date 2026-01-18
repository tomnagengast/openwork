# Task: Phase 1 runtime abstraction (deepagents wrapped)

## Objective
Introduce an agent runtime abstraction layer and a runtime factory, then refactor the existing deepagents integration to run behind that abstraction **without changing behavior** (deepagents remains the only runtime actually used for now).

This unblocks Phase 2/3 (Claude Agent SDK + Codex SDK) by making the IPC layer runtime-agnostic.

## Non-goals (for this task)
- Do **not** add Claude SDK or Codex SDK dependencies yet.
- Do **not** add UI/runtime selection yet.
- Do **not** change renderer parsing or IPC event shapes (keep current `agent:stream:*` payloads exactly as today).

## Required changes

### 1) Define the runtime abstraction
Create/extend `src/main/agent/types.ts` to define:
- `RuntimeType` union: `'deepagents' | 'claude-sdk' | 'codex'`
- `StreamInput` (at minimum): `{ threadId: string; message: string; workspacePath: string; modelId?: string }`
- `AgentRuntimeAdapter` interface with *at least*:
  - `stream(input: StreamInput, signal: AbortSignal): AsyncGenerator<{ type: 'stream'; mode: 'messages' | 'values'; data: unknown } | { type: 'done' }>`
  - `resume(args: { threadId: string; workspacePath: string; command: unknown }, signal: AbortSignal): AsyncGenerator<{ type: 'stream'; mode: 'messages' | 'values'; data: unknown } | { type: 'done' }>`
  - (Optional) `interrupt(...)` if you want to unify `agent:interrupt`; otherwise leave it in IPC for now.

Notes:
- Keep the event payloads identical to what `src/main/ipc/agent.ts` currently sends (`{ type: 'stream', mode, data }` and `{ type: 'done' }`), so the renderer remains unchanged in this task.
- Preserve the existing `DeepAgent` type used by `src/renderer/src/lib/thread-context.tsx` (either keep it exported from `src/main/agent/types.ts`, or update that import in a minimal way).

### 2) Deepagents runtime adapter
Create `src/main/agent/runtimes/deepagents.ts` that implements `AgentRuntimeAdapter` using the current logic in `src/main/agent/runtime.ts`:
- Model selection (`getDefaultModel()` + provider API keys)
- Per-thread checkpointer caching (`SqlJsSaver` + `getThreadCheckpointPath`)
- `LocalSandbox` setup
- System prompt generation (`BASE_SYSTEM_PROMPT` + workspacePath preamble)
- `interruptOn: { execute: true }` and `streamMode: ['messages','values']` behavior must remain

Refactor approach:
- Move the deepagents-specific creation + streaming logic into this adapter.
- Keep `src/main/agent/runtime.ts` in place for now (don’t delete). It may re-export/backward-compat `createAgentRuntime()` or become a thin wrapper calling the adapter—whichever is lowest-risk.

### 3) Runtime factory
Create `src/main/agent/runtime-factory.ts`:
- Expose `createRuntime(type: RuntimeType, opts: { threadId: string; workspacePath: string; modelId?: string }): AgentRuntimeAdapter`
- For this task, `createRuntime(...)` should always return the deepagents adapter (ignore `type` or default it to `'deepagents'`).
- Keep the API stable for later tasks when other runtimes are added.

### 4) IPC layer: use the factory/adapter
Modify `src/main/ipc/agent.ts` to be runtime-agnostic:
- Replace direct `createAgentRuntime(...)` usage with `createRuntime('deepagents', ...)`
- Iterate the adapter’s async generator and forward events to the renderer **exactly** as today.
- Preserve existing AbortController behavior:
  - Still prevent concurrent streams per thread (existing `activeRuns` map).
  - Still abort on window close.
  - Still send `{ type: 'done' }` only when not aborted.

Keep the public IPC contract unchanged:
- `agent:invoke`, `agent:resume`, `agent:interrupt`, `agent:cancel` remain.
- `window.api.agent.streamAgent(...)` in preload and `ElectronIPCTransport` should not require changes for this task.

## Acceptance criteria
- `pnpm run typecheck` passes.
- `pnpm run lint` passes (or any lint command defined in repo conventions).
- Manual smoke check (developer-run): streaming still works; resume continues to work; cancel still aborts.
- No changes required to renderer code to keep current functionality.

## Follow-ups (not part of this task)
- Emit normalized runtime events (remove deepagents-specific parsing from renderer).
- Implement Claude Agent SDK runtime adapter.
- Implement Codex SDK runtime adapter.
- Add settings UI + per-thread override for runtime type.
