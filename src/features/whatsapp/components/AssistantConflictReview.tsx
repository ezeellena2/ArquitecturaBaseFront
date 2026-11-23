import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { ComparisonTable, type ComparisonGroup } from "@/shared/ui/ComparisonTable";
import { Surface } from "@/shared/ui/Surface";
import type { AgentCulture, AgentForm, AssistantAgent } from "../api/assistantAgent";
import { changedParts, configOf, describeAction, draftFromAgent, textIn, type AgentDraft, type DraftAction } from "../lib/assistantAgentDraft";

/**
 * A 409, as in Información del negocio: someone else saved first. «Revisar cambios» reads what is saved and compares it with what
 * was edited, only what differs (LR2-A); then what is saved is used, or what was edited is kept over it.
 */
export function AssistantConflictReview({ draft, review, forms, culture, working, onReview, onAccept }: {
  draft: AgentDraft; review: AssistantAgent | undefined; forms: readonly AgentForm[]; culture: AgentCulture; working: boolean;
  onReview: () => void; onAccept: (keep: boolean) => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const theirs = review ? draftFromAgent(configOf(review)) : null;
  const original = review?.originalCulture ?? culture;
  const value = (text: string) => text.trim() ? <span className="whitespace-pre-wrap">{text}</span> : <span className="text-[var(--color-content-muted)]">—</span>;
  const action = (item: DraftAction) => { const { label, detail } = describeAction(t, item, forms, culture, original); return [label, detail].filter(Boolean).join(" "); };
  const cases = (version: AgentDraft) => version.cases.map((item, index) => `${index + 1}. ${item.when.trim() || "—"} → ${action(item.action)}${item.isActive ? "" : " · " + t("conflict.paused")}`).join("\n");
  const lines = (version: AgentDraft): Record<string, { group: "profile" | "cases" | "limits"; label: string; text: string }> => ({
    "profile.name": { group: "profile", label: t("profile.name"), text: version.profile.name },
    "profile.introduction": { group: "profile", label: t("profile.introduction"), text: version.profile.introduction },
    "profile.tone": { group: "profile", label: t("profile.tone"), text: version.profile.tone },
    "profile.does": { group: "profile", label: t("profile.does"), text: version.profile.does },
    "profile.doesNot": { group: "profile", label: t("profile.doesNot"), text: version.profile.doesNot },
    "profile.handoffMessage": { group: "profile", label: t("profile.handoffMessage"), text: textIn(version.profile.handoffMessage, culture, original) },
    cases: { group: "cases", label: t("conflict.ownCases"), text: cases(version) },
    fallback: { group: "cases", label: t("cases.fallback"), text: action(version.fallback) },
    "limits.blockedTopics": { group: "limits", label: t("limits.topics"), text: version.limits.blockedTopics.join(", ") },
    "limits.cannotPromise": { group: "limits", label: t("limits.cannotPromise"), text: version.limits.cannotPromise },
    "limits.maxReplyLength": { group: "limits", label: t("limits.maxReplyLength"), text: version.limits.maxReplyLength },
    "limits.dailyReplyLimit": { group: "limits", label: t("limits.dailyReplyLimit"), text: version.limits.dailyReplyLimit },
    "limits.dailyOfferLimit": { group: "limits", label: t("limits.dailyOfferLimit"), text: version.limits.dailyOfferLimit },
    "limits.declinedReofferDays": { group: "limits", label: t("limits.declinedReoffer"), text: version.limits.declinedReofferDays === null ? t("limits.reofferNever")
      : t("limits.reofferAfterDays", { count: Number(version.limits.declinedReofferDays) }) },
    "limits.allowedActions": { group: "limits", label: t("limits.allowedActions"), text: version.limits.allowedActions.map(kind => t("actions." + kind)).join(", ") },
    "limits.maxSpreadsheetLoads": { group: "limits", label: t("limits.maxSpreadsheetLoads"), text: version.limits.maxSpreadsheetLoads },
    "limits.maxDocumentPages": { group: "limits", label: t("limits.maxDocumentPages"), text: version.limits.maxDocumentPages },
  });
  const groups: ComparisonGroup[] = [];
  if (theirs) {
    const [before, after] = [lines(theirs), lines(draft)];
    for (const group of ["profile", "cases", "limits"] as const) {
      const changed = changedParts(theirs, draft).filter(part => before[part]?.group === group);
      if (changed.length) groups.push({ key: group, identity: [t(`tabs.${group}`)], lines: changed.map(part => ({ key: part, label: before[part]!.label, before: value(before[part]!.text), after: value(after[part]!.text) })) });
    }
  }
  return <Surface title={t("conflict.title")} padded actions={<>
    <Button type="button" variant="outline" disabled={working} pending={working} onClick={onReview}>{t(working ? "conflict.reviewing" : "conflict.review")}</Button>
    {review ? <><Button type="button" variant="outline" disabled={working} onClick={() => onAccept(false)}>{t("conflict.useCurrent")}</Button>
      <Button type="button" disabled={working} onClick={() => onAccept(true)}>{t("conflict.keepMine")}</Button></> : null}
  </>}>
    <p className="max-w-3xl text-sm">{t("conflict.message")}</p>
    {review ? groups.length ? <ComparisonTable columns={{ identity: [{ key: "part", header: t("conflict.changes") }], label: t("conflict.field"), before: t("conflict.current"), after: t("conflict.mine") }} groups={groups} />
      : <p className="text-sm text-[var(--color-content-muted)]">{t("conflict.same")}</p> : null}
  </Surface>;
}
