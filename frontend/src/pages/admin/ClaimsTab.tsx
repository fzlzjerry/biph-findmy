import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, Inbox, Lock, PackageCheck, Quote } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ConfirmDialog } from "../../components/Dialog";
import { ItemThumb, itemTitle, ProbabilityMeter, ReasonChips } from "../../components/ItemBits";
import { EmptyState, ErrorState, RowsSkeleton } from "../../components/States";
import { useToast } from "../../components/Toast";
import { BandBadge, Button, Notice } from "../../components/ui";
import { useLang } from "../../i18n";
import { api } from "../../lib/api";
import { useErrorText } from "../../lib/errors";
import { useLabels } from "../../lib/meta";
import { formatDateTime, formatRelative, formatWindow, useNow } from "../../lib/time";
import type { Claim, Item } from "../../lib/types";

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    void queryClient.invalidateQueries({ queryKey: ["item"] });
    void queryClient.invalidateQueries({ queryKey: ["items"] });
  };
}

function ItemSummary({ item, showPrivate }: { item: Item; showPrivate?: boolean }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const lang = useLang();
  return (
    <div className="flex gap-3">
      <Link to={`/items/${item.id}`} tabIndex={-1} aria-hidden className="block size-16 shrink-0 overflow-hidden rounded-sm bg-surface sm:size-20">
        <ItemThumb item={item} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/items/${item.id}`} className="break-words font-semibold leading-snug text-ink hover:text-brand-deep hover:underline">
          {itemTitle(item, 110)}
        </Link>
        <p className="mt-0.5 text-sm text-muted">
          {labels.category(item.category)}
          {item.locations.length > 0 && <> · {item.locations.map((p) => labels.place(p)).join(", ")}</>}
        </p>
        <p className="text-sm text-muted">
          {item.kind === "lost" ? formatWindow(item.time_from, item.time_to, lang) : formatDateTime(item.time_from, lang)}
        </p>
        {item.marks_text && (
          <p className="mt-1 break-words text-sm text-ink">
            <span className="text-muted">{t("item.marks")}: </span>
            {item.marks_text}
          </p>
        )}
        {showPrivate && (
          <p className="mt-2 flex items-start gap-2 rounded-xs bg-mist px-2.5 py-2 text-sm text-ink">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              <span className="font-semibold">{t("admin.finderPrivate")}: </span>
              {item.private_detail ? item.private_detail : <span className="text-muted">{t("admin.noPrivate")}</span>}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function ClaimReview({ claim }: { claim: Claim }) {
  const { t } = useTranslation();
  const lang = useLang();
  const now = useNow();
  const toast = useToast();
  const errorText = useErrorText();
  const invalidate = useInvalidateAdmin();
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") => api.admin.decide(claim.id, decision, note.trim()),
    onSuccess: (_data, decision) => {
      invalidate();
      toast({ message: decision === "approve" ? t("admin.approved") : t("admin.rejected"), tone: "success" });
    },
  });
  const found = claim.found;
  const titleId = `claim-${claim.id}`;

  return (
    <article aria-labelledby={titleId} className="rounded-md border border-line" data-testid="claim-review">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h3 id={titleId} className="min-w-0 break-words font-semibold text-ink">
          {t("admin.claimFor", { item: found ? itemTitle(found, 60) : "—" })}
        </h3>
        <p className="text-sm text-muted" title={formatDateTime(claim.created_at, lang)}>
          {t("admin.submitted", { time: formatRelative(claim.created_at, lang, now) })}
        </p>
      </header>
      <div className="grid gap-6 p-4 md:grid-cols-2">
        <section aria-label={t("admin.foundItem")} className="min-w-0 space-y-2">
          <h4 className="text-sm font-semibold text-muted">{t("admin.foundItem")}</h4>
          {found ? <ItemSummary item={found} showPrivate /> : <p className="text-sm text-muted">{t("me.itemRemoved")}</p>}
          {found?.reporter && (
            <p className="text-sm text-muted">
              {t("admin.reporter")}: <span className="text-ink">{found.reporter.display_name}</span> · {found.reporter.email}
            </p>
          )}
        </section>
        <section aria-label={t("admin.claimant")} className="min-w-0 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-muted">{t("admin.claimant")}</h4>
            <p className="mt-1 font-semibold text-ink">{claim.claimant?.display_name}</p>
            <p className="break-all text-sm text-muted">{claim.claimant?.email}</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-muted">{t("admin.proof")}</h4>
            <blockquote className="mt-1 flex gap-2 break-words text-[0.9375rem] leading-relaxed text-ink">
              <Quote aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
              <span>{claim.proof}</span>
            </blockquote>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-muted">{t("admin.linkedLost")}</h4>
            {claim.lost ? (
              <div className="mt-2 space-y-3">
                <ItemSummary item={claim.lost} />
                {claim.match ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <BandBadge band={claim.match.band} />
                      <ProbabilityMeter value={claim.match.probability} />
                    </div>
                    <ReasonChips reasons={claim.match.reasons} />
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t("admin.noMatchInfo")}</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted">{t("admin.noLinkedLost")}</p>
            )}
          </div>
        </section>
      </div>
      <footer className="space-y-3 border-t border-line p-4">
        <div>
          <label htmlFor={`note-${claim.id}`} className="text-sm font-semibold text-ink">
            {t("admin.note")} <span className="font-normal text-muted">({t("common.optional")})</span>
          </label>
          <textarea
            id={`note-${claim.id}`}
            className="field-control mt-1.5 min-h-20"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("admin.notePlaceholder")}
          />
        </div>
        {decide.isError && (
          <Notice tone="error" role="alert">
            {errorText(decide.error)}
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            icon={CircleCheck}
            busy={decide.isPending && decide.variables === "approve"}
            busyLabel={t("admin.approving")}
            disabled={decide.isPending}
            onClick={() => decide.mutate("approve")}
          >
            {t("admin.approve")}
          </Button>
          <Button
            variant="danger-outline"
            icon={CircleX}
            busy={decide.isPending && decide.variables === "reject"}
            busyLabel={t("admin.rejecting")}
            disabled={decide.isPending}
            onClick={() => decide.mutate("reject")}
          >
            {t("admin.reject")}
          </Button>
        </div>
      </footer>
    </article>
  );
}

function PickupRow({ claim, onReturn }: { claim: Claim; onReturn: (claim: Claim) => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const now = useNow();
  const found = claim.found;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line p-3 sm:flex-row sm:items-center sm:p-4" data-testid="pickup-row">
      <div className="min-w-0 flex-1">{found && <ItemSummary item={found} />}</div>
      <div className="min-w-0 text-sm sm:w-56">
        <p className="font-semibold text-ink">{claim.claimant?.display_name}</p>
        <p className="break-all text-muted">{claim.claimant?.email}</p>
        {claim.decided_at && (
          <p className="text-muted">{t("admin.approvedOn", { time: formatRelative(claim.decided_at, lang, now) })}</p>
        )}
      </div>
      <Button icon={PackageCheck} onClick={() => onReturn(claim)} className="sm:shrink-0">
        {t("admin.markReturned")}
      </Button>
    </div>
  );
}

export default function ClaimsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const errorText = useErrorText();
  const invalidate = useInvalidateAdmin();
  const pending = useQuery({ queryKey: ["admin", "claims", "pending"], queryFn: () => api.admin.claims("pending") });
  const approved = useQuery({ queryKey: ["admin", "claims", "approved"], queryFn: () => api.admin.claims("approved") });
  const [returning, setReturning] = useState<Claim | null>(null);
  const markReturned = useMutation({
    mutationFn: (claim: Claim) => api.admin.returned(claim.found?.id ?? ""),
    onSuccess: () => {
      invalidate();
      setReturning(null);
      toast({ message: t("admin.returnedDone"), tone: "success" });
    },
  });

  return (
    <div className="space-y-10">
      <section aria-labelledby="pending-title">
        <h2 id="pending-title" className="text-xl font-semibold text-ink">
          {t("admin.pendingTitle")}
          {pending.data && pending.data.claims.length > 0 && (
            <span className="ml-2 text-base font-medium text-muted">({pending.data.claims.length})</span>
          )}
        </h2>
        <div className="mt-4">
          {pending.isPending ? (
            <RowsSkeleton rows={2} />
          ) : pending.isError ? (
            <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
          ) : pending.data.claims.length === 0 ? (
            <EmptyState compact icon={Inbox} title={t("admin.pendingEmpty")} />
          ) : (
            <ul className="space-y-4">
              {pending.data.claims.map((claim) => (
                <li key={claim.id}>
                  <ClaimReview claim={claim} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="pickup-title">
        <h2 id="pickup-title" className="text-xl font-semibold text-ink">
          {t("admin.pickupTitle")}
        </h2>
        <div className="mt-4">
          {approved.isPending ? (
            <RowsSkeleton rows={1} />
          ) : approved.isError ? (
            <ErrorState error={approved.error} onRetry={() => void approved.refetch()} />
          ) : approved.data.claims.length === 0 ? (
            <EmptyState compact icon={PackageCheck} title={t("admin.pickupEmpty")} />
          ) : (
            <ul className="space-y-3">
              {approved.data.claims.map((claim) => (
                <li key={claim.id}>
                  <PickupRow claim={claim} onReturn={setReturning} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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
