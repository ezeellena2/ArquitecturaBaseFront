import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { PhonePreview } from "@/shared/ui/PhonePreview";
import { Button } from "@/shared/ui/button";
import { formScreens } from "../fileQuestions";
import { localizedValue } from "../editorModel";
import type { DraftEditorValue, FormCulture } from "../model";

export function FormPreview({ value, culture }: { value: DraftEditorValue; culture: FormCulture }) {
  const { t } = useTranslation("forms");
  const { t: content } = useTranslation("forms", { lng: culture });
  // Illustrative answers are strings: decimal precision, DateOnly and absent/false stay distinct.
  const screens = formScreens(value.draft.fields);
  const [selectedScreen, setSelectedScreen] = useState(0);
  const screen = Math.min(selectedScreen, screens.length - 1);
  const lastScreen = screen === screens.length - 1;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const text = (map: Parameters<typeof localizedValue>[0]) => localizedValue(map, culture, value.draft.culture);
  const missing = (map: Parameters<typeof localizedValue>[0]) => !!map && Object.values(map).some(v => !!v?.trim()) && !map[culture]?.trim();
  const marked = (map: Parameters<typeof localizedValue>[0], fallback: string) => (text(map) || fallback) + (missing(map) ? " · " + content("translationPending") : "");
  return <section aria-label={t("preview")} className="flex min-w-0 flex-col gap-3">
    <h2 className="text-xs font-semibold uppercase tracking-wide">{screens.length > 1 ? t("files.previewScreen", { number: screen + 1, total: screens.length }) : t("preview")}</h2>
    <p className="text-sm text-[var(--color-content-muted)]">{t("previewContentLanguage", { language: t("cultures." + culture) })}</p>
    <PhonePreview title={marked(value.name, content("new"))}>
      {value.draft.fields.length === 0 ? <p className="text-sm text-[var(--color-content-muted)]">{content("previewEmpty")}</p> : null}
      {screens[screen]!.map(q => {
        const label = marked(q.label, content("question"));
        const answer = answers[q.localId] ?? "";
        const setAnswer = (next: string) => setAnswers(previous => ({ ...previous, [q.localId]: next }));
        const help = text(q.help) ? marked(q.help, "") : undefined;
        if (q.type === "photo" || q.type === "document") return <div key={q.localId} className="flex flex-col gap-2"><p className="text-sm font-medium">{label}</p>{help ? <p className="text-sm text-[var(--color-content-muted)]">{help}</p> : null}<Button type="button" variant="outline" disabled>{content(q.type === "document" ? "files.attachDocument" : q.files.photoSource === "camera" ? "files.takePhoto" : "files.addPhotos")}</Button><p className="text-xs text-[var(--color-content-muted)]">{content("files.range", { minimum: q.files.minFiles, maximum: q.files.maxFiles })}</p></div>;
        if (q.type === "boolean") return <div key={q.localId} className="flex flex-col gap-1.5"><p className="text-sm font-medium">{label}{q.required ? " *" : ""}</p><RadioGroupField label={label} value={answers[q.localId]} onValueChange={setAnswer} options={[{ value: "true", label: content("yes") }, { value: "false", label: content("no") }]} />{help ? <p className="text-sm text-[var(--color-content-muted)]">{help}</p> : null}</div>;
        return <FormField key={q.localId} label={label} required={q.required} hint={[help, q.type === "choice" && q.source ? content("catalogQuestion.optionsAtSend") : q.type === "choice" && !q.source && q.options.some(o => missing(o.label)) ? content("optionsMissing", { count: q.options.filter(o => missing(o.label)).length }) : q.type === "decimal" ? content("decimalHint") : q.type === "date" ? content("dateHint") : undefined].filter(Boolean).join(" · ") || undefined}>
          {q.type === "choice" && q.source ? <NativeSelect disabled value=""><option value="">{content("select")}</option></NativeSelect>
            : q.type === "choice" && !q.source ? <NativeSelect required={q.required} value={answer} onChange={e => setAnswer(e.target.value)}><option value="">{content("select")}</option>{q.options.map((o, index) => <option key={o.localId} value={o.choiceId ?? o.localId}>{marked(o.label, content("option", { number: index + 1 }))}</option>)}</NativeSelect>
            : q.type === "longText" ? <Textarea required={q.required} maxLength={q.maxLength ?? 600} value={answer} onChange={e => setAnswer(e.target.value)} />
              : <Input type={q.type === "date" ? "date" : "text"} maxLength={q.type === "shortText" ? q.maxLength ?? 80 : undefined} inputMode={q.type === "decimal" ? "decimal" : undefined} required={q.required} value={answer} onChange={e => setAnswer(e.target.value)} />}
        </FormField>;
      })}
      <div className="mt-auto flex flex-col gap-2">{screen > 0 ? <Button type="button" variant="outline" onClick={() => setSelectedScreen(screen - 1)}>{content("files.previousScreen")}</Button> : null}<Button type="button" disabled={lastScreen} onClick={() => setSelectedScreen(screen + 1)}>{lastScreen ? marked(value.draft.submitLabel, content("submitLabel")) : content("files.continue")}</Button><p className="text-xs text-[var(--color-content-muted)]">{content("previewOnly")}</p></div>
    </PhonePreview>
    {screens.length > 1 ? <p className="text-center text-sm text-[var(--color-content-muted)]">{t("files.screenHint")}</p> : null}
    <p className="text-center text-sm text-[var(--color-content-muted)]">{t("previewMissingHint")}</p>
    <p className="text-center text-sm text-[var(--color-content-muted)]">{t("previewHint")}</p>
  </section>;
}
