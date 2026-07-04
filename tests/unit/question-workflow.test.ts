import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocumentMock = vi.hoisted(() => vi.fn());
const setExtractedMarkdownMock = vi.hoisted(() => vi.fn());
const setStandardMarkdownMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/main/services/db.js', () => ({
  deleteQuestionsByDocument: vi.fn(),
  getDocument: getDocumentMock,
  insertQuestions: vi.fn(),
  listQuestionsByDocument: vi.fn(() => []),
  setExtractedMarkdown: setExtractedMarkdownMock,
  setStandardMarkdown: setStandardMarkdownMock,
}));

vi.mock('../../src/main/services/parser/index.js', () => ({
  parseFile: vi.fn(),
}));

vi.mock('../../src/main/services/identifier.js', () => ({
  extractQuestionsFromStandardMarkdown: vi.fn(() => []),
  standardizeMarkdownDocument: vi.fn(),
}));

vi.mock('../../src/main/services/markdown-workflow.js', () => ({
  parsedDocToMarkdown: vi.fn(),
}));

vi.mock('../../src/main/services/identify-audit.js', () => ({
  appendIdentifyLog: vi.fn(),
  clearIdentifyLogs: vi.fn(),
  createIdentifyLogEntry: vi.fn(),
  deleteIdentifyLog: vi.fn(),
  listIdentifyLogs: vi.fn(),
}));

import {
  getDocumentMarkdownById,
  saveDocumentMarkdownById,
} from '../../src/main/services/question-workflow.js';

describe('question workflow', () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
    setExtractedMarkdownMock.mockReset();
    setStandardMarkdownMock.mockReset();
  });

  it('优先返回已保存的标准 Markdown', async () => {
    getDocumentMock.mockReturnValue({
      id: 7,
      file_path: '/tmp/demo.md',
      file_type: 'md',
      title: 'demo',
      imported_at: 0,
      question_count: 1,
      extracted_markdown: 'raw markdown',
      standard_markdown: '## 单选题\n\n### 1. 标准题目',
    });

    const result = await getDocumentMarkdownById(7, 'zh');
    expect(result).toEqual({
      markdown: '## 单选题\n\n### 1. 标准题目',
      source: 'db',
    });
  });

  it('保存编辑内容时同步刷新标准 Markdown 快照', () => {
    const markdown = `## 单选题

### 1. 哪个注解用于控制层切片测试？
A. @SpringBootTest
B. @WebMvcTest
答案：B`;

    const result = saveDocumentMarkdownById(9, markdown);

    expect(result).toEqual({ ok: true });
    expect(setExtractedMarkdownMock).toHaveBeenCalledWith(9, markdown);
    expect(setStandardMarkdownMock).toHaveBeenCalledTimes(1);
    expect(setStandardMarkdownMock.mock.calls[0]?.[0]).toBe(9);
    expect(setStandardMarkdownMock.mock.calls[0]?.[1]).toContain('## 单选题');
    expect(setStandardMarkdownMock.mock.calls[0]?.[1]).toContain('### 1. 哪个注解用于控制层切片测试？');
    expect(setStandardMarkdownMock.mock.calls[0]?.[1]).toContain('Answer: B');
  });
});
