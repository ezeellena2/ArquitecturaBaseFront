import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { PhonePreview } from "@/shared/ui/PhonePreview";
import { Button } from "@/shared/ui/button";
import { formScreens } from "../fileQuestions";
import { Banner } from "@/shared/ui/Banner";
import { missingFormTexts } from "../editorModel";
import type { CatalogQuestionPreview, DraftEditorValue, FormCulture } from "../model";
import { sameCatalogQuestionSource } from "../catalogQuestionSource";

export function FormPreview({ value, culture, catalogPreviews = {} }: { value: DraftEditorValue; culture: FormCulture; catalogPreviews?: Readonly<Record<string, CatalogQuestionPreview | null>> }) {
  const { t } = useTranslation("forms");
  const missing = culture === value.draft.culture ? 0 : missingFormTexts(value, culture);
  const previewCulture = missing ? value.draft.culture : culture;
  const { t: content } = useTranslation("forms", { lng: previewCulture });
  // Illustrative answers are strings: decimal precision, DateOnly and absent/false stay distinct.
  const screens = formScreens(value.draft.fields);
  const [selectedScreen, setSelectedScreen] = useState(0);
  const screen = Math.min(selectedScreen, screens.length - 1);
  const lastScreen = screen === screens.length - 1;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multipleAnswers, setMultipleAnswers] = useState<Record<string, readonly string[]>>({});
  const text = (map: Readonly<Partial<Record<FormCulture, string | null>>> | null) => {
    const selected = map?.[previewCulture];
    return selected?.trim() ? selected : "";
  };
  return <section aria-label={t("preview")} className="flex min-w-0 flex-col gap-3">
    <h2 className="text-xs font-semibold uppercase tracking-wide">{t("previewForAccount", { language: t("cultureNamesInText." + culture) })}</h2>
    {screens.length > 1 ? <p lang={previewCulture} className="text-sm text-[var(--color-content-muted)]">{content("files.previewScreen", { number: screen + 1, total: screens.length })}</p> : null}
    {missing ? <Banner>{t("previewFallback", { count: missing, requested: t("cultureNamesInText." + culture), actual: t("cultureNamesInText." + previewCulture) })}</Banner> : <p className="text-sm text-[var(--color-content-muted)]">{t("previewContentLanguage", { language: t("cultureNamesInText." + previewCulture) })}</p>}
    <div lang={previewCulture}><PhonePreview title={text(value.name) || content("new")}>
      {value.draft.fields.length === 0 ? <p className="text-sm text-[var(--color-content-muted)]">{content("previewEmpty")}</p> : null}
      {screens[screen]!.map(q => {
        const label = text(q.label) || content("question");
        const answer = answers[q.localId] ?? "";
        const setAnswer = (next: string) => setAnswers(previous => ({ ...previous, [q.localId]: next }));
        const help = text(q.help) || undefined;
        if (q.type === "photo" || q.type === "document") return <div key={q.localId} className="flex flex-col gap-2"><p className="text-sm font-medium">{label}</p>{help ? <p className="text-sm text-[var(--color-content-muted)]">{help}</p> : null}<Button type="button" variant="outline" disabled>{content(q.type === "document" ? "files.attachDocument" : q.files.photoSource === "camera" ? "files.takePhoto" : "files.addPhotos")}</Button><p className="text-xs text-[var(--color-content-muted)]">{content("files.range", { minimum: q.files.minFiles, maximum: q.files.maxFiles })}</p></div>;
        if ((q.type === "choice" || q.type === "multiChoice") && q.source) {
          const candidate = catalogPreviews[q.localId];
          const prepared = candidate?.culture === previewCulture && sameCatalogQuestionSource(candidate.source, q.source) ? candidate : null;
          const options = prepared?.state === "Ready" ? prepared.options : [];
          const maximum = q.type === "multiChoice" ? q.selection.maxSelected : null;
          const picked = (multipleAnswers[q.localId] ?? []).filter(id => options.some(option => option.id === id)).slice(0, maximum ?? 0);
          return <div key={q.localId} role="group" aria-label={label} className="flex flex-col gap-1.5"><p className="text-sm font-medium">{label}{q.required ? " *" : ""}</p>{help ? <p className="text-xs text-[var(--color-content-muted)]">{help}</p> : null}
            {!prepared ? <>{q.type === "choice" ? <NativeSelect aria-label={label} disabled value=""><option value="">{content("select")}</option></NativeSelect> : null}<p className="text-xs text-[var(--color-content-muted)]">{content("catalogQuestion.optionsAtSend")}</p></> : prepared.state !== "Ready" ? <p className="text-xs text-[var(--color-content-muted)]">{content(prepared.state === "RecipientDataMissing" ? "catalogQuestion.preview.missingData" : "catalogQuestion.preview.unavailable")}</p> : options.length === 0 ? <p className="text-xs text-[var(--color-content-muted)]">{content("catalogQuestion.preview.noOptions")}</p> : q.type === "multiChoice" ? <><p className="text-xs text-[var(--color-content-muted)]">{content("multiple.upTo", { maximum: maximum ?? "—" })}</p>{options.map(option => <CheckboxField key={option.id} label={option.title} description={option.description || undefined} checked={picked.includes(option.id)} disabled={!picked.includes(option.id) && (maximum === null || picked.length >= maximum)} onCheckedChange={checked => setMultipleAnswers(previous => ({ ...previous, [q.localId]: checked ? [...picked, option.id] : picked.filter(id => id !== option.id) }))}/>)}</> : <><NativeSelect aria-label={label} value={options.some(option => option.id === answer) ? answer : ""} onChange={event => setAnswer(event.target.value)}><option value="">{content("select")}</option>{options.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</NativeSelect>{options.find(option => option.id === answer)?.description ? <p className="text-xs text-[var(--color-content-muted)]">{options.find(option => option.id === answer)!.description}</p> : null}</>}
          </div>;
        }
        if (q.type === "multiChoice") {
          const maximum = q.selection.maxSelected;
          const own = q.source ? [] : q.options;
          const picked = (multipleAnswers[q.localId] ?? []).filter(id => own.some(option => (option.choiceId ?? option.localId) === id)).slice(0, maximum ?? 0);
          return <div key={q.localId} role="group" aria-label={label} className="flex flex-col gap-1.5"><p className="text-sm font-medium">{label}{q.required ? " *" : ""}</p><p className="text-xs text-[var(--color-content-muted)]">{help ?? content("multiple.upTo", { maximum: maximum ?? "—" })}</p>
            {q.source ? <p className="text-xs text-[var(--color-content-muted)]">{content("catalogQuestion.optionsAtSend")}</p> : own.map((option, index) => {
              const id = option.choiceId ?? option.localId; const selected = picked.includes(id);
              return <CheckboxField key={id} label={text(option.label) || content("option", { number: index + 1 })} checked={selected} disabled={!selected && (maximum === null || picked.length >= maximum)} onCheckedChange={checked => setMultipleAnswers(previous => ({ ...previous, [q.localId]: checked ? [...picked, id] : picked.filter(value => value !== id) }))}/>;
            })}</div>;
        }
        if (q.type === "boolean") return <div key={q.localId} className="flex flex-col gap-1.5"><p className="text-sm font-medium">{label}{q.required ? " *" : ""}</p><RadioGroupField label={label} value={answers[q.localId]} onValueChange={setAnswer} options={[{ value: "true", label: content("yes") }, { value: "false", label: content("no") }]} />{help ? <p className="text-sm text-[var(--color-content-muted)]">{help}</p> : null}</div>;
        return <FormField key={q.localId} label={label} required={q.required} hint={[help, q.type === "choice" && q.source ? content("catalogQuestion.optionsAtSend") : q.type === "decimal" ? content("decimalHint") : q.type === "date" ? content("dateHint") : undefined].filter(Boolean).join(" · ") || undefined}>
          {q.type === "choice" && q.source ? <NativeSelect disabled value=""><option value="">{content("select")}</option></NativeSelect>
            : q.type === "choice" && !q.source ? <NativeSelect required={q.required} value={answer} onChange={e => setAnswer(e.target.value)}><option value="">{content("select")}</option>{q.options.map((o, index) => <option key={o.localId} value={o.choiceId ?? o.localId}>{text(o.label) || content("option", { number: index + 1 })}</option>)}</NativeSelect>
            : q.type === "longText" ? <Textarea required={q.required} maxLength={q.maxLength ?? 600} value={answer} onChange={e => setAnswer(e.target.value)} />
              : <Input type={q.type === "date" ? "date" : "text"} maxLength={q.type === "shortText" ? q.maxLength ?? 80 : undefined} inputMode={q.type === "decimal" ? "decimal" : undefined} required={q.required} value={answer} onChange={e => setAnswer(e.target.value)} />}
        </FormField>;
      })}
      <div className="mt-auto flex flex-col gap-2">{screen > 0 ? <Button type="button" variant="outline" onClick={() => setSelectedScreen(screen - 1)}>{content("files.previousScreen")}</Button> : null}<Button type="button" disabled={lastScreen} onClick={() => setSelectedScreen(screen + 1)}>{lastScreen ? text(value.draft.submitLabel) || content("submitLabel") : content("files.continue")}</Button><p className="text-xs text-[var(--color-content-muted)]">{content("previewOnly")}</p></div>
    </PhonePreview></div>
    {screens.length > 1 ? <p className="text-center text-sm text-[var(--color-content-muted)]">{t("files.screenHint")}</p> : null}
    <p className="text-center text-sm text-[var(--color-content-muted)]">{t("previewMissingHint")}</p>
    <p className="text-center text-sm text-[var(--color-content-muted)]">{t("previewHint")}</p>
  </section>;
}
