# Task: Phase 1 — implement `LintValidator`

## Objective
Implement the ESLint-based backpressure validator described in `specs/backpressure.md` so the system can surface structured lint feedback (errors + warnings) to the agent.

## Scope (only this task)

### 1) Create `src/main/backpressure/validators/lint.ts`

Requirements:
- Export a `LintValidator` class implementing `Validator` from `src/main/backpressure/types.ts`.
- `name = 'lint'`
- `patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']`
- `validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult>`
  - Use `execFileNoThrow` from `src/main/backpressure/utils/execFileNoThrow` (re-export).
  - Run ESLint via `npx` with args array (no shell); use JSON output.
  - Parse ESLint JSON output into `BackpressureError[]`:
    - `source: 'lint'`
    - `severity`: `error` for severity `2`, `warning` for severity `1`
    - `file`: from ESLint `filePath`
    - `line`, `column`
    - `code`: `ruleId`
    - `message`: ESLint `message`
    - `suggestion`: if `fix` is present, set something like `Auto-fixable with --fix`
  - If ESLint fails (non-zero) but parsing yields no structured errors, return a single generic `BackpressureError` with a helpful `message` and include `raw` output.
  - `duration` is total ms.

Notes:
- Keep functions/methods with explicit return types (repo linting).
- Do not implement the coordinator, IPC handlers, or other validators in this task.

## Acceptance criteria
- `npm run typecheck` exits 0.
- `npm run lint` exits 0 (warnings ok).
