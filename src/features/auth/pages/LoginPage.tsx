import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm, type Path } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { externalLoginUrl, requestLoginCode } from "../api/loginCode";
import { authorizeReturnUrl } from "../lib/returnUrl";
import { ApiError } from "@/shared/api/ApiError";
import { applyApiErrorToForm } from "@/shared/api/formErrors";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";

const schema = z.object({ email: z.email() });

type FormValues = z.infer<typeof schema>;

/// El estado que arma `ProtectedRoute` cuando manda para acá sin sesión.
interface LoginLocationState {
  returnTo?: string;
}

function messageFor(error: ApiError, generic: string, network: string): string {
  return error.detail ?? (error.isNetworkError ? network : generic);
}

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
export function LoginPage() {
  const { t } = useTranslation("auth");
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = authorizeReturnUrl(searchParams.get("returnUrl"));
  const hasStartedRedirectRef = useRef(false);

  const [formError, setFormError] = useState<string | undefined>();
  const { seconds: retrySeconds, isRunning: isRetryLimited, restart: restartRetry } = useCountdown(0);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (returnUrl || hasStartedRedirectRef.current) {
      return;
    }

    hasStartedRedirectRef.current = true;
    const state = location.state as LoginLocationState | null;
    void auth.signinRedirect({ state: { returnTo: state?.returnTo ?? "/" } });
  }, [returnUrl, auth, location.state]);

  if (!returnUrl) {
    return null;
  }

  // TypeScript no lleva el chequeo de arriba adentro de las funciones anidadas (`onSubmit`): esta constante
  // sí queda tipada `string`, porque nunca se reasigna.
  const currentReturnUrl = returnUrl;

  function setFieldError(field: string, error: { type: string; message: string }) {
    // El backend responde nombres de campo en camelCase, que acá son las claves de FormValues.
    setError(field as Path<FormValues>, error);
  }

  async function onSubmit(values: FormValues) {
    setFormError(undefined);

    try {
      const response = await requestLoginCode(values.email);

      // Navegación del router, no del navegador: el código nunca pasa por acá, y el email viaja en el
      // estado de la ruta, no en la URL.
      void navigate(`/login/codigo?returnUrl=${encodeURIComponent(currentReturnUrl)}`, {
        state: { email: values.email, resendAfterSeconds: response.resendAfterSeconds },
      });
    } catch (caught) {
      if (!(caught instanceof ApiError)) {
        throw caught;
      }

      if (applyApiErrorToForm(caught, setFieldError)) {
        return;
      }

      setFormError(messageFor(caught, t("errors.generic"), t("common:errors.network")));

      if (caught.retryAfterSeconds !== undefined) {
        restartRetry(caught.retryAfterSeconds);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-xl font-semibold text-[var(--color-content)]">{t("login.title")}</h1>

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

      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
      >
        <FormField label={t("login.emailLabel")} error={errors.email ? t("login.emailInvalid") : undefined}>
          <Input type="email" autoComplete="email" {...register("email")} />
        </FormField>

        {formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting || isRetryLimited}>
          {isRetryLimited ? t("login.submitRetry", { seconds: retrySeconds }) : t("login.submit")}
        </Button>
      </form>
    </div>
  );
}
