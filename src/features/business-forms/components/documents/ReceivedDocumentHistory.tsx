import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import type { ReceivedDocumentDetail } from "../../api/receivedDocuments";
import { receivedDocumentEventKey } from "../../receivedDocuments";

/**
 * «Historial» of a document (DOC5-A): what happened, oldest first, a step per row with what happened, who did it below in grey and its
 * date and time on the right, like the moments of a response (TL1-A). What its person did in the channel (it arrived, they chose a
 * form or «Otro», they confirmed it) names them and the channel; a step of someone of the team names them.
 */
export function ReceivedDocumentHistory({ detail, zone }: { detail: ReceivedDocumentDetail; zone: string | undefined }) {
  const { t, i18n } = useTranslation("formDocuments");
  const sender = detail.document.sender.displayName ?? t("unknownPerson");
  if (detail.history.length === 0) return <p className="text-sm text-[var(--color-content-muted)]">{t("history.empty")}</p>;
  return <ol className="divide-y divide-[var(--color-border)] text-sm">
    {detail.history.map((event, index) => {
      const text = receivedDocumentEventKey(event, detail.history.slice(0, index), sender);
      const who = event.actor ? event.actor.displayName ?? t("unknownPerson")
        : event.kind === "received" ? t("history.fromSender", { person: sender })
        : event.kind === "confirmed" || event.kind === "choseOther" || event.kind === "formChosen" ? t("history.bySender", { person: sender }) : null;
      return <li key={index} className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="break-words">{t(text.key, text.values)}</p>
          {who ? <p className="break-words text-[var(--color-content-muted)]">{who}</p> : null}
        </div>
        <time dateTime={event.atUtc} className="shrink-0 text-right text-[var(--color-content-muted)] tabular-nums">{formatDateTimeInZone(event.atUtc, i18n.language, zone)}</time>
      </li>;
    })}
  </ol>;
}
