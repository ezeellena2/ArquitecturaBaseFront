import { useQuery } from "@tanstack/react-query";
import { PublicBackIcon as ArrowLeft, PublicMailIcon as Mail, PublicWhatsAppIcon as MessageCircle } from "@/shared/ui/icons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "react-router";
import { externalLoginUrl } from "../api/loginCode";
import { EmailCodeForm } from "../components/EmailCodeForm";
import { WhatsAppCodeForm } from "../components/WhatsAppCodeForm";
import { loginRedirectErrorMessage } from "../errors";
import { loginChannelOf, type LoginState } from "../lib/loginCodeState";
import {
  carriedLoginRedirectError,
  carryLoginRedirectError,
  forgetLoginRedirectError,
} from "../lib/loginRedirectError";
import { authorizeReturnUrl, loginPathFor } from "../lib/returnUrl";
import { createSigninReturnUrl } from "@/auth/accessRequests";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { GoogleIcon } from "@/shared/ui/GoogleIcon";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Button } from "@/shared/ui/button";

type LoginChannel = "email" | "whatsapp";

/// Prepara el pedido OIDC con PKCE y estado sin salir del SPA. El servidor valida el `returnUrl` al ingresar.
///
/// Los medios de ingreso salen de `GET /account/login-methods`. Mientras llega, o si falla, la pantalla es la de
/// siempre (Google y el correo): que ese pedido falle no puede dejar a nadie sin poder entrar con su correo.
export function LoginPage() {
  const { t } = useTranslation("auth");
  const location = useLocation();
  const registration = location.pathname === "/registro";
  const [searchParams] = useSearchParams();
  const updateQuery = useQueryUpdate();
  const returnUrl = authorizeReturnUrl(searchParams.get("returnUrl"));
  const errorCode = searchParams.get("error") ?? undefined;
  const hasStartedPreparationRef = useRef(false);
  const [preparationFailed, setPreparationFailed] = useState(false);
  const [displayName, setDisplayName] = useState((location.state as LoginState | null)?.displayName ?? "");

  // "Usar otro número", en la pantalla del código, vuelve con WhatsApp elegido.
  const [channel, setChannel] = useState<LoginChannel>(() => loginChannelOf(location.state));
  // El error de un ingreso con Google que cruzó el redirect de OIDC (ver `loginRedirectError`). Se lee una vez.
  const [carriedErrorCode] = useState(carriedLoginRedirectError);
  const [isNoticeDismissed, setIsNoticeDismissed] = useState(false);

  const { data: methods, isPending, isError, refetch } = useQuery({
    queryKey: loginMethodsQueryKey,
    queryFn: getLoginMethods,
    enabled: returnUrl !== undefined,
    // Si falla, la pantalla sigue como siempre: no hay nada que avisar.
    meta: { silent: true },
  });

  useEffect(() => {
    if (returnUrl || hasStartedPreparationRef.current) {
      return;
    }

    hasStartedPreparationRef.current = true;

    // El backend manda a `/login?error=<código>` sin `returnUrl` cuando falla Google: el código se guarda para
    // mostrarlo después de preparar el `returnUrl`.
    if (errorCode !== undefined) {
      carryLoginRedirectError(errorCode);
    }

    const state = location.state as LoginState | null;
    void createSigninReturnUrl(state?.returnTo ?? "/", registration)
      .then((prepared) => updateQuery({ returnUrl: prepared }))
      .catch(() => setPreparationFailed(true));
  }, [returnUrl, updateQuery, location.state, errorCode, registration]);

  useEffect(() => {
    if (returnUrl) {
      // Ya quedó leído en `carriedErrorCode`: una recarga o la próxima visita no lo vuelven a mostrar.
      forgetLoginRedirectError();
    }
  }, [returnUrl]);

  if (!returnUrl) {
    return <div role="status"><p>{t(preparationFailed ? "login.errors.unknown" : "access.loading")}</p>
      {preparationFailed ? <Button onClick={() => {
        setPreparationFailed(false);
        const state = location.state as LoginState | null;
        void createSigninReturnUrl(state?.returnTo ?? "/", registration)
          .then((prepared) => updateQuery({ returnUrl: prepared }))
          .catch(() => setPreparationFailed(true));
      }}>{t("access.retry")}</Button> : null}</div>;
  }

  if (registration && (isPending || isError)) {
    return <div role="status"><p>{t(isError ? "access.methodsError" : "access.loading")}</p>
      {isError ? <Button onClick={() => void refetch()}>{t("access.retry")}</Button> : null}</div>;
  }
  if (registration && !methods?.registrationOpen) {
    return <div className="flex flex-col gap-6"><h1>{t("registration.closedTitle")}</h1><p>{t("registration.closed")}</p>
      <Button asChild><Link to={loginPathFor(returnUrl)}>{t("access.signIn")}</Link></Button></div>;
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
      <Link to="/" className="access-back"><ArrowLeft size={16} aria-hidden="true" />{t("access.back")}</Link>
      <div><h1>{t(registration ? "registration.title" : "login.title")}</h1>
        <p className="access-intro">{t(registration ? "registration.intro" : "login.intro")}</p></div>

      {showGoogle ? (
        <>
          <Button asChild variant="outline" className="w-full">
            <a href={externalLoginUrl(returnUrl, registration)}>
              <GoogleIcon className="size-4" />
              {t(registration ? "registration.google" : "login.google")}
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
          <SegmentedControl appearance="public" aria-label={t("login.methodLabel")} options={(["email", "whatsapp"] as const).map(option => ({
            key: option,
            pressed: activeChannel === option,
            onSelect: () => setChannel(option),
            label: <>{option === "email" ? <Mail size={18} aria-hidden="true" /> : <MessageCircle size={18} aria-hidden="true" />}{t(`login.methods.${option}`)}</>,
          }))} />
        )}

        {/* Cambiar de medio arma el otro formulario de cero: lo escrito en uno no sirve en el otro. */}
        {activeChannel === "whatsapp" && whatsappCountries !== undefined ? (
          <WhatsAppCodeForm
            key={`whatsapp-${registration}`}
            registration={registration}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            returnUrl={returnUrl}
            countries={whatsappCountries}
            notice={notice}
            onSubmitStart={dismissNotice}
          />
        ) : (
          <EmailCodeForm key={`email-${registration}`} registration={registration} displayName={displayName} onDisplayNameChange={setDisplayName} returnUrl={returnUrl} notice={notice} onSubmitStart={dismissNotice} />
        )}
      </div>
      {registration || methods?.registrationOpen ? <p className="access-switch">
        {t(registration ? "access.haveAccount" : "access.noAccount")} {" "}
        <Link to={loginPathFor(returnUrl, !registration)}>{t(registration ? "access.signIn" : "access.createAccount")}</Link>
      </p> : null}
    </div>
  );
}
