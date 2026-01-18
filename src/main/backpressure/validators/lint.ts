import path from 'path'
import { execFileNoThrow } from '../utils/execFileNoThrow'
import type { Validator, ValidatorResult, BackpressureError } from '../types'

interface ESLintMessage {
  ruleId: string | null
  severity: 1 | 2
  message: string
  line: number
  column: number
  fix?: {
    range: [number, number]
    text: string
  }
}

interface ESLintFileResult {
  filePath: string
  messages: ESLintMessage[]
  errorCount: number
  warningCount: number
}

/**
 * ESLint-based lint validator.
 * Runs eslint with JSON output and parses structured errors/warnings.
 */
export class LintValidator implements Validator {
  name = 'lint'
  patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']

  async validate(changedFiles: string[], workspacePath: string): Promise<ValidatorResult> {
    const start = Date.now()

    // Filter files to those under workspacePath and matching patterns
    const relevantFiles = changedFiles.filter((file) => {
      // Ensure file is under workspacePath
      const relative = path.relative(workspacePath, file)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return false
      }
      // Check against patterns (simple extension matching for **/*.ext patterns)
      return this.patterns.some((pattern) => this.matchesPattern(relative, pattern))
    })

    if (relevantFiles.length === 0) {
      return {
        passed: true,
        errors: [],
        duration: Date.now() - start
      }
    }

    // Run ESLint with JSON output; use -- to separate flags from file paths
    const { stdout, stderr, status } = await execFileNoThrow(
      'npx',
      ['eslint', '--format', 'json', '--', ...relevantFiles],
      { cwd: workspacePath }
    )

    const errors = this.parseOutput(stdout, stderr, status)
    const hasErrors = errors.some((e) => e.severity === 'error')

    return {
      passed: status === 0 || !hasErrors,
      errors,
      duration: Date.now() - start
    }
  }

  /**
   * Parse ESLint JSON output into BackpressureError[].
   * Falls back to generic error if parsing fails.
   */
  private parseOutput(stdout: string, stderr: string, status: number): BackpressureError[] {
    const errors: BackpressureError[] = []

    // Try to parse JSON output
    let eslintOutput: ESLintFileResult[]
    try {
      eslintOutput = JSON.parse(stdout || '[]')
    } catch {
      // JSON parse failed; return generic error if non-zero exit
      if (status !== 0) {
        return [
          {
            source: 'lint',
            severity: 'error',
            message: 'ESLint failed to produce parseable output',
            raw: (stdout + stderr).trim() || `eslint exited with code ${status}`
          }
        ]
      }
      return []
    }

    // Parse structured results
    for (const file of eslintOutput) {
      for (const msg of file.messages) {
        errors.push({
          source: 'lint',
          severity: msg.severity === 2 ? 'error' : 'warning',
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          code: msg.ruleId ?? undefined,
          message: msg.message,
          suggestion: msg.fix ? 'Auto-fixable with --fix' : undefined
        })
      }
    }

    // If status is non-zero but we found no structured errors, add generic error
    if (status !== 0 && errors.length === 0) {
      errors.push({
        source: 'lint',
        severity: 'error',
        message: 'ESLint check failed',
        raw: (stdout + stderr).trim() || `eslint exited with code ${status}`
      })
    }

    return errors
  }

  /**
   * Simple glob pattern matching for common patterns.
   * Supports patterns like ** followed by /*.ts, /*.tsx, etc.
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Handle **/*.ext patterns (match any file with the extension)
    if (pattern.startsWith('**/')) {
      const suffix = pattern.slice(3) // Remove **/
      if (suffix.startsWith('*.')) {
        // **/*.ext - match files ending with .ext
        const ext = suffix.slice(1) // Remove the leading *
        return filePath.endsWith(ext)
      }
      // **/filename - match files with exact name anywhere
      return filePath.endsWith(suffix) || filePath.includes('/' + suffix)
    }
    // Exact match
    return filePath === pattern
  }
}
