import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type ComponentProps, type RefObject } from "react";
import { Trans, useTranslation } from "react-i18next";
import { notify, notifyOperationalError } from "@/shared/ui/notifications";
import { z } from "zod";
import {
  confirmEmail,
  confirmPhoneLink,
  requestEmailCode,
  requestEmailConfirmationCode,
  requestPhoneConfirmationCode,
  requestPhoneLinkCode,
} from "@/shared/api/destinationVerification";
import { isSpentCodeError, isTakenError } from "@/shared/api/destinationErrors";
import { currentUserQueryKey, useCurrentUser, type CurrentUser } from "@/auth/useCurrentUser";
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
import { useWaitText } from "@/shared/hooks/useWaitText";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { OtpInput } from "@/shared/ui/OtpInput";
import { PhoneField } from "@/shared/ui/PhoneField";

const CODE_LENGTH = 6;

const emailSchema = z.email();

/// Vincular WhatsApp lleva los países a los que se mandan códigos (`whatsappCountries`), y arranca en el primero. Con el
/// número de la cuenta ya escrito (`initialPhone`) sirve para verificarlo o para vincular su chat, que se nombran con su
/// propio título y aviso (`copy`): confirmar el número es lo mismo en los tres casos.
export type VerifyDestinationDialogProps = (
  | {
      readonly channel: "whatsapp";
      readonly countries: readonly string[];
      readonly initialPhone?: string;
      readonly copy?: { readonly title: string; readonly success: string };
    }
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

/// El medio verificado que la cuenta ya tiene y que confirma el cambio (N11, «cada medio confirma»).
type ConfirmWith =
  | { readonly channel: "whatsapp"; readonly maskedPhone: string }
  | { readonly channel: "email"; readonly email: string };

/// La misma regla que el backend (`ProfileEmailLinker`, `PhoneNumberLinker`): agregar un correo con el número verificado
/// se confirma con un código a ese número; vincular un número, o verificar el que cargó un administrador, con el correo
/// verificado, con un código a ese correo. Con el número ya verificado (vincular su chat) no hay cambio que confirmar.
/// Los cambios son de la propia cuenta (`/api/me`): el medio sale del perfil de la sesión, el mismo que se refresca al
/// terminar, así un perfil viejo se corrige solo al volver a pedirlo.
function confirmationMediumOf(channel: SentTo["channel"], user: CurrentUser | undefined): ConfirmWith | undefined {
  if (user === undefined) {
    return undefined;
  }

  if (channel === "email") {
    return user.phoneNumber !== null && user.phoneNumberConfirmed
      ? { channel: "whatsapp", maskedPhone: user.maskedPhoneNumber ?? "" }
      : undefined;
  }

  return user.email !== null && user.emailConfirmed && !user.phoneNumberConfirmed
    ? { channel: "email", email: user.email }
    : undefined;
}

/// Las casillas del código adentro de su `FormField`. El campo les pasa su descripción (la (i) y el error) y acá se le
/// suma a dónde llegó el código: la descripción del diálogo se lee al entrar en él, no cuando cambia, y el foco salta
/// directo a la primera casilla; sin esto, el lector de pantalla diría "Código, Código 1" y no a dónde llegó ni que
/// vence. El grupo se nombra con su etiqueta (`label`), y el id del campo va a la primera casilla, que así nombra la
/// etiqueta del campo. El `aria-invalid` del campo no va a `OtpInput`: las
/// casillas se marcan sólo cuando el código estaba mal escrito (`invalid`), no ante cualquier problema.
function CodeBoxes({
  sentToId,
  id: fieldId,
  "aria-invalid": _fieldInvalid,
  "aria-describedby": fieldDescription,
  ...boxes
}: ComponentProps<typeof OtpInput> & { readonly sentToId: string; readonly id?: string; readonly "aria-invalid"?: boolean }) {
  return <OtpInput {...boxes} id={fieldId} aria-describedby={[sentToId, fieldDescription].filter(Boolean).join(" ")} />;
}

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
/// Que un número ya sea de otra cuenta se dice recién con el código correcto (el punto 5 del tablero). Un correo de otra
/// cuenta, en cambio, se dice al pedir el código, debajo del campo (O28, decisión del 2026-11-25), y otra vez con el
/// código correcto si otra cuenta lo tomó en el medio.
///
/// Si la cuenta ya tiene otro medio verificado, el cambio se confirma también con un código a ese medio (N11,
/// `confirmationMediumOf`): se pide cuando el servidor aceptó el del destino y va en un segundo campo, con su texto, su
/// error y su propio reenvío. Cada código se reenvía por separado: que falle uno no vuelve atrás ni gasta el otro.
///
/// La pantalla lo monta solo mientras está abierto, así arranca vacío cada vez.
export function VerifyDestinationDialog(props: VerifyDestinationDialogProps) {
  const { channel, onClose, focusFallback } = props;
  const countries = props.channel === "whatsapp" ? props.countries : [];
  const { t } = useTranslation("profile");
  const waitText = useWaitText();
  const queryClient = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const sentToId = useId();
  const confirmationSentToId = useId();
  const { data: user } = useCurrentUser();
  const confirmWith = confirmationMediumOf(channel, user);

  const [country, setCountry] = useState(countries[0] ?? "");
  // El número o el correo, como lo escribió la persona. Se conserva al volver desde el código.
  const [value, setValue] = useState(props.channel === "whatsapp" ? props.initialPhone ?? "" : "");
  const [valueError, setValueError] = useState<string | undefined>();
  const [requestError, setRequestError] = useState<string | undefined>();
  const [sentTo, setSentTo] = useState<SentTo | undefined>();
  // Se volvió del código para usar otro destino: el campo toma el foco, porque el botón que se tocó ya no está.
  const [isChangingDestination, setIsChangingDestination] = useState(false);
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<VerifyFailure | undefined>();
  // El código que confirma el cambio (N11): si ya se mandó uno, lo escrito y lo que respondió el servidor sobre él (al
  // pedirlo, o al verificar en `errors.phoneCode` o `errors.emailCode`). No es del destino: sobrevive a «Usar otro».
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [confirmationFailure, setConfirmationFailure] = useState<VerifyFailure | undefined>();

  const { seconds: retrySeconds, isRunning: isRetryLimited, restart: restartRetry } = useCountdown(0);
  const { seconds: resendSeconds, isRunning: isResendWaiting, restart: restartResend } = useCountdown(0);
  const {
    seconds: confirmationSeconds,
    isRunning: isConfirmationWaiting,
    restart: restartConfirmation,
  } = useCountdown(0);

  const whatsappCopy = props.channel === "whatsapp" ? props.copy : undefined;
  const copy =
    channel === "whatsapp"
      ? {
          title: whatsappCopy?.title ?? t("linkWhatsApp.title"),
          taken: t("linkWhatsApp.taken"),
          success: whatsappCopy?.success ?? t("linkWhatsApp.success"),
        }
      : { title: t("addEmail.title"), taken: t("addEmail.taken"), success: t("addEmail.success") };

  function startCodeStep(destination: SentTo, resendAfterSeconds: number) {
    setSentTo(destination);
    setCode("");
    setFailure(undefined);
    restartResend(resendAfterSeconds);
  }

  /// El servidor dijo algo que el perfil a la vista no sabía (un medio que se verificó o se quitó desde otro lado).
  const refreshProfile = () => queryClient.invalidateQueries({ queryKey: currentUserQueryKey });

  /// El código que confirma el cambio, al medio que la cuenta ya tiene. Se pide apenas el servidor aceptó el del destino,
  /// pero por separado: si falla, el diálogo sigue en el paso del código y el error queda debajo de su campo, con su botón.
  const requestConfirmation = useMutation({
    mutationFn: async (medium: ConfirmWith) =>
      medium.channel === "whatsapp"
        ? (await requestPhoneConfirmationCode()).resendAfterSeconds
        : (await requestEmailConfirmationCode("LinkPhone")).resendAfterSeconds,
    onSuccess: (resendAfterSeconds) => {
      setConfirmationSent(true);
      setConfirmationCode("");
      setConfirmationFailure(undefined);
      restartConfirmation(resendAfterSeconds);
    },
    onError: (error) => {
      if (notifyOperationalError(error, `destination:${channel}:confirmation`, t)) return;
      const message = error instanceof ApiError ? codeRequestErrorMessage(error, t) : t("common:states.error");

      // Un código mandado antes sigue como estaba: si ya no servía, sigue sin servir.
      setConfirmationFailure((previous) => ({ message, wrong: false, spent: previous?.spent ?? false, taken: false }));

      if (error instanceof ApiError && error.retryAfterSeconds !== undefined) {
        restartConfirmation(error.retryAfterSeconds);
      }

      // Sin el medio verificado que se veía, o con el que se quería agregar ya verificado: el perfil está viejo.
      if (error instanceof ApiError && error.status === 409) {
        void refreshProfile();
      }
    },
  });

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
    onSuccess: ({ destination, resendAfterSeconds }) => {
      startCodeStep(destination, resendAfterSeconds);

      // El código que confirma el cambio sale cuando el servidor aceptó el destino (un correo de otra cuenta no manda
      // ninguno, O28), si todavía no hay uno: volver para usar otro destino no lo gasta.
      if (confirmWith !== undefined && !confirmationSent && !isConfirmationWaiting && !requestConfirmation.isPending) {
        requestConfirmation.mutate(confirmWith);
      }
    },
    onError: (error) => {
      if (notifyOperationalError(error, `destination:${channel}:request`, t)) return;
      if (!(error instanceof ApiError)) {
        setRequestError(t("common:states.error"));

        return;
      }

      // Un correo de otra cuenta se dice al pedir el código, debajo del campo y con la salida (O28); un número, recién
      // con el código correcto.
      if (channel === "email" && isTakenError(error)) {
        setValueError(copy.taken);

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

      // La cuenta no es la que se ve: ya tiene un correo verificado, que desde el perfil no se cambia.
      if (error.status === 409) {
        void refreshProfile();
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
      if (notifyOperationalError(error, `destination:${channel}:resend`, t)) return;
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
    mutationFn: (destination: SentTo) => {
      const confirmation = confirmWith === undefined ? undefined : confirmationCode;

      return destination.channel === "whatsapp"
        ? confirmPhoneLink({ phone: destination.phone, code, emailCode: confirmation })
        : confirmEmail({ email: destination.email, code, phoneCode: confirmation });
    },
    onSuccess: async () => {
      notify({id: "verify-destination:success", kind: "success", message: copy.success});
      // El perfil lo usan las filas de esta pantalla, el menú del usuario, la barra lateral y el aviso del inicio.
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      onClose();
    },
    onError: async (error) => {
      if (notifyOperationalError(error, `destination:${channel}:verify`, t)) return;
      if (!(error instanceof ApiError)) {
        setFailure({ message: t("common:states.error"), wrong: false, spent: false, taken: false });

        return;
      }

      if (isTakenError(error)) {
        setFailure({ message: copy.taken, wrong: false, spent: true, taken: true });

        return;
      }

      // Lo demás que choca no es de ningún código y no se arregla en el diálogo: la cuenta ya tiene ese medio
      // verificado, WhatsApp no manda códigos o es la cuenta del administrador inicial. Lo dice el servidor, el diálogo
      // se cierra y el perfil se relee.
      if (error.status === 409) {
        notify({ id: `destination:${channel}:conflict`, kind: "error", message: error.detail ?? t("common:states.error") });
        onClose();
        await refreshProfile();

        return;
      }

      // Lo que el servidor dice del código que confirma el cambio va en su campo; el del destino sigue sirviendo.
      const confirmationMessage = error.errors?.[channel === "email" ? "phoneCode" : "emailCode"]?.[0];

      if (confirmationMessage !== undefined) {
        // El perfil a la vista no tenía ese medio verificado, así que el campo no estaba: con el perfil nuevo aparece,
        // sin código pedido todavía, y el aviso dice por qué.
        if (confirmWith === undefined) {
          notify({ id: `destination:${channel}:confirmation-required`, kind: "warning", message: t("confirmChange.nowRequired") });
          await refreshProfile();

          return;
        }

        setConfirmationFailure({
          message: confirmationMessage,
          attemptsLeft: attemptsLeftOf(error),
          wrong: isWrongCodeError(error),
          spent: isSpentCodeError(error),
          taken: false,
        });

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

  // El error de un código: el mensaje y, si los dijo el servidor, los intentos que le quedan.
  const problemOf = (codeFailure: VerifyFailure | undefined) =>
    codeFailure === undefined || codeFailure.taken
      ? undefined
      : [
          codeFailure.message,
          codeFailure.attemptsLeft === undefined
            ? undefined
            : t("common:code.attemptsLeft", { count: codeFailure.attemptsLeft }),
        ]
          .filter(Boolean)
          .join(" ");
  const codeProblem = problemOf(failure);
  const confirmationProblem = problemOf(confirmationFailure);
  const confirmationKey = confirmWith?.channel === "email" ? "confirmChange.email" : "confirmChange.whatsapp";
  const confirmationState = confirmationSent ? "sent" : "unsent";

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
        {/* Para pedir el destino no hay descripción: «Enviar código» ya dice lo que va a pasar. En el paso del código,
            la descripción es a dónde llegó, que es un dato. */}
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          {sentTo === undefined ? null : (
            <DialogDescription>
              {/* Con su propio id, para que el código lo nombre como su descripción (ver `OtpInput`, más abajo). El id
                  no va en `DialogDescription`: Radix nombra al diálogo con el suyo. */}
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
            </DialogDescription>
          )}
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
              <Button type="submit" pending={send.isPending} disabled={isRetryLimited}>
                {send.isPending
                  ? t("common:code.sending")
                  : isRetryLimited ? t("common:code.retryIn", { wait: waitText(retrySeconds) }) : t("common:code.send")}
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
              setConfirmationFailure(undefined);
              confirm.mutate(sentTo);
            }}
          >
            <Button type="button" variant="link" size="inline" className="self-start" onClick={changeDestination}>
              {sentTo.channel === "whatsapp" ? t("common:code.otherPhone") : t("common:code.otherEmail")}
            </Button>

            {/* El campo común (lista de chequeo, 2026-11-11): «Código» a la vista y, por WhatsApp, la (i) con que llega
                al WhatsApp del celular y no a WhatsApp Web, porque el mensaje lo escribe Meta y no dice para qué es el
                código. Lo que respondió la verificación o el reenvío es su error; que el destino ya sea de otra cuenta
                no es del código y sigue en su aviso. */}
            <FormField
              label={t("common:code.label")}
              help={sentTo.channel === "whatsapp" ? t("common:code.whatsappNotice") : undefined}
              error={codeProblem}
            >
              <CodeBoxes
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
                sentToId={sentToId}
              />
            </FormField>

            {failure?.taken ? <Banner tone="danger">{failure.message}</Banner> : null}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              pending={resend.isPending}
              disabled={isResendWaiting || failure?.taken === true}
              onClick={() => resend.mutate(sentTo)}
            >
              {resend.isPending
                ? t("common:code.resending")
                : isResendWaiting ? t("common:code.resendIn", { wait: waitText(resendSeconds) }) : t("common:code.resend")}
            </Button>

            {/* N11: el código que confirma el cambio, al medio que la cuenta ya tiene, con su texto, su error y su
                propio botón. Mientras no hay uno mandado, el texto dice a dónde va y el botón lo pide. */}
            {confirmWith === undefined ? null : (
              <>
                <p id={confirmationSentToId} className="text-sm text-[var(--color-content-muted)]">
                  {confirmWith.channel === "whatsapp" ? (
                    <Trans
                      t={t}
                      i18nKey={`${confirmationKey}.${confirmationState}`}
                      values={{ phone: confirmWith.maskedPhone }}
                      components={{
                        phone: <strong className="font-semibold whitespace-nowrap text-[var(--color-content)]" />,
                      }}
                    />
                  ) : (
                    t(`${confirmationKey}.${confirmationState}`, { email: confirmWith.email })
                  )}
                </p>
                <FormField
                  label={t(`${confirmationKey}.label`)}
                  help={confirmWith.channel === "whatsapp" ? t("common:code.whatsappNotice") : undefined}
                  error={confirmationProblem}
                >
                  <CodeBoxes
                    length={CODE_LENGTH}
                    value={confirmationCode}
                    onChange={(next) => {
                      setConfirmationCode(next);
                      setConfirmationFailure((previous) => (previous ? { ...previous, wrong: false } : previous));
                    }}
                    label={t(`${confirmationKey}.label`)}
                    disabled={confirm.isPending}
                    invalid={confirmationFailure?.wrong}
                    sentToId={confirmationSentToId}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  pending={requestConfirmation.isPending}
                  disabled={isConfirmationWaiting}
                  onClick={() => requestConfirmation.mutate(confirmWith)}
                >
                  {requestConfirmation.isPending
                    ? t(confirmationSent ? "common:code.resending" : "common:code.sending")
                    : isConfirmationWaiting
                      ? t(`${confirmationKey}.${confirmationSent ? "resendIn" : "sendIn"}`, { wait: waitText(confirmationSeconds) })
                      : t(`${confirmationKey}.${confirmationSent ? "resend" : "send"}`)}
                </Button>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common:actions.cancel")}
              </Button>
              <Button
                type="submit"
                pending={confirm.isPending}
                disabled={
                  code.length !== CODE_LENGTH ||
                  (confirmWith !== undefined && confirmationCode.length !== CODE_LENGTH) ||
                  failure?.spent === true ||
                  (confirmWith !== undefined && confirmationFailure?.spent === true) ||
                  failure?.taken === true
                }
              >
                {confirm.isPending ? t("common:code.verifying") : t("common:code.verify")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
