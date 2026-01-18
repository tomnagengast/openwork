# Progress

## Phase 0: Eliminate explicit-function-return-type lint errors

**Status**: Completed

Fixed 95 `@typescript-eslint/explicit-function-return-type` errors across 23 files:

- Added `React.JSX.Element` return types to React components
- Added `Promise<void>` to async functions
- Added `void` to event handlers
- Added specific types (`string`, `null`, etc.) where applicable
- Used eslint-disable comment for bin/cli.js (plain JS file)

Files modified (by error count):
- context-menu.tsx (15), ToolCallRenderer.tsx (13), FilesystemPanel.tsx (9)
- ImageViewer.tsx (9), ModelSwitcher.tsx (8), TabBar.tsx (5)
- thread-context.tsx (5), MessageBubble.tsx (4), popover.tsx (4)
- ApiKeyDialog.tsx (3), resizable.tsx (3), dialog.tsx (2)
- BinaryFileViewer.tsx (2), CodeViewer.tsx (2), FileViewer.tsx (2)
- PDFViewer.tsx (2), MediaViewer.tsx (1), TabbedPanel.tsx (1)
- badge.tsx (1), utils.ts (1), electron.vite.config.ts (1)
- threads.ts (1), cli.js (1)

Verification:
- `explicit-function-return-type` errors: 0
- `npm run typecheck`: passes

## Phase 0: Fix remaining ESLint errors

**Status**: Completed

Fixed 13 ESLint errors (0 errors remaining, warnings ok):

1. `storage.ts` — `no-unused-vars`: replaced `[_, v]` with `[, v]`
2. `ModelSwitcher.tsx` — `set-state-in-effect`: removed effect, derive `selectedProviderId` via `useMemo`
3. `ImageViewer.tsx` — `set-state-in-effect`: removed effect, reset pan in `handleZoomOut`
4. `WorkspacePicker.tsx` — `only-export-components` & `no-explicit-any`: moved `selectWorkspaceFolder` to `lib/workspace-utils.ts`; fixed `any[]` → `FileInfo[]`
5. `badge.tsx` & `button.tsx` — `only-export-components`: stopped exporting unused `*Variants` constants
6. `thread-context.tsx` — `no-unused-vars` (2×): used `delete` instead of destructuring with `_`; added file-level disable for `react-refresh/only-export-components`

Verification:
- `npm run lint`: 0 errors (533 warnings)
- `npm run typecheck`: passes

## Phase 1: Backpressure core types + execFileNoThrow

**Status**: Completed

Added foundational types and utilities for backpressure system:

1. `src/main/utils/execFileNoThrow.ts` — Safe command execution helper
   - Uses `execFile` (not `exec`) to avoid shell injection
   - Never throws; always returns `ExecResult { stdout, stderr, status }`
   - Handles non-numeric `.code` (e.g. 'ENOENT') by coercing to 1
   - 10MB maxBuffer, 60s default timeout

2. `src/main/backpressure/types.ts` — Core validator interfaces
   - `BackpressureError` — Structured error with source, severity, location, message
   - `ValidatorResult` — passed boolean, errors array, duration
   - `Validator` — name, patterns, validate(), optional watch()

3. `src/main/backpressure/utils/execFileNoThrow.ts` — Re-export for backpressure module

Verification:
- `npm run typecheck`: passes
- `npm run lint`: 0 errors

## Phase 1: TypeCheckValidator

**Status**: Completed

Added `src/main/backpressure/validators/typecheck.ts`:

- Implements `Validator` interface from `types.ts`
- `name = 'typecheck'`, `patterns = ['**/*.ts', '**/*.tsx']`
- `validate()` runs `npx tsc --noEmit` via `execFileNoThrow` (no shell)
- Detects `tsconfig.node.json`/`tsconfig.web.json`, falls back to `tsconfig.json`
- Parses tsc output into `BackpressureError[]`:
  - With location: `src/file.ts(10,5): error TS2345: ...`
  - Without location: `error TS6053: ...`
- Returns generic error if tsc fails but no parseable output
- **Fix**: Runs `npx tsc --noEmit --pretty false` without `-p` when no tsconfig exists (previously returned `[]` as a no-op)

Verification:
- `npm run typecheck`: passes
- `npm run lint`: 0 errors (533 warnings ok)
