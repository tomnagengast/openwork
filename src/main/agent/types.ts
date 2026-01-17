// @ts-ignore this is a workaround to avoid type errors in the main process
import type { createAgentRuntime } from './runtime'
import type { HITLDecision } from '../types'

export type DeepAgent = Awaited<ReturnType<typeof createAgentRuntime>>

// ============================================================================
// Runtime Abstraction Layer
// ============================================================================

/** Supported runtime types */
export type RuntimeType = 'deepagents' | 'claude-sdk' | 'codex'

/** Input for streaming agent invocation */
export interface StreamInput {
  threadId: string
  message: string
  workspacePath: string
  modelId?: string
}

/** Stream event from runtime adapters - matches current IPC payload shape */
export type RuntimeStreamEvent =
  | { type: 'stream'; mode: 'messages' | 'values'; data: unknown }
  | { type: 'done' }

/** Arguments for resuming from checkpoint */
export interface ResumeArgs {
  threadId: string
  workspacePath: string
  command: unknown
}

/** Arguments for interrupt response */
export interface InterruptArgs {
  threadId: string
  workspacePath: string
  decision: HITLDecision
}

/**
 * Agent runtime adapter interface.
 *
 * Implementations must yield events matching the existing IPC payload shapes
 * so the renderer remains unchanged.
 */
export interface AgentRuntimeAdapter {
  /**
   * Stream agent execution.
   * Yields { type: 'stream', mode, data } events followed by { type: 'done' }.
   */
  stream(input: StreamInput, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent>

  /**
   * Resume from a checkpoint.
   * Yields { type: 'stream', mode, data } events followed by { type: 'done' }.
   */
  resume(args: ResumeArgs, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent>

  /**
   * Handle HITL interrupt decision.
   * Yields { type: 'stream', mode, data } events followed by { type: 'done' }.
   */
  interrupt(args: InterruptArgs, signal: AbortSignal): AsyncGenerator<RuntimeStreamEvent>
}
