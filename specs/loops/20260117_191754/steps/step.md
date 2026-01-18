Implementation notes

- Start from a clean working tree (`git status`). If there are unrelated local changes, stash or commit them separately so the task commit contains only the LintValidator work.
- Prefer `npx eslint --format json -- ...files` (include `--`) to avoid file paths being interpreted as flags.
- If JSON parsing fails, return one generic `BackpressureError` (`source: 'lint'`, `severity: 'error'`, include `raw`) so the agent sees actionable feedback.
- Filter `changedFiles` to files under `workspacePath` and matching `patterns` before invoking ESLint (avoid surprising failures on irrelevant paths).
