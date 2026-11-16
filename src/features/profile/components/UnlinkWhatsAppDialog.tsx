import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { requestEmailConfirmationCode, unlinkPhone } from "../api/loginMethods";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { attemptsLeftOf, codeRequestErrorMessage, isWrongCodeError, verifyCodeErrorMessage } from "@/shared/api/codeErrors";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useWaitText } from "@/shared/hooks/useWaitText";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { notify, notifyOperationalError } from "@/shared/ui/notifications";
import { OtpInput } from "@/shared/ui/OtpInput";

const CODE_LENGTH = 6;

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

interface UnlinkWhatsAppCodeDialogProps {
  maskedPhone: string;
  /// El correo verificado de la cuenta, al que llega el código.
  email: string;
  focusFallback?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/// "¿Desvincular tu WhatsApp?" con un correo verificado (N11, «cada medio confirma»): la misma pregunta, confirmada con
/// el código que se manda a ese correo (`change: "UnlinkPhone"`), así quien usa una sesión abierta ajena no deja afuera
/// a su dueño. Primero «Enviar código»; después, en el mismo diálogo, el código y «Desvincular». Los errores del código
/// y del reenvío van debajo del campo, como al agregar un correo; si el primer pedido no sale, no hay campo todavía y lo
/// dice un aviso. Lo que choca (ya es el único medio, la cuenta ya no tiene el correo verificado o el número) no se
/// arregla acá: lo dice un aviso, el diálogo se cierra y el perfil se relee, que con un perfil sin correo verificado
/// ofrece la confirmación de siempre.
export function UnlinkWhatsAppCodeDialog({ maskedPhone, email, focusFallback, onClose }: UnlinkWhatsAppCodeDialogProps) {
  const { t } = useTranslation("profile");
  const queryClient = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const sentToId = useId();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [wrong, setWrong] = useState(false);
  const { seconds, isRunning, restart } = useCountdown(0);
  const waitText = useWaitText();

  /// Un 409 no es del código: el perfil a la vista está viejo. Lo dice el servidor, y el diálogo se cierra.
  async function closeOnConflict(error: ApiError) {
    notify({ id: "unlink-whatsapp:conflict", kind: "error", message: error.detail ?? t("common:states.error") });
    onClose();
    await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
  }

  const request = useMutation({
    mutationFn: () => requestEmailConfirmationCode("UnlinkPhone"),
    onSuccess: (response) => {
      setSent(true);
      setCode("");
      setWrong(false);
      setProblem(undefined);
      restart(response.resendAfterSeconds);
    },
    onError: async (error) => {
      if (notifyOperationalError(error, "unlink-whatsapp:request", t)) return;
      if (error instanceof ApiError && error.status === 409) {
        await closeOnConflict(error);

        return;
      }

      const message = error instanceof ApiError ? codeRequestErrorMessage(error, t) : t("common:states.error");

      if (error instanceof ApiError && error.retryAfterSeconds !== undefined) {
        restart(error.retryAfterSeconds);
      }

      // Con un código mandado, el error del reenvío va debajo de su campo; antes no hay campo, y va a un aviso.
      if (sent) {
        setProblem(message);
      } else {
        notify({ id: "unlink-whatsapp:request", kind: "error", message });
      }
    },
  });

  const unlink = useMutation({
    mutationFn: () => unlinkPhone(code),
    onSuccess: async () => {
      notify({ id: "features/profile/components/UnlinkWhatsAppDialog:1", kind: "success", message: t("unlinkWhatsApp.success") });
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      onClose();
    },
    onError: async (error) => {
      if (notifyOperationalError(error, "unlink-whatsapp:verify", t)) return;
      if (!(error instanceof ApiError)) {
        setProblem(t("common:states.error"));

        return;
      }

      if (error.status === 409) {
        await closeOnConflict(error);

        return;
      }

      const attemptsLeft = attemptsLeftOf(error);
      setWrong(isWrongCodeError(error));
      setProblem(
        [verifyCodeErrorMessage(error, t), attemptsLeft === undefined ? undefined : t("common:code.attemptsLeft", { count: attemptsLeft })]
          .filter(Boolean)
          .join(" "),
      );
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent onCloseAutoFocus={restoreFocus}>
        <DialogHeader>
          <DialogTitle>{t("unlinkWhatsApp.title")}</DialogTitle>
          <DialogDescription>
            {t("unlinkWhatsApp.description", { phone: maskedPhone })}{" "}
            <span id={sentToId}>
              {sent ? t("common:code.sentToEmail", { email }) : t("unlinkWhatsApp.codeIntro", { email })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setProblem(undefined);
            unlink.mutate();
          }}
        >
          {sent ? (
            <>
              <FormField label={t("common:code.label")} error={problem}>
                <OtpInput
                  length={CODE_LENGTH}
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    setWrong(false);
                  }}
                  label={t("common:code.label")}
                  disabled={unlink.isPending}
                  invalid={wrong}
                  autoFocus
                  aria-describedby={sentToId}
                />
              </FormField>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                pending={request.isPending}
                disabled={isRunning}
                onClick={() => request.mutate()}
              >
                {request.isPending
                  ? t("common:code.resending")
                  : isRunning ? t("common:code.resendIn", { wait: waitText(seconds) }) : t("common:code.resend")}
              </Button>
            </>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            {sent ? (
              <Button type="submit" variant="destructive" pending={unlink.isPending} disabled={code.length !== CODE_LENGTH}>
                {unlink.isPending ? t("unlinkWhatsApp.unlinking") : t("unlinkWhatsApp.confirm")}
              </Button>
            ) : (
              <Button type="button" pending={request.isPending} disabled={isRunning} onClick={() => request.mutate()}>
                {request.isPending
                  ? t("common:code.sending")
                  : isRunning ? t("common:code.retryIn", { wait: waitText(seconds) }) : t("common:code.send")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
