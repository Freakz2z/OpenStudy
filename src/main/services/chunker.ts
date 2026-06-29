// 文档文本切片：按段落边界切，每块不超过 maxChars。
// 切片时不破坏段落（短段落会并入当前 chunk；过长段落会被 hard-split）。
// 最后在相邻 chunks 之间注入 overlap。

export interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

export interface TextChunk {
  index: number;
  text: string;
}

export function splitText(text: string, opts: ChunkOptions = {}): TextChunk[] {
  const max = opts.maxChars ?? 4000;
  const overlap = Math.min(opts.overlapChars ?? 200, Math.floor(max / 4));
  // 边界保护：max 必须为正数；空文本返回空数组
  if (!text) return [];
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error(`splitText: maxChars 必须为正数，收到 ${max}`);
  }
  if (text.length <= max) {
    return [{ index: 0, text }];
  }

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const raw: string[] = [];
  let cur = '';
  for (const p of paragraphs) {
    if (p.length > max) {
      if (cur) {
        raw.push(cur);
        cur = '';
      }
      for (let i = 0; i < p.length; i += max) {
        raw.push(p.slice(i, Math.min(p.length, i + max)));
      }
      continue;
    }
    if (cur.length === 0) {
      cur = p;
    } else if (cur.length + 2 + p.length <= max) {
      cur += '\n\n' + p;
    } else {
      raw.push(cur);
      cur = p;
    }
  }
  if (cur) raw.push(cur);

  // overlap 在 chunks 列表上注入
  const chunks = applyOverlap(raw, overlap);
  return chunks.map((c, i) => ({ index: i, text: c }));
}

function applyOverlap(parts: string[], overlap: number): string[] {
  if (overlap <= 0 || parts.length <= 1) return parts;
  const out = [parts[0]];
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1];
    const tail = prev.length > overlap ? prev.slice(prev.length - overlap) : prev;
    out.push(tail + '\n\n' + parts[i]);
  }
  return out;
}