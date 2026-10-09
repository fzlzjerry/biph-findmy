import { Gauge, GlobeLock, ImageOff, Languages, Lock, Scale, ScanSearch, Timer, UserX, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { LookalikeChart, MethodsChart } from "@/components/EvalCharts";
import { ProbabilityMeter, ReasonChips } from "@/components/ItemBits";
import { LogoMark } from "@/components/Layout";
import { PageHeader, SectionHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentTitle } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import type { Reason } from "@/lib/types";

// The reasons the matcher gives for the example pair (same wording as on a real match card).
const EXAMPLE_REASONS: Reason[] = [
  { code: "category_same", feature: "category", en: "Same type: Water bottle", zh: "同类物品：水杯", contribution: 2.73 },
  { code: "marks_shared", feature: "marks", en: "Shared details: sticker, dinosaur", zh: "共同特征：贴纸、恐龙", contribution: 1.97 },
  { code: "color_same", feature: "color", en: "Color matches: black", zh: "颜色一致：黑色", contribution: 1.93 },
  { code: "location_same", feature: "location", en: "Same place: Lower Gym", zh: "同一地点：下体育馆（Lower Gym）", contribution: 1.91 },
];

function Step({ n, icon: Icon, title, body }: { n: number; icon: LucideIcon; title: string; body: string }) {
  return (
    <li>
      <Card size="sm" className="h-full">
        <CardHeader>
          <span className="mb-2 flex size-9 items-center justify-center rounded-full bg-secondary text-ink" aria-hidden>
            <Icon className="size-4.5" />
          </span>
          <CardTitle role="heading" aria-level={3}>
            <span className="mr-1 text-muted-foreground">{n}.</span>
            {title}
          </CardTitle>
          <CardDescription className="leading-relaxed">{body}</CardDescription>
        </CardHeader>
      </Card>
    </li>
  );
}

export default function AboutPage() {
  const { t } = useTranslation();
  const labels = useLabels();
  const location = useLocation();
  useDocumentTitle(t("nav.about"));

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  const strong = Math.round(labels.meta.bands.strong * 100);
  const possible = Math.round(labels.meta.bands.possible * 100);
  const privacy: [LucideIcon, string, string][] = [
    [UserX, t("about.privacy1Title"), t("about.privacy1")],
    [Lock, t("about.privacy2Title"), t("about.privacy2")],
    [ImageOff, t("about.privacy3Title"), t("about.privacy3")],
    [Timer, t("about.privacy4Title"), t("about.privacy4", { days: labels.meta.item_ttl_days })],
    [GlobeLock, t("about.privacy5Title"), t("about.privacy5")],
  ];

  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader title={t("about.title")} description={t("about.lead")} />

      <section aria-labelledby="pipeline-title" className="mt-12">
        <SectionHeader id="pipeline-title" title={t("about.pipelineTitle")} />
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step n={1} icon={ScanSearch} title={t("about.step1Title")} body={t("about.step1Body")} />
          <Step n={2} icon={Languages} title={t("about.step2Title")} body={t("about.step2Body")} />
          <Step n={3} icon={Scale} title={t("about.step3Title")} body={t("about.step3Body")} />
          <Step n={4} icon={Gauge} title={t("about.step4Title")} body={t("about.step4Body", { strong, possible })} />
        </ol>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle role="heading" aria-level={3}>
              {t("about.exampleTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="gap-4 text-base">
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="rounded-2xl bg-cream p-3 text-sm break-words">{t("about.exampleLost")}</p>
              <p className="rounded-2xl bg-cream p-3 text-sm break-words">{t("about.exampleFound")}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ProbabilityMeter value={0.9} band="strong" />
                <span className="text-sm font-semibold">{t("band.strong")}</span>
              </div>
              <ReasonChips reasons={EXAMPLE_REASONS} />
            </div>
            <p className="text-sm text-muted-foreground">{t("about.exampleResult")}</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="eval-title" className="mt-16">
        <SectionHeader id="eval-title" title={t("about.evalTitle")} />
        <p className="mt-3 max-w-[68ch] leading-relaxed text-muted-foreground">{t("about.evalBody")}</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {(
            [
              ["methods", t("about.chartMethodsTitle"), <MethodsChart />, t("about.evalMethodsCaption")],
              ["lookalikes", t("about.chartLookalikeTitle"), <LookalikeChart />, t("about.evalDistractorCaption")],
            ] as const
          ).map(([key, title, chart, caption]) => (
            <Card key={key} className="min-w-0">
              <CardHeader>
                <CardTitle role="heading" aria-level={3}>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <figure className="min-w-0">
                  {chart}
                  <figcaption className="mt-5 text-sm leading-relaxed text-muted-foreground">{caption}</figcaption>
                </figure>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{t("about.evalNote")}</p>

        <div className="mt-10 max-w-3xl">
          <h3 className="text-lg font-semibold tracking-tight">{t("about.marksTitle")}</h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">{t("about.marksBody")}</p>
        </div>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="mt-16 scroll-mt-20">
        <SectionHeader id="privacy-title" title={t("about.privacyTitle")} />
        <ul className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {privacy.map(([Icon, title, body]) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary" aria-hidden>
                <Icon className="size-4 text-ink" />
              </span>
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="credits-title" className="mt-16">
        <SectionHeader id="credits-title" title={t("about.creditsTitle")} />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={3}>
                {t("about.dsClub")}
              </CardTitle>
              <CardDescription className="leading-relaxed">{t("about.dsClubBody")}</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={3}>
                {t("about.sdClub")}
              </CardTitle>
              <CardDescription className="leading-relaxed">{t("about.sdClubBody")}</CardDescription>
            </CardHeader>
          </Card>
        </div>
        <div className="mt-6 flex items-start gap-3">
          <LogoMark className="size-7" />
          <div>
            <p className="text-muted-foreground">{t("about.questions")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("about.matcherVersion", { version: labels.meta.matcher.version })}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="sun">
            <Link to="/report/lost">{t("about.ctaLost")}</Link>
          </Button>
          <Button asChild size="lg" variant="coral">
            <Link to="/report/found">{t("about.ctaFound")}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
