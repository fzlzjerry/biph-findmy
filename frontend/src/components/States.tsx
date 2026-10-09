import { CircleAlert, RefreshCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useErrorText } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, children, actions, compact = false, className }: {
  icon: LucideIcon;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Empty className={cn("border bg-muted/30", compact ? "p-6 md:p-8" : "p-8 md:p-12", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={2}>
          {title}
        </EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {actions && <EmptyContent className="flex-row flex-wrap justify-center gap-2">{actions}</EmptyContent>}
    </Empty>
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
    <Empty role="alert" className={cn("border border-destructive/30", compact ? "p-6 md:p-8" : "p-8 md:p-12")}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <CircleAlert aria-hidden />
        </EmptyMedia>
        <EmptyTitle role="heading" aria-level={2}>
          {title ?? t("common.errorTitle")}
        </EmptyTitle>
        <EmptyDescription>{errorText(error)}</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden data-icon="inline-start" />
            {t("common.retry")}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

function Busy({ children, className }: { children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">{t("common.loading")}</span>
      {children}
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <Busy className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-0 py-0">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <CardContent className="gap-2 p-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-3.5 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </Busy>
  );
}

export function LinesSkeleton({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <Busy className={cn("space-y-3", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </Busy>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-page py-8 sm:py-10">
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="mt-3 h-5 w-96 max-w-full" />
      <LinesSkeleton lines={5} className="mt-8 max-w-2xl" />
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Busy className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border p-3">
          <Skeleton className="size-16 shrink-0 sm:size-20" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        </div>
      ))}
    </Busy>
  );
}
