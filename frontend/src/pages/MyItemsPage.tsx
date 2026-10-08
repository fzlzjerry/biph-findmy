import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, PackageSearch } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { ConfirmDialog } from "../components/Dialog";
import { ItemThumb, itemTitle, RelativeTime } from "../components/ItemBits";
import { EmptyState, ErrorState, RowsSkeleton } from "../components/States";
import { TabPanel, Tabs } from "../components/Tabs";
import { useToast } from "../components/Toast";
import { Badge, Button, buttonClass, ClaimBadge, KindBadge, PageHeader, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { ME_KEY, useUser } from "../lib/auth";
import { useErrorText } from "../lib/errors";
import { useDocumentTitle } from "../lib/hooks";
import { useLabels } from "../lib/meta";
import { formatDateTime, formatRelative, useNow } from "../lib/time";
import { useLang } from "../i18n";
import type { Claim, Item } from "../lib/types";

function ReportRow({ item }: { item: Item }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const count = item.match_count ?? 0;
  return (
    <Link
      to={`/items/${item.id}`}
      className="group flex gap-3 rounded-md border border-line p-3 transition-colors hover:border-line-strong sm:gap-4"
    >
      <div className="size-20 shrink-0 overflow-hidden rounded-sm bg-surface sm:size-24">
        <ItemThumb item={item} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadge kind={item.kind} />
          <StatusBadge kind={item.kind} status={item.status} />
          {item.is_hidden && <Badge tone="neutral">{t("admin.hiddenBadge")}</Badge>}
        </div>
        <h3 className="mt-1.5 line-clamp-2 break-words font-semibold leading-snug text-ink group-hover:text-brand-deep group-hover:underline">
          {itemTitle(item, 100)}
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          <span>{labels.category(item.category)}</span>
          <span aria-hidden>·</span>
          <RelativeTime iso={item.created_at} />
          {count > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="font-semibold text-brand-deep">{t("card.matches", { count })}</span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

function ClaimRow({ claim, onCancel }: { claim: Claim; onCancel: (claim: Claim) => void }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const lang = useLang();
  const now = useNow();
  const found = claim.found;
  return (
    <div className="flex gap-3 rounded-md border border-line p-3 sm:gap-4">
      <div className="size-20 shrink-0 overflow-hidden rounded-sm bg-surface sm:size-24">{found && <ItemThumb item={found} />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <ClaimBadge status={claim.status} />
        </div>
        {found ? (
          <h3 className="mt-1.5 break-words font-semibold leading-snug text-ink">
            <Link to={`/items/${found.id}`} className="hover:text-brand-deep hover:underline">
              {itemTitle(found, 100)}
            </Link>
          </h3>
        ) : (
          <p className="mt-1.5 text-sm text-muted">{t("me.itemRemoved")}</p>
        )}
        <p className="mt-0.5 text-sm text-muted">
          {found && <>{labels.category(found.category)} · </>}
          <time dateTime={claim.created_at} title={formatDateTime(claim.created_at, lang)}>
            {t("me.claimedOn", { time: formatRelative(claim.created_at, lang, now) })}
          </time>
        </p>
        <p className="mt-2 break-words text-sm text-ink">
          <span className="font-medium text-muted">{t("me.proofLabel")}: </span>
          {claim.proof}
        </p>
        {claim.review_note && (
          <p className="mt-1 break-words text-sm text-ink">{t("item.reviewNote", { note: claim.review_note })}</p>
        )}
        {claim.status === "approved" && <p className="mt-2 text-sm font-semibold text-success">{t("item.claimApprovedBody")}</p>}
        {claim.status === "pending" && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => onCancel(claim)}>
            {t("me.cancelClaim")}
          </Button>
        )}
      </div>
    </div>
  );
}

function ProfileForm() {
  const { t } = useTranslation();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const [name, setName] = useState(user?.display_name ?? "");
  useEffect(() => setName(user?.display_name ?? ""), [user?.display_name]);
  const mutation = useMutation({
    mutationFn: (displayName: string) => api.updateMe(displayName),
    onSuccess: (data) => {
      queryClient.setQueryData(ME_KEY, data);
      toast({ message: t("me.nameSaved"), tone: "success" });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) mutation.mutate(name.trim());
  };
  if (!user) return null;
  return (
    <form onSubmit={submit} className="rounded-md bg-surface p-4 sm:p-5">
      <h2 className="text-base font-semibold text-ink">{t("me.profile")}</h2>
      <p className="mt-0.5 break-all text-sm text-muted">{t("me.signedInAs", { email: user.email })}</p>
      <label htmlFor="me-name" className="mt-4 block text-sm font-semibold text-ink">
        {t("me.name")}
      </label>
      <p id="me-name-hint" className="mt-0.5 text-sm text-muted">
        {t("me.nameHint")}
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="me-name"
          className="field-control sm:max-w-xs"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          aria-describedby="me-name-hint"
          autoComplete="nickname"
        />
        <Button
          type="submit"
          variant="secondary"
          busy={mutation.isPending}
          busyLabel={t("common.saving")}
          disabled={!name.trim() || name.trim() === user.display_name}
        >
          {t("common.save")}
        </Button>
      </div>
      {mutation.isError && (
        <p role="alert" className="mt-2 text-sm text-alert-deep">
          {errorText(mutation.error)}
        </p>
      )}
    </form>
  );
}

export default function MyItemsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("me.title"));
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "claims" ? "claims" : "reports";
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const [cancelling, setCancelling] = useState<Claim | null>(null);

  const items = useQuery({ queryKey: ["myItems"], queryFn: api.myItems });
  const claims = useQuery({ queryKey: ["myClaims"], queryFn: api.myClaims });

  const cancel = useMutation({
    mutationFn: (claim: Claim) => api.cancelClaim(claim.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myClaims"] });
      void queryClient.invalidateQueries({ queryKey: ["item"] });
      setCancelling(null);
      toast({ message: t("me.cancelled"), tone: "success" });
    },
  });

  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader title={t("me.title")} lead={t("me.lead")} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs
            idPrefix="me"
            label={t("me.tabsLabel")}
            value={tab}
            onChange={(id) => setParams(id === "claims" ? { tab: "claims" } : {}, { replace: true })}
            items={[
              { id: "reports", label: t("me.reportsTab"), extra: items.data ? <span className="text-sm opacity-80">{items.data.items.length}</span> : null },
              { id: "claims", label: t("me.claimsTab"), extra: claims.data ? <span className="text-sm opacity-80">{claims.data.claims.length}</span> : null },
            ]}
          />
          <TabPanel idPrefix="me" activeId={tab} className="mt-5">
            {tab === "reports" ? (
              items.isPending ? (
                <RowsSkeleton />
              ) : items.isError ? (
                <ErrorState error={items.error} onRetry={() => void items.refetch()} />
              ) : items.data.items.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title={t("me.noReports")}
                  actions={
                    <>
                      <Link to="/report/lost" className={buttonClass("primary")}>
                        {t("home.lost")}
                      </Link>
                      <Link to="/report/found" className={buttonClass("secondary")}>
                        {t("home.found")}
                      </Link>
                    </>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {items.data.items.map((item) => (
                    <li key={item.id}>
                      <ReportRow item={item} />
                    </li>
                  ))}
                </ul>
              )
            ) : claims.isPending ? (
              <RowsSkeleton />
            ) : claims.isError ? (
              <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
            ) : claims.data.claims.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title={t("me.noClaims")}
                actions={
                  <Link to="/browse" className={buttonClass("primary")}>
                    {t("notFound.browse")}
                  </Link>
                }
              >
                {t("me.noClaimsHint")}
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {claims.data.claims.map((claim) => (
                  <li key={claim.id}>
                    <ClaimRow claim={claim} onCancel={setCancelling} />
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        </div>
        <aside>
          <ProfileForm />
        </aside>
      </div>
      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => {
          setCancelling(null);
          cancel.reset();
        }}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
        title={t("me.cancelConfirmTitle")}
        description={t("me.cancelConfirmBody")}
        confirmLabel={t("me.cancelClaim")}
        busyLabel={t("me.cancelling")}
        busy={cancel.isPending}
        variant="danger"
        error={cancel.isError ? errorText(cancel.error) : undefined}
      />
    </div>
  );
}
