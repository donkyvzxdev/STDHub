export type AiPresetId =
  | 'pollinations'
  | 'openai'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'ollama'
  | 'custom'

export interface AiPreset {
  baseUrl: string
  model: string
  needsKey: boolean
}

/**
 * OpenAI-compatible providers. Anything speaking `/chat/completions`
 * works here — including a future custom backend. Defaults favor what
 * runs without a key (Pollinations, Ollama) so the prototype works
 * out of the box.
 */
export const AI_PRESETS: Record<AiPresetId, AiPreset> = {
  pollinations: {
    baseUrl: 'https://text.pollinations.ai/openai',
    model: 'openai',
    needsKey: false,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    needsKey: true,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/auto',
    needsKey: true,
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    needsKey: true,
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.1-8b-instant',
    needsKey: true,
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1',
    needsKey: false,
  },
  custom: { baseUrl: '', model: '', needsKey: false },
}

export interface AiProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ChatMsg {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class AiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiError'
  }
}

type FetchFn = typeof fetch;

/**
 * One chat completion round-trip (no streaming in the prototype).
 * Throws AiError with the provider's message (or a code) on any failure.
 */
export async function chatCompletion(
  config: AiProviderConfig,
  messages: ChatMsg[],
  fetchFn: FetchFn = fetch,
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const model = config.model.trim()
  if (!baseUrl || !model) throw new AiError('ai-not-configured')
  let res: Response
  try {
    res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey.trim() !== ''
          ? { Authorization: `Bearer ${config.apiKey.trim()}` }
          : {}),
      },
      body: JSON.stringify({ model, messages }),
    })
  } catch {
    throw new AiError('ai-unreachable')
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // Non-JSON error page — fall through to the status message.
  }
  if (!res.ok) {
    throw new AiError(providerMessage(body) ?? `ai-http-${res.status}`)
  }
  const text = extractText(body)
  if (!text) throw new AiError('ai-empty')
  return text
}

function providerMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const err = (body as Record<string, unknown>)['error']
  if (typeof err === 'string' && err !== '') return err
  if (typeof err === 'object' && err !== null) {
    const msg = (err as Record<string, unknown>)['message']
    if (typeof msg === 'string' && msg !== '') return msg
  }
  return null
}

function extractText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const choices = (body as Record<string, unknown>)['choices']
  if (!Array.isArray(choices) || choices.length === 0) return null
  const message = (choices[0] as Record<string, unknown>)?.['message'] as
    | Record<string, unknown>
    | undefined
  const content = message?.['content']
  if (typeof content === 'string') {
    return content.trim() === '' ? null : content
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        typeof part === 'object' && part !== null
          ? ((part as Record<string, unknown>)['text'] as string ?? '')
          : '',
      )
      .join('')
    return text.trim() === '' ? null : text
  }
  return null
}
