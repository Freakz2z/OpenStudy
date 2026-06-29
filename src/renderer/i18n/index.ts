import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';
import { readPrefs } from '../preferences';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: readPrefs().lang,
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

// 切换语言
export function setLanguage(lang: 'en' | 'zh') {
  i18n.changeLanguage(lang);
}

export function getLanguage(): string {
  return i18n.language;
}
