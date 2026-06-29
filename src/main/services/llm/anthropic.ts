import type { LLMInput, LLMProvider } from './index.js';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseAndValidate,
} from './index.js';
import type { ExtractedQuestion } from '../../../shared/types.js';
import type { AppSettings } from '../../../shared/types.js';

export class AnthropicProvider implements LLMProvider {
  constructor(private cfg: AppSettings['llm']) {}

  async identifyQuestions(input: LLMInput): Promise<ExtractedQuestion[]> {
    const apiKey = this.cfg.apiKey;
    if (!apiKey) throw new Error('Anthropic 需要 apiKey');
    const model = this.cfg.model;
    const baseUrl = (this.cfg.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '');

    const contentArr: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
    > = [{ type: 'text', text: buildUserPrompt(input) }];
    if (input.images) {
      for (const img of input.images) {
        contentArr.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mime as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: img.base64,
          },
        });
      }
    }

    const resp = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentArr }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Anthropic 调用失败: ${resp.status} ${t}`);
    }
    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');
    return parseAndValidate(text);
  }
}
