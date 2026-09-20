import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { requestLoginCode, verifyLoginCode } from "../api/loginCode";
import { OtpInput } from "../components/OtpInput";
import { authorizeReturnUrl, loginPathFor } from "../lib/returnUrl";
import { ApiError } from "@/shared/api/ApiError";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";

const CODE_LENGTH = 6;

// Códigos que, además de mostrar el error, cortan el intento: hay que pedir un código nuevo.
const lockedOutCodes = new Set(["Auth.Account.LockedOut", "Auth.LoginCode.TooManyAttempts"]);

/// El estado que arma `LoginPage` al pedir el código.
interface LoginCodeState {
  email?: string;
  resendAfterSeconds?: number;
}

function messageFor(error: ApiError, generic: string, network: string): string {
  return error.detail ?? (error.isNetworkError ? network : generic);
}

/// `attemptsLeft` es una extensión del ProblemDetails (sección 6.1): no tiene un getter propio en ApiError.
function attemptsLeftFrom(error: ApiError): number | undefined {
  const value = error.problem.attemptsLeft;

  return typeof value === "number" ? value : undefined;
}

/// `/login/codigo` (sección 5.2). Verifica el código de 6 dígitos y, si es válido, vuelve al `returnUrl`
/// original con una navegación real: ahí el servidor ya encuentra la cookie y emite el code de OIDC.
export function LoginCodePage() {
  const { t } = useTranslation("auth");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = authorizeReturnUrl(searchParams.get("returnUrl"));
  const loginPath = loginPathFor(returnUrl);

  const state = location.state as LoginCodeState | null;
  const email = state?.email;

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [attemptsLeft, setAttemptsLeft] = useState<number | undefined>();
  const [isLocked, setIsLocked] = useState(false);

  const {
    seconds: resendSeconds,
    isRunning: isResendRunning,
    restart: restartResend,
  } = useCountdown(state?.resendAfterSeconds ?? 0);

  // Solo depende de `email` y del `returnUrl`: si no hay a quién mandarle el código, o el `returnUrl` no
  // sirve, vuelve a /login apenas se monta la pantalla, sin importar si después cambian `navigate` o
  // `loginPath` (no deberían, en la misma visita).
  useEffect(() => {
    if (!email || !returnUrl) {
      navigate(loginPath, { replace: true });
    }
  }, [email, returnUrl, navigate, loginPath]);

  if (!email || !returnUrl) {
    return null;
  }

  // TypeScript no lleva los chequeos de arriba adentro de las funciones anidadas (`handleVerify`,
  // `handleResend`): estas constantes sí quedan tipadas `string`, porque nunca se reasignan.
  const currentEmail = email;
  const currentReturnUrl = returnUrl;

  async function handleVerify() {
    setIsVerifying(true);
    setError(undefined);

    try {
      const response = await verifyLoginCode({ email: currentEmail, code, returnUrl: currentReturnUrl });

      // Navegación real, no del router: el servidor ya tiene la cookie y emite el code de OIDC.
      globalThis.location.assign(response.returnUrl);
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      setError(messageFor(caught, t("errors.generic"), t("common:errors.network")));
      setAttemptsLeft(attemptsLeftFrom(caught));
      setIsLocked(caught.code !== undefined && lockedOutCodes.has(caught.code));
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    setIsResending(true);
    setError(undefined);

    try {
      const response = await requestLoginCode(currentEmail);
      setCode("");
      setAttemptsLeft(undefined);
      setIsLocked(false);
      restartResend(response.resendAfterSeconds);
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      setError(messageFor(caught, t("errors.generic"), t("common:errors.network")));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Link to={loginPath} className="self-start text-sm font-medium text-[var(--color-brand-600)] hover:underline">
          {t("code.backLink")}
        </Link>
        <h1 className="text-xl font-semibold text-[var(--color-content)]">{t("code.title")}</h1>
        <p className="text-sm text-[var(--color-content-muted)]">{t("code.subtitle", { email })}</p>
      </div>

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleVerify();
        }}
      >
        <OtpInput length={CODE_LENGTH} value={code} onChange={setCode} label={t("code.otpLabel")} disabled={isVerifying} />

        {error ? (
          <div role="alert" className="flex flex-col gap-1 text-sm text-[var(--color-danger)]">
            <p>{error}</p>
            {attemptsLeft !== undefined ? <p>{t("code.attemptsLeft", { count: attemptsLeft })}</p> : null}
          </div>
        ) : null}

        {isLocked ? (
          <Link to={loginPath} className="self-start text-sm font-medium text-[var(--color-brand-600)] hover:underline">
            {t("code.requestNew")}
          </Link>
        ) : null}

        <Button type="submit" className="w-full" disabled={code.length !== CODE_LENGTH || isVerifying || isLocked}>
          {t("code.submit")}
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isResendRunning || isResending}
        onClick={() => void handleResend()}
      >
        {isResendRunning ? t("code.resendIn", { seconds: resendSeconds }) : t("code.resend")}
      </Button>
    </div>
  );
}
