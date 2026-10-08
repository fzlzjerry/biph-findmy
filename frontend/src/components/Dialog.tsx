import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button, type ButtonVariant } from "./ui";

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0,
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** While true, Escape / backdrop clicks are ignored (a request is in flight). */
  busy?: boolean;
  size?: "sm" | "md";
}

/**
 * Modal dialog: rendered in a portal, the rest of the app is made `inert`, focus moves inside and is
 * trapped (Tab / Shift+Tab cycle), Escape closes, and focus returns to the trigger on close.
 */
export function Dialog({ open, onClose, title, description, children, busy = false, size = "md" }: DialogProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [onClose, busy]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const appRoot = document.getElementById("root");
    appRoot?.setAttribute("inert", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const initial = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? (panel ? focusables(panel)[0] : null);
    (initial ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!panelRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables(panelRef.current);
      if (items.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      appRoot?.removeAttribute("inert");
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/55" aria-hidden="true" onClick={() => !busy && onClose()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-md bg-water px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 outline-none sm:rounded-md sm:p-6 ${
          size === "sm" ? "sm:max-w-md" : "sm:max-w-xl"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="pt-1.5 text-xl font-semibold leading-snug text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("common.close")}
            className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-ink disabled:opacity-50"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {description && (
          <div id={descriptionId} className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
            {description}
          </div>
        )}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  busyLabel,
  busy = false,
  variant = "primary",
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  variant?: ButtonVariant;
  error?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} busy={busy} size="sm">
      {error && (
        <p role="alert" className="mb-4 rounded-sm bg-alert-soft px-3 py-2 text-sm font-medium text-alert-deep">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {/* Destructive actions start with focus on Cancel so a stray Enter never deletes anything. */}
        <Button variant="secondary" onClick={onClose} disabled={busy} data-autofocus={variant === "danger" ? true : undefined}>
          {t("common.cancel")}
        </Button>
        <Button
          variant={variant}
          onClick={onConfirm}
          busy={busy}
          busyLabel={busyLabel}
          data-autofocus={variant === "danger" ? undefined : true}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
