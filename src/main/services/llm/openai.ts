import type { LLMProvider } from './index.js';
import type { AppSettings } from '../../../shared/types.js';
import { OpenAICompatProvider } from './openai-compat.js';

// OpenAI 官方。复用 OpenAI 协议实现，但允许在 cfg 缺失 baseUrl 时回退到官方域名。
export class OpenAIProvider implements LLMProvider {
  private inner: OpenAICompatProvider;
  constructor(cfg: AppSettings['llm']) {
    this.inner = new OpenAICompatProvider({
      ...cfg,
      baseUrl: cfg.baseUrl ?? 'https://api.openai.com/v1',
    });
  }
  async identifyQuestions(input: Parameters<LLMProvider['identifyQuestions']>[0]) {
    return this.inner.identifyQuestions(input);
  }
}