import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Title block at the top of every page: h1, lead paragraph and actions on the right. (`eyebrow` is accepted but
 * not shown — the heading carries its own weight.) */
export function PageHeader({ title, description, actions, className }: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[2.25rem] leading-[1.02] font-bold tracking-[-0.04em] text-balance sm:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-3 max-w-[60ch] text-[1.0625rem] text-foreground/75">{description}</p>}
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
        <h2 id={id} className="text-2xl font-bold tracking-[-0.03em]">
          {title}
        </h2>
        {description && <p className="mt-1 text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
