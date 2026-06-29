import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const APP_DIR_NAME = 'OpenStudy';

export function resolveUserDataDirArg(argv: readonly string[] = process.argv): string | null {
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current) continue;
    if (current.startsWith('--user-data-dir=')) {
      const value = current.slice('--user-data-dir='.length).trim();
      return value || null;
    }
    if (current === '--user-data-dir') {
      const next = argv[index + 1]?.trim();
      if (next && !next.startsWith('--')) {
        return next;
      }
      return null;
    }
  }
  return null;
}

export function resolveAppDataDir(argv: readonly string[] = process.argv): string {
  const cliOverride = resolveUserDataDirArg(argv);
  if (cliOverride) {
    return cliOverride;
  }

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
