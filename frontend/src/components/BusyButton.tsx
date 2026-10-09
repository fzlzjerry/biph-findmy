import { Loader2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Button that is disabled and shows a specific label while a request is in flight ("Posting…"). */
export function BusyButton({ busy = false, busyLabel, icon, children, disabled, ...props }: ComponentProps<typeof Button> & {
  busy?: boolean;
  busyLabel?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Button disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
      {busy ? <Loader2Icon aria-hidden data-icon="inline-start" className="animate-spin" /> : icon}
      {busy && busyLabel ? busyLabel : children}
    </Button>
  );
}
