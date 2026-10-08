import { CircleAlert, RefreshCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useErrorText } from "../lib/errors";
import { Button } from "./ui";

export function EmptyState({ icon: Icon, title, children, actions, compact = false }: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center rounded-md bg-surface text-center ${compact ? "px-5 py-8" : "px-6 py-12"}`}>
      <span className="flex size-12 items-center justify-center rounded-full bg-water text-brand">
        <Icon aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      {children && <div className="mt-1.5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Error with a plain-language message and a Retry button — never an endless spinner. */
export function ErrorState({ error, onRetry, title, compact = false }: {
  error: unknown;
  onRetry?: () => void;
  title?: ReactNode;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  return (
    <div
      role="alert"
      className={`flex flex-col items-center rounded-md border border-line text-center ${compact ? "px-5 py-6" : "px-6 py-10"}`}
    >
      <CircleAlert aria-hidden className="size-7 text-alert" />
      <h2 className="mt-3 text-lg font-semibold text-ink">{title ?? t("common.errorTitle")}</h2>
      <p className="mt-1 max-w-[52ch] text-[0.9375rem] text-muted">{errorText(error)}</p>
      {onRetry && (
        <Button variant="secondary" icon={RefreshCw} className="mt-4" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-md border border-line">
          <div className="skeleton aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LinesSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className={`space-y-3 ${className}`}>
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="skeleton h-9 w-64 max-w-full" />
      <div className="skeleton mt-3 h-5 w-96 max-w-full" />
      <LinesSkeleton lines={5} className="mt-8 max-w-2xl" />
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-md border border-line p-3">
          <div className="skeleton size-20 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
