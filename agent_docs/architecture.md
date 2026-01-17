# Agent Architecture

OpenWork uses **deepagentsjs** (`deepagents ^1.5.0`) - LangChain's opinionated LLM agent framework built on LangGraph.

## Data Flow

```
User Input → React UI → Electron IPC → Main Process → DeepAgent → LLM API
                ↓
Streaming Response ← IPC Events ← LangGraph Stream ← Agent Runtime
```

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Agent Runtime | `src/main/agent/runtime.ts` | Creates agent via `createDeepAgent()` |
| Local Sandbox | `src/main/agent/local-sandbox.ts` | Custom `LocalSandbox` extends `FilesystemBackend` |
| IPC Handlers | `src/main/ipc/agent.ts` | IPC handlers for streaming |
| Electron Transport | `src/renderer/src/lib/electron-transport.ts` | Custom transport for `useStream` SDK |
| Thread Context | `src/renderer/src/lib/thread-context.tsx` | Per-thread state management |
| Checkpointer | `src/main/checkpointer/sqljs-saver.ts` | SQL.js-based checkpoint persistence |

## Agent Configuration

```typescript
createDeepAgent({
  model,                    // ChatAnthropic | ChatOpenAI | ChatGoogleGenerativeAI
  checkpointer,             // SqlJsSaver (per-thread)
  backend: LocalSandbox,    // File ops + shell execution
  systemPrompt,             // Custom instructions
  filesystemSystemPrompt,   // Tool docs
  interruptOn: { execute: true }  // HITL for shell commands
})
```

## Request Lifecycle

1. User submits message via `ChatContainer` (renderer)
2. IPC sends `agent:invoke` to main process
3. Main process creates agent runtime with `createDeepAgent()`
4. Agent streams with dual modes: `messages` (tokens) + `values` (state)
5. Custom `ElectronIPCTransport` converts IPC events to `useStream` SDK format
6. UI renders tokens in real-time via React state

## State Persistence

- Each thread has its own SQL.js checkpointer
- Checkpoints stored in LangGraph state format
- Thread context manages per-conversation state in React

## Related Docs

- [deepagents-integration.md](./deepagents-integration.md) - deepagentsjs integration details
- [streaming.md](./streaming.md) - Streaming architecture
- [hitl.md](./hitl.md) - Human-in-the-loop implementation
- [sdk-comparison.md](./sdk-comparison.md) - SDK comparisons
