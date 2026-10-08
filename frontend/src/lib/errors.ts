import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import en from "../i18n/en";
import { ApiError } from "./api";

type ErrorCode = keyof typeof en.errors;

function isKnownCode(code: string): code is ErrorCode {
  return Object.prototype.hasOwnProperty.call(en.errors, code);
}

export function errorCode(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  return "unknown_error";
}

/** Maps backend error codes (e.g. `claim_already_pending`) to friendly text in the current language. */
export function useErrorText() {
  const { t } = useTranslation();
  return useCallback(
    (error: unknown): string => {
      const code = errorCode(error);
      if (isKnownCode(code)) return t(`errors.${code}`);
      if (code.startsWith("photo_")) return t("errors.photo_unreadable");
      return t("errors.withCode", { code });
    },
    [t],
  );
}
