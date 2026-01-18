Notes / tips

- Mirror patterns from `src/main/agent/runtimes/claude-sdk.ts` for:
  - Reading/writing thread metadata via `getThread` / `updateThread`
  - Electron modal approvals (`dialog.showMessageBox`) + truncating long JSON payloads
- Prefer token streaming (`{ type: 'token', messageId, token }`) so the existing renderer transport works with no changes.
- Keep `OPENWORK_AGENT_RUNTIME` behavior consistent:
  - `deepagents` stays the default.
  - `codex` should only activate when explicitly selected.
- Abort handling: stop yielding promptly on `signal.aborted` and avoid sending `{ type: 'done' }` after abort.
- If the Codex SDK exposes its own tool-approval hooks, use those instead of inventing a new HITL flow.
