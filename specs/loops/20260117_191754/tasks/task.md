# Task: Phase 0 — make `npm run lint` exit 0 (0 ESLint errors)

## Objective
Eliminate all ESLint **errors** (severity 2) so `npm run lint` exits 0. Warnings can remain for now.

This is required before implementing the backpressure validators, so the agent isn’t overwhelmed by unrelated baseline failures.

## Non-goals (for this task)
- Do not try to eliminate Prettier warnings yet.
- Do not do broad refactors; keep behavior stable.
- Do not change ESLint configuration; fix code (file-level disables are ok only when the rule is clearly inapplicable).

## Required changes

### 1) Fix the current 13 ESLint errors
Verify the current error list with:
- `npm run lint`

As of the latest run, the errors are:
1. `src/main/storage.ts` — `@typescript-eslint/no-unused-vars`
2. `src/renderer/src/components/chat/ModelSwitcher.tsx` — `react-hooks/set-state-in-effect`
3. `src/renderer/src/components/tabs/ImageViewer.tsx` — `react-hooks/set-state-in-effect`
4. `src/renderer/src/components/chat/WorkspacePicker.tsx` — `react-refresh/only-export-components`
5. `src/renderer/src/components/chat/WorkspacePicker.tsx` — `@typescript-eslint/no-explicit-any`
6. `src/renderer/src/components/ui/badge.tsx` — `react-refresh/only-export-components`
7. `src/renderer/src/components/ui/button.tsx` — `react-refresh/only-export-components`
8. `src/renderer/src/lib/thread-context.tsx` — `@typescript-eslint/no-unused-vars` (2x)
9. `src/renderer/src/lib/thread-context.tsx` — `react-refresh/only-export-components` (4x; hooks exports)

### 2) Keep the change minimal
Prefer small, targeted changes that only remove lint errors.

## Acceptance criteria
- `npm run lint` exits 0 (warnings ok).
- `npm run typecheck` exits 0.

