import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { requestLoginCode, requestWhatsAppLoginCode, verifyLoginCode } from "../api/loginCode";
import { OtpInput } from "../components/OtpInput";
import {
  isClosedAccountError,
  isSpentCodeError,
  isWrongCodeError,
  loginCodeErrorMessage,
  verifyErrorMessage,
} from "../errors";
import { codeDestinationOf, resendAfterSecondsOf, type LoginState } from "../lib/loginCodeState";
import { authorizeReturnUrl, loginPathFor } from "../lib/returnUrl";
import { ApiError } from "@/shared/api/ApiError";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";

const CODE_LENGTH = 6;

/// Con WhatsApp, volver a `/login` (por otro número o por un código nuevo) abre con WhatsApp elegido.
const whatsappLoginState: LoginState = { channel: "whatsapp" };

/// `attemptsLeft` es una extensión del ProblemDetails (sección 6.1): no tiene un getter propio en ApiError.
function attemptsLeftFrom(error: ApiError): number | undefined {
  const value = error.problem.attemptsLeft;

  return typeof value === "number" ? value : undefined;
}

/// `/login/codigo` (sección 5.2). Verifica el código de 6 dígitos y, si es válido, vuelve al `returnUrl`
/// original con una navegación real: ahí el servidor ya encuentra la cookie y emite el code de OIDC.
///
/// Es la misma pantalla para el correo y para WhatsApp: cambian el título, a dónde se mandó el código, el aviso de
/// abajo y con qué se verifica y se reenvía. El destino llega en el estado de la ruta (`LoginCodeState`).
export function LoginCodePage() {
  const { t } = useTranslation("auth");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = authorizeReturnUrl(searchParams.get("returnUrl"));
  const loginPath = loginPathFor(returnUrl);
  const destination = codeDestinationOf(location.state);
  const hasDestination = destination !== undefined;

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [attemptsLeft, setAttemptsLeft] = useState<number | undefined>();
  // Este código ya no sirve (sin intentos, o la cuenta bloqueada un rato): se puede pedir otro.
  const [isCodeSpent, setIsCodeSpent] = useState(false);
  // La cuenta no puede entrar (no tiene acceso, o está deshabilitada): ni otro intento ni otro código lo cambian.
  const [isAccountClosed, setIsAccountClosed] = useState(false);
  // El código que se verificó estaba mal escrito: las casillas quedan marcadas hasta que se escriba otro.
  const [isCodeWrong, setIsCodeWrong] = useState(false);

  const {
    seconds: resendSeconds,
    isRunning: isResendRunning,
    restart: restartResend,
  } = useCountdown(resendAfterSecondsOf(location.state));

  // Solo depende de si hay destino y del `returnUrl`: si no hay a quién mandarle el código, o el `returnUrl` no
  // sirve, vuelve a /login apenas se monta la pantalla, sin importar si después cambian `navigate` o
  // `loginPath` (no deberían, en la misma visita).
  useEffect(() => {
    if (!hasDestination || !returnUrl) {
      navigate(loginPath, { replace: true });
    }
  }, [hasDestination, returnUrl, navigate, loginPath]);

  if (!destination || !returnUrl) {
    return null;
  }

  // TypeScript no lleva los chequeos de arriba adentro de las funciones anidadas (`handleVerify`,
  // `handleResend`): estas constantes sí quedan tipadas, porque nunca se reasignan.
  const currentDestination = destination;
  const currentReturnUrl = returnUrl;
  const loginState = destination.channel === "whatsapp" ? whatsappLoginState : undefined;

  async function handleVerify() {
    setIsVerifying(true);
    setError(undefined);

    try {
      const response = await verifyLoginCode(
        currentDestination.channel === "whatsapp"
          ? { phone: currentDestination.phone, code, returnUrl: currentReturnUrl }
          : { email: currentDestination.email, code, returnUrl: currentReturnUrl },
      );

      // Navegación real, no del router: el servidor ya tiene la cookie y emite el code de OIDC.
      globalThis.location.assign(response.returnUrl);
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      setError(verifyErrorMessage(caught, t));
      setAttemptsLeft(attemptsLeftFrom(caught));
      setIsCodeSpent(isSpentCodeError(caught));
      setIsAccountClosed(isClosedAccountError(caught));
      setIsCodeWrong(isWrongCodeError(caught));
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    setError(undefined);

    try {
      // Con WhatsApp se reenvía al número que ya interpretó el servidor, en formato internacional: con el "+" no
      // hace falta el país.
      const response =
        currentDestination.channel === "whatsapp"
          ? await requestWhatsAppLoginCode({ number: currentDestination.phone })
          : await requestLoginCode(currentDestination.email);
      setCode("");
      setIsCodeWrong(false);
      setAttemptsLeft(undefined);
      setIsCodeSpent(false);
      restartResend(response.resendAfterSeconds);
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      setError(loginCodeErrorMessage(caught, t));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <Link
          to={loginPath}
          state={loginState}
          className="self-center text-sm font-medium text-[var(--color-brand-600)] hover:underline"
        >
          {destination.channel === "whatsapp" ? t("code.whatsapp.backLink") : t("code.backLink")}
        </Link>
        <h1 className="text-xl font-semibold text-[var(--color-content)]">
          {destination.channel === "whatsapp" ? t("code.whatsapp.title") : t("code.title")}
        </h1>
        <p className="text-sm text-[var(--color-content-muted)]">
          {destination.channel === "whatsapp" ? (
            // El número va resaltado y entero: partido al final de un renglón, "•••• 6789" no se lee como parte
            // del mismo número.
            <Trans
              t={t}
              i18nKey="code.whatsapp.subtitle"
              values={{ phone: destination.maskedPhone }}
              components={{
                phone: <strong className="font-semibold whitespace-nowrap text-[var(--color-content)]" />,
              }}
            />
          ) : (
            t("code.subtitle", { email: destination.email })
          )}
        </p>
      </div>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleVerify();
        }}
      >
        <OtpInput
          length={CODE_LENGTH}
          value={code}
          onChange={(value) => {
            setCode(value);
            setIsCodeWrong(false);
          }}
          label={t("code.otpLabel")}
          disabled={isVerifying}
          invalid={isCodeWrong}
        />

        {error ? (
          <div role="alert" className="flex flex-col gap-1 text-center text-sm text-[var(--color-danger)]">
            <p>{error}</p>
            {attemptsLeft !== undefined ? <p>{t("code.attemptsLeft", { count: attemptsLeft })}</p> : null}
          </div>
        ) : null}

        {isCodeSpent ? (
          <Link
            to={loginPath}
            state={loginState}
            className="self-center text-sm font-medium text-[var(--color-brand-600)] hover:underline"
          >
            {t("code.requestNew")}
          </Link>
        ) : null}

        {isAccountClosed ? (
          <Link
            to={loginPath}
            state={loginState}
            className="self-center text-sm font-medium text-[var(--color-brand-600)] hover:underline"
          >
            {t("code.backToLogin")}
          </Link>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={code.length !== CODE_LENGTH || isVerifying || isCodeSpent || isAccountClosed}
        >
          {t("code.submit")}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isResendRunning || isResending || isAccountClosed}
        onClick={() => void handleResend()}
      >
        {isResendRunning ? t("code.resendIn", { seconds: resendSeconds }) : t("code.resend")}
      </Button>

      {/* El mensaje de WhatsApp lo escribe Meta y no dice para qué es el código: lo dice esta pantalla. */}
      {destination.channel === "whatsapp" ? (
        <p className="text-center text-sm text-[var(--color-content-muted)]">{t("code.whatsapp.notice")}</p>
      ) : null}
    </div>
  );
}
