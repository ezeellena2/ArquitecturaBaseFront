import { useTranslation } from "react-i18next";
import { useId } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";
import type { CatalogPresentation, CatalogPresentationCheck } from "../api/catalogResponse";
import type { CatalogFieldDraft } from "../catalogFields";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import { catalogOptionPresentation, presentationPartNames } from "../catalogPresentation";
import type { CatalogValueType } from "../catalogValues";
import { administrativeName } from "../editorModel";
import type { FormCulture } from "../model";

// `check` is the server's count over every active option, per catalog language. Without it (an editor with unsaved
// changes) the loaded options are counted here in the shown language; null means the server count is not available,
// so nothing is counted from a partial page.
export function CatalogPresentationSection({ embedded = false, value, fields, items, valueType, culture, readOnly, check, inputCulture = culture, pendingTexts, errors = {}, onChange }: { embedded?: boolean; value: CatalogPresentation | null; fields: readonly CatalogFieldDraft[]; items: readonly CatalogManualItemValue[]; valueType: CatalogValueType; culture: FormCulture; readOnly: boolean; check?: CatalogPresentationCheck | null; inputCulture?: FormCulture; pendingTexts?: Readonly<Record<string, Readonly<Record<string, string>>>>; errors?: Readonly<Record<string, readonly string[]>>; onChange: (value: CatalogPresentation | null) => void }) {
  const { t } = useTranslation("forms");
  const labelId = useId();
  const selected = value ?? { title: ["text"], description: ["detail"] };
  const choices = [...["text", "code", "detail", ...(valueType === "Text" ? [] : ["value"])].map(key => ({ key, label: t("catalogs.items." + key), disabled: false })), ...fields.filter(field => field.isActive).map(field => ({ key: field.id ?? field.localId, label: administrativeName(field.name, culture), disabled: field.id === null }))];
  const names = presentationPartNames(selected, fields, culture, key => t("catalogs.items." + key), t("catalogs.presentation.unavailable"));
  const update = (part: "title" | "description", keys: readonly string[]) => { if (!readOnly) onChange({ title: [...selected.title], description: [...selected.description], [part]: [...keys] }); };
  const example = items.find(item => item.isActive);
  const booleanLabels = { yes: t("catalogs.presentation.yes"), no: t("catalogs.presentation.no") };
  const shown = example ? catalogOptionPresentation(example, value, fields, valueType, culture, booleanLabels, inputCulture, pendingTexts?.[example.localId]) : null;
  const hidden = fields.filter(field => field.isActive && ![...selected.title, ...selected.description].includes(field.id ?? field.localId)).map(field => administrativeName(field.name, culture));
  const localTooLong = check === undefined ? items.filter(item => item.isActive && catalogOptionPresentation(item, value, fields, valueType, culture, booleanLabels, inputCulture, pendingTexts?.[item.localId]).title.length > 30).length : 0;
  const problems = (check?.cultures ?? []).flatMap(entry => [
    { culture: entry.culture, part: "title", count: entry.titleTooLongCount, examples: entry.titleExamples },
    { culture: entry.culture, part: "description", count: entry.descriptionTooLongCount, examples: entry.descriptionExamples },
  ]).filter(problem => problem.count > 0);
  const content = <div className="space-y-4">
    {(["title", "description"] as const).map(part => {
      const id = labelId + "-" + part, error = (errors["presentation." + part] ?? errors.presentation)?.join(" ");
      return <div key={part} className="space-y-2"><Label htmlFor={id}>{t("catalogs.presentation." + (part === "title" ? "heading" : "description"))}</Label><div className="flex flex-wrap items-center gap-2">{selected[part].map((key, index) => <Badge key={key} variant="outline"><span>{names[part][index]}</span><Button type="button" size="inline" variant="ghost" disabled={readOnly || part === "title" && selected.title.length === 1} aria-label={t("catalogs.presentation.remove", { name: names[part][index], part: t("catalogs.presentation." + (part === "title" ? "heading" : "description")) })} onClick={() => update(part, selected[part].filter(value => value !== key))}>×</Button></Badge>)}<NativeSelect id={id} value="" disabled={readOnly} aria-invalid={!!error} aria-describedby={error ? id + "-error" : undefined} onChange={event => { if (event.target.value) update(part, [...selected[part], event.target.value]); }}><option value="" disabled>{t("catalogs.presentation.add")}</option>{choices.filter(choice => !selected[part].includes(choice.key)).map(choice => <option key={choice.key} value={choice.key} disabled={choice.disabled}>{choice.label}{choice.disabled ? " · " + t("catalogs.fields.savedFirst") : ""}</option>)}</NativeSelect></div>{error ? <p id={id + "-error"} role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}</div>;
    })}
    {shown ? <div className="space-y-1"><p className="text-xs font-semibold uppercase">{t("catalogs.presentation.example")}</p><div className="rounded-md border border-[var(--color-border)] p-3"><p className="break-words text-sm">{shown.title}</p>{shown.description ? <p className="break-words text-xs text-[var(--color-content-muted)]">{shown.description}</p> : null}</div></div> : null}
    {localTooLong ? <p role="status" className="text-sm text-[var(--color-warning-700)]">{t("catalogs.presentation.tooLong", { count: localTooLong })}</p> : null}
    {problems.length ? <div role="status" className="space-y-3">{problems.map(problem => <div key={problem.culture + "-" + problem.part} className="space-y-1">
      <p className="text-sm text-[var(--color-warning-700)]">{t("catalogs.presentation." + problem.part + "TooLongIn", { count: problem.count, language: t("cultureNamesInText." + problem.culture) })}</p>
      {problem.examples.length ? <ul className="list-inside list-disc break-words text-sm">{problem.examples.map(example => <li key={example.itemId}>{example.title}</li>)}</ul> : null}
      {problem.count > problem.examples.length ? <p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.presentation.more", { count: problem.count - problem.examples.length })}</p> : null}
    </div>)}</div> : null}
    {hidden.length ? <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.presentation.hidden", { fields: hidden.join(", ") })}</p> : null}
    <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.presentation.hint")}</p>
  </div>;
  return embedded ? content : <Surface title={t("catalogs.presentation.title")} padded>{content}</Surface>;
}
