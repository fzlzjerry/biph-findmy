import { Check, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { StatusBadge } from "@/components/badges";
import { zoneFill } from "@/components/CampusMap";
import { useLang } from "@/i18n";
import { categoryIcon } from "@/lib/categoryIcon";
import { excerpt } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import { formatDateTime, formatRelative, useNow } from "@/lib/time";
import type { Item, Reason } from "@/lib/types";
import { cn } from "@/lib/utils";

export function itemTitle(item: Item, max = 90): string {
  return item.title?.trim() || excerpt(item.description, max);
}

/** A colour swatch circle with a hairline boundary, so white and light grey never vanish on white. */
export function Swatch({ hex, size = "md", className }: { hex: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "size-2.5" : size === "lg" ? "size-5" : "size-3.5";
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full border border-black/15", dims, className)}
      style={{ background: hex }}
    />
  );
}

export function ColorDots({ colors }: { colors: string[] }) {
  const labels = useLabels();
  if (!colors.length) return null;
  return (
    <span className="inline-flex shrink-0 items-center -space-x-0.5">
      {colors.map((id) => (
        <Swatch key={id} hex={labels.colorHex(id) ?? "#ccc"} size="sm" className="ring-1 ring-background" />
      ))}
      <span className="sr-only">{colors.map((id) => labels.color(id)).join(", ")}</span>
    </span>
  );
}

/** The campus zone an item belongs to (by its first place), for its colour. */
export function useItemZone(item: Item): string | undefined {
  const labels = useLabels();
  const place = item.locations[0];
  return place ? labels.zoneOfPlace(place)?.id : undefined;
}

/** Photo thumbnail, or the category icon on its campus zone's colour when there is no photo. */
export function ItemThumb({ item, alt = "", iconClass = "size-1/3", useFull = false }: {
  item: Item;
  alt?: string;
  iconClass?: string;
  useFull?: boolean;
}) {
  const zone = useItemZone(item);
  const photo = item.photos[0];
  if (photo) {
    return (
      <img
        src={useFull ? photo.url : photo.thumb_url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
    );
  }
  const Icon = categoryIcon(item.category);
  return (
    <div className="flex size-full items-center justify-center" style={{ background: zoneFill(zone) }}>
      <Icon aria-hidden strokeWidth={1.6} className={cn("text-ink", iconClass)} />
      {alt && <span className="sr-only">{alt}</span>}
    </div>
  );
}

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
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
  const settled = item.status !== "open";
  return (
    <Link
      to={`/items/${item.id}`}
      state={{ from: location.pathname + location.search }}
      className="group flex w-full min-w-0 items-center gap-4 rounded-[1.25rem] bg-card p-3.5 pr-4 shadow-[0_1px_2px_rgb(44_46_42/0.06)] transition-[box-shadow,transform] duration-200 ease-(--ease-out-expo) outline-none hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgb(44_46_42/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <div className="size-16 shrink-0 overflow-hidden rounded-full">
        <ItemThumb item={item} iconClass="size-7" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Heading className="line-clamp-2 text-[1.0625rem] leading-snug font-semibold break-words">{itemTitle(item, 80)}</Heading>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {place && <span className="truncate font-medium text-foreground/80">{labels.place(place)}</span>}
          {place && <span aria-hidden>·</span>}
          <RelativeTime iso={item.created_at} />
        </p>
        <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <ColorDots colors={item.colors} />
          <span className="truncate">{labels.category(item.category)}</span>
          {settled && <StatusBadge kind={item.kind} status={item.status} />}
        </p>
      </div>
    </Link>
  );
}

/** Match strength on a fixed four-dot ramp. Never "certain": a match is evidence, not proof. */
export function ProbabilityMeter({ value }: { value: number }) {
  const { t } = useTranslation();
  const pct = Math.max(1, Math.min(99, Math.round(value * 100)));
  const lit = value >= 0.85 ? 4 : value >= 0.6 ? 3 : value >= 0.35 ? 2 : 1;
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={t("item.likelihood", { value: pct })}
      aria-label={t("item.likelihoodLabel")}
      title={t("item.likelihood", { value: pct })}
      className="inline-flex items-center gap-1"
    >
      {[1, 2, 3, 4].map((dot) => (
        <span key={dot} className={cn("size-2.5 rounded-full", dot <= lit ? "bg-ink" : "bg-ink/15")} />
      ))}
    </span>
  );
}

/** Match reasons in the current language as one plain line; evidence against reads in coral text with a minus. */
export function ReasonChips({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation();
  const lang = useLang();
  if (!reasons.length) return null;
  const sorted = [...reasons].sort((a, b) => Number(b.contribution >= 0) - Number(a.contribution >= 0));
  return (
    <ul aria-label={t("item.reasons")} className="flex flex-wrap items-baseline gap-x-0 gap-y-1 text-[0.9375rem] leading-relaxed">
      {sorted.map((reason, index) => {
        const positive = reason.contribution >= 0;
        const Icon = positive ? Check : Minus;
        return (
          <li key={`${reason.code}-${reason.feature}`} className={cn("inline-flex items-baseline", !positive && "font-medium text-destructive")}>
            <Icon aria-hidden className={cn("mr-1 size-3.5 shrink-0 self-center", positive ? "text-success" : "")} strokeWidth={3} />
            <span className="sr-only">{positive ? t("item.reasonFor") : t("item.reasonAgainst")}</span>
            <span className="break-words">{reason[lang] || reason.en}</span>
            {index < sorted.length - 1 && (
              <span aria-hidden className="mx-2 text-muted-foreground/60">
                ·
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** An email address that may only wrap at "@" or ".", never in the middle of a word. */
export function Email({ value }: { value: string }) {
  const parts = value.split(/(?=[@.])/);
  return (
    <span className="whitespace-normal">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <wbr />}
          <span className="whitespace-nowrap">{part}</span>
        </span>
      ))}
    </span>
  );
}
