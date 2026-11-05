import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { PhonePreview } from "@/shared/ui/PhonePreview";
import { Button } from "@/shared/ui/button";
import { InfoTip } from "@/shared/ui/InfoTip";
import { previewScreens } from "../rowsQuestions";
import { titlesByFirstQuestion } from "../sectionTitles";
import { Banner } from "@/shared/ui/Banner";
import { missingFormTexts } from "../editorModel";
import type { CatalogQuestionPreview, DraftEditorValue, FormCulture } from "../model";
import { sameCatalogQuestionSource } from "../catalogQuestionSource";

// `openQuestion` is the question open in the editor: with the block or one of its questions open, the preview shows a row.
export function FormPreview({ value, culture, catalogPreviews = {}, openQuestion = null }: { value: DraftEditorValue; culture: FormCulture; catalogPreviews?: Readonly<Record<string, CatalogQuestionPreview | null>>; openQuestion?: string | null }) {
  const { t, i18n } = useTranslation("forms");
  const missing = culture === value.draft.culture ? 0 : missingFormTexts(value, culture);
  const previewCulture = missing ? value.draft.culture : culture;
  const { t: content } = useTranslation("forms", { lng: previewCulture });
  // Illustrative answers are strings: decimal precision, DateOnly and absent/false stay distinct.
  const screens = previewScreens(value.draft.fields);
  const [selectedScreen, setSelectedScreen] = useState(0);
  const [seenOpen, setSeenOpen] = useState(openQuestion);
  if (openQuestion !== seenOpen) {
    setSeenOpen(openQuestion);
    const row = screens.findIndex(item => item.kind === "row" && (item.block.localId === openQuestion || item.questions.some(q => q.localId === openQuestion)));
    if (row >= 0) setSelectedScreen(row);
  }
  const screen = Math.min(selectedScreen, screens.length - 1);
  const lastScreen = screen === screens.length - 1;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multipleAnswers, setMultipleAnswers] = useState<Record<string, readonly string[]>>({});
  const text = (map: Readonly<Partial<Record<FormCulture, string | null>>> | null) => {
    const selected = map?.[previewCulture];
    return selected?.trim() ? selected : "";
  };
  // NI1-A (2026-11-03): the heading names the account's language only when it is not the menu's.
  const heading = culture === (i18n.language.startsWith("en") ? "en" : "es") ? t("preview") : t("previewForAccount", { language: t("cultureNamesInText." + culture) });
  const position = { number: screen + 1, total: screens.length };
  const current = screens[screen]!;
  const blockName = current.kind === "fields" ? "" : text(current.block.label) || content("rows.defaultName");
  const title = current.kind === "row" ? content("rows.previewTitle", { name: blockName, row: 1 }) : current.kind === "ask" ? blockName : text(value.name) || content("new");
  const rowQuestion = current.kind === "ask" ? content("rows.addRow") : current.kind === "row" && current.asks ? content("rows.addAnotherRow") : null;
  // CW15-B: a section title is the subtitle right before its first question, as in WhatsApp; a section that starts with the
  // block has it atop the block's first screen.
  const titles = titlesByFirstQuestion(value.draft.fields, value.draft.sections);
  const subtitle = (localId: string) => {
    const section = titles.get(localId);
    return section ? <h3 key={"title:" + section.localId} className="text-base font-semibold">{text(section.title) || content("sections.title")}</h3> : null;
  };
  const blockSubtitle = current.kind === "ask" || current.kind === "row" && !screens.some(item => item.kind === "ask") ? subtitle(current.block.localId) : null;
  // What the preview is (illustrative, one language, sends and saves nothing) goes in the (i) of its heading, and how photos
  // and documents split the screens in the (i) of its position: no notes under the phone.
  return <section aria-label={t("preview")} className="flex min-w-0 flex-col gap-3">
    <div className="flex items-center gap-1"><h2 className="text-xs font-semibold uppercase tracking-wide">{heading}</h2><span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: heading })} text={[t("previewHint"), t("previewMissingHint"), t("previewOnly")].join(" ")} /></span></div>
    {screens.length > 1 ? <div className="flex items-center gap-1"><p lang={previewCulture} className="text-sm text-[var(--color-content-muted)]">{content("files.previewScreen", position)}</p><span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: t("files.previewScreen", position) })} text={t("files.screenHint")} /></span></div> : null}
    {missing ? <Banner>{t("previewFallback", { count: missing, requested: t("cultureNamesInText." + culture), actual: t("cultureNamesInText." + previewCulture) })}</Banner> : null}
    <div lang={previewCulture}><PhonePreview title={title}>
      {blockSubtitle}
      {(current.kind === "ask" ? [] : current.questions).map(q => <Fragment key={q.localId}>{subtitle(q.localId)}{(() => {
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
            {!prepared ? q.type === "choice" ? <NativeSelect aria-label={label} disabled value=""><option value="">{content("select")}</option></NativeSelect> : null : prepared.state !== "Ready" ? <p className="text-xs text-[var(--color-content-muted)]">{content(prepared.state === "RecipientDataMissing" ? "catalogQuestion.preview.missingData" : "catalogQuestion.preview.unavailable")}</p> : options.length === 0 ? <p className="text-xs text-[var(--color-content-muted)]">{content("catalogQuestion.preview.noOptions")}</p> : q.type === "multiChoice" ? <><p className="text-xs text-[var(--color-content-muted)]">{content("multiple.upTo", { maximum: maximum ?? "—" })}</p>{options.map(option => <CheckboxField key={option.id} label={option.title} description={option.description || undefined} checked={picked.includes(option.id)} disabled={!picked.includes(option.id) && (maximum === null || picked.length >= maximum)} onCheckedChange={checked => setMultipleAnswers(previous => ({ ...previous, [q.localId]: checked ? [...picked, option.id] : picked.filter(id => id !== option.id) }))}/>)}</> : <><NativeSelect aria-label={label} value={options.some(option => option.id === answer) ? answer : ""} onChange={event => setAnswer(event.target.value)}><option value="">{content("select")}</option>{options.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</NativeSelect>{options.find(option => option.id === answer)?.description ? <p className="text-xs text-[var(--color-content-muted)]">{options.find(option => option.id === answer)!.description}</p> : null}</>}
          </div>;
        }
        if (q.type === "multiChoice") {
          const maximum = q.selection.maxSelected;
          const own = q.source ? [] : q.options;
          const picked = (multipleAnswers[q.localId] ?? []).filter(id => own.some(option => (option.choiceId ?? option.localId) === id)).slice(0, maximum ?? 0);
          return <div key={q.localId} role="group" aria-label={label} className="flex flex-col gap-1.5"><p className="text-sm font-medium">{label}{q.required ? " *" : ""}</p><p className="text-xs text-[var(--color-content-muted)]">{help ?? content("multiple.upTo", { maximum: maximum ?? "—" })}</p>
            {own.map((option, index) => {
              const id = option.choiceId ?? option.localId; const selected = picked.includes(id);
              return <CheckboxField key={id} label={text(option.label) || content("option", { number: index + 1 })} checked={selected} disabled={!selected && (maximum === null || picked.length >= maximum)} onCheckedChange={checked => setMultipleAnswers(previous => ({ ...previous, [q.localId]: checked ? [...picked, id] : picked.filter(value => value !== id) }))}/>;
            })}</div>;
        }
        if (q.type === "boolean") return <div key={q.localId} className="flex flex-col gap-1.5"><p className="text-sm font-medium">{label}{q.required ? " *" : ""}</p><RadioGroupField label={label} value={answers[q.localId]} onValueChange={setAnswer} options={[{ value: "true", label: content("yes") }, { value: "false", label: content("no") }]} />{help ? <p className="text-sm text-[var(--color-content-muted)]">{help}</p> : null}</div>;
        return <FormField key={q.localId} label={label} required={q.required} hint={help}>
          {q.type === "choice" && q.source ? <NativeSelect disabled value=""><option value="">{content("select")}</option></NativeSelect>
            : q.type === "choice" && !q.source ? <NativeSelect required={q.required} value={answer} onChange={e => setAnswer(e.target.value)}><option value="">{content("select")}</option>{q.options.map((o, index) => <option key={o.localId} value={o.choiceId ?? o.localId}>{text(o.label) || content("option", { number: index + 1 })}</option>)}</NativeSelect>
            : q.type === "longText" ? <Textarea required={q.required} maxLength={q.maxLength ?? 600} value={answer} onChange={e => setAnswer(e.target.value)} />
              : <Input type={q.type === "date" ? "date" : "text"} maxLength={q.type === "shortText" ? q.maxLength ?? 80 : undefined} inputMode={q.type === "decimal" ? "decimal" : undefined} required={q.required} value={answer} onChange={e => setAnswer(e.target.value)} />}
        </FormField>;
      })()}</Fragment>)}
      {rowQuestion ? <div className="flex flex-col gap-1.5"><p className="text-sm font-medium">{rowQuestion} *</p><RadioGroupField label={rowQuestion} value={answers["rows:" + current.kind]} onValueChange={next => setAnswers(previous => ({ ...previous, ["rows:" + current.kind]: next }))} options={[{ value: "true", label: content("yes") }, { value: "false", label: content("no") }]} /></div> : null}
      <div className="mt-auto flex flex-col gap-2">{screen > 0 ? <Button type="button" variant="outline" onClick={() => setSelectedScreen(screen - 1)}>{content("files.previousScreen")}</Button> : null}<Button type="button" disabled={lastScreen} onClick={() => setSelectedScreen(screen + 1)}>{lastScreen ? text(value.draft.submitLabel) || content("submitLabel") : content("files.continue")}</Button></div>
    </PhonePreview></div>
  </section>;
}
