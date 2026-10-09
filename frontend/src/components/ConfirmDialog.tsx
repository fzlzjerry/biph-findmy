import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BusyButton } from "@/components/BusyButton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Yes/no confirmation. Focus starts on Cancel, so a stray Enter never deletes anything. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, busyLabel, busy = false, destructive = false, error }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  error?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <BusyButton variant={destructive ? "destructive" : "default"} onClick={onConfirm} busy={busy} busyLabel={busyLabel}>
            {confirmLabel}
          </BusyButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
