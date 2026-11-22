import { useId, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FilterChip } from "@/shared/ui/FilterChip";
import { FormField } from "@/shared/ui/FormField";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { PlusIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { agentActionKinds } from "../api/assistantAgent";
import { agentLimits, type AgentIssue, type DraftLimits } from "../lib/assistantAgentDraft";
import { actionIcons, limitsFieldId } from "./assistantAgentParts";

/**
 * Límites (AS5): topics it does not answer, what it cannot promise, the longest reply and the daily replies, and the actions it may
 * use. The fixed rules of every drafted reply go in the (i) of the title; when it hands off is said by the message of the profile.
 */
export function AssistantLimitsTab({ limits, errors, locked, message, onChange }: {
  limits: DraftLimits; errors: Readonly<Record<string, string>>; locked: boolean; message: (issue: AgentIssue) => string; onChange: (next: Partial<DraftLimits>) => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const ids = useId();
  const [topic, setTopic] = useState("");
  const [topicIssue, setTopicIssue] = useState<AgentIssue | null>(null);
  const full = limits.blockedTopics.length >= agentLimits.blockedTopics;
  const topicErrors = [errors["limits.blockedTopics"], ...limits.blockedTopics.flatMap((value, index) => errors[`limits.blockedTopics[${index}]`] ? [t("quoted", { text: value }) + " " + errors[`limits.blockedTopics[${index}]`]] : [])].filter(Boolean);
  const topicError = topicIssue ? message(topicIssue) : topicErrors.join(" ") || undefined;
  const addTopic = () => {
    const value = topic.trim();
    if (!value) return;
    if (value.length > agentLimits.blockedTopic) { setTopicIssue({ key: "validation.tooLong", values: { count: agentLimits.blockedTopic } }); return; }
    if (limits.blockedTopics.some(item => item.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) { setTopicIssue({ key: "validation.repeatedTopic" }); return; }
    onChange({ blockedTopics: [...limits.blockedTopics, value] });
    setTopic(""); setTopicIssue(null);
  };
  const number = (field: "maxReplyLength" | "dailyReplyLimit" | "dailyOfferLimit", min: number, max: number, unit: string) => <FormField label={t("limits." + field)} help={t(`limits.${field}Help`)}
    required error={errors["limits." + field]} beside={<span className="text-sm text-[var(--color-content-muted)]">{unit}</span>}>
    <Input id={limitsFieldId[field]} type="number" inputMode="numeric" step={1} min={min} max={max} className="w-24" disabled={locked} value={limits[field]}
      onChange={event => onChange({ [field]: event.target.value })} />
  </FormField>;
  return <Surface title={t("limits.title")} help={t("limits.help")} padded>
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        {/* As the chosen values of a filter: each topic a chip with its cross, and the box to add one under them. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor={limitsFieldId.topics}>{t("limits.topics")}</Label>
            <span className="-my-1 inline-flex"><InfoTip text={t("limits.topicsHelp")} label={t("common:actions.moreInfo", { label: t("limits.topics") })} /></span>
          </div>
          {limits.blockedTopics.length ? <ul aria-label={t("limits.topics")} className="flex flex-wrap gap-1.5">{limits.blockedTopics.map((value, index) => <li key={index}>
            {locked ? <FilterChip>{value}</FilterChip> : <FilterChip removeLabel={t("limits.removeTopic", { topic: value })} onRemove={() => { onChange({ blockedTopics: limits.blockedTopics.filter((_, other) => other !== index) }); setTopicIssue(null); }}>{value}</FilterChip>}
          </li>)}</ul> : null}
          <div className="flex flex-wrap items-center gap-2">
            <DisabledReason reason={full && !locked ? t("limits.topicsLimit", { count: agentLimits.blockedTopics }) : null} className="min-w-0 flex-1">
              <Input id={limitsFieldId.topics} className="min-w-40 flex-1" maxLength={agentLimits.blockedTopic} placeholder={t("limits.topicPlaceholder")} disabled={locked || full} value={topic}
                aria-invalid={topicError ? true : undefined} aria-describedby={topicError ? ids + "topics-error" : undefined}
                onChange={event => { setTopic(event.target.value); setTopicIssue(null); }} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); addTopic(); } }} />
            </DisabledReason>
            {locked ? null : <Button type="button" variant="outline" disabled={full || !topic.trim()} onClick={addTopic}><PlusIcon className="size-4" />{t("limits.addTopic")}</Button>}
          </div>
          {topicError ? <p id={ids + "topics-error"} role="alert" className="text-sm text-[var(--color-danger)]">{topicError}</p> : null}
        </div>
        <FormField label={t("limits.cannotPromise")} help={t("limits.cannotPromiseHelp")} error={errors["limits.cannotPromise"]}>
          <Textarea id={limitsFieldId.cannotPromise} rows={2} maxLength={agentLimits.cannotPromise} disabled={locked} placeholder={t("limits.cannotPromisePlaceholder")} value={limits.cannotPromise}
            onChange={event => onChange({ cannotPromise: event.target.value })} />
        </FormField>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {number("maxReplyLength", agentLimits.minReplyLength, agentLimits.maxReplyLength, t("limits.characters"))}
        {number("dailyReplyLimit", agentLimits.minDailyReplies, agentLimits.maxDailyReplies, t("limits.perDay"))}
        {number("dailyOfferLimit", agentLimits.minDailyOffers, agentLimits.maxDailyOffers, t("limits.perDay"))}
      </div>
    </div>
    <div role="group" aria-labelledby={ids + "actions"} aria-describedby={errors["limits.allowedActions"] ? ids + "actions-error" : undefined} className="flex flex-col gap-1.5">
      <GroupLabel id={ids + "actions"} help={t("limits.allowedActionsHelp")}>{t("limits.allowedActions")}</GroupLabel>
      <div className="grid gap-x-6 sm:grid-cols-2">{agentActionKinds.map(kind => {
        const Icon = actionIcons[kind];
        const id = "agent-limits-action-" + kind;
        const checked = limits.allowedActions.includes(kind);
        // As CheckboxField, with the icon of the action before its name: the whole row marks the box.
        return <div key={kind} className="relative flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 hover:bg-[var(--color-surface-muted)]">
          <Checkbox id={id} checked={checked} disabled={locked} onCheckedChange={value => onChange({ allowedActions: value === true ? [...limits.allowedActions, kind] : limits.allowedActions.filter(item => item !== kind) })} />
          <Label htmlFor={id} className="cursor-pointer gap-2 font-normal after:absolute after:inset-0"><Icon className="size-4 shrink-0 text-[var(--color-content-muted)]" />{t("actions." + kind)}</Label>
        </div>;
      })}</div>
      {errors["limits.allowedActions"] ? <p id={ids + "actions-error"} role="alert" className="text-sm text-[var(--color-danger)]">{errors["limits.allowedActions"]}</p> : null}
    </div>
  </Surface>;
}
