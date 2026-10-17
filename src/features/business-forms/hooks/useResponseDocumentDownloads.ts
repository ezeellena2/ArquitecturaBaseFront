import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchResponseDocument } from "../api/pdf";
import type { ResponseWorkflow } from "../api/workflow";
type IssuedDocument = ResponseWorkflow["documents"][number];
export function useResponseDocumentDownloads(owner: string, recordId: string, onForbidden: () => void, disabled = false) {
  const { t } = useTranslation("forms");
  const operationId = "forms:document:" + owner + ":" + recordId + ":download";
  const current = useRef(operationId);
  const request = useRef<AbortController | null>(null);
  const [operation, setOperation] = useState<{ owner: string; busy: boolean } | null>(null);
  const [waitOwner, setWaitOwner] = useState<string | null>(null);
  const cooldown = useCountdown(0);
  useLayoutEffect(() => { current.current = operationId; }, [operationId]);
  useEffect(() => () => { request.current?.abort(); request.current = null; dismissNotification(operationId); }, [operationId]);
  const busy = operation?.owner === operationId && operation.busy;
  const waiting = waitOwner === operationId && cooldown.isRunning;
  const download = async (document: IssuedDocument) => {
    if (disabled || busy || waiting || request.current) return;
    const controller = new AbortController(); request.current = controller;
    setOperation({ owner: operationId, busy: true }); dismissNotification(operationId);
    try {
      const file = await fetchResponseDocument(recordId, document.id, true, controller.signal);
      if (current.current === operationId && !controller.signal.aborted) savePrivateBlob(file.blob, file.fileName ?? document.name);
    } catch (failure) {
      if (current.current !== operationId || controller.signal.aborted || errorFeedback(failure).kind === "cancelled") return;
      if (failure instanceof ApiError && failure.status === 403) { onForbidden(); return; }
      if (errorFeedback(failure).kind !== "session") notify({ id: operationId, kind: "error", message: readErrorMessage(failure, t) });
      if (failure instanceof ApiError && failure.status === 429) { setWaitOwner(operationId); cooldown.restart(failure.retryAfterSeconds ?? 60); }
    } finally {
      if (request.current === controller) request.current = null;
      if (current.current === operationId) setOperation({ owner: operationId, busy: false });
    }
  };
  return { download, disabled: disabled || busy || waiting, seconds: waiting ? cooldown.seconds : 0 };
}
export type ResponseDocumentDownloadsState = ReturnType<typeof useResponseDocumentDownloads>;
