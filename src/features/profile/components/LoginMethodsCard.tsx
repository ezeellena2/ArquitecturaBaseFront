import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "@/shared/ui/notifications";
import { unlinkPhone } from "../api/loginMethods";
import { profileActionErrorMessage } from "../errors";
import { Surface } from "@/shared/ui/Surface";
import { UnlinkWhatsAppDialog } from "./UnlinkWhatsAppDialog";
import { VerifyDestinationDialog } from "./VerifyDestinationDialog";
import { currentUserQueryKey, type CurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { MailIcon, SmartphoneIcon } from "@/shared/ui/icons";
import { VerificationBadge } from "@/shared/ui/VerificationBadge";

type OpenDialog = "addEmail" | "linkWhatsApp" | "unlinkWhatsApp";

/// La misma regla que el backend (`UserGuards.HasOtherLoginMethodAsync`): además del número, la cuenta puede entrar con
/// un correo verificado o con Google. Un correo sin verificar no cuenta, porque con él no se entra.
function hasLoginMethodBesidesPhone(user: CurrentUser): boolean {
  return (user.email !== null && user.emailConfirmed) || user.hasGoogleLogin;
}

/// Una fila: el ícono, qué medio es, su valor (o que falta) y, a la derecha, lo que se puede hacer.
function MethodRow({
  icon: Icon,
  label,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    // En un ancho de celular el botón no entra al lado del texto sin partirlo en renglones de dos palabras: baja debajo
    // del valor, alineado con él.
    <li className="mx-4 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] text-[var(--color-content-muted)]"
      >
        <Icon className="size-4.25" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-[var(--color-content)]">{label}</p>
        {children}
      </div>
      {action ? <div className="col-start-2 sm:col-start-3 sm:row-start-1">{action}</div> : null}
    </li>
  );
}

/// La superficie "Medios de ingreso" de `/perfil` (tablero "WhatsApp · Perfil: correo y WhatsApp", puntos 1, 3 y 4):
/// con qué entra la cuenta, y lo que se puede agregar o sacar. La regla que no se rompe es que nadie se queda sin forma
/// de entrar por su propia mano: si el número es lo único, "Desvincular" queda apagado con ese motivo (`DisabledReason`).
///
/// - El correo se agrega una vez; no hay "cambiar correo".
/// - WhatsApp se ofrece para vincular solo si está prendido (`login-methods`). Un número que ya está se muestra
///   siempre, aunque WhatsApp se haya apagado, para que se pueda desvincular.
/// - El número se muestra formateado (`formattedPhoneNumber`), nunca en E.164, y enmascarado al confirmar.
/// - Lo que se hace acá puede llevarse el botón con el que se hizo. Entonces el foco va al título de la superficie, no
///   a `<body>`: agregar el correo se lleva "Agregar correo"; desvincular con WhatsApp apagado, la fila entera; y si
///   el servidor dice que el número es lo único, "Desvincular" vuelve apagado (es otro elemento, envuelto en su motivo).
export function LoginMethodsCard({ user }: { user: CurrentUser }) {
  const { t } = useTranslation("profile");
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<OpenDialog | undefined>();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // El botón de una fila que se va con el foco puesto se lo pasa al título. React corre esta limpieza antes de sacar
  // el botón de la página, cuando todavía tiene el foco. Es estable a propósito: con una función nueva en cada render,
  // React la limpiaría y la volvería a atar en cada render, con el botón todavía en su lugar. Un botón que cambia de
  // texto en el mismo lugar ("Vincular" ↔ "Desvincular") es el mismo elemento y se queda con el foco.
  const handOffFocusWhenRemoved = useCallback((button: HTMLButtonElement | null) => {
    if (button === null) {
      return undefined;
    }

    return () => {
      if (document.activeElement === button) {
        titleRef.current?.focus();
      }
    };
  }, []);

  const { data: methods } = useQuery({
    queryKey: loginMethodsQueryKey,
    queryFn: getLoginMethods,
    // Si no llegan, la pantalla sigue sin ofrecer vincular WhatsApp: no hay nada que avisar.
    meta: { silent: true },
  });
  const whatsappCountries = methods?.whatsapp === true ? methods.whatsappCountries : [];
  const canLinkWhatsApp = whatsappCountries.length > 0;
  const canUnlinkWhatsApp = hasLoginMethodBesidesPhone(user);

  const unlink = useMutation({
    mutationFn: unlinkPhone,
    onSuccess: async () => {
      notify({ id: "features/profile/components/LoginMethodsCard:1", kind: "success", message: t("unlinkWhatsApp.success") });
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
    onError: async (error) => {
      notify({ id: "features/profile/components/LoginMethodsCard:2", kind: "error", message: profileActionErrorMessage(error, t) });

      // El servidor dice que el número es lo único: el perfil que se ve está viejo (se sacó el correo o Google desde
      // otro lado). Con el perfil nuevo, «Desvincular» queda apagado con el porqué como motivo.
      if (error instanceof ApiError && error.code === "Users.User.LastLoginMethod") {
        await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      }
    },
  });

  const closeDialog = () => setOpenDialog(undefined);

  return (
    <Surface title={t("sections.loginMethods")} titleRef={titleRef}>
      <ul className="flex flex-col divide-y divide-[var(--color-border)]/60">
        <MethodRow
          icon={MailIcon}
          label={t("methods.email.label")}
          action={
            user.email ? null : (
              <Button
                ref={handOffFocusWhenRemoved}
                type="button"
                variant="outline"
                onClick={() => setOpenDialog("addEmail")}
              >
                {t("methods.email.add")}
              </Button>
            )
          }
        >
          {user.email ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 text-sm break-all text-[var(--color-content)]">{user.email}</span>
              {user.emailConfirmed ? <VerificationBadge verified>{t("methods.verified")}</VerificationBadge> : null}
            </span>
          ) : (
            <p className="text-sm text-[var(--color-content-muted)]">{t("methods.email.empty")}</p>
          )}
        </MethodRow>

        {user.phoneNumber ? (
          <MethodRow
            icon={SmartphoneIcon}
            label={t("methods.whatsapp.label")}
            action={
              // Si el número es lo único, queda apagado con el porqué como motivo. No se apaga mientras se desvincula: la
              // confirmación espera abierta y, al cerrarse, le devuelve el foco a este botón, que apagado no lo tomaría.
              <DisabledReason reason={canUnlinkWhatsApp ? null : t("methods.whatsapp.onlyMethod")}>
                <Button
                  ref={handOffFocusWhenRemoved}
                  type="button"
                  variant="outline"
                  disabled={!canUnlinkWhatsApp}
                  onClick={() => setOpenDialog("unlinkWhatsApp")}
                >
                  {t("methods.whatsapp.unlink")}
                </Button>
              </DisabledReason>
            }
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm whitespace-nowrap text-[var(--color-content)]">{user.formattedPhoneNumber}</span>
              {user.phoneNumberConfirmed ? <VerificationBadge verified>{t("methods.verified")}</VerificationBadge> : null}
            </span>
          </MethodRow>
        ) : canLinkWhatsApp ? (
          <MethodRow
            icon={SmartphoneIcon}
            label={t("methods.whatsapp.label")}
            action={
              // Envuelto como «Desvincular», sin motivo: es el mismo botón, que al desvincular se queda con el foco.
              <DisabledReason>
                <Button
                  ref={handOffFocusWhenRemoved}
                  type="button"
                  variant="outline"
                  onClick={() => setOpenDialog("linkWhatsApp")}
                >
                  {t("methods.whatsapp.link")}
                </Button>
              </DisabledReason>
            }
          >
            <p className="text-sm text-[var(--color-content-muted)]">{t("methods.whatsapp.notLinked")}</p>
          </MethodRow>
        ) : null}
      </ul>

      {openDialog === "addEmail" ? (
        <VerifyDestinationDialog channel="email" focusFallback={titleRef} onClose={closeDialog} />
      ) : null}

      {openDialog === "linkWhatsApp" ? (
        <VerifyDestinationDialog
          channel="whatsapp"
          countries={whatsappCountries}
          focusFallback={titleRef}
          onClose={closeDialog}
        />
      ) : null}

      {openDialog === "unlinkWhatsApp" ? (
        <UnlinkWhatsAppDialog
          maskedPhone={user.maskedPhoneNumber ?? ""}
          pending={unlink.isPending}
          // Si con la respuesta la fila ya no tiene ese botón (se fue la fila, o volvió apagado), el foco va al título.
          focusFallback={titleRef}
          // Espera abierta y se cierra con la respuesta, también si falla (el porqué va a un aviso).
          onConfirm={() => unlink.mutate(undefined, { onSettled: closeDialog })}
          onClose={closeDialog}
        />
      ) : null}
    </Surface>
  );
}
