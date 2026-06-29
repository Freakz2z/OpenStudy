import type { Question, QuestionType } from './types.js';
import type { OpenStudyJsonQuestionSet } from './openstudy-json.js';
import { OpenStudyJsonQuestionSetSchema } from './openstudy-json.js';
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
      for (const option of question.options) {
        blocks.push(`- ${stripOptionBullet(option)}`);
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

function stripOptionBullet(option: string): string {
  return option.replace(/^\s*[-*+]\s*/, '').trim();
}
