import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /// Por defecto, "Cancelar". Cuando la confirmación es salir o quedarse, conviene nombrar lo que se conserva
  /// ("Seguir editando"): "Cancelar" frente a "Descartar" no dice si se cancela la salida o los cambios.
  cancelLabel?: string;
  destructive?: boolean;
  actionSize?: "default" | "touch";
  onConfirm: () => void;
  focusFallback?: RefObject<HTMLElement | null>;
  /// Para una acción que espera la red (tablero LC1-A): con `pending` el diálogo ya no se cierra solo al confirmar.
  /// Mientras es `true`, el botón final muestra el aro y `pendingLabel` («Desactivando…»), y Cancelar, Escape y la ×
  /// se apagan. El dueño lo cierra cuando llega la respuesta.
  pending?: boolean;
  pendingLabel?: string;
}

/// Diálogo de confirmación para acciones que no se pueden deshacer.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  actionSize = "default",
  onConfirm,
  focusFallback,
  pending,
  pendingLabel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const restoreFocus = useRestoreFocusOnClose(open, focusFallback);
  const waits = pending !== undefined;

  return (
    <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
      <DialogContent
        onCloseAutoFocus={restoreFocus}
        closeDisabledReason={pending ? pendingLabel ?? confirmLabel : undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button size={actionSize} type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t("actions.cancel")}
          </Button>
          <Button
            size={actionSize}
            type="button"
            variant={destructive ? "destructive" : "default"}
            pending={pending}
            onClick={() => {
              onConfirm();
              if (!waits) onOpenChange(false);
            }}
          >
            {pending ? pendingLabel ?? confirmLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
