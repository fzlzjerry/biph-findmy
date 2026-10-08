// Hand-rolled SVG charts for the front-desk stats (no chart library).
// Mark specs follow the club's data-viz rules: bars <= 24px thick with a 4px rounded data end and a square
// baseline, hairline solid gridlines, 2px surface gaps between touching bars, text in text tokens (never the
// series colour), a legend for >= 2 series, hover tooltips as enhancement and a table view for every chart.
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

const INK = "var(--color-ink)";
const MUTED = "var(--color-muted)";
const LINE = "var(--color-line)";

export const SERIES = {
  found: "var(--color-series-1)",
  lost: "var(--color-series-2)",
  returned: "var(--color-series-3)",
} as const;

function useWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    setWidth(node.getBoundingClientRect().width);
    observer.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.current.observe(node);
  }, []);
  return [ref, width];
}

/** Bar with a 4px rounded data end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number, direction: "right" | "up"): string {
  const r = Math.min(4, direction === "right" ? w : h, direction === "right" ? h / 2 : w / 2);
  if (direction === "right") {
    const x1 = x + w;
    return `M${x},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x}Z`;
  }
  const y0 = y;
  return `M${x},${y + h}V${y0 + r}Q${x},${y0} ${x + r},${y0}H${x + w - r}Q${x + w},${y0} ${x + w},${y0 + r}V${y + h}Z`;
}

function niceMax(value: number): { max: number; step: number } {
  if (value <= 0) return { max: 4, step: 1 };
  const rough = value / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return { max: Math.ceil(value / step) * step, step };
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xs bg-ink px-2.5 py-1.5 text-sm text-water"
      style={{ left: x, top: y - 6 }}
    >
      {children}
    </div>
  );
}

// --------------------------------------------------------------------------- figure + table view
export function ChartFigure({ title, lead, children, table }: {
  title: string;
  lead?: string;
  children: ReactNode;
  table: ReactNode;
}) {
  const { t } = useTranslation();
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="min-w-0 rounded-md border border-line p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span className="min-w-0">
          <span className="block text-base font-semibold text-ink">{title}</span>
          {lead && <span className="mt-0.5 block text-sm text-muted">{lead}</span>}
        </span>
        <button
          type="button"
          aria-pressed={showTable}
          onClick={() => setShowTable((v) => !v)}
          className="-mr-2 inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-semibold text-brand hover:bg-surface"
        >
          {showTable ? t("admin.hideTable") : t("admin.showTable")}
        </button>
      </figcaption>
      <div className="mt-4">{showTable ? table : children}</div>
    </figure>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c, i) => (
              <th key={c} scope="col" className={`py-2 pr-3 font-semibold text-muted ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-line last:border-0">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2 pr-3 font-medium text-ink">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="tabular py-2 pr-3 text-right text-ink">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------- horizontal bars (one series)
export interface BarDatum {
  key: string;
  label: string;
  value: number;
  display?: string;
}

export function HBarChart({ data, label, color = SERIES.found }: { data: BarDatum[]; label: string; color?: string }) {
  const { t } = useTranslation();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <p className="py-6 text-center text-sm text-muted">{t("admin.chartEmpty")}</p>;

  // Narrow screens put each label on its own line above the bar instead of truncating it.
  const stacked = width > 0 && width < 440;
  const barH = 16;
  const labelLine = stacked ? 18 : 0;
  const rowH = stacked ? labelLine + barH + 14 : 30;
  const labelW = stacked ? 0 : Math.min(Math.max(width * 0.38, 96), 176);
  const valueW = 44;
  const x0 = stacked ? 0 : labelW;
  const plotW = Math.max(width - x0 - valueW, 40);
  const max = Math.max(...data.map((d) => d.value), 1);
  const height = data.length * rowH + 4;
  const maxChars = stacked ? 80 : Math.max(6, Math.floor((labelW - 10) / 7.2));
  const summary = `${label}: ${data.map((d) => `${d.label} ${d.display ?? d.value}`).join(", ")}`;

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={summary} className="block overflow-visible">
          {!stacked && <line x1={x0} x2={x0} y1={0} y2={height - 4} stroke={LINE} strokeWidth={1} />}
          {data.map((d, i) => {
            const top = i * rowH;
            const y = stacked ? top + labelLine : top + (rowH - barH) / 2;
            const w = Math.max((d.value / max) * plotW, 2);
            const text = d.label.length > maxChars ? `${d.label.slice(0, maxChars - 1)}…` : d.label;
            return (
              <g key={d.key} onMouseEnter={() => setHover(i)}>
                <rect x={0} y={top} width={width} height={rowH} fill="transparent" />
                {stacked ? (
                  <text x={0} y={top + 12} fontSize={13} fill={INK}>
                    {text}
                  </text>
                ) : (
                  <text x={x0 - 10} y={y + barH / 2} textAnchor="end" dominantBaseline="central" fontSize={13} fill={INK}>
                    {text}
                  </text>
                )}
                <path d={barPath(x0 + (stacked ? 0 : 1), y, w, barH, "right")} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
                <text x={x0 + w + 8} y={y + barH / 2} dominantBaseline="central" fontSize={13} fontWeight={600} fill={INK} className="tabular">
                  {d.display ?? d.value}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x0 + Math.min(((data[hover].value / max) * plotW) / 2, plotW / 2)} y={hover * rowH + (stacked ? labelLine : 4)}>
          <span className="font-semibold">{data[hover].display ?? data[hover].value}</span>{" "}
          <span className="text-mist">{data[hover].label}</span>
        </Tooltip>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- weekly grouped columns (3 series)
export interface WeekDatum {
  key: string;
  label: string;
  longLabel: string;
  values: { lost: number; found: number; returned: number };
}

const WEEK_SERIES = ["lost", "found", "returned"] as const;

export function WeeklyChart({ data, seriesLabels }: { data: WeekDatum[]; seriesLabels: Record<(typeof WEEK_SERIES)[number], string> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 220;
  const left = 30;
  const bottom = 26;
  const top = 18;
  const plotW = Math.max(width - left - 4, 60);
  const plotH = height - top - bottom;
  const peak = Math.max(1, ...data.flatMap((d) => WEEK_SERIES.map((s) => d.values[s])));
  const { max, step } = niceMax(peak);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const groupW = plotW / Math.max(data.length, 1);
  const gap = 2; // surface gap between touching bars
  const barW = Math.max(2, Math.min(24, (groupW * 0.78 - gap * 2) / 3));
  const labelEvery = groupW >= 46 ? 1 : groupW >= 26 ? 2 : 3;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const summary = data
    .map((d) => `${d.longLabel}: ${WEEK_SERIES.map((s) => `${seriesLabels[s]} ${d.values[s]}`).join(", ")}`)
    .join("; ");

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink" aria-hidden>
        {WEEK_SERIES.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-[3px]" style={{ background: SERIES[s] }} />
            {seriesLabels[s]}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={summary} className="block overflow-visible">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={left} x2={width} y1={y(tick)} y2={y(tick)} stroke={LINE} strokeWidth={1} />
                <text x={left - 6} y={y(tick)} textAnchor="end" dominantBaseline="central" fontSize={12} fill={MUTED} className="tabular">
                  {tick}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const gx = left + i * groupW;
              const inner = barW * 3 + gap * 2;
              const startX = gx + (groupW - inner) / 2;
              const last = i === data.length - 1;
              return (
                <g key={d.key} onMouseEnter={() => setHover(i)}>
                  <rect x={gx} y={top} width={groupW} height={plotH} fill={hover === i ? "var(--color-surface)" : "transparent"} />
                  {WEEK_SERIES.map((s, j) => {
                    const v = d.values[s];
                    if (v <= 0) return null;
                    const bx = startX + j * (barW + gap);
                    const by = y(v);
                    return (
                      <g key={s}>
                        <path d={barPath(bx, by, barW, top + plotH - by, "up")} fill={SERIES[s]} />
                        {last && barW >= 12 && (
                          <text x={bx + barW / 2} y={by - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>
                            {v}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {i % labelEvery === (data.length - 1) % labelEvery && (
                    <text x={gx + groupW / 2} y={height - 8} textAnchor="middle" fontSize={12} fill={MUTED}>
                      {d.label}
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={left} x2={width} y1={top + plotH} y2={top + plotH} stroke="var(--color-line-strong)" strokeWidth={1} />
          </svg>
        )}
        {hover !== null && data[hover] && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 rounded-xs bg-ink px-3 py-2 text-sm text-water"
            style={{
              left: Math.min(Math.max(left + hover * groupW + groupW / 2 - 72, 0), Math.max(width - 150, 0)),
              top: 0,
            }}
          >
            <p className="mb-1 text-xs text-mist">{data[hover].longLabel}</p>
            {WEEK_SERIES.map((s) => (
              <p key={s} className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-0.5 w-3" style={{ background: SERIES[s] }} />
                <span className="font-semibold tabular">{data[hover].values[s]}</span>
                <span className="text-mist">{seriesLabels[s]}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- stat tile + meter
export function StatTile({ label, value, sub, signal = false, action }: {
  label: string;
  value: string;
  sub?: string;
  signal?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-muted">
        {signal && <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-sonar" />}
        {label}
      </p>
      <p className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="block h-2 w-full overflow-hidden rounded-full bg-mist"
    >
      <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
    </span>
  );
}
