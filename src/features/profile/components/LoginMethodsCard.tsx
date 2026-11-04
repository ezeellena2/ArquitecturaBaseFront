import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
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
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { AccountRow, AccountRows } from "@/shared/ui/AccountRows";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { GoogleIcon } from "@/shared/ui/GoogleIcon";
import { ClockIcon, MailIcon, SmartphoneIcon } from "@/shared/ui/icons";
import { VerificationBadge } from "@/shared/ui/VerificationBadge";

type OpenDialog = "addEmail" | "linkWhatsApp" | "verifyWhatsApp" | "unlinkWhatsApp";

/// La misma regla que el backend (`UserGuards.HasOtherLoginMethodAsync`): además del número, la cuenta puede entrar con
/// un correo verificado o con Google. Un correo sin verificar no cuenta, porque con él no se entra.
function hasLoginMethodBesidesPhone(user: CurrentUser): boolean {
  return (user.email !== null && user.emailConfirmed) || user.hasGoogleLogin;
}

/// La zona "Medios de ingreso" de `/perfil` (tablero PF1-A): con qué entra la cuenta y su último ingreso, en renglones
/// de columnas fijas (`AccountRows`, la misma pieza que «Editar usuario»). La regla que no se rompe es que nadie se queda
/// sin forma de entrar por su propia mano: si el número es lo único, "Desvincular" queda apagado con ese motivo
/// (`DisabledReason`).
///
/// - El correo se agrega una vez; no hay "cambiar correo". Uno que cargó un administrador dice «Sin verificar».
/// - WhatsApp se ofrece para agregar solo si está prendido (`login-methods`). Un número que ya está se muestra siempre,
///   aunque WhatsApp se haya apagado, para que se pueda desvincular; sin verificar, ofrece «Verificar», que confirma el
///   mismo número con un código.
/// - Google aparece si la cuenta entra con Google: no se vincula ni se desvincula desde acá.
/// - El número se muestra formateado (`formattedPhoneNumber`), nunca en E.164, y enmascarado al confirmar.
/// - Lo que se hace acá puede llevarse el botón con el que se hizo. Entonces el foco va al título de la zona, no a
///   `<body>`: agregar el correo se lleva "Agregar correo"; desvincular con WhatsApp apagado, la fila entera; y si el
///   servidor dice que el número es lo único, "Desvincular" vuelve apagado (es otro elemento, envuelto en su motivo).
export function LoginMethodsCard({ user }: { user: CurrentUser }) {
  const { t, i18n } = useTranslation("profile");
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<OpenDialog | undefined>();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // El botón de una fila que se va con el foco puesto se lo pasa al título. React corre esta limpieza antes de sacar
  // el botón de la página, cuando todavía tiene el foco. Es estable a propósito: con una función nueva en cada render,
  // React la limpiaría y la volvería a atar en cada render, con el botón todavía en su lugar. Un botón que cambia de
  // texto en el mismo lugar ("Agregar número" ↔ "Desvincular") es el mismo elemento y se queda con el foco.
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
    // Si no llegan, la pantalla sigue sin ofrecer agregar WhatsApp: no hay nada que avisar.
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
  const badge = (verified: boolean) =>
    verified ? (
      <VerificationBadge verified>{t("methods.verified")}</VerificationBadge>
    ) : (
      <VerificationBadge verified={false} hint={t("methods.unverifiedHint")}>
        {t("methods.unverified")}
      </VerificationBadge>
    );
  const phone = user.phoneNumber;

  return (
    <Surface title={t("sections.loginMethods")} titleRef={titleRef}>
      <AccountRows>
        <AccountRow
          icon={MailIcon}
          label={t("methods.email.label")}
          value={user.email ?? t("methods.email.empty")}
          muted={user.email === null}
          badge={user.email === null ? undefined : badge(user.emailConfirmed)}
          action={
            user.email ? null : (
              <Button ref={handOffFocusWhenRemoved} type="button" variant="outline" onClick={() => setOpenDialog("addEmail")}>
                {t("methods.email.add")}
              </Button>
            )
          }
        />

        {/* Con número o sin él es la misma fila, y su botón es el mismo elemento: al agregar el número, «Agregar número»
            pasa a «Desvincular» y se queda con el foco. */}
        {phone !== null || canLinkWhatsApp ? (
          <AccountRow
            icon={SmartphoneIcon}
            label={t("methods.whatsapp.label")}
            value={phone === null ? t("methods.whatsapp.notLinked") : <span className="whitespace-nowrap">{user.formattedPhoneNumber}</span>}
            muted={phone === null}
            badge={phone === null ? undefined : badge(user.phoneNumberConfirmed)}
            action={
              <>
                {phone !== null && !user.phoneNumberConfirmed && canLinkWhatsApp ? (
                  <Button type="button" variant="outline" onClick={() => setOpenDialog("verifyWhatsApp")}>
                    {t("methods.whatsapp.verify")}
                  </Button>
                ) : null}
                {/* Si el número es lo único, queda apagado con el porqué como motivo. No se apaga mientras se desvincula:
                    la confirmación espera abierta y, al cerrarse, le devuelve el foco a este botón, que apagado no lo
                    tomaría. Quitar va en rojo (`destructive-outline`); la confirmación dice qué se pierde. */}
                <DisabledReason reason={phone !== null && !canUnlinkWhatsApp ? t("methods.whatsapp.onlyMethod") : null}>
                  <Button
                    ref={handOffFocusWhenRemoved}
                    type="button"
                    variant={phone === null ? "outline" : "destructive-outline"}
                    disabled={phone !== null && !canUnlinkWhatsApp}
                    onClick={() => setOpenDialog(phone === null ? "linkWhatsApp" : "unlinkWhatsApp")}
                  >
                    {phone === null ? t("methods.whatsapp.link") : t("methods.whatsapp.unlink")}
                  </Button>
                </DisabledReason>
              </>
            }
          />
        ) : null}

        {user.hasGoogleLogin ? (
          <AccountRow icon={GoogleIcon} label={t("methods.google.label")} value={t("methods.google.linked")} />
        ) : null}

        {/* El último ingreso no se edita: es lo que el sistema registró. Llega en UTC y se muestra en la zona horaria del
            perfil, igual que las fechas del listado de usuarios. */}
        <AccountRow
          icon={ClockIcon}
          label={t("methods.lastLogin")}
          value={
            user.lastLoginAtUtc
              ? formatDateTimeInZone(user.lastLoginAtUtc, i18n.language, user.timeZoneId)
              : t("methods.lastLoginNever")
          }
          muted={user.lastLoginAtUtc === null}
        />
      </AccountRows>

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

      {openDialog === "verifyWhatsApp" && phone !== null ? (
        <VerifyDestinationDialog
          channel="whatsapp"
          countries={whatsappCountries}
          initialPhone={phone}
          copy={{ title: t("verifyWhatsApp.title"), success: t("verifyWhatsApp.success") }}
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
