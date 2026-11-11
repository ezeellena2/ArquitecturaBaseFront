import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { disconnectArca } from "./api";
import { useArcaAction } from "./useArcaAction";

interface DisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revision: number;
  onDisconnected: () => void;
  onConflict: () => void;
  /// Where the focus goes back when it opens from an item of ⋮, which is gone when it closes.
  focusFallback?: RefObject<HTMLElement | null>;
}

/// La confirmación dice lo que se pierde: la clave privada y los tickets. Espera abierta hasta que responde el servidor.
export function DisconnectDialog({ open, onOpenChange, revision, onDisconnected, onConflict, focusFallback }: DisconnectDialogProps) {
  const { t } = useTranslation("arca");
  const action = useArcaAction(() => { onOpenChange(false); onConflict(); });
  async function disconnect() {
    const done = await action.run("disconnect", async () => { await disconnectArca(revision); return true; });
    if (done) { onOpenChange(false); onDisconnected(); }
  }
  return <ConfirmDialog open={open} onOpenChange={next => { if (action.pending === null) onOpenChange(next); }} title={t("disconnect.title")}
    description={t("disconnect.description")} confirmLabel={t("disconnect.action")} destructive pending={action.pending === "disconnect"}
    pendingLabel={t("disconnect.pending")} focusFallback={focusFallback} onConfirm={() => void disconnect()} />;
}
