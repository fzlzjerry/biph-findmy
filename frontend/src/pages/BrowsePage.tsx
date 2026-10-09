import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Check, Info, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { BusyButton } from "@/components/BusyButton";
import { ItemCard } from "@/components/ItemBits";
import { focusSheet } from "@/components/Layout";
import { PageHeader } from "@/components/page";
import { CategorySelect } from "@/components/Pickers";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/States";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { isLightHex } from "@/lib/color";
import { useDocumentTitle } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import type { ItemKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;
const FILTER_KEYS = ["category", "color", "zone", "place"] as const;
type Patch = Record<string, string | null>;

function Filters({ idPrefix, params, update, onClear }: {
  idPrefix: string;
  params: URLSearchParams;
  update: (patch: Patch) => void;
  onClear?: () => void;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const category = params.get("category") ?? "";
  const color = params.get("color") ?? "";
  const zone = params.get("zone") ?? "";
  const place = params.get("place") ?? "";
  const zoneObj = labels.meta.zones.find((z) => z.id === zone);

  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-category`}>{t("browse.category")}</Label>
        <CategorySelect
          id={`${idPrefix}-category`}
          includeGroups
          value={category}
          onChange={(value) => update({ category: value || null })}
          placeholder={t("browse.allCategories")}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("browse.color")}</legend>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
          {labels.meta.colors.map((c) => {
            const on = color === c.id;
            const label = labels.text(c.label);
            return (
              <Toggle
                key={c.id}
                pressed={on}
                onPressedChange={() => update({ color: on ? null : c.id })}
                aria-label={label}
                title={label}
                className="relative size-9 rounded-full p-0 hover:bg-muted aria-pressed:bg-transparent aria-pressed:ring-2 aria-pressed:ring-primary"
              >
                <span className="size-7 rounded-full border border-black/15" style={{ background: c.hex }} />
                {on && (
                  <Check
                    aria-hidden
                    strokeWidth={3}
                    className={cn("absolute size-3.5", isLightHex(c.hex) ? "text-foreground" : "text-white")}
                  />
                )}
              </Toggle>
            );
          })}
        </div>
        <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
          {color ? t("browse.colorSelected", { color: labels.color(color) }) : t("browse.anyColor")}
        </p>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-zone`}>{t("browse.zone")}</Label>
        <NativeSelect
          id={`${idPrefix}-zone`}
          className="w-full"
          value={zone}
          onChange={(event) => update({ zone: event.target.value || null, place: null })}
        >
          <NativeSelectOption value="">{t("browse.allZones")}</NativeSelectOption>
          {labels.meta.zones.map((z) => (
            <NativeSelectOption key={z.id} value={z.id}>
              {labels.text(z.label)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-place`}>{t("browse.place")}</Label>
        <NativeSelect
          id={`${idPrefix}-place`}
          className="w-full"
          value={place}
          disabled={!zoneObj}
          onChange={(event) => update({ place: event.target.value || null })}
        >
          <NativeSelectOption value="">{t("browse.allPlaces")}</NativeSelectOption>
          {zoneObj?.places.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {labels.text(p.label)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {onClear && (
        <Button variant="outline" className="w-full" onClick={onClear}>
          <X aria-hidden data-icon="inline-start" />
          {t("browse.clearFilters")}
        </Button>
      )}
    </div>
  );
}

export default function BrowsePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("browse.title"));
  const [params, setParams] = useSearchParams();

  const kind: ItemKind = params.get("kind") === "lost" ? "lost" : "found";
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const color = params.get("color") ?? "";
  const zone = params.get("zone") ?? "";
  const place = params.get("place") ?? "";
  const activeFilters = FILTER_KEYS.filter((key) => params.get(key)).length;

  const update = (patch: Patch, replace = true) =>
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
  const countText = q ? t("browse.countFor", { count: total, q }) : t("browse.count", { count: total });

  const clearAll = () => {
    setSearch("");
    setDirty(false);
    update({ category: null, color: null, zone: null, place: null, q: null });
  };
  const canClear = activeFilters > 0 || Boolean(q);

  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader title={t("browse.title")} description={t("browse.lead")} />

      <Tabs value={kind} onValueChange={(id) => update({ kind: id === "found" ? null : id }, false)} className="mt-6 gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <TabsList aria-label={t("browse.tabsLabel")} className="h-9 w-full md:w-auto">
            <TabsTrigger value="found" className="px-4">
              {t("browse.foundTab")}
            </TabsTrigger>
            <TabsTrigger value="lost" className="px-4">
              {t("browse.lostTab")}
            </TabsTrigger>
          </TabsList>
          <div className="flex min-w-0 flex-1 gap-2">
            <form role="search" onSubmit={onSubmit} className="min-w-0 flex-1">
              <label htmlFor="browse-search" className="sr-only">
                {t("browse.searchLabel")}
              </label>
              <InputGroup className="h-9">
                <InputGroupAddon>
                  <Search aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
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
                />
                {search && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      onClick={() => {
                        setSearch("");
                        setDirty(false);
                        update({ q: null });
                        document.getElementById("browse-search")?.focus();
                      }}
                      aria-label={t("browse.clearSearch")}
                    >
                      <X aria-hidden />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </form>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal aria-hidden data-icon="inline-start" />
                  {t("browse.filters")}
                  {activeFilters > 0 && <Badge className="ml-0.5 h-5 min-w-5 px-1.5 tabular-nums">{activeFilters}</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[85dvh] gap-0 rounded-t-xl outline-none"
                closeLabel={t("common.close")}
                onOpenAutoFocus={focusSheet}
              >
                <SheetHeader className="border-b">
                  <SheetTitle>{t("browse.filters")}</SheetTitle>
                  <SheetDescription className="sr-only">{t("browse.filters")}</SheetDescription>
                </SheetHeader>
                <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <Filters idPrefix="sheet-filter" params={params} update={update} onClear={canClear ? clearAll : undefined} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <TabsContent value={kind} className="flex flex-col gap-6 text-base lg:flex-row lg:items-start">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:w-64 lg:shrink-0" aria-label={t("browse.filters")}>
            <Card size="sm">
              <CardContent>
                <Filters idPrefix="filter" params={params} update={update} onClear={canClear ? clearAll : undefined} />
              </CardContent>
            </Card>
          </aside>

          <section aria-labelledby="results-heading" className="min-w-0 flex-1">
            <h2 id="results-heading" className="sr-only">
              {t("browse.resultsLabel")}
            </h2>
            {kind === "lost" && (
              <Alert role="note" className="mb-4">
                <Info aria-hidden />
                <AlertDescription className="text-foreground">
                  <p>
                    {t("browse.lostTabNote")}{" "}
                    <Link to="/report/found" className="font-medium text-primary">
                      {t("item.reportFoundCta")}
                    </Link>
                  </p>
                </AlertDescription>
              </Alert>
            )}
            <p className="mb-3 min-h-5 text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
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
                    {canClear && (
                      <Button variant="outline" onClick={clearAll}>
                        {t("browse.clearFilters")}
                      </Button>
                    )}
                    <Button asChild>
                      <Link to={kind === "found" ? "/report/lost" : "/report/found"}>
                        {kind === "found" ? t("nav.reportLost") : t("nav.reportFound")}
                      </Link>
                    </Button>
                  </>
                }
              >
                {q && <p>{t("browse.emptyTip")}</p>}
                <p className={q ? "mt-2" : ""}>{kind === "found" ? t("browse.emptyCtaLost") : t("browse.emptyCtaFound")}</p>
              </EmptyState>
            ) : (
              <div className={cn("transition-opacity duration-200", query.isPlaceholderData && "opacity-60")} aria-busy={query.isFetching}>
                <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => (
                    <li key={item.id} className="flex min-w-0">
                      <ItemCard item={item} />
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <p className="text-sm text-muted-foreground">{t("browse.showing", { shown: items.length, total })}</p>
                  {query.hasNextPage && (
                    <BusyButton
                      variant="outline"
                      onClick={() => void query.fetchNextPage()}
                      busy={query.isFetchingNextPage}
                      busyLabel={t("browse.loadingMore")}
                    >
                      {t("browse.loadMore")}
                    </BusyButton>
                  )}
                  {query.isFetchNextPageError && <ErrorState compact error={query.error} onRetry={() => void query.fetchNextPage()} />}
                </div>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
