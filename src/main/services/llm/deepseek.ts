import type { LLMProvider } from './index.js';
import type { AppSettings } from '../../../shared/types.js';
import { OpenAICompatProvider } from './openai-compat.js';

// DeepSeek：使用 OpenAI 兼容协议（baseUrl = https://api.deepseek.com）
// response_format: json_object 官方支持，但有概率返回空 content，本 provider 已内置重试。
// 默认模型 deepseek-v4-flash（deepseek-chat 已于 2026/07/24 弃用）。
export class DeepSeekProvider implements LLMProvider {
  private inner: OpenAICompatProvider;
  constructor(cfg: AppSettings['llm']) {
    this.inner = new OpenAICompatProvider({
      ...cfg,
      baseUrl: cfg.baseUrl ?? 'https://api.deepseek.com',
      model: cfg.model || 'deepseek-v4-flash',
    });
  }
  async identifyQuestions(input: Parameters<LLMProvider['identifyQuestions']>[0]) {
    return this.inner.identifyQuestions(input);
  }

  async identifyQuestionMarkdown(
    input: Parameters<NonNullable<LLMProvider['identifyQuestionMarkdown']>>[0],
  ) {
    return this.inner.identifyQuestionMarkdown(input);
  }
}
