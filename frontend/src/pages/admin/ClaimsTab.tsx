import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, CircleX, Inbox, Lock, PackageCheck, Quote } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { BusyButton } from "@/components/BusyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/form";
import { Email, ItemThumb, itemTitle, ProbabilityMeter, ReasonChips } from "@/components/ItemBits";
import { SectionHeader } from "@/components/page";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/i18n";
import { api } from "@/lib/api";
import { useErrorText } from "@/lib/errors";
import { useLabels } from "@/lib/meta";
import { formatDateTime, formatRelative, formatWindow, useNow } from "@/lib/time";
import type { Claim, Item } from "@/lib/types";

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
      <Link to={`/items/${item.id}`} tabIndex={-1} aria-hidden className="block size-16 shrink-0 overflow-hidden rounded-full sm:size-20">
        <ItemThumb item={item} />
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <Link to={`/items/${item.id}`} className="text-base font-medium leading-snug break-words underline-offset-4 hover:underline">
          {itemTitle(item, 110)}
        </Link>
        <p className="mt-1 text-muted-foreground">
          {labels.category(item.category)}
          {item.locations.length > 0 && <> · {item.locations.map((p) => labels.place(p)).join(", ")}</>}
        </p>
        <p className="text-muted-foreground">
          {item.kind === "lost" ? formatWindow(item.time_from, item.time_to, lang) : formatDateTime(item.time_from, lang)}
        </p>
        {item.marks_text && (
          <p className="mt-1 break-words">
            <span className="text-muted-foreground">{t("item.marks")}: </span>
            {item.marks_text}
          </p>
        )}
        {showPrivate && (
          <p className="mt-2 flex items-start gap-2 rounded-md bg-[#d8ecff] px-2.5 py-2">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium">{t("admin.finderPrivate")}: </span>
              {item.private_detail ? item.private_detail : <span className="text-muted-foreground">{t("admin.noPrivate")}</span>}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function SubHeading({ children }: { children: string }) {
  return <h4 className="text-sm font-semibold text-foreground">{children}</h4>;
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
    <Card role="article" aria-labelledby={titleId} data-testid="claim-review">
      <CardHeader className="border-b">
        <CardTitle id={titleId} role="heading" aria-level={3} className="break-words">
          {t("admin.claimFor", { item: found ? itemTitle(found, 60) : "—" })}
        </CardTitle>
        <CardDescription title={formatDateTime(claim.created_at, lang)}>
          {t("admin.submitted", { time: formatRelative(claim.created_at, lang, now) })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section aria-label={t("admin.foundItem")} className="min-w-0 space-y-3">
          <SubHeading>{t("admin.foundItem")}</SubHeading>
          {found ? <ItemSummary item={found} showPrivate /> : <p className="text-sm text-muted-foreground">{t("me.itemRemoved")}</p>}
          {found?.reporter && (
            <p className="text-sm text-muted-foreground">
              {t("admin.reporter")}: <span className="text-foreground">{found.reporter.display_name}</span> · <Email value={found.reporter.email} />
            </p>
          )}
        </section>
        <section aria-label={t("admin.claimant")} className="min-w-0 space-y-5">
          <div className="space-y-1">
            <SubHeading>{t("admin.claimant")}</SubHeading>
            <p className="font-medium">{claim.claimant?.display_name}</p>
            <p className="text-sm text-muted-foreground">{claim.claimant && <Email value={claim.claimant.email} />}</p>
          </div>
          <div className="space-y-1.5">
            <SubHeading>{t("admin.proof")}</SubHeading>
            <blockquote className="flex gap-2 rounded-2xl bg-cream p-3 text-sm leading-relaxed break-words">
              <Quote aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{claim.proof}</span>
            </blockquote>
          </div>
          <div className="space-y-2">
            <SubHeading>{t("admin.linkedLost")}</SubHeading>
            {claim.lost ? (
              <div className="space-y-3">
                <ItemSummary item={claim.lost} />
                {claim.match ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <ProbabilityMeter value={claim.match.probability} band={claim.match.band} />
                      <span className="text-sm font-semibold">{t(`band.${claim.match.band}`)}</span>
                    </div>
                    <ReasonChips reasons={claim.match.reasons} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("admin.noMatchInfo")}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("admin.noLinkedLost")}</p>
            )}
          </div>
        </section>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t">
        <FormField id={`note-${claim.id}`} label={t("admin.note")} optional>
          <Textarea
            id={`note-${claim.id}`}
            className="min-h-16 bg-background"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("admin.notePlaceholder")}
          />
        </FormField>
        {decide.isError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{errorText(decide.error)}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <BusyButton
            icon={<CircleCheck aria-hidden data-icon="inline-start" />}
            busy={decide.isPending && decide.variables === "approve"}
            busyLabel={t("admin.approving")}
            disabled={decide.isPending}
            onClick={() => decide.mutate("approve")}
          >
            {t("admin.approve")}
          </BusyButton>
          <BusyButton
            variant="destructive"
            icon={<CircleX aria-hidden data-icon="inline-start" />}
            busy={decide.isPending && decide.variables === "reject"}
            busyLabel={t("admin.rejecting")}
            disabled={decide.isPending}
            onClick={() => decide.mutate("reject")}
          >
            {t("admin.reject")}
          </BusyButton>
        </div>
      </CardFooter>
    </Card>
  );
}

function PickupRow({ claim, onReturn }: { claim: Claim; onReturn: (claim: Claim) => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const now = useNow();
  const found = claim.found;
  return (
    <Card size="sm" data-testid="pickup-row">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">{found && <ItemSummary item={found} />}</div>
        <div className="min-w-0 text-sm sm:w-56">
          <p className="font-medium">{claim.claimant?.display_name}</p>
          <p className="text-muted-foreground">{claim.claimant && <Email value={claim.claimant.email} />}</p>
          {claim.decided_at && <p className="text-muted-foreground">{t("admin.approvedOn", { time: formatRelative(claim.decided_at, lang, now) })}</p>}
        </div>
        <Button onClick={() => onReturn(claim)} className="sm:shrink-0">
          <PackageCheck aria-hidden data-icon="inline-start" />
          {t("admin.markReturned")}
        </Button>
      </CardContent>
    </Card>
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
        <SectionHeader
          id="pending-title"
          title={
            <span className="inline-flex items-center gap-2">
              {t("admin.pendingTitle")}
              {pending.data && pending.data.claims.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {pending.data.claims.length}
                </Badge>
              )}
            </span>
          }
        />
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
        <SectionHeader id="pickup-title" title={t("admin.pickupTitle")} />
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
