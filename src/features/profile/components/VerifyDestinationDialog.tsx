import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type RefObject } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { confirmEmail, confirmPhoneLink, requestEmailCode, requestPhoneLinkCode } from "../api/loginMethods";
import { isSpentCodeError, isTakenError } from "../errors";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import {
  attemptsLeftOf,
  codeRequestErrorMessage,
  isWrongCodeError,
  phoneFieldError,
  verifyCodeErrorMessage,
} from "@/shared/api/codeErrors";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { OtpInput } from "@/shared/ui/OtpInput";
import { PhoneField } from "@/shared/ui/PhoneField";

const CODE_LENGTH = 6;

const emailSchema = z.email();

/// Vincular WhatsApp lleva los países a los que se mandan códigos (`whatsappCountries`), y arranca en el primero.
export type VerifyDestinationDialogProps = (
  | { readonly channel: "whatsapp"; readonly countries: readonly string[] }
  | { readonly channel: "email" }
) & {
  readonly onClose: () => void;
  /// A dónde va el foco al cerrar si el botón que abrió el diálogo ya no está: con el correo agregado, la fila ya no
  /// ofrece "Agregar correo" (ver `useRestoreFocusOnClose`).
  readonly focusFallback?: RefObject<HTMLElement | null>;
};

/// A dónde se mandó el código: el número como lo interpretó el servidor (con su versión enmascarada, para mostrar),
/// o el correo como se escribió.
type SentTo =
  | { readonly channel: "whatsapp"; readonly phone: string; readonly maskedPhone: string }
  | { readonly channel: "email"; readonly email: string };

/// Lo que respondió una verificación que no prosperó.
interface VerifyFailure {
  readonly message: string;
  readonly attemptsLeft?: number;
  /// El código estaba mal escrito: las casillas quedan marcadas hasta que se escriba otro.
  readonly wrong: boolean;
  /// Este código ya no sirve (sin intentos): se pide otro con el reenvío.
  readonly spent: boolean;
  /// El número o el correo ya es de otra cuenta. El código se gastó, y otro para el mismo destino daría lo mismo:
  /// queda usar otro.
  readonly taken: boolean;
}

/// "Vincular WhatsApp" y "Agregar correo" (tablero "WhatsApp · Perfil: correo y WhatsApp", punto 3): es el mismo
/// diálogo, con el número o con el correo. Primero el destino; después, en el mismo diálogo, el código que se mandó
/// ahí, como en el ingreso (tablero "WhatsApp · Ingreso en la web", paso 3). Con el código correcto se guarda, el
/// diálogo se cierra y el perfil se vuelve a pedir, así las filas y el menú muestran lo nuevo.
///
/// Que el destino ya sea de otra cuenta se dice recién con el código correcto, nunca antes (el punto 5 del tablero).
///
/// La pantalla lo monta solo mientras está abierto, así arranca vacío cada vez.
export function VerifyDestinationDialog(props: VerifyDestinationDialogProps) {
  const { channel, onClose, focusFallback } = props;
  const countries = props.channel === "whatsapp" ? props.countries : [];
  const { t } = useTranslation("profile");
  const queryClient = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const sentToId = useId();
  const noticeId = useId();

  const [country, setCountry] = useState(countries[0] ?? "");
  // El número o el correo, como lo escribió la persona. Se conserva al volver desde el código.
  const [value, setValue] = useState("");
  const [valueError, setValueError] = useState<string | undefined>();
  const [requestError, setRequestError] = useState<string | undefined>();
  const [sentTo, setSentTo] = useState<SentTo | undefined>();
  // Se volvió del código para usar otro destino: el campo toma el foco, porque el botón que se tocó ya no está.
  const [isChangingDestination, setIsChangingDestination] = useState(false);
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<VerifyFailure | undefined>();

  const { seconds: retrySeconds, isRunning: isRetryLimited, restart: restartRetry } = useCountdown(0);
  const { seconds: resendSeconds, isRunning: isResendWaiting, restart: restartResend } = useCountdown(0);

  const copy =
    channel === "whatsapp"
      ? { title: t("linkWhatsApp.title"), description: t("linkWhatsApp.description"), taken: t("linkWhatsApp.taken") }
      : { title: t("addEmail.title"), description: t("addEmail.description"), taken: t("addEmail.taken") };

  function startCodeStep(destination: SentTo, resendAfterSeconds: number) {
    setSentTo(destination);
    setCode("");
    setFailure(undefined);
    restartResend(resendAfterSeconds);
  }

  const send = useMutation({
    mutationFn: async (): Promise<{ destination: SentTo; resendAfterSeconds: number }> => {
      if (channel === "whatsapp") {
        const response = await requestPhoneLinkCode({ country, number: value.trim() });

        return {
          destination: { channel, phone: response.phone, maskedPhone: response.maskedPhone },
          resendAfterSeconds: response.resendAfterSeconds,
        };
      }

      const email = value.trim();
      const response = await requestEmailCode(email);

      return { destination: { channel, email }, resendAfterSeconds: response.resendAfterSeconds };
    },
    onSuccess: ({ destination, resendAfterSeconds }) => startCodeStep(destination, resendAfterSeconds),
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setRequestError(t("common:states.error"));

        return;
      }

      // Lo que el servidor le reprocha al número o al correo va debajo del campo; el resto, arriba de los botones.
      const fieldError = channel === "whatsapp" ? phoneFieldError(error, t) : error.errors?.email?.[0];

      if (fieldError !== undefined) {
        setValueError(fieldError);

        return;
      }

      setRequestError(codeRequestErrorMessage(error, t));

      if (error.retryAfterSeconds !== undefined) {
        restartRetry(error.retryAfterSeconds);
      }
    },
  });

  const resend = useMutation({
    mutationFn: async (destination: SentTo) =>
      // El número ya lo interpretó el servidor: con el "+" adelante no hace falta el país.
      destination.channel === "whatsapp"
        ? (await requestPhoneLinkCode({ number: destination.phone })).resendAfterSeconds
        : (await requestEmailCode(destination.email)).resendAfterSeconds,
    onSuccess: (resendAfterSeconds) => {
      setCode("");
      setFailure(undefined);
      restartResend(resendAfterSeconds);
    },
    onError: (error) => {
      const message = error instanceof ApiError ? codeRequestErrorMessage(error, t) : t("common:states.error");

      // El código anterior sigue como estaba: si ya no servía, sigue sin servir.
      setFailure((previous) => ({
        message,
        wrong: false,
        spent: previous?.spent ?? false,
        taken: previous?.taken ?? false,
      }));

      if (error instanceof ApiError && error.retryAfterSeconds !== undefined) {
        restartResend(error.retryAfterSeconds);
      }
    },
  });

  const confirm = useMutation({
    mutationFn: (destination: SentTo) =>
      destination.channel === "whatsapp"
        ? confirmPhoneLink({ phone: destination.phone, code })
        : confirmEmail({ email: destination.email, code }),
    onSuccess: async () => {
      toast.success(channel === "whatsapp" ? t("linkWhatsApp.success") : t("addEmail.success"));
      // El perfil lo usan las filas de esta pantalla, el menú del usuario, la barra lateral y el aviso del inicio.
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      onClose();
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setFailure({ message: t("common:states.error"), wrong: false, spent: false, taken: false });

        return;
      }

      if (isTakenError(error)) {
        setFailure({ message: copy.taken, wrong: false, spent: true, taken: true });

        return;
      }

      setFailure({
        message: verifyCodeErrorMessage(error, t),
        attemptsLeft: attemptsLeftOf(error),
        wrong: isWrongCodeError(error),
        spent: isSpentCodeError(error),
        taken: false,
      });
    },
  });

  function handleSend() {
    // Lo que se dijo del pedido anterior ya no vale para este: si vuelve a pasar, lo vuelve a decir la respuesta.
    setRequestError(undefined);
    setValueError(undefined);

    // Acá solo se controla la forma: si el número es un celular, y de qué país, lo decide el servidor.
    const trimmed = value.trim();
    const isValid = channel === "whatsapp" ? trimmed !== "" : emailSchema.safeParse(trimmed).success;

    if (!isValid) {
      setValueError(channel === "whatsapp" ? t("common:phone.invalid") : t("addEmail.emailInvalid"));

      return;
    }

    send.mutate();
  }

  function changeValue(next: string) {
    setValue(next);
    setValueError(undefined);
  }

  // Un número que el servidor no reconoce casi siempre se arregla eligiendo el país: el reproche ya no vale.
  function changeCountry(next: string) {
    setCountry(next);
    setValueError(undefined);
  }

  function changeDestination() {
    setSentTo(undefined);
    setFailure(undefined);
    setCode("");
    setIsChangingDestination(true);
  }

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
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {sentTo === undefined ? (
              copy.description
            ) : (
              // Con su propio id, para que el código lo nombre como su descripción (ver `OtpInput`, más abajo). El id
              // no va en `DialogDescription`: Radix nombra al diálogo con el suyo.
              <span id={sentToId}>
                {sentTo.channel === "whatsapp" ? (
                  // El número va resaltado y entero, como en el ingreso: partido al final de un renglón, "•••• 6789"
                  // no se lee como parte del mismo número.
                  <Trans
                    t={t}
                    i18nKey="common:code.sentToPhone"
                    values={{ phone: sentTo.maskedPhone }}
                    components={{
                      phone: <strong className="font-semibold whitespace-nowrap text-[var(--color-content)]" />,
                    }}
                  />
                ) : (
                  t("common:code.sentToEmail", { email: sentTo.email })
                )}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {sentTo === undefined ? (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            {channel === "whatsapp" ? (
              <PhoneField
                label={t("common:phone.label")}
                error={valueError}
                countries={countries}
                country={country}
                onCountryChange={changeCountry}
                value={value}
                autoFocus={isChangingDestination}
                onChange={(event) => changeValue(event.target.value)}
              />
            ) : (
              <FormField label={t("addEmail.emailLabel")} error={valueError}>
                <Input
                  type="email"
                  autoComplete="email"
                  value={value}
                  autoFocus={isChangingDestination}
                  onChange={(event) => changeValue(event.target.value)}
                />
              </FormField>
            )}

            {requestError ? (
              <p role="alert" className="text-sm text-[var(--color-danger)]">
                {requestError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common:actions.cancel")}
              </Button>
              <Button type="submit" disabled={send.isPending || isRetryLimited}>
                {isRetryLimited ? t("common:code.retryIn", { seconds: retrySeconds }) : t("common:code.send")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              // Lo que respondió el intento anterior no vale para este, como en el ingreso (LoginCodePage): no queda a
              // la vista mientras se verifica, y si vuelve a fallar igual, el cartel se monta de nuevo y el lector de
              // pantalla lo vuelve a decir. Montado, un texto que no cambia no se anuncia. Con el código gastado o el
              // destino tomado, "Verificar" está apagado y no se llega acá.
              setFailure(undefined);
              confirm.mutate(sentTo);
            }}
          >
            <Button
              type="button"
              variant="link"
              className="h-auto self-start p-0 text-[var(--color-brand-600)]"
              onClick={changeDestination}
            >
              {sentTo.channel === "whatsapp" ? t("common:code.otherPhone") : t("common:code.otherEmail")}
            </Button>

            <OtpInput
              length={CODE_LENGTH}
              value={code}
              onChange={(next) => {
                setCode(next);
                // Lo escrito ya es otro código: las casillas dejan de estar en error.
                setFailure((previous) => (previous ? { ...previous, wrong: false } : previous));
              }}
              label={t("common:code.label")}
              disabled={confirm.isPending}
              invalid={failure?.wrong}
              autoFocus
              // La descripción del diálogo se lee al entrar en él, no cuando cambia: el foco salta a la primera
              // casilla y, sin esto, el lector de pantalla diría "Código, Código 1" y no a dónde llegó, que vence ni
              // que en WhatsApp Web no se ve.
              aria-describedby={sentTo.channel === "whatsapp" ? `${sentToId} ${noticeId}` : sentToId}
            />

            {failure === undefined ? null : failure.taken ? (
              <Banner tone="danger">{failure.message}</Banner>
            ) : (
              <div role="alert" className="flex flex-col gap-1 text-center text-sm text-[var(--color-danger)]">
                <p>{failure.message}</p>
                {failure.attemptsLeft !== undefined ? (
                  <p>{t("common:code.attemptsLeft", { count: failure.attemptsLeft })}</p>
                ) : null}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isResendWaiting || resend.isPending || failure?.taken === true}
              onClick={() => resend.mutate(sentTo)}
            >
              {isResendWaiting ? t("common:code.resendIn", { seconds: resendSeconds }) : t("common:code.resend")}
            </Button>

            {/* El mensaje de WhatsApp lo escribe Meta y no dice para qué es el código: lo dice el diálogo. */}
            {sentTo.channel === "whatsapp" ? (
              <p id={noticeId} className="text-center text-sm text-[var(--color-content-muted)]">
                {t("common:code.whatsappNotice")}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common:actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  code.length !== CODE_LENGTH || confirm.isPending || failure?.spent === true || failure?.taken === true
                }
              >
                {t("common:code.verify")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
