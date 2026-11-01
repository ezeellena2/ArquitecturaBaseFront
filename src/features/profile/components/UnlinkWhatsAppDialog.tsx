import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface UnlinkWhatsAppDialogProps {
  /// El número con el medio tapado ("+54 9 11 •••• 6789"): dice cuál se pierde sin repetirlo entero.
  maskedPhone: string;
  /// El pedido está en camino: la confirmación muestra «Desvinculando…» y espera abierta (`ConfirmDialog.pending`).
  pending: boolean;
  /// A dónde va el foco al cerrar si el botón que la abrió ya no está o quedó apagado.
  focusFallback?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onClose: () => void;
}

/// "¿Desvincular tu WhatsApp?" (tablero "WhatsApp · Perfil: correo y WhatsApp", punto 4). Dice qué se pierde: entrar
/// con ese número y desde el chat. La pantalla solo lo ofrece si hay otro medio de ingreso, pero quien decide es el
/// servidor (`Users.User.LastLoginMethod`).
///
/// El pedido lo hace quien lo abre, no el diálogo: la confirmación espera abierta hasta que llega la respuesta y quien
/// la abrió la cierra; el error va a un aviso.
export function UnlinkWhatsAppDialog({ maskedPhone, pending, focusFallback, onConfirm, onClose }: UnlinkWhatsAppDialogProps) {
  const { t } = useTranslation("profile");

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={t("unlinkWhatsApp.title")}
      description={t("unlinkWhatsApp.description", { phone: maskedPhone })}
      confirmLabel={t("unlinkWhatsApp.confirm")}
      destructive
      pending={pending}
      pendingLabel={t("unlinkWhatsApp.unlinking")}
      focusFallback={focusFallback}
      onConfirm={onConfirm}
    />
  );
}
