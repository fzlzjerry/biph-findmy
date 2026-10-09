import { useCallback } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface ToastInput {
  message: string;
  tone?: "success" | "info" | "error";
  action?: { label: string; to: string };
}

/** Short confirmations ("Claim sent") via sonner; an optional action links somewhere in the app. */
export function useToast() {
  const navigate = useNavigate();
  return useCallback(
    ({ message, tone = "success", action }: ToastInput) => {
      const show = tone === "error" ? toast.error : tone === "info" ? toast.info : toast.success;
      show(message, action ? { duration: 8000, action: { label: action.label, onClick: () => navigate(action.to) } } : undefined);
    },
    [navigate],
  );
}
