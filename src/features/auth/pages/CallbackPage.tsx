import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { Link, useNavigate } from "react-router";
import { Spinner } from "@/shared/ui/Spinner";

/// El estado que viaja en `signinRedirect` es el que arma `LoginPage`: siempre trae `returnTo`.
interface CallbackState {
  returnTo?: string;
}

/// `/auth/callback`: react-oidc-context ya canjeó el code acá adentro (sección 5.2, paso 5).
export function CallbackPage() {
  const { t } = useTranslation("auth");
  const auth = useAuth();
  const navigate = useNavigate();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!auth.isAuthenticated || hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    const state = auth.user?.state as CallbackState | undefined;
    navigate(state?.returnTo ?? "/", { replace: true });
  }, [auth.isAuthenticated, auth.user, navigate]);

  if (auth.error) {
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
