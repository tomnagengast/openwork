# Streaming Architecture

OpenWork uses a custom streaming architecture to bridge LangGraph's streaming with the Electron renderer.

## Overview

```
LangGraph Stream → Main Process → IPC Events → ElectronIPCTransport → useStream → React UI
```

## Dual-Mode Streaming

Agent streams with two modes simultaneously:

| Mode | Purpose | Data |
|------|---------|------|
| `messages` | Token streaming | Individual tokens for real-time display |
| `values` | State updates | Full LangGraph state including `__interrupt__` |

## ElectronIPCTransport

Custom transport implementing `UseStreamTransport` interface.

**Location:** `src/renderer/src/lib/electron-transport.ts`

**Purpose:** Converts Electron IPC events to the format expected by `@langchain/langgraph-sdk`'s `useStream` hook.

### Key Responsibilities

1. Listen to IPC events from main process
2. Convert events to `useStream` SDK format
3. Handle stream lifecycle (start, data, end, error)
4. Manage reconnection on interrupts

## IPC Event Flow

1. **Main Process** (`src/main/ipc/agent.ts`):
   - Receives `agent:invoke` IPC call
   - Creates agent runtime
   - Streams via `agent.stream()`
   - Emits IPC events for each chunk

2. **Renderer** (`electron-transport.ts`):
   - Listens for IPC stream events
   - Transforms to `useStream` format
   - Feeds to React state

## Thread Context

**Location:** `src/renderer/src/lib/thread-context.tsx`

Manages per-thread state:
- Current thread ID
- Message history
- Stream state
- Interrupt handling

## Checkpoint Persistence

**Location:** `src/main/checkpointer/sqljs-saver.ts`

SQL.js-based checkpointer:
- Stores LangGraph state per thread
- Enables conversation resume
- Persists tool call history

## Related Docs

- [architecture.md](./architecture.md) - Overall data flow
- [hitl.md](./hitl.md) - How interrupts stream
