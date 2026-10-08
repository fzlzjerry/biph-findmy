import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

type ToastTone = "success" | "info" | "error";
interface ToastInput {
  message: string;
  tone?: ToastTone;
  action?: { label: string; to: string };
}
interface ToastEntry extends ToastInput {
  id: number;
}

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = { success: CircleCheck, info: Info, error: CircleAlert };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { ...toast, id }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), toast.action ? 8000 : 5000));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(<ToastRegion toasts={toasts} onDismiss={dismiss} />, document.body)}
    </ToastContext.Provider>
  );
}

function ToastRegion({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: number) => void }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("common.notifications")}
      className="pointer-events-none fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:w-[24rem]"
    >
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone ?? "success"];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-start gap-3 rounded-sm bg-ink py-2.5 pl-4 pr-1.5 text-water"
            >
              <Icon
                aria-hidden
                className={`mt-[0.6rem] size-5 shrink-0 ${toast.tone === "error" ? "text-alert-soft" : "text-mist"}`}
              />
              <div className="min-w-0 flex-1 py-2 text-[0.9375rem] leading-snug">
                <span>{toast.message}</span>
                {toast.action && (
                  <Link
                    to={toast.action.to}
                    className="ml-2 font-semibold text-mist underline underline-offset-4"
                    onClick={() => onDismiss(toast.id)}
                  >
                    {toast.action.label}
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label={t("common.dismiss")}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xs text-mist hover:bg-white/10"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
