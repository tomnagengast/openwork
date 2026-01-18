# Backpressure System for Agent Development

Automated feedback loops that let agents self-correct, reducing human intervention.

## Goals

- Agent receives automated feedback from build/lint/test systems
- Agent loops until all validation passes or exits on condition
- Structured error format parseable by LLM
- Integrates with existing runtime adapters (deepagents, claude-sdk, codex)

## Core Concepts

**Backpressure** = automated feedback the agent can use to self-correct. Sources:
- Build systems (tsc, vite, esbuild)
- Linters (eslint, prettier)
- Test runners (vitest, jest, playwright)
- LSP diagnostics
- UI verification (Playwright screenshots, accessibility)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Runtime Adapter                       │
│   (deepagents | claude-sdk | codex)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓ tool calls
┌─────────────────────────────────────────────────────────────────┐
│                     Backpressure Coordinator                     │
│   - Triggers validators after file changes                       │
│   - Aggregates feedback from all sources                         │
│   - Injects structured errors into agent context                 │
└─────────────────────────────────────────────────────────────────┘
        ↓               ↓               ↓               ↓
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
│ TypeCheck │   │   Lint    │   │   Test    │   │  UI/A11y  │
│ Validator │   │ Validator │   │ Validator │   │ Validator │
└───────────┘   └───────────┘   └───────────┘   └───────────┘
```

## 1. Validator Interface

```typescript
// src/main/backpressure/types.ts

interface BackpressureError {
  source: 'typecheck' | 'lint' | 'test' | 'ui' | 'custom'
  severity: 'error' | 'warning' | 'info'
  file?: string
  line?: number
  column?: number
  message: string
  code?: string          // Error code (TS2345, no-unused-vars)
  suggestion?: string    // Auto-fix or hint
  raw?: string           // Original output for context
}

interface ValidatorResult {
  passed: boolean
  errors: BackpressureError[]
  duration: number       // ms
}

interface Validator {
  name: string
  /** Glob patterns for files this validator cares about */
  patterns: string[]
  /** Run validation, return structured errors */
  validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult>
  /** Optional: watch mode for incremental validation */
  watch?(workspacePath: string): AsyncGenerator<ValidatorResult>
}
```

## 2. Shared Utilities

### Command Execution (Security)

Create safe command execution utility to avoid shell injection:

```typescript
// src/main/utils/execFileNoThrow.ts
import { execFile as nodeExecFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(nodeExecFile)

interface ExecResult {
  stdout: string
  stderr: string
  status: number
}

/**
 * Safe command execution using execFile (not exec).
 * Avoids shell injection by passing arguments as array.
 */
export async function execFileNoThrow(
  cmd: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: options.cwd,
      timeout: options.timeout ?? 60000,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    })
    return { stdout, stderr, status: 0 }
  } catch (error: unknown) {
    const e = error as { stdout?: string; stderr?: string; code?: number }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      status: e.code ?? 1
    }
  }
}
```

## 3. Built-in Validators

### TypeCheck Validator

```typescript
// src/main/backpressure/validators/typecheck.ts
import { execFileNoThrow } from '../utils/execFileNoThrow'

class TypeCheckValidator implements Validator {
  name = 'typecheck'
  patterns = ['**/*.ts', '**/*.tsx']

  async validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult> {
    const start = Date.now()

    // Use execFileNoThrow for security (avoids shell injection)
    const { stdout, stderr, status } = await execFileNoThrow(
      'npx',
      ['tsc', '--noEmit', '--pretty', 'false'],
      { cwd: workspacePath }
    )

    const errors = this.parseTscOutput(stdout + stderr, workspacePath)

    return {
      passed: status === 0,
      errors,
      duration: Date.now() - start
    }
  }

  private parseTscOutput(output: string, workspacePath: string): BackpressureError[] {
    // Parse: src/file.ts(10,5): error TS2345: Argument of type...
    const pattern = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/gm
    const errors: BackpressureError[] = []

    let match
    while ((match = pattern.exec(output)) !== null) {
      errors.push({
        source: 'typecheck',
        severity: match[4] as 'error' | 'warning',
        file: path.resolve(workspacePath, match[1]),
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[5],
        message: match[6],
        raw: match[0]
      })
    }
    return errors
  }
}
```

### Lint Validator

```typescript
// src/main/backpressure/validators/lint.ts
import { execFileNoThrow } from '../utils/execFileNoThrow'

class LintValidator implements Validator {
  name = 'lint'
  patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']

  async validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult> {
    const start = Date.now()

    // Use execFileNoThrow with file args as array (safe from injection)
    const { stdout, status } = await execFileNoThrow(
      'npx',
      ['eslint', '--format', 'json', ...changedFiles],
      { cwd: workspacePath }
    )

    const eslintOutput = JSON.parse(stdout || '[]')
    const errors = this.parseEslintOutput(eslintOutput)

    return {
      passed: status === 0,
      errors,
      duration: Date.now() - start
    }
  }

  private parseEslintOutput(output: ESLintResult[]): BackpressureError[] {
    const errors: BackpressureError[] = []

    for (const file of output) {
      for (const msg of file.messages) {
        errors.push({
          source: 'lint',
          severity: msg.severity === 2 ? 'error' : 'warning',
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          code: msg.ruleId,
          message: msg.message,
          suggestion: msg.fix ? `Auto-fixable with --fix` : undefined
        })
      }
    }
    return errors
  }
}
```

### Test Validator

```typescript
// src/main/backpressure/validators/test.ts
import { execFileNoThrow } from '../utils/execFileNoThrow'

class TestValidator implements Validator {
  name = 'test'
  patterns = ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx']

  async validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult> {
    const start = Date.now()

    // Detect test runner
    const runner = await this.detectRunner(workspacePath)
    const args = this.getArgs(runner, changedFiles)

    const { stdout, stderr, status } = await execFileNoThrow(
      'npx',
      args,
      { cwd: workspacePath }
    )

    const errors = this.parseOutput(runner, stdout + stderr)

    return {
      passed: status === 0,
      errors,
      duration: Date.now() - start
    }
  }

  private async detectRunner(workspacePath: string): Promise<'vitest' | 'jest' | 'playwright'> {
    const pkg = JSON.parse(await fs.readFile(path.join(workspacePath, 'package.json'), 'utf-8'))
    if (pkg.devDependencies?.vitest) return 'vitest'
    if (pkg.devDependencies?.['@playwright/test']) return 'playwright'
    return 'jest'
  }

  private getArgs(runner: string, files: string[]): string[] {
    switch (runner) {
      case 'vitest': return ['vitest', 'run', '--reporter=json', ...files]
      case 'playwright': return ['playwright', 'test', '--reporter=json', ...files]
      default: return ['jest', '--json', ...files]
    }
  }
}
```

### UI Validator (via MCP)

```typescript
// src/main/backpressure/validators/ui.ts

class UIValidator implements Validator {
  name = 'ui'
  patterns = ['**/*.tsx', '**/*.jsx', '**/*.css']

  async validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult> {
    // Requires Playwright MCP or Chrome DevTools MCP
    // Takes screenshot, runs accessibility checks

    const errors: BackpressureError[] = []

    // Check if dev server is running
    const devServerUrl = await this.detectDevServer(workspacePath)
    if (!devServerUrl) {
      return { passed: true, errors: [], duration: 0 }
    }

    // Run accessibility audit via Playwright
    const a11yErrors = await this.runA11yAudit(devServerUrl)
    errors.push(...a11yErrors)

    return {
      passed: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      duration: 0
    }
  }
}
```

## 4. Backpressure Coordinator

```typescript
// src/main/backpressure/coordinator.ts

interface CoordinatorOptions {
  workspacePath: string
  validators?: Validator[]
  maxIterations?: number        // Default: 10
  runOnFileChange?: boolean     // Default: true
  debounceMs?: number           // Default: 500
}

class BackpressureCoordinator {
  private validators: Validator[]
  private fileWatcher: FSWatcher | null = null
  private pendingValidation: Set<string> = new Set()
  private debounceTimer: NodeJS.Timeout | null = null

  constructor(private opts: CoordinatorOptions) {
    this.validators = opts.validators ?? [
      new TypeCheckValidator(),
      new LintValidator(),
      new TestValidator()
    ]
  }

  /** Run all validators, return aggregated errors */
  async validate(changedFiles?: string[]): Promise<AggregatedResult> {
    const files = changedFiles ?? await this.getAllRelevantFiles()
    const results: Map<string, ValidatorResult> = new Map()

    // Run validators in parallel
    await Promise.all(
      this.validators.map(async (v) => {
        const relevant = files.filter(f => this.matchesPatterns(f, v.patterns))
        if (relevant.length > 0) {
          results.set(v.name, await v.validate(relevant, this.opts.workspacePath))
        }
      })
    )

    return this.aggregate(results)
  }

  /** Format errors for LLM consumption */
  formatForLLM(result: AggregatedResult): string {
    if (result.passed) {
      return '✓ All validation passed'
    }

    const lines: string[] = []
    lines.push(`Found ${result.errorCount} error(s), ${result.warningCount} warning(s):\n`)

    // Group by file
    const byFile = new Map<string, BackpressureError[]>()
    for (const err of result.errors) {
      const file = err.file ?? '(unknown)'
      if (!byFile.has(file)) byFile.set(file, [])
      byFile.get(file)!.push(err)
    }

    for (const [file, errs] of byFile) {
      lines.push(`## ${path.relative(this.opts.workspacePath, file)}`)
      for (const err of errs) {
        const loc = err.line ? `L${err.line}${err.column ? `:${err.column}` : ''}` : ''
        const code = err.code ? `[${err.code}]` : ''
        lines.push(`- ${loc} ${err.severity.toUpperCase()} ${code}: ${err.message}`)
        if (err.suggestion) {
          lines.push(`  → ${err.suggestion}`)
        }
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  /** Start watching for file changes */
  startWatch(): void {
    this.fileWatcher = watch(this.opts.workspacePath, {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**'],
      persistent: true
    })

    this.fileWatcher.on('change', (filePath) => {
      this.pendingValidation.add(filePath)
      this.scheduleValidation()
    })
  }

  private scheduleValidation(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(async () => {
      const files = [...this.pendingValidation]
      this.pendingValidation.clear()

      const result = await this.validate(files)
      this.emit('validation', result)
    }, this.opts.debounceMs ?? 500)
  }

  stopWatch(): void {
    this.fileWatcher?.close()
    this.fileWatcher = null
  }
}
```

## 5. Agent Loop Integration

### Loop Controller

```typescript
// src/main/backpressure/loop.ts

interface LoopOptions {
  maxIterations: number         // Default: 10
  exitOnSuccess: boolean        // Default: true
  exitOnNoProgress: boolean     // Default: true (no new fixes after 2 iterations)
  validators: Validator[]
  onProgress?: (iteration: number, result: AggregatedResult) => void
}

interface LoopResult {
  success: boolean
  iterations: number
  finalResult: AggregatedResult
  history: LoopIteration[]
}

interface LoopIteration {
  iteration: number
  agentResponse: string
  validationResult: AggregatedResult
  filesChanged: string[]
}

async function runBackpressureLoop(
  runtime: AgentRuntimeAdapter,
  initialPrompt: string,
  opts: LoopOptions
): Promise<LoopResult> {
  const coordinator = new BackpressureCoordinator({
    workspacePath: opts.workspacePath,
    validators: opts.validators
  })

  const history: LoopIteration[] = []
  let currentPrompt = initialPrompt
  let iteration = 0
  let lastErrorCount = Infinity

  while (iteration < opts.maxIterations) {
    iteration++
    opts.onProgress?.(iteration, await coordinator.validate())

    // Run agent
    const agentResponse = await collectAgentResponse(runtime, currentPrompt)
    const filesChanged = extractChangedFiles(agentResponse)

    // Validate
    const result = await coordinator.validate(filesChanged)
    history.push({ iteration, agentResponse, validationResult: result, filesChanged })

    if (result.passed && opts.exitOnSuccess) {
      return { success: true, iterations: iteration, finalResult: result, history }
    }

    // Check for progress
    if (opts.exitOnNoProgress && result.errorCount >= lastErrorCount) {
      // No improvement after this iteration
      if (iteration >= 2 && history[iteration - 2]?.validationResult.errorCount <= result.errorCount) {
        return { success: false, iterations: iteration, finalResult: result, history }
      }
    }
    lastErrorCount = result.errorCount

    // Prepare next prompt with feedback
    currentPrompt = `
The previous changes produced validation errors. Please fix them:

${coordinator.formatForLLM(result)}

Focus on errors first, then warnings. Make minimal changes to fix each issue.
`
  }

  const finalResult = await coordinator.validate()
  return { success: finalResult.passed, iterations: iteration, finalResult, history }
}
```

### Runtime Integration

```typescript
// src/main/agent/runtimes/backpressure-wrapper.ts

/**
 * Wraps any AgentRuntimeAdapter to add backpressure validation loops.
 */
class BackpressureRuntimeWrapper implements AgentRuntimeAdapter {
  constructor(
    private inner: AgentRuntimeAdapter,
    private coordinator: BackpressureCoordinator
  ) {}

  async *stream(input: StreamInput, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
    // Run initial validation
    const preValidation = await this.coordinator.validate()
    if (!preValidation.passed) {
      // Inject errors into prompt
      input.message = `${input.message}

---
⚠️ Current validation status:
${this.coordinator.formatForLLM(preValidation)}
---`
    }

    // Stream agent response
    for await (const event of this.inner.stream(input, signal)) {
      yield event

      // After done, run validation
      if (event.type === 'done') {
        const postValidation = await this.coordinator.validate()
        if (!postValidation.passed) {
          // Emit validation feedback as special event
          yield {
            type: 'stream',
            mode: 'values',
            data: {
              backpressure: {
                passed: false,
                errors: postValidation.errors,
                formatted: this.coordinator.formatForLLM(postValidation)
              }
            }
          }
        }
      }
    }
  }

  // ... implement resume, interrupt
}
```

## 6. IPC Handlers

```typescript
// src/main/ipc/backpressure.ts

import { ipcMain } from 'electron'

export function registerBackpressureHandlers(): void {
  ipcMain.handle('backpressure:validate', async (_, workspacePath: string) => {
    const coordinator = new BackpressureCoordinator({ workspacePath })
    return coordinator.validate()
  })

  ipcMain.handle('backpressure:format', async (_, result: AggregatedResult, workspacePath: string) => {
    const coordinator = new BackpressureCoordinator({ workspacePath })
    return coordinator.formatForLLM(result)
  })

  ipcMain.handle('backpressure:loop', async (_, options: LoopOptions) => {
    const runtime = await createRuntimeForThread(options.threadId)
    return runBackpressureLoop(runtime, options.prompt, options)
  })
}
```

## 7. File Changes

```
src/main/utils/
└── execFileNoThrow.ts          # Safe command execution utility

src/main/backpressure/
├── types.ts                    # BackpressureError, ValidatorResult, Validator
├── coordinator.ts              # BackpressureCoordinator
├── loop.ts                     # runBackpressureLoop
├── utils/
│   └── execFileNoThrow.ts      # Re-export from main/utils
├── validators/
│   ├── typecheck.ts            # TypeCheckValidator
│   ├── lint.ts                 # LintValidator
│   ├── test.ts                 # TestValidator
│   └── ui.ts                   # UIValidator (Playwright/a11y)
└── index.ts                    # Exports

src/main/agent/runtimes/
└── backpressure-wrapper.ts     # BackpressureRuntimeWrapper

src/main/ipc/
└── backpressure.ts             # IPC handlers

src/renderer/src/components/chat/
└── BackpressureFeedback.tsx    # UI for validation results
```

## 8. Settings

Add to settings UI:

```typescript
interface BackpressureSettings {
  enabled: boolean                // Default: true
  validators: {
    typecheck: boolean            // Default: true
    lint: boolean                 // Default: true
    test: boolean                 // Default: false (opt-in, slower)
    ui: boolean                   // Default: false (requires MCP)
  }
  loop: {
    enabled: boolean              // Default: false (manual trigger)
    maxIterations: number         // Default: 10
    exitOnSuccess: boolean        // Default: true
    exitOnNoProgress: boolean     // Default: true
  }
  validateOnFileChange: boolean   // Default: true
  debounceMs: number              // Default: 500
}
```

## 9. UI Components

### Validation Status Bar

Shows current validation state in chat header:
- ✓ Green: All passed
- ⚠ Yellow: Warnings only
- ✗ Red: Errors present
- ⟳ Spinning: Validating

### Error Panel

Collapsible panel in right sidebar showing:
- Grouped errors by file
- Click to jump to file/line
- Quick actions: "Ask agent to fix", "Run auto-fix"

### Loop Progress

When loop mode active:
- Iteration counter: "Iteration 3/10"
- Progress bar
- Error trend chart (errors per iteration)
- Stop button

## 10. Implementation Phases

### Phase 0: Establish Clean Baseline

**Rationale:** Backpressure only works if the codebase starts clean. Pre-existing errors overwhelm the agent with noise unrelated to its current task.

**Current State (as of 2026-01-17):**
- Typecheck: ✓ Clean
- Lint: 4 errors, ~50 warnings

**Errors to fix:**
```
bin/cli.js:46           - Missing return type on function
electron.vite.config.ts:10 - Missing return type on function
src/main/ipc/threads.ts:15 - Missing return type on function
src/main/storage.ts:78     - '_' is defined but never used
```

**Tasks:**
- [ ] Fix 4 lint errors (return types, unused var)
- [ ] Run `npm run format` to fix prettier warnings
- [ ] Add pre-commit hook to prevent regressions
- [ ] Document baseline expectations in CONTRIBUTING.md

**Pre-commit hook (optional):**
```bash
# .husky/pre-commit
npm run typecheck && npm run lint
```

**Success criteria:** `npm run typecheck && npm run lint` exits 0 with no errors/warnings.

---

### Phase 1: Core Infrastructure
- [ ] Validator interface + types
- [ ] BackpressureCoordinator
- [ ] TypeCheckValidator
- [ ] LintValidator
- [ ] IPC handlers

### Phase 2: Agent Integration
- [ ] BackpressureRuntimeWrapper
- [ ] Inject errors into agent context
- [ ] Parse validation results from agent output

### Phase 3: Loop Controller
- [ ] runBackpressureLoop
- [ ] Exit conditions
- [ ] Progress tracking
- [ ] History logging

### Phase 4: UI
- [ ] Validation status bar
- [ ] Error panel
- [ ] Loop progress display
- [ ] Settings integration

### Phase 5: Advanced Validators
- [ ] TestValidator
- [ ] UIValidator (Playwright MCP integration)
- [ ] Custom validator API

## Open Questions

1. **Watch mode vs on-demand**: Should validators run continuously (watch mode) or only after agent actions?
2. **Test scope**: Run all tests or only affected tests? Risk of slow feedback vs incomplete validation.
3. **Error prioritization**: How to rank errors when agent has limited context? By severity? Recency? File proximity?
4. **MCP integration**: Should UI validator use existing Playwright MCP or bundle its own?
5. **Cross-runtime compatibility**: Do all three runtimes (deepagents, claude-sdk, codex) support mid-stream injection of validation feedback?
