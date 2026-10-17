import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Surface } from "@/shared/ui/Surface";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { fetchResponseDocument } from "../api/pdf";
import type { ResponseWorkflow } from "../api/workflow";
import { FormPdfPreview } from "./FormPdfPreview";
type IssuedDocument = ResponseWorkflow["documents"][number];
export function ResponseDocuments({ owner, recordId, documents, onForbidden, timeZoneId }: {
    owner: string;
    recordId: string;
    documents: readonly IssuedDocument[];
    onForbidden: () => void;
    timeZoneId?: string;
}) {
    const { t } = useTranslation("forms");
    if (!documents.length)
        return null;
    return <Surface title={t("pdf.documents")} padded><div className="space-y-4">{documents.map(document => <DocumentCard key={document.id} owner={owner} recordId={recordId} document={document} onForbidden={onForbidden} timeZoneId={timeZoneId}/>)}</div></Surface>;
}
function DocumentCard({ owner, recordId, document, onForbidden, timeZoneId }: {
    owner: string;
    recordId: string;
    document: IssuedDocument;
    onForbidden: () => void;
    timeZoneId?: string;
}) {
    const { t, i18n } = useTranslation("forms");
    const [view, setView] = useState(false);
    const [busy, setBusy] = useState(false);
    const operationId = "forms:document:" + owner + ":" + recordId + ":" + document.id;
    const live = useRef(true);
    const request = useRef<AbortController | null>(null);
    const cooldown = useCountdown(0);
    useEffect(() => { live.current = true; return () => { live.current = false; request.current?.abort(); dismissNotification(operationId + ":download"); }; }, [operationId]);
    const load = useCallback((signal: AbortSignal) => fetchResponseDocument(recordId, document.id, false, signal), [recordId, document.id]);
    const download = async () => { if (busy || cooldown.isRunning)
        return; const controller = new AbortController(); request.current = controller; setBusy(true); dismissNotification(operationId + ":download"); try {
        const file = await fetchResponseDocument(recordId, document.id, true, controller.signal);
        if (live.current && !controller.signal.aborted)
            savePrivateBlob(file.blob, file.fileName ?? document.name);
    }
    catch (failure) {
        if (!live.current || controller.signal.aborted || errorFeedback(failure).kind === "cancelled")
            return;
        if (failure instanceof ApiError && failure.status === 403) {
            onForbidden();
            return;
        }
        if (errorFeedback(failure).kind !== "session") notify({ id: operationId + ":download", kind: "error", message: readErrorMessage(failure, t) });
        if (failure instanceof ApiError && failure.status === 429)
            cooldown.restart(failure.retryAfterSeconds ?? 60);
    }
    finally {
        if (live.current)
            setBusy(false);
    } };
    return <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="break-words font-medium">{document.name}</p><p className="text-xs text-[var(--color-content-muted)]">{formatDateTimeInZone(document.createdAtUtc, i18n.language, timeZoneId)}</p></div><Badge variant="outline">{t("cultures." + document.culture)}</Badge><Button variant="outline" onClick={() => setView(true)}>{t("pdf.view")}</Button><Button variant="outline" disabled={busy || cooldown.isRunning} onClick={() => void download()}>{t("pdf.download")}</Button></div><p className="text-xs text-[var(--color-content-muted)]">{t("pdf.fixedHint")}</p>{cooldown.isRunning ? <p role="status">{t("wait", { count: cooldown.seconds })}</p> : null}{view ? <FixedPdfDialog operationId={operationId + ":preview"} name={document.name} culture={document.culture} load={load} onForbidden={onForbidden} onClose={() => setView(false)}/> : null}</div>;
}
function FixedPdfDialog({ operationId, name, culture, load, onForbidden, onClose }: {
    operationId: string;
    name: string;
    culture: IssuedDocument["culture"];
    load: Parameters<typeof FormPdfPreview>[0]["load"];
    onForbidden: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation("forms");
    const restore = useRestoreFocusOnClose();
    return <Dialog open onOpenChange={open => { if (!open)
        onClose(); }}><DialogContent onCloseAutoFocus={restore}><DialogTitle>{t("pdf.copy")}</DialogTitle><DialogDescription>{name}</DialogDescription><FormPdfPreview operationId={operationId} load={load} onForbidden={onForbidden} requestedCulture={culture}/><Button variant="outline" onClick={onClose}>{t("common:actions.close")}</Button></DialogContent></Dialog>;
}
