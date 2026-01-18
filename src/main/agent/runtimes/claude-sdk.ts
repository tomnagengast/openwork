/**
 * Claude Agent SDK runtime adapter.
 *
 * Implements the AgentRuntimeAdapter interface using the Claude Agent SDK.
 * Streams token events to the renderer and uses Electron dialogs for HITL approvals.
 */

import { dialog } from 'electron'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { getThread, updateThread } from '../../db'
import type {
  AgentRuntimeAdapter,
  StreamInput,
  ResumeArgs,
  InterruptArgs,
  RuntimeStreamEvent
} from '../types'

// Default model to use if none specified or if specified model is not Claude
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'

/**
 * Check if a model ID is a Claude model.
 */
function isClaudeModel(modelId: string | undefined): boolean {
  if (!modelId) return false
  return modelId.startsWith('claude-')
}

/**
 * Get Claude session ID from thread metadata.
 */
function getSessionId(threadId: string): string | undefined {
  const thread = getThread(threadId)
  if (!thread?.metadata) return undefined
  try {
    const metadata = JSON.parse(thread.metadata)
    return metadata.claudeSessionId
  } catch {
    return undefined
  }
}

/**
 * Save Claude session ID to thread metadata.
 */
function saveSessionId(threadId: string, sessionId: string): void {
  const thread = getThread(threadId)
  if (!thread) return
  const metadata = thread.metadata ? JSON.parse(thread.metadata) : {}
  metadata.claudeSessionId = sessionId
  updateThread(threadId, { metadata: JSON.stringify(metadata) })
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
function truncate(str: string, maxLen = 200): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

/**
 * Format tool input for display in approval dialog.
 */
function formatToolInput(input: unknown): string {
  try {
    const str = JSON.stringify(input, null, 2)
    return truncate(str, 500)
  } catch {
    return String(input)
  }
}

/** Permission result type matching the Claude SDK's PermissionResult */
type PermissionResult =
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string }

/**
 * Show an Electron dialog to approve/deny tool usage.
 * Returns the permission result for the SDK.
 */
async function showToolApprovalDialog(
  toolName: string,
  input: Record<string, unknown>
): Promise<PermissionResult> {
  const inputPreview = formatToolInput(input)

  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Allow', 'Deny'],
    defaultId: 0,
    cancelId: 1,
    title: 'Tool Permission Request',
    message: `Claude wants to use: ${toolName}`,
    detail: `Input:\n${inputPreview}`,
    noLink: true
  })

  if (result.response === 0) {
    return { behavior: 'allow', updatedInput: input }
  } else {
    return { behavior: 'deny', message: 'User denied this action' }
  }
}

/**
 * Create a Claude Agent SDK runtime adapter.
 */
export function createClaudeSdkAdapter(): AgentRuntimeAdapter {
  return {
    async *stream(input: StreamInput, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      const { threadId, message, workspacePath, modelId } = input

      // Determine model to use
      const model = isClaudeModel(modelId) ? modelId : DEFAULT_CLAUDE_MODEL

      // Check for existing session to resume
      const existingSessionId = getSessionId(threadId)

      // Create abort controller for the SDK
      const abortController = new AbortController()

      // Link to parent signal
      signal.addEventListener('abort', () => abortController.abort())

      // Generate a message ID for token streaming
      const messageId = `claude-${Date.now()}`

      try {
        const q = query({
          prompt: message,
          options: {
            model,
            cwd: workspacePath,
            resume: existingSessionId,
            abortController,
            permissionMode: 'default',
            canUseTool: async (toolName, toolInput) => {
              return showToolApprovalDialog(toolName, toolInput)
            }
          }
        })

        for await (const sdkMessage of q) {
          if (signal.aborted) break

          // Capture session ID from init message
          if (sdkMessage.type === 'system' && sdkMessage.subtype === 'init') {
            const sessionId = sdkMessage.session_id
            if (sessionId) {
              saveSessionId(threadId, sessionId)
            }
          }

          // Stream assistant message content as tokens
          if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
            for (const block of sdkMessage.message.content) {
              if ('text' in block && typeof block.text === 'string') {
                yield { type: 'token', messageId, token: block.text }
              }
            }
          }

          // Handle result message
          if (sdkMessage.type === 'result') {
            if (sdkMessage.subtype === 'success') {
              // Final result, we're done
            } else {
              // Error result
              const errors = 'errors' in sdkMessage ? sdkMessage.errors : []
              if (errors.length > 0) {
                yield { type: 'error', error: errors.join('; ') }
              }
            }
          }
        }

        if (!signal.aborted) {
          yield { type: 'done' }
        }
      } catch (error) {
        // Ignore abort errors
        const isAbortError =
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Controller is already closed'))

        if (!isAbortError) {
          yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    },

    async *resume(args: ResumeArgs, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      const { threadId, workspacePath, command } = args

      // Get session ID from thread metadata
      const sessionId = getSessionId(threadId)

      if (!sessionId) {
        yield { type: 'error', error: 'No Claude session found for this thread' }
        return
      }

      // Extract decision from command
      const typedCommand = command as { resume?: { decision?: string } }
      const decision = typedCommand?.resume?.decision || 'approve'

      // Create abort controller
      const abortController = new AbortController()
      signal.addEventListener('abort', () => abortController.abort())

      const messageId = `claude-resume-${Date.now()}`

      try {
        // Resume the session with a continue message
        const q = query({
          prompt: decision === 'approve' ? 'Continue' : 'Stop',
          options: {
            model: DEFAULT_CLAUDE_MODEL,
            cwd: workspacePath,
            resume: sessionId,
            abortController,
            permissionMode: 'default',
            canUseTool: async (toolName, toolInput) => {
              return showToolApprovalDialog(toolName, toolInput)
            }
          }
        })

        for await (const sdkMessage of q) {
          if (signal.aborted) break

          if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
            for (const block of sdkMessage.message.content) {
              if ('text' in block && typeof block.text === 'string') {
                yield { type: 'token', messageId, token: block.text }
              }
            }
          }

          if (sdkMessage.type === 'result') {
            if (sdkMessage.subtype !== 'success') {
              const errors = 'errors' in sdkMessage ? sdkMessage.errors : []
              if (errors.length > 0) {
                yield { type: 'error', error: errors.join('; ') }
              }
            }
          }
        }

        if (!signal.aborted) {
          yield { type: 'done' }
        }
      } catch (error) {
        const isAbortError =
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Controller is already closed'))

        if (!isAbortError) {
          yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    },

    async *interrupt(args: InterruptArgs, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      const { threadId, workspacePath, decision } = args

      // Get session ID from thread metadata
      const sessionId = getSessionId(threadId)

      if (!sessionId) {
        yield { type: 'error', error: 'No Claude session found for this thread' }
        return
      }

      // For Claude SDK, interrupts are handled via the canUseTool callback
      // If we get here, it means the tool was approved/rejected
      if (decision.type === 'reject') {
        // For reject, just signal done - the agent won't continue
        yield { type: 'done' }
        return
      }

      // For approve, resume the session
      const abortController = new AbortController()
      signal.addEventListener('abort', () => abortController.abort())

      const messageId = `claude-interrupt-${Date.now()}`

      try {
        const q = query({
          prompt: 'Continue with the approved action',
          options: {
            model: DEFAULT_CLAUDE_MODEL,
            cwd: workspacePath,
            resume: sessionId,
            abortController,
            permissionMode: 'default',
            canUseTool: async (toolName, toolInput) => {
              return showToolApprovalDialog(toolName, toolInput)
            }
          }
        })

        for await (const sdkMessage of q) {
          if (signal.aborted) break

          if (sdkMessage.type === 'assistant' && sdkMessage.message?.content) {
            for (const block of sdkMessage.message.content) {
              if ('text' in block && typeof block.text === 'string') {
                yield { type: 'token', messageId, token: block.text }
              }
            }
          }

          if (sdkMessage.type === 'result') {
            if (sdkMessage.subtype !== 'success') {
              const errors = 'errors' in sdkMessage ? sdkMessage.errors : []
              if (errors.length > 0) {
                yield { type: 'error', error: errors.join('; ') }
              }
            }
          }
        }

        if (!signal.aborted) {
          yield { type: 'done' }
        }
      } catch (error) {
        const isAbortError =
          error instanceof Error &&
          (error.name === 'AbortError' ||
            error.message.includes('aborted') ||
            error.message.includes('Controller is already closed'))

        if (!isAbortError) {
          yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    }
  }
}
