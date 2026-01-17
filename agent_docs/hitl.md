# Human-in-the-Loop (HITL)

OpenWork implements HITL via LangGraph's interrupt mechanism for shell command approval.

## How It Works

1. Agent configured with `interruptOn: { execute: true }`
2. Shell commands trigger graph interrupts
3. `__interrupt__` array in state signals pending approval
4. UI shows approval dialog
5. Resume with decision via `Command({ resume: ... })`

## Configuration

```typescript
createDeepAgent({
  // ... other config
  interruptOn: { execute: true }  // Interrupt on shell execution
})
```

## Interrupt State

When agent hits an interrupt, LangGraph state contains:

```typescript
{
  __interrupt__: [
    {
      tool: 'execute',
      args: { command: 'npm install' },
      // ... metadata
    }
  ]
}
```

## UI Flow

1. Stream detects `__interrupt__` in state values
2. Renderer shows approval dialog with:
   - Command to execute
   - Approve button
   - Reject button
   - Edit option (modify command)
3. User makes decision

## Resuming Execution

After user decision, resume via:

```typescript
agent.stream(
  new Command({
    resume: {
      decisions: [
        { approved: true }  // or false, or { edited: 'new command' }
      ]
    }
  }),
  config
)
```

## Interrupt Types

Currently configured for:
- `execute` - Shell command execution

Could be extended for:
- File writes
- Network requests
- Sensitive operations

## Related Docs

- [architecture.md](./architecture.md) - Where HITL fits in flow
- [streaming.md](./streaming.md) - How interrupts stream to UI
