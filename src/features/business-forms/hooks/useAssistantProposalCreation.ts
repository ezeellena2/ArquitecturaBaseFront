import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { createProposalCatalog, createProposalDraft, fetchProposalCatalog, fetchProposalDraft } from "../api/assistantProposals";

// A name or a prefix in use, or a catalog that is gone, is said by the card (IA2); anything else, by the common notice.
const cardProblems = new Set(["Forms.Definition.NameTaken", "Forms.Definition.PrefixTaken", "Forms.Definition.CatalogUnavailable", "Forms.Catalog.NameTaken"]);

/** Whether this person's proposal already created its draft or catalog, and creating it once, then opening it. */
export function useAssistantProposalCreation(target: "draft" | "catalog", requestId: string, proposalId: string) {
  const { t } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const client = useQueryClient();
  const key = ["form-assistant-proposals", user?.id ?? null, target, proposalId] as const;
  const status = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => target === "draft"
      ? (await fetchProposalDraft(proposalId, signal)).definitionId
      : (await fetchProposalCatalog(proposalId, signal)).catalogId,
    enabled: !!user,
  });
  const [creating, setCreating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const path = (id: string) => (target === "draft" ? "/formularios/" : "/catalogos/") + id;
  async function create() {
    setCreating(true);
    setProblem(null);
    try {
      const body = { requestId, proposalId };
      const id = target === "draft" ? (await createProposalDraft(body)).definitionId : (await createProposalCatalog(body)).catalogId;
      client.setQueryData(key, id);
      if (id) void navigate(path(id));
    } catch (error) {
      if (error instanceof ApiError && error.code && cardProblems.has(error.code)) setProblem(readErrorMessage(error, t));
      else notify({ id: "forms:assistant-proposal:" + proposalId, kind: "error", message: readErrorMessage(error, t) });
    } finally {
      setCreating(false);
    }
  }
  const created = status.data ?? null;
  return { created: created ? path(created) : null, creating, problem, create };
}
