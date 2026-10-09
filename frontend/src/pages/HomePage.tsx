import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PackageOpen, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { CampusMap } from "@/components/CampusMap";
import { ItemCard } from "@/components/ItemBits";
import { SectionHeader } from "@/components/page";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { api } from "@/lib/api";
import { useDocumentTitle } from "@/lib/hooks";

function HeroSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : "/browse");
  };
  return (
    <form role="search" onSubmit={submit} className="max-w-xl">
      <label htmlFor="home-search" className="sr-only">
        {t("browse.searchLabel")}
      </label>
      <InputGroup className="h-14 rounded-full border-transparent pl-2 shadow-[0_1px_2px_rgb(44_46_42/0.08)]">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id="home-search"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("browse.searchPlaceholder")}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" size="sm" className="mr-1.5 h-10 rounded-full px-5">
            {t("browse.search")}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

/** A capsule action with the round ink chip riding its trailing edge. */
function ChipArrow() {
  return (
    <span aria-hidden className="ml-1 flex size-7 items-center justify-center rounded-full bg-ink transition-transform duration-300 ease-(--ease-swell) group-hover/button:translate-x-1">
      <ArrowRight className="size-4 text-cream" strokeWidth={2.5} />
    </span>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useDocumentTitle();

  const recent = useQuery({
    queryKey: ["items", "home", "recent"],
    queryFn: ({ signal }) => api.listItems({ kind: "found", page_size: 9 }, signal),
  });
  const returned = useQuery({
    queryKey: ["items", "home", "returned"],
    queryFn: ({ signal }) => api.listItems({ kind: "found", status: "returned", page_size: 1 }, signal),
  });

  const waiting = recent.data?.total;
  const returnedCount = returned.data?.total;
  const steps = [
    [t("home.step1Title"), t("home.step1"), "var(--color-zone-sports)"],
    [t("home.step2Title"), t("home.step2"), "var(--color-zone-academic)"],
    [t("home.step3Title"), t("home.step3"), "var(--color-zone-entrance)"],
  ] as const;

  return (
    <>
      <section aria-labelledby="hero-title" className="container-page grid items-center gap-x-12 gap-y-8 pt-6 pb-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-10">
        <div className="min-w-0 lg:order-2">
          <h1 id="hero-title" className="text-[clamp(2.5rem,5vw,4.25rem)] leading-[0.98] font-bold tracking-[-0.045em] text-balance">
            {t("home.title")}
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-foreground/80">{t("home.promise")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="sun" className="h-14 pr-3 pl-7 text-[1.0625rem]">
              <Link to="/report/lost">
                {t("home.lost")}
                <ChipArrow />
              </Link>
            </Button>
            <Button asChild size="lg" variant="coral" className="h-14 pr-3 pl-7 text-[1.0625rem]">
              <Link to="/report/found">
                {t("home.found")}
                <ChipArrow />
              </Link>
            </Button>
          </div>
          <div className="mt-10">
            <p className="mb-3 text-sm font-semibold">{t("home.searchTitle")}</p>
            <HeroSearch />
          </div>
          <p className="mt-4 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" aria-live="polite">
            {waiting !== undefined && (
              <>
                <Link to="/browse" className="font-semibold text-foreground underline decoration-ink/30 hover:decoration-ink">
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

        <div className="min-w-0 lg:order-1">
          <h2 className="sr-only">{t("map.title")}</h2>
          <CampusMap
            counts={recent.data?.zones}
            onSelect={(zone) => navigate(zone ? `/browse?zone=${zone}` : "/browse")}
            className="mx-auto max-w-[44rem]"
          />
          <p className="mt-4 text-center text-sm text-muted-foreground">{t("home.mapLead")}</p>
        </div>
      </section>

      <section aria-labelledby="recent-title" className="container-page pt-6">
        <SectionHeader
          id="recent-title"
          title={t("home.recent")}
          description={t("home.recentLead")}
          actions={
            <Button asChild variant="outline">
              <Link to="/browse">
                {t("home.browseAll")}
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
          }
        />
        <div className="mt-6">
          {recent.isPending ? (
            <CardGridSkeleton count={6} />
          ) : recent.isError ? (
            <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
          ) : recent.data.items.length === 0 ? (
            <EmptyState icon={PackageOpen} title={t("home.emptyRecent")} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recent.data.items.map((item) => (
                <li key={item.id} className="flex min-w-0">
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="steps-title" className="container-page pt-16">
        <div className="rounded-[2rem] bg-card px-6 py-8 sm:px-10 sm:py-10">
          <h2 id="steps-title" className="text-2xl font-bold tracking-[-0.03em]">
            {t("home.stepsTitle")}
          </h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            {steps.map(([title, body, fill], index) => (
              <li key={title} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-ink"
                  style={{ background: fill }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link to="/about" className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-ink/30 hover:decoration-ink">
            {t("nav.about")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
