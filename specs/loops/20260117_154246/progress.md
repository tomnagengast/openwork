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
