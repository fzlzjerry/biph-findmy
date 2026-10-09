import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleX,
  EyeOff,
  Hourglass,
  Info,
  Lock,
  LogIn,
  PackageSearch,
  PartyPopper,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { KindBadge, StatusBadge } from "@/components/badges";
import { BusyButton } from "@/components/BusyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { describedBy, FormField } from "@/components/form";
import { ItemThumb, itemTitle, RelativeTime, Swatch } from "@/components/ItemBits";
import { MatchCard } from "@/components/MatchCard";
import { SectionHeader } from "@/components/page";
import { EmptyState, ErrorState, LinesSkeleton } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/i18n";
import { ApiError, api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { categoryIcon } from "@/lib/categoryIcon";
import { useErrorText } from "@/lib/errors";
import { useDocumentTitle } from "@/lib/hooks";
import { useLabels } from "@/lib/meta";
import { formatDateTime, formatWindow } from "@/lib/time";
import type { Claim, Item, ItemDetail, Match, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

// --------------------------------------------------------------------------- gallery
function Gallery({ item }: { item: Item }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const title = itemTitle(item, 60);
  if (!item.photos.length) {
    return (
      <div className="aspect-[4/3] overflow-hidden rounded-xl border">
        <ItemThumb item={item} iconClass="size-1/4" alt={t("item.noPhoto")} />
      </div>
    );
  }
  const photo = item.photos[Math.min(index, item.photos.length - 1)];
  return (
    <div>
      <a
        href={photo.url}
        target="_blank"
        rel="noopener"
        className="block aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
        title={t("item.openFull")}
      >
        <img src={photo.url} alt={`${t("report.photoN", { n: index + 1 })} · ${title}`} className="size-full object-contain" decoding="async" />
      </a>
      {item.photos.length > 1 && (
        <div className="mt-3 flex gap-2" role="group" aria-label={t("item.photos")}>
          {item.photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              aria-pressed={i === index}
              aria-label={t("item.showPhoto", { n: i + 1 })}
              onClick={() => setIndex(i)}
              className={cn(
                "size-16 overflow-hidden rounded-lg border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                i === index ? "border-primary" : "border-transparent hover:border-border",
              )}
            >
              <img src={p.thumb_url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- attributes
function Attr({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm break-words">{children}</dd>
    </div>
  );
}

function Attributes({ item }: { item: Item }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const lang = useLang();
  const Icon = categoryIcon(item.category);
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <Attr label={t("item.category")}>
        <span className="inline-flex items-center gap-1.5">
          <Icon aria-hidden className="size-4 text-muted-foreground" />
          {labels.category(item.category)}
        </span>
      </Attr>
      {item.colors.length > 0 && (
        <Attr label={t("item.colors")}>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {item.colors.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <Swatch hex={labels.colorHex(c) ?? "#ccc"} />
                {labels.color(c)}
              </span>
            ))}
          </span>
        </Attr>
      )}
      {item.brand && <Attr label={t("item.brand")}>{labels.brand(item.brand)}</Attr>}
      {item.locations.length > 0 && (
        <Attr label={item.kind === "lost" ? t("item.placesLost") : t("item.placeFound")}>
          {item.locations.map((p) => labels.place(p)).join(lang === "zh" ? "、" : ", ")}
        </Attr>
      )}
      {item.location_note && <Attr label={t("item.locationNote")}>{item.location_note}</Attr>}
      <Attr label={item.kind === "lost" ? t("item.whenLost") : t("item.whenFound")}>
        {item.kind === "lost" ? formatWindow(item.time_from, item.time_to, lang) : formatDateTime(item.time_from, lang)}
      </Attr>
      {item.kind === "found" && item.holding && (
        <Attr label={t("item.holding")}>
          {t(`holding.${item.holding}`)}
          {item.holding_note && <span className="block text-muted-foreground">{item.holding_note}</span>}
        </Attr>
      )}
      <Attr label={t("item.reported")}>
        <RelativeTime iso={item.created_at} /> <span className="text-muted-foreground">· {formatDateTime(item.created_at, lang)}</span>
      </Attr>
      {item.returned_at && <Attr label={t("status.found.returned")}>{t("item.returnedOn", { time: formatDateTime(item.returned_at, lang) })}</Attr>}
    </dl>
  );
}

// --------------------------------------------------------------------------- claim dialog
function ClaimDialog({ item, open, onClose, preselectLost }: {
  item: Item;
  open: boolean;
  onClose: () => void;
  preselectLost?: string | null;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const [proof, setProof] = useState("");
  const [lostId, setLostId] = useState("");
  const [proofError, setProofError] = useState("");

  const mine = useQuery({ queryKey: ["myItems"], queryFn: api.myItems, enabled: open });
  const lostReports = useMemo(
    () => (mine.data?.items ?? []).filter((i) => i.kind === "lost" && ["open", "matched"].includes(i.status)),
    [mine.data],
  );

  useEffect(() => {
    if (!open || !lostReports.length) return;
    setLostId((current) => {
      if (current) return current;
      if (preselectLost && lostReports.some((r) => r.id === preselectLost)) return preselectLost;
      const sameCategory = lostReports.filter((r) => r.category === item.category);
      return sameCategory.length === 1 ? sameCategory[0].id : "";
    });
  }, [open, lostReports, preselectLost, item.category]);

  const mutation = useMutation({
    mutationFn: () => api.createClaim(item.id, proof.trim(), lostId || null),
    onSuccess: ({ claim }) => {
      queryClient.setQueryData<ItemDetail>(["item", item.id], (old) =>
        old ? { ...old, item: { ...old.item, status: claim.found?.status ?? old.item.status }, my_claim: claim } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["myClaims"] });
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({ message: t("claim.sent"), tone: "success" });
      setProof("");
      onClose();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (proof.trim().length < 5) {
      setProofError(t("claim.proofTooShort"));
      document.getElementById("claim-proof")?.focus();
      return;
    }
    setProofError("");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !mutation.isPending && onClose()}>
      <DialogContent
        className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"
        closeLabel={t("common.close")}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("claim-proof")?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg">{t("claim.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("item.claimLead")}</DialogDescription>
        </DialogHeader>
        <form id="claim-form" onSubmit={submit} noValidate className="space-y-5">
          <FormField id="claim-proof" label={t("claim.proof")} hint={t("claim.proofHint")} error={proofError}>
            <Textarea
              id="claim-proof"
              className="min-h-24"
              rows={4}
              maxLength={1000}
              value={proof}
              onChange={(event) => {
                setProof(event.target.value);
                if (proofError) setProofError("");
              }}
              placeholder={t("claim.proofPlaceholder")}
              aria-invalid={Boolean(proofError) || undefined}
              aria-describedby={describedBy("claim-proof", { hint: true, error: proofError })}
              aria-required
            />
          </FormField>
          <FormField id="claim-lost" label={t("claim.linkLost")} hint={t("claim.linkHint")} optional>
            <NativeSelect
              id="claim-lost"
              className="w-full"
              value={lostId}
              onChange={(event) => setLostId(event.target.value)}
              disabled={mine.isPending}
              aria-describedby="claim-lost-hint"
            >
              <NativeSelectOption value="">{t("claim.linkNone")}</NativeSelectOption>
              {lostReports.map((report) => (
                <NativeSelectOption key={report.id} value={report.id}>
                  {labels.category(report.category)} — {itemTitle(report, 60)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <Alert role="note" className="border-primary/20 bg-primary/5">
            <BadgeCheck aria-hidden className="text-primary" />
            <AlertDescription className="text-foreground">{t("claim.pickupNote")}</AlertDescription>
          </Alert>
          {mutation.isError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden />
              <AlertDescription>{errorText(mutation.error)}</AlertDescription>
            </Alert>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <BusyButton type="submit" form="claim-form" busy={mutation.isPending} busyLabel={t("claim.submitting")}>
            {t("claim.submit")}
          </BusyButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- claim status panel
function StatusAlert({ tone = "default", icon: Icon, title, children }: {
  tone?: "default" | "success" | "error";
  icon: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Alert
      role="status"
      className={cn(
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-900",
        tone === "error" && "border-red-200 bg-red-50 text-red-900",
      )}
    >
      <Icon aria-hidden className={cn(tone === "success" ? "text-emerald-600" : tone === "error" ? "text-red-600" : "text-primary")} />
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && <AlertDescription className="text-current/80">{children}</AlertDescription>}
    </Alert>
  );
}

function ActionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card size="sm" className="bg-muted/30">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>{children}</CardFooter>
    </Card>
  );
}

function ClaimPanel({ item, claim, onClaim }: { item: Item; claim: Claim | null | undefined; onClaim: () => void }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const location = useLocation();
  const claimable = item.status === "open" || item.status === "matched";

  if (!user) {
    return (
      <ActionCard title={t("item.claimTitle")} description={t("item.loginToClaimLead")}>
        <Button asChild className="w-full sm:w-auto">
          <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>
            <LogIn aria-hidden data-icon="inline-start" />
            {t("item.loginToClaim")}
          </Link>
        </Button>
      </ActionCard>
    );
  }

  const status = claim?.status;
  if (status === "pending")
    return (
      <StatusAlert icon={Hourglass} title={t("item.claimPending")}>
        <p>{t("item.claimPendingBody")}</p>
        <p>{t("claim.pickupNote")}</p>
      </StatusAlert>
    );
  if (status === "approved")
    return (
      <StatusAlert tone="success" icon={BadgeCheck} title={t("item.claimApproved")}>
        <p>{t("item.claimApprovedBody")}</p>
        {claim?.review_note && <p>{t("item.reviewNote", { note: claim.review_note })}</p>}
      </StatusAlert>
    );
  if (status === "completed")
    return (
      <StatusAlert tone="success" icon={PartyPopper} title={t("item.claimCompleted")}>
        {t("item.claimCompletedBody")}
      </StatusAlert>
    );

  return (
    <div className="space-y-3">
      {status === "rejected" && (
        <StatusAlert tone="error" icon={CircleX} title={t("item.claimRejected")}>
          {claim?.review_note ? t("item.reviewNote", { note: claim.review_note }) : t("item.claimRejectedBody")}
        </StatusAlert>
      )}
      {status === "cancelled" && <StatusAlert icon={Info}>{t("item.claimCancelled")}</StatusAlert>}
      {claimable ? (
        <ActionCard title={t("item.claimTitle")} description={t("item.claimLead")}>
          <Button className="w-full sm:w-auto" onClick={onClaim}>
            <CircleCheck aria-hidden data-icon="inline-start" />
            {status === "rejected" || status === "cancelled" ? t("item.claimAgain") : t("item.claimButton")}
          </Button>
        </ActionCard>
      ) : (
        <StatusAlert icon={Info}>{t("item.notClaimable")}</StatusAlert>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- matches
function MatchesSection({ item, matches }: { item: Item; matches: Match[] }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const lostOwner = item.kind === "lost" && item.is_mine;

  const feedback = useMutation({
    mutationFn: ({ match, verdict }: { match: Match; verdict: Verdict | null }) => api.feedback(match.id, verdict),
    onSuccess: (data, { match }) => {
      queryClient.setQueryData<ItemDetail>(["item", item.id], (old) =>
        old ? { ...old, matches: old.matches?.map((m) => (m.id === match.id ? { ...m, feedback: data.feedback } : m)) } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["myItems"] });
      if (data.feedback) toast({ message: t("item.feedbackSaved"), tone: "success" });
    },
    onError: (error) => toast({ message: errorText(error), tone: "error" }),
  });

  // Rejected matches drop to the bottom; everything else keeps the engine's order.
  const ordered = [...matches].sort((a, b) => Number(a.feedback === "rejected") - Number(b.feedback === "rejected"));

  return (
    <section aria-labelledby="matches-title">
      <SectionHeader
        id="matches-title"
        title={item.kind === "lost" ? t("item.matchesTitleLost") : t("item.matchesTitleFound")}
        description={item.kind === "lost" ? t("item.matchesLeadLost") : t("item.matchesLeadFound")}
      />
      <div className="mt-5" aria-live="polite">
        {ordered.length === 0 ? (
          <EmptyState
            compact
            icon={PackageSearch}
            title={item.kind === "lost" ? t("item.noMatchesLost") : t("item.noMatchesFound")}
            actions={
              item.kind === "lost" && item.category ? (
                <Button asChild variant="outline">
                  <Link to={`/browse?category=${encodeURIComponent(item.category)}`}>
                    {t("item.browseCategory", { category: labels.category(item.category) })}
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {ordered.map((match) => (
              <li key={match.id}>
                <MatchCard
                  match={match}
                  lostItemId={lostOwner ? item.id : undefined}
                  canFeedback={lostOwner}
                  feedbackPending={feedback.isPending && feedback.variables?.match.id === match.id}
                  onFeedback={(verdict) => feedback.mutate({ match, verdict })}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- owner tools
function OwnerTools({ item }: { item: Item }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const errorText = useErrorText();
  const [confirming, setConfirming] = useState(false);
  const closable = ["open", "matched", "claimed"].includes(item.status);
  const mutation = useMutation({
    mutationFn: (status: "open" | "closed") => api.updateItem(item.id, { status }),
    onSuccess: (data, status) => {
      queryClient.setQueryData<ItemDetail>(["item", item.id], (old) => (old ? { ...old, item: data.item, matches: data.matches } : old));
      void queryClient.invalidateQueries({ queryKey: ["items"] });
      void queryClient.invalidateQueries({ queryKey: ["myItems"] });
      setConfirming(false);
      toast({ message: status === "closed" ? t("item.closed") : t("item.reopened"), tone: "success" });
    },
  });
  if (!closable && item.status !== "closed") return null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {t("item.ownerTools")}
        </CardTitle>
        {item.kind === "found" && <CardDescription>{t("item.ownFoundNote")}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div>
          {closable ? (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              {t("item.closeReport")}
            </Button>
          ) : (
            <BusyButton variant="outline" busy={mutation.isPending} busyLabel={t("item.reopening")} onClick={() => mutation.mutate("open")}>
              {t("item.reopen")}
            </BusyButton>
          )}
        </div>
        {mutation.isError && !confirming && (
          <p role="alert" className="text-sm text-destructive">
            {errorText(mutation.error)}
          </p>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => mutation.mutate("closed")}
        title={t("item.closeConfirmTitle")}
        description={t("item.closeConfirmBody")}
        confirmLabel={t("item.closeConfirm")}
        busyLabel={t("item.closing")}
        busy={mutation.isPending}
        destructive
        error={mutation.isError ? errorText(mutation.error) : undefined}
      />
    </Card>
  );
}

// --------------------------------------------------------------------------- page
export default function ItemPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { user, isAdmin } = useUser();
  const isNew = params.get("new") === "1";
  const wantsClaim = params.get("claim") === "1";
  const [claimOpen, setClaimOpen] = useState(false);

  const query = useQuery({
    queryKey: ["item", id],
    queryFn: ({ signal }) => api.getItem(id, signal),
    enabled: Boolean(id),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
  const detail = query.data;
  useDocumentTitle(detail ? itemTitle(detail.item, 50) : undefined);

  const canClaim =
    Boolean(user) &&
    detail?.item.kind === "found" &&
    !detail.item.is_mine &&
    ["open", "matched"].includes(detail.item.status) &&
    !["pending", "approved", "completed"].includes(detail.my_claim?.status ?? "");

  // "/items/:id?claim=1" (from a confirmed match) opens the claim dialog straight away.
  useEffect(() => {
    if (!wantsClaim || !detail) return;
    if (canClaim) setClaimOpen(true);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("claim");
        return next;
      },
      { replace: true },
    );
  }, [wantsClaim, detail, canClaim, setParams]);

  if (query.isPending)
    return (
      <div className="container-page py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Skeleton className="aspect-[4/3] rounded-xl" />
          <div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-8 w-full max-w-md" />
            <LinesSkeleton lines={6} className="mt-6" />
          </div>
        </div>
      </div>
    );

  if (query.isError) {
    const missing = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 422);
    return (
      <div className="container-page py-10">
        {missing ? (
          <EmptyState
            icon={SearchX}
            title={t("item.notFoundTitle")}
            actions={
              <Button asChild>
                <Link to="/browse">{t("notFound.browse")}</Link>
              </Button>
            }
          >
            {t("item.notFoundBody")}
          </EmptyState>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const { item, matches, my_claim } = query.data;
  // Return to the exact list (tab, search, filters) the visitor came from.
  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from?.startsWith("/browse") ? from : item.kind === "lost" ? "/browse?kind=lost" : "/browse";
  const showMatches = matches !== undefined && (item.is_mine || isAdmin);
  const matchesSection = showMatches ? <MatchesSection item={item} matches={matches} /> : null;
  const matchCount = matches?.length ?? 0;
  const justPosted = isNew && item.is_mine;
  // Without a title the heading already shows the (short) description — don't print it twice.
  const descriptionIsTitle = !item.title?.trim() && itemTitle(item, 80) === item.description.replace(/\s+/g, " ").trim();

  return (
    <div className="container-page py-6 sm:py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2.5 text-muted-foreground">
        <Link to={backTo}>
          <ArrowLeft aria-hidden data-icon="inline-start" />
          {t("item.back")}
        </Link>
      </Button>

      {justPosted && (
        <div className="mt-4 space-y-8">
          <StatusAlert tone="success" icon={CircleCheck} title={t("item.postedTitle")}>
            {item.kind === "found"
              ? matchCount > 0
                ? t("item.postedMatches", { count: matchCount })
                : t("item.postedFoundThanks")
              : matchCount > 0
                ? t("item.postedMatches", { count: matchCount })
                : t("item.postedNoMatches")}
          </StatusAlert>
          {matchesSection}
        </div>
      )}

      {item.is_hidden && (
        <Alert role="note" className="mt-4 border-amber-200 bg-amber-50 text-amber-900">
          <EyeOff aria-hidden />
          <AlertDescription className="text-current/80">{t("item.hiddenNotice")}</AlertDescription>
        </Alert>
      )}

      <article
        aria-labelledby="item-title"
        className={cn("grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10", justPosted ? "mt-10 border-t pt-8" : "mt-4")}
      >
        <div className="min-w-0">
          <Gallery item={item} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={item.kind} />
            <StatusBadge kind={item.kind} status={item.status} />
          </div>
          <h1 id="item-title" className="mt-3 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
            {itemTitle(item, 80)}
          </h1>

          <Card size="sm" className="mt-6">
            <CardContent>
              <Attributes item={item} />
            </CardContent>
          </Card>

          {(!descriptionIsTitle || item.marks_text || item.private_detail || (isAdmin && item.reporter)) && (
            <div className="mt-6 space-y-4">
              {!descriptionIsTitle && (
                <div>
                  <h2 className="text-sm font-medium">{t("item.description")}</h2>
                  <p className="mt-1.5 leading-relaxed break-words whitespace-pre-line">{item.description}</p>
                </div>
              )}
              {item.marks_text && (
                <div>
                  <h2 className="text-sm font-medium">{t("item.marks")}</h2>
                  <p className="mt-1.5 leading-relaxed break-words whitespace-pre-line">{item.marks_text}</p>
                </div>
              )}
              {item.private_detail && (
                <Alert role="note" className="border-primary/20 bg-primary/5">
                  <Lock aria-hidden className="text-primary" />
                  <AlertTitle>{t("item.privateDetail")}</AlertTitle>
                  <AlertDescription className="text-foreground">{item.private_detail}</AlertDescription>
                </Alert>
              )}
              {isAdmin && item.reporter && (
                <p className="text-sm text-muted-foreground">
                  {t("admin.reporter")}: <span className="font-medium text-foreground">{item.reporter.display_name}</span> · {item.reporter.email}
                </p>
              )}
            </div>
          )}

          <Separator className="my-6" />

          <div className="space-y-4">
            {item.is_mine ? (
              <OwnerTools item={item} />
            ) : item.kind === "found" ? (
              <ClaimPanel item={item} claim={my_claim} onClaim={() => setClaimOpen(true)} />
            ) : (
              <ActionCard title={t("item.lostByOtherTitle")} description={t("item.lostByOtherBody")}>
                <Button asChild variant="outline">
                  <Link to="/report/found">{t("item.reportFoundCta")}</Link>
                </Button>
              </ActionCard>
            )}
          </div>
        </div>
      </article>

      {!justPosted && matchesSection && <div className="mt-12 border-t pt-8">{matchesSection}</div>}

      {item.kind === "found" && !item.is_mine && user && (
        <ClaimDialog item={item} open={claimOpen} onClose={() => setClaimOpen(false)} preselectLost={params.get("lost")} />
      )}
    </div>
  );
}
