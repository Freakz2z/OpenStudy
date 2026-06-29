import type { LLMInput, LLMProvider } from './index.js';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseAndValidate,
} from './index.js';
import type { ExtractedQuestion } from '../../../shared/types.js';
import type { AppSettings } from '../../../shared/types.js';

export class OllamaProvider implements LLMProvider {
  constructor(private cfg: AppSettings['llm']) {}

  async identifyQuestions(input: LLMInput): Promise<ExtractedQuestion[]> {
    const baseUrl = (this.cfg.baseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
    const model = this.cfg.model;
    const userPrompt = buildUserPrompt(input);
    const images = input.images?.map((i) => i.base64);

    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        format: 'json',
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: userPrompt,
            ...(images ? { images } : {}),
          },
        ],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Ollama 调用失败: ${resp.status} ${t}`);
    }
    const data = (await resp.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? '';
    return parseAndValidate(content);
  }
}
