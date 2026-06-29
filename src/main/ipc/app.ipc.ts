import { ipcMain } from 'electron';
import { checkLatestRelease, getAppMeta } from '../services/app-meta.js';

export function registerAppIpc(): void {
  ipcMain.handle('app:ping', () => 'pong');
  ipcMain.handle('app:getMeta', () => getAppMeta());
  ipcMain.handle('app:checkLatestRelease', (_event, force?: boolean) =>
    checkLatestRelease(Boolean(force)),
  );
}
