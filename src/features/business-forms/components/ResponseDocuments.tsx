import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronDownIcon, DownloadIcon, EyeIcon } from "@/shared/ui/icons";
import { Badge } from "@/shared/ui/badge";
import { Surface } from "@/shared/ui/Surface";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { fetchResponseDocument } from "../api/pdf";
import type { ResponseWorkflow } from "../api/workflow";
import type { ResponseDocumentDownloadsState } from "../hooks/useResponseDocumentDownloads";
import { FormPdfPreview } from "./FormPdfPreview";
import type { PrivateFormFile } from "@/shared/api/formFiles";
type IssuedDocument = ResponseWorkflow["documents"][number];
interface DocumentProps { owner: string; recordId: string; documents: readonly IssuedDocument[]; downloads: ResponseDocumentDownloadsState; onForbidden: () => void; timeZoneId?: string }
export function ResponseDocuments({ owner, recordId, documents, downloads, onForbidden, timeZoneId }: DocumentProps) {
  const { t } = useTranslation("forms");
  if (!documents.length) return null;
  // That an issued PDF does not change is said once, in the (i) next to the title, not under each copy.
  return <Surface title={t("pdf.documents")} help={t("pdf.fixedHint")} padded><div className="space-y-4">{documents.map(document => <DocumentCard key={document.id} owner={owner} recordId={recordId} document={document} downloads={downloads} onForbidden={onForbidden} timeZoneId={timeZoneId}/>)}</div></Surface>;
}
// Compact, in the quick view's header, it is an icon next to the navigation (board TL3-A).
export function ResponseDocumentDownloads({ documents, downloads, files = [], compact = false }: Pick<DocumentProps, "documents" | "downloads"> & { files?: readonly PrivateFormFile[]; compact?: boolean }) {
  const { t } = useTranslation("forms");
  // A menu item keeps its reason inside: the wait of a 429 goes under its name.
  const wait = downloads.seconds ? <span className="block text-xs">{t("wait", { count: downloads.seconds })}</span> : null;
  // The menu closes on choosing: its trigger says «Descargando…» until the file arrives.
  const working = downloads.working === "menu";
  return <DropdownMenu><DropdownMenuTrigger asChild>{compact ? <IconButton size="sm" label={t(working ? "pdf.downloading" : "pdf.download")} pending={working}><DownloadIcon className="size-4"/><ChevronDownIcon className="size-3"/></IconButton> : <Button variant="outline" size="sm" pending={working}>{working ? t("pdf.downloading") : <>{t("pdf.download")}<ChevronDownIcon className="size-3"/></>}</Button>}</DropdownMenuTrigger><DropdownMenuContent align="end">{documents.map(document => <DropdownMenuItem key={document.id} disabled={downloads.disabled} onSelect={() => { void downloads.download(document, "menu"); }}><span>{document.name}{wait}</span></DropdownMenuItem>)}{files.map(file => <DropdownMenuItem key={file.fileId} disabled={downloads.disabled} onSelect={() => { void downloads.downloadFile(file); }}><span>{file.name}{wait}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}
function DocumentCard({ owner, recordId, document, downloads, onForbidden, timeZoneId }: Omit<DocumentProps, "documents"> & { document: IssuedDocument }) {
  const { t, i18n } = useTranslation("forms");
  return <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="break-words font-medium">{document.name}</p><p className="text-xs text-[var(--color-content-muted)]">{formatDateTimeInZone(document.createdAtUtc, i18n.language, timeZoneId)}</p></div><Badge variant="outline">{t("cultures." + document.culture)}</Badge><ResponseDocumentActions owner={owner} recordId={recordId} document={document} downloads={downloads} onForbidden={onForbidden} size="default"/></div>;
}
/// «Ver PDF» and «Descargar» of an issued copy: in its card, in its row of the activity and, compact, as icons in the quick
/// view (board TL3-A). The wait of a 429 is their reason, never a text at the foot.
export function ResponseDocumentActions({ owner, recordId, document, downloads, onForbidden, compact = false, size = "sm" }: Omit<DocumentProps, "documents" | "timeZoneId"> & { document: IssuedDocument; compact?: boolean; size?: "sm" | "default" }) {
  const { t } = useTranslation("forms");
  const [view, setView] = useState(false);
  const load = useCallback((signal: AbortSignal) => fetchResponseDocument(recordId, document.id, false, signal), [recordId, document.id]);
  const wait = downloads.seconds ? t("wait", { count: downloads.seconds }) : null;
  const working = downloads.working === document.id;
  return <>
    {compact ? <IconButton label={t("pdf.view")} disabledLabel={wait ?? undefined} disabled={downloads.disabled} onClick={() => setView(true)}><EyeIcon className="size-4"/></IconButton>
      : <DisabledReason reason={wait}><Button variant="outline" size={size} disabled={downloads.disabled} onClick={() => setView(true)}>{t("pdf.view")}</Button></DisabledReason>}
    {compact ? <IconButton label={t(working ? "pdf.downloading" : "pdf.download")} disabledLabel={wait ?? undefined} pending={working} disabled={downloads.disabled} onClick={() => void downloads.download(document)}><DownloadIcon className="size-4"/></IconButton>
      : <DisabledReason reason={wait}><Button variant="outline" size={size} pending={working} disabled={downloads.disabled} onClick={() => void downloads.download(document)}>{t(working ? "pdf.downloading" : "pdf.download")}</Button></DisabledReason>}
    {view ? <FixedPdfDialog operationId={"forms:document:" + owner + ":" + recordId + ":" + document.id + ":preview"} name={document.name} culture={document.culture} load={load} onForbidden={onForbidden} onClose={() => setView(false)}/> : null}
  </>;
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
