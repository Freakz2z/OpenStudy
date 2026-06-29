import type { ExtractedQuestion, QuestionType } from '../../shared/types.js';
import {
  normalizeChoiceAnswer,
  normalizeChoiceOptions,
} from '../../shared/question-format.js';
import {
  detectMarkdownStandardLanguage,
  inferQuestionTypeFromHeading,
  normalizeQuestionTypeValue,
  normalizeSectionHeading,
} from '../../shared/markdown-standard.js';

export interface SourceQuestionBlock {
  index: number;
  number: string | null;
  heading: string | null;
  page: number | null;
  sourceId: string | null;
  text: string;
}

export interface StructuredQuestionDocument {
  blocks: SourceQuestionBlock[];
  headings: string[];
}

const PAGE_MARKER_RE = /^\s*\[\[(?:PDF\s+)?PAGE\s+(\d+)\]\]\s*$/i;
const QUESTION_META_RE =
  /^\s*<!--\s*QUESTION_ID:([A-Za-z0-9_-]+)(?:\s+PAGE:(\d+))?[^>]*-->\s*$/i;
const SECTION_KIND_RE =
  /(代码\s*(?:题|解析|分析)|单选题|单项选择题|多选题|多项选择题|选择题|判断题|是非题|填空题|简答题|问答题|论述题|code\s*(?:analysis|question)|single\s+choice|multiple\s+choice|multiple\s+select|true\s*\/\s*false|true\s+or\s+false|fill\s+in\s+the\s+blank|fill\s+in\s+the\s+blanks|short\s+answer|essay)/i;
const SECTION_LINE_RE =
  /^\s*(?:#{1,6}\s*)?(?:\d+\s+)?(?:第?\s*[一二三四五六七八九十百千万0-9]+\s*[、.．:：)）]\s*)?(代码\s*(?:题|解析|分析)(?:\s*[（(]?\s*(?:单选|选择)\s*[）)]?)?|单选题|单项选择题|多选题|多项选择题|选择题|判断题|是非题|填空题|简答题|问答题|论述题|code\s*(?:analysis|question)|single\s+choice|multiple\s+choice|multiple\s+select|true\s*\/\s*false|true\s+or\s+false|fill\s+in\s+the\s+blank|fill\s+in\s+the\s+blanks|short\s+answer|essay)\s*(?:[（(]\s*共?\s*\d+\s*题\s*[）)])?\s*(?:(?:[.．·…]{2,}\s*)?\d+)?\s*$/i;
const QUESTION_START_RE =
  /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(?:(?:第\s*([一二三四五六七八九十百千万0-9]+)\s*题\s*[.、．:：)）]?)|(?:[（(]?\s*(\d{1,4})\s*[）).、．:：])|(?:([一二三四五六七八九十百千万]+)\s*[、．.)）]))\s*(.*)$/;
const OPTION_START_RE =
  /^\s*(?:[-*+]\s*)?[（(]?\s*([A-Ha-h])\s*[）).、．:：\]】]\s*(.*)$/;
const ANSWER_RE =
  /^\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:参考答案|正确答案|标准答案|答案|答|answer)\s*[:：]?\s*(.*?)(?:\s*[】\]])?\s*$/i;
const EXPLANATION_RE =
  /^\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:答案解析|解析|解题思路|思路|说明|explanation)\s*(?:[】\]])?\s*[:：]?\s*(.*)$/i;
const TYPE_RE =
  /^\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:题型|类型|question\s*type|type)\s*(?:[】\]])?\s*[:：]?\s*(.*)$/i;
const JUDGE_ANSWER_RE =
  /^\s*[【\[]\s*(对|错|正确|错误|是|否|√|×|true|false)\s*[】\]]\s*(.*)$/i;
const SHORT_ANSWER_MARKER_RE = /(?:参考|答题要点|答案要点|框架回顾)\s*[:：]?\s*$/;
const APPENDIX_ANSWER_RE = /(?:附录\s*[:：]?)?\s*答案速查表/;

function cleanLine(line: string): string {
  return line.replace(/\u00a0/g, ' ').replace(/[ \t]+$/g, '');
}

function sectionHeading(line: string): string | null {
  const trimmed = cleanLine(line).trim();
  if (!trimmed || !SECTION_KIND_RE.test(trimmed)) return null;
  const match = trimmed.match(SECTION_LINE_RE);
  return match
    ? normalizeSectionHeading(
        trimmed.replace(/^#{1,6}\s*/, ''),
        detectMarkdownStandardLanguage(trimmed),
      )
    : null;
}

function questionStart(line: string): { number: string; rest: string } | null {
  const trimmed = cleanLine(line).trim();
  const match = trimmed.match(QUESTION_START_RE);
  if (!match) return null;
  const rest = (match[4] ?? '').trim();
  // 避免把 1.2.3 版本号、目录页码等误当题目；真正空题干允许由下一行续写。
  if (/^\d+(?:\.\d+)+\b/.test(rest)) return null;
  return {
    number: match[1] ?? match[2] ?? match[3] ?? '',
    rest,
  };
}

function findRepeatedPageHeaders(lines: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    if (!PAGE_MARKER_RE.test(lines[i])) continue;
    let seen = 0;
    for (let j = i + 1; j < lines.length && seen < 2; j++) {
      const candidate = cleanLine(lines[j]).trim();
      if (!candidate) continue;
      if (PAGE_MARKER_RE.test(candidate)) break;
      counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
      seen++;
    }
  }
  return new Set(
    [...counts.entries()]
      .filter(([line, count]) => count >= 3 && line.length >= 4)
      .map(([line]) => line),
  );
}

/**
 * 将整份材料切成独立题块。章节内题号可以重新从 1 开始，题目跨页时不会被截断。
 */
export function segmentQuestionDocument(text: string): StructuredQuestionDocument {
  const lines = text.split(/\r?\n/);
  const hasQuestionMetadata = lines.some((line) => QUESTION_META_RE.test(line));
  const repeatedPageHeaders = findRepeatedPageHeaders(lines);
  const blocks: SourceQuestionBlock[] = [];
  const headings: string[] = [];
  let heading: string | null = null;
  let page: number | null = null;
  let current:
    | {
        number: string;
        heading: string | null;
        page: number | null;
        sourceId: string | null;
        lines: string[];
      }
    | null = null;
  let ignoreRemainder = false;
  let awaitingMetadataQuestion = false;
  let pendingSourceId: string | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (body) {
      blocks.push({
        index: blocks.length,
        number: current.number || null,
        heading: current.heading,
        page: current.page,
        sourceId: current.sourceId,
        text: body,
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    const metaMatch = line.match(QUESTION_META_RE);
    if (metaMatch) {
      flush();
      pendingSourceId = metaMatch[1] ?? null;
      if (metaMatch[2]) page = Number(metaMatch[2]);
      awaitingMetadataQuestion = true;
      continue;
    }
    const pageMatch = line.match(PAGE_MARKER_RE);
    if (pageMatch) {
      page = Number(pageMatch[1]);
      continue;
    }

    const trimmed = line.trim();
    if (APPENDIX_ANSWER_RE.test(trimmed) && (blocks.length > 0 || current)) {
      flush();
      ignoreRemainder = true;
      continue;
    }
    if (ignoreRemainder) continue;
    if (repeatedPageHeaders.has(trimmed)) continue;
    if (page != null && trimmed === String(page)) continue;

    const detectedHeading = sectionHeading(line);
    if (detectedHeading) {
      flush();
      heading = detectedHeading;
      if (!headings.includes(detectedHeading)) headings.push(detectedHeading);
      continue;
    }

    if (hasQuestionMetadata && awaitingMetadataQuestion) {
      if (!trimmed) continue;
      const start = questionStart(line);
      current = {
        number: start?.number ?? '',
        heading,
        page,
        sourceId: pendingSourceId,
        lines: [start?.rest ?? trimmed.replace(/^#{1,6}\s*/, '')],
      };
      pendingSourceId = null;
      awaitingMetadataQuestion = false;
      continue;
    }

    if (hasQuestionMetadata) {
      if (current) current.lines.push(line);
      continue;
    }

    const start = questionStart(line);
    if (start) {
      flush();
      current = {
        number: start.number,
        heading,
        page,
        sourceId: null,
        lines: [start.rest],
      };
      continue;
    }

    if (current) current.lines.push(line);
  }
  flush();

  return { blocks, headings };
}

function headingType(heading: string | null): QuestionType | null {
  if (!heading) return null;
  return inferQuestionTypeFromHeading(heading);
}

function normalizeJudgeAnswer(answer: string): string {
  const value = answer.trim().replace(/[。.!！]$/, '');
  if (/^(?:对|正确|是|√|true)$/i.test(value)) return 'A';
  if (/^(?:错|错误|否|×|x|false)$/i.test(value)) return 'B';
  return normalizeChoiceAnswer(value, ['正确', '错误']);
}

function splitInlineOptions(line: string): {
  stemPrefix: string;
  options: Array<{ letter: string; value: string }>;
} | null {
  const matches = [...line.matchAll(/(?:^|\s)([A-Ha-h])\s*[.、．:：)）]\s*/g)];
  if (matches.length < 2) return null;
  const options = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : line.length;
    return { letter: match[1].toUpperCase(), value: line.slice(start, end).trim() };
  });
  return {
    stemPrefix: line.slice(0, matches[0].index).trim(),
    options,
  };
}

function joinParts(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 对“题号 + 选项 + 答案 + 解析”结构进行确定性解析。
 * 返回 null 表示结构不足，交给 LLM 容错补全。
 */
export function parseStructuredQuestion(
  block: SourceQuestionBlock,
): ExtractedQuestion | null {
  const lines = block.text.split(/\r?\n/).map(cleanLine);
  const stem: string[] = [];
  const explanation: string[] = [];
  const options: Array<{ letter: string; parts: string[] }> = [];
  let answer = '';
  let explicitType: QuestionType | null = null;
  let mode: 'stem' | 'option' | 'answer' | 'explanation' = 'stem';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const judgeMatch = line.match(JUDGE_ANSWER_RE);
    if (judgeMatch) {
      answer = judgeMatch[1];
      mode = 'explanation';
      if (judgeMatch[2]) explanation.push(judgeMatch[2]);
      continue;
    }

    const explanationMatch = line.match(EXPLANATION_RE);
    if (explanationMatch) {
      mode = 'explanation';
      if (explanationMatch[1]) explanation.push(explanationMatch[1]);
      continue;
    }

    const typeMatch = line.match(TYPE_RE);
    if (typeMatch) {
      explicitType = normalizeQuestionTypeValue(typeMatch[1] ?? '');
      continue;
    }

    const answerMatch = line.match(ANSWER_RE);
    if (answerMatch) {
      mode = 'answer';
      if (answerMatch[1]) answer = answerMatch[1].trim();
      continue;
    }

    if (headingType(block.heading) === 'short' && SHORT_ANSWER_MARKER_RE.test(line)) {
      mode = 'answer';
      continue;
    }

    if (mode !== 'explanation' && mode !== 'answer') {
      const inline = splitInlineOptions(line);
      if (inline) {
        if (inline.stemPrefix && mode === 'stem') stem.push(inline.stemPrefix);
        for (const item of inline.options) {
          options.push({ letter: item.letter, parts: [item.value] });
        }
        mode = 'option';
        continue;
      }

      const optionMatch = line.match(OPTION_START_RE);
      if (optionMatch) {
        options.push({
          letter: optionMatch[1].toUpperCase(),
          parts: [optionMatch[2] ?? ''],
        });
        mode = 'option';
        continue;
      }
    }

    if (mode === 'explanation') explanation.push(line);
    else if (mode === 'answer') answer = answer ? `${answer}\n${line}` : line;
    else if (mode === 'option' && options.length > 0) options[options.length - 1].parts.push(line);
    else stem.push(line);
  }

  const stemText = joinParts(stem);
  const normalizedOptions = normalizeChoiceOptions(
    options.map((option) => joinParts(option.parts)),
  );
  let type = explicitType ?? headingType(block.heading);
  if (!type) {
    if (normalizedOptions && normalizedOptions.length >= 2) type = 'choice';
    else if (/^(?:对|错|正确|错误|是|否|√|×|true|false)$/i.test(answer.trim())) type = 'judge';
    else if (/_{2,}|＿{2,}|\(\s*\)|（\s*）|\[\s*\]/.test(stemText)) type = 'fill';
    else type = 'short';
  }

  if (!stemText || !answer) return null;
  if ((type === 'choice' || type === 'multiple' || type === 'code') && (!normalizedOptions || normalizedOptions.length < 2)) return null;

  const pageOrSection = [
    block.heading,
    block.page ? `PDF 第 ${block.page} 页` : null,
  ]
    .filter(Boolean)
    .join(' · ') || undefined;

  if (type === 'judge') {
    return {
      source_id: block.sourceId ?? undefined,
      type,
      stem: stemText,
      options: ['正确', '错误'],
      answer: normalizeJudgeAnswer(answer),
      explanation: joinParts(explanation) || undefined,
      page_or_section: pageOrSection,
    };
  }

  return {
    source_id: block.sourceId ?? undefined,
    type,
    stem: stemText,
    options:
      type === 'choice' || type === 'multiple' || type === 'code'
        ? normalizedOptions ?? undefined
        : undefined,
    answer:
      type === 'choice' || type === 'multiple' || type === 'code'
        ? normalizeChoiceAnswer(answer, normalizedOptions)
        : answer.trim(),
    explanation: joinParts(explanation) || undefined,
    page_or_section: pageOrSection,
  };
}

export function parseStructuredQuestions(
  text: string,
): { blocks: SourceQuestionBlock[]; questions: Array<ExtractedQuestion | null> } {
  const { blocks } = segmentQuestionDocument(text);
  return {
    blocks,
    questions: blocks.map(parseStructuredQuestion),
  };
}
