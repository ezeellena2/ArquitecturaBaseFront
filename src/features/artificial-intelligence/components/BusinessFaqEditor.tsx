import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronDownIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import type { BusinessFaq } from "../api/businessInformation";
const presets = ["booking","payment","delivery","quote","returns","parking"] as const;
export function BusinessFaqEditor({ value,onChange,editable,locked,error,legacy }: { value: BusinessFaq[];onChange:(value:BusinessFaq[])=>void;editable:boolean;locked:boolean;error?:string;legacy:React.ReactNode }) {
  const { t } = useTranslation("businessInformation");
  const [expanded,setExpanded] = useState<string | null>(null);
  const full = value.length >= 20;
  const limitReason = !locked && full ? t("faqLimit",{ count:20 }) : null;
  function add(question:string) { const id = crypto.randomUUID();onChange([...value,{ id,question,answer:"" }]);setExpanded(id); }
  function update(id:string,next:Partial<BusinessFaq>) { onChange(value.map(entry => entry.id === id ? { ...entry,...next } : entry)); }
  return <Surface title={t("answers")} padded><div id="business-details.faq" tabIndex={-1} role="group" aria-label={t("answers")} aria-invalid={!!error} aria-describedby={error ? "business-faq-error" : undefined} className="space-y-4">
    <p className="text-sm text-[var(--color-content-muted)]">{t("faqHint")}</p>
    {editable ? <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><FormField label={t("addPreset")}><DisabledReason reason={limitReason} className="grid w-full"><NativeSelect value="" disabled={locked || full} onChange={event => { if (event.target.value) add(t(`presets.${event.target.value}`)); }}><option value="">{t("chooseQuestion")}</option>{presets.filter(preset => !value.some(entry => entry.question === t(`presets.${preset}`))).map(preset => <option key={preset} value={preset}>{t(`presets.${preset}`)}</option>)}</NativeSelect></DisabledReason></FormField></div><DisabledReason reason={limitReason}><Button variant="outline" disabled={locked || full} onClick={() => add("")}>{t("customQuestion")}</Button></DisabledReason></div> : null}
    {!value.length ? <p className="text-sm text-[var(--color-content-muted)]">{t("noQuestions")}</p> : <div className="divide-y divide-[var(--color-border)]">{value.map((entry,index) => <div key={entry.id} className="py-3">
      <div className="flex items-center gap-2"><Button variant="muted-link" className="min-w-0 flex-1 justify-start whitespace-normal text-left" aria-expanded={expanded === entry.id} aria-controls={`business-faq-${entry.id}`} onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}><ChevronDownIcon className="size-4 shrink-0" />{entry.question || t("newQuestion",{ number:index+1 })}</Button><span className="text-xs text-[var(--color-content-muted)]">{t(entry.answer.trim() && entry.question.trim() ? "answered" : "unanswered")}</span>{editable ? <IconButton label={`${t("removeQuestion")} · ${entry.question || index+1}`} size="icon-sm" disabled={locked} onClick={() => onChange(value.filter(previous => previous.id !== entry.id))}><TrashIcon className="size-4" /></IconButton> : null}</div>
      {expanded === entry.id ? <div id={`business-faq-${entry.id}`} className="grid gap-4 pt-3 sm:grid-cols-2"><FormField label={t("question")} required><Input maxLength={200} value={entry.question} readOnly={!editable} disabled={locked} onChange={event => update(entry.id,{ question:event.target.value })} /></FormField><FormField label={t("answer")}><Textarea rows={2} maxLength={1000} placeholder={t("answerPlaceholder")} value={entry.answer} readOnly={!editable} disabled={locked} onChange={event => update(entry.id,{ answer:event.target.value })} /></FormField></div> : null}
    </div>)}</div>}
    {error ? <p id="business-faq-error" role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--color-content-muted)]"><p>{t("faqSafety")}</p><p>{t("faqCount",{ count:value.filter(entry => entry.question.trim() && entry.answer.trim()).length })}</p></div>
  </div>{legacy}</Surface>;
}
