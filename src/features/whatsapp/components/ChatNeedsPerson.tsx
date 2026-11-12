import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { InfoTip } from "@/shared/ui/InfoTip";
import { UserIcon } from "@/shared/ui/icons";
import type { NeedsPerson } from "../api/chat";
import { handoffReasonText } from "../lib/assistantAgentDraft";

/** «Necesita una persona» (AS4): the same mark in the row of the inbox, in the header of the conversation and in a handoff's why. */
export function NeedsPersonBadge() {
  const { t } = useTranslation("whatsapp");
  return <Badge variant="warning"><UserIcon className="size-3" />{t("needsPerson.label")}</Badge>;
}

/**
 * The strip under the header says why the conversation needs a person: the mark of the header already says that it does (EP1-A),
 * so the strip does not repeat it to the eye, only to a screen reader. How it goes away is in its (i). It leaves on its own when
 * the server stops sending it, that is, when a person answers.
 */
export function NeedsPersonBanner({ needsPerson }: { needsPerson: NeedsPerson }) {
  const { t } = useTranslation("whatsapp");
  const { t: agent } = useTranslation("whatsappAssistant");
  return <Banner tone="warning">
    <span className="sr-only">{t("needsPerson.label")}: </span>{handoffReasonText(agent, needsPerson.reasonCode, needsPerson.reason)}
    <span className="-my-1 ml-1 inline-flex align-middle"><InfoTip text={t("needsPerson.help")} label={t("common:actions.moreInfo", { label: t("needsPerson.label") })} /></span>
  </Banner>;
}
