import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLabels } from "@/lib/meta";
import { cn } from "@/lib/utils";

/**
 * The campus guide map: every zone is one flat lobe of colour, and the cream page ground between lobes is the
 * "water". Lobes swell with the number of open items in them; hovering or choosing one swells it further and lets
 * the rest recede. The lobes are drawn in one SVG (decorative); the labels are real buttons laid over it.
 */

type Lobe = { id: string; cx: number; cy: number; r: number; seed: number };

// Schematic campus laid out on a 1000 × 700 grid: the three teaching buildings across the top, gyms and canteen in
// the middle, the gate south.
const LOBES: Lobe[] = [
  { id: "building_a", cx: 250, cy: 205, r: 150, seed: 3 },
  { id: "building_b", cx: 560, cy: 160, r: 150, seed: 7 },
  { id: "building_c", cx: 845, cy: 270, r: 150, seed: 11 },
  { id: "sports", cx: 640, cy: 450, r: 150, seed: 13 },
  { id: "dining", cx: 380, cy: 430, r: 150, seed: 5 },
  { id: "boarding", cx: 140, cy: 520, r: 150, seed: 2 },
  { id: "entrance", cx: 420, cy: 610, r: 130, seed: 17 },
  { id: "other", cx: 885, cy: 615, r: 150, seed: 19 },
];

// The frame (still 10:7) is wider than the grid: the busiest zone at full swell (scale 1.22) reaches x −55…1086 and
// y −9…786, and a lobe must never spill onto the controls or card edge around the map.
const VIEW = { x: -56, y: -12, w: 1144, h: 800.8 };
const labelAt = (l: Lobe) => ({ left: `${((l.cx - VIEW.x) / VIEW.w) * 100}%`, top: `${((l.cy - VIEW.y) / VIEW.h) * 100}%` });

export const ZONE_FILL: Record<string, string> = {
  building_a: "var(--color-zone-building-a)",
  building_b: "var(--color-zone-building-b)",
  building_c: "var(--color-zone-building-c)",
  sports: "var(--color-zone-sports)",
  dining: "var(--color-zone-dining)",
  boarding: "var(--color-zone-boarding)",
  entrance: "var(--color-zone-entrance)",
  other: "var(--color-zone-other)",
};

export function zoneFill(zone: string | null | undefined): string {
  return (zone && ZONE_FILL[zone]) || ZONE_FILL.other;
}

/** Deterministic smooth blob: radius wobbles around the centre, then a closed Catmull-Rom curve through it. */
function blobPath(cx: number, cy: number, r: number, seed: number): string {
  const n = 7;
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand() * 0.35;
    const rr = r * (0.82 + rand() * 0.3);
    return [cx + Math.cos(a) * rr * 1.08, cy + Math.sin(a) * rr * 0.9] as const;
  });
  const p = (i: number) => pts[(i + n) % n];
  let d = `M${p(0)[0].toFixed(1)},${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

const PATHS = Object.fromEntries(LOBES.map((l) => [l.id, blobPath(l.cx, l.cy, l.r, l.seed)]));

export function CampusMap({
  counts,
  selected,
  onSelect,
  size = "lg",
  className,
}: {
  counts?: Record<string, number>;
  selected?: string | null;
  onSelect: (zone: string | null) => void;
  size?: "lg" | "sm";
  className?: string;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...Object.values(counts ?? {}));
  const focus = hover ?? selected ?? null;
  const zones = LOBES.filter((l) => labels.meta.zones.some((z) => z.id === l.id));

  const scaleOf = (id: string) => {
    const n = counts?.[id] ?? 0;
    const base = counts ? 0.6 + 0.55 * Math.sqrt(n / max) : 1;
    return base + (focus === id ? 0.07 : 0);
  };

  return (
    <div className={cn("@container relative aspect-[10/7] w-full select-none", className)}>
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} aria-hidden className="absolute inset-0 size-full">
        {zones.map((l) => (
          <path
            key={l.id}
            d={PATHS[l.id]}
            fill={ZONE_FILL[l.id]}
            style={{
              transform: `scale(${scaleOf(l.id)})`,
              transformOrigin: `${l.cx}px ${l.cy}px`,
              opacity: focus && focus !== l.id ? 0.42 : 1,
            }}
            className="transition-[transform,opacity] duration-400 ease-(--ease-swell) motion-reduce:transition-none"
          />
        ))}
      </svg>
      <ul className="absolute inset-0" aria-label={t("map.label")}>
        {zones.map((l) => {
          const n = counts ? (counts[l.id] ?? 0) : undefined;
          const on = selected === l.id;
          // The gate and "other" lobes are smaller, so their names step down a size.
          const minor = l.id === "other" || l.id === "entrance";
          return (
            <li key={l.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={labelAt(l)}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : l.id)}
                onPointerEnter={() => setHover(l.id)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(l.id)}
                onBlur={() => setHover(null)}
                className="group flex flex-col items-center gap-[0.3em] rounded-2xl px-1.5 py-1 text-ink outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {/* Type scales with the map's own width (cqi), so labels keep their size relative to the lobes. */}
                <span
                  className={cn(
                    "leading-[0.95] font-bold tracking-[-0.04em] whitespace-nowrap",
                    size === "lg"
                      ? minor
                        ? "text-[clamp(0.8125rem,3.1cqi,1.25rem)]"
                        : "text-[clamp(0.9375rem,4.4cqi,1.875rem)]"
                      : minor
                        ? "text-[clamp(0.6875rem,2.9cqi,0.9375rem)]"
                        : "text-[clamp(0.75rem,3.7cqi,1.125rem)]",
                  )}
                >
                  <span aria-hidden>{t(`map.short.${l.id}` as "map.short.other")}</span>
                  <span className="sr-only">{labels.zone(l.id)}</span>
                  {size === "sm" && n !== undefined && <span className="tabular ml-[0.3em] font-semibold opacity-70">{n}</span>}
                </span>
                {size === "lg" && n !== undefined && (
                  <span
                    className={cn(
                      "tabular rounded-full px-[0.75em] py-[0.15em] text-[clamp(0.6875rem,2.1cqi,0.875rem)] font-bold whitespace-nowrap transition-colors duration-200",
                      on ? "bg-ink text-cream" : "bg-white/95 group-hover:bg-white",
                    )}
                  >
                    {t("map.count", { count: n })}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
