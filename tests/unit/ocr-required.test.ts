import { describe, it, expect, vi, beforeEach } from 'vitest';
import { identifyQuestions, OcrRequiredError } from '../../src/main/services/identifier.js';
import type { Document } from '../../src/shared/types.js';

const parseFileMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/main/services/parser/index.js', () => ({
  parseFile: parseFileMock,
}));

const getLLMProviderMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/main/services/llm/index.js', () => ({
  getLLMProvider: getLLMProviderMock,
}));

import type { Document as DocType } from '../../src/shared/types.js';

const fakeDoc: DocType = {
  id: 1,
  file_path: '/tmp/scanned.pdf',
  file_type: 'pdf',
  title: 'scanned',
  imported_at: 0,
  question_count: 0,
};

describe('OcrRequiredError', () => {
  beforeEach(() => {
    parseFileMock.mockReset();
  });

  it('当 parser 返回空文本时抛 OcrRequiredError', async () => {
    parseFileMock.mockResolvedValue({ text: '', pageCount: 5 });
    await expect(identifyQuestions(fakeDoc)).rejects.toBeInstanceOf(
      OcrRequiredError,
    );
  });

  it('OcrRequiredError 错误信息提示先整理为 Markdown 或文本', async () => {
    parseFileMock.mockResolvedValue({ text: '   ', pageCount: 1 });
    const err = await identifyQuestions(fakeDoc).catch((e) => e);
    expect(err).toBeInstanceOf(OcrRequiredError);
    expect((err as Error).message).toMatch(/Markdown|文本/);
  });

  it('OcrRequiredError 携带 filePath', async () => {
    parseFileMock.mockResolvedValue({ text: '', pageCount: 1 });
    const err = await identifyQuestions(fakeDoc).catch((e) => e);
    expect((err as OcrRequiredError).filePath).toBe('/tmp/scanned.pdf');
  });

  it('当 parser 返回正常文本时不抛 OcrRequiredError', async () => {
    parseFileMock.mockResolvedValue({ text: '正常内容', pageCount: 1 });
    getLLMProviderMock.mockReturnValue({
      identifyQuestions: async () => [],
    });
    await expect(identifyQuestions(fakeDoc)).resolves.toEqual([]);
  });
});
