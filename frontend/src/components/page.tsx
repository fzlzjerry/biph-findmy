import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Title block at the top of every page: optional eyebrow, h1, lead paragraph and actions on the right. */
export function PageHeader({ title, description, eyebrow, actions, className }: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <div className="mb-2 text-sm font-medium text-primary">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Section heading used inside pages ("Recently found", "Possible matches"…). */
export function SectionHeader({ id, title, description, actions, className }: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
