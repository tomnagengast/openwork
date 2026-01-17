# deepagentsjs Integration

OpenWork integrates deepagentsjs (`deepagents ^1.5.0`) as its agent harness.

## What is deepagentsjs?

LangChain's opinionated LLM agent framework built on LangGraph. Provides:
- State machine-based agent execution
- Built-in tool schemas via `FilesystemBackend`
- Checkpoint-based state persistence
- Interrupt-based human-in-the-loop

## Integration Points

### Agent Runtime (`src/main/agent/runtime.ts`)

Creates agents via `createDeepAgent()`:

```typescript
createDeepAgent({
  model,                    // LLM provider instance
  checkpointer,             // SqlJsSaver for persistence
  backend: LocalSandbox,    // Custom filesystem backend
  systemPrompt,             // Agent instructions
  filesystemSystemPrompt,   // Tool documentation
  interruptOn: { execute: true }
})
```

### Local Sandbox (`src/main/agent/local-sandbox.ts`)

Custom `LocalSandbox` extends deepagents' `FilesystemBackend`:
- File operations (read, write, edit)
- Shell command execution
- Working directory management

### Model Providers

Supports multiple LLM providers:
- `ChatAnthropic` - Claude models
- `ChatOpenAI` - GPT models
- `ChatGoogleGenerativeAI` - Gemini models

## LangGraph State Machine

deepagentsjs wraps LangGraph, which provides:
- Graph-based state machines
- Nodes as agent steps
- Edges as transitions
- Built-in checkpointing

## Tool Schema

Tools defined via `FilesystemBackend` schema:
- File reading/writing
- Directory operations
- Shell execution
- Tool documentation auto-generated

## Related Docs

- [architecture.md](./architecture.md) - Overall architecture
- [streaming.md](./streaming.md) - How streaming works
- [hitl.md](./hitl.md) - Interrupt-based HITL
