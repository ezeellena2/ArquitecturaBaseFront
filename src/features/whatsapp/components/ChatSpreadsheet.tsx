import { useTranslation } from "react-i18next";
import { FileIcon } from "@/shared/ui/icons";
import { MessageCard } from "@/shared/ui/MessageCard";

/// A spreadsheet received by WhatsApp (stage 2 of the assistant authoring): its name with the file icon and, below, its caption.
/// Once its content expired, the name and the caption are gone and it says so.
export function ChatSpreadsheet({ name, caption }: { name: string | null; caption: string | null }) {
  const { t } = useTranslation("whatsapp");
  return (
    <section className="min-w-0 space-y-2" aria-label={t("kind.Spreadsheet")}>
      <MessageCard icon={<FileIcon className="size-4" />} title={name ?? t("spreadsheet.label")}
        description={name === null ? t("spreadsheet.gone") : t("spreadsheet.label")} />
      {caption ? <p className="whitespace-pre-wrap break-words text-sm">{caption}</p> : null}
    </section>
  );
}
