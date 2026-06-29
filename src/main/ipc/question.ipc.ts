import { ipcMain, BrowserWindow } from 'electron';
import {
  insertQuestions,
  listQuestionsByDocument,
  updateQuestion,
  deleteQuestionsByDocument,
  getDocument,
  setExtractedMarkdown,
  type QuestionUpdate,
} from '../services/db.js';
import { parseFile } from '../services/parser/index.js';
import { textToMarkdown } from '../services/parser/markdown.js';
import { identifyQuestions } from '../services/identifier.js';
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
} from '../services/identify-audit.js';

export function registerQuestionIpc(): void {
  ipcMain.handle('question:identify', async (event, docId: number, lang?: string) => {
    const doc = getDocument(docId);
    if (!doc) throw new Error(`文档不存在: ${docId}`);
    const win = BrowserWindow.fromWebContents(event.sender);
    const auditTrail: IdentifyAuditEvent[] = [];
    const standardLang = normalizeMarkdownStandardLanguage(lang);
    let sourceMarkdown = doc.extracted_markdown?.trim() ?? '';
    if (sourceMarkdown) sourceMarkdown = normalizeStandardMarkdown(sourceMarkdown, standardLang);
    if (!sourceMarkdown) {
      const parsed = await parseFile(doc.file_path, doc.file_type);
      sourceMarkdown = textToMarkdown(parsed.text ?? '', standardLang);
      if (sourceMarkdown) setExtractedMarkdown(docId, sourceMarkdown);
    }

    try {
      // 识题的正式输入始终是 Markdown；原始 PDF/DOCX 文本不会直接交给模型。
      const items = await identifyQuestions({ ...doc, extracted_markdown: sourceMarkdown }, {
        standardLang,
        onProgress: (p) => {
          win?.webContents.send('question:identify:progress', { docId, ...p });
        },
        onAudit: (event) => {
          auditTrail.push(event);
        },
      });
      const diagnostics = buildIdentifyQualityReport(sourceMarkdown, items);
      // 先清空该文档的旧题目（避免重复识别堆积），再插入新的
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
  });

  ipcMain.handle('question:list', (_e, docId: number) =>
    listQuestionsByDocument(docId),
  );

  ipcMain.handle(
    'question:update',
    (_e, qId: number, patch: QuestionUpdate) => {
      updateQuestion(qId, patch);
      return { ok: true };
    },
  );

  ipcMain.handle('question:listIdentifyLogs', (_e, docId?: number, limit?: number) =>
    listIdentifyLogs({ docId, limit }),
  );

  ipcMain.handle('question:deleteIdentifyLog', (_e, id: string) =>
    deleteIdentifyLog(id),
  );

  ipcMain.handle('question:clearIdentifyLogs', () =>
    clearIdentifyLogs(),
  );

  // 获取文档的 Markdown（编辑原文件功能）。自动从源文件解析并保存。
  ipcMain.handle('question:getMarkdown', async (_e, docId: number, lang?: string) => {
    const doc = getDocument(docId);
    if (!doc) throw new Error(`文档不存在: ${docId}`);
    const standardLang = normalizeMarkdownStandardLanguage(lang);
    if (doc.extracted_markdown && doc.extracted_markdown.trim()) {
      return {
        markdown: normalizeStandardMarkdown(doc.extracted_markdown, standardLang),
        source: 'db', // 来自数据库已保存
      };
    }
    // 首次：从源文件解析并保存
    const parsed = await parseFile(doc.file_path, doc.file_type);
    const md = normalizeStandardMarkdown(textToMarkdown(parsed.text ?? '', standardLang), standardLang);
    setExtractedMarkdown(docId, md);
    return { markdown: md, source: 'fresh' };
  });

  // 保存用户编辑后的 Markdown
  ipcMain.handle(
    'question:saveMarkdown',
    (_e, docId: number, markdown: string) => {
      setExtractedMarkdown(docId, markdown);
      return { ok: true };
    },
  );

  // 新格式：解析标准 Markdown 题目文档
  ipcMain.handle('exam:parse', async (_e, markdown: string, lang?: string) => {
    const { parseExamMarkdown } = await import(
      '../../shared/exam-parser.js'
    );
    const { parsedExamToQuestions } = await import(
      '../../shared/exam-to-questions.js'
    );
    const standardLang = normalizeMarkdownStandardLanguage(lang);
    const exam = parseExamMarkdown(normalizeStandardMarkdown(markdown, standardLang));
    const questions = parsedExamToQuestions(exam);
    return {
      exam,
      questions,
      issues: exam.issues,
    };
  });

  // 一次性导入：解析 + 删除该文档的旧题 + 插入新题
  ipcMain.handle(
    'exam:importToDb',
    async (_e, docId: number, markdown: string, lang?: string) => {
      const { parseExamMarkdown } = await import(
        '../../shared/exam-parser.js'
      );
      const { parsedExamToQuestions } = await import(
        '../../shared/exam-to-questions.js'
      );
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
    },
  );
}
