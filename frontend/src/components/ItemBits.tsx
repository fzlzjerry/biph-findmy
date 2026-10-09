import { Check, MapPin, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { StatusBadge } from "@/components/badges";
import { Card } from "@/components/ui/card";
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

/** Photo thumbnail, or the category icon on a neutral tile when there is no photo. */
export function ItemThumb({ item, alt = "", iconClass = "size-1/3", useFull = false }: {
  item: Item;
  alt?: string;
  iconClass?: string;
  useFull?: boolean;
}) {
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
    <div className="flex size-full items-center justify-center bg-muted">
      <Icon aria-hidden strokeWidth={1.5} className={cn("text-muted-foreground/70", iconClass)} />
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
  return (
    <Link
      to={`/items/${item.id}`}
      state={{ from: location.pathname + location.search }}
      className="group flex w-full min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="w-full gap-0 py-0 transition-shadow group-hover:shadow-md">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          <ItemThumb item={item} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
          <div>
            <StatusBadge kind={item.kind} status={item.status} />
          </div>
          <Heading className="line-clamp-2 font-medium leading-snug break-words group-hover:underline group-hover:underline-offset-2">
            {itemTitle(item, 80)}
          </Heading>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <ColorDots colors={item.colors} />
            <span className="truncate">{labels.category(item.category)}</span>
          </p>
          <p className="mt-auto flex min-w-0 flex-wrap items-center gap-x-1.5 pt-1 text-xs text-muted-foreground">
            {place && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin aria-hidden className="size-3 shrink-0" />
                <span className="truncate">{labels.place(place)}</span>
              </span>
            )}
            {place && <span aria-hidden>·</span>}
            <RelativeTime iso={item.created_at} />
          </p>
        </div>
      </Card>
    </Link>
  );
}

/** Small horizontal meter for match likelihood. Never 100%: a match is evidence, not proof. */
export function ProbabilityMeter({ value }: { value: number }) {
  const { t } = useTranslation();
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
        className="block h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:w-20"
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(4, pct)}%` }} />
      </span>
      <span aria-hidden className="text-sm font-medium tabular-nums">
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
            className={cn(
              "inline-flex max-w-full items-start gap-1 rounded-md border px-2 py-0.5 text-xs leading-5 font-medium",
              positive ? "bg-muted/50 text-foreground" : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            <Icon aria-hidden className={cn("mt-[3px] size-3.5 shrink-0", positive && "text-emerald-600")} strokeWidth={2.5} />
            <span className="sr-only">{positive ? t("item.reasonFor") : t("item.reasonAgainst")}</span>
            <span className="break-words">{reason[lang] || reason.en}</span>
          </li>
        );
      })}
    </ul>
  );
}
