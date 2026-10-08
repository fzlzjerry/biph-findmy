import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  extra?: ReactNode;
}

/**
 * WAI-ARIA tabs with automatic activation: arrow keys / Home / End move between tabs.
 * Pair with <TabPanel idPrefix=… activeId=…>.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  className = "",
  stretch = false,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix: string;
  className?: string;
  stretch?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`${stretch ? "flex w-full" : "inline-flex max-w-full"} gap-1 overflow-x-auto rounded-sm bg-surface p-1 ${className}`}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            id={`${idPrefix}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xs px-4 text-[0.9375rem] font-semibold transition-colors duration-200 ${
              stretch ? "flex-1" : ""
            } ${selected ? "bg-brand text-water" : "text-muted hover:bg-water hover:text-ink"}`}
          >
            {item.label}
            {item.extra}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, activeId, children, className = "" }: {
  idPrefix: string;
  activeId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel`}
      aria-labelledby={`${idPrefix}-tab-${activeId}`}
      tabIndex={-1}
      className={`outline-none ${className}`}
    >
      {children}
    </div>
  );
}
