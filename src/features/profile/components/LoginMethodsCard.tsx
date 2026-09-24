import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { unlinkPhone } from "../api/loginMethods";
import { profileActionErrorMessage } from "../errors";
import { ProfileSection } from "./ProfileSection";
import { UnlinkWhatsAppDialog } from "./UnlinkWhatsAppDialog";
import { VerifyDestinationDialog } from "./VerifyDestinationDialog";
import { currentUserQueryKey, type CurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { MailIcon, SmartphoneIcon } from "@/shared/ui/icons";
import { VerificationBadge } from "@/shared/ui/VerificationBadge";

type OpenDialog = "addEmail" | "linkWhatsApp" | "unlinkWhatsApp";

/// La misma regla que el backend (`UserGuards.HasOtherLoginMethodAsync`): además del número, la cuenta puede entrar con
/// un correo verificado o con Google. Un correo sin verificar no cuenta, porque con él no se entra.
function hasLoginMethodBesidesPhone(user: CurrentUser): boolean {
  return (user.email !== null && user.emailConfirmed) || user.hasGoogleLogin;
}

/// Una fila: el ícono, qué medio es, su valor (o que falta) y, a la derecha, lo que se puede hacer. La ayuda va debajo
/// del valor.
function MethodRow({
  icon: Icon,
  label,
  hint,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    // Con ayuda, la fila tiene tres renglones y el botón se queda arriba, a la altura del nombre; sin ayuda, al medio.
    // En un ancho de celular el botón no entra al lado del texto sin partirlo en renglones de dos palabras: baja debajo
    // del valor, alineado con él.
    <li
      className={cn(
        "mx-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]",
        hint ? "items-start" : "items-start sm:items-center",
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] text-[var(--color-content-muted)]"
      >
        <Icon className="size-[17px]" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-[var(--color-content)]">{label}</p>
        {children}
        {hint ? <p className="text-[12.5px] leading-snug text-[var(--color-content-muted)]">{hint}</p> : null}
      </div>
      {action ? <div className="col-start-2 sm:col-start-3 sm:row-start-1">{action}</div> : null}
    </li>
  );
}

/// La superficie "Medios de ingreso" de `/perfil` (tablero "WhatsApp · Perfil: correo y WhatsApp", puntos 1, 3 y 4):
/// con qué entra la cuenta, y lo que se puede agregar o sacar. La regla que no se rompe es que nadie se queda sin forma
/// de entrar por su propia mano: si el número es lo único, en lugar de "Desvincular" va por qué no se puede.
///
/// - El correo se agrega una vez; no hay "cambiar correo".
/// - WhatsApp se ofrece para vincular solo si está prendido (`login-methods`). Un número que ya está se muestra
///   siempre, aunque WhatsApp se haya apagado, para que se pueda desvincular.
/// - El número se muestra formateado (`formattedPhoneNumber`), nunca en E.164, y enmascarado al confirmar.
/// - Lo que se hace acá puede llevarse el botón con el que se hizo. Entonces el foco va al título de la superficie, no
///   a `<body>`: agregar el correo se lleva "Agregar correo"; desvincular con WhatsApp apagado, la fila entera; y si
///   el servidor dice que el número es lo único, "Desvincular" deja lugar a la ayuda.
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
      toast.success(t("unlinkWhatsApp.success"));
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
    onError: async (error) => {
      toast.error(profileActionErrorMessage(error, t));

      // El servidor dice que el número es lo único: el perfil que se ve está viejo (se sacó el correo o Google desde
      // otro lado). Con el perfil nuevo, la fila explica por qué no se puede.
      if (error instanceof ApiError && error.code === "Users.User.LastLoginMethod") {
        await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      }
    },
  });

  const closeDialog = () => setOpenDialog(undefined);

  return (
    <ProfileSection title={t("sections.loginMethods")} titleRef={titleRef}>
      <ul className="flex flex-col divide-y divide-[var(--color-border)]/60">
        <MethodRow
          icon={MailIcon}
          label={t("methods.email.label")}
          hint={user.email ? undefined : t("methods.email.recoveryHint")}
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
            <p className="text-[13.5px] text-[var(--color-content-muted)]">{t("methods.email.empty")}</p>
          )}
        </MethodRow>

        {user.phoneNumber ? (
          <MethodRow
            icon={SmartphoneIcon}
            label={t("methods.whatsapp.label")}
            hint={canUnlinkWhatsApp ? undefined : t("methods.whatsapp.onlyMethod")}
            action={
              // No se apaga mientras se desvincula: la confirmación ya se cerró y le devuelve el foco a este botón, y
              // uno apagado no lo toma. El pedido doble lo frena `onConfirm`.
              canUnlinkWhatsApp ? (
                <Button
                  ref={handOffFocusWhenRemoved}
                  type="button"
                  variant="outline"
                  onClick={() => setOpenDialog("unlinkWhatsApp")}
                >
                  {t("methods.whatsapp.unlink")}
                </Button>
              ) : null
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
              <Button
                ref={handOffFocusWhenRemoved}
                type="button"
                variant="outline"
                onClick={() => setOpenDialog("linkWhatsApp")}
              >
                {t("methods.whatsapp.link")}
              </Button>
            }
          >
            <p className="text-[13.5px] text-[var(--color-content-muted)]">{t("methods.whatsapp.notLinked")}</p>
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
          onConfirm={() => {
            if (!unlink.isPending) {
              unlink.mutate();
            }
          }}
          onClose={closeDialog}
        />
      ) : null}
    </ProfileSection>
  );
}
