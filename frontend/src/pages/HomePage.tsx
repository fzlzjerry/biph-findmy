import { useQuery } from "@tanstack/react-query";
import { ArrowRight, HandHeart, PackageOpen, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ItemCard } from "../components/ItemBits";
import { Mascot } from "../components/Layout";
import { CardGridSkeleton, EmptyState, ErrorState } from "../components/States";
import { buttonClass } from "../components/ui";
import { api } from "../lib/api";
import { useDocumentTitle } from "../lib/hooks";

function ActionTile({ to, title, hint, icon: Icon, primary }: {
  to: string;
  title: string;
  hint: string;
  icon: typeof Search;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group flex min-h-[4.5rem] items-center gap-4 rounded-sm px-5 py-4 no-underline transition-colors duration-200 active:translate-y-px ${
        primary ? "bg-brand text-water hover:bg-brand-deep" : "border border-line-strong bg-water text-ink hover:bg-surface"
      }`}
    >
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-full ${primary ? "bg-water/15" : "bg-mist text-brand"}`}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold leading-snug">{title}</span>
        <span className={`mt-0.5 block text-sm ${primary ? "text-mist" : "text-muted"}`}>{hint}</span>
      </span>
      <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  useDocumentTitle();

  const recent = useQuery({
    queryKey: ["items", "home", "recent"],
    queryFn: ({ signal }) => api.listItems({ kind: "found", page_size: 8 }, signal),
  });
  const returned = useQuery({
    queryKey: ["items", "home", "returned"],
    queryFn: ({ signal }) => api.listItems({ kind: "found", status: "returned", page_size: 1 }, signal),
  });

  const waiting = recent.data?.total;
  const returnedCount = returned.data?.total;

  return (
    <div className="container-page">
      <section aria-labelledby="hero-title" className="grid items-center gap-8 pb-10 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12 lg:pb-14">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-brand">{t("home.eyebrow")}</p>
          <h1
            id="hero-title"
            className="mt-3 text-[2.25rem] font-bold leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.25rem]"
          >
            {t("home.title")}
          </h1>
          <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">{t("home.promise")}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <ActionTile to="/report/lost" title={t("home.lost")} hint={t("home.lostHint")} icon={Search} primary />
            <ActionTile to="/report/found" title={t("home.found")} hint={t("home.foundHint")} icon={HandHeart} />
          </div>
          <p className="mt-6 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-muted" aria-live="polite">
            {waiting !== undefined && (
              <>
                <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-sonar" />
                <Link to="/browse" className="font-semibold text-ink underline-offset-4 hover:underline">
                  {t("home.waiting", { count: waiting })}
                </Link>
                {returnedCount !== undefined && returnedCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{t("home.returned", { count: returnedCount })}</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 overflow-hidden rounded-md bg-brand p-4 sm:gap-6 sm:p-5 lg:flex-col lg:items-stretch lg:gap-0 lg:p-0">
          <div className="size-28 shrink-0 sm:size-36 lg:aspect-square lg:size-auto lg:w-full lg:p-10">
            <Mascot alt={t("home.mascotAlt")} sizes="(min-width: 1024px) 460px, 144px" />
          </div>
          <p className="text-sm leading-relaxed text-mist lg:border-t lg:border-water/15 lg:px-6 lg:py-4">{t("home.clubLine")}</p>
        </div>
      </section>

      <section aria-labelledby="recent-title" className="border-t border-line pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recent-title" className="text-2xl font-semibold text-ink">
              {t("home.recent")}
            </h2>
            <p className="mt-1 text-[0.9375rem] text-muted">{t("home.recentLead")}</p>
          </div>
          <Link to="/browse" className={buttonClass("quiet", "sm", "-mr-2")}>
            {t("home.browseAll")}
            <ArrowRight aria-hidden />
          </Link>
        </div>
        <div className="mt-6">
          {recent.isPending ? (
            <CardGridSkeleton count={8} />
          ) : recent.isError ? (
            <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
          ) : recent.data.items.length === 0 ? (
            <EmptyState icon={PackageOpen} title={t("home.emptyRecent")} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {recent.data.items.map((item) => (
                <li key={item.id} className="flex min-w-0">
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="steps-title" className="mt-14 border-t border-line pt-10">
        <h2 id="steps-title" className="text-2xl font-semibold text-ink">
          {t("home.stepsTitle")}
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
          {(
            [
              ["1", t("home.step1Title"), t("home.step1")],
              ["2", t("home.step2Title"), t("home.step2")],
              ["3", t("home.step3Title"), t("home.step3")],
            ] as const
          ).map(([n, title, body]) => (
            <li key={n} className="flex gap-4">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-mist text-base font-bold text-brand-deep"
              >
                {n}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-ink">{title}</h3>
                <p className="mt-1 leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8">
          <Link to="/about" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t("nav.about")} →
          </Link>
        </p>
      </section>
    </div>
  );
}
