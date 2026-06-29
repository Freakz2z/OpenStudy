/**
 * ParsedExam (Markdown 解析结果) → ExtractedQuestion[] (入库格式)
 *
 * 字段映射:
 *   - code 题 → type=code, options=[A,B,C,D] 文本化, answer=选项字母
 *   - judge → type=judge, answer=true/false
 *   - fill  → type=fill, answer=填空内容
 *   - short → type=short
 *   - choice / multiple → type=choice/multiple
 */

import type { ExtractedQuestion, QuestionType } from './types.js';
import type { ParsedExam, ParsedQuestion, ParsedSection } from './exam-parser.js';

const PAGE_RE = /^第\s*(\d+|[一二三四五六七八九十百千万0-9]+)\s*[页章节]/;
const SUBQ_RE = /^问题\s*(\d+)\s*[:：.、\s]*(.*)$/;

function normalizeAnswer(q: ParsedQuestion): string {
  if (q.type === 'judge') {
    return q.answer.toLowerCase().trim();
  }
  return q.answer.trim();
}

function parseCodeAnswer(answer: string, options: { letter: string }[]): string {
  if (!answer) return '';
  // 已经是字母
  if (/^[A-Za-z]$/.test(answer.trim())) return answer.trim().toUpperCase();
  // 可能是 "A、C"（多选）
  return answer.trim();
}

function extractCodeAnswer(q: ParsedQuestion, options: { letter: string }[]): string {
  return parseCodeAnswer(q.answer, options);
}

function sectionToPage(sectionIndex: number, sectionNumber: string): string {
  // 大题序号映射到模拟"页码"
  return `第 ${sectionNumber} 部分`;
}

function buildQuestionFromParsed(
  q: ParsedQuestion,
  sectionNumber: string,
  qid: number,
): ExtractedQuestion {
  const page = sectionToPage(0, sectionNumber);
  const type: QuestionType =
    q.type === 'code' ? 'code' : (q.type as QuestionType);

  // 提取 options 为数组（首字母 + 正文）
  const opts = q.options ?? [];

  let answer = normalizeAnswer(q);
  if (q.type === 'code') {
    answer = extractCodeAnswer(q, opts);
  }

  // 类型归一：code 在 DB 仍存为 choice 类型（含 codeBlock 标记），通过 position 后缀区分
  // 但因为现有 schema type 字段只能是 'choice'|'multiple'|'judge'|'fill'|'short'，
  // 我们把 code 暂时映射为 choice，并在 stem 顶部加代码块标记
  let finalType: QuestionType = type;
  let stem = q.stem;
  if (q.type === 'code') {
    finalType = 'choice';
    // 代码题把代码块拼到 stem 顶部以便渲染时识别
    if (q.codeBlock) {
      stem = `${q.codeBlock}\n\n${q.stem}`.trim();
    }
  }

  return {
    source_id: `q${qid}`,
    type: finalType,
    stem,
    options: opts.length > 0 ? opts.map((o) => o.text) : undefined,
    answer,
    explanation: q.explanation ?? undefined,
    page_or_section: page,
  };
}

export function parsedExamToQuestions(exam: ParsedExam): ExtractedQuestion[] {
  const out: ExtractedQuestion[] = [];
  let qid = 0;
  for (const sec of exam.sections) {
    for (const q of sec.questions) {
      // 复合题暂以子问题为独立题
      if (q.subQuestions.length > 0) {
        for (const sub of q.subQuestions) {
          out.push(buildQuestionFromParsed(sub, sec.number, qid++));
        }
      } else {
        out.push(buildQuestionFromParsed(q, sec.number, qid++));
      }
    }
  }
  return out;
}
