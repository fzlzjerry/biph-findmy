import { useSyncExternalStore } from "react";
import type { Lang } from "./types";

/** Campus time. China has no daylight saving, so the offset is a constant +08:00. */
export const TZ = "Asia/Shanghai";
const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const localeOf = (lang: Lang) => (lang === "zh" ? "zh-CN" : "en-US");

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(lang: Lang, name: string, options: Intl.DateTimeFormatOptions) {
  const key = `${lang}:${name}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(localeOf(lang), { timeZone: TZ, ...options });
    formatters.set(key, fmt);
  }
  return fmt;
}

function dayNumber(ms: number) {
  return Math.floor((ms + OFFSET_MS) / DAY_MS);
}

function sameYear(a: Date, b: Date) {
  return new Date(a.getTime() + OFFSET_MS).getUTCFullYear() === new Date(b.getTime() + OFFSET_MS).getUTCFullYear();
}

/** "Wed, Oct 8, 8:30 AM" · "10月8日周三 08:30" (always Shanghai time). */
export function formatDateTime(iso: string, lang: Lang): string {
  const date = new Date(iso);
  const withYear = !sameYear(date, new Date());
  return formatter(lang, withYear ? "dty" : "dt", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(date);
}

export function formatDate(iso: string, lang: Lang): string {
  return formatter(lang, "d", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function formatTime(iso: string, lang: Lang): string {
  return formatter(lang, "t", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** A lost window: "Mon, Oct 6, 3:00 PM – 5:00 PM" on one day, full dates otherwise. */
export function formatWindow(fromIso: string, toIso: string | null, lang: Lang): string {
  if (!toIso) return formatDateTime(fromIso, lang);
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Math.abs(to - from) < 60_000) return formatDateTime(fromIso, lang);
  const end = dayNumber(from) === dayNumber(to) ? formatTime(toIso, lang) : formatDateTime(toIso, lang);
  return `${formatDateTime(fromIso, lang)} – ${end}`;
}

const relativeFormatters = new Map<Lang, Intl.RelativeTimeFormat>();

/** "3 hours ago", "yesterday", "3 天前" — calendar days are counted in Shanghai. */
export function formatRelative(iso: string, lang: Lang, now: number = Date.now()): string {
  let rtf = relativeFormatters.get(lang);
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(localeOf(lang), { numeric: "auto" });
    relativeFormatters.set(lang, rtf);
  }
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return rtf.format(0, "second");
  if (abs < 45 * 60) return rtf.format(Math.round(diffSec / 60), "minute");
  const days = dayNumber(then) - dayNumber(now);
  if (days === 0 || abs < 6 * 3600) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  if (Math.abs(days) < 30) return rtf.format(Math.round(days / 7), "week");
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}

// --------------------------------------------------------------------------- <input type="datetime-local">
// Inputs are read and written as Shanghai wall-clock time, whatever the device's time zone is.

const pad = (n: number) => String(n).padStart(2, "0");

export function toInputValue(date: Date): string {
  const d = new Date(date.getTime() + OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function inputToDate(value: string): Date | null {
  const m = INPUT_RE.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - OFFSET_MS);
}

/** ISO 8601 with an explicit offset, e.g. "2026-10-08T15:30:00+08:00" (what the API expects). */
export function inputToIso(value: string): string | null {
  const m = INPUT_RE.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+08:00` : null;
}

/** Shanghai date `daysAgo` days back, at `hour`:`minute` — used for the "Last had it" quick picks. */
export function shanghaiAt(daysAgo: number, hour: number, minute = 0): string {
  const today = dayNumber(Date.now());
  const ms = (today - daysAgo) * DAY_MS - OFFSET_MS + (hour * 60 + minute) * 60_000;
  return toInputValue(new Date(ms));
}

export function isFuture(value: string, slackMs = 5 * 60_000): boolean {
  const date = inputToDate(value);
  return date !== null && date.getTime() > Date.now() + slackMs;
}

export const deviceIsOnChinaTime = () => new Date().getTimezoneOffset() === -480;

// --------------------------------------------------------------------------- ticking "now"
// One shared minute timer so relative times stay fresh without every card owning an interval.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: number | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
