import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  applyTheme,
  readPrefs,
  writePrefs,
  type Lang,
  type Prefs,
  type ThemeMode,
} from '../preferences';

interface PreferencesContextValue extends Prefs {
  setTheme: (theme: ThemeMode) => void;
  setLang: (lang: Lang) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);

  useEffect(() => {
    applyTheme(prefs.theme);
    writePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (i18n.language !== prefs.lang) void i18n.changeLanguage(prefs.lang);
  }, [i18n, prefs.lang]);

  const setTheme = useCallback((theme: ThemeMode) => {
    applyTheme(theme);
    setPrefs((current) => ({ ...current, theme }));
  }, []);

  const setLang = useCallback((lang: Lang) => {
    setPrefs((current) => ({ ...current, lang }));
    void i18n.changeLanguage(lang);
  }, [i18n]);

  const value = useMemo(
    () => ({ ...prefs, setTheme, setLang }),
    [prefs, setLang, setTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used within PreferencesProvider');
  return value;
}
