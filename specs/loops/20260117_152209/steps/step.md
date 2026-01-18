## Builder notes

- Keep this change “mechanical”: move code, keep behavior identical.
- Do not delete `src/main/agent/runtime.ts`; if you supersede it, leave a thin wrapper/re-export so existing imports keep working.
- Preserve the IPC payload shape sent on `agent:stream:*` (`{ type: 'stream', mode, data }`, `{ type: 'done' }`, `{ type: 'error', error }`).
- Be careful with per-thread checkpointing: avoid creating concurrent streams for the same thread (existing abort logic must remain).
