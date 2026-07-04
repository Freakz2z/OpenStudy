import type { Question, QuestionType } from './types.js';
import type { OpenStudyJsonQuestionSet } from './openstudy-json.js';
import { OpenStudyJsonQuestionSetSchema } from './openstudy-json.js';
import { stripChoicePrefix } from './question-format.js';
import {
  STANDARD_SECTION_TITLES,
  STANDARD_TYPE_VALUES,
  normalizeMarkdownStandardLanguage,
  type MarkdownStandardLanguage,
} from './markdown-standard.js';

export function questionsToOpenStudyJson(
  questions: Question[],
  options: {
    title?: string;
    sourcePath?: string;
    fileType?: string;
    importedAt?: number;
  } = {},
): OpenStudyJsonQuestionSet {
  return OpenStudyJsonQuestionSetSchema.parse({
    version: 'openstudy.question-set.v1',
    title: options.title,
    source:
      options.sourcePath || options.fileType || options.importedAt
        ? {
            path: options.sourcePath,
            fileType: options.fileType,
            importedAt: options.importedAt,
          }
        : undefined,
    questions: questions.map((question) => ({
      id: question.id,
      type: question.type,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      pageOrSection: question.page_or_section,
      position: question.position,
    })),
  });
}

export function openStudyJsonToQuestions(json: unknown): Question[] {
  const parsed = OpenStudyJsonQuestionSetSchema.parse(json);
  return parsed.questions.map((question, index) => ({
    id: Number(question.id ?? index + 1),
    document_id: 0,
    type: question.type,
    stem: question.stem,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    page_or_section: question.pageOrSection,
    position: question.position ?? index,
  }));
}

export function renderOpenStudyMarkdown(
  questions: Question[],
  lang: string | MarkdownStandardLanguage = 'zh',
): string {
  const standardLang = normalizeMarkdownStandardLanguage(lang);
  const blocks: string[] = [];
  let lastType: QuestionType | null = null;
  let questionNumber = 0;

  for (const question of questions) {
    if (question.type !== lastType) {
      blocks.push(`## ${STANDARD_SECTION_TITLES[standardLang][question.type]}`);
      blocks.push('');
      lastType = question.type;
      questionNumber = 0;
    }

    questionNumber += 1;
    blocks.push(`### ${questionNumber}. ${question.stem}`);
    blocks.push('');

    if (question.options?.length) {
      for (const [index, option] of question.options.entries()) {
        blocks.push(`- ${formatStandardOption(option, index)}`);
      }
      blocks.push('');
    }

    blocks.push(`Type: ${STANDARD_TYPE_VALUES[question.type]}`);
    blocks.push(`Answer: ${question.answer}`);
    if (question.explanation?.trim()) {
      blocks.push(`Explanation: ${question.explanation.trim()}`);
    }
    if (question.page_or_section?.trim()) {
      blocks.push(`Topic: ${question.page_or_section.trim()}`);
    }
    blocks.push('');
  }

  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export interface PracticeAttemptSummary {
  userAnswer: string;
  isCorrect: boolean;
}

export function renderPracticeResultsMarkdown(
  documentTitle: string,
  questions: Question[],
  attempts: Record<number, PracticeAttemptSummary>,
  summary: { correct: number; wrong: number; total: number },
): string {
  const blocks: string[] = [];
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  blocks.push(`# ${documentTitle} - 做题记录`);
  blocks.push('');
  blocks.push(`> 导出时间：${dateStr}`);
  blocks.push(`> 总题数：${questions.length}  ·  正确：${summary.correct}  ·  错误：${summary.wrong}`);
  if (summary.total > 0) {
    const pct = Math.round((summary.correct / Math.max(summary.total, 1)) * 100);
    blocks.push(`> 正确率：${pct}%`);
  }
  blocks.push('');
  blocks.push('---');
  blocks.push('');

  let lastType: QuestionType | null = null;
  let questionNumber = 0;

  for (const question of questions) {
    const attempt = attempts[question.id];

    if (question.type !== lastType) {
      blocks.push(`## ${STANDARD_SECTION_TITLES.zh[question.type]}`);
      blocks.push('');
      lastType = question.type;
      questionNumber = 0;
    }

    questionNumber += 1;

    // 状态标记
    const status = attempt
      ? attempt.isCorrect
        ? ' ✓ 正确'
        : ' ✗ 错误'
      : ' ○ 未作答';

    blocks.push(`### ${questionNumber}. ${question.stem}${status}`);
    blocks.push('');

    if (question.options?.length) {
      for (const [index, option] of question.options.entries()) {
        blocks.push(`- ${formatStandardOption(option, index)}`);
      }
      blocks.push('');
    }

    // 用户答案
    if (attempt) {
      blocks.push(`- **你的答案：** ${formatAttemptAnswer(question, attempt.userAnswer)}`);
      blocks.push(`- **参考答案：** ${formatAttemptAnswer(question, question.answer)}`);
    } else {
      blocks.push(`- **参考答案：** ${formatAttemptAnswer(question, question.answer)}`);
    }

    if (question.explanation?.trim()) {
      blocks.push(`- **解析：** ${question.explanation.trim()}`);
    }

    blocks.push('');
  }

  return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function formatAttemptAnswer(question: Question, answer: string): string {
  if (!isOptionQuestion(question.type) || !question.options?.length) {
    return answer;
  }
  const letters = answer.replace(/[\s,，、;；/]+/g, '').toUpperCase();
  if (!/^[A-H]+$/.test(letters)) return answer;
  return [...letters]
    .map((letter) => {
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < question.options!.length) {
        return `${letter}. ${stripChoicePrefix(question.options![idx])}`;
      }
      return letter;
    })
    .join('；');
}

function isOptionQuestion(type: QuestionType): boolean {
  return type === 'choice' || type === 'multiple' || type === 'judge' || type === 'code';
}

function stripOptionBullet(option: string): string {
  return option.replace(/^\s*[-*+]\s*/, '').trim();
}

function formatStandardOption(option: string, index: number): string {
  const text = stripChoicePrefix(stripOptionBullet(option));
  return `${String.fromCharCode(65 + index)}. ${text}`;
}
