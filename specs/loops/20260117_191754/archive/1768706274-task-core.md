# Task: Phase 1 — add backpressure core types + secure `execFileNoThrow`

## Objective
Lay the foundation for `specs/backpressure.md` Phase 1 by adding:
- A safe command execution helper (`execFileNoThrow`) for validators (no shell injection).
- Core backpressure types (`BackpressureError`, `ValidatorResult`, `Validator`).

These are prerequisites for implementing the validators + coordinator.

## Scope (only this task)

### 1) Create `src/main/utils/execFileNoThrow.ts`
Implement the helper described in `specs/backpressure.md` ("Command Execution (Security)").

Requirements:
- Use `execFile` (not `exec`) so args are passed as an array (no shell).
- Export types:
  - `interface ExecResult { stdout: string; stderr: string; status: number }`
- Export function with explicit return type:
  - `export async function execFileNoThrow(cmd: string, args: string[], options?: { cwd?: string; timeout?: number }): Promise<ExecResult>`
- Never throw; always return an `ExecResult`.
  - On success: `status: 0`
  - On failure: return captured `stdout`/`stderr`, and a numeric `status` (exit code if available; otherwise `1`)
- Set `maxBuffer` (10MB is fine) to prevent truncation for large outputs.

### 2) Create `src/main/backpressure/types.ts`
Add the validator interface/types from `specs/backpressure.md`:

- `interface BackpressureError`
- `interface ValidatorResult`
- `interface Validator`

Notes:
- Keep `source` and `severity` as the union types from the spec.
- `validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult>`
- Optional `watch?(workspacePath: string): AsyncGenerator<ValidatorResult>`

### 3) Create `src/main/backpressure/utils/execFileNoThrow.ts`
Re-export the shared helper for use inside the backpressure module:
- `export { execFileNoThrow } from '../../utils/execFileNoThrow'`
- (Optional) also re-export `ExecResult` as a type if useful.

## Non-goals
- Do not implement any validator classes yet.
- Do not implement the coordinator yet.
- Do not add IPC handlers yet.

## Acceptance criteria
- `npm run typecheck` exits 0.
- `npm run lint` exits 0 (warnings ok).

