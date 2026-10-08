import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Check, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { ItemCard } from "../components/ItemBits";
import { CategorySelect } from "../components/Pickers";
import { CardGridSkeleton, EmptyState, ErrorState } from "../components/States";
import { TabPanel, Tabs } from "../components/Tabs";
import { Button, buttonClass, Notice, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { isLightHex } from "../lib/color";
import { useDocumentTitle } from "../lib/hooks";
import { useLabels } from "../lib/meta";
import type { ItemKind } from "../lib/types";

const PAGE_SIZE = 24;
const FILTER_KEYS = ["category", "color", "zone", "place"] as const;

export default function BrowsePage() {
  const { t } = useTranslation();
  const labels = useLabels();
  useDocumentTitle(t("browse.title"));
  const [params, setParams] = useSearchParams();

  const kind: ItemKind = params.get("kind") === "lost" ? "lost" : "found";
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const color = params.get("color") ?? "";
  const zone = params.get("zone") ?? "";
  const place = params.get("place") ?? "";
  const activeFilters = FILTER_KEYS.filter((key) => params.get(key)).length;

  const update = (patch: Record<string, string | null>, replace = true) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace },
    );

  // Search box ⇄ ?q=…: typing is debounced into the URL; URL changes made elsewhere (back button, "clear
  // filters") flow back into the box. While the person is typing ("dirty") the URL never overwrites the box —
  // router updates arrive in a transition, so resetting "dirty" only once the URL has caught up avoids flicker.
  const [search, setSearch] = useState(q);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty; // declared first: effects run in order, so the sync below sees the latest value
  }, [dirty]);
  useEffect(() => {
    if (!dirtyRef.current) setSearch(q);
  }, [q]);
  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(() => update({ q: search.trim() || null }), 450);
    return () => window.clearTimeout(id);
  }, [search, dirty]);
  useEffect(() => {
    if (dirty && q === search.trim()) setDirty(false);
  }, [q, search, dirty]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    update({ q: search.trim() || null });
  };

  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ["items", "browse", { kind, q, category, color, zone, place }],
    queryFn: ({ pageParam, signal }) =>
      api.listItems({ kind, q, category, color, zone, place, page: pageParam, page_size: PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const zoneObj = labels.meta.zones.find((z) => z.id === zone);
  const countText = q ? t("browse.countFor", { count: total, q }) : t("browse.count", { count: total });

  const clearAll = () => {
    setSearch("");
    setDirty(false);
    update({ category: null, color: null, zone: null, place: null, q: null });
  };

  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader title={t("browse.title")} lead={t("browse.lead")} />

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center">
        <Tabs
          idPrefix="browse"
          label={t("browse.tabsLabel")}
          value={kind}
          onChange={(id) => update({ kind: id === "found" ? null : id }, false)}
          items={[
            { id: "found", label: t("browse.foundTab") },
            { id: "lost", label: t("browse.lostTab") },
          ]}
        />
        <form role="search" onSubmit={onSubmit} className="flex min-w-0 flex-1 gap-2">
          <label htmlFor="browse-search" className="sr-only">
            {t("browse.searchLabel")}
          </label>
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
            <input
              id="browse-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setDirty(true);
              }}
              placeholder={t("browse.searchPlaceholder")}
              className="field-control pl-11 pr-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDirty(false);
                  update({ q: null });
                  document.getElementById("browse-search")?.focus();
                }}
                aria-label={t("browse.clearSearch")}
                className="absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-xs text-muted hover:bg-surface hover:text-ink"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
          <div className="hidden sm:block">
            <Button type="submit" variant="primary">
              {t("browse.search")}
            </Button>
          </div>
        </form>
      </div>

      <TabPanel idPrefix="browse" activeId={kind} className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-4 lg:w-64 lg:shrink-0" aria-label={t("browse.filters")}>
          <button
            type="button"
            className={buttonClass("secondary", "sm", "w-full lg:hidden")}
            aria-expanded={filtersOpen}
            aria-controls="browse-filters"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal aria-hidden />
              {activeFilters ? t("browse.filtersWithCount", { count: activeFilters }) : t("browse.filters")}
            </span>
          </button>
          <div id="browse-filters" className={`${filtersOpen ? "mt-3 block" : "hidden"} space-y-5 rounded-md bg-surface p-4 lg:mt-0 lg:block`}>
            <div>
              <label htmlFor="filter-category" className="text-sm font-semibold text-ink">
                {t("browse.category")}
              </label>
              <div className="mt-1.5">
                <CategorySelect
                  id="filter-category"
                  includeGroups
                  value={category}
                  onChange={(value) => update({ category: value || null })}
                  placeholder={t("browse.allCategories")}
                />
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-ink">{t("browse.color")}</legend>
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1">
                {labels.meta.colors.map((c) => {
                  const on = color === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={labels.text(c.label)}
                      title={labels.text(c.label)}
                      onClick={() => update({ color: on ? null : c.id })}
                      className={`relative inline-flex size-11 items-center justify-center rounded-full border-2 ${
                        on ? "border-brand" : "border-transparent hover:border-line-strong"
                      }`}
                    >
                      <span className="size-8 rounded-full border border-ink/25" style={{ background: c.hex }} />
                      {on && (
                        <Check
                          aria-hidden
                          strokeWidth={3}
                          className={`absolute size-4 ${isLightHex(c.hex) ? "text-ink" : "text-water"}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 min-h-5 text-sm text-muted" aria-live="polite">
                {color ? t("browse.colorSelected", { color: labels.color(color) }) : t("browse.anyColor")}
              </p>
            </fieldset>

            <div>
              <label htmlFor="filter-zone" className="text-sm font-semibold text-ink">
                {t("browse.zone")}
              </label>
              <select
                id="filter-zone"
                className="field-control mt-1.5"
                value={zone}
                onChange={(event) => update({ zone: event.target.value || null, place: null })}
              >
                <option value="">{t("browse.allZones")}</option>
                {labels.meta.zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {labels.text(z.label)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-place" className="text-sm font-semibold text-ink">
                {t("browse.place")}
              </label>
              <select
                id="filter-place"
                className="field-control mt-1.5"
                value={place}
                disabled={!zoneObj}
                onChange={(event) => update({ place: event.target.value || null })}
              >
                <option value="">{t("browse.allPlaces")}</option>
                {zoneObj?.places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {labels.text(p.label)}
                  </option>
                ))}
              </select>
            </div>

            {(activeFilters > 0 || q) && (
              <Button variant="secondary" size="sm" icon={X} className="w-full" onClick={clearAll}>
                {t("browse.clearFilters")}
              </Button>
            )}
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0 flex-1">
          <h2 id="results-heading" className="sr-only">
            {t("browse.resultsLabel")}
          </h2>
          {kind === "lost" && (
            <Notice className="mb-4" action={<Link to="/report/found" className="font-semibold text-brand underline underline-offset-4">{t("item.reportFoundCta")}</Link>}>
              {t("browse.lostTabNote")}
            </Notice>
          )}
          <p className="mb-3 min-h-6 text-[0.9375rem] font-medium text-muted" aria-live="polite" aria-atomic="true">
            {query.isSuccess ? countText : ""}
          </p>

          {query.isPending ? (
            <CardGridSkeleton count={8} />
          ) : query.isError && !query.data ? (
            <ErrorState title={t("browse.errorTitle")} error={query.error} onRetry={() => void query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={q ? t("browse.emptySearch", { q }) : activeFilters ? t("browse.emptyFiltered") : t("browse.emptyTitle")}
              actions={
                <>
                  {(activeFilters > 0 || q) && (
                    <Button variant="secondary" onClick={clearAll}>
                      {t("browse.clearFilters")}
                    </Button>
                  )}
                  <Link to={kind === "found" ? "/report/lost" : "/report/found"} className={buttonClass("primary")}>
                    {kind === "found" ? t("nav.reportLost") : t("nav.reportFound")}
                  </Link>
                </>
              }
            >
              {q && <p>{t("browse.emptyTip")}</p>}
              <p className={q ? "mt-2" : ""}>{kind === "found" ? t("browse.emptyCtaLost") : t("browse.emptyCtaFound")}</p>
            </EmptyState>
          ) : (
            <div className={`transition-opacity duration-200 ${query.isPlaceholderData ? "opacity-60" : ""}`} aria-busy={query.isFetching}>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <li key={item.id} className="flex min-w-0">
                    <ItemCard item={item} />
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-sm text-muted">{t("browse.showing", { shown: items.length, total })}</p>
                {query.hasNextPage && (
                  <Button
                    variant="secondary"
                    onClick={() => void query.fetchNextPage()}
                    busy={query.isFetchingNextPage}
                    busyLabel={t("browse.loadingMore")}
                  >
                    {t("browse.loadMore")}
                  </Button>
                )}
                {query.isFetchNextPageError && (
                  <ErrorState compact error={query.error} onRetry={() => void query.fetchNextPage()} />
                )}
              </div>
            </div>
          )}
        </section>
      </TabPanel>
    </div>
  );
}
