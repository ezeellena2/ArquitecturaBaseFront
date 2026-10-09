import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useSystemPresentation } from "@/shared/api/presentation";
import { DashboardPage } from "@/features/home/pages/DashboardPage";
import { Page } from "@/shared/ui/Page";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Button } from "@/shared/ui/button";
const AiAssistantPage = lazy(() =>
  import("@/features/artificial-intelligence/pages/AiAssistantPage").then(
    (module) => ({ default: module.AiAssistantPage }),
  ),
);
export function AuthenticatedHome() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const presentation = useSystemPresentation();
  const client = useQueryClient();
  const allowed = user.data?.permissions.includes("ai.assistant.use") ?? false;
  useEffect(() => {
    if (user.data && !allowed)
      client.removeQueries({ queryKey: ["assistant", user.data.id] });
  }, [client, user.data, allowed]);
  if (user.isPending || presentation.isPending)
    return (
      <Page title={t("home.title")}>
        <Spinner />
      </Page>
    );
  if (user.isError || presentation.isError)
    return (
      <Page title={t("home.title")}>
        <EmptyState
          title={t("states.error")}
          action={
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                void user.refetch();
                void presentation.refetch();
              }}
            >
              {t("actions.retry")}
            </Button>
          }
        />
      </Page>
    );
  return allowed &&
    presentation.data?.installedFeatures?.includes("assistant") ? (
    <Suspense
      fallback={
        <Page title={t("home.title")}>
          <Spinner />
        </Page>
      }
    >
      <AiAssistantPage key={user.data?.id} />
    </Suspense>
  ) : (
    <DashboardPage />
  );
}
