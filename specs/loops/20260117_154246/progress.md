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

### Validation
- `npm run typecheck` passes
- `npm run lint` passes (no new errors in modified files)
