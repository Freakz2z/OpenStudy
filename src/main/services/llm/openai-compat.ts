import type { LLMInput, LLMProvider } from './index.js';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  parseAndValidate,
} from './index.js';
import type { ExtractedQuestion, AppSettings } from '../../../shared/types.js';

// OpenAI Chat Completions 协议实现。
// openai 和 deepseek 都用这个协议，差别仅在 baseUrl、model、是否需要 apiKey。

export class OpenAICompatProvider implements LLMProvider {
  constructor(private cfg: AppSettings['llm']) {}

  async identifyQuestions(input: LLMInput): Promise<ExtractedQuestion[]> {
    const baseUrl = (this.cfg.baseUrl ?? '').replace(/\/$/, '');
    const model = this.cfg.model;
    const apiKey = this.cfg.apiKey;
    if (!baseUrl) throw new Error('OpenAI 兼容协议需要 baseUrl');
    if (!apiKey) throw new Error('OpenAI 兼容协议需要 apiKey');
    if (!model) throw new Error('未指定模型');

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [];
    userContent.push({ type: 'text', text: buildUserPrompt(input) });
    if (input.images) {
      for (const img of input.images) {
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${img.mime};base64,${img.base64}` },
        });
      }
    }

    // max_tokens 留够，避免 JSON 被截断（DeepSeek 官方建议）
    // 经验值：1 token ≈ 1.5 中文字符，留 8000 tokens ≈ 12k 中文字输出余量
    const maxTokens = 8000;

    // DeepSeek JSON Output 有小概率返回空 content → 自动重试 1 次
    const lastErr = await callWithRetry(() =>
      callOnce(baseUrl, model, apiKey, maxTokens, userContent),
    );

    return parseAndValidate(lastErr);
  }
}

async function callOnce(
  baseUrl: string,
  model: string,
  apiKey: string,
  maxTokens: number,
  userContent: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >,
): Promise<string> {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`LLM 调用失败: ${resp.status} ${t}`);
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error('EMPTY_CONTENT');
  }
  return content;
}

// 最多重试 2 次（首次 + 1 次重试），仅对空 content 触发，其他错误直接抛
async function callWithRetry(
  fn: () => Promise<string>,
  maxAttempts = 2,
): Promise<string> {
  let lastErr: Error | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e as Error;
      if ((e as Error).message !== 'EMPTY_CONTENT') throw e;
      // 空 content → 等待 500ms 后重试
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr ?? new Error('EMPTY_CONTENT');
}