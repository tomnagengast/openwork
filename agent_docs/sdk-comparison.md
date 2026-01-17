# SDK Comparison

Comparison of OpenWork's agent architecture with Claude Agent SDK and Codex SDK.

## OpenWork vs Claude Agent SDK

| Aspect | OpenWork (deepagentsjs) | Claude Agent SDK |
|--------|------------------------|------------------|
| **Framework** | LangGraph + deepagents | Claude Code harness (built-in agent loop) |
| **Model Integration** | ChatAnthropic/ChatOpenAI/ChatGoogleGenerativeAI | Direct Anthropic API (+ Bedrock/Vertex) |
| **Multi-provider** | Yes (Anthropic, OpenAI, Google) | Anthropic-focused (Bedrock/Vertex for Claude) |
| **State Management** | LangGraph checkpoints (SQL.js) | Sessions (resume via session_id) |
| **Streaming** | Custom IPC transport (`ElectronIPCTransport`) | Async generator (`query()` yields messages) |
| **Tool Definition** | deepagents FilesystemBackend schema | Built-in tools (Read, Write, Edit, Bash, Glob, Grep, etc.) |
| **HITL** | LangGraph `interruptOn` + `__interrupt__` state | Permissions mode + hooks (`PreToolUse`, `PostToolUse`) |
| **Subagents** | `task` tool with `subagent_type` | Built-in `Task` tool with `AgentDefinition` |
| **Extensibility** | Custom backends | MCP servers + hooks + plugins |

### Key Differences

1. **Abstraction layer** - deepagentsjs wraps LangGraph (state machine) which wraps LLM APIs; Claude Agent SDK wraps Claude Code's agent harness directly

2. **Provider approach** - OpenWork is fully provider-agnostic; Claude Agent SDK is Claude-first but supports Bedrock/Vertex

3. **Tool execution** - OpenWork: custom `LocalSandbox` extending `FilesystemBackend`; Claude SDK: built-in tool executors out-of-box

4. **Sessions** - OpenWork: SQL.js checkpoints per thread; Claude SDK: `session_id` for resume/fork

5. **Hooks** - OpenWork: relies on LangGraph interrupts; Claude SDK: rich hook system (`PreToolUse`, `PostToolUse`, `Stop`, etc.)

6. **Subagents** - Both support subagents; Claude SDK has first-class `AgentDefinition` with scoped tools

---

## OpenWork vs Codex SDK

| Aspect | OpenWork (deepagentsjs) | Codex SDK |
|--------|------------------------|-----------|
| **Runtime** | Electron (Node.js main process) | Node.js 18+ (server-side) |
| **Architecture** | LangGraph state machine with streaming | Thread-based conversation model |
| **State** | LangGraph checkpoints (SQL.js per-thread) | Thread IDs for session resumption |
| **Model** | Multi-provider (Claude, GPT, Gemini) | GPT-5.2-codex (OpenAI models) |
| **Tool System** | deepagents `FilesystemBackend` + `LocalSandbox` | MCP server exposure (`codex()` + `codex-reply()`) |
| **Streaming** | Dual-mode (`messages` + `values`) via IPC | Turn stream with item events |
| **Multi-agent** | `task` tool with `subagent_type` | OpenAI Agents SDK orchestration + MCP |
| **Trace/Debug** | Manual logging | Built-in traces dashboard |

### Key Differences

1. **Orchestration model** - OpenWork uses LangGraph's graph-based state machines; Codex uses thread-based conversation with OpenAI Agents SDK for multi-agent coordination

2. **MCP integration** - OpenWork: not primary; Codex: can run as MCP server, allowing Agents SDK to orchestrate it

3. **Multi-agent** - OpenWork: built-in `task` tool spawns subagents; Codex: integrates with Agents SDK for `spawn_agent`, `send_input`, hand-offs

4. **Local execution** - Both run locally; OpenWork in Electron, Codex via CLI/SDK

5. **Tracing** - Codex has automatic trace recording; OpenWork relies on console logging

6. **Collaboration** - Codex supports `collaboration wait`, multi-thread coordination; OpenWork is single-thread focused

---

## Sources

- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Codex SDK](https://developers.openai.com/codex/sdk/)
- [Use Codex with the Agents SDK](https://developers.openai.com/codex/guides/agents-sdk/)
- [GitHub: openai/codex](https://github.com/openai/codex)
- [GitHub: anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
