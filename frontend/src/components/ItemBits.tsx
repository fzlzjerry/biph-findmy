import { Check, MapPin, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { useLang } from "../i18n";
import { categoryIcon } from "../lib/categoryIcon";
import { isLightHex } from "../lib/color";
import { excerpt } from "../lib/hooks";
import { useLabels } from "../lib/meta";
import { formatDateTime, formatRelative, useNow } from "../lib/time";
import type { Item, Reason } from "../lib/types";
import { StatusBadge } from "./ui";

export function itemTitle(item: Item, max = 90): string {
  return item.title?.trim() || excerpt(item.description, max);
}

/** A colour swatch circle. Light colours get a boundary so they never vanish on white. */
export function Swatch({ hex, size = "md", className = "" }: { hex: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "size-3" : size === "lg" ? "size-6" : "size-4";
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full border border-ink/25 ${dims} ${className}`}
      style={{ background: hex }}
    />
  );
}

export function ColorDots({ colors }: { colors: string[] }) {
  const labels = useLabels();
  if (!colors.length) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {colors.map((id) => (
        <Swatch key={id} hex={labels.colorHex(id) ?? "#ccc"} size="sm" />
      ))}
      <span className="sr-only">{colors.map((id) => labels.color(id)).join(", ")}</span>
    </span>
  );
}

/** Photo thumbnail, or the category icon on a tint of the item's first colour. */
export function ItemThumb({ item, alt = "", iconClass = "size-[38%]", useFull = false }: {
  item: Item;
  alt?: string;
  iconClass?: string;
  useFull?: boolean;
}) {
  const labels = useLabels();
  const photo = item.photos[0];
  if (photo) {
    return (
      <img
        src={useFull ? photo.url : photo.thumb_url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }
  const Icon = categoryIcon(item.category);
  const hex = labels.colorHex(item.colors[0]);
  // Dark colours get a lighter wash so a black bottle reads as "grey card", not a heavy block.
  const share = hex ? (isLightHex(hex) ? 34 : 16) : 0;
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: hex ? `color-mix(in oklab, ${hex} ${share}%, var(--color-surface))` : "var(--color-surface)" }}
    >
      <Icon aria-hidden strokeWidth={1.5} className={`text-ink/75 ${iconClass}`} />
      {alt && <span className="sr-only">{alt}</span>}
    </div>
  );
}

export function RelativeTime({ iso, className = "" }: { iso: string; className?: string }) {
  const lang = useLang();
  const now = useNow();
  return (
    <time dateTime={iso} title={formatDateTime(iso, lang)} className={className}>
      {formatRelative(iso, lang, now)}
    </time>
  );
}

export function ItemCard({ item, headingLevel = 3 }: { item: Item; headingLevel?: 2 | 3 }) {
  const labels = useLabels();
  const location = useLocation();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const place = item.locations[0];
  return (
    <Link
      to={`/items/${item.id}`}
      state={{ from: location.pathname + location.search }}
      className="group flex w-full min-w-0 flex-col overflow-hidden rounded-md border border-line bg-water transition-colors duration-200 hover:border-line-strong"
    >
      <div className="aspect-[4/3] overflow-hidden bg-surface">
        <ItemThumb item={item} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-3.5">
        <div>
          <StatusBadge kind={item.kind} status={item.status} />
        </div>
        <Heading className="line-clamp-2 break-words text-[0.9375rem] font-semibold leading-snug text-ink group-hover:text-brand-deep group-hover:underline group-hover:underline-offset-2">
          {itemTitle(item, 80)}
        </Heading>
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
          <ColorDots colors={item.colors} />
          <span className="truncate">{labels.category(item.category)}</span>
        </p>
        <p className="mt-auto flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-muted">
          {place && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{labels.place(place)}</span>
            </span>
          )}
          {place && <span aria-hidden>·</span>}
          <RelativeTime iso={item.created_at} />
        </p>
      </div>
    </Link>
  );
}

/** Small horizontal meter: fill in deep current indigo on a mist track (same ramp). */
export function ProbabilityMeter({ value }: { value: number }) {
  const { t } = useTranslation();
  // Never show 100%: a match is evidence, not proof — people should still check the photo and details.
  const pct = Math.max(1, Math.min(99, Math.round(value * 100)));
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={t("item.likelihood", { value: pct })}
        aria-label={t("item.likelihoodLabel")}
        className="block h-1.5 w-16 overflow-hidden rounded-full bg-mist sm:w-20"
      >
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(4, pct)}%` }} />
      </span>
      <span aria-hidden className="text-sm font-semibold text-ink">
        {pct}%
      </span>
    </span>
  );
}

/** Match reasons in the current language; evidence for vs against is shown by icon + style, not colour alone. */
export function ReasonChips({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation();
  const lang = useLang();
  if (!reasons.length) return null;
  return (
    <ul aria-label={t("item.reasons")} className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => {
        const positive = reason.contribution >= 0;
        const Icon = positive ? Check : Minus;
        return (
          <li
            key={`${reason.code}-${reason.feature}`}
            className={`inline-flex max-w-full items-start gap-1 rounded-xs px-2 py-1 text-[0.8125rem] font-medium leading-snug ${
              positive ? "bg-mist text-brand-deep" : "border border-alert/50 bg-alert-soft text-alert-deep"
            }`}
          >
            <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
            <span className="sr-only">{positive ? t("item.reasonFor") : t("item.reasonAgainst")}</span>
            <span className="break-words">{reason[lang] || reason.en}</span>
          </li>
        );
      })}
    </ul>
  );
}
