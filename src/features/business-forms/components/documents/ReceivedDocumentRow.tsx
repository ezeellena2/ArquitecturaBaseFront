import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { DownloadIcon } from "@/shared/ui/icons";
import type { ReceivedDocumentDetail } from "../../api/receivedDocuments";
import { useReceivedDocumentDownload } from "../../hooks/useReceivedDocuments";

/**
 * «La fila» of a row of a spreadsheet (VC1-A), in the place of a document's viewer: its cells with content as they came, each under the
 * header of its column (`DataList`), and «Descargar la planilla», which asks for the spreadsheet only then, never to show the row. Its
 * box keeps the viewer's frame, so the panel reads the same with a document or a row.
 */
export function ReceivedDocumentRow({ documentId, name, cells, loading = false, onDenied }: {
  documentId: string; name: string; cells: NonNullable<ReceivedDocumentDetail["rowCells"]>;
  /** While the panel brings another row, this one is still in sight and is not downloaded. */
  loading?: boolean; onDenied: () => void;
}) {
  const { t } = useTranslation("formDocuments");
  const title = useId();
  const download = useReceivedDocumentDownload(documentId, name, onDenied);
  return <section aria-labelledby={title} className="flex flex-col overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-1.5">
      <h3 id={title} className="text-sm font-semibold">{t("row.title")}</h3>
      <DisabledReason reason={loading || download.pending ? null : download.wait}>
        <Button type="button" variant="outline" size="sm" disabled={loading || download.pending || !!download.wait} pending={download.pending} onClick={() => void download.start()}>
          {download.pending ? null : <DownloadIcon className="size-4" />}{t(download.pending ? "row.downloading" : "row.download")}
        </Button>
      </DisabledReason>
    </div>
    <div className="px-3 py-1"><DataList items={cells.map((cell, index) => ({ key: String(index), label: cell.header, value: cell.value }))} /></div>
  </section>;
}
