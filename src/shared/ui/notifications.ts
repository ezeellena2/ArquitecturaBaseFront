import { toast } from "sonner";

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
