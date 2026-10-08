import { Gauge, GlobeLock, ImageOff, Languages, Lock, Scale, ScanSearch, Timer, UserX, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { ReasonChips } from "../components/ItemBits";
import { BrandMark } from "../components/Layout";
import { BandBadge, buttonClass, PageHeader } from "../components/ui";
import { useDocumentTitle } from "../lib/hooks";
import { useLabels } from "../lib/meta";
import type { Reason } from "../lib/types";

const EXAMPLE_REASONS: Reason[] = [
  { code: "category_same", feature: "category", en: "Same type: Water bottle", zh: "同类物品：水杯", contribution: 2.73 },
  { code: "marks_shared", feature: "marks", en: "Shared details: sticker, dinosaur", zh: "共同特征：贴纸、恐龙", contribution: 1.97 },
  { code: "color_same", feature: "color", en: "Color matches: black", zh: "颜色一致：黑色", contribution: 1.93 },
  { code: "location_same", feature: "location", en: "Same place: Gymnasium", zh: "同一地点：体育馆", contribution: 1.91 },
];

function Step({ n, icon: Icon, title, body }: { n: number; icon: LucideIcon; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mist text-brand-deep" aria-hidden>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-ink">
          <span className="mr-1.5 text-muted">{n}.</span>
          {title}
        </h3>
        <p className="mt-1 leading-relaxed text-muted">{body}</p>
      </div>
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
      <PageHeader title={t("about.title")} lead={t("about.lead")} />

      <section aria-labelledby="pipeline-title" className="mt-12">
        <h2 id="pipeline-title" className="text-2xl font-semibold text-ink">
          {t("about.pipelineTitle")}
        </h2>
        <ol className="mt-6 grid gap-8 md:grid-cols-2">
          <Step n={1} icon={ScanSearch} title={t("about.step1Title")} body={t("about.step1Body")} />
          <Step n={2} icon={Languages} title={t("about.step2Title")} body={t("about.step2Body")} />
          <Step n={3} icon={Scale} title={t("about.step3Title")} body={t("about.step3Body")} />
          <Step n={4} icon={Gauge} title={t("about.step4Title")} body={t("about.step4Body", { strong, possible })} />
        </ol>

        <div className="mt-10 rounded-md bg-surface p-5 sm:p-6">
          <h3 className="text-base font-semibold text-ink">{t("about.exampleTitle")}</h3>
          <div className="mt-3 grid gap-2 text-[0.9375rem] text-ink sm:grid-cols-2 sm:gap-6">
            <p className="break-words">{t("about.exampleLost")}</p>
            <p className="break-words">{t("about.exampleFound")}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <BandBadge band="strong" />
            <ReasonChips reasons={EXAMPLE_REASONS} />
          </div>
          <p className="mt-3 text-sm text-muted">{t("about.exampleResult")}</p>
        </div>
      </section>

      <section aria-labelledby="eval-title" className="mt-14 border-t border-line pt-10">
        <h2 id="eval-title" className="text-2xl font-semibold text-ink">
          {t("about.evalTitle")}
        </h2>
        <p className="mt-3 max-w-[68ch] leading-relaxed text-muted">{t("about.evalBody")}</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <figure className="min-w-0">
            <img
              src="/eval/methods.png"
              width={1280}
              height={672}
              loading="lazy"
              decoding="async"
              alt={t("about.evalMethodsCaption")}
              className="w-full rounded-sm border border-line bg-water"
            />
            <figcaption className="mt-2 text-sm leading-relaxed text-muted">{t("about.evalMethodsCaption")}</figcaption>
          </figure>
          <figure className="min-w-0">
            <img
              src="/eval/distractor_curve.png"
              width={1120}
              height={640}
              loading="lazy"
              decoding="async"
              alt={t("about.evalDistractorCaption")}
              className="w-full rounded-sm border border-line bg-water"
            />
            <figcaption className="mt-2 text-sm leading-relaxed text-muted">{t("about.evalDistractorCaption")}</figcaption>
          </figure>
        </div>
        <p className="mt-4 text-sm text-muted">{t("about.evalNote")}</p>

        <div className="mt-10 max-w-3xl">
          <h3 className="text-lg font-semibold text-ink">{t("about.marksTitle")}</h3>
          <p className="mt-2 leading-relaxed text-muted">{t("about.marksBody")}</p>
        </div>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="mt-14 scroll-mt-6 border-t border-line pt-10">
        <h2 id="privacy-title" className="text-2xl font-semibold text-ink">
          {t("about.privacyTitle")}
        </h2>
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {privacy.map(([Icon, title, body]) => (
            <li key={title} className="flex gap-3">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
              <div>
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-0.5 leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="credits-title" className="mt-14 border-t border-line pt-10">
        <h2 id="credits-title" className="text-2xl font-semibold text-ink">
          {t("about.creditsTitle")}
        </h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-md bg-surface p-5">
            <h3 className="text-lg font-semibold text-ink">{t("about.dsClub")}</h3>
            <p className="mt-1 leading-relaxed text-muted">{t("about.dsClubBody")}</p>
          </div>
          <div className="flex gap-4 rounded-md bg-surface p-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-ink">{t("about.sdClub")}</h3>
              <p className="mt-1 leading-relaxed text-muted">{t("about.sdClubBody")}</p>
            </div>
            <BrandMark className="size-12" />
          </div>
        </div>
        <p className="mt-6 text-muted">{t("about.questions")}</p>
        <p className="mt-1 text-xs text-muted">{t("about.matcherVersion", { version: labels.meta.matcher.version })}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/report/lost" className={buttonClass("primary")}>
            {t("about.ctaLost")}
          </Link>
          <Link to="/report/found" className={buttonClass("secondary")}>
            {t("about.ctaFound")}
          </Link>
        </div>
      </section>
    </div>
  );
}
