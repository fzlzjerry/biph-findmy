import { useEffect, useRef, useState } from "react";

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

const SITE = "BIPH FindMy";

/** Page titles are announced by screen readers on navigation: "Browse · BIPH FindMy". */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} · 失物招领`;
  }, [title]);
}

/** Seconds left on a countdown that restarts whenever `startedAt` changes. */
export function useCountdown(startedAt: number | null, seconds: number): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (startedAt === null) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil(seconds - (Date.now() - startedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [startedAt, seconds]);
  return left;
}

/** Runs `handler` on mousedown/touchstart outside `ref` while `active`. */
export function useOutsideClick<T extends HTMLElement>(active: boolean, handler: () => void) {
  const ref = useRef<T>(null);
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  useEffect(() => {
    if (!active) return;
    const listener = (event: Event) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handlerRef.current();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener, { passive: true });
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [active]);
  return ref;
}

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, WeChat quirks) — not essential */
  }
}

export function excerpt(text: string, max = 90): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Only allow same-site relative redirects after login (no open redirects). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/login")) return "/";
  return next;
}
