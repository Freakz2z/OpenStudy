import type { AppSettings } from '../../shared/types.js';
import { getLLMProviderPreset } from '../../shared/llm-provider-presets.js';
import { DEFAULT_SHORTCUTS, normalizeShortcutSettings } from '../../shared/shortcuts.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureParentDir, resolveAppDataDir } from './runtime-paths.js';

const deepseekPreset = getLLMProviderPreset('deepseek');
const DEFAULTS: AppSettings = {
  llm: {
    provider: deepseekPreset.provider,
    baseUrl: deepseekPreset.baseUrl,
    model: deepseekPreset.model,
  },
  shortcuts: DEFAULT_SHORTCUTS,
};

const SETTINGS_PATH = join(resolveAppDataDir(), 'settings.json');

function normalizeSettings(raw?: Partial<AppSettings> | null): AppSettings {
  return {
    llm: {
      ...DEFAULTS.llm,
      ...(raw?.llm ?? {}),
    },
    shortcuts: normalizeShortcutSettings(raw?.shortcuts ?? DEFAULTS.shortcuts),
  };
}

function readStore(): AppSettings {
  try {
    if (!existsSync(SETTINGS_PATH)) return DEFAULTS;
    const raw = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Partial<AppSettings>;
    return normalizeSettings(raw);
  } catch {
    return DEFAULTS;
  }
}

function writeStore(settings: AppSettings): AppSettings {
  const normalized = normalizeSettings(settings);
  ensureParentDir(SETTINGS_PATH);
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export function getSettings(): AppSettings {
  return readStore();
}

export function updateSettings(s: AppSettings): AppSettings {
  return writeStore(s);
}
