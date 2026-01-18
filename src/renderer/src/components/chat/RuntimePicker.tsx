import { useState, useEffect } from 'react'
import { Cpu, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type RuntimeType = 'deepagents' | 'claude-sdk' | 'codex'

interface RuntimeOption {
  id: RuntimeType
  name: string
  description: string
}

const RUNTIME_OPTIONS: RuntimeOption[] = [
  { id: 'deepagents', name: 'DeepAgents', description: 'LangGraph-based agent runtime' },
  { id: 'claude-sdk', name: 'Claude SDK', description: 'Anthropic Claude Agent SDK' },
  { id: 'codex', name: 'Codex', description: 'OpenAI Codex CLI runtime' }
]

interface RuntimePickerProps {
  threadId: string
}

export function RuntimePicker({ threadId }: RuntimePickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [effectiveRuntime, setEffectiveRuntime] = useState<RuntimeType>('deepagents')
  const [hasOverride, setHasOverride] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load effective runtime for this thread on mount / thread change
  useEffect(() => {
    async function loadRuntime(): Promise<void> {
      setLoading(true)
      try {
        const effective = (await window.api.agentRuntime.get(threadId)) as RuntimeType
        setEffectiveRuntime(effective)

        // Check if this thread has a specific override by checking thread metadata
        const thread = await window.api.threads.get(threadId)
        const metadataStr = thread?.metadata
        const metadata =
          typeof metadataStr === 'string' && metadataStr ? JSON.parse(metadataStr) : {}
        setHasOverride(!!metadata.agentRuntime)
      } catch (e) {
        console.error('[RuntimePicker] Error loading runtime:', e)
      } finally {
        setLoading(false)
      }
    }
    loadRuntime()
  }, [threadId])

  async function handleSelectRuntime(runtimeId: RuntimeType | null): Promise<void> {
    try {
      await window.api.agentRuntime.set(threadId, runtimeId)
      if (runtimeId === null) {
        // Cleared override, load the effective (default)
        const effective = (await window.api.agentRuntime.get(threadId)) as RuntimeType
        setEffectiveRuntime(effective)
        setHasOverride(false)
      } else {
        setEffectiveRuntime(runtimeId)
        setHasOverride(true)
      }
      setOpen(false)
    } catch (e) {
      console.error('[RuntimePicker] Error setting runtime:', e)
    }
  }

  const currentOption = RUNTIME_OPTIONS.find((r) => r.id === effectiveRuntime)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-2 text-xs gap-1.5', 'text-foreground')}
          disabled={!threadId || loading}
        >
          <Cpu className="size-3.5" />
          <span className="max-w-[100px] truncate">{currentOption?.name ?? 'Runtime'}</span>
          {hasOverride && <span className="text-[10px] text-muted-foreground">(override)</span>}
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Agent Runtime
          </div>

          <div className="space-y-1">
            {/* Use default option */}
            <button
              type="button"
              className={cn(
                'w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors',
                !hasOverride
                  ? 'bg-background-secondary border border-border'
                  : 'hover:bg-background-secondary'
              )}
              onClick={() => handleSelectRuntime(null)}
            >
              <div className="w-4 flex-shrink-0">
                {!hasOverride && <Check className="size-3.5 text-status-nominal" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">Use default</div>
                <div className="text-[11px] text-muted-foreground">
                  Inherits from global settings
                </div>
              </div>
            </button>

            {RUNTIME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors',
                  hasOverride && effectiveRuntime === option.id
                    ? 'bg-background-secondary border border-border'
                    : 'hover:bg-background-secondary'
                )}
                onClick={() => handleSelectRuntime(option.id)}
              >
                <div className="w-4 flex-shrink-0">
                  {hasOverride && effectiveRuntime === option.id && (
                    <Check className="size-3.5 text-status-nominal" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{option.name}</div>
                  <div className="text-[11px] text-muted-foreground">{option.description}</div>
                </div>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Change which agent runtime powers this thread. Global default can be changed in
            Settings.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
