import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ChartFigure, DataTable, HBarChart, Meter, StatTile, WeeklyChart, type BarDatum } from "../../components/charts";
import { ConfirmDialog } from "../../components/Dialog";
import { ErrorState } from "../../components/States";
import { useToast } from "../../components/Toast";
import { Button, buttonClass } from "../../components/ui";
import { useLang } from "../../i18n";
import { api } from "../../lib/api";
import { useErrorText } from "../../lib/errors";
import { useLabels } from "../../lib/meta";
import { formatDate } from "../../lib/time";

const LANG_KEYS = ["en", "zh", "mixed", "unknown"] as const;

function StatsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-28 rounded-md" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-80 rounded-md" />
        <div className="skeleton h-80 rounded-md" />
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
    .map(([id, value]) => ({ key: id, label: id === "unknown" ? t("admin.unknownZone") : labels.zone(id), value }));
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
    <div className="space-y-8">
      <section aria-label={t("admin.statsTab")} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label={t("admin.kpiActive")}
          value={String(s.totals.active)}
          sub={t("admin.kpiLostFound", { lost: s.totals.lost, found: s.totals.found })}
        />
        <StatTile label={t("admin.kpiReturned")} value={String(s.totals.returned)} />
        <StatTile label={t("admin.kpiReturnRate")} value={pct(s.return_rate)} sub={t("admin.kpiReturnRateHint")} />
        <StatTile label={t("admin.kpiMedianDays")} value={medianText} />
        <StatTile
          label={t("admin.kpiPending")}
          value={String(s.totals.pending_claims)}
          signal={s.totals.pending_claims > 0}
          action={
            s.totals.pending_claims > 0 ? (
              <Link to="/admin" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
                {t("admin.claimsTab")} →
              </Link>
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

        <section aria-labelledby="feedback-title" className="rounded-md border border-line p-4 sm:p-5">
          <h3 id="feedback-title" className="text-base font-semibold text-ink">
            {t("admin.feedback")}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{t("admin.feedbackLead")}</p>
          {fb.confirmed + fb.rejected === 0 ? (
            <p className="mt-6 text-sm text-muted">{t("admin.noFeedback")}</p>
          ) : (
            <div className="mt-4 space-y-4">
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-sm font-medium text-muted">{t("admin.confirmed")}</dt>
                  <dd className="mt-0.5 text-[1.75rem] font-semibold leading-tight text-ink">{fb.confirmed}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted">{t("admin.rejectedFb")}</dt>
                  <dd className="mt-0.5 text-[1.75rem] font-semibold leading-tight text-ink">{fb.rejected}</dd>
                </div>
              </dl>
              <div>
                <p className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-muted">{t("admin.precision")}</span>
                  <span className="text-lg font-semibold text-ink">{pct(fb.strong_precision)}</span>
                </p>
                {fb.strong_precision !== null && (
                  <div className="mt-2">
                    <Meter value={fb.strong_precision} label={t("admin.precision")} />
                  </div>
                )}
                <p className="mt-2 text-sm text-muted">{t("admin.precisionHint")}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="tools-title" className="border-t border-line pt-6">
        <h3 id="tools-title" className="text-lg font-semibold text-ink">
          {t("admin.tools")}
        </h3>
        <p className="mt-1 max-w-[68ch] text-sm text-muted">{t("admin.toolsLead")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/admin/export/items.csv" download className={buttonClass("secondary", "sm")}>
            <Download aria-hidden />
            {t("admin.exportItems")}
          </a>
          <a href="/api/admin/export/feedback.csv" download className={buttonClass("secondary", "sm")}>
            <Download aria-hidden />
            {t("admin.exportFeedback")}
          </a>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            busy={rematch.isPending}
            busyLabel={t("admin.rematching")}
            onClick={() => rematch.mutate()}
          >
            {t("admin.rematch")}
          </Button>
          <Button variant="danger-outline" size="sm" icon={Trash2} onClick={() => setPurging(true)}>
            {t("admin.purge")}
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted">{t("admin.matcherVersion", { version: s.matcher })}</p>
      </section>

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
        variant="danger"
        error={purge.isError ? errorText(purge.error) : undefined}
      />
    </div>
  );
}
