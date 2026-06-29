import { ipcMain, BrowserWindow } from 'electron';
import {
  listQuestionsByDocument,
  updateQuestion,
  type QuestionUpdate,
} from '../services/db.js';
import {
  clearIdentifyLogs,
  deleteIdentifyLog,
  listIdentifyLogs,
  getDocumentMarkdownById,
  identifyQuestionsForDocument,
  importExamMarkdownToDocument,
  parseExamSource,
  saveDocumentMarkdownById,
} from '../services/question-workflow.js';

export function registerQuestionIpc(): void {
  ipcMain.handle('question:identify', async (event, docId: number, lang?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return identifyQuestionsForDocument(docId, lang, win);
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
  ipcMain.handle('question:getMarkdown', async (_e, docId: number, lang?: string) =>
    getDocumentMarkdownById(docId, lang),
  );

  // 保存用户编辑后的 Markdown
  ipcMain.handle(
    'question:saveMarkdown',
    (_e, docId: number, markdown: string) => saveDocumentMarkdownById(docId, markdown),
  );

  // 新格式：解析标准 Markdown 题目文档
  ipcMain.handle('exam:parse', async (_e, markdown: string, lang?: string) =>
    parseExamSource(markdown, lang),
  );

  // 一次性导入：解析 + 删除该文档的旧题 + 插入新题
  ipcMain.handle(
    'exam:importToDb',
    async (_e, docId: number, markdown: string, lang?: string) => {
      return importExamMarkdownToDocument(docId, markdown, lang);
    },
  );
}
