import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import type { Lang } from "../lib/types";
import en from "./en";
import zh from "./zh";

export const LANG_KEY = "findmy.lang";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

function storedLang(): Lang | null {
  try {
    const value = window.localStorage.getItem(LANG_KEY);
    return value === "en" || value === "zh" ? value : null;
  } catch {
    return null;
  }
}

/** localStorage first, then the browser language (zh* → Chinese), otherwise English. */
export function detectLang(): Lang {
  const stored = storedLang();
  if (stored) return stored;
  const preferred = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean)[0] ?? "";
  return preferred.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function applyDocumentLang(lang: Lang) {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

const initial = detectLang();
applyDocumentLang(initial);

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, zh: { translation: zh } },
  lng: initial,
  fallbackLng: "en",
  supportedLngs: ["en", "zh"],
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
  react: { useSuspense: false },
});

export function setLang(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  applyDocumentLang(lang);
  void i18n.changeLanguage(lang);
}

/** Current UI language as our two-value union (labels from /api/meta are keyed the same way). */
export function useLang(): Lang {
  const { i18n: instance } = useTranslation();
  return instance.language?.startsWith("zh") ? "zh" : "en";
}

export default i18n;
