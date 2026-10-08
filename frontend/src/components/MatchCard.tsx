import { ArrowRight, Check, ThumbsDown, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useLabels } from "../lib/meta";
import type { Match, Verdict } from "../lib/types";
import { ItemThumb, itemTitle, ProbabilityMeter, ReasonChips, RelativeTime } from "./ItemBits";
import { Badge, BandBadge, buttonClass } from "./ui";

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
    <article
      aria-labelledby={headingId}
      data-testid="match-card"
      data-band={match.band}
      className={`grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-md border p-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 sm:p-4 ${
        match.band === "strong" ? "border-brand" : "border-line"
      }`}
    >
      <Link
        to={`/items/${other.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="block size-20 overflow-hidden rounded-sm bg-surface sm:row-span-2 sm:size-28"
      >
        <ItemThumb item={other} />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <BandBadge band={match.band} />
          <ProbabilityMeter value={match.probability} />
          {match.feedback === "confirmed" && (
            <Badge tone="success" icon={Check}>
              {t("item.confirmedNote")}
            </Badge>
          )}
          {match.feedback === "rejected" && <Badge tone="neutral">{t("item.rejectedNote")}</Badge>}
        </div>
        <h3 id={headingId} className="mt-2 break-words font-semibold leading-snug text-ink">
          <Link to={`/items/${other.id}`} className="underline-offset-2 hover:text-brand-deep hover:underline">
            {itemTitle(other, 110)}
          </Link>
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
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
        <ReasonChips reasons={match.reasons} />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canFeedback && match.feedback !== "confirmed" && (
            <button
              type="button"
              className={buttonClass("secondary", "sm")}
              disabled={feedbackPending}
              onClick={() => onFeedback?.("confirmed")}
            >
              <Check aria-hidden />
              {t("item.mine")}
            </button>
          )}
          {canFeedback && match.feedback === "confirmed" && claimable && lostItemId && (
            <Link to={`/items/${other.id}?claim=1&lost=${lostItemId}`} className={buttonClass("primary", "sm")}>
              {t("item.claimIt")}
              <ArrowRight aria-hidden />
            </Link>
          )}
          {canFeedback && match.feedback === null && (
            <button
              type="button"
              className={buttonClass("quiet", "sm")}
              disabled={feedbackPending}
              onClick={() => onFeedback?.("rejected")}
            >
              <ThumbsDown aria-hidden />
              {t("item.notMine")}
            </button>
          )}
          {canFeedback && match.feedback !== null && (
            <button
              type="button"
              className={buttonClass("quiet", "sm")}
              disabled={feedbackPending}
              onClick={() => onFeedback?.(null)}
            >
              <Undo2 aria-hidden />
              {t("item.undo")}
            </button>
          )}
          {!canFeedback && (
            <Link to={`/items/${other.id}`} className={buttonClass("quiet", "sm", "-ml-2")}>
              {t("item.viewItem")}
              <ArrowRight aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
