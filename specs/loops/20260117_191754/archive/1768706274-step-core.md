Implementation notes

- `execFile` error `.code` can be non-numeric (e.g. `'ENOENT'`); coerce to a number for `status` (`Number.isInteger(code) ? code : 1`).
- Keep the helper in `src/main/utils/` (shared across main process features); backpressure re-export stays in `src/main/backpressure/utils/`.
- This repo enforces explicit return types in many places; ensure `execFileNoThrow` has an explicit `Promise<ExecResult>` return type.
