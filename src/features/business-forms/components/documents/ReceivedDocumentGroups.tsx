import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import type { ReceivedDocumentGroup } from "../../api/receivedDocuments";
import { documentFormProposalPath } from "../../documentFormProposal";

/**
 * The notice of similar documents (DOC6), above the inbox's sheet: each topic of «Formularios que faltan» that at least «Sugerir armar un
 * formulario desde» unclassified documents share (Configuración › Formularios), under the page's other filters, the largest first, with
 * how many they are and «Armar formulario con la IA», which opens its page under a new request. Its owner shows it only to whoever
 * reviews documents and designs forms.
 */
export function ReceivedDocumentGroups({ groups }: { groups: readonly ReceivedDocumentGroup[] }) {
  const { t } = useTranslation("formDocuments");
  const navigate = useNavigate();
  if (!groups.length) return null;
  // Apart from the sheet as the bar above it is.
  return <div className="mb-4 flex flex-col gap-2">
    {groups.map(group => <Banner key={group.topic.id} action={
      <Button type="button" size="sm" aria-label={t("groups.buildFor", { topic: group.topic.name })}
        onClick={() => void navigate(documentFormProposalPath(crypto.randomUUID(), { topicId: group.topic.id }))}>{t("formProposal.build")}</Button>
    }>{t("groups.notice", { count: group.count, topic: group.topic.name })}</Banner>)}
  </div>;
}
