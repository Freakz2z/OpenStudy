import type { QuestionType } from './types.js';

export type MarkdownStandardLanguage = 'zh' | 'en';

export function normalizeMarkdownStandardLanguage(
  lang?: string | null,
): MarkdownStandardLanguage {
  return String(lang ?? '')
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'zh';
}

export const STANDARD_SECTION_TITLES: Record<
  MarkdownStandardLanguage,
  Record<QuestionType, string>
> = {
  zh: {
    choice: '单选题',
    multiple: '多选题',
    judge: '判断题',
    fill: '填空题',
    short: '简答题',
    code: '代码题',
  },
  en: {
    choice: 'Multiple Choice',
    multiple: 'Multiple Select',
    judge: 'True or False',
    fill: 'Fill in the Blank',
    short: 'Short Answer',
    code: 'Code Analysis',
  },
};

export const STANDARD_FIELD_LABELS = {
  type: 'Type',
  answer: 'Answer',
  explanation: 'Explanation',
  topic: 'Topic',
  tags: 'Tags',
} as const;

export const STANDARD_TYPE_VALUES: Record<QuestionType, QuestionType> = {
  choice: 'choice',
  multiple: 'multiple',
  judge: 'judge',
  fill: 'fill',
  short: 'short',
  code: 'code',
};

const OPTION_LINE_RE =
  /^\s*(?:[-*+]\s*)?[（(]?\s*([A-Ha-h])\s*[）).、．:：\]】]\s*(.*)$/;
const ANSWER_LINE_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:参考答案|正确答案|标准答案|答案|answer)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:参考答案|正确答案|标准答案|答案|answer)\s*[】\]]|[【\[]\s*(?:参考答案|正确答案|标准答案|答案|answer)\s*[:：]?\s*(.*?)\s*[】\]]|(?:参考答案|正确答案|标准答案|答案|answer))\s*[:：]?\s*(.*)$/i;
const EXPLANATION_LINE_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:答案解析|解析|解题思路|思路|explanation)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:答案解析|解析|解题思路|思路|explanation)\s*[】\]]|[【\[]\s*(?:答案解析|解析|解题思路|思路|explanation)\s*[:：]?\s*(.*?)\s*[】\]]|(?:答案解析|解析|解题思路|思路|explanation))\s*[:：]?\s*(.*)$/i;
const TYPE_LINE_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:题型|类型|question\s*type|type)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:题型|类型|question\s*type|type)\s*[】\]]|[【\[]\s*(?:题型|类型|question\s*type|type)\s*[:：]?\s*(.*?)\s*[】\]]|(?:题型|类型|question\s*type|type))\s*[:：]?\s*(.*)$/i;
const TOPIC_LINE_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:考点|知识点|topic)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:考点|知识点|topic)\s*[】\]]|[【\[]\s*(?:考点|知识点|topic)\s*[:：]?\s*(.*?)\s*[】\]]|(?:考点|知识点|topic))\s*[:：]?\s*(.*)$/i;
const TAGS_LINE_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:标签|tags?)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:标签|tags?)\s*[】\]]|[【\[]\s*(?:标签|tags?)\s*[:：]?\s*(.*?)\s*[】\]]|(?:标签|tags?))\s*[:：]?\s*(.*)$/i;
const DIFFICULTY_LINE_RE =
  /^(?:\*\*[\u3010\[<]?\s*(?:难度|difficulty)\s*[\u3011\]>]?\*\*|[【\[]\s*(?:难度|difficulty)\s*[】\]]|[【\[]\s*(?:难度|difficulty)\s*[:：]?\s*(.*?)\s*[】\]]|(?:难度|difficulty))\s*[:：]?\s*(.*)$/i;
const SECTION_NUMBER_PREFIX_RE =
  /^(?:\d+\s+)?(?:第?\s*[一二三四五六七八九十百千万0-9]+\s*[、.．:：)）]\s*|[一二三四五六七八九十百千万]+\s*[、.．:：)）]\s*|\d+\s*[、.．:：)）]\s*)/;

export function detectMarkdownStandardLanguage(text: string): MarkdownStandardLanguage {
  const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const latinCount = (text.match(/[A-Za-z]/g) || []).length;
  return latinCount > chineseCount * 1.5 && chineseCount < 20 ? 'en' : 'zh';
}

export function inferQuestionTypeFromHeading(
  heading: string | null | undefined,
): QuestionType | null {
  if (!heading) return null;
  const normalized = heading
    .replace(/^#{1,6}\s*/, '')
    .replace(SECTION_NUMBER_PREFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (
    /(?:代码\s*(?:题|分析|解析)|code\s*(?:analysis|question)|coding\s*(?:analysis|question))/.test(
      normalized,
    )
  ) {
    return 'code';
  }
  if (
    /(?:多选题|多项选择题|multiple\s+select|multi[\s-]*select|select\s+all\s+that\s+apply)/.test(
      normalized,
    )
  ) {
    return 'multiple';
  }
  if (/(?:判断题|是非题|true\s*\/\s*false|true\s+or\s+false)/.test(normalized)) {
    return 'judge';
  }
  if (/(?:填空题|fill\s+in\s+the\s+blank|fill\s+in\s+the\s+blanks)/.test(normalized)) {
    return 'fill';
  }
  if (/(?:简答题|问答题|论述题|名词解释|综合应用题|short\s+answer|essay)/.test(normalized)) {
    return 'short';
  }
  if (
    /(?:单选题|单项选择题|选择题|single\s+choice|multiple\s+choice|choice\b|mcq\b)/.test(
      normalized,
    )
  ) {
    return 'choice';
  }
  return null;
}

export function normalizeQuestionTypeValue(
  value: string | null | undefined,
): QuestionType | null {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(SECTION_NUMBER_PREFIX_RE, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!normalized) return null;

  if (
    /^(?:code|coding|code analysis|code question|代码|代码题|代码分析|代码解析)$/.test(
      normalized,
    )
  ) {
    return 'code';
  }
  if (
    /^(?:multiple|multiple select|multi-select|multi select|select all that apply|多选|多选题|多项选择|多项选择题)$/.test(
      normalized,
    )
  ) {
    return 'multiple';
  }
  if (
    /^(?:judge|judgement|judgment|true\/false|true or false|判断|判断题|是非题)$/.test(
      normalized,
    )
  ) {
    return 'judge';
  }
  if (
    /^(?:fill|fill in the blank|fill in the blanks|blank|填空|填空题)$/.test(normalized)
  ) {
    return 'fill';
  }
  if (
    /^(?:short|short answer|essay|subjective|简答|简答题|问答题|论述题|名词解释|综合应用题)$/.test(normalized)
  ) {
    return 'short';
  }
  if (
    /^(?:choice|single choice|multiple choice|mcq|single|单选|单选题|单项选择|单项选择题|选择题)$/.test(
      normalized,
    )
  ) {
    return 'choice';
  }
  return inferQuestionTypeFromHeading(normalized);
}

function stripSectionPrefix(rawHeading: string): string {
  return rawHeading
    .replace(/^#{1,6}\s*/, '')
    .replace(SECTION_NUMBER_PREFIX_RE, '')
    .replace(/\s*[（(]\s*共?\s*\d+\s*题\s*[）)]\s*$/i, '')
    .trim();
}

export function normalizeSectionHeading(
  rawHeading: string,
  lang: MarkdownStandardLanguage = 'zh',
): string {
  const type = inferQuestionTypeFromHeading(rawHeading);
  if (type) return STANDARD_SECTION_TITLES[lang][type];
  return stripSectionPrefix(rawHeading);
}

function normalizeFieldLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const typeMatch = trimmed.match(TYPE_LINE_RE);
  if (typeMatch) {
    const value = (typeMatch[1] ?? typeMatch[2] ?? '').trim();
    const normalized = normalizeQuestionTypeValue(value);
    const rendered = normalized ?? value;
    return rendered
      ? `${STANDARD_FIELD_LABELS.type}: ${rendered}`
      : `${STANDARD_FIELD_LABELS.type}:`;
  }

  const answerMatch = trimmed.match(ANSWER_LINE_RE);
  if (answerMatch) {
    const value = (answerMatch[1] ?? answerMatch[2] ?? '').trim();
    return value ? `${STANDARD_FIELD_LABELS.answer}: ${value}` : `${STANDARD_FIELD_LABELS.answer}:`;
  }

  const explanationMatch = trimmed.match(EXPLANATION_LINE_RE);
  if (explanationMatch) {
    const value = (explanationMatch[1] ?? explanationMatch[2] ?? '').trim();
    return value
      ? `${STANDARD_FIELD_LABELS.explanation}: ${value}`
      : `${STANDARD_FIELD_LABELS.explanation}:`;
  }

  const topicMatch = trimmed.match(TOPIC_LINE_RE);
  if (topicMatch) {
    const value = (topicMatch[1] ?? topicMatch[2] ?? '').trim();
    return value ? `${STANDARD_FIELD_LABELS.topic}: ${value}` : `${STANDARD_FIELD_LABELS.topic}:`;
  }

  const tagsMatch = trimmed.match(TAGS_LINE_RE);
  if (tagsMatch) {
    const value = (tagsMatch[1] ?? tagsMatch[2] ?? '').trim();
    return value ? `${STANDARD_FIELD_LABELS.tags}: ${value}` : `${STANDARD_FIELD_LABELS.tags}:`;
  }

  if (DIFFICULTY_LINE_RE.test(trimmed)) return '';

  const optionMatch = trimmed.match(OPTION_LINE_RE);
  if (optionMatch) {
    const letter = (optionMatch[1] ?? '').toUpperCase();
    const value = (optionMatch[2] ?? '').trim();
    return `- ${letter}. ${value}`.trimEnd();
  }

  return null;
}

function isQuestionBlockStart(line: string): boolean {
  const trimmed = line.trim();
  return /^<!--\s*QUESTION_ID:/i.test(trimmed) || /^###\s+/.test(trimmed);
}

function isQuestionBlockEnd(line: string): boolean {
  const trimmed = line.trim();
  return /^##\s+/.test(trimmed) || /^---$/.test(trimmed);
}

function reorderQuestionTypeField(lines: string[]): string[] {
  const output: string[] = [];
  let block: string[] = [];

  function flushBlock() {
    if (block.length === 0) return;

    let splitIndex = 0;
    while (splitIndex < block.length) {
      const trimmed = block[splitIndex].trim();
      if (/^<!--\s*QUESTION_ID:/i.test(trimmed) || /^###\s+/.test(trimmed) || trimmed === '') {
        splitIndex++;
        continue;
      }
      break;
    }

    const prefix = block.slice(0, splitIndex);
    const body = block.slice(splitIndex);
    const typeLineIndexes: number[] = [];
    const metadataInsertCandidates: number[] = [];
    let insideFence = false;
    for (let index = 0; index < body.length; index++) {
      const line = body[index] ?? '';
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        insideFence = !insideFence;
      }
      if (insideFence) continue;
      if (trimmed.startsWith(`${STANDARD_FIELD_LABELS.type}:`)) {
        typeLineIndexes.push(index);
        continue;
      }
      if (/^(?:Answer|Explanation|Topic|Tags):/.test(trimmed)) {
        metadataInsertCandidates.push(index);
      }
    }

    if (typeLineIndexes.length === 0) {
      output.push(...block);
      block = [];
      return;
    }

    const typeLineSet = new Set(typeLineIndexes);
    const typeLines = typeLineIndexes.map((index) => body[index]!);
    const bodyWithoutType = body.filter((_, index) => !typeLineSet.has(index));
    let insertIndex = metadataInsertCandidates.length
      ? metadataInsertCandidates[0]! - typeLineIndexes.filter((index) => index < metadataInsertCandidates[0]!).length
      : -1;
    if (insertIndex < 0) {
      insertIndex = bodyWithoutType.length;
      while (insertIndex > 0 && bodyWithoutType[insertIndex - 1]?.trim() === '') {
        insertIndex--;
      }
    }

    output.push(
      ...prefix,
      ...bodyWithoutType.slice(0, insertIndex),
      ...typeLines,
      ...bodyWithoutType.slice(insertIndex),
    );
    block = [];
  }

  for (const line of lines) {
    if (isQuestionBlockStart(line)) {
      flushBlock();
      block.push(line);
      continue;
    }
    if (block.length > 0 && isQuestionBlockEnd(line)) {
      flushBlock();
      output.push(line);
      continue;
    }
    if (block.length > 0) {
      block.push(line);
    } else {
      output.push(line);
    }
  }

  flushBlock();
  return output;
}

export function normalizeStandardMarkdown(
  markdown: string,
  lang: MarkdownStandardLanguage = detectMarkdownStandardLanguage(markdown),
): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  let awaitingSectionMeta = false;
  let insideFence = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (/^```/.test(trimmed)) {
      output.push(rawLine);
      insideFence = !insideFence;
      continue;
    }

    if (insideFence) {
      output.push(rawLine);
      continue;
    }

    const sectionMatch = trimmed.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      const type = inferQuestionTypeFromHeading(sectionMatch[1]);
      if (type) {
        output.push(`## ${STANDARD_SECTION_TITLES[lang][type]}`);
        awaitingSectionMeta = true;
        continue;
      }
    }

    if (awaitingSectionMeta && /^>\s+/.test(trimmed)) continue;
    if (trimmed && !/^>\s+/.test(trimmed)) awaitingSectionMeta = false;

    const normalizedField = normalizeFieldLine(rawLine);
    if (normalizedField !== null) {
      if (normalizedField) output.push(normalizedField);
      continue;
    }

    output.push(rawLine);
  }

  return reorderQuestionTypeField(output).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
