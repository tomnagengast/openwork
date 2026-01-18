Notes / tips

- Mirror patterns from `src/main/agent/runtimes/claude-sdk.ts` for:
  - Reading/writing thread metadata via `getThread` / `updateThread`
  - Electron modal approvals (`dialog.showMessageBox`) + truncating long JSON payloads
- Fix `npm run typecheck` failures: `src/main/agent/runtimes/codex-sdk.ts` has TS6133 unused params in `resume()` / `interrupt()` (use the params or `void` them).
- Prefer token streaming (`{ type: 'token', messageId, token }`) so the existing renderer transport works with no changes.
- Keep `OPENWORK_AGENT_RUNTIME` behavior consistent:
  - `deepagents` stays the default.
  - `codex` should only activate when explicitly selected.
- Abort handling: stop yielding promptly on `signal.aborted` and avoid sending `{ type: 'done' }` after abort.
- Codex SDK HITL: the SDK doesn’t expose a `canUseTool`-style hook; implement a minimal Electron modal before starting a turn to gate “tools enabled” vs “read-only” execution (e.g. choose `sandboxMode: 'workspace-write'` only after user clicks Allow; otherwise `sandboxMode: 'read-only'`).
- Codex SDK API key wiring: if you pass `env` to `new Codex({ env })`, the SDK will NOT inherit `process.env`, and it only injects `CODEX_API_KEY` when `apiKey` is provided; pass `apiKey: process.env.OPENAI_API_KEY` (or add `CODEX_API_KEY` to the provided env) so Codex can authenticate.
