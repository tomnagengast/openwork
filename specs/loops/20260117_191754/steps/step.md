Implementation notes (focus on fast, mechanical fixes)

- Verify current count: `npx eslint -f json . | node -e "const fs=require('fs');const r=JSON.parse(fs.readFileSync(0,'utf8'));let n=0;for(const f of r){for(const m of f.messages){if(m.severity===2 && m.ruleId==='@typescript-eslint/explicit-function-return-type') n++;}}console.log(n)"` (expect ~95 before changes).

- Biggest offenders (start here):
  - `src/renderer/src/components/ui/context-menu.tsx`
  - `src/renderer/src/components/chat/ToolCallRenderer.tsx`
  - `src/renderer/src/lib/thread-context.tsx`
  - `src/renderer/src/components/tabs/ImageViewer.tsx`
  - `src/renderer/src/components/chat/ModelSwitcher.tsx`
  - `src/renderer/src/components/panels/FilesystemPanel.tsx`

- Common patterns:
  - `function Component(...): React.JSX.Element { ... }`
  - `const Component = (...): React.JSX.Element => { ... }`
  - `async function loadX(...): Promise<void> { ... }`

- For shadcn-style UI components that wrap Radix primitives, `React.JSX.Element` is typically correct.
- After edits: re-run `npx eslint -f json .` and confirm the `explicit-function-return-type` error count is 0 (other errors are ok for this task).
