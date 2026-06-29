import { describe, it, expect } from 'vitest';
import {
  normalizeChoiceAnswer,
  normalizeChoiceOptions,
} from '@shared/question-format';

// 多选内容反查：把"决策树,DBSCAN"按分隔符拆成多个答案，分别反查，排序
function resolveAnswerByContent(
  answer: string,
  options: readonly string[] | null | undefined,
): string {
  const trimmed = (answer ?? '').trim();
  if (!trimmed || !options || options.length === 0) return trimmed;
  if (/^[A-Ha-h]+$/.test(trimmed)) return trimmed;

  // 拆分多选（顿号、逗号、句号、分号、空格）
  const segments = trimmed.split(/[、，,。;；\s]+/).filter(Boolean);
  const letters: string[] = [];
  for (const seg of segments) {
    const stripped = seg.replace(/^\s*[A-Ha-h][\.、:：)\]）]\s*/, '').trim();
    if (!stripped) {
      // 已经是字母
      const m = seg.match(/^([A-Ha-h])$/);
      if (m && m[1]) letters.push(m[1].toUpperCase());
      continue;
    }
    let found = false;
    for (let i = 0; i < options.length; i++) {
      const opt = (options[i] ?? '').trim();
      const optStripped = opt.replace(/^\s*[A-Ha-h][\.、:：)\]）]\s*/, '').trim();
      if (optStripped.toLowerCase() === stripped.toLowerCase()) {
        letters.push(String.fromCharCode(65 + i));
        found = true;
        break;
      }
    }
    if (!found) {
      // 反查失败：保留原 segment
      letters.push(seg);
    }
  }
  if (letters.length === 0) return trimmed;
  // 排序去重
  return [...new Set(letters.map((l) => l.toUpperCase()))].sort().join('');
}

function simulatePipeline(
  rawAnswer: string,
  rawOptions: string[],
): { normalized: string } {
  const opts = normalizeChoiceOptions(rawOptions) ?? [];
  const normAns = normalizeChoiceAnswer(rawAnswer, opts);
  return { normalized: resolveAnswerByContent(normAns, opts) };
}

describe('answer resolution pipeline', () => {
  it('LLM 输出 "RNN" → 自动反查为 A', () => {
    const r = simulatePipeline('RNN', ['A. RNN', 'B. CNN', 'C. Transformer']);
    expect(r.normalized).toBe('A');
  });

  it('LLM 输出 "Transformer" → 自动反查为 C', () => {
    const r = simulatePipeline('Transformer', ['A. RNN', 'B. CNN', 'C. Transformer']);
    expect(r.normalized).toBe('C');
  });

  it('LLM 输出 "A. RNN" → 去掉前缀反查为 A', () => {
    const r = simulatePipeline('A. RNN', ['A. RNN', 'B. CNN', 'C. Transformer']);
    expect(r.normalized).toBe('A');
  });

  it('LLM 输出纯字母 "B" → 不需要反查', () => {
    const r = simulatePipeline('B', ['A. RNN', 'B. CNN', 'C. Transformer']);
    expect(r.normalized).toBe('B');
  });

  it('多选内容 "决策树,DBSCAN" → 排序为 BD', () => {
    const r = simulatePipeline('决策树,DBSCAN', [
      'A. K-Means', 'B. 决策树', 'C. PCA', 'D. DBSCAN',
    ]);
    expect(r.normalized).toBe('BD');
  });

  it('多选内容 "决策树, DBSCAN" (带空格) → BD', () => {
    const r = simulatePipeline('决策树、 DBSCAN', [
      'A. K-Means', 'B. 决策树', 'C. PCA', 'D. DBSCAN',
    ]);
    expect(r.normalized).toBe('BD');
  });

  it('判断题 "正确" → A', () => {
    const r = simulatePipeline('正确', ['A. 正确', 'B. 错误']);
    expect(r.normalized).toBe('A');
  });

  it('判断题 "错误" → B', () => {
    const r = simulatePipeline('错误', ['A. 正确', 'B. 错误']);
    expect(r.normalized).toBe('B');
  });

  it('找不到匹配 → 保留原值', () => {
    const r = simulatePipeline('未知答案', ['A. RNN', 'B. CNN']);
    expect(r.normalized).toBe('未知答案');
  });
});
