import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronDownIcon, DownloadIcon } from "@/shared/ui/icons";
import type { ResponseWorkflow } from "../api/workflow";
import type { ResponseDocumentDownloadsState } from "../hooks/useResponseDocumentDownloads";

type IssuedDocument = ResponseWorkflow["documents"][number];

/**
 * «PDF fiscal» (EM1-A), with the download icon, among the icons that go elsewhere (TL3-A): an icon in the quick view, before
 * ⋮, and a button next to «Descargar ▾» on the full page. It downloads the document of the issuance; once a credit note voids
 * it (NC1-A) it offers both. It says «Descargando…» with its spinner, and the wait of a 429 is its reason.
 */
export function ResponseFiscalPdf({ documents, downloads, compact = false }: { documents: readonly IssuedDocument[]; downloads: ResponseDocumentDownloadsState; compact?: boolean }) {
  const { t } = useTranslation("forms");
  if (!documents.length) return null;
  const working = documents.some(document => downloads.working === document.id);
  const wait = downloads.seconds ? t("wait", { count: downloads.seconds }) : null;
  const label = t(working ? "pdf.downloading" : "issuance.fiscalPdf");
  if (documents.length === 1) {
    const [document] = documents;
    return compact
      ? <IconButton label={label} disabledLabel={wait ?? undefined} pending={working} disabled={downloads.disabled} onClick={() => void downloads.download(document)}><DownloadIcon className="size-4"/></IconButton>
      : <DisabledReason reason={wait}><Button variant="outline" size="sm" pending={working} disabled={downloads.disabled} onClick={() => void downloads.download(document)}>{working ? label : <><DownloadIcon className="size-4"/>{label}</>}</Button></DisabledReason>;
  }
  // A menu item keeps its reason inside: the wait of a 429 goes under its name.
  const itemWait = wait ? <span className="block text-xs">{wait}</span> : null;
  return <DropdownMenu><DropdownMenuTrigger asChild>{compact
    ? <IconButton size="sm" label={label} pending={working}><DownloadIcon className="size-4"/><ChevronDownIcon className="size-3"/></IconButton>
    : <Button variant="outline" size="sm" pending={working}>{working ? label : <><DownloadIcon className="size-4"/>{label}<ChevronDownIcon className="size-3"/></>}</Button>}</DropdownMenuTrigger>
    <DropdownMenuContent align="end">{documents.map(document => <DropdownMenuItem key={document.id} disabled={downloads.disabled} onSelect={() => { void downloads.download(document); }}><span>{document.name}{itemWait}</span></DropdownMenuItem>)}</DropdownMenuContent>
  </DropdownMenu>;
}
