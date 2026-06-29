import { ipcMain } from 'electron';
import {
  saveAttempt,
  listWrongQuestions,
  listLatestAttemptsByDocument,
  listRecentAttempts,
  deleteAttemptsForQuestion,
  clearAllAttempts,
  clearDocumentAttempts,
  getDocumentStats,
  getOverallStats,
} from '../services/db.js';

export function registerAttemptIpc(): void {
  ipcMain.handle(
    'attempt:save',
    (_e, qId: number, userAnswer: string, isCorrect: boolean) => {
      saveAttempt(qId, userAnswer, isCorrect);
      return { ok: true };
    },
  );

  ipcMain.handle('attempt:listWrong', () => listWrongQuestions());
  ipcMain.handle('attempt:listByDocument', (_e, docId: number) =>
    listLatestAttemptsByDocument(docId),
  );
  ipcMain.handle('attempt:listRecent', (_e, limit?: number) =>
    listRecentAttempts(limit),
  );

  ipcMain.handle('attempt:removeWrong', (_e, qId: number) => {
    deleteAttemptsForQuestion(qId);
    return { ok: true };
  });

  ipcMain.handle('attempt:clearAll', () => {
    const n = clearAllAttempts();
    return { ok: true, removed: n };
  });

  ipcMain.handle('attempt:clearDocument', (_e, docId: number) => {
    const n = clearDocumentAttempts(docId);
    return { ok: true, removed: n };
  });

  ipcMain.handle('stats:document', (_e, docId: number) => getDocumentStats(docId));
  ipcMain.handle('stats:overall', () => getOverallStats());
}
