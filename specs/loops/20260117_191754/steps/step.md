Implementation notes (focus on fixing ESLint *errors* only)

- Quick verify: `npm run lint` should exit 0 (warnings ok for this task).

- `src/main/storage.ts` (`no-unused-vars`):
  - Replace `.filter(([_, v]) => v)` with `.filter(([, v]) => v)`.

- `react-hooks/set-state-in-effect`:
  - `src/renderer/src/components/chat/ModelSwitcher.tsx`: remove the effect that sets `selectedProviderId`.
    - Suggested approach: keep `selectedProviderId` as “user override” only.
    - Derive a `defaultProviderId` from `currentModel` (or first provider) and use `effectiveProviderId = selectedProviderId ?? defaultProviderId` for rendering/filtering.
  - `src/renderer/src/components/tabs/ImageViewer.tsx`: remove the effect that resets pan.
    - Reset `panOffset` inside zoom-changing handlers when the next zoom becomes `<= 100`.

- `src/renderer/src/components/chat/WorkspacePicker.tsx`:
  - Fix `react-refresh/only-export-components` by moving `selectWorkspaceFolder` into a separate module and importing it (it’s imported by `ChatContainer.tsx` too).
  - Fix `no-explicit-any` by replacing `any[]` with the real file type (likely `FileInfo[]` from `@/types`).

- `react-refresh/only-export-components` in shadcn-style UI primitives:
  - `src/renderer/src/components/ui/badge.tsx` and `src/renderer/src/components/ui/button.tsx` currently export `*Variants` constants; they appear unused in-repo.
  - Easiest fix: stop exporting the variants (keep them internal).

- `src/renderer/src/lib/thread-context.tsx`:
  - Fix the 2 `no-unused-vars` errors by avoiding the `_` binding (e.g. copy + `delete` for object key removal).
  - For the `react-refresh/only-export-components` errors (hooks exports): add a file-level disable for this rule (it’s not a “components-only” module).
