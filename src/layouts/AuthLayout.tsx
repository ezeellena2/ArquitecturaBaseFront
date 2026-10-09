import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useSearchParams } from "react-router";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { changePublicLanguage, supportedLanguages } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { PublicPresentationDefaults } from "@/shared/i18n/PublicPresentationDefaults";

export function AuthLayout({ children }: { children?: ReactNode }) {
  const { t, i18n } = useTranslation("auth");
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const registration = pathname.startsWith("/registro");
  const home = pathname === "/";
  const { data: methods } = useQuery({ queryKey: loginMethodsQueryKey, queryFn: getLoginMethods, meta: { silent: true } });
  const returnUrl = params.get("returnUrl");
  const query = returnUrl ? `?${new URLSearchParams({ returnUrl })}` : "";

  return (
    <div className={home ? "access-shell access-home" : "access-shell"}>
      <PublicPresentationDefaults />
      <header className="access-header topbar-surface">
        <div className="access-header-inner">
          {home ? <Link to="/" className="access-brand"><span aria-hidden="true">{t("landing.brand").charAt(0)}</span>{t("landing.brand")}</Link> : null}
          <nav aria-label={t("access.navigation")}>
            {home || registration ? <Button asChild variant="ghost"><Link to={`/login${query}`}>{t("access.signIn")}</Link></Button> : null}
            {methods?.registrationOpen && !registration ? <Button asChild variant="outline"><Link to={`/registro${query}`}>{t("access.register")}</Link></Button> : null}
          </nav>
        </div>
      </header>
      <main className={home ? "access-main" : "access-main access-form-main"}>
        {home ? children : <div className="access-form">{children ?? <Outlet />}</div>}
      </main>
      <footer className="access-footer">
        <div className="access-footer-inner">
          {home ? <small className="access-copyright">{t("landing.copyright", { year: new Date().getFullYear() })}</small> : null}
          <div role="group" className="access-languages" aria-label={t("common:language.label")}>
            {supportedLanguages.map((language) => (
              <button key={language} type="button" aria-pressed={i18n.language === language}
                onClick={() => void changePublicLanguage(language)}>{t(`common:language.${language}`)}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
