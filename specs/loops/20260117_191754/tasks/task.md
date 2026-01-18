# Task: Phase 0 — eliminate `explicit-function-return-type` lint errors

## Objective
Reduce baseline lint noise before implementing the backpressure system by removing all ESLint **errors** for:
- `@typescript-eslint/explicit-function-return-type`

This is currently the dominant source of lint failures (95 errors as of the last `npx eslint -f json .` run).

## Non-goals (for this task)
- Do not fix Prettier warnings / formatting warnings.
- Do not refactor behavior or change UI logic except what’s necessary to add return types.
- Do not change ESLint rule configuration (fix the code, not the rules).
- Do not attempt to implement any backpressure runtime code yet.

## Required changes

### 1) Fix all `@typescript-eslint/explicit-function-return-type` errors
Run:
- `npx eslint -f json .`

Then, for every error with rule id `@typescript-eslint/explicit-function-return-type`, add an explicit return type.

Guidelines:
- React components should usually return `React.JSX.Element` (or `React.ReactNode` / `React.ReactElement` if needed).
- `async` functions should return `Promise<...>`.
- Event/callback handlers should return `void` when appropriate.
- Avoid introducing runtime imports just to satisfy types (type-only references are fine).

### 2) Keep the change mechanical
Prefer minimal edits that only add return type annotations. Avoid changing control flow, JSX structure, or behavior.

## Acceptance criteria
- `npx eslint -f json .` reports **0** errors with rule id `@typescript-eslint/explicit-function-return-type`.
- `npm run typecheck` still passes.

Notes:
- Other ESLint error rules may still fail after this task (they will be handled separately); this task is only for the `explicit-function-return-type` errors.

