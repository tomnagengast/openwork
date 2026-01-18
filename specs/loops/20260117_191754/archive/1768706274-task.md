# Task: Phase 1 — implement `TypeCheckValidator`

## Objective
Implement the first built-in backpressure validator from `specs/backpressure.md`: a TypeScript typecheck validator that runs safely (no shell) and returns structured `BackpressureError[]`.

## Scope (only this task)

### 1) Create `src/main/backpressure/validators/typecheck.ts`
Requirements:
- Export a `TypeCheckValidator` class implementing `Validator` from `src/main/backpressure/types.ts`.
- `name = 'typecheck'`
- `patterns = ['**/*.ts', '**/*.tsx']`
- `validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult>`
  - Use `execFileNoThrow` from `src/main/backpressure/utils/execFileNoThrow` (re-export).
  - Run TypeScript with `execFile`-safe args (no shell).
  - Prefer checking `tsconfig.node.json` and `tsconfig.web.json` if present; otherwise fall back to `tsconfig.json` or default `tsc`.
  - Parse output into `BackpressureError[]` (source: `'typecheck'`) using a regex compatible with TS output:
    - `src/file.ts(10,5): error TS2345: message...`
  - `duration` should be total ms across all invocations.

Notes:
- Use explicit return types for all functions/methods (repo linting).
- If `tsc` exits non-zero but parsing yields no structured errors, return a single generic `BackpressureError` with `message` and `raw` so the agent still sees something actionable.

## Non-goals
- Do not implement the coordinator or IPC handlers yet.
- Do not implement `LintValidator`/`TestValidator`/`UIValidator` yet.

## Acceptance criteria
- `npm run typecheck` exits 0.
- `npm run lint` exits 0 (warnings ok).

