import { IpcMain, BrowserWindow } from 'electron'
import { createRuntime } from '../agent/runtime-factory'
import { getThread } from '../db'
import { getDefaultAgentRuntime } from './models'
import type { HITLDecision } from '../types'
import type { RuntimeType } from '../agent/types'

// Track active runs for cancellation
const activeRuns = new Map<string, AbortController>()

/**
 * Valid runtime types for validation
 */
const VALID_RUNTIMES: RuntimeType[] = ['deepagents', 'claude-sdk', 'codex']

function isValidRuntime(value: unknown): value is RuntimeType {
  return typeof value === 'string' && VALID_RUNTIMES.includes(value as RuntimeType)
}

/**
 * Get effective runtime type for a thread.
 *
 * Precedence (highest → lowest):
 * 1. OPENWORK_AGENT_RUNTIME env var (dev override)
 * 2. Thread metadata override: metadata.agentRuntime
 * 3. Global default: defaultAgentRuntime setting
 * 4. Fallback: 'deepagents'
 */
function getRuntimeType(threadId: string): RuntimeType {
  // 1. Environment variable override (dev/test)
  const envRuntime = process.env.OPENWORK_AGENT_RUNTIME
  if (envRuntime && isValidRuntime(envRuntime)) {
    return envRuntime
  }

  // 2. Thread metadata override
  const thread = getThread(threadId)
  const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
  if (metadata.agentRuntime && isValidRuntime(metadata.agentRuntime)) {
    return metadata.agentRuntime
  }

  // 3. Global default setting
  const globalDefault = getDefaultAgentRuntime()
  if (isValidRuntime(globalDefault)) {
    return globalDefault
  }

  // 4. Fallback
  return 'deepagents'
}

export function registerAgentHandlers(ipcMain: IpcMain): void {
  console.log('[Agent] Registering agent handlers...')

  // Handle agent invocation with streaming
  ipcMain.on(
    'agent:invoke',
    async (event, { threadId, message }: { threadId: string; message: string }) => {
      const channel = `agent:stream:${threadId}`
      const window = BrowserWindow.fromWebContents(event.sender)

      console.log('[Agent] Received invoke request:', {
        threadId,
        message: message.substring(0, 50)
      })

      if (!window) {
        console.error('[Agent] No window found')
        return
      }

      // Abort any existing stream for this thread before starting a new one
      // This prevents concurrent streams which can cause checkpoint corruption
      const existingController = activeRuns.get(threadId)
      if (existingController) {
        console.log('[Agent] Aborting existing stream for thread:', threadId)
        existingController.abort()
        activeRuns.delete(threadId)
      }

      const abortController = new AbortController()
      activeRuns.set(threadId, abortController)

      // Abort the stream if the window is closed/destroyed
      const onWindowClosed = (): void => {
        console.log('[Agent] Window closed, aborting stream for thread:', threadId)
        abortController.abort()
      }
      window.once('closed', onWindowClosed)

      try {
        // Get workspace path from thread metadata - REQUIRED
        const thread = getThread(threadId)
        const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
        const workspacePath = metadata.workspacePath as string | undefined

        if (!workspacePath) {
          window.webContents.send(channel, {
            type: 'error',
            error: 'WORKSPACE_REQUIRED',
            message: 'Please select a workspace folder before sending messages.'
          })
          return
        }

        // Use runtime factory to get adapter
        const runtime = createRuntime(getRuntimeType(threadId), { threadId, workspacePath })

        // Stream via adapter - yields { type: 'stream', mode, data } and { type: 'done' }
        for await (const event of runtime.stream(
          { threadId, message, workspacePath },
          abortController.signal
        )) {
          if (abortController.signal.aborted) break

          // Forward events directly (adapter already serializes data)
          window.webContents.send(channel, event)
        }
      } catch (error) {
        // Ignore abort-related errors (expected when stream is cancelled)
        const isAbortError =
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Controller is already closed'))

        if (!isAbortError) {
          console.error('[Agent] Error:', error)
          window.webContents.send(channel, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } finally {
        window.removeListener('closed', onWindowClosed)
        activeRuns.delete(threadId)
      }
    }
  )

  // Handle agent resume (after interrupt approval/rejection via useStream)
  ipcMain.on(
    'agent:resume',
    async (
      event,
      { threadId, command }: { threadId: string; command: { resume?: { decision?: string } } }
    ) => {
      const channel = `agent:stream:${threadId}`
      const window = BrowserWindow.fromWebContents(event.sender)

      console.log('[Agent] Received resume request:', { threadId, command })

      if (!window) {
        console.error('[Agent] No window found for resume')
        return
      }

      // Get workspace path from thread metadata
      const thread = getThread(threadId)
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
      const workspacePath = metadata.workspacePath as string | undefined

      if (!workspacePath) {
        window.webContents.send(channel, {
          type: 'error',
          error: 'Workspace path is required'
        })
        return
      }

      // Abort any existing stream before resuming
      const existingController = activeRuns.get(threadId)
      if (existingController) {
        existingController.abort()
        activeRuns.delete(threadId)
      }

      const abortController = new AbortController()
      activeRuns.set(threadId, abortController)

      try {
        // Use runtime factory to get adapter
        const runtime = createRuntime(getRuntimeType(threadId), { threadId, workspacePath })

        // Resume via adapter
        for await (const event of runtime.resume(
          { threadId, workspacePath, command },
          abortController.signal
        )) {
          if (abortController.signal.aborted) break
          window.webContents.send(channel, event)
        }
      } catch (error) {
        const isAbortError =
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Controller is already closed'))

        if (!isAbortError) {
          console.error('[Agent] Resume error:', error)
          window.webContents.send(channel, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } finally {
        activeRuns.delete(threadId)
      }
    }
  )

  // Handle HITL interrupt response
  ipcMain.on(
    'agent:interrupt',
    async (event, { threadId, decision }: { threadId: string; decision: HITLDecision }) => {
      const channel = `agent:stream:${threadId}`
      const window = BrowserWindow.fromWebContents(event.sender)

      if (!window) {
        console.error('[Agent] No window found for interrupt response')
        return
      }

      // Get workspace path from thread metadata - REQUIRED
      const thread = getThread(threadId)
      const metadata = thread?.metadata ? JSON.parse(thread.metadata) : {}
      const workspacePath = metadata.workspacePath as string | undefined

      if (!workspacePath) {
        window.webContents.send(channel, {
          type: 'error',
          error: 'Workspace path is required'
        })
        return
      }

      // Abort any existing stream before continuing
      const existingController = activeRuns.get(threadId)
      if (existingController) {
        existingController.abort()
        activeRuns.delete(threadId)
      }

      const abortController = new AbortController()
      activeRuns.set(threadId, abortController)

      try {
        // Use runtime factory to get adapter
        const runtime = createRuntime(getRuntimeType(threadId), { threadId, workspacePath })

        // Handle interrupt via adapter
        for await (const event of runtime.interrupt(
          { threadId, workspacePath, decision },
          abortController.signal
        )) {
          if (abortController.signal.aborted) break
          window.webContents.send(channel, event)
        }
      } catch (error) {
        const isAbortError =
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Controller is already closed'))

        if (!isAbortError) {
          console.error('[Agent] Interrupt error:', error)
          window.webContents.send(channel, {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } finally {
        activeRuns.delete(threadId)
      }
    }
  )

  // Handle cancellation
  ipcMain.handle('agent:cancel', async (_event, { threadId }: { threadId: string }) => {
    const controller = activeRuns.get(threadId)
    if (controller) {
      controller.abort()
      activeRuns.delete(threadId)
    }
  })
}
