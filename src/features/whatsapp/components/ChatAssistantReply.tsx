import { useTranslation } from "react-i18next";
import { DataList, type DataListItem } from "@/shared/ui/DataList";
import type { AssistantReply } from "../api/chat";
import { handoffReasonText } from "../lib/assistantAgentDraft";
import { AssistantActionTag } from "./AssistantActionTag";
import { NeedsPersonBadge } from "./ChatNeedsPerson";

/**
 * What the assistant did and why, as the server kept it (AS4): the action with the tag of «Asistente», then in two columns its
 * place in a reply of several actions, the case («Cualquier otra cosa» for the last one), the button the person tapped, why and
 * what it used; a handoff ends with the mark and its reason, as in Probar. Empty data do not show.
 */
function ReplyDetails({ reply, withAction }: { reply: AssistantReply; withAction: boolean }) {
  const { t } = useTranslation("whatsapp");
  const { t: agent } = useTranslation("whatsappAssistant");
  // A handoff because of a button already says what was tapped in its reason: it is not said twice.
  const tappedInReason = reply.kind === "Handoff" && reply.handoffReasonCode === "button";
  const button = reply.button?.trim();
  const rows: DataListItem[] = [
    ...(reply.count > 1 ? [{ key: "place", label: t("assistantReply.place"), value: t("assistantReply.placeValue", { ordinal: reply.ordinal, count: reply.count }) }] : []),
    { key: "case", label: t("assistantReply.case"), value: reply.caseSource === "Fallback" ? agent("cases.fallback") : reply.caseTitle?.trim() || "—" },
    ...(button && !tappedInReason ? [{ key: "tapped", label: t("assistantReply.tapped"), value: t("assistantReply.tappedValue", { title: button }) }] : []),
    ...(reply.reason.trim() ? [{ key: "why", label: t("assistantReply.why"), value: reply.reason }] : []),
    ...(reply.used.length ? [{ key: "used", label: t("assistantReply.used"), value: <ul className="flex flex-col gap-1">{reply.used.map((item, index) => <li key={index}>{item}</li>)}</ul> }] : []),
  ];
  return <div className="flex min-w-0 flex-col gap-2 text-left">
    {withAction ? <div><AssistantActionTag kind={reply.kind} label={agent("actions." + reply.kind)} /></div> : null}
    <DataList items={rows} />
    {reply.kind === "Handoff" ? <p className="flex flex-wrap items-center gap-2"><NeedsPersonBadge /><span className="min-w-0 break-words">{handoffReasonText(agent, reply.handoffReasonCode, reply.handoffReason)}</span></p> : null}
  </div>;
}

/** «Por qué respondió esto» under a message or an outgoing of the agent, like «Por qué lo mandó» under a form. */
export function AssistantReplyWhy({ reply }: { reply: AssistantReply }) {
  const { t } = useTranslation("whatsapp");
  return <section className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3 text-sm">
    <p className="font-medium">{t("assistantReply.title")}</p>
    <div className="mt-2"><ReplyDetails reply={reply} withAction /></div>
  </section>;
}

/**
 * A line of the history for what the assistant decided without a message: «Sin respuesta del asistente», or a handoff whose
 * message could not go out. The line says what happened and, under it, the same data as a why.
 */
export function AssistantEventLine({ reply }: { reply: AssistantReply }) {
  const { t } = useTranslation("whatsapp");
  return <div className="mx-auto mb-3 flex w-fit max-w-[min(88%,36.25rem)] flex-col items-center gap-1.5">
    <p className="text-center text-xs text-[var(--color-content-muted)]">{t(reply.kind === "Handoff" ? "assistantReply.handoff" : "assistantReply.noReply")}</p>
    <div className="w-full rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3 text-sm"><ReplyDetails reply={reply} withAction={false} /></div>
  </div>;
}
