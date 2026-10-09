import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useCurrentUser } from "../useCurrentUser";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
export function AccountRecoveryNotice() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  return user && !user.email ? (
    <Banner
      action={
        <Button variant="outline" asChild>
          <Link to="/perfil">{t("home.addEmail")}</Link>
        </Button>
      }
    >
      {t("home.addEmailNotice")}
    </Banner>
  ) : null;
}
