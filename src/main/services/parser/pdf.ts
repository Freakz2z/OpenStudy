// pdfjs-dist 入口：使用 Node 友好的 legacy build
import { readFile } from 'node:fs/promises';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

function textOf(item: unknown): string {
  return typeof item === 'object' && item !== null && 'str' in item
    ? ((item as PdfTextItem).str ?? '')
    : '';
}

function toPositionedItem(item: unknown): {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as PdfTextItem;
  const text = (raw.str ?? '').trim();
  const transform = Array.isArray(raw.transform) ? raw.transform : [];
  if (!text || transform.length < 6) return null;
  return {
    text,
    x: Number(transform[4] ?? 0),
    y: Number(transform[5] ?? 0),
    width: Number(raw.width ?? 0),
    height: Math.abs(Number(raw.height ?? transform[0] ?? 0)) || 12,
  };
}

export function reconstructPdfText(items: unknown[]): string {
  const positioned = items
    .map(toPositionedItem)
    .filter(
      (
        item,
      ): item is {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      } => Boolean(item),
    )
    .sort((a, b) => {
      const dy = Math.abs(b.y - a.y);
      if (dy > 3) return b.y - a.y;
      return a.x - b.x;
    });

  if (positioned.length === 0) return '';

  const lines: Array<{
    y: number;
    height: number;
    items: Array<{
      text: string;
      x: number;
      width: number;
    }>;
  }> = [];

  for (const item of positioned) {
    const line = lines.find(
      (entry) => Math.abs(entry.y - item.y) <= Math.max(3, Math.min(entry.height, item.height) * 0.6),
    );
    if (line) {
      line.items.push({ text: item.text, x: item.x, width: item.width });
      line.y = (line.y + item.y) / 2;
      line.height = Math.max(line.height, item.height);
    } else {
      lines.push({
        y: item.y,
        height: item.height,
        items: [{ text: item.text, x: item.x, width: item.width }],
      });
    }
  }

  lines.sort((a, b) => b.y - a.y);

  const out: string[] = [];
  let prevY: number | null = null;
  let prevHeight = 0;

  for (const line of lines) {
    const sortedItems = line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let prevRight: number | null = null;
    let prevText = '';

    for (const item of sortedItems) {
      const gap = prevRight == null ? 0 : item.x - prevRight;
      const needSpace =
        prevRight != null &&
        gap > Math.max(4, Math.min(14, Math.max(item.width, prevText.length * 4) * 0.18)) &&
        !/^[,.;:!?，。；：！？、)\]）]/.test(item.text) &&
        !/[(/（]$/.test(prevText);
      text += `${needSpace ? ' ' : ''}${item.text}`;
      prevRight = item.x + item.width;
      prevText = item.text;
    }

    if (prevY != null) {
      const gapY = prevY - line.y;
      out.push(
        gapY > Math.max(prevHeight, line.height) * 2.4
          ? '\n\n'
          : '\n',
      );
    }
    out.push(text.trim());
    prevY = line.y;
    prevHeight = line.height;
  }

  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export async function parsePdf(filePath: string): Promise<{
  text: string;
  pageCount: number;
}> {
  const data = await readFile(filePath);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
  const doc = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = reconstructPdfText(content.items) || content.items.map(textOf).join(' ');
    // 保留稳定页标记，方便题目跨页拼接后仍能回溯来源；标记不会发送为题干。
    parts.push(`[[PDF PAGE ${i}]]\n${pageText}`);
  }
  return { text: parts.join('\n\n'), pageCount: doc.numPages };
}

// 检测 PDF 是否为扫描版（无文本层）。
// 启发式：如果平均每页文本字符数 < 30，则认为是扫描版。
export async function isScannedPdf(
  filePath: string,
  opts: { samplePages?: number; threshold?: number } = {},
): Promise<{ scanned: boolean; avgCharsPerPage: number; pageCount: number }> {
  const samplePages = opts.samplePages ?? 3;
  const threshold = opts.threshold ?? 30;
  const data = await readFile(filePath);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const limit = Math.min(pageCount, samplePages);
  let totalChars = 0;
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(textOf).join(' ');
    totalChars += text.trim().length;
  }
  const avgCharsPerPage = limit > 0 ? totalChars / limit : 0;
  return {
    scanned: avgCharsPerPage < threshold,
    avgCharsPerPage,
    pageCount,
  };
}

// 注：视觉路径（OCR 渲染 PDF 为图片）在 Phase B 接入，
// 需要 canvas 包（macOS 上需要系统库），此处先不引入避免破坏构建。
