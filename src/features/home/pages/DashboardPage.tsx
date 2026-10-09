import { useTranslation } from "react-i18next";
import { AccountRecoveryNotice } from "@/auth/components/AccountRecoveryNotice";
import { Page } from "@/shared/ui/Page";
export function DashboardPage() {
  const { t } = useTranslation();
  return (
    <Page title={t("home.title")}>
      <AccountRecoveryNotice />
    </Page>
  );
}
