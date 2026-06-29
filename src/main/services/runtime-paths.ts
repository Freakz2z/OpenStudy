import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const APP_DIR_NAME = 'OpenStudy';

export function resolveAppDataDir(): string {
  if (process.env.OPENSTUDY_DATA_DIR?.trim()) {
    return process.env.OPENSTUDY_DATA_DIR.trim();
  }

  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', APP_DIR_NAME);
  }

  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), APP_DIR_NAME);
  }

  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), APP_DIR_NAME);
}

export function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

export function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}
