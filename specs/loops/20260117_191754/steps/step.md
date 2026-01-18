Implementation notes

- Detect which tsconfig(s) exist under `workspacePath` (`tsconfig.node.json`, `tsconfig.web.json`, fallback `tsconfig.json`).
- If no tsconfig exists, still run one `npx tsc` invocation without `-p` (default tsc behavior) so the validator isn’t a no-op.
- Prefer `npx tsc` (args array) over `npm run typecheck` to avoid executing arbitrary workspace scripts.
  - Example args: `['tsc', '--noEmit', '-p', configFile, '--pretty', 'false', '--composite', 'false']`
- Parsing:
  - Primary pattern: `src/file.ts(10,5): error TS2345: ...`
  - Fallback pattern (no location): `error TS6053: ...`
