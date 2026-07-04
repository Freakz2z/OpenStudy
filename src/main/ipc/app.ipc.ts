import { ipcMain, app, shell } from 'electron';
import { cp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { checkLatestRelease, getAppMeta } from '../services/app-meta.js';

const REPO_URL = 'https://github.com/Freakz2z/OpenStudy';

function getSkillSrcDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'skills', 'openstudy');
  }
  return join(app.getAppPath(), '.claude', 'skills', 'openstudy');
}

export function registerAppIpc(): void {
  ipcMain.handle('app:ping', () => 'pong');
  ipcMain.handle('app:getMeta', () => getAppMeta());
  ipcMain.handle('app:checkLatestRelease', (_event, force?: boolean) =>
    checkLatestRelease(Boolean(force)),
  );

  ipcMain.handle('app:installSkill', async () => {
    const srcDir = getSkillSrcDir();
    const destDir = join(homedir(), '.claude', 'skills', 'openstudy');
    await cp(srcDir, destDir, { recursive: true });
    return { ok: true, path: destDir };
  });

  ipcMain.handle('app:openCliPage', async () => {
    await shell.openExternal(`${REPO_URL}/releases`);
    return { ok: true };
  });
}
