import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OllamaProvider } from '../../src/main/services/llm/ollama.js';
import { OpenAIProvider } from '../../src/main/services/llm/openai.js';
import { AnthropicProvider } from '../../src/main/services/llm/anthropic.js';
import { DeepSeekProvider } from '../../src/main/services/llm/deepseek.js';
import type { AppSettings } from '../../src/shared/types.js';

const origFetch = globalThis.fetch;

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('OpenAIProvider', () => {
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('sends chat completion with json_object format', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = vi.fn(async (url, init) => {
      captured = { url: url as string, init: init as RequestInit };
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ questions: [] }) } }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new OpenAIProvider({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    });
    await p.identifyQuestions({ text: 'hello', hint: '测试' });

    expect(captured).not.toBeNull();
    expect(captured!.url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(captured!.init.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('题目提取器');
    const userMsg = body.messages[1].content as Array<{ type: string; text?: string }>;
    expect(userMsg[0].type).toBe('text');
    expect(userMsg[0].text).toContain('hello');
    expect(userMsg[0].text).toContain('测试');
  });

  it('throws when apiKey missing', async () => {
    const p = new OpenAIProvider({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    } as AppSettings['llm']);
    await expect(p.identifyQuestions({ text: 'x' })).rejects.toThrow(/apiKey/);
  });

  it('surfaces non-2xx with status and body', async () => {
    globalThis.fetch = mockFetchResponse({ error: 'rate limited' }, 429);
    const p = new OpenAIProvider({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    });
    await expect(p.identifyQuestions({ text: 'x' })).rejects.toThrow(/429/);
  });

  it('parses well-formed JSON response', async () => {
    globalThis.fetch = mockFetchResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              questions: [
                {
                  type: 'choice',
                  stem: '1+1=?',
                  options: ['1', '2'],
                  answer: 'B',
                },
              ],
            }),
          },
        },
      ],
    });
    const p = new OpenAIProvider({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    });
    const r = await p.identifyQuestions({ text: 'x' });
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('choice');
    expect(r[0].answer).toBe('B');
  });
});

describe('OllamaProvider', () => {
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('sends to /api/chat with format=json', async () => {
    let captured: { url: string; body: any } | null = null;
    globalThis.fetch = vi.fn(async (url, init) => {
      captured = { url: url as string, body: JSON.parse(init!.body as string) };
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ message: { content: JSON.stringify({ questions: [] }) } }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new OllamaProvider({
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5',
    });
    await p.identifyQuestions({ text: 'x' });
    expect(captured!.url).toBe('http://127.0.0.1:11434/api/chat');
    expect(captured!.body.format).toBe('json');
    expect(captured!.body.model).toBe('qwen2.5');
  });

  it('passes images when provided', async () => {
    let captured: { body: any } | null = null;
    globalThis.fetch = vi.fn(async (_url, init) => {
      captured = { body: JSON.parse(init!.body as string) };
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ message: { content: '{"questions":[]}' } }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new OllamaProvider({
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5',
    });
    await p.identifyQuestions({
      images: [{ base64: 'AAAA', mime: 'image/png', page: 1 }],
    });
    expect(captured!.body.messages[1].images).toEqual(['AAAA']);
  });
});

describe('AnthropicProvider', () => {
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('sends to /v1/messages with x-api-key header', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = vi.fn(async (url, init) => {
      captured = { url: url as string, init: init as RequestInit };
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ content: [{ type: 'text', text: '{"questions":[]}' }] }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new AnthropicProvider({
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5',
    });
    await p.identifyQuestions({ text: 'x' });
    expect(captured!.url).toBe('https://api.anthropic.com/v1/messages');
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(captured!.init.body as string);
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toContain('题目提取器');
  });

  it('throws when apiKey missing', async () => {
    const p = new AnthropicProvider({
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-haiku-4-5',
    } as AppSettings['llm']);
    await expect(p.identifyQuestions({ text: 'x' })).rejects.toThrow(/apiKey/);
  });
});

describe('parseAndValidate 容错', () => {
  it('accepts pure JSON', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    const r = parseAndValidate(JSON.stringify({ questions: [{ type: 'fill', stem: 'a', answer: 'b' }] }));
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('fill');
  });

  it('strips markdown json fences', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    const raw = '```json\n{"questions":[{"type":"short","stem":"a","answer":"b"}]}\n```';
    const r = parseAndValidate(raw);
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe('short');
  });

  it('extracts JSON from surrounding prose', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    const raw = '好的，提取结果如下：\n{"questions":[]}\n请查收。';
    const r = parseAndValidate(raw);
    expect(r).toEqual([]);
  });

  it('normalizes type 字段 (multiple choice/选择题/MC 都映射到 choice)', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    const r = parseAndValidate(
      JSON.stringify({
        questions: [
          { type: 'multiple choice', stem: 'a', answer: 'A' },
          { type: '选择题', stem: 'b', answer: 'B' },
          { type: 'MC', stem: 'c', answer: 'C' },
          { type: 'fill', stem: 'd', answer: 'x' },
          { type: '填空题', stem: 'e', answer: 'y' },
        ],
      }),
    );
    expect(r.map((q) => q.type)).toEqual(['multiple', 'choice', 'choice', 'fill', 'fill']);
  });

  it('normalizes options 字段 (字符串换行形式 → 数组)', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    const r = parseAndValidate(
      JSON.stringify({
        questions: [
          {
            type: 'choice',
            stem: 'q',
            options: 'A. foo\nB. bar\nC. baz',
            answer: 'A',
          },
        ],
      }),
    );
    expect(r[0].options).toEqual(['foo', 'bar', 'baz']);
  });

  it('throws with rich error info on total garbage', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    expect(() => parseAndValidate('not json at all')).toThrow(/原始返回/);
  });

  it('falls back to JSON5 when standard JSON fails', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    // JSON5: key 无引号、尾随逗号
    const r = parseAndValidate('{questions:[{type:"fill",stem:"a",answer:"b",},]}');
    expect(r).toHaveLength(1);
  });

  it('从被截断的 JSON 修复出完整 questions', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    // 模拟流式响应在第二个 question 中间被截断
    const truncated = JSON.stringify({
      questions: [
        { type: 'choice', stem: 'q1', options: ['a', 'b'], answer: 'A' },
        { type: 'fill', stem: 'q2' },
      ],
    }).slice(0, -2); // 砍掉最后的 "}]
    const r = parseAndValidate(truncated);
    // 至少前一个完整的题目能恢复
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r.some((q) => q.stem === 'q1')).toBe(true);
  });

  it('从包含不合法元素的 questions 中抢救合法子集', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    // 第一个对象缺 stem 字段非法；第二个完整合法
    const r = parseAndValidate(
      JSON.stringify({
        questions: [
          { type: 'choice', answer: 'A' }, // 缺 stem
          { type: 'fill', stem: 'good', answer: 'ok' },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].stem).toBe('good');
  });

  it('answer=null 的不完整题目被过滤掉，不抛错', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    // 模拟 LLM 输出被 max_tokens 截断：第 3 题 answer 是 null
    const r = parseAndValidate(
      JSON.stringify({
        questions: [
          { type: 'choice', stem: 'q1', options: ['A', 'B'], answer: 'A' },
          { type: 'fill', stem: 'q2', options: null, answer: 'x' },
          { type: 'choice', stem: 'q3 截断', options: ['A', 'B'], answer: null },
        ],
      }),
    );
    expect(r).toHaveLength(2);
    expect(r.map((q) => q.stem)).toEqual(['q1', 'q2']);
  });

  it('stem=null 的不完整题目被过滤掉', async () => {
    const { parseAndValidate } = await import('../../src/main/services/llm/index.js');
    const r = parseAndValidate(
      JSON.stringify({
        questions: [
          { type: 'choice', stem: '', answer: 'A' }, // 空 stem
          { type: 'fill', stem: 'good', answer: 'ok' },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].stem).toBe('good');
  });
});

describe('DeepSeekProvider', () => {
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it('使用 deepseek 默认 baseUrl / model', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = vi.fn(async (url, init) => {
      captured = { url: url as string, init: init as RequestInit };
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ questions: [] }) } }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new DeepSeekProvider({ provider: 'deepseek', apiKey: 'sk-ds', model: '' });
    await p.identifyQuestions({ text: 'x' });
    expect(captured!.url).toBe('https://api.deepseek.com/chat/completions');
    const body = JSON.parse(captured!.init.body as string);
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_tokens).toBeGreaterThanOrEqual(4000);
  });

  it('自定义 baseUrl / model 时透传', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    globalThis.fetch = vi.fn(async (url, init) => {
      captured = { url: url as string, init: init as RequestInit };
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          choices: [{ message: { content: '{"questions":[]}' } }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new DeepSeekProvider({
      provider: 'deepseek',
      apiKey: 'sk-ds',
      baseUrl: 'https://custom.example.com/v1/',
      model: 'deepseek-coder',
    });
    await p.identifyQuestions({ text: 'x' });
    expect(captured!.url).toBe('https://custom.example.com/v1/chat/completions');
    const body = JSON.parse(captured!.init.body as string);
    expect(body.model).toBe('deepseek-coder');
  });

  it('缺 apiKey 时抛错', async () => {
    const p = new DeepSeekProvider({
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
    } as AppSettings['llm']);
    await expect(p.identifyQuestions({ text: 'x' })).rejects.toThrow(/apiKey/);
  });

  it('空 content 自动重试：首次空、第二次有内容 → 成功', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => ({ choices: [{ message: { content: null } }] }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [{ type: 'fill', stem: 'q', answer: 'a' }],
                }),
              },
            },
          ],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new DeepSeekProvider({
      provider: 'deepseek',
      apiKey: 'sk-ds',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
    });
    const r = await p.identifyQuestions({ text: 'x' });
    expect(r).toHaveLength(1);
    expect(calls).toBe(2);
  });

  it('空 content 重试 2 次仍空 → 抛错', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ choices: [{ message: { content: '' } }] }),
      } as Response;
    }) as unknown as typeof fetch;

    const p = new DeepSeekProvider({
      provider: 'deepseek',
      apiKey: 'sk-ds',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
    });
    await expect(p.identifyQuestions({ text: 'x' })).rejects.toThrow(/EMPTY_CONTENT|为空|content/i);
    expect(calls).toBe(2);
  });
});
