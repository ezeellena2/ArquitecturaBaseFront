import { useTranslation } from "react-i18next";

export function AssistantWelcome() {
  const { t } = useTranslation("assistant");
  return <h2 className="px-2 pb-6 text-2xl font-medium">{t("welcome")}</h2>;
}
