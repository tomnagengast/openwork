import { useState, useEffect } from 'react'
import { Eye, EyeOff, Check, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ProviderConfig {
  id: string
  name: string
  envVar: string
  placeholder: string
  runtimes: string[] // Which runtimes need this provider
}

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

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    placeholder: 'sk-ant-...',
    runtimes: ['deepagents', 'claude-sdk']
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    placeholder: 'sk-...',
    runtimes: ['codex']
  },
  {
    id: 'google',
    name: 'Google AI',
    envVar: 'GOOGLE_API_KEY',
    placeholder: 'AIza...',
    runtimes: []
  }
]

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps): React.JSX.Element {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [defaultRuntime, setDefaultRuntime] = useState<RuntimeType>('deepagents')
  const [showAllProviders, setShowAllProviders] = useState(false)

  // Load existing settings on mount
  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  async function loadSettings(): Promise<void> {
    setLoading(true)
    const keys: Record<string, string> = {}
    const saved: Record<string, boolean> = {}

    // Load API keys
    for (const provider of PROVIDERS) {
      try {
        const key = await window.api.models.getApiKey(provider.id)
        if (key) {
          // Show masked version
          keys[provider.id] = '••••••••••••••••'
          saved[provider.id] = true
        } else {
          keys[provider.id] = ''
          saved[provider.id] = false
        }
      } catch {
        keys[provider.id] = ''
        saved[provider.id] = false
      }
    }

    // Load default runtime
    try {
      const runtime = (await window.api.agentRuntime.getDefault()) as RuntimeType
      setDefaultRuntime(runtime)
    } catch (e) {
      console.error('Failed to load default runtime:', e)
    }

    setApiKeys(keys)
    setSavedKeys(saved)
    setLoading(false)
  }

  async function handleRuntimeChange(runtime: RuntimeType): Promise<void> {
    try {
      await window.api.agentRuntime.setDefault(runtime)
      setDefaultRuntime(runtime)
    } catch (e) {
      console.error('Failed to set default runtime:', e)
    }
  }

  // Filter providers based on selected runtime (unless showing all)
  const visibleProviders = showAllProviders
    ? PROVIDERS
    : PROVIDERS.filter(
        (p) => p.runtimes.includes(defaultRuntime) || savedKeys[p.id] || apiKeys[p.id]
      )

  async function saveApiKey(providerId: string): Promise<void> {
    const key = apiKeys[providerId]
    if (!key || key === '••••••••••••••••') return

    setSaving((prev) => ({ ...prev, [providerId]: true }))

    try {
      await window.api.models.setApiKey(providerId, key)
      setSavedKeys((prev) => ({ ...prev, [providerId]: true }))
      setApiKeys((prev) => ({ ...prev, [providerId]: '••••••••••••••••' }))
      setShowKeys((prev) => ({ ...prev, [providerId]: false }))
    } catch (e) {
      console.error('Failed to save API key:', e)
    } finally {
      setSaving((prev) => ({ ...prev, [providerId]: false }))
    }
  }

  function handleKeyChange(providerId: string, value: string): void {
    // If user starts typing on a masked field, clear it
    if (apiKeys[providerId] === '••••••••••••••••' && value.length > 16) {
      value = value.slice(16)
    }
    setApiKeys((prev) => ({ ...prev, [providerId]: value }))
    setSavedKeys((prev) => ({ ...prev, [providerId]: false }))
  }

  function toggleShowKey(providerId: string): void {
    setShowKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure agent runtime and API keys. Keys are stored securely on your device.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        {/* Agent Runtime Section */}
        <div className="space-y-4 py-2">
          <div className="text-section-header">AGENT RUNTIME</div>
          <p className="text-xs text-muted-foreground">
            Choose the default runtime for new agent conversations.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {RUNTIME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleRuntimeChange(option.id)}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-md border text-left transition-colors',
                    defaultRuntime === option.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-background-secondary'
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-sm font-medium">{option.name}</span>
                    {defaultRuntime === option.id && (
                      <Check className="size-3.5 text-primary ml-auto" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* API Keys Section */}
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <div className="text-section-header">API KEYS</div>
            <button
              type="button"
              onClick={() => setShowAllProviders(!showAllProviders)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAllProviders ? (
                <>
                  <ChevronUp className="size-3" />
                  Show relevant
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" />
                  Show all providers
                </>
              )}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {visibleProviders.map((provider) => (
                <div key={provider.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{provider.name}</label>
                    {savedKeys[provider.id] ? (
                      <span className="flex items-center gap-1 text-xs text-status-nominal">
                        <Check className="size-3" />
                        Configured
                      </span>
                    ) : apiKeys[provider.id] ? (
                      <span className="flex items-center gap-1 text-xs text-status-warning">
                        <AlertCircle className="size-3" />
                        Unsaved
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKeys[provider.id] ? 'text' : 'password'}
                        value={apiKeys[provider.id] || ''}
                        onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                        placeholder={provider.placeholder}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showKeys[provider.id] ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      variant={savedKeys[provider.id] ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => saveApiKey(provider.id)}
                      disabled={
                        saving[provider.id] ||
                        !apiKeys[provider.id] ||
                        apiKeys[provider.id] === '••••••••••••••••'
                      }
                    >
                      {saving[provider.id] ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Environment variable: <code className="text-foreground">{provider.envVar}</code>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
