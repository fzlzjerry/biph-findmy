import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, PackageCheck, Search, SearchX } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ConfirmDialog } from "../../components/Dialog";
import { ItemThumb, itemTitle, RelativeTime } from "../../components/ItemBits";
import { EmptyState, ErrorState, RowsSkeleton } from "../../components/States";
import { useToast } from "../../components/Toast";
import { Badge, Button, KindBadge } from "../../components/ui";
import { api, type AdminItemQuery } from "../../lib/api";
import { useErrorText } from "../../lib/errors";
import { useLabels } from "../../lib/meta";
import type { Item, ItemStatus } from "../../lib/types";

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
    <div className="flex flex-col gap-3 rounded-md border border-line p-3 md:flex-row md:items-center md:gap-4">
      <div className="flex min-w-0 flex-1 gap-3">
        <Link to={`/items/${item.id}`} tabIndex={-1} aria-hidden className="block size-16 shrink-0 overflow-hidden rounded-sm bg-surface">
          <ItemThumb item={item} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge kind={item.kind} />
            {item.is_hidden && (
              <Badge tone="alert" icon={EyeOff}>
                {t("admin.hiddenBadge")}
              </Badge>
            )}
          </div>
          <Link to={`/items/${item.id}`} className="mt-1 block break-words font-semibold leading-snug text-ink hover:text-brand-deep hover:underline">
            {title}
          </Link>
          <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-sm text-muted">
            <span>{labels.category(item.category)}</span>
            <span aria-hidden>·</span>
            <RelativeTime iso={item.created_at} />
            {item.reporter && (
              <>
                <span aria-hidden>·</span>
                <span className="break-all">
                  {item.reporter.display_name} ({item.reporter.email})
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
        <select
          id={selectId}
          className="field-control w-auto min-w-40 py-2"
          value={item.status}
          disabled={patch.isPending}
          onChange={(event) => patch.mutate({ status: event.target.value as ItemStatus })}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${item.kind}.${status}`)}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          icon={item.is_hidden ? Eye : EyeOff}
          disabled={patch.isPending}
          onClick={() => patch.mutate({ is_hidden: !item.is_hidden })}
          aria-label={`${item.is_hidden ? t("admin.unhide") : t("admin.hide")}: ${title}`}
        >
          {item.is_hidden ? t("admin.unhide") : t("admin.hide")}
        </Button>
        {item.kind === "found" && item.status !== "returned" && (
          <Button variant="secondary" size="sm" icon={PackageCheck} onClick={() => onReturn(item)} aria-label={`${t("admin.markReturned")}: ${title}`}>
            {t("admin.markReturned")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ItemsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const [filters, setFilters] = useState<AdminItemQuery>({ kind: "all", status: "all", hidden: "", q: "" });
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
      <form onSubmit={submit} className="grid gap-3 rounded-md bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,10rem))_minmax(0,1fr)]">
        <div>
          <label htmlFor="admin-kind" className="text-sm font-semibold text-ink">
            {t("admin.filterKind")}
          </label>
          <select
            id="admin-kind"
            className="field-control mt-1.5"
            value={filters.kind}
            onChange={(event) => setFilters((f) => ({ ...f, kind: event.target.value as AdminItemQuery["kind"] }))}
          >
            <option value="all">{t("admin.all")}</option>
            <option value="found">{t("kind.found")}</option>
            <option value="lost">{t("kind.lost")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="admin-status" className="text-sm font-semibold text-ink">
            {t("admin.filterStatus")}
          </label>
          <select
            id="admin-status"
            className="field-control mt-1.5"
            value={filters.status}
            onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value }))}
          >
            <option value="all">{t("admin.allStatuses")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.found.${status}`)} / {t(`status.lost.${status}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-hidden" className="text-sm font-semibold text-ink">
            {t("admin.filterHidden")}
          </label>
          <select
            id="admin-hidden"
            className="field-control mt-1.5"
            value={filters.hidden}
            onChange={(event) => setFilters((f) => ({ ...f, hidden: event.target.value as AdminItemQuery["hidden"] }))}
          >
            <option value="">{t("admin.all")}</option>
            <option value="false">{t("admin.visible")}</option>
            <option value="true">{t("admin.hidden")}</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="admin-search" className="text-sm font-semibold text-ink">
            {t("admin.searchLabel")}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="admin-search"
              type="search"
              className="field-control min-w-0 flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button type="submit" variant="secondary" icon={Search}>
              {t("admin.search")}
            </Button>
          </div>
        </div>
      </form>

      <p className="mt-5 min-h-6 text-[0.9375rem] font-medium text-muted" aria-live="polite">
        {query.isSuccess ? t("admin.itemsCount", { count }) : ""}
      </p>
      <div className="mt-2">
        {query.isPending ? (
          <RowsSkeleton />
        ) : query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : count === 0 ? (
          <EmptyState compact icon={SearchX} title={t("admin.itemsEmpty")} />
        ) : (
          <ul className={`space-y-2 transition-opacity ${query.isPlaceholderData ? "opacity-60" : ""}`}>
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
