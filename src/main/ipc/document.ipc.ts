import { ipcMain, dialog, BrowserWindow } from 'electron';
import { basename, extname } from 'node:path';
import { stat } from 'node:fs/promises';
import {
  insertDocument,
  listDocuments,
  getDocument,
  deleteDocument,
} from '../services/db.js';
import type { FileType } from '../../shared/types.js';

const EXT_MAP: Record<string, FileType> = {
  '.txt': 'txt',
  '.md': 'md',
  '.markdown': 'md',
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.pptx': 'pptx',
};

function fileTypeOf(filePath: string): FileType | null {
  const ext = extname(filePath).toLowerCase();
  return EXT_MAP[ext] ?? null;
}

export function registerDocumentIpc(): void {
  ipcMain.handle('document:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error('no window');
    const result = await dialog.showOpenDialog(win, {
      title: '选择文档',
      properties: ['openFile'],
      filters: [
        { name: '支持的文件', extensions: ['txt', 'md', 'markdown', 'pdf', 'docx', 'pptx'] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const fileType = fileTypeOf(filePath);
    if (!fileType) throw new Error(`不支持的文件类型: ${filePath}`);
    await stat(filePath); // 校验文件存在
    const title = basename(filePath, extname(filePath));
    return insertDocument(filePath, fileType, title);
  });

  ipcMain.handle('document:list', () => listDocuments());

  ipcMain.handle('document:get', (_e, id: number) => getDocument(id));

  ipcMain.handle('document:delete', (_e, id: number) => {
    deleteDocument(id);
    return { ok: true };
  });
}
