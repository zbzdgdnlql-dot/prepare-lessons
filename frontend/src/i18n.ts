import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhTranslation from './locales/zh/translation.json';
import frTranslation from './locales/fr/translation.json';
import esTranslation from './locales/es/translation.json';
import deTranslation from './locales/de/translation.json';

const resources = {
  zh: { translation: zhTranslation },
  fr: { translation: frTranslation },
  es: { translation: esTranslation },
  de: { translation: deTranslation }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
