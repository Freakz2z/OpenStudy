import type { AppSettings, LLMProviderType } from './types.js';

export type LLMTransport =
  | 'openai'
  | 'deepseek'
  | 'anthropic'
  | 'ollama'
  | 'openai-compat';

export interface LLMProviderPreset {
  provider: LLMProviderType;
  baseUrl: string;
  model: string;
  needKey: boolean;
  transport: LLMTransport;
}

export const LLM_PROVIDER_ORDER: LLMProviderType[] = [
  'deepseek',
  'openai',
  'anthropic',
  'gemini',
  'groq',
  'xai',
  'openrouter',
  'ollama',
];

export const LLM_PROVIDER_PRESETS: Record<LLMProviderType, LLMProviderPreset> = {
  deepseek: {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    needKey: true,
    transport: 'deepseek',
  },
  openai: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    needKey: true,
    transport: 'openai',
  },
  anthropic: {
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-haiku-4-5',
    needKey: true,
    transport: 'anthropic',
  },
  gemini: {
    provider: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash',
    needKey: true,
    transport: 'openai-compat',
  },
  groq: {
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    needKey: true,
    transport: 'openai-compat',
  },
  xai: {
    provider: 'xai',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-4.3',
    needKey: true,
    transport: 'openai-compat',
  },
  openrouter: {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-5.2',
    needKey: true,
    transport: 'openai-compat',
  },
  ollama: {
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen2.5',
    needKey: false,
    transport: 'ollama',
  },
};

export function getLLMProviderPreset(provider: LLMProviderType): LLMProviderPreset {
  return LLM_PROVIDER_PRESETS[provider];
}

export function applyLLMProviderDefaults(
  llm: AppSettings['llm'],
): AppSettings['llm'] {
  const preset = getLLMProviderPreset(llm.provider);
  return {
    ...llm,
    baseUrl: llm.baseUrl?.trim() || preset.baseUrl,
    model: llm.model?.trim() || preset.model,
    apiKey: preset.needKey ? llm.apiKey : undefined,
  };
}
