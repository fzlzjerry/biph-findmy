import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, PackageOpen, PackageX } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ItemThumb, itemTitle, RelativeTime } from "@/components/ItemBits";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useLang } from "@/i18n";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useErrorText } from "@/lib/errors";
import { useLabels } from "@/lib/meta";
import { formatRelative, useNow } from "@/lib/time";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DropoffSelect } from "./DropoffSelect";

type Action = { action: "present" | "gone" | "move"; to?: string };

function CheckRow({ item, dropoff }: { item: Item; dropoff: string }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const lang = useLang();
  const now = useNow();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const title = itemTitle(item, 80);
  const mutation = useMutation({
    mutationFn: ({ action, to }: Action) => api.admin.check(item.id, action, to),
    onSuccess: (_, { action, to }) => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      const message =
        action === "present"
          ? t("admin.check.confirmed")
          : action === "gone"
            ? t("admin.check.goneDone")
            : t("admin.check.moved", { place: labels.dropoffLabel(to) ?? to });
      toast({ message, tone: "success" });
    },
    onError: (error) => toast({ message: errorText(error), tone: "error" }),
  });
  const moveId = `move-${item.id}`;

  return (
    <Card size="sm" className="py-3" data-testid="check-row">
      <CardContent className="flex flex-col gap-3 px-3 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <Link to={`/items/${item.id}`} tabIndex={-1} aria-hidden className="block size-14 shrink-0 overflow-hidden rounded-full">
            <ItemThumb item={item} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={`/items/${item.id}`} className="block font-medium leading-snug break-words underline-offset-4 hover:underline">
              {title}
            </Link>
            <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-sm text-muted-foreground">
              <span>{labels.category(item.category)}</span>
              {!dropoff && labels.dropoffLabel(item.holding) && (
                <>
                  <span aria-hidden>·</span>
                  <span>{labels.dropoffLabel(item.holding)}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <RelativeTime iso={item.created_at} />
            </p>
            <p className={cn("text-sm", item.checked_at ? "text-muted-foreground" : "font-medium")}>
              {item.checked_at
                ? t("admin.check.lastChecked", { time: formatRelative(item.checked_at, lang, now) })
                : t("admin.check.neverChecked")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "present" })} aria-label={`${t("admin.check.present")}: ${title}`}>
            <CircleCheck aria-hidden data-icon="inline-start" />
            {t("admin.check.present")}
          </Button>
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ action: "gone" })} aria-label={`${t("admin.check.gone")}: ${title}`}>
            <PackageX aria-hidden data-icon="inline-start" />
            {t("admin.check.gone")}
          </Button>
          <label htmlFor={moveId} className="sr-only">
            {t("admin.check.moveLabel", { item: title })}
          </label>
          <NativeSelect
            id={moveId}
            size="sm"
            className="min-w-36"
            value=""
            disabled={mutation.isPending}
            onChange={(event) => event.target.value && mutation.mutate({ action: "move", to: event.target.value })}
          >
            <NativeSelectOption value="">{t("admin.check.moveTo")}</NativeSelectOption>
            {labels.meta.dropoffs
              .filter((d) => d.id !== labels.dropoff(item.holding)?.id)
              .map((d) => (
                <NativeSelectOption key={d.id} value={d.id}>
                  {labels.text(d.label)}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </div>
      </CardContent>
    </Card>
  );
}

/** The desk's daily round: everything still waiting at a desk or shelf, least recently confirmed first. */
export default function CheckTab() {
  const { t } = useTranslation();
  const { user } = useUser();
  const labels = useLabels();
  const [dropoff, setDropoff] = useState(() => user?.desk ?? labels.meta.dropoffs[0]?.id ?? "");
  const query = useQuery({
    queryKey: ["admin", "inventory", dropoff],
    queryFn: () => api.admin.inventory(dropoff),
    placeholderData: keepPreviousData,
  });
  const count = query.data?.items.length ?? 0;

  return (
    <div>
      <p className="max-w-prose text-muted-foreground">{t("admin.check.lead")}</p>
      <div className="mt-4">
        <DropoffSelect
          id="check-dropoff"
          label={t("admin.check.dropoff")}
          value={dropoff}
          onChange={setDropoff}
          allLabel={t("admin.allDropoffs")}
          className="w-full sm:w-72"
        />
      </div>
      <p className="mt-5 min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {query.isSuccess ? t("admin.check.count", { count }) : ""}
      </p>
      <div className="mt-3">
        {query.isPending ? (
          <RowsSkeleton />
        ) : query.isError && !query.data ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : count === 0 ? (
          <EmptyState compact icon={PackageOpen} title={t("admin.check.empty")} />
        ) : (
          <ul className={cn("space-y-2 transition-opacity", query.isPlaceholderData && "opacity-60")}>
            {query.data.items.map((item) => (
              <li key={item.id}>
                <CheckRow item={item} dropoff={dropoff} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
