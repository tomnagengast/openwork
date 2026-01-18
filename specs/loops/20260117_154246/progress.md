# Progress Log

## Phase 1: Runtime Abstraction (deepagents wrapped)

### Changes Made

1. **src/main/agent/types.ts** - Added runtime abstraction types:
   - `RuntimeType` union (`'deepagents' | 'claude-sdk' | 'codex'`)
   - `StreamInput`, `ResumeArgs`, `InterruptArgs` interfaces
   - `RuntimeStreamEvent` type matching existing IPC payloads
   - `AgentRuntimeAdapter` interface with `stream()`, `resume()`, `interrupt()` methods

2. **src/main/agent/runtimes/deepagents.ts** (new) - Created deepagents adapter:
   - Implements `AgentRuntimeAdapter` interface
   - Wraps existing `createAgentRuntime()` logic
   - Preserves all behavior: checkpointing, LocalSandbox, HITL, streamMode

3. **src/main/agent/runtime-factory.ts** (new) - Created runtime factory:
   - `createRuntime(type, opts)` returns adapter instance
   - Currently always returns deepagents adapter (Phase 1 scope)

4. **src/main/ipc/agent.ts** - Refactored to use runtime factory:
   - Removed direct HumanMessage/Command imports (moved to adapter)
   - `agent:invoke` → uses `runtime.stream()`
   - `agent:resume` → uses `runtime.resume()`
   - `agent:interrupt` → uses `runtime.interrupt()`
   - IPC payloads unchanged; renderer unaffected

### Validation
- `npm run typecheck` passes
- `npm run lint` passes (no errors in modified files)

---

## Phase 2: Claude Agent SDK Runtime Adapter

### Changes Made

1. **package.json** - Added dependency:
   - `@anthropic-ai/claude-agent-sdk@^0.2.12`

2. **src/main/agent/types.ts** - Extended `RuntimeStreamEvent`:
   - Added `{ type: 'token'; messageId: string; token: string }` for Claude SDK streaming
   - Added `{ type: 'error'; error: string }` as common error event

3. **src/main/agent/runtimes/claude-sdk.ts** (new) - Claude SDK adapter:
   - Implements `AgentRuntimeAdapter` interface
   - `stream()`: runs Claude SDK, emits token events, captures session ID
   - `resume()`: resumes session using stored `claudeSessionId`
   - `interrupt()`: handles HITL interrupts
   - Uses Electron `dialog.showMessageBox` for tool approval (minimal HITL)
   - Persists `claudeSessionId` in thread metadata for session resumption
   - Falls back to `claude-sonnet-4-5-20250929` if model not Claude

4. **src/main/agent/runtime-factory.ts** - Wired Claude SDK:
   - `'claude-sdk'` case now returns `createClaudeSdkAdapter()`

5. **src/main/ipc/agent.ts** - Env var runtime selection:
   - Added `getRuntimeType()` reading `OPENWORK_AGENT_RUNTIME`
   - Valid values: `deepagents`, `claude-sdk` (default: `deepagents`)
   - All three handlers (`invoke`, `resume`, `interrupt`) use `getRuntimeType()`

### Validation
- `npm run typecheck` passes
- `npm run lint` passes (no new errors in modified files)

---

## Phase 3: Codex SDK Runtime Adapter

### Changes Made

1. **package.json** - Added dependency:
   - `@openai/codex-sdk@^0.87.0`

2. **src/main/agent/runtimes/codex-sdk.ts** (new) - Codex SDK adapter:
   - Implements `AgentRuntimeAdapter` interface
   - `stream()`: runs Codex SDK, emits token events from `agent_message` items
   - Captures Codex `thread_id` from `thread.started` event
   - Persists `codexThreadId` in thread metadata for session resumption
   - Resumes existing threads using `codex.resumeThread()`
   - Uses `approvalPolicy: 'on-request'` for HITL (SDK-native, no dialog fallback yet)
   - `skipGitRepoCheck: true` for workspace flexibility
   - Falls back to `gpt-5-codex` if model not OpenAI/Codex
   - `resume()` and `interrupt()` yield error stubs (not fully supported yet)

3. **src/main/agent/runtime-factory.ts** - Wired Codex SDK:
   - `'codex'` case now returns `createCodexSdkAdapter()`
   - Updated comment to reflect all three runtimes supported

4. **src/main/agent/runtimes/codex-sdk.ts** - Fixed unused param errors:
   - Used `void args` / `void signal` to satisfy both TS6133 and ESLint
   - Formatted `interrupt()` signature to single line for prettier

5. **src/main/agent/runtimes/codex-sdk.ts** - Fixed API key wiring:
   - Changed from `env: { OPENAI_API_KEY: ... }` to `apiKey: process.env.OPENAI_API_KEY`
   - The SDK only injects `CODEX_API_KEY` when `apiKey` is explicitly provided
   - Without this fix, Codex SDK cannot authenticate when custom `env` is passed

6. **src/main/agent/runtimes/codex-sdk.ts** - Implemented pre-turn Electron modal for HITL:
   - `approvalPolicy: 'on-request'` doesn't work with TS SDK wrapper (stdin closed, CLI can't prompt mid-turn)
   - Added `showCodexTurnApprovalDialog()`: modal at start of each turn asking "Allow Codex to run tools / write to the workspace?"
   - If Allow: `sandboxMode: 'workspace-write'`, `approvalPolicy: 'never'`
   - If Deny: `sandboxMode: 'read-only'`, `approvalPolicy: 'never'`
   - Default behavior is now non-destructive when user denies

### Validation
- `npm run typecheck` passes
- `npm run lint` passes (no new errors in modified files)

---

## Phase 4: Runtime Selection UI + Persistence

### Changes Made

1. **src/main/ipc/models.ts** - Added global default runtime setting:
   - Added `RuntimeType` import and `VALID_RUNTIMES` constant
   - Added `isValidRuntime()` type guard
   - IPC handlers: `agentRuntime:getDefault`, `agentRuntime:setDefault`
   - IPC handlers: `agentRuntime:get` (effective for thread), `agentRuntime:set` (per-thread override)
   - Exported `getDefaultAgentRuntime()` for use in agent.ts
   - Stores `defaultAgentRuntime` in electron-store settings

2. **src/main/ipc/agent.ts** - Updated runtime selection logic:
   - `getRuntimeType(threadId)` now uses precedence:
     1. `OPENWORK_AGENT_RUNTIME` env var (dev override)
     2. Thread metadata `agentRuntime` (per-thread override)
     3. Global `defaultAgentRuntime` setting
     4. Fallback: `'deepagents'`
   - All handlers (`invoke`, `resume`, `interrupt`) now pass threadId

3. **src/preload/index.ts** + **src/preload/index.d.ts** - Exposed APIs:
   - `window.api.agentRuntime.getDefault()`
   - `window.api.agentRuntime.setDefault(runtime)`
   - `window.api.agentRuntime.get(threadId)`
   - `window.api.agentRuntime.set(threadId, runtimeOrNull)`

4. **src/renderer/src/components/chat/RuntimePicker.tsx** (new) - Per-thread picker:
   - Shows effective runtime for thread with "(override)" indicator
   - Options: "Use default" (clears override), deepagents, claude-sdk, codex
   - Loads thread metadata to detect existing override

5. **src/renderer/src/components/chat/ChatContainer.tsx** - Added RuntimePicker:
   - Positioned between ModelSwitcher and WorkspacePicker

6. **src/renderer/src/components/settings/SettingsDialog.tsx** - Added global default:
   - "AGENT RUNTIME" section with 3-column grid of runtime options
   - API key section now shows "Show all providers" toggle
   - Relevant API keys displayed based on selected runtime

### Validation
- `npm run typecheck` passes
- `npm run lint` passes (no new errors introduced)
- `npm run build` succeeds
