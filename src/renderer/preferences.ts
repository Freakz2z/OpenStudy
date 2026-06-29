export type ThemeMode = 'light' | 'dark' | 'system';
export type Lang = 'en' | 'zh';

export interface Prefs {
  theme: ThemeMode;
  lang: Lang;
}

export const PREFS_STORAGE_KEY = 'openstudy-prefs';

const DEFAULT_PREFS: Prefs = { theme: 'system', lang: 'zh' };

export function readPrefs(): Prefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) ?? '{}') as Partial<Prefs>;
    return {
      theme: ['light', 'dark', 'system'].includes(parsed.theme ?? '')
        ? (parsed.theme as ThemeMode)
        : DEFAULT_PREFS.theme,
      lang: ['zh', 'en'].includes(parsed.lang ?? '')
        ? (parsed.lang as Lang)
        : DEFAULT_PREFS.lang,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // 存储不可用时仍允许本次会话正常切换。
  }
}

export function applyTheme(theme: ThemeMode): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
