import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface UnlinkUserWhatsAppDialogProps {
  /// Cómo se nombra a la persona: su nombre, o el correo, o el número.
  name: string;
  /// El número formateado, entero: el admin tiene que saber cuál saca (no es el suyo, como en el perfil).
  phone: string;
  /// Sin correo, la persona se queda sin forma de entrar; con correo, sigue entrando con él.
  hasEmail: boolean;
  isOwnAccount?: boolean;
  /// El pedido está en camino: la confirmación muestra «Desvinculando…» y espera abierta (`ConfirmDialog.pending`).
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/// "¿Desvincular el WhatsApp de …?" (tablero "WhatsApp · Usuarios: alta con teléfono", punto 4): el caso del teléfono
/// perdido o robado. Dice qué se pierde: las sesiones abiertas, entrar con ese número y, sin correo, toda forma de
/// entrar.
///
/// El pedido lo hace quien lo abre, no el diálogo: la confirmación espera abierta hasta que llega la respuesta y quien
/// la abrió la cierra; el resultado va a un aviso.
export function UnlinkUserWhatsAppDialog({ name, phone, hasEmail, isOwnAccount, pending, onConfirm, onClose }: UnlinkUserWhatsAppDialogProps) {
  const { t } = useTranslation("users");

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={t("unlink.title", { user: name })}
      description={
        isOwnAccount ? t("unlink.ownDescription", { phone }) : hasEmail ? t("unlink.descriptionWithEmail", { phone }) : t("unlink.descriptionWithoutEmail", { phone })
      }
      confirmLabel={t("unlink.confirm")}
      destructive
      pending={pending}
      pendingLabel={t("unlink.unlinking")}
      onConfirm={onConfirm}
    />
  );
}
