import { execFile as nodeExecFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(nodeExecFile)

export interface ExecResult {
  stdout: string
  stderr: string
  status: number
}

/**
 * Safe command execution using execFile (not exec).
 * Avoids shell injection by passing arguments as array.
 * Never throws; always returns an ExecResult.
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
    const e = error as { stdout?: string; stderr?: string; code?: number | string }
    // .code can be non-numeric (e.g. 'ENOENT'); coerce to number
    const code = e.code
    const status = typeof code === 'number' && Number.isInteger(code) ? code : 1
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      status
    }
  }
}
