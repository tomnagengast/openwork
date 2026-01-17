/**
 * Runtime factory for agent execution.
 *
 * Creates runtime adapters based on the specified runtime type.
 * Currently only supports deepagents; claude-sdk and codex will be added later.
 */

import type { AgentRuntimeAdapter, RuntimeType } from './types'
import { createDeepagentsAdapter } from './runtimes/deepagents'

export interface CreateRuntimeOptions {
  threadId: string
  workspacePath: string
  modelId?: string
}

/**
 * Create an agent runtime adapter.
 *
 * @param type - The runtime type (currently ignored, always returns deepagents)
 * @param _opts - Runtime options (reserved for future use)
 * @returns An AgentRuntimeAdapter instance
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createRuntime(type: RuntimeType, _opts: CreateRuntimeOptions): AgentRuntimeAdapter {
  // For Phase 1, always return deepagents adapter regardless of type
  // Future phases will add claude-sdk and codex support
  switch (type) {
    case 'deepagents':
    case 'claude-sdk':
    case 'codex':
    default:
      return createDeepagentsAdapter()
  }
}
