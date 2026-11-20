import { useTranslation } from "react-i18next";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import type { ResponseResultColumn } from "../api/responses";
import { useResponseScope } from "../hooks/useResponseQueries";
import { responseCatalogColumnId, responseColumnDescriptors, responseResultColumnId, type ResponseCatalogFieldSelection, type ResponseColumn } from "../responses";

const fixedId = (key: string) => "fixed:" + key;

/**
 * «Columnas» of the sheet: the only piece to choose several (DS1-A) with the button of the bar, which keeps saying «Columnas» or
 * how many are hidden. The columns the sheet always shows go first, marked and off with their reason (MA1-A), and a line parts
 * them from the questions. A subcolumn of a catalog question says its question in grey, and a datum an external action left
 * (RE1-A), its origin, each origin after a line. Each mark applies at once; on the phone, with «Listo».
 */
export function ResponseColumnsMenu({
  columns,
  visible,
  visibleCatalogFields = [],
  resultColumns = [],
  visibleResults = [],
  onChange,
}: {
  columns: readonly ResponseColumn[];
  visible: readonly ResponseColumn[];
  visibleCatalogFields?: readonly ResponseCatalogFieldSelection[];
  /// RE1-A: the data external actions left, after the questions.
  resultColumns?: readonly ResponseResultColumn[];
  visibleResults?: readonly ResponseResultColumn[];
  onChange: (ids: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  const scope = useResponseScope();
  const selected = new Set([...visible.map(column => column.fieldId), ...visibleCatalogFields.map(field => responseCatalogColumnId(field.questionId, field.fieldId)),
    ...visibleResults.map(column => responseResultColumnId(column.id))]);
  // Questions, catalog subcolumns and result data; the fixed columns are always shown, «Cargó» only to whoever sees it (CW6-C).
  const descriptors = responseColumnDescriptors(columns);
  const all = [...descriptors.map(column => column.id), ...resultColumns.map(column => responseResultColumnId(column.id))];
  const hidden = all.filter(id => !selected.has(id)).length;
  const fixed = ["number", "received", ...scope.ownOnly ? [] : ["actor"]];
  const options: PickerOption[] = [
    ...fixed.map(key => ({ id: fixedId(key), label: t(`responses.${key}`), disabledReason: t("responses.alwaysShown") })),
    ...descriptors.map(({ id, question, catalogField }, index) => catalogField
      ? { id, label: `${catalogField.label} · ${t("catalogs.fields.roles." + catalogField.role).toLowerCase()}`, description: question.label }
      : { id, label: question.label + (question.introducedInVersion > 1 ? " " + t("responses.sinceVersion", { version: question.introducedInVersion }) : ""), separated: index === 0 }),
    ...resultColumns.map((column, index) => ({ id: responseResultColumnId(column.id), label: column.label, description: column.sourceName,
      separated: resultColumns[index - 1]?.source !== column.source })),
  ];
  return <Picker multiple trigger="button" label={t("responses.columns")} triggerLabel={t(hidden ? "responses.columnsHidden" : "responses.columns", { count: hidden })}
    options={options} value={[...fixed.map(fixedId), ...selected]} onChange={ids => { const next = new Set(ids); onChange(all.filter(id => next.has(id))); }}/>;
}
