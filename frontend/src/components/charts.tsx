// Front-desk stats charts: shadcn/ui Chart (Recharts) inside cards. Every chart has a plain-table view, and the
// chart itself is exposed to screen readers as one image with a text summary.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------- figure + table view
export function ChartFigure({ title, lead, children, table, className }: {
  title: string;
  lead?: string;
  children: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle role="heading" aria-level={3}>
          {title}
        </CardTitle>
        {lead && <CardDescription>{lead}</CardDescription>}
        <CardAction>
          <Button variant="ghost" size="sm" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)} className="-mr-2 -mt-1">
            {showTable ? t("admin.hideTable") : t("admin.showTable")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{showTable ? table : children}</CardContent>
    </Card>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c, i) => (
            <TableHead key={c} className={i > 0 ? "text-right" : undefined}>
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, r) => (
          <TableRow key={r}>
            {row.map((cell, i) =>
              i === 0 ? (
                <TableHead key={i} scope="row" className="h-auto py-2 font-normal text-foreground">
                  {cell}
                </TableHead>
              ) : (
                <TableCell key={i} className="text-right tabular-nums">
                  {cell}
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// --------------------------------------------------------------------------- horizontal bars (one series)
export interface BarDatum {
  key: string;
  label: string;
  value: number;
  display?: string;
}

export function HBarChart({ data, label }: { data: BarDatum[]; label: string }) {
  const { t } = useTranslation();
  if (!data.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t("admin.chartEmpty")}</p>;
  const config = { value: { label, color: "var(--chart-1)" } } satisfies ChartConfig;
  // About 7.5px per Latin character / 12.5px per CJK character at 12px. Recharts wraps a tick label that is wider
  // than the axis, so longer labels are clipped instead (the table view has the full text).
  const textWidth = (text: string) => [...text].reduce((w, ch) => w + (/[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 12.5 : 7.5), 0);
  const axisWidth = Math.min(Math.max(...data.map((d) => textWidth(d.label))) + 18, 172);
  const fit = (text: string) => {
    if (textWidth(text) + 18 <= axisWidth) return text;
    let out = text;
    while (out.length > 1 && textWidth(`${out}…`) + 18 > axisWidth) out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
  };
  const summary = `${label}: ${data.map((d) => `${d.label} ${d.display ?? d.value}`).join(", ")}`;
  const rows = data.map((d) => ({ ...d, shown: d.display ?? String(d.value) }));
  return (
    <div role="img" aria-label={summary}>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 32 + 8 }}>
        <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 36, top: 4, bottom: 4 }} accessibilityLayer={false}>
          <YAxis
            dataKey="label"
            type="category"
            tickLine={false}
            axisLine={false}
            width={axisWidth}
            tickMargin={6}
            tickFormatter={fit}
          />
          <XAxis type="number" dataKey="value" hide />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} barSize={18}>
            <LabelList dataKey="shown" position="right" offset={8} className="fill-foreground" fontSize={12} fontWeight={500} />
          </Bar>
        </BarChart>
      </ChartContainer>
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
  const config = {
    lost: { label: seriesLabels.lost, color: "var(--chart-2)" },
    found: { label: seriesLabels.found, color: "var(--chart-1)" },
    returned: { label: seriesLabels.returned, color: "var(--chart-3)" },
  } satisfies ChartConfig;
  const rows = data.map((d) => ({ label: d.label, longLabel: d.longLabel, ...d.values }));
  const summary = data
    .map((d) => `${d.longLabel}: ${WEEK_SERIES.map((s) => `${seriesLabels[s]} ${d.values[s]}`).join(", ")}`)
    .join("; ");
  return (
    <div role="img" aria-label={summary}>
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={rows} margin={{ left: -16, right: 4, top: 8 }} barGap={2} accessibilityLayer={false}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
          <ChartTooltip
            cursor={{ fill: "var(--muted)" }}
            content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.longLabel ?? ""} />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          {WEEK_SERIES.map((s) => (
            <Bar key={s} dataKey={s} fill={`var(--color-${s})`} radius={[4, 4, 0, 0]} maxBarSize={18} />
          ))}
        </BarChart>
      </ChartContainer>
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
    <Card size="sm" className={cn("min-w-0 gap-1", signal && "ring-amber-300 bg-amber-50/50")}>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {signal && <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber-500" />}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums group-data-[size=sm]/card:text-2xl">{value}</CardTitle>
      </CardHeader>
      {(sub || action) && (
        <CardContent className="gap-1.5">
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {action}
        </CardContent>
      )}
    </Card>
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
      className="block h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </span>
  );
}
