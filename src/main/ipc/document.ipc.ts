import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
  listDocuments,
  getDocument,
  deleteDocument,
  updateDocument,
  insertDocumentFromMarkdown,
} from '../services/db.js';
import {
  DOCUMENT_IMPORT_FILTERS,
  importDocumentFromFile,
} from '../services/document-service.js';

export function registerDocumentIpc(): void {
  ipcMain.handle('document:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('no window');
    const result = await dialog.showOpenDialog(win, {
      title: '选择文档',
      properties: ['openFile'],
      filters: DOCUMENT_IMPORT_FILTERS,
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return importDocumentFromFile(result.filePaths[0]);
  });

  ipcMain.handle('document:list', () => listDocuments());

  ipcMain.handle('document:get', (_e, id: number) => getDocument(id));

  ipcMain.handle('document:delete', (_e, id: number) => {
    deleteDocument(id);
    return { ok: true };
  });

  ipcMain.handle(
    'document:createFromMarkdown',
    (_e, title: string, markdown: string, description?: string) =>
      insertDocumentFromMarkdown(title, markdown, description),
  );

  ipcMain.handle(
    'document:update',
    (_e, id: number, patch: { title?: string; description?: string | null }) =>
      updateDocument(id, patch),
  );
}
