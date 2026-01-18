/**
 * Codex SDK runtime adapter.
 *
 * Implements the AgentRuntimeAdapter interface using the OpenAI Codex SDK.
 * Streams token events to the renderer and uses Electron dialogs for HITL approvals.
 */

import { Codex } from '@openai/codex-sdk'
import type { ThreadItem, AgentMessageItem, ReasoningItem } from '@openai/codex-sdk'
import { getThread, updateThread } from '../../db'
import type {
  AgentRuntimeAdapter,
  StreamInput,
  ResumeArgs,
  InterruptArgs,
  RuntimeStreamEvent
} from '../types'

// Default model to use if none specified or if specified model is not a Codex/OpenAI model
const DEFAULT_CODEX_MODEL = 'gpt-5-codex'

/**
 * Check if a model ID is a Codex/OpenAI model.
 */
function isCodexModel(modelId: string | undefined): boolean {
  if (!modelId) return false
  return modelId.startsWith('gpt-') || modelId.startsWith('o1') || modelId.startsWith('o3')
}

/**
 * Get Codex thread ID from Openwork thread metadata.
 */
function getCodexThreadId(threadId: string): string | undefined {
  const thread = getThread(threadId)
  if (!thread?.metadata) return undefined
  try {
    const metadata = JSON.parse(thread.metadata)
    return metadata.codexThreadId
  } catch {
    return undefined
  }
}

/**
 * Save Codex thread ID to Openwork thread metadata.
 */
function saveCodexThreadId(threadId: string, codexThreadId: string): void {
  const thread = getThread(threadId)
  if (!thread) return
  const metadata = thread.metadata ? JSON.parse(thread.metadata) : {}
  metadata.codexThreadId = codexThreadId
  updateThread(threadId, { metadata: JSON.stringify(metadata) })
}

/**
 * Extract text content from ThreadItem.
 * Returns text from agent_message or reasoning items.
 */
function extractTextFromItem(item: ThreadItem): string | null {
  if (item.type === 'agent_message') {
    return (item as AgentMessageItem).text
  }
  if (item.type === 'reasoning') {
    return (item as ReasoningItem).text
  }
  return null
}

/**
 * Create a Codex SDK runtime adapter.
 */
export function createCodexSdkAdapter(): AgentRuntimeAdapter {
  return {
    async *stream(input: StreamInput, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      const { threadId, message, workspacePath, modelId } = input

      // Determine model to use
      const model = isCodexModel(modelId) ? modelId : DEFAULT_CODEX_MODEL

      // Check for existing Codex thread to resume
      const existingCodexThreadId = getCodexThreadId(threadId)

      // Generate a message ID for token streaming
      const messageId = `codex-${Date.now()}`

      try {
        // Create Codex client with workspace as working directory
        // Note: Codex SDK inherits env from process.env by default
        const codex = new Codex({
          env: {
            // Pass through essential env vars
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
            HOME: process.env.HOME || '',
            PATH: process.env.PATH || ''
          }
        })

        // Start or resume thread
        const thread = existingCodexThreadId
          ? codex.resumeThread(existingCodexThreadId, {
              model,
              workingDirectory: workspacePath,
              skipGitRepoCheck: true,
              // Require approval for destructive actions
              approvalPolicy: 'on-request'
            })
          : codex.startThread({
              model,
              workingDirectory: workspacePath,
              skipGitRepoCheck: true,
              approvalPolicy: 'on-request'
            })

        // Stream the run - runStreamed returns Promise<StreamedTurn>
        const streamedTurn = await thread.runStreamed(message, { signal })

        for await (const event of streamedTurn.events) {
          if (signal.aborted) break

          // Capture thread ID from thread.started event
          if (event.type === 'thread.started') {
            if (event.thread_id) {
              saveCodexThreadId(threadId, event.thread_id)
            }
          }

          // Stream item content as tokens
          if (event.type === 'item.completed') {
            const text = extractTextFromItem(event.item)
            if (text) {
              yield { type: 'token', messageId, token: text }
            }
          }

          // Handle turn failure
          if (event.type === 'turn.failed') {
            yield { type: 'error', error: event.error?.message || 'Turn failed' }
          }

          // Handle stream errors (ThreadErrorEvent has message directly, not error.message)
          if (event.type === 'error') {
            yield { type: 'error', error: event.message || 'Stream error' }
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
            error.message.includes('cancelled'))

        if (!isAbortError) {
          yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
        }
      }
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async *resume(args: ResumeArgs, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      // Codex SDK handles session persistence via thread IDs
      // For now, resume is not fully supported - would need to map checkpoint semantics
      yield { type: 'error', error: 'Resume from checkpoint not yet supported for Codex runtime' }
    },

    async *interrupt(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      args: InterruptArgs,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      signal: AbortSignal
    ): AsyncGenerator<RuntimeStreamEvent> {
      // Codex SDK uses approvalPolicy for HITL rather than interrupt callbacks
      // The modal approval dialog is shown inline during streaming via approvalPolicy
      // This method is called after renderer-side HITL, which doesn't apply here
      yield { type: 'error', error: 'Interrupt handling not yet supported for Codex runtime' }
    }
  }
}
