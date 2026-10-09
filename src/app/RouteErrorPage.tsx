import { useTranslation } from "react-i18next";
import { Page } from "@/shared/ui/Page";
import { Button } from "@/shared/ui/button";

// A failed module import can only be retried reliably in a fresh document.
// Reload is explicit: a render error must never silently discard a draft.
export function RouteErrorPage() {
  const { t } = useTranslation("common");
  return <Page title={t("errors.pageLoad.title")}>
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <p>{t("errors.pageLoad.description")}</p>
      <Button onClick={() => window.location.reload()}>{t("errors.pageLoad.reload")}</Button>
    </div>
  </Page>;
}
