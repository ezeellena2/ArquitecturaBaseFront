import { useQuery } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useLocation, useSearchParams } from "react-router";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { changePublicLanguage, supportedLanguages } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Picker } from "@/shared/ui/Picker";
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
          {/* The year goes as text: every number of a text takes the region's thousands separator («© 2.026»). */}
          {home ? <small className="access-copyright">{t("landing.copyright", { year: String(new Date().getFullYear()) })}</small> : null}
          {/* O50: the language is chosen with the piece to choose, like everything that is chosen (DS1-A); the access pages keep it
              for the next visit. */}
          <div className="access-languages">
            <Picker trigger="button" label={t("common:language.label")} value={i18n.language}
              options={supportedLanguages.map((language) => ({ id: language, label: t(`common:language.${language}`) }))}
              onChange={(language) => void changePublicLanguage(language as (typeof supportedLanguages)[number])} />
          </div>
        </div>
      </footer>
    </div>
  );
}
