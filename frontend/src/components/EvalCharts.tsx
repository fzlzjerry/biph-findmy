// The Data Science Club's evaluation, drawn in the app's own style (ink on white, sizes not colours) so the About
// page reads in either language. Plain HTML + one SVG: no chart library on a page students open.
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EVAL_METHODS, LOOKALIKES, SHIPPED_METHOD } from "@/lib/evalResults";
import { cn } from "@/lib/utils";

const pct = (share: number) => `${Math.round(share * 100)}%`;

function Legend({ items }: { items: { label: string; swatch: ReactNode }[] }) {
  return (
    <ul aria-hidden className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-2">
          {item.swatch}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** How often each method puts the right found item first (solid) and in the top three (faint tail). */
export function MethodsChart() {
  const { t } = useTranslation();
  const rows = [...EVAL_METHODS].sort((a, b) => b.first - a.first);
  const label = (id: string) => t(`about.method.${id}` as "about.method.random");
  const summary = `${t("about.chartMethodsTitle")}: ${rows
    .map((r) => `${label(r.id)} ${pct(r.first)} ${t("about.chartFirst")}, ${pct(r.top3)} ${t("about.chartTop3")}`)
    .join("; ")}`;
  return (
    <div className="space-y-4">
      <ol role="img" aria-label={summary} className="space-y-3">
        {rows.map((row) => {
          const shipped = row.id === SHIPPED_METHOD;
          return (
            <li key={row.id}>
              <p className={cn("text-sm leading-snug", shipped ? "font-semibold" : "text-foreground/80")}>
                {label(row.id)}
                {shipped && <span className="font-normal text-muted-foreground"> · {t("about.chartShipped")}</span>}
              </p>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-ink/20" style={{ width: pct(row.top3) }} />
                  <div className={cn("absolute inset-y-0 left-0 rounded-full", shipped ? "bg-ink" : "bg-ink/70")} style={{ width: pct(row.first) }} />
                </div>
                <span className={cn("tabular w-10 shrink-0 text-right text-sm", shipped ? "font-bold" : "font-semibold")}>{pct(row.first)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <Legend
        items={[
          { label: t("about.chartFirst"), swatch: <span className="h-2.5 w-5 rounded-full bg-ink" /> },
          { label: t("about.chartTop3"), swatch: <span className="h-2.5 w-5 rounded-full bg-ink/20" /> },
        ]}
      />
    </div>
  );
}

// The baseline recedes in a lighter ink that still clears 3:1 on white.
const BASELINE = "color-mix(in oklab, var(--muted-foreground) 75%, white)";
const SERIES = [
  { key: "withMark", stroke: "var(--ink)", dash: undefined, dot: "bg-ink" },
  { key: "withoutMark", stroke: "var(--ink)", dash: "5 4", dot: "border-2 border-ink bg-card" },
  { key: "catColor", stroke: BASELINE, dash: "1.5 4", dot: "bg-(--baseline)" },
] as const;

/** Ranked-first rate as look-alikes are added: reports naming a distinguishing mark hold up best. */
export function LookalikeChart() {
  const { t } = useTranslation();
  const counts = LOOKALIKES.counts;
  const x = (i: number) => (i / (counts.length - 1)) * 100;
  const y = (share: number) => 100 - share * 100;
  const seriesLabel = {
    withMark: t("about.seriesWithMark"),
    withoutMark: t("about.seriesWithoutMark"),
    catColor: t("about.method.catColor"),
  };
  const summary = `${t("about.chartLookalikeTitle")} ${SERIES.map(
    (s) => `${seriesLabel[s.key]}: ${LOOKALIKES[s.key].map((v, i) => `${counts[i]} → ${pct(v)}`).join(", ")}`,
  ).join("; ")}`;

  return (
    <div className="space-y-4">
      <div role="img" aria-label={summary} style={{ "--baseline": BASELINE } as CSSProperties}>
        <div className="flex gap-2">
          {/* y axis: share ranked first */}
          <div aria-hidden className="relative h-48 w-9 shrink-0 text-right text-xs text-muted-foreground tabular sm:h-56">
            {[100, 75, 50, 25, 0].map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - v}%` }}>
                {v}%
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div aria-hidden className="relative h-48 sm:h-56">
              {[100, 75, 50, 25, 0].map((v) => (
                <span key={v} className={cn("absolute inset-x-0 border-t", v === 0 ? "border-input" : "border-border/70")} style={{ top: `${100 - v}%` }} />
              ))}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                {SERIES.map((s) => (
                  <polyline
                    key={s.key}
                    points={LOOKALIKES[s.key].map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                    fill="none"
                    stroke={s.stroke}
                    strokeWidth={2.5}
                    strokeDasharray={s.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
              {SERIES.flatMap((s) =>
                LOOKALIKES[s.key].map((v, i) => (
                  <span
                    key={`${s.key}-${i}`}
                    className={cn("absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", s.dot)}
                    style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
                  />
                )),
              )}
            </div>
            {/* x axis: look-alikes in the pool */}
            <div aria-hidden className="relative mt-2 h-4 text-xs text-muted-foreground tabular">
              {counts.map((count, i) => (
                <span key={count} className="absolute -translate-x-1/2" style={{ left: `${x(i)}%` }}>
                  {count}
                </span>
              ))}
            </div>
            <p aria-hidden className="mt-2 text-center text-xs text-muted-foreground">
              {t("about.chartLookalikeX")}
            </p>
          </div>
        </div>
      </div>
      <Legend
        items={SERIES.map((s) => ({
          label: seriesLabel[s.key],
          swatch: (
            <svg viewBox="0 0 22 10" className="h-2.5 w-[22px] shrink-0 overflow-visible">
              <line x1="1" y1="5" x2="21" y2="5" stroke={s.stroke} strokeWidth={2.5} strokeDasharray={s.dash} strokeLinecap="round" />
            </svg>
          ),
        }))}
      />
    </div>
  );
}
