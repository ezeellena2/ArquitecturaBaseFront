import { toast } from "sonner";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";

type Notification = {
  id: string;
  kind: "success" | "error" | "warning" | "info";
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

const durations = { success: 4000, info: 4000, warning: 8000, error: 10000 };

export function notify({ id, kind, message, description, action }: Notification) {
  return toast[kind](message, { id, description, action, closeButton: true, duration: action ? Infinity : durations[kind] });
}

export function dismissNotification(id: string) {
  toast.dismiss(id);
}

// Returns true when this technical failure was handled, leaving local field/terminal states to the caller.
export function notifyOperationalError(error: unknown, id: string, t: (key: string, options?: Record<string, unknown>) => string, publicAccess = false): boolean {
  const feedback = errorFeedback(error, { writing: true, publicAccess });
  if (feedback.kind === "cancelled") return true;
  if (feedback.kind !== "uncertain") return false;
  notify({ id, kind: "error", message: operationalErrorMessage(error, t) });
  return true;
}
