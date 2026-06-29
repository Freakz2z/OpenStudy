import type { BrowserWindow } from 'electron';
import {
  deleteQuestionsByDocument,
  getDocument,
  insertQuestions,
  listQuestionsByDocument,
  setExtractedMarkdown,
} from './db.js';
import { parseFile } from './parser/index.js';
import { identifyQuestions } from './identifier.js';
import { parsedDocToMarkdown } from './markdown-workflow.js';
import {
  normalizeMarkdownStandardLanguage,
  normalizeStandardMarkdown,
} from '../../shared/markdown-standard.js';
import {
  analyzeMarkdownPrecheck,
  buildIdentifyQualityReport,
} from '../../shared/question-diagnostics.js';
import type { IdentifyAuditEvent } from '../../shared/types.js';
import {
  appendIdentifyLog,
  clearIdentifyLogs,
  createIdentifyLogEntry,
  deleteIdentifyLog,
  listIdentifyLogs,
} from './identify-audit.js';

export async function getDocumentMarkdownById(docId: number, lang?: string): Promise<{
  markdown: string;
  source: 'db' | 'fresh';
}> {
  const doc = getDocument(docId);
  if (!doc) throw new Error(`文档不存在: ${docId}`);
  const standardLang = normalizeMarkdownStandardLanguage(lang);
  if (doc.extracted_markdown && doc.extracted_markdown.trim()) {
    return {
      markdown: normalizeStandardMarkdown(doc.extracted_markdown, standardLang),
      source: 'db',
    };
  }

  const parsed = await parseFile(doc.file_path, doc.file_type);
  const markdown = parsedDocToMarkdown(parsed, standardLang);
  setExtractedMarkdown(docId, markdown);
  return { markdown, source: 'fresh' };
}

export function saveDocumentMarkdownById(docId: number, markdown: string): { ok: true } {
  setExtractedMarkdown(docId, markdown);
  return { ok: true };
}

export async function identifyQuestionsForDocument(
  docId: number,
  lang?: string,
  win?: BrowserWindow | null,
): Promise<{
  questions: ReturnType<typeof listQuestionsByDocument>;
  diagnostics: ReturnType<typeof buildIdentifyQualityReport>;
}> {
  const doc = getDocument(docId);
  if (!doc) throw new Error(`文档不存在: ${docId}`);
  const auditTrail: IdentifyAuditEvent[] = [];
  const standardLang = normalizeMarkdownStandardLanguage(lang);
  let sourceMarkdown = doc.extracted_markdown?.trim() ?? '';
  if (sourceMarkdown) sourceMarkdown = normalizeStandardMarkdown(sourceMarkdown, standardLang);
  if (!sourceMarkdown) {
    const parsed = await parseFile(doc.file_path, doc.file_type);
    sourceMarkdown = parsedDocToMarkdown(parsed, standardLang);
    if (sourceMarkdown) setExtractedMarkdown(docId, sourceMarkdown);
  }

  try {
    const items = await identifyQuestions({ ...doc, extracted_markdown: sourceMarkdown }, {
      standardLang,
      onProgress: (progress) => {
        win?.webContents.send('question:identify:progress', { docId, ...progress });
      },
      onAudit: (event) => {
        auditTrail.push(event);
      },
    });
    const diagnostics = buildIdentifyQualityReport(sourceMarkdown, items);
    deleteQuestionsByDocument(docId);
    insertQuestions(
      docId,
      items.map((q, i) => ({
        type: q.type,
        stem: q.stem,
        options_json: q.options ? JSON.stringify(q.options) : null,
        answer: q.answer,
        explanation: q.explanation ?? null,
        page_or_section: q.page_or_section ?? null,
        position: i,
      })),
    );
    try {
      await appendIdentifyLog(createIdentifyLogEntry({
        doc,
        status: 'success',
        message: `识别完成：${items.length} 道题`,
        estimated_question_count: diagnostics.estimatedQuestionCount,
        identified_question_count: diagnostics.identifiedQuestionCount,
        events: auditTrail,
        markdown: sourceMarkdown,
      }));
    } catch {}
    return {
      questions: listQuestionsByDocument(docId),
      diagnostics,
    };
  } catch (error) {
    const precheck = analyzeMarkdownPrecheck(sourceMarkdown);
    try {
      await appendIdentifyLog(createIdentifyLogEntry({
        doc,
        status: 'failed',
        message: (error as Error).message,
        estimated_question_count: precheck.estimatedQuestionCount,
        events: auditTrail,
        markdown: sourceMarkdown,
        error_name: (error as Error).name,
      }));
    } catch {}
    throw error;
  }
}

export async function parseExamSource(markdown: string, lang?: string) {
  const { parseExamMarkdown } = await import('../../shared/exam-parser.js');
  const { parsedExamToQuestions } = await import('../../shared/exam-to-questions.js');
  const standardLang = normalizeMarkdownStandardLanguage(lang);
  const exam = parseExamMarkdown(normalizeStandardMarkdown(markdown, standardLang));
  const questions = parsedExamToQuestions(exam);
  return {
    exam,
    questions,
    issues: exam.issues,
  };
}

export async function importExamMarkdownToDocument(
  docId: number,
  markdown: string,
  lang?: string,
): Promise<{ ok: true; count: number; issues: Awaited<ReturnType<typeof parseExamSource>>['issues'] }> {
  const { parseExamMarkdown } = await import('../../shared/exam-parser.js');
  const { parsedExamToQuestions } = await import('../../shared/exam-to-questions.js');
  const standardLang = normalizeMarkdownStandardLanguage(lang);
  const normalizedMarkdown = normalizeStandardMarkdown(markdown, standardLang);
  const exam = parseExamMarkdown(normalizedMarkdown);
  const items = parsedExamToQuestions(exam);
  deleteQuestionsByDocument(docId);
  if (items.length > 0) {
    insertQuestions(
      docId,
      items.map((q, i) => ({
        type: q.type,
        stem: q.stem,
        options_json: q.options ? JSON.stringify(q.options) : null,
        answer: q.answer,
        explanation: q.explanation ?? null,
        page_or_section: q.page_or_section ?? null,
        position: i,
      })),
    );
  }
  return { ok: true, count: items.length, issues: exam.issues };
}

export {
  clearIdentifyLogs,
  deleteIdentifyLog,
  listIdentifyLogs,
};
