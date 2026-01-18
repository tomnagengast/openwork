import path from 'path'
import fs from 'fs/promises'
import { execFileNoThrow } from '../utils/execFileNoThrow'
import type { Validator, ValidatorResult, BackpressureError } from '../types'

/**
 * TypeScript typecheck validator.
 * Runs tsc against tsconfig.node.json and tsconfig.web.json (if present),
 * falling back to tsconfig.json or default tsc.
 */
export class TypeCheckValidator implements Validator {
  name = 'typecheck'
  patterns = ['**/*.ts', '**/*.tsx']

  async validate(_changedFiles: string[], workspacePath: string): Promise<ValidatorResult> {
    const start = Date.now()
    const configs = await this.detectTsConfigs(workspacePath)
    const allErrors: BackpressureError[] = []
    let anyFailed = false

    for (const configFile of configs) {
      const { stdout, stderr, status } = await execFileNoThrow(
        'npx',
        ['tsc', '--noEmit', '-p', configFile, '--pretty', 'false', '--composite', 'false'],
        { cwd: workspacePath }
      )

      const output = stdout + stderr
      const errors = this.parseTscOutput(output, workspacePath)

      if (status !== 0) {
        anyFailed = true
        if (errors.length === 0) {
          // Non-zero exit but no parseable errors: return generic error
          allErrors.push({
            source: 'typecheck',
            severity: 'error',
            message: `TypeScript check failed for ${configFile}`,
            raw: output.trim() || `tsc exited with code ${status}`
          })
        } else {
          allErrors.push(...errors)
        }
      } else {
        // status === 0, but tsc might still emit warnings
        allErrors.push(...errors)
      }
    }

    return {
      passed: !anyFailed,
      errors: allErrors,
      duration: Date.now() - start
    }
  }

  /**
   * Detect which tsconfig files to use.
   * Prefers tsconfig.node.json + tsconfig.web.json if present,
   * otherwise falls back to tsconfig.json.
   */
  private async detectTsConfigs(workspacePath: string): Promise<string[]> {
    const candidates = ['tsconfig.node.json', 'tsconfig.web.json']
    const found: string[] = []

    for (const name of candidates) {
      const fullPath = path.join(workspacePath, name)
      try {
        await fs.access(fullPath)
        found.push(name)
      } catch {
        // doesn't exist
      }
    }

    if (found.length > 0) {
      return found
    }

    // Fallback to tsconfig.json
    const fallback = path.join(workspacePath, 'tsconfig.json')
    try {
      await fs.access(fallback)
      return ['tsconfig.json']
    } catch {
      // No tsconfig at all; tsc will use default
      return []
    }
  }

  /**
   * Parse TypeScript compiler output into BackpressureError[].
   * Handles patterns:
   *   src/file.ts(10,5): error TS2345: message...
   *   error TS6053: message... (no location)
   */
  private parseTscOutput(output: string, workspacePath: string): BackpressureError[] {
    const errors: BackpressureError[] = []

    // Pattern with file location: src/file.ts(10,5): error TS2345: ...
    const withLocation = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/gm
    let match: RegExpExecArray | null

    while ((match = withLocation.exec(output)) !== null) {
      const [raw, file, line, column, severity, code, message] = match
      errors.push({
        source: 'typecheck',
        severity: severity as 'error' | 'warning',
        file: path.resolve(workspacePath, file),
        line: parseInt(line, 10),
        column: parseInt(column, 10),
        code,
        message,
        raw
      })
    }

    // Pattern without file location: error TS6053: ...
    const noLocation = /^(error|warning)\s+(TS\d+):\s*(.+)$/gm
    while ((match = noLocation.exec(output)) !== null) {
      const [raw, severity, code, message] = match
      errors.push({
        source: 'typecheck',
        severity: severity as 'error' | 'warning',
        code,
        message,
        raw
      })
    }

    return errors
  }
}
