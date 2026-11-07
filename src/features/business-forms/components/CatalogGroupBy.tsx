import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import type { CatalogField } from "../api/catalogResponse";
import { groupByFields } from "../catalogQuestionSource";
import { administrativeName } from "../editorModel";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail } from "../hooks/useCatalogQueries";
import type { DraftQuestionSource, FormCulture } from "../model";

// LD1-A (2026-11-07): below «Permitir elegir varias», «Elegir primero por un campo» with its (i) and, checked, «Campo» with
// the active text and catalog fields of the catalog, of either role; checking it chooses the first one that serves. It is one
// option, so in a question of several it stays off with its reason. A catalog without those fields does not offer it, and a
// field that no longer serves keeps its name (never its id) until another one is chosen.
export function CatalogGroupBySetting({ source, fields, type, culture, readOnly, error, onChange }: {
  source: DraftQuestionSource; fields: readonly CatalogField[]; type: "choice" | "multiChoice"; culture: FormCulture; readOnly: boolean; error?: string;
  onChange: (source: DraftQuestionSource) => void;
}) {
  const { t } = useTranslation("forms");
  const eligible = groupByFields(fields), selected = source.groupBy ?? null;
  if (!eligible.length && selected === null) return null;
  const multiple = type === "multiChoice" && selected === null;
  const current = fields.find(field => field.id === selected);
  const kept = selected !== null && !eligible.some(field => field.id === selected);
  return <div data-question-control="groupBy" className="flex flex-col gap-2">
    <CheckboxField label={t("catalogQuestion.groupBy.label")} help={t("catalogQuestion.groupBy.help")} checked={selected !== null} disabled={readOnly || multiple}
      disabledReason={multiple ? t("catalogQuestion.groupBy.notWithMultiple") : null} onCheckedChange={checked => onChange({ ...source, groupBy: checked ? eligible[0]?.id ?? null : null })}/>
    {selected !== null ? <div className="grid pl-6 sm:grid-cols-2"><FormField label={t("catalogQuestion.groupBy.field")} error={error}>
      <NativeSelect value={selected} disabled={readOnly} onChange={event => onChange({ ...source, groupBy: event.target.value })}>
        {kept ? <option value={selected}>{current ? administrativeName(current.name, culture) : t("catalogQuestion.filter.unavailable")}</option> : null}
        {eligible.map(field => <option key={field.id} value={field.id}>{administrativeName(field.name, culture)}</option>)}
      </NativeSelect></FormField></div> : null}
  </div>;
}

/** The line of the question names the field to choose first: «Elegir de un catálogo, primero por Rubro». */
export function CatalogGroupByName({ scope, catalogId, fieldId }: { scope: CatalogReadScope; catalogId: string; fieldId: string }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, catalogId, "global");
  const field = detail.data?.fields?.find(item => item.id === fieldId);
  if (!scope.actorId || !scope.permissions.includes("formcatalogs.read") || !field || detail.error instanceof ApiError && [401, 403].includes(detail.error.status)) return null;
  return <span>{t("catalogQuestion.groupBy.line", { field: administrativeName(field.name, scope.culture) })}</span>;
}
