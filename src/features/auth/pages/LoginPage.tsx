import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { useLocation, useSearchParams } from "react-router";
import { externalLoginUrl, getLoginMethods, loginMethodsQueryKey } from "../api/loginCode";
import { EmailCodeForm } from "../components/EmailCodeForm";
import { WhatsAppCodeForm } from "../components/WhatsAppCodeForm";
import { loginRedirectErrorMessage } from "../errors";
import { loginChannelOf, type LoginState } from "../lib/loginCodeState";
import {
  carriedLoginRedirectError,
  carryLoginRedirectError,
  forgetLoginRedirectError,
} from "../lib/loginRedirectError";
import { authorizeReturnUrl } from "../lib/returnUrl";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { Button } from "@/shared/ui/button";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";

type LoginChannel = "email" | "whatsapp";

/// Logo de Google, a mano: no hay una versión de marca en lucide-react.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.3 0 10.2-2 13.9-5.3l-6.4-5.4C29.4 35.6 26.8 36.5 24 36.5c-5.3 0-9.7-3.4-11.3-8.2l-6.5 5C9.6 40.6 16.3 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C39.8 37.5 44 31.7 44 24c0-1.4-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

/// `/login` (sección 5.2). Sin un `returnUrl` válido en la query, todavía no vino del servidor: arranca el
/// OIDC y no muestra nada, porque el servidor vuelve a mandar para acá, esta vez con el `returnUrl` correcto.
///
/// Los medios de ingreso salen de `GET /account/login-methods`. Mientras llega, o si falla, la pantalla es la de
/// siempre (Google y el correo): que ese pedido falle no puede dejar a nadie sin poder entrar con su correo.
export function LoginPage() {
  const { t } = useTranslation("auth");
  const auth = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const updateQuery = useQueryUpdate();
  const returnUrl = authorizeReturnUrl(searchParams.get("returnUrl"));
  const errorCode = searchParams.get("error") ?? undefined;
  const hasStartedRedirectRef = useRef(false);

  // "Usar otro número", en la pantalla del código, vuelve con WhatsApp elegido.
  const [channel, setChannel] = useState<LoginChannel>(() => loginChannelOf(location.state));
  // El error de un ingreso con Google que cruzó el redirect de OIDC (ver `loginRedirectError`). Se lee una vez.
  const [carriedErrorCode] = useState(carriedLoginRedirectError);
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);

  const { data: methods } = useQuery({
    queryKey: loginMethodsQueryKey,
    queryFn: getLoginMethods,
    enabled: returnUrl !== undefined,
    // Si falla, la pantalla sigue como siempre: no hay nada que avisar.
    meta: { silent: true },
  });

  useEffect(() => {
    if (returnUrl || hasStartedRedirectRef.current) {
      return;
    }

    hasStartedRedirectRef.current = true;

    // El backend manda a `/login?error=<código>` sin `returnUrl` cuando falla Google: el código se guarda para
    // mostrarlo cuando el servidor vuelva a mandar para acá, ya con el `returnUrl`.
    if (errorCode !== undefined) {
      carryLoginRedirectError(errorCode);
    }

    const state = location.state as LoginState | null;
    void auth.signinRedirect({ state: { returnTo: state?.returnTo ?? "/" } });
  }, [returnUrl, auth, location.state, errorCode]);

  useEffect(() => {
    if (returnUrl) {
      // Ya quedó leído en `carriedErrorCode`: una recarga o la próxima visita no lo vuelven a mostrar.
      forgetLoginRedirectError();
    }
  }, [returnUrl]);

  if (!returnUrl) {
    return null;
  }

  // Google se oculta solo si el servidor dice que está apagado; WhatsApp se ofrece solo si dice que está prendido.
  const showGoogle = methods?.google !== false;
  const whatsappCountries = methods?.whatsapp === true ? methods.whatsappCountries : undefined;
  const activeChannel: LoginChannel = whatsappCountries === undefined ? "email" : channel;

  const noticeCode = isNoticeDismissed ? undefined : (errorCode ?? carriedErrorCode);
  const notice = noticeCode === undefined ? undefined : loginRedirectErrorMessage(noticeCode, t);

  // El mensaje del error vale hasta que la persona vuelve a intentar: al enviar el formulario se saca. Si vino en
  // la dirección, también se saca de ahí (reemplazando la entrada, sin sumar una al historial): si no, volver
  // atrás desde `/login/codigo` lo mostraría otra vez. El que cruzó el redirect nunca está en la dirección.
  function dismissNotice() {
    setIsNoticeDismissed(true);

    if (errorCode !== undefined) {
      updateQuery({ error: undefined });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-xl font-semibold text-[var(--color-content)]">{t("login.title")}</h1>

      {showGoogle ? (
        <>
          <Button asChild variant="outline" className="w-full">
            <a href={externalLoginUrl(returnUrl)}>
              <GoogleIcon className="size-4" />
              {t("login.google")}
            </a>
          </Button>

          <div className="flex items-center gap-3 text-xs text-[var(--color-content-muted)]">
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
            <span>{t("login.orSeparator")}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)]" />
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-4">
        {whatsappCountries === undefined ? null : (
          <SegmentedControl
            aria-label={t("login.methodLabel")}
            fullWidth
            options={(["email", "whatsapp"] as const).map((option) => ({
              key: option,
              label: t(`login.methods.${option}`),
              pressed: activeChannel === option,
              onSelect: () => setChannel(option),
            }))}
          />
        )}

        {/* Cambiar de medio arma el otro formulario de cero: lo escrito en uno no sirve en el otro. */}
        {activeChannel === "whatsapp" && whatsappCountries !== undefined ? (
          <WhatsAppCodeForm
            returnUrl={returnUrl}
            countries={whatsappCountries}
            notice={notice}
            onSubmitStart={dismissNotice}
          />
        ) : (
          <EmailCodeForm returnUrl={returnUrl} notice={notice} onSubmitStart={dismissNotice} />
        )}
      </div>
    </div>
  );
}
