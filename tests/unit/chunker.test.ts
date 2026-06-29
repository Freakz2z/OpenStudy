import { describe, it, expect } from 'vitest';
import { splitText } from '../../src/main/services/chunker.js';

describe('splitText', () => {
  it('空文本返回空数组', () => {
    expect(splitText('')).toEqual([]);
  });

  it('短文本不切片', () => {
    const r = splitText('hello world');
    expect(r).toHaveLength(1);
    expect(r[0].index).toBe(0);
    expect(r[0].text).toBe('hello world');
  });

  it('按段落边界切分，每块不超过 maxChars', () => {
    const text = ['p1 '.repeat(50), 'p2 '.repeat(50), 'p3 '.repeat(50)].join('\n\n');
    const r = splitText(text, { maxChars: 220, overlapChars: 0 });
    expect(r.length).toBeGreaterThanOrEqual(2);
    for (const c of r) {
      expect(c.text.length).toBeLessThanOrEqual(220);
    }
  });

  it('短段落会合并到当前 chunk', () => {
    const text = ['short1', 'short2', 'short3'].join('\n\n');
    const r = splitText(text, { maxChars: 1000 });
    expect(r).toHaveLength(1);
    expect(r[0].text).toBe('short1\n\nshort2\n\nshort3');
  });

  it('过长段落会被 hard-split', () => {
    const long = 'x'.repeat(1000);
    const r = splitText(long, { maxChars: 300, overlapChars: 0 });
    expect(r.length).toBeGreaterThan(3);
    for (const c of r) {
      expect(c.text.length).toBeLessThanOrEqual(300);
    }
  });

  it('相邻 chunk 之间带 overlap（用段落切分验证）', () => {
    const text = Array.from({ length: 10 }, (_, i) => `paragraph-${i} ` + 'lorem '.repeat(8)).join('\n\n');
    const r = splitText(text, { maxChars: 200, overlapChars: 50 });
    expect(r.length).toBeGreaterThan(1);
    for (let i = 1; i < r.length; i++) {
      const overlapTail = r[i - 1].text.slice(-50);
      expect(r[i].text.startsWith(overlapTail)).toBe(true);
    }
  });

  it('chunk index 连续从 0 开始', () => {
    const text = Array.from({ length: 20 }, (_, i) => 'x'.repeat(50)).join('\n\n');
    const r = splitText(text, { maxChars: 200, overlapChars: 0 });
    expect(r.map((c) => c.index)).toEqual(r.map((_, i) => i));
  });

  it('overlap 注入会让 chunk 略大于 maxChars', () => {
    const text = Array.from({ length: 10 }, () => 'y'.repeat(100)).join('\n\n');
    const r = splitText(text, { maxChars: 250, overlapChars: 50 });
    for (const c of r) {
      expect(c.text.length).toBeLessThanOrEqual(250 + 50 + 4);
    }
  });

  it('overlap=0 时 chunk 之间无 overlap', () => {
    const text = Array.from({ length: 10 }, (_, i) => `p-${i}` + ' lorem '.repeat(8)).join('\n\n');
    const r = splitText(text, { maxChars: 100, overlapChars: 0 });
    expect(r.length).toBeGreaterThan(1);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].text.startsWith(r[i - 1].text.slice(-30))).toBe(false);
    }
  });

  it('输入长度 <= maxChars 时原样返回', () => {
    const t = 'a'.repeat(100);
    const r = splitText(t, { maxChars: 200, overlapChars: 50 });
    expect(r).toEqual([{ index: 0, text: t }]);
  });
});