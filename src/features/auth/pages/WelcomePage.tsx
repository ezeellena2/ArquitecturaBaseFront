import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { Button } from "@/shared/ui/button";

export function WelcomePage() {
  const { t } = useTranslation("auth");
  const { data: methods } = useQuery({ queryKey: loginMethodsQueryKey, queryFn: getLoginMethods, meta: { silent: true } });
  return (
    <section className="access-welcome" aria-label={t("access.navigation")}>
      <div className="access-cta">
        {methods?.registrationOpen ? <Button asChild><Link to="/registro">{t("access.createAccount")}</Link></Button> : null}
        <Button asChild variant="outline"><Link to="/login">{t("access.signIn")}</Link></Button>
      </div>
    </section>
  );
}
