import { useTranslation } from "react-i18next";
import type { CatalogField } from "../api/catalogResponse";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItemsById } from "../hooks/useCatalogQueries";
import { usePersonAttributes } from "../hooks/usePersonData";
import { administrativeName } from "../editorModel";
import { presentationPartNames } from "../catalogPresentation";
import { catalogScalarText } from "../catalogValues";
import type { FormCatalogMatch } from "../model";

// The chosen option is read by id, so its label shows even beyond the first page or once it is inactive, never its GUID.
// While it loads the value shows «…»; a failed read, or a value that is not an option of the source, says it is unavailable.
// The folded band of the filters (ZP1-A) names it the same way.
export function FixedCatalogValue({ scope, field, value }: { scope: CatalogReadScope; field: CatalogField; value: string }) {
  const { t } = useTranslation("forms");
  const read = useCatalogItemsById(scope, field.sourceCatalogId ?? "", [value]);
  const option = read.data?.items.find(item => item.id === value);
  return option ? administrativeName(option.text, scope.culture) : read.isLoading ? "…" : t("catalogQuestion.filter.unavailableValue");
}

// The catalog data of a question in the draft review (LR2-A, 2026-11-03), each in its own cell: the catalog, the field that
// names a filter, the value of the filter and the fields of the presentation. The catalog is read when they show, by id.
export function CatalogName({ scope, id }: { scope: CatalogReadScope; id: string }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, id, "global");
  if (!detail.data) return detail.isLoading ? "…" : t("catalogQuestion.filter.unavailableValue");
  return administrativeName(detail.data.name, scope.culture);
}

export function CatalogFieldName({ scope, catalogId, fieldId }: { scope: CatalogReadScope; catalogId: string; fieldId: string }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, catalogId, "global");
  if (!detail.data) return detail.isLoading ? "…" : t("catalogQuestion.filter.unavailable");
  return administrativeName(detail.data.fields?.find(field => field.id === fieldId)?.name, scope.culture) || t("catalogQuestion.filter.unavailable");
}

export function CatalogConditionValue({ scope, catalogId, condition }: { scope: CatalogReadScope; catalogId: string; condition: FormCatalogMatch<string | null> }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, catalogId, "global");
  const attributes = usePersonAttributes(scope, "personAttributeId" in condition);
  if ("personAttributeId" in condition) return administrativeName(attributes.data?.items.find(attribute => attribute.id === condition.personAttributeId)?.name, scope.culture) || t("catalogQuestion.filter.personData");
  const field = detail.data?.fields?.find(item => item.id === condition.fieldId);
  if (field?.type === "catalog") return condition.value ? <FixedCatalogValue scope={scope} field={field} value={condition.value} /> : t("translationPending");
  if (condition.value === null) return t("translationPending");
  return field && field.type !== "text" ? catalogScalarText(field.type, condition.value, scope.culture, { yes: t("yes"), no: t("no") }) : condition.value;
}

export function CatalogPresentationValue({ scope, catalogId, parts }: { scope: CatalogReadScope; catalogId: string; parts: readonly string[] }) {
  const { t } = useTranslation("forms");
  const detail = useCatalogDetail(scope, catalogId, "global");
  if (!detail.data) return detail.isLoading ? "…" : t("catalogQuestion.filter.unavailable");
  const unavailable = t("catalogQuestion.filter.unavailable");
  return presentationPartNames({ title: parts, description: [] }, detail.data.fields ?? [], scope.culture, key => t("catalogs.items." + key), unavailable).title.join(" · ");
}
