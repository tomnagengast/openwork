/**
 * DeepAgents runtime adapter.
 *
 * Wraps the existing deepagents integration behind the AgentRuntimeAdapter interface.
 * This preserves all current behavior (checkpointing, LocalSandbox, HITL, etc.)
 * while allowing the IPC layer to be runtime-agnostic.
 */

import { HumanMessage } from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { createAgentRuntime } from '../runtime'
import type {
  AgentRuntimeAdapter,
  StreamInput,
  ResumeArgs,
  InterruptArgs,
  RuntimeStreamEvent
} from '../types'

/**
 * Create a DeepAgents runtime adapter.
 */
export function createDeepagentsAdapter(): AgentRuntimeAdapter {
  return {
    async *stream(input: StreamInput, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      const { threadId, message, workspacePath, modelId } = input

      const agent = await createAgentRuntime({ threadId, workspacePath, modelId })
      const humanMessage = new HumanMessage(message)

      const agentStream = await agent.stream(
        { messages: [humanMessage] },
        {
          configurable: { thread_id: threadId },
          signal,
          streamMode: ['messages', 'values'],
          recursionLimit: 1000
        }
      )

      for await (const chunk of agentStream) {
        if (signal.aborted) break

        // With multiple stream modes, chunks are tuples: [mode, data]
        const [mode, data] = chunk as [string, unknown]

        yield {
          type: 'stream',
          mode: mode as 'messages' | 'values',
          data: JSON.parse(JSON.stringify(data))
        }
      }

      if (!signal.aborted) {
        yield { type: 'done' }
      }
    },

    async *resume(args: ResumeArgs, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      const { threadId, workspacePath, command } = args

      const agent = await createAgentRuntime({ threadId, workspacePath })
      const config = {
        configurable: { thread_id: threadId },
        signal,
        streamMode: ['messages', 'values'] as const,
        recursionLimit: 1000
      }

      // Resume from checkpoint by streaming with Command containing the decision
      // The HITL middleware expects { decisions: [{ type: 'approve' | 'reject' | 'edit' }] }
      const typedCommand = command as { resume?: { decision?: string } }
      const decisionType = typedCommand?.resume?.decision || 'approve'
      const resumeValue = { decisions: [{ type: decisionType }] }
      const agentStream = await agent.stream(new Command({ resume: resumeValue }), config)

      for await (const chunk of agentStream) {
        if (signal.aborted) break

        const [mode, data] = chunk as unknown as [string, unknown]
        yield {
          type: 'stream',
          mode: mode as 'messages' | 'values',
          data: JSON.parse(JSON.stringify(data))
        }
      }

      if (!signal.aborted) {
        yield { type: 'done' }
      }
    },

    async *interrupt(args: InterruptArgs, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent> {
      const { threadId, workspacePath, decision } = args

      const agent = await createAgentRuntime({ threadId, workspacePath })
      const config = {
        configurable: { thread_id: threadId },
        signal,
        streamMode: ['messages', 'values'] as const,
        recursionLimit: 1000
      }

      if (decision.type === 'approve') {
        // Resume execution by invoking with null (continues from checkpoint)
        const agentStream = await agent.stream(null, config)

        for await (const chunk of agentStream) {
          if (signal.aborted) break

          const [mode, data] = chunk as unknown as [string, unknown]
          yield {
            type: 'stream',
            mode: mode as 'messages' | 'values',
            data: JSON.parse(JSON.stringify(data))
          }
        }

        if (!signal.aborted) {
          yield { type: 'done' }
        }
      } else if (decision.type === 'reject') {
        // For reject, we need to send a Command with reject decision
        // For now, just send done - the agent will see no resumption happened
        yield { type: 'done' }
      }
      // edit case handled similarly to approve with modified args
    }
  }
}
