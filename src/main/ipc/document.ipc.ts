import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
  listDocuments,
  getDocument,
  deleteDocument,
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
}
