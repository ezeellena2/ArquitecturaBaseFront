import { lazy, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useSystemPresentation } from "@/shared/api/presentation";
import { DashboardPage } from "@/features/home/pages/DashboardPage";
import {
  acceptsProposal,
  formsAssistantPlaceholder,
  formsAssistantSuggestions,
} from "@/features/business-forms/assistantProposalCapabilities";
import {
  AssistantProposalContext,
  type AssistantProposalCardProps,
  type AssistantProposalExtension,
} from "@/shared/hooks/assistantProposalContext";
import { Page } from "@/shared/ui/Page";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Button } from "@/shared/ui/button";
const AiAssistantPage = lazy(() =>
  import("@/features/artificial-intelligence/pages/AiAssistantPage").then(
    (module) => ({ default: module.AiAssistantPage }),
  ),
);
const LazyFormsProposalCard = lazy(() =>
  import("@/features/business-forms/components/assistant/FormsProposalCard").then(
    (module) => ({ default: module.FormsProposalCard }),
  ),
);
function FormsProposalCard(props: AssistantProposalCardProps) {
  return (
    <Suspense fallback={<Spinner />}>
      <LazyFormsProposalCard {...props} />
    </Suspense>
  );
}
// Home shows the cards and suggestions of the installed modules; without forms, a proposal answer reads alone. The module's
// texts load with its namespace, here, so its suggestions read in the menu language.
function FormsProposals({ children }: { children: ReactNode }) {
  const { t } = useTranslation("forms");
  const value = useMemo<AssistantProposalExtension>(
    () => ({
      accepts: acceptsProposal,
      Card: FormsProposalCard,
      suggestions: (permissions) => formsAssistantSuggestions(permissions, t),
      placeholder: (permissions) => formsAssistantPlaceholder(permissions, t),
    }),
    [t],
  );
  return <AssistantProposalContext value={value}>{children}</AssistantProposalContext>;
}
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
      {presentation.data?.installedFeatures?.includes("forms") ? (
        <FormsProposals>
          <AiAssistantPage key={user.data?.id} />
        </FormsProposals>
      ) : (
        <AiAssistantPage key={user.data?.id} />
      )}
    </Suspense>
  ) : (
    <DashboardPage />
  );
}
