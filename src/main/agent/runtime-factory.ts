/**
 * Runtime factory for agent execution.
 *
 * Creates runtime adapters based on the specified runtime type.
 * Supports deepagents, claude-sdk, and codex runtimes.
 */

import type { AgentRuntimeAdapter, RuntimeType } from './types'
import { createDeepagentsAdapter } from './runtimes/deepagents'
import { createClaudeSdkAdapter } from './runtimes/claude-sdk'
import { createCodexSdkAdapter } from './runtimes/codex-sdk'

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
    case 'codex':
      return createCodexSdkAdapter()
    case 'deepagents':
    default:
      return createDeepagentsAdapter()
  }
}
