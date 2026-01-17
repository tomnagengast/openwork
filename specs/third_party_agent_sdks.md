# Third-Party Agent SDKs Integration

Support Claude Agent SDK and Codex SDK as alternatives to deepagentsjs.

## Goals

- User selects agent runtime (deepagents, claude-sdk, codex) per-thread or globally
- Same UI experience regardless of backend
- Preserve existing features: HITL, streaming, persistence, subagents

## Architecture Changes

### 1. Runtime Abstraction Layer

Create `AgentRuntimeAdapter` interface:

```typescript
// src/main/agent/types.ts
interface AgentRuntimeAdapter {
  stream(input: StreamInput): AsyncGenerator<StreamEvent>
  resume(decision: HITLDecision): AsyncGenerator<StreamEvent>
  cancel(): void
}

interface StreamInput {
  message: string
  threadId: string
  workspacePath: string
}

interface StreamEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'interrupt' | 'values' | 'done' | 'error'
  data: unknown
}
```

### 2. Runtime Implementations

#### deepagentsjs (existing)
- File: `src/main/agent/runtimes/deepagents.ts`
- Wraps existing `createDeepAgent()` + `LocalSandbox`
- Uses LangGraph checkpointing

#### Claude Agent SDK
- File: `src/main/agent/runtimes/claude-sdk.ts`
- Install: `@anthropic-ai/claude-agent-sdk`
- Key mappings:
  | deepagents | Claude SDK |
  |------------|------------|
  | `createDeepAgent()` | `query()` function |
  | `LocalSandbox.execute` | Built-in `Bash` tool |
  | `FilesystemBackend` | Built-in `Read/Write/Edit/Glob/Grep` tools |
  | `SqlJsSaver` | Session persistence via `resume` option |
  | `interruptOn` | `permissionMode` + `hooks` (PreToolUse/PostToolUse) |
  | LangGraph state | `query()` async generator yields `SDKMessage` |
  | `task` tool | `agents` option with `AgentDefinition` |

```typescript
// src/main/agent/runtimes/claude-sdk.ts
import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

class ClaudeSDKRuntime implements AgentRuntimeAdapter {
  private opts: RuntimeOptions
  private currentQuery: ReturnType<typeof query> | null = null

  constructor(opts: RuntimeOptions) {
    this.opts = opts
  }

  async *stream(input: StreamInput): AsyncGenerator<StreamEvent> {
    const options: Options = {
      model: this.opts.modelId || 'claude-sonnet-4-5-20250929',
      cwd: this.opts.workspacePath,
      resume: input.threadId,  // Resume session by ID
      systemPrompt: getSystemPrompt(this.opts.workspacePath),
      tools: { type: 'preset', preset: 'claude_code' },  // All built-in tools
      permissionMode: 'default',  // HITL for dangerous operations
      hooks: {
        PreToolUse: [{
          matcher: 'Bash',  // Hook for shell commands
          hooks: [async (hookInput) => this.handlePreToolUse(hookInput)]
        }]
      }
    }

    this.currentQuery = query({ prompt: input.message, options })

    for await (const msg of this.currentQuery) {
      yield this.convertToStreamEvent(msg)
    }
  }

  private convertToStreamEvent(msg: SDKMessage): StreamEvent {
    switch (msg.type) {
      case 'assistant':
        return { type: 'token', data: msg.message }
      case 'result':
        return { type: 'done', data: { session_id: msg.session_id } }
      // ... handle other message types
    }
  }
}
```

#### Codex SDK
- File: `src/main/agent/runtimes/codex-sdk.ts`
- Install: `@openai/codex-sdk`
- Key mappings:
  | deepagents | Codex SDK |
  |------------|-----------|
  | Thread ID | Thread object from `startThread()` / `resumeThread()` |
  | `LocalSandbox` | Codex built-in sandbox |
  | Streaming | `thread.runStreamed()` with async generator |
  | Blocking | `thread.run()` for simple cases |
  | Session persistence | `~/.codex/sessions` (automatic) |

```typescript
// src/main/agent/runtimes/codex-sdk.ts
import { Codex } from '@openai/codex-sdk'

class CodexRuntime implements AgentRuntimeAdapter {
  private codex: Codex
  private thread: ReturnType<Codex['startThread']> | null = null
  private opts: RuntimeOptions

  constructor(opts: RuntimeOptions) {
    this.opts = opts
    this.codex = new Codex()  // Uses OPENAI_API_KEY env var
  }

  async *stream(input: StreamInput): AsyncGenerator<StreamEvent> {
    // Resume existing thread or start new
    this.thread = input.threadId
      ? this.codex.resumeThread(input.threadId)
      : this.codex.startThread()

    // runStreamed() returns async generator of structured events
    const stream = this.thread.runStreamed(input.message)

    for await (const event of stream) {
      yield this.convertToStreamEvent(event)
    }
  }

  private convertToStreamEvent(event: unknown): StreamEvent {
    // Codex events: tool_call, tool_result, text, done, etc.
    // Map to our normalized StreamEvent format
    // ...
  }
}
```

### 3. Runtime Factory

```typescript
// src/main/agent/runtime-factory.ts
type RuntimeType = 'deepagents' | 'claude-sdk' | 'codex'

function createRuntime(type: RuntimeType, opts: RuntimeOptions): AgentRuntimeAdapter {
  switch (type) {
    case 'deepagents': return new DeepAgentsRuntime(opts)
    case 'claude-sdk': return new ClaudeSDKRuntime(opts)
    case 'codex': return new CodexRuntime(opts)
  }
}
```

### 4. Transport Layer Changes

Update `ElectronIPCTransport` to:
- Accept normalized `StreamEvent` from any runtime
- Remove deepagents-specific parsing (move to runtime)
- Keep UI event conversion logic

### 5. HITL Mapping

| Feature | deepagents | Claude SDK | Codex |
|---------|------------|------------|-------|
| Trigger | `interruptOn: { execute: true }` | `permissionMode: 'default'` + PreToolUse hooks | Built-in sandbox approval |
| Pause | `__interrupt__` state | Hook returns `{ decision: 'ask', permissionDecision: 'ask' }` | Sandbox blocks execution |
| Resume | `Command({ resume })` | Query continues after permission granted | Sandbox auto-resumes |
| Config | Per-tool interrupt config | `canUseTool()` callback or hooks | Sandbox settings |

**Claude SDK Hook Example:**
```typescript
hooks: {
  PreToolUse: [{
    matcher: 'Bash',
    hooks: [async (input) => ({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',  // 'allow' | 'deny' | 'ask'
        permissionDecisionReason: 'Shell command requires approval'
      }
    })]
  }]
}
```

### 6. Persistence Mapping

| Feature | deepagents | Claude SDK | Codex |
|---------|------------|------------|-------|
| Storage | SQL.js per-thread | Session file/DB | Thread API |
| Resume | Checkpoint tuple | `session_id` | `thread_id` |
| Fork | Checkpoint copy | Session fork | Thread copy |

## File Changes

```
src/main/agent/
├── types.ts                    # NEW: AgentRuntimeAdapter interface
├── runtime-factory.ts          # NEW: Runtime factory
├── runtimes/
│   ├── deepagents.ts           # REFACTOR: Existing runtime wrapped
│   ├── claude-sdk.ts           # NEW: Claude Agent SDK adapter
│   └── codex-sdk.ts            # NEW: Codex SDK adapter
├── local-sandbox.ts            # KEEP: Used by deepagents runtime
├── system-prompt.ts            # KEEP: Shared system prompts
└── runtime.ts                  # DEPRECATE: Replace with factory

src/main/ipc/
├── agent.ts                    # MODIFY: Use runtime factory
└── models.ts                   # MODIFY: Add runtime type to config

src/renderer/src/lib/
└── electron-transport.ts       # MODIFY: Accept normalized events

src/main/checkpointer/
└── sqljs-saver.ts              # KEEP: Used by deepagents only
```

## Settings UI

Add runtime selector to settings:
- Radio: "Agent Runtime" → deepagents | Claude SDK | Codex
- Show relevant API key field based on selection
- Per-thread override via thread metadata

## Migration Path

1. Phase 1: Abstract existing deepagents into adapter
2. Phase 2: Implement Claude SDK adapter
3. Phase 3: Implement Codex adapter
4. Phase 4: UI for runtime selection

## Dependencies

```json
{
  "dependencies": {
    "deepagents": "^1.5.0",
    "@anthropic-ai/claude-agent-sdk": "^0.2.11",
    "@openai/codex-sdk": "latest"
  }
}
```

**Note:** Claude Agent SDK requires Claude Code executable bundled or installed. Codex SDK requires OpenAI API key with Codex access.

## Open Questions

1. **Session/thread persistence**: Claude SDK uses session_id, Codex uses thread_id. Map to existing threadId or create separate storage?

2. **Tool schema normalization**: Each SDK has different tool schemas. Normalize at adapter level or keep SDK-native?

3. **Subagent compatibility**: deepagents has `task` tool, Claude SDK has `AgentDefinition`, Codex uses Agents SDK. Create unified subagent interface?

4. **Model provider lock-in**: Claude SDK → Claude only, Codex → GPT only. Allow mixing (e.g., Claude SDK runtime but with thinking traces from deepagents)?

5. **Checkpoint format**: Should Claude SDK/Codex adapters store checkpoints in same SQL.js format for UI consistency, or use native persistence?

6. **HITL granularity**: deepagents interrupts per-tool, Claude SDK has fine-grained permissions. Expose full Claude SDK permissions or simplify?
