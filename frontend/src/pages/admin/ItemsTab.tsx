import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, PackageCheck, Search, SearchX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { KindBadge, ToneBadge } from "@/components/badges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Email, ItemThumb, itemTitle, RelativeTime } from "@/components/ItemBits";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api, type AdminItemQuery } from "@/lib/api";
import { useErrorText } from "@/lib/errors";
import { useLabels } from "@/lib/meta";
import type { Item, ItemStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DropoffSelect } from "./DropoffSelect";

const STATUSES: ItemStatus[] = ["open", "matched", "claimed", "returned", "closed", "expired"];

function ItemRow({ item, onReturn }: { item: Item; onReturn: (item: Item) => void }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const patch = useMutation({
    mutationFn: (body: { status?: ItemStatus; is_hidden?: boolean }) => api.admin.patchItem(item.id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({ message: t("admin.updated"), tone: "success" });
    },
    onError: (error) => toast({ message: errorText(error), tone: "error" }),
  });
  const title = itemTitle(item, 80);
  const selectId = `status-${item.id}`;

  return (
    <Card size="sm" className="py-3">
      <CardContent className="flex flex-col gap-3 px-3 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <Link to={`/items/${item.id}`} tabIndex={-1} aria-hidden className="block size-14 shrink-0 overflow-hidden rounded-full">
            <ItemThumb item={item} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <KindBadge kind={item.kind} />
              {item.is_hidden && (
                <ToneBadge tone="red" icon={EyeOff}>
                  {t("admin.hiddenBadge")}
                </ToneBadge>
              )}
            </div>
            <Link to={`/items/${item.id}`} className="mt-1 block font-medium leading-snug break-words underline-offset-4 hover:underline">
              {title}
            </Link>
            <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-sm text-muted-foreground">
              <span>{labels.category(item.category)}</span>
              {item.kind === "found" && labels.dropoffLabel(item.holding) && (
                <>
                  <span aria-hidden>·</span>
                  <span>{labels.dropoffLabel(item.holding)}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <RelativeTime iso={item.created_at} />
              {item.reporter && (
                <>
                  <span aria-hidden>·</span>
                  <span className="min-w-0">
                    {item.reporter.display_name} (<Email value={item.reporter.email} />)
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <label htmlFor={selectId} className="sr-only">
            {t("admin.statusFor", { item: title })}
          </label>
          <NativeSelect
            id={selectId}
            size="sm"
            className="min-w-36"
            value={item.status}
            disabled={patch.isPending}
            onChange={(event) => patch.mutate({ status: event.target.value as ItemStatus })}
          >
            {STATUSES.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {t(`status.${item.kind}.${status}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            variant="outline"
            size="sm"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ is_hidden: !item.is_hidden })}
            aria-label={`${item.is_hidden ? t("admin.unhide") : t("admin.hide")}: ${title}`}
          >
            {item.is_hidden ? <Eye aria-hidden data-icon="inline-start" /> : <EyeOff aria-hidden data-icon="inline-start" />}
            {item.is_hidden ? t("admin.unhide") : t("admin.hide")}
          </Button>
          {item.kind === "found" && item.status !== "returned" && (
            <Button variant="outline" size="sm" onClick={() => onReturn(item)} aria-label={`${t("admin.markReturned")}: ${title}`}>
              <PackageCheck aria-hidden data-icon="inline-start" />
              {t("admin.markReturned")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ItemsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const [filters, setFilters] = useState<AdminItemQuery>({ kind: "all", status: "all", hidden: "", q: "", dropoff: "" });
  const [search, setSearch] = useState("");
  const [returning, setReturning] = useState<Item | null>(null);

  const query = useQuery({
    queryKey: ["admin", "items", filters],
    queryFn: () => api.admin.items(filters),
    placeholderData: keepPreviousData,
  });

  const markReturned = useMutation({
    mutationFn: (item: Item) => api.admin.returned(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["item"] });
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      setReturning(null);
      toast({ message: t("admin.returnedDone"), tone: "success" });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFilters((f) => ({ ...f, q: search.trim() }));
  };

  const count = query.data?.items.length ?? 0;

  return (
    <div>
      <Card size="sm">
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,10rem))_minmax(0,1fr)]">
            <div className="grid gap-2">
              <Label htmlFor="admin-kind">{t("admin.filterKind")}</Label>
              <NativeSelect
                id="admin-kind"
                className="w-full"
                value={filters.kind}
                onChange={(event) => setFilters((f) => ({ ...f, kind: event.target.value as AdminItemQuery["kind"] }))}
              >
                <NativeSelectOption value="all">{t("admin.all")}</NativeSelectOption>
                <NativeSelectOption value="found">{t("kind.found")}</NativeSelectOption>
                <NativeSelectOption value="lost">{t("kind.lost")}</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-status">{t("admin.filterStatus")}</Label>
              <NativeSelect
                id="admin-status"
                className="w-full"
                value={filters.status}
                onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
              >
                <NativeSelectOption value="all">{t("admin.allStatuses")}</NativeSelectOption>
                {STATUSES.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {t(`status.found.${status}`)} / {t(`status.lost.${status}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-hidden">{t("admin.filterHidden")}</Label>
              <NativeSelect
                id="admin-hidden"
                className="w-full"
                value={filters.hidden}
                onChange={(event) => setFilters((f) => ({ ...f, hidden: event.target.value as AdminItemQuery["hidden"] }))}
              >
                <NativeSelectOption value="">{t("admin.all")}</NativeSelectOption>
                <NativeSelectOption value="false">{t("admin.visible")}</NativeSelectOption>
                <NativeSelectOption value="true">{t("admin.hidden")}</NativeSelectOption>
              </NativeSelect>
            </div>
            <DropoffSelect
              id="admin-dropoff"
              label={t("admin.filterDropoff")}
              value={filters.dropoff ?? ""}
              onChange={(dropoff) => setFilters((f) => ({ ...f, dropoff }))}
              allLabel={t("admin.allDropoffs")}
            />
            <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="admin-search">{t("admin.searchLabel")}</Label>
              <div className="flex gap-2">
                <InputGroup className="min-w-0 flex-1">
                  <InputGroupAddon>
                    <Search aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput id="admin-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
                </InputGroup>
                <Button type="submit" variant="secondary">
                  {t("admin.search")}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="mt-5 min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {query.isSuccess ? t("admin.itemsCount", { count }) : ""}
      </p>
      <div className="mt-3">
        {query.isPending ? (
          <RowsSkeleton />
        ) : query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : count === 0 ? (
          <EmptyState compact icon={SearchX} title={t("admin.itemsEmpty")} />
        ) : (
          <ul className={cn("space-y-2 transition-opacity", query.isPlaceholderData && "opacity-60")}>
            {query.data.items.map((item) => (
              <li key={item.id}>
                <ItemRow item={item} onReturn={setReturning} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={returning !== null}
        onClose={() => {
          setReturning(null);
          markReturned.reset();
        }}
        onConfirm={() => returning && markReturned.mutate(returning)}
        title={t("admin.returnedConfirmTitle")}
        description={t("admin.returnedConfirmBody")}
        confirmLabel={t("admin.returnedConfirm")}
        busyLabel={t("admin.markingReturned")}
        busy={markReturned.isPending}
        error={markReturned.isError ? errorText(markReturned.error) : undefined}
      />
    </div>
  );
}
