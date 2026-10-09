import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Download, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BusyButton } from "@/components/BusyButton";
import { zoneFill } from "@/components/CampusMap";
import { ChartFigure, DataTable, HBarChart, Meter, StatTile, WeeklyChart, type BarDatum } from "@/components/charts";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLang } from "@/i18n";
import { api } from "@/lib/api";
import { useErrorText } from "@/lib/errors";
import { useLabels } from "@/lib/meta";
import { formatDate } from "@/lib/time";

const LANG_KEYS = ["en", "zh", "mixed", "unknown"] as const;

function StatsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export default function StatsTab() {
  const { t } = useTranslation();
  const labels = useLabels();
  const lang = useLang();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const [purging, setPurging] = useState(false);
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: api.admin.stats });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    void queryClient.invalidateQueries({ queryKey: ["items"] });
    void queryClient.invalidateQueries({ queryKey: ["item"] });
    void queryClient.invalidateQueries({ queryKey: ["myItems"] });
  };

  const rematch = useMutation({
    mutationFn: api.admin.rematch,
    onSuccess: (data) => {
      invalidateAll();
      toast({ message: t("admin.rematchDone", { count: data.items }), tone: "success" });
    },
    onError: (error) => toast({ message: errorText(error), tone: "error" }),
  });
  const purge = useMutation({
    mutationFn: api.admin.purgeDemo,
    onSuccess: (data) => {
      invalidateAll();
      setPurging(false);
      toast({ message: t("admin.purgeDone", { count: data.deleted }), tone: "success" });
    },
  });

  if (stats.isPending) return <StatsSkeleton />;
  if (stats.isError) return <ErrorState title={t("admin.statsError")} error={stats.error} onRetry={() => void stats.refetch()} />;

  const s = stats.data;
  const pct = (v: number | null) => (v === null ? t("admin.na") : `${Math.round(v * 100)}%`);
  const median = s.median_days_to_return;
  const medianText =
    median === null
      ? t("admin.na")
      : median < 1
        ? t("admin.hours", { count: Math.max(1, Math.round(median * 24)) })
        : t("admin.days", { count: Math.round(median * 10) / 10 });

  const categoryData = s.by_category.map(([id, value]) => ({ key: id, label: labels.category(id), value }));
  const zoneData = Object.entries(s.by_zone)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ key: id, label: id === "unknown" ? t("admin.unknownZone") : labels.zone(id), value, fill: zoneFill(id) }));
  const langTotal = Object.values(s.by_language).reduce((a, b) => a + b, 0) || 1;
  const langData: BarDatum[] = LANG_KEYS.filter((k) => s.by_language[k])
    .map((k): BarDatum => ({ key: k, label: t(`admin.lang_${k}`), value: s.by_language[k], display: `${Math.round((s.by_language[k] / langTotal) * 100)}%` }))
    .concat(
      Object.entries(s.by_language)
        .filter(([k]) => !(LANG_KEYS as readonly string[]).includes(k))
        .map(([k, v]): BarDatum => ({ key: k, label: k, value: v, display: `${Math.round((v / langTotal) * 100)}%` })),
    );
  const weekData = s.weekly.map((w) => ({
    key: w.week,
    label: formatDate(`${w.week}T12:00:00+08:00`, lang),
    longLabel: t("admin.weekOf", { date: formatDate(`${w.week}T12:00:00+08:00`, lang) }),
    values: { lost: w.lost, found: w.found, returned: w.returned },
  }));
  const seriesLabels = { lost: t("admin.series_lost"), found: t("admin.series_found"), returned: t("admin.series_returned") };
  const fb = s.feedback;

  return (
    <div className="space-y-6">
      <section aria-label={t("admin.statsTab")} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label={t("admin.kpiActive")} value={String(s.totals.active)} sub={t("admin.kpiLostFound", { lost: s.totals.lost, found: s.totals.found })} />
        <StatTile label={t("admin.kpiReturned")} value={String(s.totals.returned)} />
        <StatTile label={t("admin.kpiReturnRate")} value={pct(s.return_rate)} sub={t("admin.kpiReturnRateHint")} />
        <StatTile label={t("admin.kpiMedianDays")} value={medianText} />
        <StatTile
          label={t("admin.kpiPending")}
          value={String(s.totals.pending_claims)}
          signal={s.totals.pending_claims > 0}
          action={
            s.totals.pending_claims > 0 ? (
              <Button asChild variant="link" size="sm" className="h-auto justify-start px-0">
                <Link to="/admin">
                  {t("admin.claimsTab")}
                  <ArrowRight aria-hidden data-icon="inline-end" />
                </Link>
              </Button>
            ) : undefined
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFigure
          title={t("admin.byCategory")}
          lead={t("admin.byCategoryLead")}
          table={<DataTable columns={[t("admin.tableCategory"), t("admin.tableCount")]} rows={categoryData.map((d) => [d.label, d.value])} />}
        >
          <HBarChart data={categoryData} label={t("admin.byCategory")} />
        </ChartFigure>
        <ChartFigure
          title={t("admin.byZone")}
          lead={t("admin.byZoneLead")}
          table={<DataTable columns={[t("admin.tableArea"), t("admin.tableCount")]} rows={zoneData.map((d) => [d.label, d.value])} />}
        >
          <HBarChart data={zoneData} label={t("admin.byZone")} />
        </ChartFigure>
      </div>

      <ChartFigure
        title={t("admin.weekly")}
        lead={t("admin.weeklyLead")}
        table={
          <DataTable
            columns={[t("admin.tableWeek"), seriesLabels.lost, seriesLabels.found, seriesLabels.returned]}
            rows={weekData.map((w) => [w.longLabel, w.values.lost, w.values.found, w.values.returned])}
          />
        }
      >
        <WeeklyChart data={weekData} seriesLabels={seriesLabels} />
      </ChartFigure>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFigure
          title={t("admin.languages")}
          lead={t("admin.languagesLead")}
          table={
            <DataTable
              columns={[t("admin.tableLanguage"), t("admin.tableCount"), t("admin.tableShare")]}
              rows={langData.map((d) => [d.label, d.value, d.display ?? ""])}
            />
          }
        >
          <HBarChart data={langData} label={t("admin.languages")} />
        </ChartFigure>

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={3}>
              {t("admin.feedback")}
            </CardTitle>
            <CardDescription>{t("admin.feedbackLead")}</CardDescription>
          </CardHeader>
          <CardContent className="gap-5">
            {fb.confirmed + fb.rejected === 0 ? (
              <p className="text-sm text-muted-foreground">{t("admin.noFeedback")}</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-cream p-3">
                    <dt className="text-xs text-muted-foreground">{t("admin.confirmed")}</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">{fb.confirmed}</dd>
                  </div>
                  <div className="rounded-2xl bg-cream p-3">
                    <dt className="text-xs text-muted-foreground">{t("admin.rejectedFb")}</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums">{fb.rejected}</dd>
                  </div>
                </dl>
                <div className="space-y-2">
                  <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{t("admin.precision")}</span>
                    <span className="text-lg font-semibold tabular-nums">{pct(fb.strong_precision)}</span>
                  </p>
                  {fb.strong_precision !== null && <Meter value={fb.strong_precision} label={t("admin.precision")} />}
                  <p className="text-sm text-muted-foreground">{t("admin.precisionHint")}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={3}>
            {t("admin.tools")}
          </CardTitle>
          <CardDescription>{t("admin.toolsLead")}</CardDescription>
        </CardHeader>
        <CardContent className="flex-row flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/export/items.csv" download>
              <Download aria-hidden data-icon="inline-start" />
              {t("admin.exportItems")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/export/feedback.csv" download>
              <Download aria-hidden data-icon="inline-start" />
              {t("admin.exportFeedback")}
            </a>
          </Button>
          <BusyButton
            variant="outline"
            size="sm"
            icon={<RefreshCw aria-hidden data-icon="inline-start" />}
            busy={rematch.isPending}
            busyLabel={t("admin.rematching")}
            onClick={() => rematch.mutate()}
          >
            {t("admin.rematch")}
          </BusyButton>
          <Button variant="destructive" size="sm" onClick={() => setPurging(true)}>
            <Trash2 aria-hidden data-icon="inline-start" />
            {t("admin.purge")}
          </Button>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">{t("admin.matcherVersion", { version: s.matcher })}</p>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={purging}
        onClose={() => {
          setPurging(false);
          purge.reset();
        }}
        onConfirm={() => purge.mutate()}
        title={t("admin.purgeTitle")}
        description={t("admin.purgeBody")}
        confirmLabel={t("admin.purgeConfirm")}
        busyLabel={t("admin.purging")}
        busy={purge.isPending}
        destructive
        error={purge.isError ? errorText(purge.error) : undefined}
      />
    </div>
  );
}
