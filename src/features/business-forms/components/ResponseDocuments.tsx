import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { ChevronDownIcon } from "@/shared/ui/icons";
import { Badge } from "@/shared/ui/badge";
import { Surface } from "@/shared/ui/Surface";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { fetchResponseDocument } from "../api/pdf";
import type { ResponseWorkflow } from "../api/workflow";
import type { ResponseDocumentDownloadsState } from "../hooks/useResponseDocumentDownloads";
import { FormPdfPreview } from "./FormPdfPreview";
type IssuedDocument = ResponseWorkflow["documents"][number];
interface DocumentProps { owner: string; recordId: string; documents: readonly IssuedDocument[]; downloads: ResponseDocumentDownloadsState; onForbidden: () => void; timeZoneId?: string }
export function ResponseDocuments({ owner, recordId, documents, downloads, onForbidden, timeZoneId }: DocumentProps) {
  const { t } = useTranslation("forms");
  if (!documents.length) return null;
  return <Surface title={t("pdf.documents")} padded><div className="space-y-4">{documents.map(document => <DocumentCard key={document.id} owner={owner} recordId={recordId} document={document} downloads={downloads} onForbidden={onForbidden} timeZoneId={timeZoneId}/>)}</div>{downloads.seconds ? <p role="status">{t("wait", { count: downloads.seconds })}</p> : null}</Surface>;
}
export function ResponseDocumentDownloads({ documents, downloads }: Pick<DocumentProps, "documents" | "downloads">) {
  const { t } = useTranslation("forms");
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">{t("pdf.download")}<ChevronDownIcon className="size-3"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{documents.map(document => <DropdownMenuItem key={document.id} disabled={downloads.disabled} onSelect={() => { void downloads.download(document); }}>{document.name}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
function DocumentCard({ owner, recordId, document, downloads, onForbidden, timeZoneId }: Omit<DocumentProps, "documents"> & { document: IssuedDocument }) {
  const { t, i18n } = useTranslation("forms");
  const [view, setView] = useState(false);
  const operationId = "forms:document:" + owner + ":" + recordId + ":" + document.id;
  const load = useCallback((signal: AbortSignal) => fetchResponseDocument(recordId, document.id, false, signal), [recordId, document.id]);
  return <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="break-words font-medium">{document.name}</p><p className="text-xs text-[var(--color-content-muted)]">{formatDateTimeInZone(document.createdAtUtc, i18n.language, timeZoneId)}</p></div><Badge variant="outline">{t("cultures." + document.culture)}</Badge><Button variant="outline" disabled={downloads.disabled} onClick={() => setView(true)}>{t("pdf.view")}</Button><Button variant="outline" disabled={downloads.disabled} onClick={() => void downloads.download(document)}>{t("pdf.download")}</Button></div><p className="text-xs text-[var(--color-content-muted)]">{t("pdf.fixedHint")}</p>{view ? <FixedPdfDialog operationId={operationId + ":preview"} name={document.name} culture={document.culture} load={load} onForbidden={onForbidden} onClose={() => setView(false)}/> : null}</div>;
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
