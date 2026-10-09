import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Inbox, PackageSearch } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { ClaimBadge, KindBadge, StatusBadge, ToneBadge } from "@/components/badges";
import { BusyButton } from "@/components/BusyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/form";
import { Email, ItemThumb, itemTitle, RelativeTime } from "@/components/ItemBits";
import { PageHeader } from "@/components/page";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Item as Row, ItemContent, ItemDescription, ItemMedia } from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLang } from "@/i18n";
import { api } from "@/lib/api";
import { ME_KEY, useUser } from "@/lib/auth";
import { useErrorText } from "@/lib/errors";
import { useDocumentTitle } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import { formatDateTime, formatRelative, useNow } from "@/lib/time";
import type { Claim, Item } from "@/lib/types";

function ReportRow({ item }: { item: Item }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const count = item.match_count ?? 0;
  return (
    <Row variant="outline" className="items-start bg-card" asChild>
      <Link to={`/items/${item.id}`}>
        <ItemMedia variant="image" className="size-18 rounded-full sm:size-20">
          <ItemThumb item={item} />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge kind={item.kind} />
            <StatusBadge kind={item.kind} status={item.status} />
            {item.is_hidden && <ToneBadge tone="gray">{t("admin.hiddenBadge")}</ToneBadge>}
          </div>
          <h3 className="line-clamp-2 text-base font-medium leading-snug break-words">{itemTitle(item, 100)}</h3>
          <ItemDescription className="flex flex-wrap items-center gap-x-1.5">
            <span>{labels.category(item.category)}</span>
            <span aria-hidden>·</span>
            <RelativeTime iso={item.created_at} />
            {count > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium text-primary">{t("card.matches", { count })}</span>
              </>
            )}
          </ItemDescription>
        </ItemContent>
      </Link>
    </Row>
  );
}

function ClaimRow({ claim, onCancel }: { claim: Claim; onCancel: (claim: Claim) => void }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const lang = useLang();
  const now = useNow();
  const found = claim.found;
  return (
    <Row variant="outline" className="items-start bg-card">
      <ItemMedia variant="image" className="size-18 rounded-full sm:size-20">
        {found && <ItemThumb item={found} />}
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1.5">
        <div>
          <ClaimBadge status={claim.status} />
        </div>
        {found ? (
          <h3 className="text-base font-medium leading-snug break-words">
            <Link to={`/items/${found.id}`} className="underline-offset-4 hover:underline">
              {itemTitle(found, 100)}
            </Link>
          </h3>
        ) : (
          <p className="text-sm text-muted-foreground">{t("me.itemRemoved")}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {found && <>{labels.category(found.category)} · </>}
          <time dateTime={claim.created_at} title={formatDateTime(claim.created_at, lang)}>
            {t("me.claimedOn", { time: formatRelative(claim.created_at, lang, now) })}
          </time>
        </p>
        <p className="rounded-2xl bg-cream px-3 py-2 text-sm break-words">
          <span className="text-muted-foreground">{t("me.proofLabel")}: </span>
          {claim.proof}
        </p>
        {claim.review_note && <p className="text-sm break-words">{t("item.reviewNote", { note: claim.review_note })}</p>}
        {claim.status === "approved" && <p className="text-sm font-medium text-[#285a17]">{t("item.claimApprovedBody")}</p>}
        {claim.status === "pending" && (
          <div className="pt-1">
            <Button variant="outline" size="sm" onClick={() => onCancel(claim)}>
              {t("me.cancelClaim")}
            </Button>
          </div>
        )}
      </ItemContent>
    </Row>
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
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {t("me.profile")}
        </CardTitle>
        <CardDescription>
          {t("me.signedInAs", { email: "\u0000" }).split("\u0000")[0]}
          <Email value={user.email} />
          {t("me.signedInAs", { email: "\u0000" }).split("\u0000")[1]}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <FormField id="me-name" label={t("me.name")} hint={t("me.nameHint")}>
            <Input
              id="me-name"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              aria-describedby="me-name-hint"
              autoComplete="nickname"
            />
          </FormField>
          <BusyButton
            type="submit"
            variant="outline"
            busy={mutation.isPending}
            busyLabel={t("common.saving")}
            disabled={!name.trim() || name.trim() === user.display_name}
          >
            {t("common.save")}
          </BusyButton>
          {mutation.isError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{errorText(mutation.error)}</AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function Count({ value }: { value?: number }) {
  if (value === undefined) return null;
  return (
    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 tabular-nums">
      {value}
    </Badge>
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
      <PageHeader title={t("me.title")} description={t("me.lead")} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs value={tab} onValueChange={(id) => setParams(id === "claims" ? { tab: "claims" } : {}, { replace: true })} className="min-w-0 gap-5">
          <TabsList aria-label={t("me.tabsLabel")}>
            <TabsTrigger value="reports" className="px-3">
              {t("me.reportsTab")}
              <Count value={items.data?.items.length} />
            </TabsTrigger>
            <TabsTrigger value="claims" className="px-3">
              {t("me.claimsTab")}
              <Count value={claims.data?.claims.length} />
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reports" className="text-base">
            {items.isPending ? (
              <RowsSkeleton />
            ) : items.isError ? (
              <ErrorState error={items.error} onRetry={() => void items.refetch()} />
            ) : items.data.items.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={t("me.noReports")}
                actions={
                  <>
                    <Button asChild>
                      <Link to="/report/lost">{t("home.lost")}</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/report/found">{t("home.found")}</Link>
                    </Button>
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
            )}
          </TabsContent>
          <TabsContent value="claims" className="text-base">
            {claims.isPending ? (
              <RowsSkeleton />
            ) : claims.isError ? (
              <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
            ) : claims.data.claims.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title={t("me.noClaims")}
                actions={
                  <Button asChild>
                    <Link to="/browse">{t("notFound.browse")}</Link>
                  </Button>
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
          </TabsContent>
        </Tabs>
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
        destructive
        error={cancel.isError ? errorText(cancel.error) : undefined}
      />
    </div>
  );
}
