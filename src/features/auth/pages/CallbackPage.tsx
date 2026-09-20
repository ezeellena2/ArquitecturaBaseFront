import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { Link, useNavigate } from "react-router";
import { Spinner } from "@/shared/ui/Spinner";

/// El estado que viaja en `signinRedirect` es el que arma `LoginPage`: siempre trae `returnTo`.
interface CallbackState {
  returnTo?: string;
}

// El `state` que oidc-client-ts guarda en sessionStorage se pierde si el servidor ya completó una
// autorización que arrancó el SPA solo (se consume al canjear), o si se pasó dos veces por /login sin
// returnUrl (el segundo state pisa al primero). En los dos casos el canje falla con algo como "No matching
// state found in storage", y no es un error terminal: alcanza con reiniciar el flujo. Esta marca evita un
// bucle si el reinicio también falla.
const retryStorageKey = "arquitecturabase.auth-callback-retry";

function hasRetried(): boolean {
  try {
    return globalThis.sessionStorage.getItem(retryStorageKey) === "1";
  } catch {
    return false;
  }
}

function markRetried(): void {
  try {
    globalThis.sessionStorage.setItem(retryStorageKey, "1");
  } catch {
    // Modo privado u otra restricción: sin la marca, en el peor caso se reintenta más de una vez.
  }
}

function clearRetryMark(): void {
  try {
    globalThis.sessionStorage.removeItem(retryStorageKey);
  } catch {
    // Nada que limpiar si tampoco se pudo guardar.
  }
}

/// `/auth/callback`: react-oidc-context ya canjeó el code acá adentro (sección 5.2, paso 5).
export function CallbackPage() {
  const { t } = useTranslation("auth");
  const auth = useAuth();
  const navigate = useNavigate();
  const hasNavigatedRef = useRef(false);
  const hasHandledErrorRef = useRef(false);

  useEffect(() => {
    if (!auth.isAuthenticated || hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    clearRetryMark();
    const state = auth.user?.state as CallbackState | undefined;
    navigate(state?.returnTo ?? "/", { replace: true });
  }, [auth.isAuthenticated, auth.user, navigate]);

  useEffect(() => {
    if (!auth.error || hasHandledErrorRef.current) {
      return;
    }

    hasHandledErrorRef.current = true;
    // Solo el mensaje: el objeto entero o la URL pueden llevar el code.
    console.error(auth.error.message);

    if (hasRetried()) {
      return;
    }

    markRetried();
    navigate("/login", { replace: true });
  }, [auth.error, navigate]);

  if (auth.error && hasRetried()) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {t("callback.error")}
        </p>
        <Link to="/login" className="text-sm font-medium text-[var(--color-brand-600)] hover:underline">
          {t("callback.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <Spinner />
      <p className="text-sm font-medium text-[var(--color-content)]">{t("callback.title")}</p>
      <p className="text-xs text-[var(--color-content-muted)]">{t("callback.hint")}</p>
    </div>
  );
}
