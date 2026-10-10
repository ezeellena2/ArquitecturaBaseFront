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
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const restoreFocus = useRestoreFocusOnClose(open, focusFallback);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={restoreFocus}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button size={actionSize} type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t("actions.cancel")}
          </Button>
          <Button
            size={actionSize}
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
