import Store from 'electron-store';
import type { AppSettings } from '../../shared/types.js';
import { getLLMProviderPreset } from '../../shared/llm-provider-presets.js';
import { DEFAULT_SHORTCUTS, normalizeShortcutSettings } from '../../shared/shortcuts.js';

const deepseekPreset = getLLMProviderPreset('deepseek');
const DEFAULTS: AppSettings = {
  llm: {
    provider: deepseekPreset.provider,
    baseUrl: deepseekPreset.baseUrl,
    model: deepseekPreset.model,
  },
  shortcuts: DEFAULT_SHORTCUTS,
};

let store: Store<AppSettings> | null = null;

function getStore(): Store<AppSettings> {
  if (!store) store = new Store<AppSettings>({ defaults: DEFAULTS });
  return store;
}

export function getSettings(): AppSettings {
  const stored = getStore().store;
  return {
    ...stored,
    shortcuts: normalizeShortcutSettings(stored.shortcuts),
  };
}

export function updateSettings(s: AppSettings): AppSettings {
  const st = getStore();
  st.store = {
    ...s,
    shortcuts: normalizeShortcutSettings(s.shortcuts),
  };
  return st.store;
}
