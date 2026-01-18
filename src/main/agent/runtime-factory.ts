/**
 * Runtime factory for agent execution.
 *
 * Creates runtime adapters based on the specified runtime type.
 * Supports deepagents and claude-sdk; codex will be added later.
 */

import type { AgentRuntimeAdapter, RuntimeType } from './types'
import { createDeepagentsAdapter } from './runtimes/deepagents'
import { createClaudeSdkAdapter } from './runtimes/claude-sdk'

export interface CreateRuntimeOptions {
  threadId: string
  workspacePath: string
  modelId?: string
}

/**
 * Create an agent runtime adapter.
 *
 * @param type - The runtime type
 * @param _opts - Runtime options (reserved for future use)
 * @returns An AgentRuntimeAdapter instance
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createRuntime(type: RuntimeType, _opts: CreateRuntimeOptions): AgentRuntimeAdapter {
  switch (type) {
    case 'claude-sdk':
      return createClaudeSdkAdapter()
    case 'deepagents':
    case 'codex':
    default:
      return createDeepagentsAdapter()
  }
}
