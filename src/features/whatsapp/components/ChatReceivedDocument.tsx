import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { DocumentIcon, ImageIcon } from "@/shared/ui/icons";
import { MessageCard } from "@/shared/ui/MessageCard";
import type { ReceivedDocument } from "../api/chat";

const isPhoto = (document: ReceivedDocument | null) => document?.kind === "jpeg" || document?.kind === "png";

// What a received document is, under its name: a PDF with its pages once counted, a photo (one page, not counted) or a Word. A photo
// WhatsApp sent without a file name is only «Foto», its title, without a second line.
function documentDescription(t: TFunction<"whatsapp">, document: ReceivedDocument | null): string | undefined {
  if (document === null) return t("receivedDocument.gone");
  if (document.name === undefined) return undefined;
  if (document.kind === "pdf") return document.pages === undefined ? t("receivedDocument.pdf") : t("receivedDocument.pdfPages", { count: document.pages });
  if (isPhoto(document)) return t("receivedDocument.photo");
  return t(document.kind === "docx" ? "receivedDocument.word" : "receivedDocument.label");
}

/// Task 8 of the documents (DOC2): a photo, a PDF or a Word the person sent, as a spreadsheet: its name with its type and its pages
/// and, below, its caption. Once its content expired, the name and the caption are gone and it says so. The chat does not open it.
export function ChatReceivedDocument({ document, caption }: { document: ReceivedDocument | null; caption: string | null }) {
  const { t } = useTranslation("whatsapp");
  const photo = isPhoto(document);
  return (
    <section className="min-w-0 space-y-2" aria-label={t("kind.ReceivedDocument")}>
      <MessageCard icon={photo ? <ImageIcon className="size-4" /> : <DocumentIcon className="size-4" />}
        title={document?.name ?? t(photo ? "receivedDocument.photo" : "receivedDocument.label")} description={documentDescription(t, document)} />
      {caption ? <p className="whitespace-pre-wrap break-words text-sm">{caption}</p> : null}
    </section>
  );
}

/// DOC4: under the last document a number without a linked account sent in a row, a line of the history says they were not read and
/// that an operator handles it; the message points at it with `aria-describedby`.
export function ChatReceivedDocumentNotRead({ id }: { id: string }) {
  const { t } = useTranslation("whatsapp");
  return <p id={id} className="mx-auto mb-3 w-fit max-w-[min(88%,36.25rem)] text-center text-xs text-[var(--color-content-muted)]">{t("receivedDocument.notLinked")}</p>;
}
