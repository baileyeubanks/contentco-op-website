/**
 * CoEdit AI Engine — White-labeled, model-agnostic AI service.
 *
 * Architecture:
 * - CoEdit/CoDeliver: Gemini Flash (fast, cheap, real-time suggestions)
 * - CoScript: GPT blend → Claude Opus (dual-model creative writing)
 * - All branded as "Co-op AI" — no vendor names exposed to users
 *
 * The engine routes through a proxy endpoint so API keys never touch the client.
 * For local dev, direct API calls are supported with keys from env vars.
 */

export type AIModel = 'flash' | 'opus' | 'gpt';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  model?: AIModel;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Model routing configuration
const MODEL_CONFIG: Record<AIModel, {
  provider: string;
  model: string;
  endpoint: string;
}> = {
  flash: {
    provider: 'google',
    model: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  },
  opus: {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    endpoint: 'https://api.anthropic.com/v1/messages',
  },
  gpt: {
    provider: 'openai',
    model: 'gpt-4.1',
    endpoint: 'https://api.openai.com/v1/chat/completions',
  },
};

// Default model for CoEdit features
const DEFAULT_MODEL: AIModel = 'flash';

class CoopAI {
  private apiKeys: Record<string, string> = {};
  private proxyUrl: string | null = null;

  configure(config: { proxyUrl?: string; apiKeys?: Record<string, string> }) {
    if (config.proxyUrl) this.proxyUrl = config.proxyUrl;
    if (config.apiKeys) this.apiKeys = { ...this.apiKeys, ...config.apiKeys };
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    const model = request.model || DEFAULT_MODEL;

    // If proxy is configured, route all requests through it
    if (this.proxyUrl) {
      return this.proxyComplete(request, model);
    }

    // Direct API calls (dev mode)
    const config = MODEL_CONFIG[model];
    switch (config.provider) {
      case 'google':
        return this.geminiComplete(request, config);
      case 'anthropic':
        return this.anthropicComplete(request, config);
      case 'openai':
        return this.openaiComplete(request, config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  async *stream(request: AIRequest): AsyncGenerator<string> {
    // Streaming implementation — for real-time UI feedback
    const model = request.model || DEFAULT_MODEL;

    if (this.proxyUrl) {
      // Stream through proxy
      const res = await fetch(`${this.proxyUrl}/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, model }),
      });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
      return;
    }

    // Fallback: non-streaming complete
    const result = await this.complete(request);
    yield result.content;
  }

  // --- CoEdit-specific AI features ---

  /** Suggest a scene layout based on the current elements */
  async suggestLayout(elementDescriptions: string[]): Promise<string> {
    const res = await this.complete({
      model: 'flash',
      messages: [
        {
          role: 'system',
          content:
            'You are a video production AI assistant. Suggest layout improvements for the given scene elements. Be concise and actionable.',
        },
        {
          role: 'user',
          content: `Current scene elements:\n${elementDescriptions.join('\n')}\n\nSuggest layout improvements.`,
        },
      ],
      maxTokens: 500,
      temperature: 0.7,
    });
    return res.content;
  }

  /** Generate subtitle text from a transcript */
  async refineSubtitles(rawTranscript: string): Promise<string> {
    const res = await this.complete({
      model: 'flash',
      messages: [
        {
          role: 'system',
          content:
            'Clean up this raw transcript. Fix grammar, punctuation, and formatting. Keep the natural speech patterns. Output clean subtitle text only.',
        },
        { role: 'user', content: rawTranscript },
      ],
      maxTokens: 2000,
      temperature: 0.3,
    });
    return res.content;
  }

  /** Suggest color grading based on mood/genre */
  async suggestColorGrade(description: string): Promise<string> {
    const res = await this.complete({
      model: 'flash',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional colorist. Suggest color grading settings (exposure, contrast, temperature, tint, saturation, highlights, shadows) as JSON. Values from -100 to 100.',
        },
        { role: 'user', content: `Suggest a color grade for: ${description}` },
      ],
      maxTokens: 300,
      temperature: 0.5,
    });
    return res.content;
  }

  /** Analyze video content for auto-cut suggestions */
  async analyzeForAutoCut(waveformSummary: string): Promise<string> {
    const res = await this.complete({
      model: 'flash',
      messages: [
        {
          role: 'system',
          content:
            'Analyze this waveform/energy data and suggest optimal cut points for an interview edit. Identify silence gaps, filler words, and natural sentence boundaries.',
        },
        { role: 'user', content: waveformSummary },
      ],
      maxTokens: 1000,
      temperature: 0.3,
    });
    return res.content;
  }

  // --- Provider implementations ---

  private async proxyComplete(request: AIRequest, model: AIModel): Promise<AIResponse> {
    const res = await fetch(`${this.proxyUrl}/ai/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, model }),
    });
    if (!res.ok) throw new Error(`AI proxy error: ${res.status}`);
    return res.json();
  }

  private async geminiComplete(
    request: AIRequest,
    config: (typeof MODEL_CONFIG)[AIModel],
  ): Promise<AIResponse> {
    const key = this.apiKeys.google;
    if (!key) throw new Error('Google API key not configured');

    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = request.messages.find((m) => m.role === 'system');

    const res = await fetch(`${config.endpoint}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction.content }] }
          : undefined,
        generationConfig: {
          maxOutputTokens: request.maxTokens || 1024,
          temperature: request.temperature ?? 0.7,
        },
      }),
    });

    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model: config.model,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }

  private async anthropicComplete(
    request: AIRequest,
    config: (typeof MODEL_CONFIG)[AIModel],
  ): Promise<AIResponse> {
    const key = this.apiKeys.anthropic;
    if (!key) throw new Error('Anthropic API key not configured');

    const system = request.messages.find((m) => m.role === 'system')?.content;
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: request.maxTokens || 1024,
        system,
        messages,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
    const data = await res.json();
    return {
      content: data.content?.[0]?.text || '',
      model: config.model,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
    };
  }

  private async openaiComplete(
    request: AIRequest,
    config: (typeof MODEL_CONFIG)[AIModel],
  ): Promise<AIResponse> {
    const key = this.apiKeys.openai;
    if (!key) throw new Error('OpenAI API key not configured');

    const messages = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: request.maxTokens || 1024,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model: config.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
    };
  }
}

// Singleton — white-labeled as "Co-op AI"
export const coopAI = new CoopAI();
