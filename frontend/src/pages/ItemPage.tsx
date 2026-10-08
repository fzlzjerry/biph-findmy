import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  CircleCheck,
  CircleX,
  EyeOff,
  Hourglass,
  Lock,
  LogIn,
  PackageSearch,
  PartyPopper,
  SearchX,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { ConfirmDialog, Dialog } from "../components/Dialog";
import { ItemThumb, itemTitle, RelativeTime, Swatch } from "../components/ItemBits";
import { MatchCard } from "../components/MatchCard";
import { EmptyState, ErrorState, LinesSkeleton } from "../components/States";
import { useToast } from "../components/Toast";
import { Button, buttonClass, describedBy, Field, KindBadge, Notice, StatusBadge } from "../components/ui";
import { useLang } from "../i18n";
import { ApiError, api } from "../lib/api";
import { useUser } from "../lib/auth";
import { categoryIcon } from "../lib/categoryIcon";
import { useErrorText } from "../lib/errors";
import { useDocumentTitle } from "../lib/hooks";
import { useLabels } from "../lib/meta";
import { formatDateTime, formatWindow } from "../lib/time";
import type { Claim, Item, ItemDetail, Match, Verdict } from "../lib/types";

// --------------------------------------------------------------------------- gallery
function Gallery({ item }: { item: Item }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const title = itemTitle(item, 60);
  if (!item.photos.length) {
    return (
      <div className="aspect-[4/3] overflow-hidden rounded-md border border-line">
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
        className="block aspect-[4/3] overflow-hidden rounded-md border border-line bg-surface"
        title={t("item.openFull")}
      >
        <img
          src={photo.url}
          alt={`${t("report.photoN", { n: index + 1 })} · ${title}`}
          className="h-full w-full object-contain"
          decoding="async"
        />
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
              className={`size-16 overflow-hidden rounded-sm border-2 ${i === index ? "border-brand" : "border-transparent hover:border-line-strong"}`}
            >
              <img src={p.thumb_url} alt="" className="h-full w-full object-cover" />
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
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[0.9375rem] text-ink">{children}</dd>
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
          <Icon aria-hidden className="size-4 text-brand" />
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
          {item.holding_note && <span className="block text-sm text-muted">{item.holding_note}</span>}
        </Attr>
      )}
      <Attr label={t("item.reported")}>
        <RelativeTime iso={item.created_at} /> <span className="text-sm text-muted">· {formatDateTime(item.created_at, lang)}</span>
      </Attr>
      {item.returned_at && (
        <Attr label={t("status.found.returned")}>{t("item.returnedOn", { time: formatDateTime(item.returned_at, lang) })}</Attr>
      )}
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
    <Dialog open={open} onClose={onClose} title={t("claim.dialogTitle")} description={t("item.claimLead")} busy={mutation.isPending}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field id="claim-proof" label={t("claim.proof")} hint={t("claim.proofHint")} error={proofError}>
          <textarea
            id="claim-proof"
            data-autofocus
            className="field-control"
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
        </Field>
        <Field id="claim-lost" label={t("claim.linkLost")} hint={t("claim.linkHint")} optional>
          <select
            id="claim-lost"
            className="field-control"
            value={lostId}
            onChange={(event) => setLostId(event.target.value)}
            disabled={mine.isPending}
            aria-describedby="claim-lost-hint"
          >
            <option value="">{t("claim.linkNone")}</option>
            {lostReports.map((report) => (
              <option key={report.id} value={report.id}>
                {labels.category(report.category)} — {itemTitle(report, 60)}
              </option>
            ))}
          </select>
        </Field>
        <p className="flex items-start gap-2 rounded-sm bg-mist px-3 py-2.5 text-sm text-ink">
          <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          {t("claim.pickupNote")}
        </p>
        {mutation.isError && (
          <Notice tone="error" role="alert">
            {errorText(mutation.error)}
          </Notice>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" busy={mutation.isPending} busyLabel={t("claim.submitting")}>
            {t("claim.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// --------------------------------------------------------------------------- claim status panel
function ClaimPanel({ item, claim, onClaim }: { item: Item; claim: Claim | null | undefined; onClaim: () => void }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const location = useLocation();
  const claimable = item.status === "open" || item.status === "matched";

  if (!user) {
    return (
      <div className="rounded-md bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">{t("item.claimTitle")}</h2>
        <p className="mt-1 text-[0.9375rem] text-muted">{t("item.loginToClaimLead")}</p>
        <Link
          to={`/login?next=${encodeURIComponent(location.pathname)}`}
          className={buttonClass("primary", "md", "mt-4 w-full sm:w-auto")}
        >
          <LogIn aria-hidden />
          {t("item.loginToClaim")}
        </Link>
      </div>
    );
  }

  const status = claim?.status;
  if (status === "pending")
    return (
      <Notice icon={Hourglass} title={t("item.claimPending")} role="status">
        {t("item.claimPendingBody")}
        <span className="mt-1 block">{t("claim.pickupNote")}</span>
      </Notice>
    );
  if (status === "approved")
    return (
      <Notice tone="success" icon={BadgeCheck} title={t("item.claimApproved")} role="status">
        {t("item.claimApprovedBody")}
        {claim?.review_note && <span className="mt-1 block">{t("item.reviewNote", { note: claim.review_note })}</span>}
      </Notice>
    );
  if (status === "completed")
    return (
      <Notice tone="success" icon={PartyPopper} title={t("item.claimCompleted")} role="status">
        {t("item.claimCompletedBody")}
      </Notice>
    );

  return (
    <div className="space-y-3">
      {status === "rejected" && (
        <Notice tone="error" icon={CircleX} title={t("item.claimRejected")}>
          {claim?.review_note ? t("item.reviewNote", { note: claim.review_note }) : t("item.claimRejectedBody")}
        </Notice>
      )}
      {status === "cancelled" && <Notice>{t("item.claimCancelled")}</Notice>}
      {claimable ? (
        <div className="rounded-md bg-surface p-5">
          <h2 className="text-lg font-semibold text-ink">{t("item.claimTitle")}</h2>
          <p className="mt-1 text-[0.9375rem] text-muted">{t("item.claimLead")}</p>
          <Button className="mt-4 w-full sm:w-auto" icon={CircleCheck} onClick={onClaim}>
            {status === "rejected" || status === "cancelled" ? t("item.claimAgain") : t("item.claimButton")}
          </Button>
        </div>
      ) : (
        <Notice>{t("item.notClaimable")}</Notice>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- matches
function MatchesSection({ item, matches, isNew }: { item: Item; matches: Match[]; isNew: boolean }) {
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
    <section aria-labelledby="matches-title" className={isNew ? "" : "border-t border-line pt-8"}>
      <h2 id="matches-title" className="text-2xl font-semibold text-ink">
        {item.kind === "lost" ? t("item.matchesTitleLost") : t("item.matchesTitleFound")}
      </h2>
      <p className="mt-1 max-w-[68ch] text-[0.9375rem] text-muted">
        {item.kind === "lost" ? t("item.matchesLeadLost") : t("item.matchesLeadFound")}
      </p>
      <div className="mt-5" aria-live="polite">
        {ordered.length === 0 ? (
          <EmptyState
            compact
            icon={PackageSearch}
            title={item.kind === "lost" ? t("item.noMatchesLost") : t("item.noMatchesFound")}
            actions={
              item.kind === "lost" && item.category ? (
                <Link
                  to={`/browse?category=${encodeURIComponent(item.category)}`}
                  className={buttonClass("secondary")}
                >
                  {t("item.browseCategory", { category: labels.category(item.category) })}
                </Link>
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
    <div className="rounded-md border border-line p-4">
      <h2 className="text-base font-semibold text-ink">{t("item.ownerTools")}</h2>
      {item.kind === "found" && <p className="mt-1 text-sm text-muted">{t("item.ownFoundNote")}</p>}
      <div className="mt-3">
        {closable ? (
          <Button variant="danger-outline" size="sm" onClick={() => setConfirming(true)}>
            {t("item.closeReport")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            busy={mutation.isPending}
            busyLabel={t("item.reopening")}
            onClick={() => mutation.mutate("open")}
          >
            {t("item.reopen")}
          </Button>
        )}
      </div>
      {mutation.isError && !confirming && (
        <p role="alert" className="mt-2 text-sm text-alert-deep">
          {errorText(mutation.error)}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => mutation.mutate("closed")}
        title={t("item.closeConfirmTitle")}
        description={t("item.closeConfirmBody")}
        confirmLabel={t("item.closeConfirm")}
        busyLabel={t("item.closing")}
        busy={mutation.isPending}
        variant="danger"
        error={mutation.isError ? errorText(mutation.error) : undefined}
      />
    </div>
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
          <div className="skeleton aspect-[4/3] rounded-md" />
          <div>
            <div className="skeleton h-6 w-40" />
            <div className="skeleton mt-4 h-9 w-full max-w-md" />
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
              <Link to="/browse" className={buttonClass("primary")}>
                {t("notFound.browse")}
              </Link>
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
  const matchesSection = showMatches ? <MatchesSection item={item} matches={matches} isNew={isNew} /> : null;
  const matchCount = matches?.length ?? 0;
  // Without a title the heading already shows the (short) description — don't print it twice.
  const descriptionIsTitle = !item.title?.trim() && itemTitle(item, 80) === item.description.replace(/\s+/g, " ").trim();

  return (
    <div className="container-page py-6 sm:py-8">
      <Link to={backTo} className={buttonClass("quiet", "sm", "-ml-3")}>
        <ArrowLeft aria-hidden />
        {t("item.back")}
      </Link>

      {isNew && item.is_mine && (
        <div className="mt-4 space-y-8">
          <Notice
            tone="success"
            role="status"
            title={t("item.postedTitle")}
            className="py-4"
          >
            {item.kind === "found"
              ? matchCount > 0
                ? t("item.postedMatches", { count: matchCount })
                : t("item.postedFoundThanks")
              : matchCount > 0
                ? t("item.postedMatches", { count: matchCount })
                : t("item.postedNoMatches")}
          </Notice>
          {matchesSection}
        </div>
      )}

      {item.is_hidden && (
        <Notice tone="warning" icon={EyeOff} className="mt-4">
          {t("item.hiddenNotice")}
        </Notice>
      )}

      <article
        aria-labelledby="item-title"
        className={`grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 ${isNew && item.is_mine ? "mt-10 border-t border-line pt-8" : "mt-4"}`}
      >
        <div className="min-w-0">
          <Gallery item={item} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={item.kind} />
            <StatusBadge kind={item.kind} status={item.status} />
          </div>
          <h1 id="item-title" className="mt-3 break-words text-[1.625rem] font-bold leading-tight text-ink sm:text-[2rem]">
            {itemTitle(item, 80)}
          </h1>

          <div className="mt-6">
            <Attributes item={item} />
          </div>

          <div className="mt-7 space-y-4 border-t border-line pt-6">
            {!descriptionIsTitle && (
              <div>
                <h2 className="text-base font-semibold text-ink">{t("item.description")}</h2>
                <p className="mt-1.5 whitespace-pre-line break-words leading-relaxed text-ink">{item.description}</p>
              </div>
            )}
            {item.marks_text && (
              <div>
                <h2 className="text-base font-semibold text-ink">{t("item.marks")}</h2>
                <p className="mt-1.5 whitespace-pre-line break-words leading-relaxed text-ink">{item.marks_text}</p>
              </div>
            )}
            {item.private_detail && (
              <p className="flex items-start gap-2 rounded-sm bg-mist px-3 py-2.5 text-[0.9375rem] text-ink">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                <span>
                  <span className="font-semibold">{t("item.privateDetail")}: </span>
                  {item.private_detail}
                </span>
              </p>
            )}
            {isAdmin && item.reporter && (
              <p className="text-sm text-muted">
                {t("admin.reporter")}: <span className="font-medium text-ink">{item.reporter.display_name}</span> ·{" "}
                {item.reporter.email}
              </p>
            )}
          </div>

          <div className="mt-7 space-y-4">
            {item.is_mine ? (
              <OwnerTools item={item} />
            ) : item.kind === "found" ? (
              <ClaimPanel item={item} claim={my_claim} onClaim={() => setClaimOpen(true)} />
            ) : (
              <div className="rounded-md bg-surface p-5">
                <h2 className="text-lg font-semibold text-ink">{t("item.lostByOtherTitle")}</h2>
                <p className="mt-1 text-[0.9375rem] text-muted">{t("item.lostByOtherBody")}</p>
                <Link to="/report/found" className={buttonClass("secondary", "md", "mt-4")}>
                  {t("item.reportFoundCta")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </article>

      {!(isNew && item.is_mine) && matchesSection && <div className="mt-10">{matchesSection}</div>}

      {item.kind === "found" && !item.is_mine && user && (
        <ClaimDialog item={item} open={claimOpen} onClose={() => setClaimOpen(false)} preselectLost={params.get("lost")} />
      )}
    </div>
  );
}
