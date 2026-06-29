import type { FileType } from '../../../shared/types.js';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseText } from './text.js';
import { parsePdf } from './pdf.js';
import { parseDocx } from './docx.js';
import { parsePptx } from './pptx.js';

export interface ParsedDoc {
  text: string;
  pageCount?: number;
  images?: Array<{ base64: string; mime: string; page: number }>;
}

// 单个文档解析的最大字节数（10MB）。
// 超过此大小直接报错，避免 readFile OOM / LLM context 超限。
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor(
    public filePath: string,
    public size: number,
    public max: number,
  ) {
    super(
      `文件过大：${basename(filePath)} 为 ${formatBytes(size)}，` +
        `超过 ${formatBytes(max)} 上限。请拆分文档或减少内容。`,
    );
    this.name = 'FileTooLargeError';
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function assertSizeOk(filePath: string, fileType: FileType): Promise<void> {
  const st = await stat(filePath);
  if (st.size > MAX_FILE_BYTES) {
    throw new FileTooLargeError(filePath, st.size, MAX_FILE_BYTES);
  }
}

export async function parseFile(
  filePath: string,
  fileType: FileType,
): Promise<ParsedDoc> {
  await assertSizeOk(filePath, fileType);
  try {
    switch (fileType) {
      case 'txt':
      case 'md':
        return { text: cleanText(await parseText(filePath)) };
      case 'pdf': {
        const r = await parsePdf(filePath);
        return { text: cleanText(r.text), pageCount: r.pageCount };
      }
      case 'docx':
        return { text: cleanText(await parseDocx(filePath)) };
      case 'pptx':
        return { text: cleanText(await parsePptx(filePath)) };
    }
  } catch (e) {
    if (e instanceof FileTooLargeError) throw e;
    const fname = basename(filePath);
    const msg = (e as Error).message;
    throw new Error(`解析 ${fname} (${fileType}) 失败：${msg}`);
  }
}

// 零宽字符集（U+200B 到 U+206F 中常见的）
const ZERO_WIDTH = [
  '​', '‌', '‍', '‎', '‏', '‪', '‬', '‫', '‬', '‭', '‮', '﻿',
  ' ', ' ', '⁠', '⁡', '⁢', '⁣', '⁤', '⁥', '⁦', '⁧', '⁨', '⁩',
  '⁪', '⁫', '⁬', '⁭', '⁮', '⁯',
].join('');

// 清洗提取出的文本：去除控制字符、零宽字符、连续空白。
// LLM 对这些字符处理能力差，会污染 JSON 输出。
export function cleanText(raw: string): string {
  return raw
    // 去除 PDF/二进制中常见的控制字符（保留 \t \n \r）
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ')
    // 去除零宽字符
    .replace(new RegExp(`[${ZERO_WIDTH}]`, 'g'), '')
    // 合并连续普通空格（保留 tab，因为它是有意义的分隔符）
    .replace(/ {2,}/g, ' ')
    // 合并连续空行（保留最多 2 个换行）
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}