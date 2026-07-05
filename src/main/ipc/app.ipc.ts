import { ipcMain, app, shell } from 'electron';
import { cp } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { exec, spawn } from 'node:child_process';
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

function getSkillDestDir(): string {
  return join(homedir(), '.claude', 'skills', 'openstudy');
}

export function registerAppIpc(): void {
  ipcMain.handle('app:ping', () => 'pong');
  ipcMain.handle('app:getMeta', () => getAppMeta());
  ipcMain.handle('app:checkLatestRelease', (_event, force?: boolean) =>
    checkLatestRelease(Boolean(force)),
  );

  ipcMain.handle('app:installSkill', async () => {
    const srcDir = getSkillSrcDir();
    const destDir = getSkillDestDir();
    await cp(srcDir, destDir, { recursive: true });
    return { ok: true, path: destDir };
  });

  ipcMain.handle('app:checkSkillInstalled', async () => {
    try {
      await access(getSkillDestDir());
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('app:checkCliInstalled', async () => {
    // first check if skill dir exists (CLI is part of the skill)
    try {
      await access(getSkillDestDir());
      return true;
    } catch {
      // then check if openstudy is in PATH
      return new Promise<boolean>((resolve) => {
        exec('command -v openstudy', (err, stdout) => {
          if (err) { resolve(false); return; }
          resolve(stdout.trim().length > 0);
        });
      });
    }
  });

  ipcMain.handle('app:installCli', () => {
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const child = spawn('npm', ['install', '-g', 'openstudy'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, error: stderr || stdout || `Exit code ${code}` });
        }
      });

      child.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
    });
  });

  ipcMain.handle('app:openCliPage', async () => {
    await shell.openExternal(`${REPO_URL}/releases`);
    return { ok: true };
  });
}
