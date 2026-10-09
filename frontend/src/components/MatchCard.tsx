import { ArrowRight, Check, ThumbsDown, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ToneBadge } from "@/components/badges";
import { ItemThumb, itemTitle, ProbabilityMeter, ReasonChips, RelativeTime } from "@/components/ItemBits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLabels } from "@/lib/meta";
import type { Match, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MatchCard({ match, lostItemId, canFeedback, onFeedback, feedbackPending }: {
  match: Match;
  /** Set when the viewer owns the lost report: enables "This is mine / Not mine" and the claim shortcut. */
  lostItemId?: string;
  canFeedback: boolean;
  onFeedback?: (verdict: Verdict | null) => void;
  feedbackPending?: boolean;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const other = match.item;
  const headingId = `match-${match.id}`;
  const place = other.locations[0];
  const claimable = other.kind === "found" && (other.status === "open" || other.status === "matched");

  return (
    <Card
      role="article"
      aria-labelledby={headingId}
      data-testid="match-card"
      data-band={match.band}
      className={cn(
        "grid gap-3 rounded-[1.5rem] sm:gap-x-5",
        match.band === "strong"
          ? "grid-cols-[4.5rem_minmax(0,1fr)] p-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:p-6"
          : "grid-cols-[3.5rem_minmax(0,1fr)] p-4 sm:grid-cols-[4rem_minmax(0,1fr)]",
        match.feedback === "rejected" && "opacity-70",
      )}
    >
      <Link
        to={`/items/${other.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className={cn("block overflow-hidden rounded-full sm:row-span-2", match.band === "strong" ? "size-18 sm:size-24" : "size-14 sm:size-16")}
      >
        <ItemThumb item={other} iconClass="size-2/5" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ProbabilityMeter value={match.probability} />
          <span className="text-sm font-semibold">{t(`band.${match.band}`)}</span>
          {match.feedback === "confirmed" && (
            <ToneBadge tone="green" icon={Check}>
              {t("item.confirmedNote")}
            </ToneBadge>
          )}
          {match.feedback === "rejected" && <ToneBadge tone="gray">{t("item.rejectedNote")}</ToneBadge>}
        </div>
        <h3 id={headingId} className={cn("mt-2 leading-snug font-semibold break-words", match.band === "strong" ? "text-xl" : "text-base")}>
          <Link to={`/items/${other.id}`} className="hover:underline">
            {itemTitle(other, 110)}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <span>{labels.category(other.category)}</span>
          {place && (
            <>
              <span aria-hidden>·</span>
              <span>{labels.place(place)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <RelativeTime iso={other.time_from} />
        </p>
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
        {match.band === "weak" ? (
          <details className="group/reasons">
            <summary className="w-fit rounded-full text-sm font-semibold text-muted-foreground hover:text-foreground">
              {t("item.reasons")} ({match.reasons.length})
            </summary>
            <div className="mt-2">
              <ReasonChips reasons={match.reasons} />
            </div>
          </details>
        ) : (
          <ReasonChips reasons={match.reasons} />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canFeedback && match.feedback !== "confirmed" && (
            <Button variant="sun" disabled={feedbackPending} onClick={() => onFeedback?.("confirmed")}>
              <Check aria-hidden data-icon="inline-start" />
              {t("item.mine")}
            </Button>
          )}
          {canFeedback && match.feedback === "confirmed" && claimable && lostItemId && (
            <Button asChild>
              <Link to={`/items/${other.id}?claim=1&lost=${lostItemId}`}>
                {t("item.claimIt")}
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
          )}
          {canFeedback && match.feedback === null && (
            <Button variant="outline" disabled={feedbackPending} onClick={() => onFeedback?.("rejected")}>
              <ThumbsDown aria-hidden data-icon="inline-start" />
              {t("item.notMine")}
            </Button>
          )}
          {canFeedback && match.feedback !== null && (
            <Button variant="ghost" disabled={feedbackPending} onClick={() => onFeedback?.(null)}>
              <Undo2 aria-hidden data-icon="inline-start" />
              {t("item.undo")}
            </Button>
          )}
          {!canFeedback && (
            <Button variant="ghost" className="-ml-2.5" asChild>
              <Link to={`/items/${other.id}`}>
                {t("item.viewItem")}
                <ArrowRight aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
