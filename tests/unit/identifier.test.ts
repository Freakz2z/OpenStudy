import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron 的 app.getPath 让 db 模块不爆（identifier 不直接用 db，但其他模块可能用到）
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/openstudy-test-' + Math.random().toString(36).slice(2),
  },
}));

// Mock parser — 用 hoisted vi.fn 让 mockResolvedValue 在测试中可用
const parseFileMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/main/services/parser/index.js', () => ({
  parseFile: parseFileMock,
}));

// Mock LLM provider
const identifyMock = vi.hoisted(() => vi.fn());
const identifyMarkdownMock = vi.hoisted(() => vi.fn());
const markdownMode = vi.hoisted(() => ({ enabled: false }));
vi.mock('../../src/main/services/llm/index.js', () => ({
  getLLMProvider: () =>
    markdownMode.enabled
      ? {
          identifyQuestions: identifyMock,
          identifyQuestionMarkdown: identifyMarkdownMock,
        }
      : {
          identifyQuestions: identifyMock,
        },
}));

import {
  identifyQuestions,
  standardizeMarkdownDocument,
} from '../../src/main/services/identifier.js';
import type { Document } from '../../src/shared/types.js';

const fakeDoc: Document = {
  id: 1,
  file_path: '/tmp/fake.txt',
  file_type: 'txt',
  title: 'fake',
  imported_at: 0,
  question_count: 0,
};

describe('identifyQuestions', () => {
  beforeEach(() => {
    parseFileMock.mockReset();
    identifyMock.mockReset();
    identifyMarkdownMock.mockReset();
    markdownMode.enabled = false;
  });

  it('短文档直接调用一次 LLM', async () => {
    parseFileMock.mockResolvedValue({ text: 'short', pageCount: 1 });
    identifyMock.mockResolvedValue([
      { type: 'choice', stem: 'Q1', options: ['A', 'B'], answer: 'A' },
    ]);

    const result = await identifyQuestions(fakeDoc);
    expect(identifyMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('已经是标准 Markdown 时直接本地结构化，不再调用 LLM', async () => {
    const result = await identifyQuestions({
      ...fakeDoc,
      extracted_markdown: `## 单选题

<!-- QUESTION_ID:q1 -->
### 1. 哪个注解用于控制层切片测试？

- A. @SpringBootTest
- B. @WebMvcTest

Type: choice
Answer: B
Explanation: @WebMvcTest 用于控制层切片测试。`,
    });

    expect(parseFileMock).not.toHaveBeenCalled();
    expect(identifyMock).not.toHaveBeenCalled();
    expect(identifyMarkdownMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      source_id: 'q1',
      type: 'choice',
      answer: 'B',
      options: ['@SpringBootTest', '@WebMvcTest'],
    });
  });

  it('会先让 AI 输出标准 Markdown，再由本地结构化成题目', async () => {
    markdownMode.enabled = true;
    parseFileMock.mockResolvedValue({ text: 'Java 复习题', pageCount: 1 });
    identifyMarkdownMock.mockResolvedValue(`
## 单选题

### 1. 哪个注解用于控制层切片测试？
- A. @SpringBootTest
- B. @WebMvcTest
Type: choice
Answer: B
Explanation: @WebMvcTest 用于控制层切片测试。
`);

    const result = await identifyQuestions(fakeDoc);
    expect(identifyMarkdownMock).toHaveBeenCalledTimes(1);
    expect(identifyMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'choice',
      stem: '哪个注解用于控制层切片测试？',
      options: ['@SpringBootTest', '@WebMvcTest'],
      answer: 'B',
    });
  });

  it('可以把源 Markdown 推进成标准 Markdown 快照', async () => {
    markdownMode.enabled = true;
    const markdown = await standardizeMarkdownDocument(
      {
        ...fakeDoc,
        extracted_markdown: '1. 哪个注解用于控制层切片测试？\nA. @SpringBootTest\nB. @WebMvcTest\n答案：B',
      },
      '1. 哪个注解用于控制层切片测试？\nA. @SpringBootTest\nB. @WebMvcTest\n答案：B',
      { standardLang: 'zh' },
    );

    expect(identifyMarkdownMock).not.toHaveBeenCalled();
    expect(markdown).toContain('## 单选题');
    expect(markdown).toContain('Type: choice');
    expect(markdown).toContain('Answer: B');
  });

  it('大文档自动切片并发调用（每个 chunk 一个提示）', async () => {
    const big = Array.from({ length: 80 }, (_, i) => `p${i}-` + 'x'.repeat(98)).join('\n\n');
    parseFileMock.mockResolvedValue({ text: big, pageCount: 1 });
    identifyMock.mockImplementation(async (input: { text?: string }) => [
      {
        type: 'choice' as const,
        stem: `Q from "${(input.text ?? '').slice(0, 20)}"`,
        options: ['A', 'B'],
        answer: 'A',
      },
    ]);

    const t0 = Date.now();
    const result = await identifyQuestions(fakeDoc, {
      chunkThreshold: 6000,
      chunkSize: 2000,
      concurrency: 3,
    });
    const dt = Date.now() - t0;

    expect(identifyMock.mock.calls.length).toBeGreaterThan(2);
    // 至少提示包含「第 X/Y 段」
    for (const call of identifyMock.mock.calls) {
      const input = call[0] as { hint?: string };
      expect(input.hint).toMatch(/块/);
    }
    // 并发不应远慢于串行
    expect(dt).toBeLessThan(identifyMock.mock.calls.length * 100);
    expect(result.length).toBeGreaterThan(0);
  });

  it('格式明确的多题文档优先本地结构化，不再调用 LLM', async () => {
    const dense = Array.from(
      { length: 10 },
      (_, i) => `${i + 1}. 第${i + 1}题题干\nA. 选项甲\nB. 选项乙\n答案：A`,
    ).join('\n');
    parseFileMock.mockResolvedValue({ text: dense, pageCount: 1 });

    const result = await identifyQuestions(fakeDoc);
    expect(result).toHaveLength(10);
    expect(identifyMock).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      type: 'choice',
      stem: '第1题题干',
      answer: 'A',
    });
  });

  it('结构化文档会先本地解析，只有残缺题块才交给 AI 补全', async () => {
    parseFileMock.mockResolvedValue({
      text: `1. 第一题\nA. 甲\nB. 乙\n答案：A\n\n2. 第二题没有显式答案`,
      pageCount: 1,
    });
    identifyMock.mockResolvedValue([
      {
        source_id: 'q2',
        type: 'short' as const,
        stem: '第二题没有显式答案',
        answer: '由 AI 补全的参考答案',
      },
    ]);

    const result = await identifyQuestions(fakeDoc);
    expect(result).toHaveLength(2);
    expect(identifyMock).toHaveBeenCalledTimes(1);
    expect((identifyMock.mock.calls[0][0] as { text: string }).text).toContain('QUESTION_ID:q2');
    expect(result.map((item) => item.stem)).toEqual(['第一题', '第二题没有显式答案']);
    expect(result[1]?.answer).toBe('由 AI 补全的参考答案');
  });

  it('批量识别通过 source_id 与 Markdown 题块精确对应', async () => {
    const dense = Array.from(
      { length: 4 },
      (_, i) => `${i + 1}. 第${i + 1}题题干\nA. 选项甲\nB. 选项乙`,
    ).join('\n');
    parseFileMock.mockResolvedValue({ text: dense, pageCount: 1 });
    identifyMock.mockImplementation(async (input: { text?: string }) => {
      const ids = [...(input.text ?? '').matchAll(/QUESTION_ID:(q\d+)/g)].map((m) => m[1]);
      return ids.reverse().map((source_id) => ({
        source_id,
        type: 'choice' as const,
        stem: `${source_id} 题干`,
        options: ['选项甲', '选项乙'],
        answer: 'A',
      }));
    });

    const result = await identifyQuestions(fakeDoc);
    expect(identifyMock).toHaveBeenCalledTimes(1);
    expect(result.map((q) => q.source_id)).toEqual(['q1', 'q2', 'q3', 'q4']);
  });

  it('Markdown-first 批量识别后仍能保留 QUESTION_ID 对应关系', async () => {
    markdownMode.enabled = true;
    const dense = Array.from(
      { length: 4 },
      (_, i) => `${i + 1}. 第${i + 1}题题干\nA. 选项甲\nB. 选项乙`,
    ).join('\n');
    parseFileMock.mockResolvedValue({ text: dense, pageCount: 1 });
    identifyMarkdownMock.mockImplementation(async (input: { text?: string }) => {
      const ids = [...(input.text ?? '').matchAll(/QUESTION_ID:(q\d+)/g)].map((m) => m[1]);
      return ids
        .map(
          (sourceId, index) => `
## 单选题
<!-- QUESTION_ID:${sourceId} -->
### ${index + 1}. ${sourceId} 题干
- A. 选项甲
- B. 选项乙
Type: choice
Answer: A
`,
        )
        .join('\n');
    });

    const result = await identifyQuestions(fakeDoc);
    expect(identifyMarkdownMock).toHaveBeenCalledTimes(1);
    expect(result.map((q) => q.source_id)).toEqual(['q1', 'q2', 'q3', 'q4']);
  });

  it('101 道题会稳定分批且全部通过 source_id 回收', async () => {
    const dense = Array.from(
      { length: 101 },
      (_, i) => `${i + 1}. 第${i + 1}题\nA. 甲\nB. 乙`,
    ).join('\n');
    parseFileMock.mockResolvedValue({ text: dense, pageCount: 1 });
    identifyMock.mockImplementation(async (input: { text?: string }) =>
      [...(input.text ?? '').matchAll(/QUESTION_ID:(q\d+)/g)].map((match) => ({
        source_id: match[1],
        type: 'choice' as const,
        stem: `${match[1]} 题干`,
        options: ['甲', '乙'],
        answer: 'A',
      })),
    );

    const result = await identifyQuestions(fakeDoc, { concurrency: 4 });
    expect(result).toHaveLength(101);
    expect(new Set(result.map((question) => question.source_id)).size).toBe(101);
    expect(identifyMock).toHaveBeenCalledTimes(26);
  });

  it('完全重复的题目会被去重', async () => {
    parseFileMock.mockResolvedValue({ text: 'x'.repeat(8000), pageCount: 1 });
    identifyMock.mockResolvedValue([
      {
        type: 'fill' as const,
        stem: '同题干：太阳从哪个方向升起？',
        options: null,
        answer: '东',
      },
    ]);

    const result = await identifyQuestions(fakeDoc, {
      chunkThreshold: 6000,
      chunkSize: 2000,
      concurrency: 2,
    });
    expect(result).toHaveLength(1);
  });

  it('非标准选项前缀按顺序重编号为 A/B/C/D，并同步转换 answer', async () => {
    parseFileMock.mockResolvedValue({
      text: '一、选择题\n1. 主流大语言模型多采用什么架构？\nR. RNN\nC. CNN\nT. Transformer\nL. LSTM\n答案：T',
      pageCount: 1,
    });
    // LLM 看到的是已经预归一化为 A/B/C/D 的选项，因此返回标准答案 C。
    identifyMock.mockImplementation(async () => [
      {
        type: 'choice' as const,
        stem: '主流大语言模型多采用什么架构？',
        options: ['A. RNN', 'B. CNN', 'C. Transformer', 'D. LSTM'],
        answer: 'C',
      },
    ]);

    const result = await identifyQuestions(fakeDoc);
    expect(result).toHaveLength(1);
    expect(result[0].options).toEqual(['RNN', 'CNN', 'Transformer', 'LSTM']);
    expect(result[0].answer).toBe('C');
  });

  it('标准 A/B/C/D 选项仅去掉前缀，不重排', async () => {
    parseFileMock.mockResolvedValue({
      text: '一、选择题\n1. 哪个选项正确？\nA. 甲\nB. 乙',
      pageCount: 1,
    });
    identifyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { type: 'choice', stem: '哪个选项正确？', options: ['甲', '乙'], answer: 'A' },
      ]);

    const result = await identifyQuestions(fakeDoc);
    expect(result).toHaveLength(1);
    expect(identifyMock).toHaveBeenCalledTimes(2);
    expect((identifyMock.mock.calls[1][0] as { hint: string }).hint).toContain('最多返回 1 道题');
  });

  it('补全失败时抛完整性错误，不静默返回残缺题库', async () => {
    parseFileMock.mockResolvedValue({
      text: '一、选择题\n1. 缺少答案的题目\nA. 甲\nB. 乙',
      pageCount: 1,
    });
    identifyMock.mockResolvedValue([]);

    await expect(identifyQuestions(fakeDoc)).rejects.toThrow(/题目完整性校验未通过/);
    expect(identifyMock).toHaveBeenCalledTimes(3);
  });

  it('空文本抛 OcrRequiredError', async () => {
    parseFileMock.mockResolvedValue({ text: '', pageCount: 0 });
    await expect(identifyQuestions(fakeDoc)).rejects.toThrow(/Markdown|可识别文本/);
  });

  it('中等文档（>3500 字符）自动切片，单片 <2500 字符', async () => {
    // 模拟 8000 字符的中等文档——超过新阈值 3500，应该被切片
    const big = Array.from({ length: 80 }, (_, i) => `p${i}-` + 'x'.repeat(98)).join('\n\n');
    parseFileMock.mockResolvedValue({ text: big, pageCount: 1 });
    identifyMock.mockImplementation(async (input: { text?: string }) => [
      {
        type: 'choice' as const,
        stem: `Q from "${(input.text ?? '').slice(0, 20)}"`,
        options: ['A', 'B'],
        answer: 'A',
      },
    ]);

    const result = await identifyQuestions(fakeDoc);
    expect(identifyMock.mock.calls.length).toBeGreaterThan(3);
    // 每片长度应该不超过 2500 + overlap
    for (const call of identifyMock.mock.calls) {
      const input = call[0] as { text?: string };
      expect((input.text ?? '').length).toBeLessThanOrEqual(2500 + 200 + 50);
    }
    expect(result.length).toBeGreaterThan(0);
  });

  it('含不完整题（answer=null）时被过滤掉，不抛错', async () => {
    // LLM 在第 7 题中途被 max_tokens 截断
    parseFileMock.mockResolvedValue({ text: 'x'.repeat(4000), pageCount: 1 });
    identifyMock.mockResolvedValue([
      { type: 'choice', stem: 'q1', options: ['A', 'B'], answer: 'A' },
      { type: 'choice', stem: 'q2', options: ['A', 'B'], answer: 'B' },
      { type: 'fill', stem: 'q3', options: null, answer: 'x' },
      // 第 4 题被截断：answer 缺失
      { type: 'choice', stem: 'q4 截断', options: ['A', 'B'], answer: null as unknown as string },
    ]);

    const result = await identifyQuestions(fakeDoc);
    // 3 道完整题保留，1 道被截断的丢弃
    expect(result).toHaveLength(3);
    expect(result.map((q) => q.stem)).toEqual(['q1', 'q2', 'q3']);
  });

  it('onProgress 在每个阶段都触发', async () => {
    parseFileMock.mockResolvedValue({ text: 'short', pageCount: 1 });
    identifyMock.mockResolvedValue([]);

    const phases: string[] = [];
    await identifyQuestions(fakeDoc, {
      onProgress: (p) => phases.push(p.phase),
    });
    // 短文档：parse → llm → done
    expect(phases).toEqual(expect.arrayContaining(['parse', 'llm', 'done']));
  });

  it('大文档进度回调含 current/total', async () => {
    const big = Array.from({ length: 80 }, (_, i) => `p${i}-` + 'x'.repeat(98)).join('\n\n');
    parseFileMock.mockResolvedValue({ text: big, pageCount: 1 });
    identifyMock.mockResolvedValue([
      { type: 'fill' as const, stem: 'q', options: null, answer: 'a' },
    ]);

    const progressCalls: Array<{ phase: string; current?: number; total?: number }> = [];
    await identifyQuestions(fakeDoc, {
      chunkThreshold: 3500,
      chunkSize: 2500,
      concurrency: 3,
      onProgress: (p) =>
        progressCalls.push({ phase: p.phase, current: p.current, total: p.total }),
    });
    // 至少有一次 llm 进度带 current/total
    const llmProgress = progressCalls.filter((p) => p.phase === 'llm');
    expect(llmProgress.length).toBeGreaterThan(0);
    for (const p of llmProgress) {
      expect(p.total).toBeGreaterThan(1);
    }
    // 最后一次进度是 done
    expect(progressCalls[progressCalls.length - 1].phase).toBe('done');
  });
});
