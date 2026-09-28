import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  invitationResendWaitSeconds,
  sendInvitation,
  userQueryKey,
  type InvitationChannel,
  type InvitationDeliveryStatus,
  type InvitationRequest,
  type LastInvitation,
  type UserDetail,
} from "../api/users";
import { invitationResendError } from "../errors";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { AlertCircleIcon, CheckCheckIcon, CheckIcon, ClockIcon, SendIcon } from "@/shared/ui/icons";
import { RadioGroupField, type RadioOption } from "@/shared/ui/RadioGroupField";

type IconComponent = ComponentType<{ className?: string }>;

/// Cada estado con su ícono y su texto: el color solo no dice nada a quien no lo distingue. "Entregada" y "Leída" son
/// los dos tildes de WhatsApp, y "Leída" los pinta, como en el chat. "No llegó" es el único que alarma.
const statuses: Readonly<
  Record<InvitationDeliveryStatus, { readonly key: string; readonly icon: IconComponent; readonly tone?: string }>
> = {
  Pending: { key: "pending", icon: ClockIcon },
  Sent: { key: "sent", icon: CheckIcon },
  Delivered: { key: "delivered", icon: CheckCheckIcon },
  Read: { key: "read", icon: CheckCheckIcon, tone: "[&>svg]:text-[var(--color-brand-600)]" },
  Failed: { key: "failed", icon: AlertCircleIcon, tone: "text-[var(--color-danger-700)]" },
};

/// Los errores del reenvío que se muestran en el panel: debajo de la casilla, de las opciones o arriba de los botones.
interface ResendErrors {
  readonly consent?: string;
  readonly channel?: string;
  readonly panel?: string;
}

const second = 1000;
const resendWaitMs = invitationResendWaitSeconds * second;

/// Desde cuándo se puede reenviar, con el reloj de esta máquina. La hora de la invitación es la del servidor, así que no
/// se compara con `Date.now()`: se mira cuánto faltaba cuando llegó el detalle que la trajo (`receivedAt`), entre cero y
/// un minuto, y se cuenta desde ahí. Con el reloj de la máquina atrasado, una invitación de recién parece del futuro, y
/// la espera tiene que seguir siendo de un minuto, no de un minuto más el atraso.
function resendAllowedAt(invitation: LastInvitation, receivedAt: number) {
  const left = Date.parse(invitation.sentAtUtc) + resendWaitMs - receivedAt;

  return receivedAt + Math.min(Math.max(left, 0), resendWaitMs);
}

/// Cuántos segundos faltan para poder reenviar: un minuto desde la última invitación, o lo que diga un 429 (`wait`).
/// Cuenta sola mientras falte.
///
/// "No llegó" también hace esperar. El backend no cobra el minuto si la cola no tomó el mensaje, pero sí si fue el
/// webhook de Meta el que avisó que falló (el 131049 del límite de marketing, el caso común), y el detalle dice `Failed`
/// en los dos casos: ofrecerla enseguida terminaría en un 429.
function useResendWait(invitation: LastInvitation, receivedAt: number) {
  // La hora de la última vuelta, en un objeto nuevo cada vez. Una vuelta puede encontrar la hora donde estaba (un
  // navegador que la redondea, una máquina cargada): con el número solo, React descartaba esa actualización, no se
  // armaba la vuelta siguiente y la cuenta se quedaba quieta, con el botón apagado para siempre.
  const [clock, setClock] = useState(() => ({ at: Date.now() }));
  const [anchor, setAnchor] = useState(() => ({
    sentAtUtc: invitation.sentAtUtc,
    allowedAt: resendAllowedAt(invitation, receivedAt),
  }));
  const [waitUntil, setWaitUntil] = useState(0);

  // Cada invitación se ancla una sola vez, con el detalle que la trajo: volver a pedir el detalle no corre la espera.
  let allowedAt = anchor.allowedAt;
  if (anchor.sentAtUtc !== invitation.sentAtUtc) {
    allowedAt = resendAllowedAt(invitation, receivedAt);
    setAnchor({ sentAtUtc: invitation.sentAtUtc, allowedAt });
  }

  // `clock` es la hora de la última vuelta, y sin espera no hay vueltas: puede ser anterior a la llegada del detalle.
  const current = Math.max(clock.at, receivedAt);
  const remainingMs = Math.max(allowedAt - current, waitUntil - current, 0);

  // Depende de `clock` aunque no lo lea: cada vuelta arma la siguiente, cambie o no el número.
  useEffect(() => {
    if (remainingMs <= 0) {
      return;
    }

    // Hasta el próximo cambio de número, no un segundo fijo: así cada número dura lo que tiene que durar.
    const timer = setTimeout(() => setClock({ at: Date.now() }), remainingMs % second || second);

    return () => clearTimeout(timer);
  }, [remainingMs, clock]);

  function wait(seconds: number) {
    const start = Date.now();
    setClock({ at: start });
    setWaitUntil(start + seconds * second);
  }

  return { seconds: Math.ceil(remainingMs / second), wait };
}

function channelOf(value: string): InvitationChannel {
  return value === "WhatsApp" ? "WhatsApp" : "Email";
}

interface ResendInvitationFormProps {
  titleId: string;
  description: string | undefined;
  options: readonly RadioOption[];
  initialChannel: InvitationChannel | undefined;
  consentLabel: string;
  errors: ResendErrors;
  isPending: boolean;
  onClearError: (field: keyof ResendErrors) => void;
  onCancel: () => void;
  onSubmit: (body: InvitationRequest) => void;
}

/// "Reenviar la invitación", abierto en el lugar de la franja (tablero "Editar usuario · B", punto 4): el canal y, por
/// WhatsApp, el consentimiento. Se monta solo mientras está abierto, así cada reenvío arranca sin la casilla marcada:
/// el consentimiento se confirma cada vez.
///
/// Vive adentro del formulario de la edición, así que no es un `<form>` (no se anidan): sus botones son `type="button"`
/// y no tiene campos de texto con los que un Enter mande nada.
function ResendInvitationForm({
  titleId,
  description,
  options,
  initialChannel,
  consentLabel,
  errors,
  isPending,
  onClearError,
  onCancel,
  onSubmit,
}: ResendInvitationFormProps) {
  const { t } = useTranslation("users");
  const [channel, setChannel] = useState(initialChannel);
  const [consent, setConsent] = useState(false);

  return (
    <>
      <h3 id={titleId} className="col-start-2 text-sm leading-5 font-semibold text-[var(--color-content)]">
        {t("resend.title")}
      </h3>
      {description ? (
        <p className="col-start-2 mt-0.5 text-[12.5px] leading-[1.45] text-[var(--color-content-muted)]">
          {description}
        </p>
      ) : null}

      {/* Las opciones traen su propio margen interno: se lo compensa para que el botón de opción quede alineado con el
          título, como en el tablero. */}
      <div className="col-start-2 mt-2 flex flex-col gap-0.5">
        <div className="-ml-2.5">
          <RadioGroupField
            label={t("invitation.channel")}
            options={options}
            value={channel}
            onValueChange={(next) => {
              setChannel(channelOf(next));
              onClearError("channel");
            }}
            error={errors.channel}
          />
        </div>

        {channel === "WhatsApp" ? (
          <div className="my-0.5 ml-[26px] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <CheckboxField
              label={consentLabel}
              description={t("invitation.consentHint")}
              error={errors.consent}
              checked={consent}
              onCheckedChange={(next) => {
                setConsent(next);
                onClearError("consent");
              }}
            />
          </div>
        ) : null}
      </div>

      {errors.panel ? (
        <p role="alert" className="col-start-2 mt-2 text-sm text-[var(--color-danger)]">
          {errors.panel}
        </p>
      ) : null}

      <div className="col-start-2 mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("common:actions.cancel")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("resend.submitLabel")}
          disabled={channel === undefined || isPending}
          onClick={() => {
            if (channel !== undefined) {
              // Por correo no se pide consentimiento: va en false aunque la casilla haya quedado marcada de antes.
              onSubmit({ channel, consent: channel === "WhatsApp" && consent });
            }
          }}
        >
          {t("resend.submit")}
        </Button>
      </div>
    </>
  );
}

interface LastInvitationStripProps {
  /// La cuenta, tal como la guardó el backend: el reenvío usa su correo, su número y su nombre, no lo que esté escrito
  /// a medias en la edición.
  user: UserDetail;
  invitation: LastInvitation;
  /// Cuándo llegó el detalle que trae la invitación, con el reloj de esta máquina (`dataUpdatedAt` de la consulta): la
  /// espera se cuenta desde ahí y no comparando la hora del servidor con la de la máquina.
  receivedAt: number;
  whatsappEnabled: boolean;
}

/// La última invitación, aparte y debajo de los medios de ingreso (tablero "Editar usuario · B", puntos 1 y 4): es un
/// envío, no un medio de ingreso. Dice por dónde salió, cuándo y cómo le fue: por WhatsApp, lo que avisa Meta; por
/// correo, solo "No llegó" si la cola no lo tomó. "Reenviar invitación" se abre en el lugar, sin otro diálogo encima,
/// y después del envío hay que esperar un minuto.
///
/// Solo se muestra si la cuenta tiene una invitación: el tablero no dibuja invitar a quien nunca se invitó desde acá.
export function LastInvitationStrip({ user, invitation, receivedAt, whatsappEnabled }: LastInvitationStripProps) {
  const { t, i18n } = useTranslation("users");
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const titleId = useId();
  const waitId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const resendRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [errors, setErrors] = useState<ResendErrors>({});
  const { seconds, wait } = useResendWait(invitation, receivedAt);

  /// Al cerrar el panel, el foco vuelve a "Reenviar invitación". Si quedó apagado por la espera no puede tomarlo, y lo
  /// toma la franja, que dice qué pasó: si no, cae en `<body>`. Puede estar apagado aunque se cierre con Cancelar: el
  /// detalle se vuelve a pedir con el panel abierto (al volver a la ventana) y trae una invitación que otro mandó recién.
  ///
  /// Si ya estaba cerrado, se canceló con el envío en camino, y Cancelar dejó el foco en "Reenviar invitación": la
  /// respuesta que lo apaga (`"strip"`) también se lo pasa a la franja. Si la persona ya lo llevó a otro lado, no se toca.
  function close(focus: "button" | "strip") {
    if (isOpen) {
      flushSync(() => setIsOpen(false));
      const button = resendRef.current;
      (focus === "button" && button?.disabled === false ? button : sectionRef.current)?.focus();
    } else if (focus === "strip" && document.activeElement === resendRef.current) {
      sectionRef.current?.focus();
    }
  }

  function open() {
    setErrors({});
    flushSync(() => setIsOpen(true));
    // El foco va a la opción elegida, como en cualquier grupo de opciones.
    const section = sectionRef.current;
    const radio =
      section?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
      section?.querySelector<HTMLElement>('[role="radio"]:not(:disabled)');
    (radio ?? section)?.focus();
  }

  const resend = useMutation({
    mutationFn: (body: InvitationRequest) => sendInvitation(user.id, body),
    onSuccess: async () => {
      wait(invitationResendWaitSeconds);
      close("strip");
      toast.success(t("lastInvitation.resent"));
      // El detalle trae la invitación nueva, pendiente.
      await queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) });
    },
    onError: async (error) => {
      const placed = invitationResendError(error, t);

      switch (placed.place) {
        case "wait":
          // Alguien la mandó hace menos de un minuto (otro admin, u otra pestaña): se espera lo que dice el servidor
          // y se trae la invitación que la frenó.
          wait(placed.seconds);
          close("strip");
          toast.error(placed.message);
          await queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) });
          break;
        case "consent":
        case "channel":
        case "panel":
          // Van en el panel, en su lugar. Si se canceló con el envío en camino, el panel ya no está, y abrirlo de nuevo
          // los borra: van a un aviso, como la respuesta buena, para que no se pierdan en silencio. `isOpen` es el de
          // ahora y no el del envío: TanStack le pasa las opciones nuevas a la mutación que está en curso.
          if (isOpen) {
            setErrors({ [placed.place]: placed.message });
          } else {
            toast.error(placed.message);
          }
          break;
        case "toast":
          toast.error(placed.message);
          break;
      }
    },
  });

  const phone = user.formattedPhoneNumber;
  const options: RadioOption[] = [
    {
      value: "Email",
      label: t("invitation.email"),
      description: user.email ?? t("invitation.emailNeeded"),
      disabled: user.email === null,
    },
  ];

  // Con WhatsApp apagado no se ofrece, como en el alta: el backend respondería que no está disponible.
  if (whatsappEnabled) {
    options.push({
      value: "WhatsApp",
      label: t("invitation.whatsApp"),
      description: phone ?? t("invitation.phoneNeeded"),
      disabled: phone === null,
    });
  }

  // Arranca en el canal de la última, si todavía se puede; si no, en el que se pueda.
  const usable = options.filter((option) => option.disabled !== true).map((option) => channelOf(option.value));
  const initialChannel = usable.includes(invitation.channel) ? invitation.channel : usable[0];

  // "Laura aceptó…": con el nombre de pila, como la saluda la plantilla, igual que en el alta.
  const firstName = user.displayName?.trim().split(/\s+/)[0] ?? "";
  const app = t("common:app.name");
  const consentLabel = firstName
    ? t("invitation.consent", { name: firstName, app })
    : t("invitation.consentWithoutName", { app });

  const failed = invitation.deliveryStatus === "Failed";
  // "No llegó" se ve igual por los dos canales; lo que cambia es el porqué y a qué otro canal se puede pasar. Por
  // WhatsApp avisó Meta (su límite o un rechazo); por correo, la cola no lo tomó. Se ofrece el otro canal solo si se
  // puede usar, como las opciones del reenvío.
  const failure = !failed
    ? undefined
    : invitation.channel === "Email"
      ? {
          hint: t("lastInvitation.failedHintByEmail"),
          resend:
            whatsappEnabled && phone !== null ? t("resend.failedByEmail") : t("resend.failedByEmailWithoutWhatsApp"),
        }
      : {
          hint: t("lastInvitation.failedHint"),
          resend: user.email === null ? t("resend.failedWithoutEmail") : t("resend.failed"),
        };
  const waiting = seconds > 0;
  const status = invitation.deliveryStatus === null ? undefined : statuses[invitation.deliveryStatus];
  const StatusIcon = status?.icon;

  return (
    <section
      ref={sectionRef}
      // Toma el foco cuando el panel se cierra y "Reenviar invitación" quedó apagado. No es un control: sin anillo.
      tabIndex={-1}
      aria-label={isOpen ? undefined : t("lastInvitation.title")}
      aria-labelledby={isOpen ? titleId : undefined}
      // En un teléfono el botón no entra al lado del texto sin aplastarlo: por debajo de `sm` baja debajo, con la
      // espera abajo de él. El tablero no dibuja el teléfono; desde `sm` es el tablero.
      className={cn(
        "grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-px rounded-[10px] bg-[var(--color-surface-muted)] py-2.5 pr-3 pl-3.5 outline-none",
        isOpen ? "items-start pb-3" : "items-center sm:grid-cols-[32px_minmax(0,1fr)_auto]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "row-span-2 inline-flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-content-muted)]",
          isOpen ? "mt-0.5" : "",
        )}
      >
        <SendIcon className="size-4" />
      </span>

      {isOpen ? (
        <ResendInvitationForm
          titleId={titleId}
          description={failure?.resend}
          options={options}
          initialChannel={initialChannel}
          consentLabel={consentLabel}
          errors={errors}
          isPending={resend.isPending}
          onClearError={(field) => {
            if (errors[field] !== undefined) {
              setErrors((previous) => ({ ...previous, [field]: undefined }));
            }
          }}
          onCancel={() => close("button")}
          onSubmit={(body) => {
            setErrors({});
            resend.mutate(body);
          }}
        />
      ) : (
        <>
          <p
            className={cn(
              "col-start-2 row-start-1 text-[13px] leading-[18px] font-medium text-[var(--color-content)]",
              waiting ? "sm:self-end" : "",
            )}
          >
            {invitation.channel === "WhatsApp" ? t("lastInvitation.byWhatsApp") : t("lastInvitation.byEmail")}
          </p>
          <p
            className={cn(
              "col-start-2 row-start-2 flex flex-wrap items-center gap-1.5 text-[12.5px] leading-[18px] text-[var(--color-content-muted)]",
              waiting ? "sm:self-start" : "",
            )}
          >
            <span className="tabular-nums">
              {formatDateTimeInZone(invitation.sentAtUtc, i18n.language, currentUser?.timeZoneId)}
            </span>
            {status !== undefined && StatusIcon !== undefined ? (
              // El punto va con el estado: si no entran en un renglón, bajan juntos y el punto no queda colgando.
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true">·</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium text-[var(--color-content)]",
                    status.tone ?? "",
                  )}
                >
                  <StatusIcon className="size-3.5" />
                  {t(`lastInvitation.status.${status.key}`)}
                </span>
              </span>
            ) : null}
          </p>
          <Button
            ref={resendRef}
            type="button"
            size="sm"
            // Discreto mientras todo anda; con contorno cuando pide atención (no llegó) o está esperando.
            variant={failed || waiting ? "outline" : "ghost"}
            disabled={waiting}
            aria-describedby={waiting ? waitId : undefined}
            className={cn(
              "col-start-2 row-start-4 mt-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:mt-0 sm:justify-self-end",
              waiting ? "" : "sm:row-span-2",
            )}
            onClick={open}
          >
            {t("lastInvitation.resend")}
          </Button>
          {waiting ? (
            <p
              id={waitId}
              className="col-start-2 row-start-5 justify-self-start text-[12.5px] leading-[18px] text-[var(--color-content-muted)] tabular-nums sm:col-start-3 sm:row-start-2 sm:self-start sm:justify-self-end"
            >
              {t("lastInvitation.resendIn", { seconds })}
            </p>
          ) : null}
          {failure ? (
            <p className="col-start-2 row-start-3 mt-1.5 text-[12.5px] leading-[1.45] text-[var(--color-content-muted)] sm:col-span-2">
              {failure.hint}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
