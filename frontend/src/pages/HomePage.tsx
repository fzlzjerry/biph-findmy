import { useQuery } from "@tanstack/react-query";
import { ArrowRight, HandHeart, PackageOpen, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { ItemCard } from "@/components/ItemBits";
import { SectionHeader } from "@/components/page";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <InputGroup className="h-11 bg-background">
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
          <InputGroupButton type="submit" variant="secondary" size="sm" className="h-8 px-3">
            {t("browse.search")}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
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
  const steps = [
    [t("home.step1Title"), t("home.step1")],
    [t("home.step2Title"), t("home.step2")],
    [t("home.step3Title"), t("home.step3")],
  ] as const;

  return (
    <>
      <section aria-labelledby="hero-title" className="border-b bg-gradient-to-b from-muted/60 to-background">
        <div className="container-page grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <div className="min-w-0">
            <Badge variant="outline" className="bg-background">
              {t("home.eyebrow")}
            </Badge>
            <h1 id="hero-title" className="mt-4 text-4xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.15]">
              {t("home.title")}
            </h1>
            <p className="mt-4 max-w-[60ch] text-lg text-muted-foreground">{t("home.promise")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 px-5 text-base">
                <Link to="/report/lost">
                  <Search aria-hidden data-icon="inline-start" />
                  {t("home.lost")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
                <Link to="/report/found">
                  <HandHeart aria-hidden data-icon="inline-start" />
                  {t("home.found")}
                </Link>
              </Button>
            </div>
            <div className="mt-8">
              <HeroSearch />
            </div>
            <p className="mt-4 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" aria-live="polite">
              {waiting !== undefined && (
                <>
                  <span aria-hidden className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <Link to="/browse" className="font-medium text-foreground underline-offset-4 hover:underline">
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

          <Card>
            <CardHeader>
              <CardTitle id="steps-title" role="heading" aria-level={2}>
                {t("home.stepsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-5">
                {steps.map(([title, body], index) => (
                  <li key={title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium">{title}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Button asChild variant="link" className="mt-4 h-auto px-0">
                <Link to="/about">
                  {t("nav.about")}
                  <ArrowRight aria-hidden data-icon="inline-end" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-labelledby="recent-title" className="container-page pt-12">
        <SectionHeader
          id="recent-title"
          title={t("home.recent")}
          description={t("home.recentLead")}
          actions={
            <Button asChild variant="ghost" className="-mr-2.5">
              <Link to="/browse">
                {t("home.browseAll")}
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
          }
        />
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
    </>
  );
}
