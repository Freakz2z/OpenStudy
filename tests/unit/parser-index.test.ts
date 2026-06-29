import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseFile,
  cleanText,
  MAX_FILE_BYTES,
} from '../../src/main/services/parser/index.js';

describe('parseFile 总入口', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'openstudy-parser-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('解析 txt 文件并清洗文本', async () => {
    const p = join(dir, 'a.txt');
    // 含零宽字符和控制字符
    await writeFile(
      p,
      '正常文本​混入零宽字符\x0c混入换页符\n\n\n连续空行',
      'utf-8',
    );
    const r = await parseFile(p, 'txt');
    // 零宽字符被移除；\x0c 被替换为单个空格；连续空行合并为 2 个换行
    expect(r.text).toBe('正常文本混入零宽字符 混入换页符\n\n连续空行');
  });

  it('解析 md 文件', async () => {
    const p = join(dir, 'a.md');
    await writeFile(p, '# 标题\n\n正文', 'utf-8');
    const r = await parseFile(p, 'md');
    expect(r.text).toContain('正文');
  });

  it('抛错时包含文件名', async () => {
    const p = join(dir, 'broken.docx');
    await writeFile(p, 'not a real docx');
    await expect(parseFile(p, 'docx')).rejects.toThrow(/解析 broken\.docx/);
  });

  it('超过 MAX_FILE_BYTES 抛 FileTooLargeError', async () => {
    const p = join(dir, 'huge.txt');
    // 写一个 11MB 的文件（超过 10MB 上限）
    const big = 'x'.repeat(11 * 1024 * 1024);
    await writeFile(p, big);
    await expect(parseFile(p, 'txt')).rejects.toThrow(/文件过大/);
    await expect(parseFile(p, 'txt')).rejects.toThrow(/11\.0 MB/);
  });

  it('未超限的文件正常解析', async () => {
    const p = join(dir, 'normal.txt');
    await writeFile(p, 'x'.repeat(1024), 'utf-8');
    const r = await parseFile(p, 'txt');
    expect(r.text.length).toBe(1024);
  });

  it('空 txt 返回空 text', async () => {
    const p = join(dir, 'empty.txt');
    await writeFile(p, '', 'utf-8');
    const r = await parseFile(p, 'txt');
    expect(r.text).toBe('');
  });
});

describe('cleanText', () => {
  it('去除控制字符（保留 \\t \\n \\r）', () => {
    const r = cleanText('a\x00b\x0cc\td\ne\nf\rg');
    expect(r).toBe('a b c\td\ne\nf\rg');
  });

  it('去除零宽字符', () => {
    const r = cleanText('a​b‎c‏d');
    expect(r).toBe('abcd');
  });

  it('合并连续普通空格为单个（保留 tab）', () => {
    expect(cleanText('a    b\t\tc')).toBe('a b\t\tc');
  });

  it('合并连续空行（保留最多 2 个换行）', () => {
    expect(cleanText('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('首尾空白去除', () => {
    expect(cleanText('  \n\n  hello  \n\n  ')).toBe('hello');
  });

  it('空字符串', () => {
    expect(cleanText('')).toBe('');
  });

  it('只含控制字符的字符串清洗后为空', () => {
    expect(cleanText('\x00\x0c\x0e')).toBe('');
  });
});

describe('MAX_FILE_BYTES 边界', () => {
  it('默认 10MB', () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });
});