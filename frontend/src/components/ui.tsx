import {
  Archive,
  BadgeCheck,
  Ban,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  Hourglass,
  Inbox,
  Info,
  Link2,
  LoaderCircle,
  Search,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import type { Band, ClaimStatus, ItemKind, ItemStatus } from "../lib/types";

// --------------------------------------------------------------------------- buttons
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-water hover:bg-brand-deep disabled:bg-brand-muted disabled:hover:bg-brand-muted",
  secondary:
    "border border-line-strong bg-water text-ink hover:bg-surface disabled:border-line disabled:text-muted disabled:hover:bg-water",
  quiet: "text-brand hover:bg-surface disabled:text-muted disabled:hover:bg-transparent",
  danger: "bg-alert text-water hover:bg-alert-deep disabled:bg-alert-soft disabled:text-alert-deep",
  "danger-outline":
    "border border-alert bg-water text-alert-deep hover:bg-alert-soft disabled:border-line disabled:text-muted disabled:hover:bg-water",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3.5 text-sm",
  md: "min-h-12 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-6 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-sm font-semibold leading-tight tracking-[0.01em] text-center",
    "no-underline select-none transition-[background-color,border-color,color,transform] duration-200 ease-out",
    "active:translate-y-px disabled:active:translate-y-0 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  busyLabel?: string;
  icon?: LucideIcon;
};

/** Disabled + specific busy label while a request is in flight ("Posting…"), never just a spinner. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", busy = false, busyLabel, icon: Icon, className = "", children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={buttonClass(variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : Icon ? <Icon aria-hidden /> : null}
      <span>{busy && busyLabel ? busyLabel : children}</span>
    </button>
  );
});

// --------------------------------------------------------------------------- badges
export type BadgeTone = "brand" | "mist" | "success" | "neutral" | "alert" | "outline";

const TONES: Record<BadgeTone, string> = {
  brand: "bg-brand text-water",
  mist: "bg-mist text-brand-deep",
  success: "bg-success-soft text-success",
  neutral: "bg-surface text-muted",
  alert: "bg-alert-soft text-alert-deep",
  outline: "border border-line-strong bg-water text-ink",
};

export function Badge({ tone = "neutral", icon: Icon, children, className = "" }: {
  tone?: BadgeTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold leading-5 ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

const STATUS_STYLE: Record<ItemStatus, { tone: BadgeTone; found: LucideIcon; lost: LucideIcon }> = {
  open: { tone: "mist", found: Inbox, lost: Search },
  matched: { tone: "outline", found: Hourglass, lost: Link2 },
  claimed: { tone: "brand", found: BadgeCheck, lost: BadgeCheck },
  returned: { tone: "success", found: CircleCheck, lost: CircleCheck },
  closed: { tone: "neutral", found: Archive, lost: Archive },
  expired: { tone: "neutral", found: Archive, lost: Archive },
};

export function StatusBadge({ kind, status }: { kind: ItemKind; status: ItemStatus }) {
  const { t } = useTranslation();
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.open;
  return (
    <Badge tone={style.tone} icon={style[kind]}>
      {t(`status.${kind}.${status}`)}
    </Badge>
  );
}

const CLAIM_STYLE: Record<ClaimStatus, { tone: BadgeTone; icon: LucideIcon }> = {
  pending: { tone: "outline", icon: Hourglass },
  approved: { tone: "brand", icon: BadgeCheck },
  rejected: { tone: "alert", icon: CircleX },
  cancelled: { tone: "neutral", icon: Ban },
  completed: { tone: "success", icon: CircleCheck },
};

export function ClaimBadge({ status }: { status: ClaimStatus }) {
  const { t } = useTranslation();
  const style = CLAIM_STYLE[status] ?? CLAIM_STYLE.pending;
  return (
    <Badge tone={style.tone} icon={style.icon}>
      {t(`claimStatus.${status}`)}
    </Badge>
  );
}

export function BandBadge({ band }: { band: Band }) {
  const { t } = useTranslation();
  return band === "strong" ? (
    <Badge tone="brand" icon={Zap}>
      {t("band.strong")}
    </Badge>
  ) : (
    <Badge tone="mist" icon={CircleHelp}>
      {t(`band.${band}`)}
    </Badge>
  );
}

export function KindBadge({ kind }: { kind: ItemKind }) {
  const { t } = useTranslation();
  return <Badge tone={kind === "lost" ? "outline" : "neutral"}>{t(kind === "lost" ? "kind.lostReport" : "kind.foundItem")}</Badge>;
}

// --------------------------------------------------------------------------- notices
export type NoticeTone = "info" | "success" | "error" | "warning";

const NOTICE: Record<NoticeTone, { className: string; icon: LucideIcon }> = {
  info: { className: "bg-mist text-ink", icon: Info },
  success: { className: "bg-success-soft text-ink", icon: CircleCheck },
  error: { className: "bg-alert-soft text-ink", icon: CircleAlert },
  warning: { className: "bg-surface text-ink border border-line", icon: TriangleAlert },
};

/** Flat callout: tinted fill + icon + text (no side stripes, no shadow). */
export function Notice({ tone = "info", title, children, icon, className = "", role, action }: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  role?: "status" | "alert";
  action?: ReactNode;
}) {
  const style = NOTICE[tone];
  const Icon = icon ?? style.icon;
  const iconColor = tone === "error" ? "text-alert" : tone === "success" ? "text-success" : "text-brand";
  return (
    <div role={role} className={`flex gap-3 rounded-sm px-4 py-3 ${style.className} ${className}`}>
      <Icon aria-hidden className={`mt-0.5 size-5 shrink-0 ${iconColor}`} />
      <div className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 text-ink/85" : ""}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- fields
export function describedBy(id: string, parts: { hint?: unknown; error?: unknown }): string | undefined {
  const ids = [parts.hint ? `${id}-hint` : null, parts.error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 flex items-start gap-1.5 text-sm font-medium text-alert-deep">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-alert" />
      <span>{children}</span>
    </p>
  );
}

export function Field({ id, label, hint, error, optional, children, className = "", labelExtra }: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  labelExtra?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={id} className="text-[0.9375rem] font-semibold text-ink">
          {label}
          {optional && <span className="font-normal text-muted"> ({t("common.optional")})</span>}
        </label>
        {labelExtra}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm leading-relaxed text-muted">
          {hint}
        </p>
      )}
      <div className="mt-2">{children}</div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-muted ${className}`}>
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      {label && <span>{label}</span>}
    </span>
  );
}

export function PageHeader({ title, lead, eyebrow, actions }: {
  title: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="mb-2 text-sm font-semibold text-brand">{eyebrow}</p>}
        <h1 className="text-[1.75rem] font-bold leading-tight text-ink sm:text-[2rem]">{title}</h1>
        {lead && <p className="mt-2 max-w-[68ch] text-base leading-relaxed text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
