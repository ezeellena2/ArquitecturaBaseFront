import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { getLoginMethods, loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { Button } from "@/shared/ui/button";
import { PublicLanding } from "@/shared/ui/PublicLanding";
import { PublicInformationIcon, PublicTeamIcon, PublicTrackingIcon } from "@/shared/ui/icons";

export function WelcomePage() {
  const { t } = useTranslation("auth");
  const { data: methods } = useQuery({ queryKey: loginMethodsQueryKey, queryFn: getLoginMethods, meta: { silent: true } });
  return (
    <PublicLanding title={t("landing.title")} continuation={t("landing.continuation")}
      description={t("landing.description")} featuresLabel={t("landing.featuresLabel")}
      features={[
        { id: "information", icon: <PublicInformationIcon aria-hidden="true" />, title: t("landing.information.title"), description: t("landing.information.description") },
        { id: "team", icon: <PublicTeamIcon aria-hidden="true" />, title: t("landing.team.title"), description: t("landing.team.description") },
        { id: "tracking", icon: <PublicTrackingIcon aria-hidden="true" />, title: t("landing.tracking.title"), description: t("landing.tracking.description") },
      ]}>
      <Button asChild><Link to="/login">{t("access.signIn")}</Link></Button>
      {methods?.registrationOpen ? <Button asChild variant="outline"><Link to="/registro">{t("access.createAccount")}</Link></Button> : null}
    </PublicLanding>
  );
}
