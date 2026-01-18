// Backpressure validation types

export interface BackpressureError {
  source: 'typecheck' | 'lint' | 'test' | 'ui' | 'custom'
  severity: 'error' | 'warning' | 'info'
  file?: string
  line?: number
  column?: number
  message: string
  code?: string // Error code (TS2345, no-unused-vars)
  suggestion?: string // Auto-fix or hint
  raw?: string // Original output for context
}

export interface ValidatorResult {
  passed: boolean
  errors: BackpressureError[]
  duration: number // ms
}

export interface Validator {
  name: string
  /** Glob patterns for files this validator cares about */
  patterns: string[]
  /** Run validation, return structured errors */
  validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult>
  /** Optional: watch mode for incremental validation */
  watch?(workspacePath: string): AsyncGenerator<ValidatorResult>
}
