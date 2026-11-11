import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { confirmResponseIssue, reviewResponseAction, type ResponseWorkflow } from "../api/workflow";
import { responseWorkflowKey } from "./useResponseWorkflow";

export type IssuanceOperation = "issue" | "retry" | "skip" | "proceed" | "stop";

/**
 * The decisions of the zone «Comprobante»: «Emitir» and «No emitir» of «¿La emito?» (EM2-A, only whoever loaded it) and the
 * review of an issuance (NC1-A, only who may decide: `canReview`). The server answers with the flow, which replaces the read
 * one; a 409 (someone decided first) or a lost answer reads the flow again before another decision, without sending blind.
 * One decision at a time, with its own notice; leaving the response drops a late answer.
 */
export function useResponseIssuance({ owner, formId, recordId, number, onRead }: {
  owner: string; formId: string; recordId: string; number: string; onRead: () => void;
}) {
  const { t } = useTranslation("forms");
  const client = useQueryClient();
  const scope = owner + ":" + formId + ":" + recordId;
  const live = useRef(scope);
  const controller = useRef<AbortController | null>(null);
  const [working, setWorking] = useState<{ scope: string; kind: IssuanceOperation } | null>(null);
  useLayoutEffect(() => { live.current = scope; }, [scope]);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, [scope]);
  const notice = "responses:issuance:" + owner + ":" + recordId;
  const run = async (kind: IssuanceOperation, request: (signal: AbortSignal) => Promise<ResponseWorkflow>): Promise<boolean> => {
    if (controller.current) return false;
    const current = new AbortController();
    controller.current = current;
    setWorking({ scope, kind });
    try {
      const result = await request(current.signal);
      if (live.current !== scope || current.signal.aborted) return false;
      client.setQueryData(responseWorkflowKey(owner, formId, recordId), result);
      notify({ id: notice, kind: kind === "issue" || kind === "retry" || kind === "proceed" ? "info" : "success", message: t("issuance.done." + kind, { number }) });
      onRead();
      return true;
    } catch (error) {
      if (live.current !== scope || current.signal.aborted || errorFeedback(error).kind === "cancelled") return false;
      if (errorFeedback(error).kind !== "session") notify({ id: notice, kind: "error", message: t("issuance.failed", { number }), description: operationalErrorMessage(error, t) });
      if (error instanceof ApiError && error.status === 409 || errorFeedback(error, { writing: true }).kind === "uncertain") onRead();
      return false;
    } finally {
      if (controller.current === current) controller.current = null;
      if (live.current === scope) setWorking(null);
    }
  };
  return {
    working: working?.scope === scope ? working.kind : null,
    confirm: (runId: string, issue: boolean) => run(issue ? "issue" : "skip", signal => confirmResponseIssue(recordId, runId, issue, signal)),
    // «Volver a probar» (decision 4): the summary failed; the issuer is asked again and the zone says it is being issued.
    retry: (runId: string) => run("retry", signal => confirmResponseIssue(recordId, runId, true, signal, true)),
    review: (runId: string, expectedRevision: number, proceed: boolean) =>
      run(proceed ? "proceed" : "stop", signal => reviewResponseAction(recordId, runId, { expectedRevision, wasSent: proceed }, signal)),
  };
}
