import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

interface UnlinkUserWhatsAppDialogProps {
  /// Cómo se nombra a la persona: su nombre, o el correo, o el número.
  name: string;
  /// El número formateado, entero: el admin tiene que saber cuál saca (no es el suyo, como en el perfil).
  phone: string;
  /// Sin correo, la persona se queda sin forma de entrar; con correo, sigue entrando con él.
  hasEmail: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/// "¿Desvincular el WhatsApp de …?" (tablero "WhatsApp · Usuarios: alta con teléfono", punto 4): el caso del teléfono
/// perdido o robado. Dice qué se pierde: las sesiones abiertas, entrar con ese número y, sin correo, toda forma de
/// entrar.
///
/// El pedido lo hace quien lo abre, no el diálogo: `ConfirmDialog` se cierra al confirmar, así que cuando llega la
/// respuesta ya no está, y su resultado va a un aviso.
export function UnlinkUserWhatsAppDialog({ name, phone, hasEmail, onConfirm, onClose }: UnlinkUserWhatsAppDialogProps) {
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
        hasEmail ? t("unlink.descriptionWithEmail", { phone }) : t("unlink.descriptionWithoutEmail", { phone })
      }
      confirmLabel={t("unlink.confirm")}
      destructive
      onConfirm={onConfirm}
    />
  );
}
