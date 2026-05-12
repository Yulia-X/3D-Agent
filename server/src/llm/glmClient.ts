import { config } from '../config.js'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GLMResponse {
  id: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class GLMClient {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor() {
    this.apiKey = config.GLM_API_KEY
    this.baseUrl = config.GLM_API_BASE
    this.model = config.GLM_MODEL
  }

  async chat(messages: ChatMessage[], options?: { temperature?: number; max_tokens?: number }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.max_tokens ?? 2048,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GLM API error (${response.status}): ${error}`)
    }

    const data: GLMResponse = await response.json() as GLMResponse
    return data.choices[0]?.message?.content || ''
  }
}

export const glmClient = new GLMClient()
