import { ipcMain } from 'electron';
import { getSettings, updateSettings } from '../services/store.js';
import type { AppSettings } from '../../shared/types.js';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => getSettings());
  ipcMain.handle('settings:update', (_e, s: AppSettings) => updateSettings(s));
}
