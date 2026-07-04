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
  /(代码\s*(?:题|解析|分析)|单选题|单项选择题|多选题|多项选择题|选择题|判断题|是非题|填空题|简答题|问答题|论述题|名词解释|综合应用题|code\s*(?:analysis|question)|single\s+choice|multiple\s+choice|multiple\s+select|true\s*\/\s*false|true\s+or\s+false|fill\s+in\s+the\s+blank|fill\s+in\s+the\s+blanks|short\s+answer|essay)/i;
const SECTION_LINE_RE =
  /^\s*(?:#{1,6}\s*)?(?:\d+\s+)?(?:第?\s*[一二三四五六七八九十百千万0-9]+\s*[、.．:：)）]\s*)?(代码\s*(?:题|解析|分析)(?:\s*[（(]?\s*(?:单选|选择)\s*[）)]?)?|单选题|单项选择题|多选题|多项选择题|选择题|判断题|是非题|填空题|简答题|问答题|论述题|名词解释|综合应用题|code\s*(?:analysis|question)|single\s+choice|multiple\s+choice|multiple\s+select|true\s*\/\s*false|true\s+or\s+false|fill\s+in\s+the\s+blank|fill\s+in\s+the\s+blanks|short\s+answer|essay)\s*(?:[（(]\s*共?\s*\d+\s*题\s*[）)])?\s*(?:(?:[.．·…]{2,}\s*)?\d+)?\s*$/i;
const QUESTION_START_PATTERNS: ReadonlyArray<RegExp> = [
  /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(?:q(?:uestion)?\s*[-#]?\s*(\d{1,4}))\s*[.、．:：)）-]?\s*(.*)$/i,
  /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(?:练习\s*(\d{1,4}))\s*[.、．:：)）-]?\s*(.*)$/i,
  /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(?:(?:第\s*([一二三四五六七八九十百千万0-9]+)\s*题\s*[.、．:：)）]?)|(?:[（(]?\s*(\d{1,4})\s*[）).、．:：])|(?:([一二三四五六七八九十百千万]+)\s*[、．.)）]))\s*(.*)$/,
];
const OPTION_START_RE =
  /^\s*(?:[-*+]\s*)?[（(]?\s*([A-Ha-h])\s*[）).、．:：\]】]\s*(.*)$/;
const ANSWER_RE =
  /^\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:参考答案|正确答案|标准答案|答案|答|answer)\s*(?:[:：=]\s*|\s+)?(.*?)(?:\s*[】\]])?\s*$/i;
const EXPLANATION_RE =
  /^\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:答案解析|解析|解释|解题思路|思路|说明|explanation)\s*(?:[】\]])?\s*(?:[:：=]\s*|\s+)?(.*)$/i;
const TYPE_RE =
  /^\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:题型|类型|question\s*type|type)\s*(?:[】\]])?\s*(?:[:：=]\s*|\s+)?(.*)$/i;
const TOPIC_RE =
  /^\s*(?:[-*+]\s*)?(?:[【\[]\s*)?(?:主题|章节|topic|section)\s*(?:[】\]])?\s*(?:[:：=]\s*|\s+)?(.*)$/i;
const JUDGE_ANSWER_RE =
  /^\s*[【\[]\s*(对|错|正确|错误|是|否|√|×|true|false)\s*[】\]]\s*(.*)$/i;
const SHORT_ANSWER_MARKER_RE = /(?:参考|答题要点|答案要点|框架回顾)\s*[:：]?\s*$/;
const APPENDIX_ANSWER_RE = /(?:附录\s*[:：]?)?\s*答案速查表/;
const LEADING_STEM_TYPE_RE =
  /^\s*(?:代码\s*(?:题|分析|解析)|单选题|单项选择题|多选题|多项选择题|选择题|判断题|是非题|填空题|简答题|问答题|论述题|code\s*(?:analysis|question)|single\s+choice|multiple\s+choice|multiple\s+select|true\s*\/\s*false|true\s+or\s+false|fill\s+in\s+the\s+blank|fill\s+in\s+the\s+blanks|short\s+answer|essay)\s*[:：-]?\s*/i;
const ENGLISH_NUMBER_WORDS = new Map<string, string>([
  ['one', '1'],
  ['two', '2'],
  ['three', '3'],
  ['four', '4'],
  ['five', '5'],
  ['six', '6'],
  ['seven', '7'],
  ['eight', '8'],
  ['nine', '9'],
  ['ten', '10'],
]);
const ENGLISH_WORD_QUESTION_RE =
  /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?question\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b\s*[.、．:：)）-]?\s*(.*)$/i;
const FINAL_QUESTION_RE =
  /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(?:最后一题(?:\s*[（(][^）)]*[）)])?|final\s+question)\s*[.、．:：)）-]?\s*(.*)$/i;
const SUBQUESTION_START_RE = /^\s*[（(]\s*\d{1,3}\s*[）)]\s*/;
const ANSWER_ONLY_CHOICE_RE = /^\s*(?:[-*+]\s*)?([A-Ha-h])\s*[.、．:：)）]?\s*$/;
const TRAILING_CHOICE_KEY_RE = /^\s*(?:[-*+]\s*)?[A-Ha-h]\s*[.、．:：)）]\s*$/;

function cleanLine(line: string): string {
  return line.replace(/\u00a0/g, ' ').replace(/[ \t]+$/g, '');
}

function countInlineOptionMarkers(line: string): number {
  return [...line.matchAll(/(?:^|\s|- )([A-Ha-h])\s*[.、．:：)）]\s*/g)].length;
}

function looksLikeCodeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^(?:(?:\/\/|#|--).+|\/\*.*|\*\/|\* .+|#include\b|package\b|import\b|public\b|private\b|protected\b|class\b|interface\b|enum\b|func\b|const\b|let\b|var\b|return\b|if\b|for\b|while\b|switch\b|case\b|break\b|\{|\}|[\w$.]+\([^)]*\)\s*[;{]?)$/.test(
    trimmed,
  );
}

function expandInlineLabels(line: string): string {
  if (looksLikeCodeLine(line)) return line;
  if (
    !questionStart(line) &&
    countInlineOptionMarkers(line) < 2 &&
    !/(?:true\s*\/\s*false|对\s*\/\s*错|对还是错|true\s+or\s+false)/i.test(line) &&
    !/(?:Type|Answer|Explanation|参考答案|正确答案|标准答案|答案|解析|解释|说明|exp)\s*(?:[:=：]|\s)/i.test(
      line,
    )
  ) {
    return line;
  }

  return line
    .replace(/\s+(?=(?:Type|Answer|Explanation|参考答案|正确答案|标准答案|答案|解析|解释|说明|exp)\s*(?:[:=：]))/gi, '\n')
    .replace(/\s+(?=(?:Type|Answer|Explanation|参考答案|正确答案|标准答案|答案|解析|解释|说明|exp)\s*$)/gi, '\n');
}

function expandInlineOptions(line: string): string[] {
  if (looksLikeCodeLine(line)) return [line];
  const inline = splitInlineOptions(line);
  if (!inline) return [line];
  const lines: string[] = [];
  if (inline.stemPrefix) lines.push(inline.stemPrefix);
  for (const item of inline.options) {
    lines.push(`- ${item.letter}. ${item.value}`);
  }
  return lines.length > 0 ? lines : [line];
}

function expandCollapsedQuestionText(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let inFence = false;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    const expandedLabels = expandInlineLabels(line).split('\n');
    for (const segment of expandedLabels) {
      out.push(...expandInlineOptions(segment));
    }
  }

  return out.join('\n');
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
  const englishWordMatch = trimmed.match(ENGLISH_WORD_QUESTION_RE);
  if (englishWordMatch) {
    return {
      number: ENGLISH_NUMBER_WORDS.get(englishWordMatch[1].toLowerCase()) ?? '',
      rest: (englishWordMatch[2] ?? '').trim(),
    };
  }
  const finalQuestionMatch = trimmed.match(FINAL_QUESTION_RE);
  if (finalQuestionMatch) {
    return {
      number: '',
      rest: (finalQuestionMatch[1] ?? '').trim(),
    };
  }
  for (const pattern of QUESTION_START_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const rest = (match[match.length - 1] ?? '').trim();
    // 避免把 1.2.3 版本号、目录页码等误当题目；真正空题干允许由下一行续写。
    if (/^\d+(?:\.\d+)+\b/.test(rest)) return null;
    if (/^(?:\.\*|\.\.\*|\.{2,})/.test(rest)) return null;
    const number = match.slice(1, -1).find(Boolean) ?? '';
    return { number, rest };
  }
  return null;
}

function isShortLikeHeading(heading: string | null): boolean {
  return headingType(heading) === 'short';
}

function isLikelyCompositeQuestionTitle(rest: string): boolean {
  const value = rest.trim();
  if (!value || value.length > 80) return false;
  if (/[?？]/.test(value)) return false;
  if (/^(?:答|答案|解析|answer|explanation)\b[:：]?/i.test(value)) return false;
  if (OPTION_START_RE.test(value) || SUBQUESTION_START_RE.test(value)) return false;
  return /[\u4e00-\u9fa5A-Za-z]/.test(value);
}

function isLikelyStandalonePageNumber(lines: string[], index: number): boolean {
  const trimmed = cleanLine(lines[index]).trim();
  if (!/^\d{1,3}$/.test(trimmed)) return false;
  const prev = index > 0 ? cleanLine(lines[index - 1]).trim() : '';
  const next = index + 1 < lines.length ? cleanLine(lines[index + 1]).trim() : '';
  return !prev || !next;
}

function shouldContinueShortAnswerBlock(
  lines: string[],
  index: number,
  line: string,
  current: { heading: string | null; lines: string[] } | null,
): boolean {
  if (!current || !isShortLikeHeading(current.heading)) return false;
  const trimmed = cleanLine(line).trim();
  if (/^#{1,6}\s+/.test(trimmed)) return false;
  if (SUBQUESTION_START_RE.test(trimmed)) return true;

  const start = questionStart(trimmed);
  if (!start) return false;
  if (/[?？]/.test(start.rest)) return false;
  const currentHasSubquestions = current.lines.some((candidate) =>
    SUBQUESTION_START_RE.test(cleanLine(candidate).trim()),
  );
  const next = nextMeaningfulLine(lines, index);
  if (
    currentHasSubquestions &&
    start.rest &&
    next &&
    SUBQUESTION_START_RE.test(next) &&
    isLikelyCompositeQuestionTitle(start.rest)
  ) {
    return false;
  }
  if (currentHasSubquestions) {
    return true;
  }
  const currentLeadLine = current.lines.find((candidate) => cleanLine(candidate).trim());
  if (currentLeadLine && !/[?？]/.test(cleanLine(currentLeadLine).trim()) && start.rest) {
    return false;
  }
  if (next && SUBQUESTION_START_RE.test(next)) return false;

  return current.lines.length > 0;
}

function hasContentsContext(lines: string[], startIndex: number): boolean {
  for (let i = startIndex - 1; i >= 0 && i >= startIndex - 3; i--) {
    const candidate = cleanLine(lines[i]).trim();
    if (!candidate) continue;
    return /^(?:目录|contents?|table of contents)\b/i.test(candidate);
  }
  return false;
}

function isLikelyOutlineTitle(rest: string): boolean {
  const value = rest.trim();
  if (!value || value.length > 24) return false;
  if (/[?？!！]/.test(value)) return false;
  if (/(?:答案|解析|answer|explanation|正确|错误|对|错)/i.test(value)) return false;
  if (/[A-H]\s*[.、．:：)）]/i.test(value)) return false;
  return true;
}

function findOutlineNumberedLines(lines: string[]): Set<number> {
  const ignored = new Set<number>();
  let run: number[] = [];

  const flush = () => {
    if (run.length >= 3 || (run.length >= 2 && hasContentsContext(lines, run[0]!))) {
      for (const index of run) ignored.add(index);
    }
    run = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = cleanLine(lines[i]).trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const start = questionStart(trimmed);
    if (start && isLikelyOutlineTitle(start.rest)) {
      run.push(i);
      continue;
    }
    flush();
  }

  flush();
  return ignored;
}

function nextMeaningfulLine(lines: string[], startIndex: number): string | null {
  for (let i = startIndex + 1; i < lines.length; i++) {
    const candidate = cleanLine(lines[i]).trim();
    if (candidate) return candidate;
  }
  return null;
}

function shouldKeepAsQuestionTitle(
  lines: string[],
  index: number,
  line: string,
): boolean {
  const start = questionStart(line);
  if (!start) return false;
  const next = nextMeaningfulLine(lines, index);
  if (!next) return false;
  return !questionStart(next) && !OPTION_START_RE.test(next) && !ANSWER_RE.test(next);
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
  const lines = expandCollapsedQuestionText(text).split(/\r?\n/);
  const hasQuestionMetadata = lines.some((line) => QUESTION_META_RE.test(line));
  const repeatedPageHeaders = findRepeatedPageHeaders(lines);
  const outlineNumberedLines = hasQuestionMetadata ? new Set<number>() : findOutlineNumberedLines(lines);
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
  let pendingPreludeLine: string | null = null;

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

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const line = cleanLine(rawLine);
    const metaMatch = line.match(QUESTION_META_RE);
    if (metaMatch) {
      flush();
      pendingPreludeLine = null;
      pendingSourceId = metaMatch[1] ?? null;
      if (metaMatch[2]) page = Number(metaMatch[2]);
      awaitingMetadataQuestion = true;
      continue;
    }
    const pageMatch = line.match(PAGE_MARKER_RE);
    if (pageMatch) {
      page = Number(pageMatch[1]);
      pendingPreludeLine = null;
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
    if (isLikelyStandalonePageNumber(lines, index)) continue;
    if (outlineNumberedLines.has(index)) continue;

    const detectedHeading = sectionHeading(line);
    if (detectedHeading && !shouldKeepAsQuestionTitle(lines, index, line)) {
      flush();
      heading = detectedHeading;
      pendingPreludeLine = null;
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
        lines: [start?.rest || pendingPreludeLine || trimmed.replace(/^#{1,6}\s*/, '')],
      };
      pendingSourceId = null;
      pendingPreludeLine = null;
      awaitingMetadataQuestion = false;
      continue;
    }

    const start = questionStart(line);
    if (start) {
      if (shouldContinueShortAnswerBlock(lines, index, line, current)) {
        current?.lines.push(line);
        continue;
      }
      flush();
      current = {
        number: start.number,
        heading,
        page,
        sourceId: null,
        lines: [start.rest || pendingPreludeLine || trimmed.replace(/^#{1,6}\s*/, '')],
      };
      pendingPreludeLine = null;
      continue;
    }

    if (
      !current &&
      trimmed &&
      !OPTION_START_RE.test(trimmed) &&
      !ANSWER_RE.test(trimmed) &&
      !EXPLANATION_RE.test(trimmed) &&
      !TYPE_RE.test(trimmed)
    ) {
      const next = nextMeaningfulLine(lines, index);
      const nextStart = next ? questionStart(next) : null;
      if (nextStart && !nextStart.rest) {
        pendingPreludeLine = trimmed;
        continue;
      }
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
    return {
      letter: match[1].toUpperCase(),
      value: line
        .slice(start, end)
        .replace(/\s+-\s*$/g, '')
        .trim(),
    };
  });
  return {
    stemPrefix: line
      .slice(0, matches[0].index)
      .replace(/\s+-\s*$/g, '')
      .trim(),
    options,
  };
}

function stripShortAnswerPrefixes(line: string): string {
  const trimmed = line.trim();
  const judgeMatch = trimmed.match(JUDGE_ANSWER_RE);
  if (judgeMatch) {
    return [judgeMatch[1], judgeMatch[2]].filter(Boolean).join(' ').trim();
  }
  const answerMatch = trimmed.match(ANSWER_RE);
  if (answerMatch) {
    return (answerMatch[1] ?? '').trim();
  }
  const explanationMatch = trimmed.match(EXPLANATION_RE);
  if (explanationMatch) {
    return (explanationMatch[1] ?? '').trim();
  }
  return trimmed;
}

function joinParts(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trimTrailingChoiceKeyLines(parts: string[]): string[] {
  let end = parts.length;
  while (end > 0 && TRAILING_CHOICE_KEY_RE.test(parts[end - 1] ?? '')) {
    end--;
  }
  return parts.length - end >= 3 ? parts.slice(0, end) : parts;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferFillStemAndAnswer(stemText: string): { stem: string; answer: string } | null {
  const orderedCandidates: string[] = [];
  const seen = new Set<string>();
  const termPattern = '([A-Za-z][A-Za-z0-9_+.-]{0,40}|[\\u4e00-\\u9fa5A-Za-z0-9()（）+.-]{2,40})';
  const candidatePatterns = [
    new RegExp(`(?:^|[、,，:：;；()（）])\\s*${termPattern}\\s*(?=[、,，。；;:：()（）]|和|与|及|$)`, 'g'),
    new RegExp(`(?:由|为|是|对应|抽象为|看成|一个|一组)\\s+${termPattern}\\s*(?=[、,，。；;:：]|和|与|及|$)`, 'g'),
    new RegExp(`(?:和|与|及|的)\\s+${termPattern}\\s*(?=[、,，。；;:：]|组成|构成|子集|$)`, 'g'),
  ];

  for (const pattern of candidatePatterns) {
    for (const match of stemText.matchAll(pattern)) {
      const candidate = (match[1] ?? '').trim();
      if (
        candidate.length < 2 ||
        candidate.length > 12 ||
        seen.has(candidate) ||
        /^(?:和|与|及|或|是|为|的|了|在|中|将|由|一个|一组)$/.test(candidate) ||
        /(?:中的|对应|用于|形成文档|广泛使用|最早|标准通用|系统的|定义|组成|分为|建立|需求分析)/.test(candidate) ||
        /[、,:：]/.test(candidate) ||
        /^[A-Z]\/[A-Z]$/.test(candidate) ||
        /[的了是]$/.test(candidate) ||
        !/[A-Za-z\u4e00-\u9fa5]/.test(candidate)
      ) {
        continue;
      }
      seen.add(candidate);
      orderedCandidates.push(candidate);
    }
  }

  if (orderedCandidates.length > 0) {
    let maskedStem = stemText;
    for (const candidate of orderedCandidates) {
      maskedStem = maskedStem.replace(candidate, '____');
    }
    const answer = orderedCandidates.join('、');
    return {
      stem: maskedStem.replace(/\s{2,}/g, ' ').trim(),
      answer,
    };
  }

  const leadingCodeMatch = stemText.match(/^([A-Z]{2,8})(?=\s*(?:方法|模型|语言|协议|风格|架构|模式))/);
  if (!leadingCodeMatch) return null;
  const answer = leadingCodeMatch[1];
  return {
    stem: stemText.replace(answer, '____').trim(),
    answer,
  };
}

function extractOptionKeywords(option: string): string[] {
  const base = option
    .split(/[，,、；;：:（）()\/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && /[A-Za-z\u4e00-\u9fa5]/.test(part));
  const expanded = new Set(base);
  for (const part of base) {
    if (/^[\u4e00-\u9fa5]{4,}$/.test(part)) {
      expanded.add(part.slice(0, 2));
      expanded.add(part.slice(-2));
    }
  }
  return [...expanded];
}

function inferChoiceAnswerFromExplanation(options: string[], explanationText: string): string | null {
  const explanation = explanationText.replace(/\s+/g, ' ').trim();
  if (!explanation) return null;

  const scores = options.map((option) => {
    const normalizedOption = option.replace(/\s+/g, ' ').trim();
    const exactIndex = explanation.indexOf(normalizedOption);
    const keywords = extractOptionKeywords(normalizedOption);
    const keywordHits = keywords.filter((keyword) => explanation.includes(keyword)).length;
    const negativeHits = keywords.filter((keyword) =>
      !/^(?:系统|方法|模式|语言|模型|结构|原则|关系|阶段)$/.test(keyword) &&
      /(不包括|不属于|不是|不同|不对|错误|例外)[^。；\n]{0,12}/.test(explanation) &&
      new RegExp(`(?:不包括|不属于|不是|不同|不对|错误|例外)[^。；\\n]{0,12}${escapeRegExp(keyword)}`).test(explanation),
    ).length;
    const score = (exactIndex >= 0 ? 6 : 0) + keywordHits + negativeHits * 3;
    return { option: normalizedOption, exactIndex, keywordHits, score };
  });

  const allOfAboveIndex = options.findIndex((option) => /以上都是|以上均是|以上都对|以上均对|all of the above/i.test(option));
  if (allOfAboveIndex >= 0) {
    const covered = scores.filter((_, index) => index !== allOfAboveIndex && scores[index]!.score > 0).length;
    if (covered >= Math.min(3, options.length - 1)) {
      return String.fromCharCode(65 + allOfAboveIndex);
    }
  }

  const ranked = scores
    .map((score, index) => ({ ...score, index }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.exactIndex === -1 && right.exactIndex !== -1) return 1;
      if (right.exactIndex === -1 && left.exactIndex !== -1) return -1;
      return (left.exactIndex === -1 ? Number.MAX_SAFE_INTEGER : left.exactIndex) -
        (right.exactIndex === -1 ? Number.MAX_SAFE_INTEGER : right.exactIndex);
    });
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score <= 0) return null;
  if (
    second &&
    second.score === best.score &&
    second.exactIndex === best.exactIndex
  ) return null;
  return String.fromCharCode(65 + best.index);
}

function extractStemLeadingType(text: string): { type: QuestionType | null; stem: string } {
  const match = text.match(LEADING_STEM_TYPE_RE);
  if (!match) return { type: null, stem: text.trim() };
  const type = inferQuestionTypeFromHeading(match[0].trim());
  const stem = text.slice(match[0].length).trim();
  return { type, stem: stem || text.trim() };
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
  let explicitTopic = '';
  let mode: 'stem' | 'option' | 'answer' | 'explanation' = 'stem';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(?:[-*+]|·)+$/.test(line)) continue;

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

    const topicMatch = line.match(TOPIC_RE);
    if (topicMatch) {
      explicitTopic = (topicMatch[1] ?? '').trim();
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
      if (options.length >= 2 && ANSWER_ONLY_CHOICE_RE.test(line)) {
        answer = line.match(ANSWER_ONLY_CHOICE_RE)?.[1]?.toUpperCase() ?? answer;
        continue;
      }

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

  const normalizedOptions = normalizeChoiceOptions(
    options.map((option) => joinParts(option.parts)),
  );
  const cleanedExplanation = trimTrailingChoiceKeyLines(explanation);
  const stemText = joinParts(stem);
  let normalizedStem = extractStemLeadingType(stemText);
  let type = explicitType ?? headingType(block.heading) ?? normalizedStem.type;
  if (!type) {
    if (normalizedOptions && normalizedOptions.length >= 2) type = 'choice';
    else if (/(?:true\s*\/\s*false|对\s*\/\s*错|true\s+or\s+false)/i.test(normalizedStem.stem)) {
      type = 'judge';
    }
    else if (/^(?:对|错|正确|错误|是|否|√|×|true|false)$/i.test(answer.trim())) type = 'judge';
    else if (/_{2,}|＿{2,}|\(\s*\)|（\s*）|\[\s*\]/.test(normalizedStem.stem)) type = 'fill';
    else type = 'short';
  }

  if (type === 'short' && lines.length >= 2) {
    const [firstLine, ...restLines] = lines.map((line) => line.trim()).filter(Boolean);
    const firstRestLine = restLines.find(Boolean) ?? '';
    if ((!answer && restLines.length > 0) || SUBQUESTION_START_RE.test(firstRestLine)) {
      normalizedStem = extractStemLeadingType(firstLine);
      answer = joinParts(restLines.map(stripShortAnswerPrefixes));
    }
  }

  if (!answer && type === 'short' && stem.length >= 2) {
    const [first, ...rest] = stem;
    const inferredStem = extractStemLeadingType(first);
    if (inferredStem.stem && rest.some((line) => line.trim())) {
      answer = joinParts(rest);
      normalizedStem = inferredStem;
    }
  }

  if (type === 'fill' && !answer) {
    const inferred = inferFillStemAndAnswer(normalizedStem.stem);
    if (inferred) {
      normalizedStem = { ...normalizedStem, stem: inferred.stem };
      answer = inferred.answer;
    }
  }

  if ((type === 'choice' || type === 'multiple' || type === 'code') && !answer && normalizedOptions) {
    const inferred = inferChoiceAnswerFromExplanation(
      normalizedOptions,
      joinParts(cleanedExplanation),
    );
    if (inferred) answer = inferred;
  }

  if (!normalizedStem.stem || !answer) return null;
  if ((type === 'choice' || type === 'multiple' || type === 'code') && (!normalizedOptions || normalizedOptions.length < 2)) return null;

  const pageOrSection = [
    explicitTopic || block.heading,
    block.page ? `PDF 第 ${block.page} 页` : null,
  ]
    .filter(Boolean)
    .join(' · ') || undefined;

  if (type === 'judge') {
    return {
      source_id: block.sourceId ?? undefined,
      type,
      stem: normalizedStem.stem,
      options: ['正确', '错误'],
      answer: normalizeJudgeAnswer(answer),
      explanation: joinParts(cleanedExplanation) || undefined,
      page_or_section: pageOrSection,
    };
  }

  return {
    source_id: block.sourceId ?? undefined,
    type,
    stem: normalizedStem.stem,
    options:
      type === 'choice' || type === 'multiple' || type === 'code'
        ? normalizedOptions ?? undefined
        : undefined,
    answer:
      type === 'choice' || type === 'multiple' || type === 'code'
        ? normalizeChoiceAnswer(answer, normalizedOptions)
        : answer.trim(),
    explanation: joinParts(cleanedExplanation) || undefined,
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
