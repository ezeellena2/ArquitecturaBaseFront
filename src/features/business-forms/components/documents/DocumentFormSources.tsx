import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { DocumentViewer } from "@/shared/ui/DocumentViewer";
import { DocumentIcon, FileIcon, ImageIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import type { ReceivedDocument } from "../../api/receivedDocuments";
import { receivedDocumentForbidden, useReceivedDocumentFile, useReceivedDocumentReadWait } from "../../hooks/useReceivedDocuments";
import { receivedDocumentKind } from "../../receivedDocuments";

/**
 * «Documentos (N)» of «Armar formulario con la IA» (DOC6): the documents the proposal came from, in the order they were attached (the
 * first is the one whose data the questions show), to compare while it is reviewed. The chosen one is seen on top with the inbox's viewer
 * (a photo is brought closer and turned, a PDF uses the browser's viewer) and its row carries the bar; choosing another shows it. A file the
 * inbox kept no copy of has nothing to see.
 */
export function DocumentFormSources({ documents, zone, onDenied }: { documents: readonly ReceivedDocument[]; zone: string | undefined; onDenied: () => void }) {
  const { t, i18n } = useTranslation("formDocuments");
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const shown = documents.find(document => document.id === chosen) ?? documents[0];
  const file = useReceivedDocumentFile(shown?.file.stored ? shown.id : undefined);
  const fileWait = useReceivedDocumentReadWait(file.error);
  const denied = receivedDocumentForbidden(file.error);
  useEffect(() => { if (denied) onDenied(); }, [denied, onDenied]);
  const columns: Column<ReceivedDocument>[] = [
    { sortable: false, id: "document", header: t("columns.document"), cell: document => {
      const kind = receivedDocumentKind(document.file.mediaType);
      const Icon = kind === "photo" ? ImageIcon : kind === "file" ? FileIcon : DocumentIcon;
      return <div className="flex min-w-28 max-w-56 items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-[var(--color-content-muted)]" />
        <Button type="button" variant="link" size="inline" aria-pressed={document.id === shown?.id} className="min-w-0 whitespace-normal break-words text-left"
          onClick={() => setChosen(document.id)}>{document.file.name}</Button>
      </div>;
    } },
    { sortable: false, id: "sender", header: t("columns.sender"), cell: document => document.sender.displayName ?? t("unknownPerson") },
    { sortable: false, id: "receivedAtUtc", header: t("columns.received"), cell: document => <time dateTime={document.receivedAtUtc}>{formatDateTimeInZone(document.receivedAtUtc, i18n.language, zone)}</time> },
  ];
  return <Surface title={t("formProposal.documents", { count: documents.length })} help={t("formProposal.documentsHelp")}>
    {shown?.file.stored ? <div className="border-b border-[var(--color-border)] p-4">
      <DocumentViewer key={shown.id} name={shown.file.name} mediaType={shown.file.mediaType} blob={file.data} loading={file.isPending} failed={file.isError}
        onRetry={() => void file.refetch()} retryReason={fileWait} />
    </div> : null}
    <DataTable columns={columns} rows={documents} rowKey={document => document.id} selectedRowKey={shown?.id} onRowClick={document => setChosen(document.id)}
      emptyTitle={t("formProposal.noDocuments")} />
  </Surface>;
}
